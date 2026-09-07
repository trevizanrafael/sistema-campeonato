const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { limparDadosDeTeste } = require('../helpers/database');
const {
  obterUsuarioAdmin,
  criarEvento,
  criarEquipe,
  obterFaixa,
  criarCategoria,
  criarInscricao,
} = require('../helpers/factories');
const chaveService = require('../../src/services/chaveService');
const resultadoService = require('../../src/services/resultadoService');
const lutaRepository = require('../../src/repositories/lutaRepository');
const auditoriaRepository = require('../../src/repositories/auditoriaRepository');

describe('Integration: Lançamento, Correção e Anulação de Resultados', () => {
  let evento;
  let equipeA;
  let equipeB;
  let faixa;
  let categoria;
  let chave;
  let atleta1;
  let atleta2;
  let atleta3;
  let atleta4;
  let lutaSemi1;
  let adminId;

  before(async () => {
    await limparDadosDeTeste('TEST_Resultados_%');
    adminId = await obterUsuarioAdmin();
    evento = await criarEvento({
      nome: 'TEST_Resultados_Audit',
      regras: { pontos_vitoria: 3 },
    });
    equipeA = await criarEquipe({ nome: 'TEST_Equipe_A' });
    equipeB = await criarEquipe({ nome: 'TEST_Equipe_B' });
    faixa = await obterFaixa('Branca');
    categoria = await criarCategoria(evento.id, { nome: 'TEST_Cat_Resultados' });

    atleta1 = await criarInscricao(evento.id, categoria.id, equipeA.id, faixa.id, { nome: 'Atleta A1' });
    atleta2 = await criarInscricao(evento.id, categoria.id, equipeB.id, faixa.id, { nome: 'Atleta B1' });
    atleta3 = await criarInscricao(evento.id, categoria.id, equipeA.id, faixa.id, { nome: 'Atleta A2' });
    atleta4 = await criarInscricao(evento.id, categoria.id, equipeB.id, faixa.id, { nome: 'Atleta B2' });

    const gerada = await chaveService.gerarChave(evento.id, categoria.id, adminId);
    chave = gerada.chave;
    await chaveService.iniciarChave(evento.id, chave.id, adminId);

    const lutas = await lutaRepository.listarPorChave(chave.id);
    lutaSemi1 = lutas.find(l => l.rodada === 1 && l.posicao === 1);
  });

  after(async () => {
    await limparDadosDeTeste('TEST_Resultados_%');
  });

  it('deve lançar resultado, avançar vencedor, creditar pontos e registrar RESULTADO_LANCADO', async () => {
    const vencedorId = lutaSemi1.competidor_1_id;
    const res = await resultadoService.lancarResultado(
      evento.id,
      chave.id,
      lutaSemi1.id,
      {
        vencedor_id: vencedorId,
        tipo_resultado: 'PONTOS',
        placar_1: '4',
        placar_2: '2',
      },
      adminId
    );

    assert.equal(res.luta.status, 'FINALIZADA');
    assert.equal(res.luta.vencedor_id, vencedorId);

    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'RESULTADO_LANCADO' });
    const log = logs.find(l => Number(l.entidade_id) === Number(lutaSemi1.id));
    assert.ok(log, 'Deve existir log RESULTADO_LANCADO');
    assert.equal(log.dados_novos.vencedor_id, vencedorId);
  });

  it('deve corrigir resultado invertendo vencedor, transferindo pontos e registrando RESULTADO_CORRIGIDO', async () => {
    const novoVencedorId = lutaSemi1.competidor_2_id;
    const res = await resultadoService.corrigirResultado(
      evento.id,
      chave.id,
      lutaSemi1.id,
      {
        vencedor_id: novoVencedorId,
        tipo_resultado: 'FINALIZACAO',
        observacao: 'Triângulo',
      },
      adminId
    );

    assert.equal(res.luta.vencedor_id, novoVencedorId);

    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'RESULTADO_CORRIGIDO' });
    const log = logs.find(l => Number(l.entidade_id) === Number(lutaSemi1.id));
    assert.ok(log, 'Deve existir log RESULTADO_CORRIGIDO');
    assert.equal(log.dados_anteriores.vencedor_id, lutaSemi1.competidor_1_id);
    assert.equal(log.dados_novos.vencedor_id, novoVencedorId);
  });

  it('deve anular resultado voltando luta para PRONTA, estornando pontos e registrando RESULTADO_ANULADO', async () => {
    const res = await resultadoService.anularResultado(
      evento.id,
      chave.id,
      lutaSemi1.id,
      adminId
    );

    assert.equal(res.luta.status, 'PRONTA');
    assert.equal(res.luta.vencedor_id, null);

    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'RESULTADO_ANULADO' });
    const log = logs.find(l => Number(l.entidade_id) === Number(lutaSemi1.id));
    assert.ok(log, 'Deve existir log RESULTADO_ANULADO');
    assert.equal(log.dados_anteriores.vencedor_id, lutaSemi1.competidor_2_id);
    assert.equal(log.dados_novos, null);
  });
});
