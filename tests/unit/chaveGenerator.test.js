const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularTamanhoChave,
  calcularTotalRodadas,
  calcularTotalLutas,
  gerarChave,
} = require('../../src/services/chaveGeneratorService');

describe('Unit Tests: Gerador de Chaves e Sorteios', () => {
  it('deve calcular a próxima potência de 2 corretamente', () => {
    assert.equal(calcularTamanhoChave(2), 2);
    assert.equal(calcularTamanhoChave(3), 4);
    assert.equal(calcularTamanhoChave(4), 4);
    assert.equal(calcularTamanhoChave(5), 8);
    assert.equal(calcularTamanhoChave(8), 8);
    assert.equal(calcularTamanhoChave(9), 16);
    assert.equal(calcularTamanhoChave(16), 16);
    assert.equal(calcularTamanhoChave(17), 32);
  });

  it('deve calcular o total de rodadas corretamente', () => {
    assert.equal(calcularTotalRodadas(2), 1);
    assert.equal(calcularTotalRodadas(4), 2);
    assert.equal(calcularTotalRodadas(8), 3);
    assert.equal(calcularTotalRodadas(16), 4);
  });

  it('deve calcular o total de lutas corretamente (tamanho - 1)', () => {
    assert.equal(calcularTotalLutas(2), 1);
    assert.equal(calcularTotalLutas(4), 3);
    assert.equal(calcularTotalLutas(8), 7);
    assert.equal(calcularTotalLutas(16), 15);
  });

  it('deve gerar chave de 3 atletas com tamanho 4 e exatamente 1 BYE', () => {
    const inscritos = [
      { id: 101, nome: 'Atleta A', equipe_id: 1, seed: 1 },
      { id: 102, nome: 'Atleta B', equipe_id: 2, seed: null },
      { id: 103, nome: 'Atleta C', equipe_id: 3, seed: null },
    ];

    const chave = gerarChave({ inscritos });
    assert.equal(chave.tamanho, 4);
    assert.equal(chave.totalLutas, 3);
    assert.equal(chave.totalRodadas, 2);

    const lutasR1 = chave.lutas.filter(l => l.rodada === 1);
    assert.equal(lutasR1.length, 2);

    // Deve haver exatamente 1 luta com BYE (um competidor null)
    const lutasComBye = lutasR1.filter(l => l.competidor_1_id === null || l.competidor_2_id === null);
    assert.equal(lutasComBye.length, 1);

    // O Seed 1 deve ser o beneficiário do BYE (confronto com null)
    const lutaSeed1 = lutasR1.find(l => l.competidor_1_id === 101 || l.competidor_2_id === 101);
    assert.ok(lutaSeed1);
    assert.ok(lutaSeed1.competidor_1_id === null || lutaSeed1.competidor_2_id === null);
  });

  it('deve gerar chave de 5 atletas com tamanho 8 e 3 BYEs sem nenhum confronto BYE x BYE', () => {
    const inscritos = [
      { id: 1, nome: 'Atleta 1', equipe_id: 1, seed: 1 },
      { id: 2, nome: 'Atleta 2', equipe_id: 2, seed: 2 },
      { id: 3, nome: 'Atleta 3', equipe_id: 3, seed: null },
      { id: 4, nome: 'Atleta 4', equipe_id: 4, seed: null },
      { id: 5, nome: 'Atleta 5', equipe_id: 5, seed: null },
    ];

    const chave = gerarChave({ inscritos });
    assert.equal(chave.tamanho, 8);
    assert.equal(chave.totalLutas, 7);

    const lutasR1 = chave.lutas.filter(l => l.rodada === 1);
    assert.equal(lutasR1.length, 4);

    // Nenhuma luta pode ter ambos competidores null (BYE x BYE é estritamente proibido)
    for (const luta of lutasR1) {
      const ambosNulos = luta.competidor_1_id === null && luta.competidor_2_id === null;
      assert.equal(ambosNulos, false, `Luta ${luta.posicao} na R1 não pode ter dois BYEs`);
    }
  });

  it('deve evitar confrontos de mesma equipe na 1ª rodada sempre que possível', () => {
    const inscritos = [
      { id: 1, nome: 'Alpha 1', equipe_id: 10, seed: null },
      { id: 2, nome: 'Alpha 2', equipe_id: 10, seed: null },
      { id: 3, nome: 'Beta 1', equipe_id: 20, seed: null },
      { id: 4, nome: 'Beta 2', equipe_id: 20, seed: null },
    ];

    const chave = gerarChave({ inscritos });
    assert.equal(chave.conflitosEquipe, 0, 'Não deve haver conflito de equipe na primeira rodada para 2x2');

    const lutasR1 = chave.lutas.filter(l => l.rodada === 1);
    for (const luta of lutasR1) {
      if (luta.competidor_1_id && luta.competidor_2_id) {
        const at1 = inscritos.find(i => i.id === luta.competidor_1_id);
        const at2 = inscritos.find(i => i.id === luta.competidor_2_id);
        assert.notEqual(at1.equipe_id, at2.equipe_id, 'Atletas da mesma equipe não devem lutar entre si na R1');
      }
    }
  });
});
