const finalizacaoService = require('../services/finalizacaoService');
const { NotFoundError, RegraNegocioError } = require('../utils/errors');

/**
 * Controlador responsável pelas operações de finalização de categoria,
 * visualização de prévia do pódio e reabertura de categoria.
 */

async function mostrarPreview(req, res, next) {
  const { eventoId, chaveId } = req.params;

  try {
    const dados = await finalizacaoService.calcularPreview(eventoId, chaveId);

    return res.render('finalizacao/preview', {
      titulo: 'Finalizar categoria',
      evento: dados.evento,
      categoria: dados.categoria,
      chave: dados.chave,
      podio: dados.podio,
      resumoEquipes: dados.resumoEquipes,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    if (error instanceof NotFoundError || error.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (error instanceof RegraNegocioError || error.statusCode === 409 || error.statusCode === 400) {
      req.session.mensagemErro = error.message;
      return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}`);
    }

    next(error);
  }
}

async function finalizar(req, res, next) {
  const { eventoId, chaveId } = req.params;
  const usuarioId = req.session?.usuario?.id || null;

  try {
    await finalizacaoService.finalizarCategoria(eventoId, chaveId, usuarioId);
    req.session.mensagemSucesso = 'Categoria finalizada com sucesso.';
    return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}`);
  } catch (error) {
    if (error instanceof NotFoundError || error.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (error instanceof RegraNegocioError || error.statusCode === 409 || error.statusCode === 400) {
      req.session.mensagemErro = error.message;
      return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}`);
    }

    next(error);
  }
}

async function reabrir(req, res, next) {
  const { eventoId, chaveId } = req.params;
  const usuarioId = req.session?.usuario?.id || null;

  try {
    await finalizacaoService.reabrirCategoria(eventoId, chaveId, usuarioId);
    req.session.mensagemSucesso =
      'Categoria reaberta. Os pontos de colocação foram removidos.';
    return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}`);
  } catch (error) {
    if (error instanceof NotFoundError || error.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (error instanceof RegraNegocioError || error.statusCode === 409 || error.statusCode === 400) {
      req.session.mensagemErro = error.message;
      return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}`);
    }

    next(error);
  }
}

module.exports = {
  mostrarPreview,
  finalizar,
  reabrir,
};
