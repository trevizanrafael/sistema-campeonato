const lutaRepository = require('../repositories/lutaRepository');
const { BusinessRuleError } = require('../utils/errors');

/**
 * Serviço responsável pelo avanço e remoção de competidores vencedores e processamento de byes.
 */

function calcularStatusLuta(luta) {
  if (luta.vencedor_id || luta.status === 'FINALIZADA') {
    return 'FINALIZADA';
  }

  if (luta.competidor_1_id && luta.competidor_2_id) {
    return 'PRONTA';
  }

  return 'AGUARDANDO';
}

async function avancarVencedor(luta, vencedorId, client) {
  if (!luta.proxima_luta_id) {
    // Final da chave: não há próxima luta para avançar
    return;
  }

  const coluna =
    luta.proximo_slot === 1
      ? 'competidor_1_id'
      : 'competidor_2_id';

  const atualizado = await lutaRepository.atualizarCompetidorSlotVazio(
    luta.proxima_luta_id,
    coluna,
    vencedorId,
    client
  );

  if (!atualizado) {
    throw new BusinessRuleError('A posição do vencedor na próxima luta já está ocupada.');
  }

  const proxima = await lutaRepository.buscarPorId(
    luta.proxima_luta_id,
    client
  );

  // Se ambos os competidores da próxima luta já estiverem definidos, marca como PRONTA
  if (proxima && proxima.competidor_1_id && proxima.competidor_2_id) {
    await lutaRepository.marcarPronta(proxima.id, client);
  }
}

async function removerVencedor(luta, vencedorId, client) {
  if (!luta.proxima_luta_id) {
    // Final da chave: não há próxima luta
    return;
  }

  const coluna =
    luta.proximo_slot === 1
      ? 'competidor_1_id'
      : 'competidor_2_id';

  const removido = await lutaRepository.removerCompetidorSlot(
    luta.proxima_luta_id,
    coluna,
    vencedorId,
    client
  );

  if (!removido) {
    throw new BusinessRuleError(
      'A estrutura da chave está inconsistente para remoção do vencedor.'
    );
  }

  const proxima = await lutaRepository.buscarPorId(
    luta.proxima_luta_id,
    client
  );

  if (proxima) {
    const novoStatus = calcularStatusLuta(proxima);
    if (proxima.status !== novoStatus) {
      await lutaRepository.atualizarStatus(proxima.id, novoStatus, client);
    }
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
  calcularStatusLuta,
  avancarVencedor,
  removerVencedor,
  processarBye,
};
