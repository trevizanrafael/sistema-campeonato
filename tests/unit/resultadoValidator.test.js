const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizarResultado,
  validarResultado,
} = require('../../src/validators/resultadoValidator');

describe('Unit Tests: Validador de Resultados', () => {
  const lutaMock = {
    id: 50,
    competidor_1_id: 10,
    competidor_2_id: 20,
    status: 'PRONTA',
  };

  it('deve aceitar lançamento simplificado apenas com vencedor_id', () => {
    const dados = normalizarResultado({
      vencedor_id: '10',
    });
    const erros = validarResultado(dados, lutaMock);
    assert.equal(Object.keys(erros).length, 0);
    assert.equal(dados.vencedor_id, 10);
  });

  it('deve rejeitar vencedor que não pertence à luta', () => {
    const dados = normalizarResultado({
      vencedor_id: '999',
    });
    const erros = validarResultado(dados, lutaMock);
    assert.ok(erros.vencedor_id);
  });

  it('deve rejeitar tipo de resultado BYE em lançamento manual', () => {
    const dados = normalizarResultado({
      vencedor_id: '10',
      tipo_resultado: 'BYE',
    });
    const erros = validarResultado(dados, lutaMock);
    assert.ok(erros.tipo_resultado);
  });

  it('deve validar vitória por PONTOS corretamente', () => {
    // Vencedor 10 com placar maior (4x2)
    const dadosValidos = normalizarResultado({
      vencedor_id: '10',
      tipo_resultado: 'PONTOS',
      placar_1: '4',
      placar_2: '2',
    });
    const errosValidos = validarResultado(dadosValidos, lutaMock);
    assert.equal(Object.keys(errosValidos).length, 0);

    // Empate em pontos deve ser rejeitado (no Jiu-Jitsu tem decisão de árbitro)
    const dadosEmpate = normalizarResultado({
      vencedor_id: '10',
      tipo_resultado: 'PONTOS',
      placar_1: '2',
      placar_2: '2',
    });
    const errosEmpate = validarResultado(dadosEmpate, lutaMock);
    assert.ok(errosEmpate.placar);

    // Vencedor com pontuação menor deve ser rejeitado
    const dadosIncoerente = normalizarResultado({
      vencedor_id: '10',
      tipo_resultado: 'PONTOS',
      placar_1: '2',
      placar_2: '4',
    });
    const errosIncoerente = validarResultado(dadosIncoerente, lutaMock);
    assert.ok(errosIncoerente.vencedor_id);
  });

  it('deve aceitar FINALIZACAO limpando placares', () => {
    const dados = normalizarResultado({
      vencedor_id: '20',
      tipo_resultado: 'FINALIZACAO',
      observacao: 'Armlock aos 2:30',
    });
    const erros = validarResultado(dados, lutaMock);
    assert.equal(Object.keys(erros).length, 0);
    assert.equal(dados.placar_1, null);
    assert.equal(dados.placar_2, null);
    assert.equal(dados.observacao, 'Armlock aos 2:30');
  });

  it('deve rejeitar observação que ultrapasse 1000 caracteres', () => {
    const dados = normalizarResultado({
      vencedor_id: '10',
      observacao: 'A'.repeat(1001),
    });
    const erros = validarResultado(dados, lutaMock);
    assert.ok(erros.observacao);
  });
});
