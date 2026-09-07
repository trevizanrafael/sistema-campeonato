const resultadoService = require('../services/resultadoService');
const {
  NotFoundError,
  BusinessRuleError,
  ValidationError,
} = require('../utils/errors');

/**
 * Controlador para lançamento, correção e anulação de resultados de lutas.
 */

async function mostrarFormulario(req, res, next) {
  const { eventoId, chaveId, lutaId } = req.params;

  try {
    const luta = await resultadoService.buscarLutaParaResultado(
      eventoId,
      chaveId,
      lutaId
    );

    return res.render('resultados/create', {
      titulo: `Lançar Resultado — Luta #${luta.posicao_chave || luta.id}`,
      eventoId,
      chaveId,
      lutaId,
      luta,
      dados: {},
      erros: {},
    });
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof BusinessRuleError || erro.statusCode === 409) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}`);
    }

    next(erro);
  }
}

async function salvar(req, res, next) {
  const { eventoId, chaveId, lutaId } = req.params;
  const usuarioId = req.session?.usuario?.id || null;

  try {
    const { luta, proximaLutaId } = await resultadoService.lancarResultado(
      eventoId,
      chaveId,
      lutaId,
      req.body,
      usuarioId
    );

    req.session.mensagemSucesso = 'Resultado registrado com sucesso.';
    const anchor = proximaLutaId ? `#match-${proximaLutaId}` : `#match-${luta.id}`;
    return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}${anchor}`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof BusinessRuleError || erro.statusCode === 409) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}`);
    }

    if (erro instanceof ValidationError || erro.statusCode === 422) {
      try {
        const luta = await resultadoService.buscarLutaParaResultado(
          eventoId,
          chaveId,
          lutaId
        );

        return res.status(422).render('resultados/create', {
          titulo: `Lançar Resultado — Luta #${luta.posicao_chave || luta.id}`,
          eventoId,
          chaveId,
          lutaId,
          luta,
          dados: req.body,
          erros: erro.erros || { geral: erro.message },
        });
      } catch (innerError) {
        req.session.mensagemErro = erro.message;
        return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}`);
      }
    }

    next(erro);
  }
}

async function mostrarEdicao(req, res, next) {
  const { eventoId, chaveId, lutaId } = req.params;

  try {
    const luta = await resultadoService.buscarParaEdicao(
      eventoId,
      chaveId,
      lutaId
    );

    return res.render('resultados/edit', {
      titulo: `Corrigir Resultado — Luta #${luta.posicao_chave || luta.id}`,
      eventoId,
      chaveId,
      lutaId,
      luta,
      dados: {
        vencedor_id: luta.vencedor_id,
        tipo_resultado: luta.tipo_resultado,
        placar_1: luta.placar_1,
        placar_2: luta.placar_2,
        observacao: luta.observacao,
      },
      erros: {},
    });
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof BusinessRuleError || erro.statusCode === 409) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}#match-${lutaId}`);
    }

    next(erro);
  }
}

async function corrigir(req, res, next) {
  const { eventoId, chaveId, lutaId } = req.params;
  const usuarioId = req.session?.usuario?.id || null;

  try {
    const { luta } = await resultadoService.corrigirResultado(
      eventoId,
      chaveId,
      lutaId,
      req.body,
      usuarioId
    );

    req.session.mensagemSucesso = 'Resultado corrigido com sucesso.';
    return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}#match-${luta.id}`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof BusinessRuleError || erro.statusCode === 409) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}#match-${lutaId}`);
    }

    if (erro instanceof ValidationError || erro.statusCode === 422) {
      try {
        const luta = await resultadoService.buscarParaEdicao(
          eventoId,
          chaveId,
          lutaId
        );

        return res.status(422).render('resultados/edit', {
          titulo: `Corrigir Resultado — Luta #${luta.posicao_chave || luta.id}`,
          eventoId,
          chaveId,
          lutaId,
          luta,
          dados: req.body,
          erros: erro.erros || { geral: erro.message },
        });
      } catch (innerError) {
        req.session.mensagemErro = erro.message;
        return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}#match-${lutaId}`);
      }
    }

    next(erro);
  }
}

async function anular(req, res, next) {
  const { eventoId, chaveId, lutaId } = req.params;
  const usuarioId = req.session?.usuario?.id || null;

  try {
    const { luta } = await resultadoService.anularResultado(
      eventoId,
      chaveId,
      lutaId,
      usuarioId
    );

    req.session.mensagemSucesso = 'Resultado anulado com sucesso.';
    return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}#match-${luta.id}`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof BusinessRuleError || erro.statusCode === 409) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}#match-${lutaId}`);
    }

    next(erro);
  }
}

module.exports = {
  mostrarFormulario,
  salvar,
  mostrarEdicao,
  corrigir,
  anular,
};
