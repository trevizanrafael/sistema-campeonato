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
const finalizacaoService = require('../../src/services/finalizacaoService');
const lutaRepository = require('../../src/repositories/lutaRepository');
const auditoriaRepository = require('../../src/repositories/auditoriaRepository');
const pontoEquipeRepository = require('../../src/repositories/pontoEquipeRepository');

describe('Integration: Finalização de Categoria, Pódio e Reabertura', () => {
  let evento;
  let equipeA;
  let equipeB;
  let faixa;
  let categoria;
  let chave;
  let at1, at2, at3, at4;
  let adminId;

  before(async () => {
    await limparDadosDeTeste('TEST_Fin_%');
    adminId = await obterUsuarioAdmin();
    evento = await criarEvento({
      nome: 'TEST_Finalizacao_Audit',
      regras: {
        pontos_vitoria: 2,
        pontos_primeiro: 9,
        pontos_segundo: 3,
        pontos_terceiro: 1,
      },
    });
    equipeA = await criarEquipe({ nome: 'TEST_Equipe_FinA' });
    equipeB = await criarEquipe({ nome: 'TEST_Equipe_FinB' });
    faixa = await obterFaixa('Branca');
    categoria = await criarCategoria(evento.id, { nome: 'TEST_Cat_Fin' });

    at1 = await criarInscricao(evento.id, categoria.id, equipeA.id, faixa.id, { nome: 'Atleta Fin 1' });
    at2 = await criarInscricao(evento.id, categoria.id, equipeB.id, faixa.id, { nome: 'Atleta Fin 2' });
    at3 = await criarInscricao(evento.id, categoria.id, equipeA.id, faixa.id, { nome: 'Atleta Fin 3' });
    at4 = await criarInscricao(evento.id, categoria.id, equipeB.id, faixa.id, { nome: 'Atleta Fin 4' });

    const gerada = await chaveService.gerarChave(evento.id, categoria.id, adminId);
    chave = gerada.chave;
    await chaveService.iniciarChave(evento.id, chave.id, adminId);

    // Finalizar Semifinais
    const lutas = await lutaRepository.listarPorChave(chave.id);
    const semi1 = lutas.find(l => l.rodada === 1 && l.posicao === 1);
    const semi2 = lutas.find(l => l.rodada === 1 && l.posicao === 2);

    await resultadoService.lancarResultado(evento.id, chave.id, semi1.id, { vencedor_id: semi1.competidor_1_id }, adminId);
    await resultadoService.lancarResultado(evento.id, chave.id, semi2.id, { vencedor_id: semi2.competidor_1_id }, adminId);

    // Finalizar Final
    const lutasAtualizadas = await lutaRepository.listarPorChave(chave.id);
    const finalLuta = lutasAtualizadas.find(l => l.rodada === 2);
    await resultadoService.lancarResultado(evento.id, chave.id, finalLuta.id, { vencedor_id: finalLuta.competidor_1_id }, adminId);
  });

  after(async () => {
    await limparDadosDeTeste('TEST_Fin_%');
  });

  it('deve calcular prévia sem efeitos colaterais', async () => {
    const preview = await finalizacaoService.calcularPreview(evento.id, chave.id);
    assert.ok(preview.podio);
    assert.ok(preview.podio.primeiro);
    assert.ok(preview.podio.segundo);
    assert.ok(preview.podio.terceiro);

    // Verificar se chave continua EM_ANDAMENTO e sem pontos de colocação no banco
    const { chave: chaveNoBanco } = await chaveService.buscarChave(evento.id, chave.id);
    assert.equal(chaveNoBanco.status, 'EM_ANDAMENTO');
    assert.equal(chaveNoBanco.primeiro_lugar_id, null);
  });

  it('deve finalizar categoria, salvar pódio, lançar pontos e registrar CATEGORIA_FINALIZADA', async () => {
    const res = await finalizacaoService.finalizarCategoria(evento.id, chave.id, adminId);
    assert.equal(res.chave.status, 'FINALIZADA');
    assert.ok(res.chave.primeiro_lugar_id);
    assert.ok(res.chave.segundo_lugar_id);

    const pontos = await pontoEquipeRepository.buscarPorChave(chave.id);
    const pontosColocacao = pontos.filter(p => ['PRIMEIRO_LUGAR', 'SEGUNDO_LUGAR', 'TERCEIRO_LUGAR'].includes(p.tipo));
    assert.equal(pontosColocacao.length, 3);

    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'CATEGORIA_FINALIZADA' });
    const log = logs.find(l => Number(l.entidade_id) === Number(chave.id));
    assert.ok(log, 'Deve existir log CATEGORIA_FINALIZADA');
    assert.equal(log.dados_novos.status, 'FINALIZADA');
  });

  it('deve reabrir categoria, remover pontos de colocação, manter vitórias e registrar CATEGORIA_REABERTA', async () => {
    const res = await finalizacaoService.reabrirCategoria(evento.id, chave.id, adminId);
    assert.equal(res.chave.status, 'EM_ANDAMENTO');
    assert.equal(res.chave.primeiro_lugar_id, null);

    const pontos = await pontoEquipeRepository.buscarPorChave(chave.id);
    const pontosColocacao = pontos.filter(p => ['PRIMEIRO_LUGAR', 'SEGUNDO_LUGAR', 'TERCEIRO_LUGAR'].includes(p.tipo));
    assert.equal(pontosColocacao.length, 0, 'Pontos de colocação devem ter sido removidos');

    const pontosVitoria = pontos.filter(p => p.tipo === 'VITORIA');
    assert.equal(pontosVitoria.length, 3, 'Pontos de vitória devem ser preservados');

    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'CATEGORIA_REABERTA' });
    const log = logs.find(l => Number(l.entidade_id) === Number(chave.id));
    assert.ok(log, 'Deve existir log CATEGORIA_REABERTA');
    assert.equal(log.dados_novos.status, 'EM_ANDAMENTO');
  });
});
