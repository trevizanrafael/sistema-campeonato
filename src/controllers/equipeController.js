const equipeService = require('../services/equipeService');
const {
  ValidationError,
  NotFoundError,
  BusinessRuleError,
} = require('../utils/errors');

async function listar(req, res, next) {
  try {
    const equipes = await equipeService.listarEquipes();

    return res.render('equipes/index', {
      titulo: 'Academias',
      subtitulo: 'Gerencie as academias participantes.',
      equipes,
    });
  } catch (erro) {
    next(erro);
  }
}

function mostrarCadastro(req, res) {
  return res.render('equipes/create', {
    titulo: 'Nova academia',
    equipe: {
      nome: '',
    },
    erros: {},
  });
}

async function cadastrar(req, res, next) {
  try {
    await equipeService.criarEquipe(req.body);
    req.session.mensagemSucesso = 'Academia cadastrada com sucesso.';
    return res.redirect('/equipes');
  } catch (erro) {
    if (erro instanceof ValidationError) {
      return res.status(422).render('equipes/create', {
        titulo: 'Nova academia',
        equipe: req.body,
        erros: erro.erros,
      });
    }
    if (erro instanceof BusinessRuleError) {
      return res.status(422).render('equipes/create', {
        titulo: 'Nova academia',
        equipe: req.body,
        erros: { nome: erro.message },
      });
    }
    next(erro);
  }
}

async function mostrarEdicao(req, res, next) {
  try {
    const equipe = await equipeService.buscarEquipe(req.params.id);

    return res.render('equipes/edit', {
      titulo: 'Editar academia',
      equipe,
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
    await equipeService.editarEquipe(req.params.id, req.body);
    req.session.mensagemSucesso = 'Academia atualizada com sucesso.';
    return res.redirect('/equipes');
  } catch (erro) {
    if (erro instanceof ValidationError) {
      return res.status(422).render('equipes/edit', {
        titulo: 'Editar academia',
        equipe: {
          id: req.params.id,
          ...req.body,
        },
        erros: erro.erros,
      });
    }
    if (erro instanceof BusinessRuleError) {
      return res.status(422).render('equipes/edit', {
        titulo: 'Editar academia',
        equipe: {
          id: req.params.id,
          ...req.body,
        },
        erros: { nome: erro.message },
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
    await equipeService.excluirEquipe(req.params.id);
    req.session.mensagemSucesso = 'Academia excluída com sucesso.';
    return res.redirect('/equipes');
  } catch (erro) {
    if (erro instanceof BusinessRuleError) {
      req.session.mensagemErro =
        erro.message ||
        'Esta academia não pode ser excluída porque possui inscrições vinculadas.';
      return res.redirect('/equipes');
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
  mostrarEdicao,
  editar,
  excluir,
};
