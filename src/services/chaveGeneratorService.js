const crypto = require('crypto');
const { ValidationError, BusinessRuleError } = require('../utils/errors');

/**
 * BYE representa um slot sem competidor (avanço livre).
 */
const BYE = Object.freeze({ isBye: true, nome: 'BYE' });

/**
 * Calcula o tamanho da chave em potência de 2.
 * @param {number} totalInscritos
 * @returns {number}
 */
function calcularTamanhoChave(totalInscritos) {
  if (!Number.isInteger(totalInscritos) || totalInscritos < 2) {
    throw new BusinessRuleError('São necessários pelo menos dois competidores.');
  }

  let tamanho = 2;
  while (tamanho < totalInscritos) {
    tamanho *= 2;
  }

  if (tamanho > 128) {
    throw new BusinessRuleError('O tamanho máximo suportado é de 128 competidores.');
  }

  return tamanho;
}

/**
 * Total de rodadas da chave (log2 do tamanho).
 * @param {number} tamanho
 * @returns {number}
 */
function calcularTotalRodadas(tamanho) {
  return Math.log2(tamanho);
}

/**
 * Total de lutas da chave eliminatória simples (tamanho - 1).
 * @param {number} tamanho
 * @returns {number}
 */
function calcularTotalLutas(tamanho) {
  return tamanho - 1;
}

/**
 * Gera a ordem padrão dos seeds para uma chave de potência de 2.
 * Garante que Seed 1 e Seed 2 fiquem em extremos opostos e só se encontrem na final.
 * Exemplos:
 *   2 -> [1, 2]
 *   4 -> [1, 4, 2, 3]
 *   8 -> [1, 8, 4, 5, 2, 7, 3, 6]
 *  16 -> [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
 * @param {number} tamanho
 * @returns {number[]}
 */
function gerarOrdemSeeds(tamanho) {
  let ordem = [1, 2];

  while (ordem.length < tamanho) {
    const soma = ordem.length * 2 + 1;
    ordem = ordem.flatMap((seed) => [seed, soma - seed]);
  }

  return ordem;
}

/**
 * Valida a integridade dos seeds dos inscritos:
 * - Devem ser inteiros positivos.
 * - Não podem se repetir.
 * - Não podem ser maiores que o total de competidores.
 * - Devem formar uma sequência sem lacunas iniciando em 1.
 * @param {Array} inscritos
 * @returns {{ valido: boolean, inscritosComSeed: Array, inscritosSemSeed: Array }}
 */
function validarSeeds(inscritos = []) {
  const inscritosComSeed = [];
  const inscritosSemSeed = [];

  for (const inscrito of inscritos) {
    const seedVal = inscrito.seed;
    if (seedVal !== null && seedVal !== undefined && String(seedVal).trim() !== '') {
      const num = Number(seedVal);
      if (!Number.isInteger(num) || num <= 0) {
        throw new ValidationError({
          seeds: 'Os seeds da categoria estão inválidos. Utilize uma sequência sem repetições começando em 1.',
        });
      }
      inscritosComSeed.push({ ...inscrito, seed: num });
    } else {
      inscritosSemSeed.push(inscrito);
    }
  }

  if (inscritosComSeed.length === 0) {
    return { valido: true, inscritosComSeed: [], inscritosSemSeed };
  }

  const seeds = inscritosComSeed.map((i) => i.seed);

  // Sem repetições
  if (new Set(seeds).size !== seeds.length) {
    throw new ValidationError({
      seeds: 'Os seeds da categoria estão inválidos. Utilize uma sequência sem repetições começando em 1.',
    });
  }

  // Não pode ser maior que o total de competidores
  if (Math.max(...seeds) > inscritos.length) {
    throw new ValidationError({
      seeds: 'Os seeds da categoria estão inválidos. Utilize uma sequência sem repetições começando em 1.',
    });
  }

  // Sequência sem lacunas começando em 1
  const ordenados = [...seeds].sort((a, b) => a - b);
  for (let i = 0; i < ordenados.length; i++) {
    if (ordenados[i] !== i + 1) {
      throw new ValidationError({
        seeds: 'Os seeds da categoria estão inválidos. Utilize uma sequência sem repetições começando em 1.',
      });
    }
  }

  return { valido: true, inscritosComSeed, inscritosSemSeed };
}

/**
 * Retorna o índice do slot adversário na 1ª rodada (0 x 1, 2 x 3, 4 x 5...).
 * @param {number} indice
 * @returns {number}
 */
function buscarSlotAdversario(indice) {
  return indice % 2 === 0 ? indice + 1 : indice - 1;
}

/**
 * Distribui cabeças de chave em seus slots fixos de acordo com a ordem padrão.
 * @param {Array} slots
 * @param {Array} inscritosComSeed
 * @param {number[]} ordemSeeds
 */
