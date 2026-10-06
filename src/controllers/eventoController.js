const eventoService = require('../services/eventoService');
const {
  ValidationError,
  NotFoundError,
  BusinessRuleError,
} = require('../utils/errors');

async function listar(req, res, next) {
  try {
    const resultado = await eventoService.listarEventos({
      busca: req.query.busca,
      pagina: req.query.pagina,
    });

    return res.render('eventos/index', {
      titulo: 'Campeonatos',
      subtitulo: 'Gerencie os campeonatos cadastrados.',
      ...resultado,
    });
  } catch (erro) {
    next(erro);
  }
}

function mostrarCadastro(req, res) {
  return res.render('eventos/create', {
    titulo: 'Novo campeonato',
    evento: {
      nome: '',
      descricao: '',
    },
    erros: {},
  });
}

async function cadastrar(req, res, next) {
  try {
    const usuarioId = req.session?.usuario?.id || null;
    const evento = await eventoService.criarEvento(req.body, usuarioId);
    req.session.mensagemSucesso = 'Campeonato criado com sucesso.';
    return res.redirect(`/eventos/${evento.id}`);
  } catch (erro) {
    if (erro instanceof ValidationError) {
      return res.status(422).render('eventos/create', {
        titulo: 'Novo campeonato',
        evento: req.body,
        erros: erro.erros,
      });
    }
    next(erro);
  }
}

async function visualizar(req, res, next) {
  try {
    const painel = await eventoService.montarPainel(req.params.id, res.locals.pode);

    return res.render('eventos/show', {
      titulo: painel.evento.nome,
      subtitulo: 'Visão geral do campeonato',
      evento: painel.evento,
      etapas: painel.etapas,
      proximoPasso: painel.proximoPasso,
      pendencias: painel.pendencias,
      numeros: painel.numeros,
    });
  } catch (erro) {
    if (erro instanceof NotFoundError) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }
    next(erro);
  }
}

async function mostrarEdicao(req, res, next) {
  try {
    const evento = await eventoService.buscarEvento(req.params.id);

    return res.render('eventos/edit', {
      titulo: 'Editar campeonato',
      evento,
      erros: {},
    });
  } catch (erro) {
    if (erro instanceof NotFoundError) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }
    next(erro);
  }
}

async function editar(req, res, next) {
  try {
    const usuarioId = req.session?.usuario?.id || null;
    const evento = await eventoService.editarEvento(req.params.id, req.body, usuarioId);
    req.session.mensagemSucesso = 'Campeonato atualizado com sucesso.';
    return res.redirect('/eventos');
  } catch (erro) {
    if (erro instanceof ValidationError) {
      return res.status(422).render('eventos/edit', {
        titulo: 'Editar campeonato',
        evento: {
          id: req.params.id,
          ...req.body,
        },
        erros: erro.erros,
      });
    }
    if (erro instanceof NotFoundError) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }
    next(erro);
  }
}

async function excluir(req, res, next) {
  try {
    await eventoService.excluirEvento(req.params.id);
    req.session.mensagemSucesso = 'Campeonato excluído com sucesso.';
    return res.redirect('/eventos');
  } catch (erro) {
    if (erro instanceof BusinessRuleError) {
      req.session.mensagemErro =
        erro.message ||
        'O campeonato não pode ser excluído porque já possui dados vinculados.';
      return res.redirect(`/eventos/${req.params.id}`);
    }
    if (erro instanceof NotFoundError) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }
    next(erro);
  }
}

module.exports = {
  listar,
  mostrarCadastro,
  cadastrar,
  visualizar,
  mostrarEdicao,
  editar,
  excluir,
};
