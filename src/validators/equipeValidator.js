const { NotFoundError } = require('../utils/errors');

function normalizarNomeEquipe(valor) {
  if (typeof valor !== 'string') {
    return '';
  }

  return valor.trim().replace(/\s+/g, ' ');
}

function validarEquipe(dados) {
  const erros = {};
  const nome = dados.nome || '';

  if (!nome) {
    erros.nome = 'Informe o nome da equipe.';
  } else if (nome.length < 2) {
    erros.nome = 'O nome deve possuir pelo menos 2 caracteres.';
  } else if (nome.length > 200) {
    erros.nome = 'O nome deve possuir no máximo 200 caracteres.';
  }

  return erros;
}

function validarId(id) {
  const numero = Number(id);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw new NotFoundError('Equipe não encontrada.');
  }

  return numero;
}

module.exports = {
  normalizarNomeEquipe,
  validarEquipe,
  validarId,
};
