/**
 * Validador e normalizador para regras de pontuação de eventos.
 */

function converterPontos(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return null;
  }

  const normalizado = String(valor).trim();
  if (!/^-?\d+$/.test(normalizado)) {
    return null;
  }

  const numero = Number(normalizado);
  return Number.isInteger(numero) ? numero : null;
}

function normalizarPontuacao(body = {}) {
  return {
    pontos_vitoria: converterPontos(body.pontos_vitoria),
    pontos_primeiro: converterPontos(body.pontos_primeiro),
    pontos_segundo: converterPontos(body.pontos_segundo),
    pontos_terceiro: converterPontos(body.pontos_terceiro),
    bye_pontua:
      body.bye_pontua === 'on' ||
      body.bye_pontua === 'true' ||
      body.bye_pontua === '1' ||
      body.bye_pontua === true,
  };
}

function validarId(id) {
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return null;
  }
  return numero;
}

function validarPontuacao(dados = {}) {
  const erros = {};

  const campos = [
    ['pontos_vitoria', 'Pontos por vitória'],
    ['pontos_primeiro', 'Pontos pelo primeiro lugar'],
    ['pontos_segundo', 'Pontos pelo segundo lugar'],
    ['pontos_terceiro', 'Pontos pelo terceiro lugar'],
  ];

  for (const [campo, rotulo] of campos) {
    const valor = dados[campo];

    if (valor === null || valor === undefined || Number.isNaN(valor) || !Number.isInteger(valor)) {
      erros[campo] = `${rotulo} deve ser um número inteiro.`;
    } else if (valor < 0) {
      erros[campo] = `${rotulo} não pode ser negativo.`;
    } else if (valor > 1000) {
      erros[campo] = `${rotulo} deve ser de no máximo 1.000.`;
    }
  }

  return erros;
}

module.exports = {
  converterPontos,
  normalizarPontuacao,
  validarId,
  validarPontuacao,
};
