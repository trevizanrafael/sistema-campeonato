/**
 * Validador e normalizador para dados de categorias.
 */

function converterInteiroOpcional(valor) {
  if (
    valor === undefined ||
    valor === null ||
    String(valor).trim() === ''
  ) {
    return null;
  }

  const numero = Number(valor);

  return Number.isInteger(numero) ? numero : Number.NaN;
}

function converterDecimalOpcional(valor) {
  if (
    valor === undefined ||
    valor === null ||
    String(valor).trim() === ''
  ) {
    return null;
  }

  const normalizado = String(valor).trim().replace(',', '.');
  const numero = Number(normalizado);

  return Number.isFinite(numero) ? numero : Number.NaN;
}

function converterIdOpcional(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return null;
  }

  const numero = Number(valor);

  return Number.isInteger(numero) && numero > 0 ? numero : Number.NaN;
}

function normalizarCategoria(body = {}) {
  return {
    nome:
      typeof body.nome === 'string'
        ? body.nome.trim().replace(/\s+/g, ' ')
        : '',

    idade_minima: converterInteiroOpcional(body.idade_minima),
    idade_maxima: converterInteiroOpcional(body.idade_maxima),

    peso_minimo: converterDecimalOpcional(body.peso_minimo),
    peso_maximo: converterDecimalOpcional(body.peso_maximo),

    faixa_minima_id: converterIdOpcional(body.faixa_minima_id),
    faixa_maxima_id: converterIdOpcional(body.faixa_maxima_id),

    sexo:
      typeof body.sexo === 'string'
        ? body.sexo.trim().toUpperCase()
        : '',
  };
}

function validarId(id) {
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return null;
  }
  return numero;
}

function validarCategoria(categoria, faixasMap = null) {
  const erros = {};

  // Nome
  if (
    !categoria.nome ||
    categoria.nome.length < 2 ||
    categoria.nome.length > 200
  ) {
    erros.nome = 'O nome da categoria deve ter entre 2 e 200 caracteres.';
  }

  // Idade
  if (
    Number.isNaN(categoria.idade_minima) ||
    Number.isNaN(categoria.idade_maxima)
  ) {
    erros.idade = 'Informe idades válidas.';
  } else {
    if (categoria.idade_minima !== null && categoria.idade_minima < 0) {
      erros.idade_minima = 'A idade mínima não pode ser negativa.';
    }

    if (categoria.idade_maxima !== null && categoria.idade_maxima > 150) {
      erros.idade_maxima = 'A idade máxima deve ser de até 150 anos.';
    }

    if (
      categoria.idade_minima !== null &&
      categoria.idade_maxima !== null &&
      categoria.idade_minima > categoria.idade_maxima
    ) {
      erros.idade_maxima =
        'A idade máxima deve ser igual ou maior que a mínima.';
    }
  }

  // Peso
  if (
    Number.isNaN(categoria.peso_minimo) ||
    Number.isNaN(categoria.peso_maximo)
  ) {
    erros.peso = 'Informe pesos válidos.';
  } else {
    if (categoria.peso_minimo !== null && categoria.peso_minimo < 0) {
      erros.peso_minimo = 'O peso mínimo não pode ser negativo.';
    }

    if (categoria.peso_maximo !== null && categoria.peso_maximo < 0) {
      erros.peso_maximo = 'O peso máximo não pode ser negativo.';
    }

    if (categoria.peso_maximo !== null && categoria.peso_maximo > 999.99) {
      erros.peso_maximo = 'O peso máximo deve ser de até 999.99 kg.';
    }

    if (
      categoria.peso_minimo !== null &&
      categoria.peso_maximo !== null &&
      categoria.peso_minimo >= categoria.peso_maximo
    ) {
      erros.peso_maximo =
        'O peso máximo deve ser maior que o peso mínimo.';
    }
  }

  // Faixas
  if (Number.isNaN(categoria.faixa_minima_id)) {
    erros.faixa_minima_id = 'Faixa mínima inválida.';
  }

  if (Number.isNaN(categoria.faixa_maxima_id)) {
    erros.faixa_maxima_id = 'Faixa máxima inválida.';
  }

  if (faixasMap) {
    if (
      categoria.faixa_minima_id &&
      !faixasMap.has(Number(categoria.faixa_minima_id))
    ) {
      erros.faixa_minima_id = 'Faixa mínima selecionada não existe.';
    }

    if (
      categoria.faixa_maxima_id &&
      !faixasMap.has(Number(categoria.faixa_maxima_id))
    ) {
      erros.faixa_maxima_id = 'Faixa máxima selecionada não existe.';
    }

    if (categoria.faixa_minima_id && categoria.faixa_maxima_id) {
      const fMin = faixasMap.get(Number(categoria.faixa_minima_id));
      const fMax = faixasMap.get(Number(categoria.faixa_maxima_id));

      if (fMin && fMax && fMin.ordem > fMax.ordem) {
        erros.faixa_maxima_id =
          'A faixa máxima não pode ser anterior à faixa mínima.';
      }
    }
  }

  // Sexo
  const sexosPermitidos = ['MASCULINO', 'FEMININO', 'MISTO'];
  if (!sexosPermitidos.includes(categoria.sexo)) {
    erros.sexo = 'Selecione um sexo válido.';
  }

  return erros;
}

module.exports = {
  converterInteiroOpcional,
  converterDecimalOpcional,
  converterIdOpcional,
  normalizarCategoria,
  validarId,
  validarCategoria,
};
