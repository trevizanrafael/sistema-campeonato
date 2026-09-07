const regraPontuacaoRepository = require('../repositories/regraPontuacaoRepository');
const pontoEquipeRepository = require('../repositories/pontoEquipeRepository');

/**
 * Serviço responsável pelo lançamento automático de pontuação de lutas.
 */

async function registrarVitoria(eventoId, luta, vencedorId, client) {
  const regras = await regraPontuacaoRepository.buscarPorEvento(eventoId, client);

  if (!regras || !regras.pontos_vitoria || Number(regras.pontos_vitoria) <= 0) {
    return null;
  }

  let equipeId = null;
  if (vencedorId === luta.competidor_1_id) {
    equipeId = luta.competidor_1_equipe_id;
  } else if (vencedorId === luta.competidor_2_id) {
    equipeId = luta.competidor_2_equipe_id;
  }

  if (!equipeId) {
    const { rows } = await client.query(
      'SELECT equipe_id FROM inscricoes WHERE id = $1',
      [vencedorId]
    );
    if (rows[0]) {
      equipeId = rows[0].equipe_id;
    }
  }

  if (!equipeId) {
    return null;
  }

  const descricao = `Vitória na luta #${luta.posicao_chave || luta.id}${
    luta.categoria_nome ? ` (${luta.categoria_nome})` : ''
  }`;

  return await pontoEquipeRepository.criarPontoVitoria(
    {
      evento_id: eventoId,
      equipe_id: equipeId,
      inscricao_id: vencedorId,
      luta_id: luta.id,
      chave_id: luta.chave_id,
      pontos: Number(regras.pontos_vitoria),
      descricao,
    },
    client
  );
}

module.exports = {
  registrarVitoria,
};
