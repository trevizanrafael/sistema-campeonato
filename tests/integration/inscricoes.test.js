const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../src/config/database');
const { limparDadosDeTeste } = require('../helpers/database');
const {
  obterUsuarioAdmin,
  criarEvento,
  criarEquipe,
  obterFaixa,
  criarCategoria,
} = require('../helpers/factories');
const inscricaoService = require('../../src/services/inscricaoService');
const auditoriaRepository = require('../../src/repositories/auditoriaRepository');

describe('Integration: Ciclo de Inscrições e Auditoria', () => {
  let evento;
  let equipe;
  let faixa;
  let categoria;
  let adminId;

  before(async () => {
    await limparDadosDeTeste('TEST_Inscricoes_%');
    adminId = await obterUsuarioAdmin();
    evento = await criarEvento({ nome: 'TEST_Inscricoes_Audit' });
    equipe = await criarEquipe({ nome: 'TEST_Equipe_Audit' });
    faixa = await obterFaixa('Branca');
    categoria = await criarCategoria(evento.id, {
      nome: 'TEST_Cat_Audit',
      peso_minimo: 60.0,
      peso_maximo: 80.0,
      idade_minima: 18,
      idade_maxima: 35,
      faixa_min_id: faixa.id,
      faixa_max_id: faixa.id,
    });
  });

  after(async () => {
    await limparDadosDeTeste('TEST_Inscricoes_%');
  });

  it('deve cadastrar inscrição e registrar log INSCRICAO_CRIADA com dados novos', async () => {
    const res = await inscricaoService.processarCadastro(evento.id, {
      nome: 'Atleta Audit 1',
      sexo: 'MASCULINO',
      idade: '25',
      peso: '70,5',
      faixa_id: String(faixa.id),
      equipe_id: String(equipe.id),
    }, adminId);

    assert.equal(res.tipo, 'CRIADA');
    const inscricao = res.inscricao;
    assert.ok(inscricao.id);

    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'INSCRICAO_CRIADA' });
    const log = logs.find(l => Number(l.entidade_id) === Number(inscricao.id));
    assert.ok(log, 'Deve existir log INSCRICAO_CRIADA');
    assert.equal(log.acao, 'INSCRICAO_CRIADA');
    assert.equal(log.dados_novos.nome, 'Atleta Audit 1');
    assert.equal(log.dados_anteriores, null);
  });

  it('deve editar inscrição e registrar log INSCRICAO_EDITADA com diff anterior e novo', async () => {
    const cad = await inscricaoService.processarCadastro(evento.id, {
      nome: 'Atleta Antes',
      sexo: 'MASCULINO',
      idade: '26',
      peso: '72,0',
      faixa_id: String(faixa.id),
      equipe_id: String(equipe.id),
    }, adminId);

    const edit = await inscricaoService.processarEdicao(evento.id, cad.inscricao.id, {
      nome: 'Atleta Depois',
      sexo: 'MASCULINO',
      idade: '27',
      peso: '74,0',
      faixa_id: String(faixa.id),
      equipe_id: String(equipe.id),
    }, adminId);

    assert.equal(edit.tipo, 'CRIADA');
    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'INSCRICAO_EDITADA' });
    const log = logs.find(l => Number(l.entidade_id) === Number(cad.inscricao.id));
    assert.ok(log, 'Deve existir log INSCRICAO_EDITADA');
    assert.equal(log.dados_anteriores.nome, 'Atleta Antes');
    assert.equal(log.dados_novos.nome, 'Atleta Depois');
    assert.equal(log.dados_anteriores.idade, 26);
    assert.equal(log.dados_novos.idade, 27);
  });

  it('deve cancelar e reativar inscrição registrando logs de auditoria', async () => {
    const cad = await inscricaoService.processarCadastro(evento.id, {
      nome: 'Atleta Cancelar',
      sexo: 'MASCULINO',
      idade: '22',
      peso: '71,0',
      faixa_id: String(faixa.id),
      equipe_id: String(equipe.id),
    }, adminId);

    await inscricaoService.cancelarInscricao(evento.id, cad.inscricao.id, adminId);
    let logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'INSCRICAO_CANCELADA' });
    let log = logs.find(l => Number(l.entidade_id) === Number(cad.inscricao.id));
    assert.ok(log, 'Deve existir log INSCRICAO_CANCELADA');
    assert.equal(log.dados_novos.status, 'CANCELADA');

    await inscricaoService.reativarInscricao(evento.id, cad.inscricao.id, adminId);
    logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'INSCRICAO_REATIVADA' });
    log = logs.find(l => Number(l.entidade_id) === Number(cad.inscricao.id));
    assert.ok(log, 'Deve existir log INSCRICAO_REATIVADA');
    assert.equal(log.dados_novos.status, 'CONFIRMADA');
  });

  it('deve excluir inscrição e registrar log INSCRICAO_EXCLUIDA', async () => {
    const cad = await inscricaoService.processarCadastro(evento.id, {
      nome: 'Atleta Excluir',
      sexo: 'MASCULINO',
      idade: '28',
      peso: '75,0',
      faixa_id: String(faixa.id),
      equipe_id: String(equipe.id),
    }, adminId);

    await inscricaoService.excluirInscricao(evento.id, cad.inscricao.id, adminId);

    const logs = await auditoriaRepository.listarPorEvento(evento.id, { acao: 'INSCRICAO_EXCLUIDA' });
    const log = logs.find(l => Number(l.entidade_id) === Number(cad.inscricao.id));
    assert.ok(log, 'Deve existir log INSCRICAO_EXCLUIDA');
    assert.equal(log.dados_anteriores.nome, 'Atleta Excluir');
    assert.equal(log.dados_novos, null);
  });
});
