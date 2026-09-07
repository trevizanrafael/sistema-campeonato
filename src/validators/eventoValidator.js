const { NotFoundError } = require('../utils/errors');

function normalizarEvento(body = {}) {
  return {
    nome: typeof body.nome === 'string' ? body.nome.trim() : '',
    descricao:
      typeof body.descricao === 'string' && body.descricao.trim()
        ? body.descricao.trim()
        : null,
  };
}

function validarEvento(dados) {
  const erros = {};

  if (!dados.nome) {
    erros.nome = 'Informe o nome do evento.';
  } else if (dados.nome.length < 2) {
    erros.nome = 'O nome deve possuir pelo menos 2 caracteres.';
  } else if (dados.nome.length > 200) {
    erros.nome = 'O nome deve possuir no máximo 200 caracteres.';
  }

  if (dados.descricao && dados.descricao.length > 5000) {
    erros.descricao = 'A descrição deve possuir no máximo 5.000 caracteres.';
  }

  return erros;
}

function validarId(id) {
  const numero = Number(id);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw new NotFoundError('Evento não encontrado.');
  }

  return numero;
}

module.exports = {
  normalizarEvento,
  validarEvento,
  validarId,
};
