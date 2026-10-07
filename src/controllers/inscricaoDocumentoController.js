const inscricaoDocumentoService = require('../services/inscricaoDocumentoService');
const { ValidationError, NotFoundError } = require('../utils/errors');

function renderNaoEncontrado(res) {
  return res.status(404).render('errors/404', {
    titulo: 'Página não encontrada',
  });
}

async function renderPagina(res, eventoId, extras = {}, status = 200) {
  const dados = await inscricaoDocumentoService.prepararPagina(eventoId);

  return res.status(status).render('inscricoes/documento', {
    titulo: 'Inscrição por documento',
    ...dados,
    equipeSelecionada: null,
    erros: {},
    errosLinhas: null,
    resultado: null,
    ...extras,
  });
}

async function mostrar(req, res, next) {
  try {
    return await renderPagina(res, req.params.eventoId, {
      equipeSelecionada: req.query.equipe ? String(req.query.equipe) : null,
    });
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return renderNaoEncontrado(res);
    }
    next(erro);
  }
}

async function baixarModelo(req, res, next) {
  try {
    const buffer = await inscricaoDocumentoService.gerarModelo();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="modelo-inscricoes.xlsx"'
    );
    return res.send(Buffer.from(buffer));
  } catch (erro) {
    next(erro);
  }
}

async function importar(req, res, next) {
  const { eventoId } = req.params;
  const usuarioId = req.session?.usuario?.id || null;
  const equipeId = req.body?.equipe_id ? String(req.body.equipe_id) : null;

  try {
    if (req.erroUpload) {
      throw new ValidationError({ arquivo: req.erroUpload });
    }

    const resultado = await inscricaoDocumentoService.importarPlanilha(
      eventoId,
      equipeId,
      req.file ? req.file.buffer : null,
      usuarioId
    );

    if (resultado.tipo === 'ERROS') {
      return await renderPagina(
        res,
        eventoId,
        {
          equipeSelecionada: equipeId,
          nomeArquivo: req.file?.originalname || null,
          errosLinhas: resultado,
        },
        422
      );
    }

    return await renderPagina(res, eventoId, {
      equipeSelecionada: equipeId,
      resultado,
    });
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return renderNaoEncontrado(res);
    }

    if (erro instanceof ValidationError || erro.statusCode === 422) {
      try {
        return await renderPagina(
          res,
          eventoId,
          {
            equipeSelecionada: equipeId,
            erros: erro.erros || { geral: erro.message },
          },
          422
        );
      } catch (erroInterno) {
        return next(erroInterno);
      }
    }

    next(erro);
  }
}

module.exports = {
  mostrar,
  baixarModelo,
  importar,
};
