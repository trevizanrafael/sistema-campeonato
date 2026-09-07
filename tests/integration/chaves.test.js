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
const auditoriaRepository = require('../../src/repositories/auditoriaRepository');

describe('Integration: Ciclo de Chaves e Auditoria', () => {
  let evento;
  let equipe;
  let faixa;
  let categoria;
  let adminId;

  before(async () => {
    await limparDadosDeTeste('TEST_Chaves_%');
    adminId = await obterUsuarioAdmin();
    evento = await criarEvento({ nome: 'TEST_Chaves_Audit' });
    equipe = await criarEquipe({ nome: 'TEST_Equipe_Chaves' });
    faixa = await obterFaixa('Branca');
    categoria = await criarCategoria(evento.id, { nome: 'TEST_Cat_Chaves' });

    // 3 atletas para gerar chave com 1 BYE
    await criarInscricao(evento.id, categoria.id, equipe.id, faixa.id, { nome: 'Atleta Chave 1', seed: 1 });
    await criarInscricao(evento.id, categoria.id, equipe.id, faixa.id, { nome: 'Atleta Chave 2', seed: 2 });
    await criarInscricao(evento.id, categoria.id, equipe.id, faixa.id, { nome: 'Atleta Chave 3', seed: null });
  });

  after(async () => {
    await limparDadosDeTeste('TEST_Chaves_%');
  });

  it('deve gerar chave e registrar log CHAVE_GERADA', async () => {
    const res = await chaveService.gerarChave(evento.id, categoria.id, adminId);
    assert.ok(res.chave.id);

    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'CHAVE_GERADA' });
    const log = logs.find(l => Number(l.entidade_id) === Number(res.chave.id));
    assert.ok(log, 'Deve existir log CHAVE_GERADA');
    assert.equal(log.dados_novos.tamanho, 4);
    assert.equal(log.dados_novos.totalLutas, 3);
  });

  it('deve sortear chave novamente e registrar CHAVE_SORTEADA_NOVAMENTE', async () => {
    const { chave } = await chaveService.buscarChave(evento.id, (await chaveService.listarCategoriasEChaves(evento.id)).categorias[0].chave_id);
    const res = await chaveService.sortearNovamente(evento.id, chave.id, adminId);

    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'CHAVE_SORTEADA_NOVAMENTE' });
    const log = logs.find(l => Number(l.entidade_id) === Number(res.chave.id));
    assert.ok(log, 'Deve existir log CHAVE_SORTEADA_NOVAMENTE');
    assert.equal(log.dados_anteriores.chave_id, chave.id);
  });

  it('deve iniciar chave e registrar CHAVE_INICIADA', async () => {
    const { categorias } = await chaveService.listarCategoriasEChaves(evento.id);
    const chaveId = categorias[0].chave_id;

    await chaveService.iniciarChave(evento.id, chaveId, adminId);

    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'CHAVE_INICIADA' });
    const log = logs.find(l => Number(l.entidade_id) === Number(chaveId));
    assert.ok(log, 'Deve existir log CHAVE_INICIADA');
    assert.equal(log.dados_anteriores.status, 'NAO_INICIADA');
    assert.equal(log.dados_novos.status, 'EM_ANDAMENTO');
  });

  it('deve excluir chave não iniciada e registrar CHAVE_EXCLUIDA', async () => {
    const cat2 = await criarCategoria(evento.id, { nome: 'TEST_Cat_Excluir' });
    await criarInscricao(evento.id, cat2.id, equipe.id, faixa.id, { nome: 'Atleta Excluir 1' });
    await criarInscricao(evento.id, cat2.id, equipe.id, faixa.id, { nome: 'Atleta Excluir 2' });

    const { chave } = await chaveService.gerarChave(evento.id, cat2.id, adminId);
    await chaveService.excluirChave(evento.id, chave.id, adminId);

    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'CHAVE_EXCLUIDA' });
    const log = logs.find(l => Number(l.entidade_id) === Number(chave.id));
    assert.ok(log, 'Deve existir log CHAVE_EXCLUIDA');
    assert.equal(log.dados_anteriores.nome, chave.nome);
    assert.equal(log.dados_novos, null);
  });
});
