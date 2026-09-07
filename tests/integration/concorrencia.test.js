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
const pontoEquipeRepository = require('../../src/repositories/pontoEquipeRepository');
const auditoriaRepository = require('../../src/repositories/auditoriaRepository');

describe('Integration: Proteção contra Concorrência e Duplo Clique', () => {
  let evento;
  let equipeA;
  let equipeB;
  let faixa;
  let categoria;
  let chave;
  let luta;
  let adminId;

  before(async () => {
    await limparDadosDeTeste('TEST_Concorrencia_%');
    adminId = await obterUsuarioAdmin();
    evento = await criarEvento({
      nome: 'TEST_Concorrencia',
      regras: { pontos_vitoria: 3 },
    });
    equipeA = await criarEquipe({ nome: 'TEST_Equipe_ConcA' });
    equipeB = await criarEquipe({ nome: 'TEST_Equipe_ConcB' });
    faixa = await obterFaixa('Branca');
    categoria = await criarCategoria(evento.id, { nome: 'TEST_Cat_Conc' });

    await criarInscricao(evento.id, categoria.id, equipeA.id, faixa.id, { nome: 'Conc_Atleta_1' });
    await criarInscricao(evento.id, categoria.id, equipeB.id, faixa.id, { nome: 'Conc_Atleta_2' });

    const gerada = await chaveService.gerarChave(evento.id, categoria.id, adminId);
    chave = gerada.chave;
    await chaveService.iniciarChave(evento.id, chave.id, adminId);

    const lutas = await lutaRepository.listarPorChave(chave.id);
    luta = lutas[0];
  });

  after(async () => {
    await limparDadosDeTeste('TEST_Concorrencia_%');
  });

  it('deve processar apenas uma requisição com sucesso e rejeitar a duplicada sob concorrência direta', async () => {
    // Dispara duas operações de lançamento simultaneamente na mesma luta
    const promises = [
      resultadoService.lancarResultado(
        evento.id,
        chave.id,
        luta.id,
        { vencedor_id: luta.competidor_1_id },
        adminId
      ),
      resultadoService.lancarResultado(
        evento.id,
        chave.id,
        luta.id,
        { vencedor_id: luta.competidor_1_id },
        adminId
      ),
    ];

    const resultados = await Promise.allSettled(promises);

    const sucessos = resultados.filter(r => r.status === 'fulfilled');
    const falhas = resultados.filter(r => r.status === 'rejected');

    assert.equal(sucessos.length, 1, 'Exatamente uma chamada simultânea deve vencer');
    assert.equal(falhas.length, 1, 'A chamada concorrente deve ser rejeitada');

    // Verificar se no banco houve apenas 1 registro de pontuação
    const pontos = await pontoEquipeRepository.buscarPorChave(chave.id);
    assert.equal(pontos.length, 1, 'Apenas um ponto de vitória deve ser gerado');

    // Verificar se houve apenas 1 log de auditoria para o lançamento
    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'RESULTADO_LANCADO' });
    const logsLuta = logs.filter(l => Number(l.entidade_id) === Number(luta.id));
    assert.equal(logsLuta.length, 1, 'Apenas um log RESULTADO_LANCADO deve ser registrado');
  });
});
