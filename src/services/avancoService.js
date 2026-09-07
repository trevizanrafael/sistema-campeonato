const lutaRepository = require('../repositories/lutaRepository');

/**
 * Serviço responsável pelo avanço de competidores vencedores e processamento de byes.
 */

async function avancarVencedor(luta, vencedorId, client) {
  if (!luta.proxima_luta_id) {
    // Final da chave: não há próxima luta para avançar
    return;
  }

  const coluna =
    luta.proximo_slot === 1
      ? 'competidor_1_id'
      : 'competidor_2_id';

  await lutaRepository.atualizarCompetidor(
    luta.proxima_luta_id,
    coluna,
    vencedorId,
    client
  );

  const proxima = await lutaRepository.buscarPorId(
    luta.proxima_luta_id,
    client
  );

  // Se ambos os competidores da próxima luta já estiverem definidos, marca como PRONTA
  if (proxima && proxima.competidor_1_id && proxima.competidor_2_id) {
    await lutaRepository.marcarPronta(proxima.id, client);
  }
}

async function processarBye(luta, client) {
  const vencedorId = luta.competidor_1_id || luta.competidor_2_id;

  if (!vencedorId) {
    throw new Error(`Luta #${luta.id} não possui competidor válido para avançar por bye.`);
  }

  // Finaliza a luta como BYE
  await lutaRepository.finalizarBye(luta.id, vencedorId, client);

  // Envia o vencedor para a próxima luta na chave
  await avancarVencedor(luta, vencedorId, client);

  return vencedorId;
}

module.exports = {
  avancarVencedor,
  processarBye,
};
