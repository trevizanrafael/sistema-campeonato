const chaveRepository = require('../repositories/chaveRepository');
const lutaRepository = require('../repositories/lutaRepository');
const { NotFoundError } = require('../utils/errors');

/**
 * Serviço especializado na formatação e preparação dos dados para visualização gráfica das chaves.
 */

function calcularNomeRodada(totalLutas) {
  const nomes = {
    1: 'Final',
    2: 'Semifinal',
    4: 'Quartas de final',
    8: 'Oitavas de final',
    16: '16 avos de final',
    32: '32 avos de final',
    64: '64 avos de final',
  };

  return nomes[totalLutas] || `Rodada com ${totalLutas} lutas`;
}

function prepararSlot(luta, numero, chave) {
  const id = numero === 1 ? luta.competidor_1_id : luta.competidor_2_id;
  const nome = numero === 1 ? luta.competidor_1_nome : luta.competidor_2_nome;
  const equipe = numero === 1 ? luta.competidor_1_equipe : luta.competidor_2_equipe;
  const seed = numero === 1 ? luta.competidor_1_seed : luta.competidor_2_seed;

  if (id) {
    return {
      tipo: 'COMPETIDOR',
      id,
      nome,
      equipe: equipe || null,
      seed: seed || null,
      vencedor: Boolean(luta.vencedor_id && luta.vencedor_id === id),
    };
  }

  const outroCompetidorExiste =
    numero === 1
      ? Boolean(luta.competidor_2_id)
      : Boolean(luta.competidor_1_id);

  const ehBye =
    luta.tipo_resultado === 'BYE' ||
    (chave.status === 'NAO_INICIADA' &&
      luta.rodada === 1 &&
      outroCompetidorExiste);

  if (ehBye) {
    return {
      tipo: 'BYE',
      id: null,
      nome: 'BYE',
      equipe: null,
      seed: null,
      vencedor: false,
    };
  }

  return {
    tipo: 'AGUARDANDO',
    id: null,
    nome: 'Aguardando',
    equipe: null,
    seed: null,
    vencedor: false,
  };
}

function agruparPorRodada(lutas = [], chave = {}) {
  const mapa = new Map();
  const lutasPorId = new Map(lutas.map((l) => [l.id, l]));

  for (const luta of lutas) {
    if (!mapa.has(luta.rodada)) {
      mapa.set(luta.rodada, []);
    }

    const proxima = luta.proxima_luta_id ? lutasPorId.get(luta.proxima_luta_id) : null;
    const proximaFinalizada = proxima ? proxima.status === 'FINALIZADA' : false;

    mapa.get(luta.rodada).push({
      ...luta,
      proximaFinalizada,
      competidor1: prepararSlot(luta, 1, chave),
      competidor2: prepararSlot(luta, 2, chave),
    });
  }

  // Ordenar as rodadas numericamente (1, 2, 3...)
  const rodadasNumeros = Array.from(mapa.keys()).sort((a, b) => a - b);

  const rodadas = rodadasNumeros.map((numero) => {
    const lutasDaRodada = mapa.get(numero).sort((a, b) => a.posicao - b.posicao);
    return {
      numero,
      nome: calcularNomeRodada(lutasDaRodada.length),
      lutas: lutasDaRodada,
    };
  });

  const totalPrimeiraRodada = rodadas[0] ? rodadas[0].lutas.length : 1;
  const alturaMinima = Math.max(600, totalPrimeiraRodada * 170);

  return {
    rodadas,
    alturaMinima,
  };
}

async function buscarVisualizacao(eventoId, chaveId) {
  const chave = await chaveRepository.buscarPorIdNoEvento(chaveId, eventoId);
  if (!chave) {
    throw new NotFoundError('Chave não encontrada.');
  }

  const lutas = await lutaRepository.listarPorChave(chaveId);
  const { rodadas, alturaMinima } = agruparPorRodada(lutas, chave);

  const finalLuta = lutas.find((l) => !l.proxima_luta_id);
  const todasFinalizadas =
    chave.status === 'EM_ANDAMENTO' &&
    lutas.length > 0 &&
    lutas.every((l) => l.status === 'FINALIZADA') &&
    Boolean(
      finalLuta &&
        finalLuta.status === 'FINALIZADA' &&
        finalLuta.vencedor_id &&
        finalLuta.perdedor_id
    );

  return {
    evento: {
      id: chave.evento_id,
      nome: chave.evento_nome || 'Evento',
    },
    categoria: {
      id: chave.categoria_id,
      nome: chave.categoria_nome,
    },
    chave,
    rodadas,
    alturaMinima,
    todasFinalizadas,
  };
}

module.exports = {
  calcularNomeRodada,
  prepararSlot,
  agruparPorRodada,
  buscarVisualizacao,
};
