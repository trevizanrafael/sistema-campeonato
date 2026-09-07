/**
 * Serviço responsável pelo motor de regras de classificação e compatibilidade de categorias.
 * Reutilizado tanto na gestão de categorias (Fase 8) quanto nas inscrições e sorteio de chaves (Fase 9).
 */

/**
 * Verifica se uma inscrição de competidor é compatível com os critérios de uma categoria.
 *
 * @param {Object} inscricao - Dados do atleta/inscrição
 * @param {number} inscricao.idade - Idade do competidor
 * @param {number|string} inscricao.peso - Peso em kg do competidor
 * @param {number} inscricao.faixa_ordem - Ordem hierárquica da faixa do competidor
 * @param {string} inscricao.sexo - 'MASCULINO' ou 'FEMININO'
 *
 * @param {Object} categoria - Critérios da categoria
 * @param {number|null} [categoria.idade_minima] - Limite inferior inclusivo de idade
 * @param {number|null} [categoria.idade_maxima] - Limite superior inclusivo de idade
 * @param {number|string|null} [categoria.peso_minimo] - Limite inferior exclusivo de peso
 * @param {number|string|null} [categoria.peso_maximo] - Limite superior inclusivo de peso
 * @param {number|null} [categoria.faixa_minima_ordem] - Ordem mínima inclusiva de faixa
 * @param {number|null} [categoria.faixa_maxima_ordem] - Ordem máxima inclusiva de faixa
 * @param {string} categoria.sexo - 'MASCULINO', 'FEMININO' ou 'MISTO'
 *
 * @returns {boolean}
 */
function inscricaoCompativelComCategoria(inscricao, categoria) {
  if (!inscricao || !categoria) {
    return false;
  }

  // Idade: limites inclusivos
  const idadeValida =
    (categoria.idade_minima === null ||
      categoria.idade_minima === undefined ||
      inscricao.idade >= categoria.idade_minima) &&
    (categoria.idade_maxima === null ||
      categoria.idade_maxima === undefined ||
      inscricao.idade <= categoria.idade_maxima);

  // Peso: mínimo exclusivo (> min) e máximo inclusivo (<= max)
  const pesoAtleta = Number(inscricao.peso);
  const pesoMin =
    categoria.peso_minimo !== null &&
    categoria.peso_minimo !== undefined &&
    categoria.peso_minimo !== ''
      ? Number(categoria.peso_minimo)
      : null;
  const pesoMax =
    categoria.peso_maximo !== null &&
    categoria.peso_maximo !== undefined &&
    categoria.peso_maximo !== ''
      ? Number(categoria.peso_maximo)
      : null;

  const pesoValido =
    (pesoMin === null || pesoAtleta > pesoMin) &&
    (pesoMax === null || pesoAtleta <= pesoMax);

  // Faixa: ordem hierárquica inclusiva
  const faixaMin =
    categoria.faixa_minima_ordem !== null &&
    categoria.faixa_minima_ordem !== undefined
      ? Number(categoria.faixa_minima_ordem)
      : null;
  const faixaMax =
    categoria.faixa_maxima_ordem !== null &&
    categoria.faixa_maxima_ordem !== undefined
      ? Number(categoria.faixa_maxima_ordem)
      : null;

  const faixaValida =
    (faixaMin === null || inscricao.faixa_ordem >= faixaMin) &&
    (faixaMax === null || inscricao.faixa_ordem <= faixaMax);

  // Sexo: MISTO aceita ambos, caso contrário deve ser igual
  const sexoValido =
    categoria.sexo === 'MISTO' ||
    categoria.sexo === inscricao.sexo;

  return idadeValida && pesoValido && faixaValida && sexoValido;
}

/**
 * Determina se duas categorias possuem sobreposição simultânea em todas as 4 dimensões
 * (Idade, Peso, Faixa e Sexo).
 *
 * @param {Object} a - Critérios da categoria A
 * @param {Object} b - Critérios da categoria B
 * @returns {boolean}
 */
function categoriasSeSobrepoem(a, b) {
  if (!a || !b) {
    return false;
  }

  // Idades: ambos intervalos inclusivos [min, max]
  const idadeMinA = a.idade_minima !== null && a.idade_minima !== undefined ? Number(a.idade_minima) : -Infinity;
  const idadeMaxA = a.idade_maxima !== null && a.idade_maxima !== undefined ? Number(a.idade_maxima) : Infinity;
  const idadeMinB = b.idade_minima !== null && b.idade_minima !== undefined ? Number(b.idade_minima) : -Infinity;
  const idadeMaxB = b.idade_maxima !== null && b.idade_maxima !== undefined ? Number(b.idade_maxima) : Infinity;

  const idadeSobrepoe = idadeMinA <= idadeMaxB && idadeMinB <= idadeMaxA;

  // Pesos: mínimo exclusivo e máximo inclusivo (min, max]
  // Dois intervalos (minA, maxA] e (minB, maxB] se sobrepõem sse minA < maxB && minB < maxA
  const pesoMinA =
    a.peso_minimo !== null && a.peso_minimo !== undefined && a.peso_minimo !== ''
      ? Number(a.peso_minimo)
      : -Infinity;
  const pesoMaxA =
    a.peso_maximo !== null && a.peso_maximo !== undefined && a.peso_maximo !== ''
      ? Number(a.peso_maximo)
      : Infinity;
  const pesoMinB =
    b.peso_minimo !== null && b.peso_minimo !== undefined && b.peso_minimo !== ''
      ? Number(b.peso_minimo)
      : -Infinity;
  const pesoMaxB =
    b.peso_maximo !== null && b.peso_maximo !== undefined && b.peso_maximo !== ''
      ? Number(b.peso_maximo)
      : Infinity;

  const pesoSobrepoe = pesoMinA < pesoMaxB && pesoMinB < pesoMaxA;

  // Faixas: ordem hierárquica inclusiva [min, max]
  const faixaMinA =
    a.faixa_minima_ordem !== null && a.faixa_minima_ordem !== undefined
      ? Number(a.faixa_minima_ordem)
      : -Infinity;
  const faixaMaxA =
    a.faixa_maxima_ordem !== null && a.faixa_maxima_ordem !== undefined
      ? Number(a.faixa_maxima_ordem)
      : Infinity;
  const faixaMinB =
    b.faixa_minima_ordem !== null && b.faixa_minima_ordem !== undefined
      ? Number(b.faixa_minima_ordem)
      : -Infinity;
  const faixaMaxB =
    b.faixa_maxima_ordem !== null && b.faixa_maxima_ordem !== undefined
      ? Number(b.faixa_maxima_ordem)
      : Infinity;

  const faixaSobrepoe = faixaMinA <= faixaMaxB && faixaMinB <= faixaMaxA;

  // Sexo
  const sexoSobrepoe =
    a.sexo === b.sexo ||
    a.sexo === 'MISTO' ||
    b.sexo === 'MISTO';

  return idadeSobrepoe && pesoSobrepoe && faixaSobrepoe && sexoSobrepoe;
}

module.exports = {
  inscricaoCompativelComCategoria,
  categoriasSeSobrepoem,
};