function distribuirSeeds(slots, inscritosComSeed, ordemSeeds) {
  for (const inscrito of inscritosComSeed) {
    const indice = ordemSeeds.indexOf(inscrito.seed);
    if (indice !== -1) {
      slots[indice] = inscrito;
    }
  }
}

/**
 * Distribui byes priorizando os cabeças de chave na ordem 1, 2, 3...
 * e garantindo que NUNCA haja dois byes na mesma luta da primeira rodada.
 * @param {Array} slots
 * @param {number} totalByes
 * @param {number[]} ordemSeeds
 * @param {Array} inscritosComSeed
 */
function distribuirByes(slots, totalByes, ordemSeeds, inscritosComSeed = []) {
  let byesRestantes = totalByes;
  const tamanho = slots.length;

  if (byesRestantes <= 0) {
    return;
  }

  // 1. Prioridade para adversários dos seeds (Seed 1, Seed 2, Seed 3...)
  const seedsPresentes = [...inscritosComSeed].sort((a, b) => a.seed - b.seed);
  for (const inscrito of seedsPresentes) {
    if (byesRestantes <= 0) break;

    const slotSeed = ordemSeeds.indexOf(inscrito.seed);
    const slotAdv = buscarSlotAdversario(slotSeed);

    if (slots[slotAdv] === null) {
      slots[slotAdv] = BYE;
      byesRestantes--;
    }
  }

  // 2. Se ainda sobrarem byes e houver seeds teoricos (ordem padrão 1, 2, 3...)
  if (byesRestantes > 0) {
    for (let seedNum = 1; seedNum <= tamanho; seedNum++) {
      if (byesRestantes <= 0) break;

      const slotSeed = ordemSeeds.indexOf(seedNum);
      const slotAdv = buscarSlotAdversario(slotSeed);

      // Só coloca se o adversário estiver vazio E a luta ainda não tiver bye
      if (
        slots[slotAdv] === null &&
        slots[slotSeed] !== BYE
      ) {
        slots[slotAdv] = BYE;
        byesRestantes--;
      }
    }
  }

  // 3. Caso residual (distribuição equilibrada em qualquer combate sem bye)
  if (byesRestantes > 0) {
    for (let i = 0; i < tamanho; i += 2) {
      if (byesRestantes <= 0) break;

      // Verifica se a luta já possui um bye
      if (slots[i] === BYE || slots[i + 1] === BYE) {
        continue;
      }

      // Coloca no slot que estiver livre
      if (slots[i + 1] === null) {
        slots[i + 1] = BYE;
        byesRestantes--;
      } else if (slots[i] === null) {
        slots[i] = BYE;
        byesRestantes--;
      }
    }
  }

  // Verificação de segurança estrita: NUNCA permitir BYE x BYE
  for (let i = 0; i < tamanho; i += 2) {
    if (slots[i] === BYE && slots[i + 1] === BYE) {
      throw new Error('Inconsistência interna: confronto BYE x BYE detectado.');
    }
  }
}

/**
 * Embaralha lista usando gerador criptograficamente seguro (Fisher-Yates).
 * @param {Array} lista
 * @returns {Array}
 */
function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Calcula quantidade de confrontos entre membros da mesma equipe na 1ª rodada.
 * @param {Array} slots
 * @returns {number}
 */
function calcularConflitos(slots) {
  let conflitos = 0;
  for (let i = 0; i < slots.length; i += 2) {
    const c1 = slots[i];
    const c2 = slots[i + 1];

    if (
      c1 &&
      c2 &&
      c1 !== BYE &&
      c2 !== BYE &&
      !c1.isBye &&
      !c2.isBye &&
      c1.equipe_id &&
      c2.equipe_id &&
      Number(c1.equipe_id) === Number(c2.equipe_id)
    ) {
      conflitos++;
    }
  }
  return conflitos;
}

/**
 * Distribui competidores não-seeded nos slots restantes procurando minimizar
 * confrontos entre atletas da mesma equipe na 1ª rodada.
 * @param {Array} slots
 * @param {Array} inscritosSemSeed
 * @param {number} maxTentativas
 * @returns {{ slots: Array, conflitos: number }}
 */
