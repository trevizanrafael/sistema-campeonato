const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularSituacao,
  atribuirPosicoes,
} = require('../../src/services/rankingService');

describe('Unit Tests: Ranking de Equipes e Desempates', () => {
  it('deve calcular a situação do evento corretamente', () => {
    assert.equal(calcularSituacao({ total_chaves: 0, finalizadas: 0 }), 'NAO_INICIADO');
    assert.equal(calcularSituacao({ total_chaves: 4, finalizadas: 0 }), 'PARCIAL');
    assert.equal(calcularSituacao({ total_chaves: 4, finalizadas: 2 }), 'PARCIAL');
    assert.equal(calcularSituacao({ total_chaves: 4, finalizadas: 4 }), 'FINAL');
  });

  it('deve ordenar e atribuir posições com empates pulando colocação subsequente', () => {
    const equipes = [
      { id: 1, equipe_nome: 'Alpha', total_pontos: 30, ouros: 2, pratas: 1, bronzes: 0, vitorias: 4, byes: 0 },
      { id: 2, equipe_nome: 'Beta', total_pontos: 20, ouros: 1, pratas: 2, bronzes: 1, vitorias: 3, byes: 0 },
      { id: 3, equipe_nome: 'Gamma', total_pontos: 20, ouros: 1, pratas: 2, bronzes: 1, vitorias: 3, byes: 0 },
      { id: 4, equipe_nome: 'Delta', total_pontos: 15, ouros: 1, pratas: 0, bronzes: 2, vitorias: 2, byes: 1 },
      { id: 5, equipe_nome: 'Epsilon', total_pontos: 0, ouros: 0, pratas: 0, bronzes: 0, vitorias: 0, byes: 0 },
    ];

    const ranking = atribuirPosicoes(equipes);

    assert.equal(ranking[0].equipe_nome, 'Alpha');
    assert.equal(ranking[0].posicao, 1);

    // Beta e Gamma empatadas
    assert.equal(ranking[1].posicao, 2);
    assert.equal(ranking[2].posicao, 2);

    // Delta pula a 3ª colocação e vai para 4º lugar!
    assert.equal(ranking[3].equipe_nome, 'Delta');
    assert.equal(ranking[3].posicao, 4);

    assert.equal(ranking[4].equipe_nome, 'Epsilon');
    assert.equal(ranking[4].posicao, 5);
  });
});
