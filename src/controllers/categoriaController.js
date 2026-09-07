const categoriaService = require('../services/categoriaService');
const {
  ValidationError,
  BusinessRuleError,
  NotFoundError,
} = require('../utils/errors');

async function listar(req, res, next) {
  try {
    const { eventoId } = req.params;
    const resultado = await categoriaService.listarCategorias(eventoId);

    return res.render('categorias/index', {
      titulo: 'Categorias',
      evento: resultado.evento,
      categorias: resultado.categorias,
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
    const { evento, faixas } = await categoriaService.prepararFormulario(eventoId);

    return res.render('categorias/create', {
      titulo: 'Nova categoria',
      evento,
      faixas,
      categoria: {},
      chaveExistente: false,
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
    const resultado = await categoriaService.criarCategoria(eventoId, req.body);

    if (resultado.sobreposicoes && resultado.sobreposicoes.length > 0) {
      req.session.mensagemSucesso = `Categoria criada com sucesso. Atenção: existem critérios sobrepostos com: ${resultado.sobreposicoes.join(', ')}.`;
    } else if (resultado.aberta) {
      req.session.mensagemSucesso = 'Categoria aberta criada com sucesso. Atenção: esta categoria não possui restrições e poderá ser compatível com várias inscrições.';
    } else {
      req.session.mensagemSucesso = 'Categoria criada com sucesso.';
    }

    return res.redirect(`/eventos/${eventoId}/categorias`);
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
        const { evento, faixas } = await categoriaService.prepararFormulario(eventoId);
        return res.status(422).render('categorias/create', {
          titulo: 'Nova categoria',
          evento,
          faixas,
          categoria: req.body,
          chaveExistente: false,
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
    const { evento, faixas } = await categoriaService.prepararFormulario(eventoId);
    const categoria = await categoriaService.buscarCategoria(eventoId, id);

    return res.render('categorias/edit', {
      titulo: 'Editar categoria',
      evento,
      faixas,
      categoria,
      chaveExistente: Number(categoria.total_chaves) > 0,
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
    const resultado = await categoriaService.editarCategoria(
      eventoId,
      id,
      req.body
    );

    if (resultado.apenasNome) {
      req.session.mensagemSucesso = 'Nome da categoria atualizado com sucesso. Os critérios foram mantidos pois a categoria já possui chave.';
    } else if (resultado.sobreposicoes && resultado.sobreposicoes.length > 0) {
      req.session.mensagemSucesso = `Categoria atualizada com sucesso. Atenção: existem critérios sobrepostos com: ${resultado.sobreposicoes.join(', ')}.`;
    } else {
      req.session.mensagemSucesso = 'Categoria atualizada com sucesso.';
    }

    return res.redirect(`/eventos/${eventoId}/categorias`);
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
        const { evento, faixas } = await categoriaService.prepararFormulario(eventoId);
        let categoriaAtual = null;
        try {
          categoriaAtual = await categoriaService.buscarCategoria(eventoId, id);
        } catch (_) {}

        return res.status(422).render('categorias/edit', {
          titulo: 'Editar categoria',
          evento,
          faixas,
          categoria: {
            ...(categoriaAtual || {}),
            ...req.body,
            id,
          },
          chaveExistente: categoriaAtual
            ? Number(categoriaAtual.total_chaves) > 0
            : false,
          erros: erro.erros || { geral: erro.message },
        });
      } catch (errInner) {
        return next(errInner);
      }
    }

    next(erro);
  }
}

async function excluir(req, res, next) {
  const { eventoId, id } = req.params;

  try {
    await categoriaService.excluirCategoria(eventoId, id);
    req.session.mensagemSucesso = 'Categoria excluída com sucesso.';
    return res.redirect(`/eventos/${eventoId}/categorias`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (
      erro instanceof BusinessRuleError ||
      erro.statusCode === 409
    ) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/categorias`);
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
  excluir,
};
