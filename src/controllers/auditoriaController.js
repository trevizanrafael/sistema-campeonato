const auditoriaService = require('../services/auditoriaService');

/**
 * Controlador de auditoria e histórico de eventos.
 */

async function listar(req, res, next) {
  try {
    const { eventoId } = req.params;
    const { acao, pagina } = req.query;

    const dados = await auditoriaService.listarAuditoria(eventoId, {
      acao,
      pagina,
    });

    res.render('auditoria/index', {
      evento: dados.evento,
      logs: dados.logs,
      acoesDisponiveis: dados.acoesDisponiveis,
      filtros: dados.filtros,
      paginacao: dados.paginacao,
      currentPath: req.baseUrl,
    });
  } catch (error) {
    next(error);
  }
}

async function detalhar(req, res, next) {
  try {
    const { eventoId, logId } = req.params;

    const dados = await auditoriaService.buscarDetalhes(eventoId, logId);

    res.render('auditoria/show', {
      evento: dados.evento,
      log: dados.log,
      currentPath: req.baseUrl,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listar,
  detalhar,
};
