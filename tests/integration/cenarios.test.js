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
const pontoEquipeRepository = require('../../src/repositories/pontoEquipeRepository');
const rankingService = require('../../src/services/rankingService');

describe('Integration: Cenários Completos de Campeonato (A até F)', () => {
  let evento;
  let equipeA;
  let equipeB;
  let equipeC;
  let faixa;
  let adminId;

  before(async () => {
    await limparDadosDeTeste('TEST_Cenarios_%');
    adminId = await obterUsuarioAdmin();
    evento = await criarEvento({
      nome: 'TEST_Cenarios_Championship',
      regras: {
        pontos_vitoria: 3,
        pontos_primeiro: 9,
        pontos_segundo: 3,
        pontos_terceiro: 1,
        bye_pontua: true,
      },
    });
    equipeA = await criarEquipe({ nome: 'TEST_Team_Alpha' });
    equipeB = await criarEquipe({ nome: 'TEST_Team_Beta' });
    equipeC = await criarEquipe({ nome: 'TEST_Team_Gamma' });
    faixa = await obterFaixa('Branca');
  });

  after(async () => {
    await limparDadosDeTeste('TEST_Cenarios_%');
  });

  it('Cenário A: Chave de 2 atletas (Final direta, sem 3º colocado)', async () => {
    const catA = await criarCategoria(evento.id, { nome: 'TEST_Cenario_A' });
    const at1 = await criarInscricao(evento.id, catA.id, equipeA.id, faixa.id, { nome: 'A_Atleta_1' });
    const at2 = await criarInscricao(evento.id, catA.id, equipeB.id, faixa.id, { nome: 'A_Atleta_2' });

    const { chave } = await chaveService.gerarChave(evento.id, catA.id, adminId);
    assert.equal(chave.tamanho, 2);

    await chaveService.iniciarChave(evento.id, chave.id, adminId);
    const lutas = await lutaRepository.listarPorChave(chave.id);
    assert.equal(lutas.length, 1);
    const finalLuta = lutas[0];
    assert.equal(finalLuta.status, 'PRONTA');

    // Lançar resultado: Atleta 1 vence Atleta 2
    await resultadoService.lancarResultado(evento.id, chave.id, finalLuta.id, {
      vencedor_id: at1.id,
    }, adminId);

    const { podio } = await finalizacaoService.finalizarCategoria(evento.id, chave.id, adminId);
    assert.equal(podio.primeiro.inscricao_id, at1.id);
    assert.equal(podio.segundo.inscricao_id, at2.id);
    assert.equal(podio.terceiro, null, 'Chave de 2 atletas não possui 3º lugar');
  });

  it('Cenário B: Chave de 3 atletas (Tamanho 4 com 1 BYE e fallback de 3º lugar)', async () => {
    const catB = await criarCategoria(evento.id, { nome: 'TEST_Cenario_B' });
    const at1 = await criarInscricao(evento.id, catB.id, equipeA.id, faixa.id, { nome: 'B_Atleta_1', seed: 1 });
    const at2 = await criarInscricao(evento.id, catB.id, equipeB.id, faixa.id, { nome: 'B_Atleta_2', seed: 2 });
    const at3 = await criarInscricao(evento.id, catB.id, equipeC.id, faixa.id, { nome: 'B_Atleta_3' });

    const { chave } = await chaveService.gerarChave(evento.id, catB.id, adminId);
    assert.equal(chave.tamanho, 4);

    await chaveService.iniciarChave(evento.id, chave.id, adminId);
    let lutas = await lutaRepository.listarPorChave(chave.id);

    // Luta de BYE já avança
    const lutaBye = lutas.find(l => l.rodada === 1 && (l.competidor_1_id === null || l.competidor_2_id === null));
    assert.equal(lutaBye.status, 'FINALIZADA');

    // Luta disputada na Semifinal
    const semiDisputada = lutas.find(l => l.rodada === 1 && l.competidor_1_id && l.competidor_2_id);
    assert.equal(semiDisputada.status, 'PRONTA');
    const vencedorSemi = semiDisputada.competidor_1_id;
    const perdedorSemi = semiDisputada.competidor_2_id;

    await resultadoService.lancarResultado(evento.id, chave.id, semiDisputada.id, {
      vencedor_id: vencedorSemi,
    }, adminId);

    // Final pronta
    lutas = await lutaRepository.listarPorChave(chave.id);
    const finalLuta = lutas.find(l => l.rodada === 2);
    assert.equal(finalLuta.status, 'PRONTA');

    // Lançar campeão (que avançou por bye na semifinal)
    const campeaoId = lutaBye.vencedor_id;
    await resultadoService.lancarResultado(evento.id, chave.id, finalLuta.id, {
      vencedor_id: campeaoId,
    }, adminId);

    const { podio } = await finalizacaoService.finalizarCategoria(evento.id, chave.id, adminId);
    assert.equal(podio.primeiro.inscricao_id, campeaoId);
    assert.equal(podio.segundo.inscricao_id, vencedorSemi);
    assert.equal(podio.terceiro.inscricao_id, perdedorSemi, '3º lugar deve ser atribuído ao perdedor da semifinal disputada');
  });

  it('Cenário C: Chave de 4 atletas (2 Semifinais, Final e Pódio Completo)', async () => {
    const catC = await criarCategoria(evento.id, { nome: 'TEST_Cenario_C' });
    const at1 = await criarInscricao(evento.id, catC.id, equipeA.id, faixa.id, { nome: 'C_Atleta_1' });
    const at2 = await criarInscricao(evento.id, catC.id, equipeB.id, faixa.id, { nome: 'C_Atleta_2' });
    const at3 = await criarInscricao(evento.id, catC.id, equipeC.id, faixa.id, { nome: 'C_Atleta_3' });
    const at4 = await criarInscricao(evento.id, catC.id, equipeA.id, faixa.id, { nome: 'C_Atleta_4' });

    const { chave } = await chaveService.gerarChave(evento.id, catC.id, adminId);
    await chaveService.iniciarChave(evento.id, chave.id, adminId);

    let lutas = await lutaRepository.listarPorChave(chave.id);
    const semi1 = lutas.find(l => l.rodada === 1 && l.posicao === 1);
    const semi2 = lutas.find(l => l.rodada === 1 && l.posicao === 2);

    await resultadoService.lancarResultado(evento.id, chave.id, semi1.id, { vencedor_id: semi1.competidor_1_id }, adminId);
    await resultadoService.lancarResultado(evento.id, chave.id, semi2.id, { vencedor_id: semi2.competidor_1_id }, adminId);

    lutas = await lutaRepository.listarPorChave(chave.id);
    const finalLuta = lutas.find(l => l.rodada === 2);

    // O vencedor da semi 1 vence a final
    await resultadoService.lancarResultado(evento.id, chave.id, finalLuta.id, { vencedor_id: semi1.competidor_1_id }, adminId);

    const { podio } = await finalizacaoService.finalizarCategoria(evento.id, chave.id, adminId);
    assert.equal(podio.primeiro.inscricao_id, semi1.competidor_1_id);
    assert.equal(podio.segundo.inscricao_id, semi2.competidor_1_id);
    assert.equal(podio.terceiro.inscricao_id, semi1.competidor_2_id, '3º lugar é o perdedor da semifinal do campeão');
  });

  it('Cenário D: Chave de 5 atletas (Tamanho 8 com 3 BYEs)', async () => {
    const catD = await criarCategoria(evento.id, { nome: 'TEST_Cenario_D' });
    const atletas = [];
    for (let i = 1; i <= 5; i++) {
      atletas.push(await criarInscricao(evento.id, catD.id, i % 2 === 0 ? equipeA.id : equipeB.id, faixa.id, { nome: `D_Atleta_${i}` }));
    }

    const res = await chaveService.gerarChave(evento.id, catD.id, adminId);
    assert.equal(res.chave.tamanho, 8);
    assert.equal(res.totalLutas, 7);

    await chaveService.iniciarChave(evento.id, res.chave.id, adminId);
    const lutas = await lutaRepository.listarPorChave(res.chave.id);
    const byes = lutas.filter(l => l.rodada === 1 && l.status === 'FINALIZADA');
    assert.equal(byes.length, 3, 'Deve haver 3 lutas finalizadas por BYE na primeira rodada');
  });

  it('Cenário E: Correção de resultado na Semifinal reflete na Final e no Pódio', async () => {
    const catE = await criarCategoria(evento.id, { nome: 'TEST_Cenario_E' });
    const at1 = await criarInscricao(evento.id, catE.id, equipeA.id, faixa.id, { nome: 'E_Atleta_1' });
    const at2 = await criarInscricao(evento.id, catE.id, equipeB.id, faixa.id, { nome: 'E_Atleta_2' });
    const at3 = await criarInscricao(evento.id, catE.id, equipeC.id, faixa.id, { nome: 'E_Atleta_3' });

    const { chave } = await chaveService.gerarChave(evento.id, catE.id, adminId);
    await chaveService.iniciarChave(evento.id, chave.id, adminId);

    let lutas = await lutaRepository.listarPorChave(chave.id);
    const semiDisputada = lutas.find(l => l.rodada === 1 && l.competidor_1_id && l.competidor_2_id);

    // Lança competidor 1 como vencedor da semifinal
    await resultadoService.lancarResultado(evento.id, chave.id, semiDisputada.id, {
      vencedor_id: semiDisputada.competidor_1_id,
    }, adminId);

    // Corrige para competidor 2 como vencedor da semifinal
    await resultadoService.corrigirResultado(evento.id, chave.id, semiDisputada.id, {
      vencedor_id: semiDisputada.competidor_2_id,
    }, adminId);

    lutas = await lutaRepository.listarPorChave(chave.id);
    const finalLuta = lutas.find(l => l.rodada === 2);
    assert.ok(
      finalLuta.competidor_1_id === semiDisputada.competidor_2_id ||
      finalLuta.competidor_2_id === semiDisputada.competidor_2_id,
      'Novo vencedor da semifinal deve ter avançado para a final'
    );
  });

  it('Cenário F: Anulação de resultado estorna pontos e regride status da próxima luta', async () => {
    const catF = await criarCategoria(evento.id, { nome: 'TEST_Cenario_F' });
    const at1 = await criarInscricao(evento.id, catF.id, equipeA.id, faixa.id, { nome: 'F_Atleta_1' });
    const at2 = await criarInscricao(evento.id, catF.id, equipeB.id, faixa.id, { nome: 'F_Atleta_2' });
    const at3 = await criarInscricao(evento.id, catF.id, equipeA.id, faixa.id, { nome: 'F_Atleta_3' });
    const at4 = await criarInscricao(evento.id, catF.id, equipeB.id, faixa.id, { nome: 'F_Atleta_4' });

    const { chave } = await chaveService.gerarChave(evento.id, catF.id, adminId);
    await chaveService.iniciarChave(evento.id, chave.id, adminId);

    let lutas = await lutaRepository.listarPorChave(chave.id);
    const semi1 = lutas.find(l => l.rodada === 1 && l.posicao === 1);
    const semi2 = lutas.find(l => l.rodada === 1 && l.posicao === 2);

    await resultadoService.lancarResultado(evento.id, chave.id, semi1.id, { vencedor_id: semi1.competidor_1_id }, adminId);
    await resultadoService.lancarResultado(evento.id, chave.id, semi2.id, { vencedor_id: semi2.competidor_1_id }, adminId);

    lutas = await lutaRepository.listarPorChave(chave.id);
    let finalLuta = lutas.find(l => l.rodada === 2);
    assert.equal(finalLuta.status, 'PRONTA', 'Com ambas semis encerradas, final deve estar PRONTA');

    // Anula a semifinal 2
    await resultadoService.anularResultado(evento.id, chave.id, semi2.id, adminId);

    lutas = await lutaRepository.listarPorChave(chave.id);
    const semi2Atualizada = lutas.find(l => l.id === semi2.id);
    finalLuta = lutas.find(l => l.rodada === 2);

    assert.equal(semi2Atualizada.status, 'PRONTA');
    assert.equal(semi2Atualizada.vencedor_id, null);
    assert.equal(finalLuta.status, 'AGUARDANDO', 'Final deve regredir para AGUARDANDO após anulação de uma semi');
  });
});