function sortearRestantesComSeparacaoEquipes(slots, inscritosSemSeed, maxTentativas = 500) {
  const indicesVazios = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === null) {
      indicesVazios.push(i);
    }
  }

  if (inscritosSemSeed.length === 0 || indicesVazios.length === 0) {
    return {
      slots: [...slots],
      conflitos: calcularConflitos(slots),
    };
  }

  let melhorDistribuicao = null;
  let menorConflito = Infinity;

  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    const sorteados = embaralhar(inscritosSemSeed);
    const candidato = [...slots];

    for (let k = 0; k < indicesVazios.length; k++) {
      candidato[indicesVazios[k]] = sorteados[k];
    }

    const conflitos = calcularConflitos(candidato);

    if (conflitos < menorConflito) {
      melhorDistribuicao = candidato;
      menorConflito = conflitos;
    }

    if (menorConflito === 0) {
      break;
    }
  }

  return {
    slots: melhorDistribuicao || slots,
    conflitos: menorConflito,
  };
}

/**
 * Converte a distribuição de slots na árvore completa de lutas com destinos.
 * @param {number} tamanho
 * @param {Array} slots
 * @returns {Array}
 */
function gerarEstruturaLutas(tamanho, slots) {
  const totalRodadas = Math.log2(tamanho);
  const lutas = [];

  // Rodada 1: preenchida com competidores ou null (quando BYE)
  const qtdR1 = tamanho / 2;
  for (let posicao = 1; posicao <= qtdR1; posicao++) {
    const slot1 = slots[(posicao - 1) * 2];
    const slot2 = slots[(posicao - 1) * 2 + 1];

    lutas.push({
      rodada: 1,
      posicao,
      competidor_1_id: slot1 && !slot1.isBye ? slot1.id : null,
      competidor_2_id: slot2 && !slot2.isBye ? slot2.id : null,
      proximaRodada: totalRodadas > 1 ? 2 : null,
      proximaPosicao: totalRodadas > 1 ? Math.ceil(posicao / 2) : null,
      proximoSlot: totalRodadas > 1 ? (posicao % 2 === 1 ? 1 : 2) : null,
    });
  }

  // Rodadas 2 até a final: começam com competidores vazios (null)
  for (let rodada = 2; rodada <= totalRodadas; rodada++) {
    const quantidade = tamanho / Math.pow(2, rodada);
    for (let posicao = 1; posicao <= quantidade; posicao++) {
      lutas.push({
        rodada,
        posicao,
        competidor_1_id: null,
        competidor_2_id: null,
        proximaRodada: rodada < totalRodadas ? rodada + 1 : null,
        proximaPosicao: rodada < totalRodadas ? Math.ceil(posicao / 2) : null,
        proximoSlot: rodada < totalRodadas ? (posicao % 2 === 1 ? 1 : 2) : null,
      });
    }
  }

  return lutas;
}

/**
 * Função central do gerador puro de chaves.
 * Recebe inscritos confirmados e gera a árvore completa em memória.
 * @param {{ inscritos: Array, tamanho?: number, maxTentativas?: number }} params
 * @returns {{
 *   tamanho: number,
 *   totalRodadas: number,
 *   totalLutas: number,
 *   totalByes: number,
 *   conflitosEquipe: number,
 *   slots: Array,
 *   lutas: Array
 * }}
 */
function gerarChave({ inscritos = [], tamanho: tamanhoInformado, maxTentativas = 500 } = {}) {
  const totalInscritos = inscritos.length;
  const tamanho = tamanhoInformado || calcularTamanhoChave(totalInscritos);

  // Validação de integridade de seeds
  const { inscritosComSeed, inscritosSemSeed } = validarSeeds(inscritos);

  const totalByes = tamanho - totalInscritos;
  const totalRodadas = calcularTotalRodadas(tamanho);
  const totalLutas = calcularTotalLutas(tamanho);

  const slots = new Array(tamanho).fill(null);
  const ordemSeeds = gerarOrdemSeeds(tamanho);

  // 1. Distribuir cabeças de chave
  distribuirSeeds(slots, inscritosComSeed, ordemSeeds);

  // 2. Distribuir byes priorizando os seeds
  distribuirByes(slots, totalByes, ordemSeeds, inscritosComSeed);

  // 3. Sortear demais participantes minimizando choques de equipe
  const { slots: slotsFinal, conflitos } = sortearRestantesComSeparacaoEquipes(
    slots,
    inscritosSemSeed,
    maxTentativas
  );

  // 4. Montar a estrutura completa de combates com encadeamento
  const lutas = gerarEstruturaLutas(tamanho, slotsFinal);

  return {
    tamanho,
    totalRodadas,
    totalLutas,
    totalByes,
    conflitosEquipe: conflitos,
    slots: slotsFinal,
    lutas,
  };
}

module.exports = {
  BYE,
  calcularTamanhoChave,
  calcularTotalRodadas,
  calcularTotalLutas,
  gerarOrdemSeeds,
  validarSeeds,
  buscarSlotAdversario,
  distribuirSeeds,
  distribuirByes,
  embaralhar,
  calcularConflitos,
  sortearRestantesComSeparacaoEquipes,
  gerarEstruturaLutas,
  gerarChave,
};
