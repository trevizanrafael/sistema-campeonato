const inscricaoService = require('../services/inscricaoService');
const {
  ValidationError,
  BusinessRuleError,
  NotFoundError,
} = require('../utils/errors');

async function listar(req, res, next) {
  try {
    const { eventoId } = req.params;
    const resultado = await inscricaoService.listarInscricoes(
      eventoId,
      req.query
    );

    return res.render('inscricoes/index', {
      titulo: 'Inscricoes',
      evento: resultado.evento,
      inscricoes: resultado.inscricoes,
      resumo: resultado.resumo,
      categorias: resultado.categorias,
      equipes: resultado.equipes,
      filtros: resultado.filtros,
    });
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }
    next(erro);
  }
}

async function mostrarCadastro(req, res, next) {
  try {
    const { eventoId } = req.params;
    const { evento, equipes, faixas } =
      await inscricaoService.prepararFormulario(eventoId);

    return res.render('inscricoes/create', {
      titulo: 'Nova inscricao',
      evento,
      equipes,
      faixas,
      inscricao: {},
      emLuta: false,
      erros: {},
    });
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }
    next(erro);
  }
}

async function cadastrar(req, res, next) {
  const { eventoId } = req.params;

  try {
    const resultado = await inscricaoService.processarCadastro(
      eventoId,
      req.body
    );

    if (resultado.tipo === 'ESCOLHER_CATEGORIA') {
      return res.status(200).render('inscricoes/choose-category', {
        titulo: 'Escolha a categoria',
        evento: resultado.evento,
        inscricao: resultado.dados,
        categoriasCompativeis: resultado.categoriasCompativeis,
        modoEdicao: false,
      });
    }

    req.session.mensagemSucesso = resultado.mensagem;
    return res.redirect(`/eventos/${eventoId}/inscricoes`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (
      erro instanceof ValidationError ||
      erro instanceof BusinessRuleError ||
      erro.statusCode === 422 ||
      erro.statusCode === 409
    ) {
      try {
        const { evento, equipes, faixas } =
          await inscricaoService.prepararFormulario(eventoId);

        return res.status(422).render('inscricoes/create', {
          titulo: 'Nova inscricao',
          evento,
          equipes,
          faixas,
          inscricao: req.body,
          emLuta: false,
          erros: erro.erros || { geral: erro.message },
        });
      } catch (errInner) {
        return next(errInner);
      }
    }

    next(erro);
  }
}

async function mostrarEdicao(req, res, next) {
  const { eventoId, id } = req.params;

  try {
    const { evento, equipes, faixas } =
      await inscricaoService.prepararFormulario(eventoId);
    const inscricao = await inscricaoService.buscarInscricao(eventoId, id);

    return res.render('inscricoes/edit', {
      titulo: 'Editar inscricao',
      evento,
      equipes,
      faixas,
      inscricao,
      emLuta: Boolean(inscricao.participa_luta),
      erros: {},
    });
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }
    next(erro);
  }
}

async function editar(req, res, next) {
  const { eventoId, id } = req.params;

  try {
    const resultado = await inscricaoService.processarEdicao(
      eventoId,
      id,
      req.body
    );

    if (resultado.tipo === 'ESCOLHER_CATEGORIA') {
      return res.status(200).render('inscricoes/choose-category', {
        titulo: 'Escolha a categoria',
        evento: resultado.evento,
        inscricaoId: id,
        inscricao: resultado.dados,
        categoriasCompativeis: resultado.categoriasCompativeis,
        modoEdicao: true,
      });
    }

    req.session.mensagemSucesso = resultado.mensagem;
    return res.redirect(`/eventos/${eventoId}/inscricoes`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (
      erro instanceof ValidationError ||
      erro instanceof BusinessRuleError ||
      erro.statusCode === 422 ||
      erro.statusCode === 409
    ) {
      try {
        const { evento, equipes, faixas } =
          await inscricaoService.prepararFormulario(eventoId);
        let inscricaoAtual = null;
        try {
          inscricaoAtual = await inscricaoService.buscarInscricao(eventoId, id);
        } catch (_) {}

        return res.status(422).render('inscricoes/edit', {
          titulo: 'Editar inscricao',
          evento,
          equipes,
          faixas,
          inscricao: {
            ...(inscricaoAtual || {}),
            ...req.body,
            id,
          },
          emLuta: inscricaoAtual ? Boolean(inscricaoAtual.participa_luta) : false,
          erros: erro.erros || { geral: erro.message },
        });
      } catch (errInner) {
        return next(errInner);
      }
    }

    next(erro);
  }
}

async function cancelar(req, res, next) {
  const { eventoId, id } = req.params;

  try {
    await inscricaoService.cancelarInscricao(eventoId, id);
    req.session.mensagemSucesso = 'Inscrição cancelada com sucesso.';
    return res.redirect(`/eventos/${eventoId}/inscricoes`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof BusinessRuleError || erro.statusCode === 409) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/inscricoes`);
    }

    next(erro);
  }
}

async function reativar(req, res, next) {
  const { eventoId, id } = req.params;

  try {
    const resultado = await inscricaoService.reativarInscricao(eventoId, id);
    req.session.mensagemSucesso = resultado.mensagem;
    return res.redirect(`/eventos/${eventoId}/inscricoes`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof BusinessRuleError || erro.statusCode === 409) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/inscricoes`);
    }

    next(erro);
  }
}

async function excluir(req, res, next) {
  const { eventoId, id } = req.params;

  try {
    await inscricaoService.excluirInscricao(eventoId, id);
    req.session.mensagemSucesso = 'Inscrição excluída com sucesso.';
    return res.redirect(`/eventos/${eventoId}/inscricoes`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof BusinessRuleError || erro.statusCode === 409) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/inscricoes`);
    }

    next(erro);
  }
}

module.exports = {
  listar,
  mostrarCadastro,
  cadastrar,
  mostrarEdicao,
  editar,
  cancelar,
  reativar,
  excluir,
};
