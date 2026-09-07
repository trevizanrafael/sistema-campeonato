const { NotFoundError } = require('../utils/errors');

function normalizarNomeFaixa(valor) {
  if (typeof valor !== 'string') {
    return '';
  }

  return valor.trim().replace(/\s+/g, ' ');
}

function validarFaixa(dados) {
  const erros = {};
  const nome = dados.nome || '';

  if (!nome) {
    erros.nome = 'Informe o nome da faixa.';
  } else if (nome.length < 2) {
    erros.nome = 'O nome deve possuir pelo menos 2 caracteres.';
  } else if (nome.length > 100) {
    erros.nome = 'O nome deve possuir no máximo 100 caracteres.';
  }

  return erros;
}

function validarId(id) {
  const numero = Number(id);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw new NotFoundError('Faixa não encontrada.');
  }

  return numero;
}

module.exports = {
  normalizarNomeFaixa,
  validarFaixa,
  validarId,
};
