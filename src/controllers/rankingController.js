const rankingService = require('../services/rankingService');
const { NotFoundError } = require('../utils/errors');

/**
 * Controlador responsável pelas telas de ranking de equipes e extrato individual.
 */

async function mostrarRanking(req, res, next) {
  try {
    const { eventoId } = req.params;
    const resultado = await rankingService.buscarRanking(eventoId);

    return res.render('ranking/index', {
      titulo: 'Ranking das equipes',
      evento: resultado.evento,
      situacao: resultado.situacao,
      equipes: resultado.equipes,
    });
  } catch (error) {
    if (error instanceof NotFoundError || error.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }
    next(error);
  }
}

async function mostrarEquipe(req, res, next) {
  try {
    const { eventoId, equipeId } = req.params;
    const resultado = await rankingService.buscarDetalhesEquipe(eventoId, equipeId);

    return res.render('ranking/equipe', {
      titulo: `${resultado.equipe.equipe_nome} — Detalhes da equipe`,
      evento: resultado.evento,
      equipe: resultado.equipe,
      extrato: resultado.extrato,
    });
  } catch (error) {
    if (error instanceof NotFoundError || error.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }
    next(error);
  }
}

module.exports = {
  mostrarRanking,
  mostrarEquipe,
};
