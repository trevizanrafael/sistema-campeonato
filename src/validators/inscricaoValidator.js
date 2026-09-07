/**
 * Validador e normalizador para dados de inscrições de competidores.
 */

function converterInteiro(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return Number.NaN;
  }

  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : Number.NaN;
}

function converterInteiroOpcional(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return null;
  }

  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : Number.NaN;
}

function converterDecimal(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return Number.NaN;
  }

  const normalizado = String(valor).trim().replace(',', '.');
  const numero = Number(normalizado);

  return Number.isFinite(numero) ? numero : Number.NaN;
}

function converterId(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return null;
  }

  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function converterIdOpcional(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return null;
  }

  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : Number.NaN;
}

function normalizarInscricao(body = {}) {
  return {
    nome:
      typeof body.nome === 'string'
        ? body.nome.trim().replace(/\s+/g, ' ')
        : '',

    idade: converterInteiro(body.idade),
    peso: converterDecimal(body.peso),

    sexo:
      typeof body.sexo === 'string'
        ? body.sexo.trim().toUpperCase()
        : '',

    faixa_id: converterId(body.faixa_id),
    equipe_id: converterId(body.equipe_id),

    categoria_id: converterIdOpcional(body.categoria_id),
    seed: converterInteiroOpcional(body.seed),
  };
}

function validarId(id) {
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return null;
  }
  return numero;
}

function validarInscricao(inscricao, { faixasMap = null, equipesMap = null } = {}) {
  const erros = {};

  // Nome
  if (
    !inscricao.nome ||
    inscricao.nome.length < 2 ||
    inscricao.nome.length > 200
  ) {
    erros.nome = 'O nome do competidor deve ter entre 2 e 200 caracteres.';
  }

  // Idade
  if (
    Number.isNaN(inscricao.idade) ||
    inscricao.idade < 0 ||
    inscricao.idade > 150
  ) {
    erros.idade = 'Informe uma idade válida entre 0 e 150 anos.';
  }

  // Peso
  if (
    Number.isNaN(inscricao.peso) ||
    inscricao.peso <= 0 ||
    inscricao.peso > 999.99
  ) {
    erros.peso = 'Informe um peso válido maior que zero (até 999.99 kg).';
  }

  // Sexo (o atleta só pode ser MASCULINO ou FEMININO)
  const sexosValidos = ['MASCULINO', 'FEMININO'];
  if (!sexosValidos.includes(inscricao.sexo)) {
    erros.sexo = 'Selecione um sexo válido (Masculino ou Feminino).';
  }

  // Faixa
  if (!inscricao.faixa_id) {
    erros.faixa_id = 'Selecione uma faixa válida.';
  } else if (faixasMap && !faixasMap.has(Number(inscricao.faixa_id))) {
    erros.faixa_id = 'Faixa selecionada não foi encontrada.';
  }

  // Equipe
  if (!inscricao.equipe_id) {
    erros.equipe_id = 'Selecione uma equipe válida.';
  } else if (equipesMap && !equipesMap.has(Number(inscricao.equipe_id))) {
    erros.equipe_id = 'Equipe selecionada não foi encontrada.';
  }

  // Seed (opcional)
  if (inscricao.seed !== null) {
    if (Number.isNaN(inscricao.seed) || inscricao.seed <= 0) {
      erros.seed = 'O seed deve ser um número inteiro positivo.';
    }
  }

  return erros;
}

module.exports = {
  converterInteiro,
  converterInteiroOpcional,
  converterDecimal,
  converterId,
  converterIdOpcional,
  normalizarInscricao,
  validarId,
  validarInscricao,
};
