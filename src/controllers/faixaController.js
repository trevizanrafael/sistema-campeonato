const faixaService = require('../services/faixaService');
const {
  ValidationError,
  NotFoundError,
  BusinessRuleError,
} = require('../utils/errors');

async function listar(req, res, next) {
  try {
    const faixas = await faixaService.listarFaixas();

    return res.render('faixas/index', {
      titulo: 'Faixas',
      subtitulo: 'Cadastre e ordene as graduações utilizadas nas categorias.',
      faixas,
    });
  } catch (erro) {
    next(erro);
  }
}

function mostrarCadastro(req, res) {
  return res.render('faixas/create', {
    titulo: 'Nova faixa',
    faixa: {
      nome: '',
    },
    erros: {},
  });
}

async function cadastrar(req, res, next) {
  try {
    await faixaService.criarFaixa(req.body);
    req.session.mensagemSucesso = 'Faixa cadastrada com sucesso.';
    return res.redirect('/faixas');
  } catch (erro) {
    if (erro instanceof ValidationError) {
      return res.status(422).render('faixas/create', {
        titulo: 'Nova faixa',
        faixa: req.body,
        erros: erro.erros,
      });
    }
    if (erro instanceof BusinessRuleError) {
      return res.status(422).render('faixas/create', {
        titulo: 'Nova faixa',
        faixa: req.body,
        erros: { nome: erro.message },
      });
    }
    next(erro);
  }
}

async function mostrarEdicao(req, res, next) {
  try {
    const faixa = await faixaService.buscarFaixa(req.params.id);

    return res.render('faixas/edit', {
      titulo: 'Editar faixa',
      faixa,
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
    await faixaService.editarFaixa(req.params.id, req.body);
    req.session.mensagemSucesso = 'Faixa atualizada com sucesso.';
    return res.redirect('/faixas');
  } catch (erro) {
    if (erro instanceof ValidationError) {
      return res.status(422).render('faixas/edit', {
        titulo: 'Editar faixa',
        faixa: {
          id: req.params.id,
          ...req.body,
        },
        erros: erro.erros,
      });
    }
    if (erro instanceof BusinessRuleError) {
      return res.status(422).render('faixas/edit', {
        titulo: 'Editar faixa',
        faixa: {
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

async function subir(req, res, next) {
  try {
    await faixaService.subirFaixa(req.params.id);
    req.session.mensagemSucesso = 'Ordem das faixas atualizada.';
    return res.redirect('/faixas');
  } catch (erro) {
    if (erro instanceof NotFoundError) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }
    next(erro);
  }
}

async function descer(req, res, next) {
  try {
    await faixaService.descerFaixa(req.params.id);
    req.session.mensagemSucesso = 'Ordem das faixas atualizada.';
    return res.redirect('/faixas');
  } catch (erro) {
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
    await faixaService.excluirFaixa(req.params.id);
    req.session.mensagemSucesso = 'Faixa excluída com sucesso.';
    return res.redirect('/faixas');
  } catch (erro) {
    if (erro instanceof BusinessRuleError) {
      req.session.mensagemErro =
        erro.message ||
        'A faixa não pode ser excluída porque está sendo utilizada.';
      return res.redirect('/faixas');
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
  subir,
  descer,
  excluir,
};
