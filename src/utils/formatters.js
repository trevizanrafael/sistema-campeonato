/**
 * Funções auxiliares de formatação de critérios de categorias para exibição na UI.
 */

function formatarNumero(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return '';
  }
  const num = Number(valor);
  if (Number.isNaN(num)) {
    return String(valor);
  }
  // Se for inteiro, formata sem casas decimais; se tiver casas, formata com vírgula
  return Number.isInteger(num) ? String(num) : num.toString().replace('.', ',');
}

function formatarIntervaloIdade(categoria = {}) {
  const min = categoria.idade_minima;
  const max = categoria.idade_maxima;

  const temMin = min !== null && min !== undefined;
  const temMax = max !== null && max !== undefined;

  if (temMin && temMax) {
    if (min === max) {
      return `${min} anos`;
    }
    return `${min} a ${max} anos`;
  }
  if (temMin && !temMax) {
    return `A partir de ${min} anos`;
  }
  if (!temMin && temMax) {
    return `Até ${max} anos`;
  }
  return 'Qualquer idade';
}

function formatarIntervaloPeso(categoria = {}) {
  const min = categoria.peso_minimo;
  const max = categoria.peso_maximo;

  const temMin = min !== null && min !== undefined && min !== '';
  const temMax = max !== null && max !== undefined && max !== '';

  if (temMin && temMax) {
    return `Acima de ${formatarNumero(min)} até ${formatarNumero(max)} kg`;
  }
  if (temMin && !temMax) {
    return `Acima de ${formatarNumero(min)} kg`;
  }
  if (!temMin && temMax) {
    return `Até ${formatarNumero(max)} kg`;
  }
  return 'Qualquer peso';
}

function formatarIntervaloFaixa(categoria = {}) {
  const nomeMin = categoria.faixa_minima_nome;
  const nomeMax = categoria.faixa_maxima_nome;

  const temMin = Boolean(nomeMin);
  const temMax = Boolean(nomeMax);

  if (temMin && temMax) {
    if (nomeMin === nomeMax) {
      return nomeMin;
    }
    return `${nomeMin} até ${nomeMax}`;
  }
  if (temMin && !temMax) {
    return `A partir da ${nomeMin}`;
  }
  if (!temMin && temMax) {
    return `Até ${nomeMax}`;
  }
  return 'Qualquer faixa';
}

function formatarSexo(sexo) {
  if (!sexo) {
    return 'Misto';
  }
  const s = String(sexo).toUpperCase();
  if (s === 'MASCULINO') return 'Masculino';
  if (s === 'FEMININO') return 'Feminino';
  if (s === 'MISTO') return 'Misto';
  return sexo;
}

module.exports = {
  formatarNumero,
  formatarIntervaloIdade,
  formatarIntervaloPeso,
  formatarIntervaloFaixa,
  formatarSexo,
};
