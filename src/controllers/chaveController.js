const chaveService = require('../services/chaveService');
const chaveVisualizacaoService = require('../services/chaveVisualizacaoService');
const {
  NotFoundError,
  BusinessRuleError,
  ValidationError,
} = require('../utils/errors');

/**
 * Controlador de chaves e sorteios.
 */

async function listar(req, res, next) {
  try {
    const { eventoId } = req.params;
    const { evento, categorias } = await chaveService.listarCategoriasEChaves(eventoId);

    return res.render('chaves/index', {
      titulo: `Chaves — ${evento.nome}`,
      evento,
      categorias,
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

async function mostrar(req, res, next) {
  try {
    const { eventoId, chaveId } = req.params;
    const dados = await chaveVisualizacaoService.buscarVisualizacao(eventoId, chaveId);

    return res.render('chaves/show', {
      titulo: `${dados.categoria.nome} — ${dados.evento.nome}`,
      evento: dados.evento,
      categoria: dados.categoria,
      chave: dados.chave,
      rodadas: dados.rodadas,
      alturaMinima: dados.alturaMinima,
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

async function gerar(req, res, next) {
  const { eventoId, categoriaId } = req.params;

  try {
    const resultado = await chaveService.gerarChave(eventoId, categoriaId);
    let msg = 'Chave gerada com sucesso.';
    if (resultado.conflitosEquipe > 0) {
      msg += ` Atenção: ${resultado.conflitosEquipe} confronto(s) de atletas da mesma equipe não puderam ser evitados na primeira rodada.`;
    }

    req.session.mensagemSucesso = msg;
    return res.redirect(`/eventos/${eventoId}/chaves/${resultado.chave.id}`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (
      erro instanceof BusinessRuleError ||
      erro instanceof ValidationError ||
      erro.statusCode === 409 ||
      erro.statusCode === 422
    ) {
      const msg = erro.erros && erro.erros.seeds ? erro.erros.seeds : erro.message;
      req.session.mensagemErro = msg;
      return res.redirect(`/eventos/${eventoId}/chaves`);
    }

    next(erro);
  }
}

async function sortear(req, res, next) {
  const { eventoId, chaveId } = req.params;

  try {
    const resultado = await chaveService.sortearNovamente(eventoId, chaveId);
    let msg = 'Chave sorteada novamente com sucesso.';
    if (resultado.conflitosEquipe > 0) {
      msg += ` Atenção: ${resultado.conflitosEquipe} confronto(s) de atletas da mesma equipe não puderam ser evitados na primeira rodada.`;
    }

    req.session.mensagemSucesso = msg;
    return res.redirect(`/eventos/${eventoId}/chaves/${resultado.chave.id}`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (
      erro instanceof BusinessRuleError ||
      erro instanceof ValidationError ||
      erro.statusCode === 409 ||
      erro.statusCode === 422
    ) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}`);
    }

    next(erro);
  }
}

async function iniciar(req, res, next) {
  const { eventoId, chaveId } = req.params;

  try {
    await chaveService.iniciarChave(eventoId, chaveId);
    req.session.mensagemSucesso = 'Chave iniciada com sucesso! Os byes avançaram e as primeiras lutas estão prontas.';
    return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (
      erro instanceof BusinessRuleError ||
      erro instanceof ValidationError ||
      erro.statusCode === 409 ||
      erro.statusCode === 422
    ) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}`);
    }

    next(erro);
  }
}

async function excluir(req, res, next) {
  const { eventoId, chaveId } = req.params;

  try {
    await chaveService.excluirChave(eventoId, chaveId);
    req.session.mensagemSucesso = 'Chave excluída com sucesso.';
    return res.redirect(`/eventos/${eventoId}/chaves`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (
      erro instanceof BusinessRuleError ||
      erro instanceof ValidationError ||
      erro.statusCode === 409 ||
      erro.statusCode === 422
    ) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/chaves/${chaveId}`);
    }

    next(erro);
  }
}

module.exports = {
  listar,
  mostrar,
  gerar,
  sortear,
  iniciar,
  excluir,
};
