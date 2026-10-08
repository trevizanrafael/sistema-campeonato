const eventoRepository = require('../repositories/eventoRepository');
const chaveRapidaService = require('../services/chaveRapidaService');
const {
  NotFoundError,
  BusinessRuleError,
  ValidationError,
} = require('../utils/errors');

/**
 * Controlador de Chaves Rápidas.
 */

async function mostrarNova(req, res, next) {
  try {
    const { eventoId } = req.params;
    const evento = await eventoRepository.buscarPorId(eventoId);
    if (!evento) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    return res.render('chaves_rapidas/create', {
      titulo: `Nova Chave Rápida — ${evento.nome}`,
      evento,
      erros: {},
      valores: {},
    });
  } catch (erro) {
    next(erro);
  }
}

async function criar(req, res, next) {
  const { eventoId } = req.params;
  const usuarioId = req.session?.usuario?.id || null;
  const { nome } = req.body;

  try {
    const chaveRapida = await chaveRapidaService.criar(
      eventoId,
      { nome },
      usuarioId
    );

    req.session.mensagemSucesso = `Chave rápida "${chaveRapida.nome}" criada! Agora cadastre os competidores.`;
    return res.redirect(`/eventos/${eventoId}/chaves-rapidas/${chaveRapida.id}`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof ValidationError) {
      const evento = await eventoRepository.buscarPorId(eventoId);
      return res.status(422).render('chaves_rapidas/create', {
        titulo: `Nova Chave Rápida — ${evento?.nome || ''}`,
        evento,
        erros: erro.erros || {},
        valores: { nome },
      });
    }

    if (erro instanceof BusinessRuleError) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/chaves`);
    }

    next(erro);
  }
}

async function mostrarDetalhes(req, res, next) {
  const { eventoId, chaveRapidaId } = req.params;

  try {
    const dados = await chaveRapidaService.buscarDetalhes(eventoId, chaveRapidaId);

    return res.render('chaves_rapidas/show', {
      titulo: `${dados.chaveRapida.nome} — Chave Rápida`,
      evento: dados.evento,
      chaveRapida: dados.chaveRapida,
      inscritos: dados.inscritos,
      equipes: dados.equipes,
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

async function adicionarCompetidor(req, res, next) {
  const { eventoId, chaveRapidaId } = req.params;
  const usuarioId = req.session?.usuario?.id || null;
  const { nome, equipe_id } = req.body;

  try {
    const resultado = await chaveRapidaService.adicionarCompetidor(
      eventoId,
      chaveRapidaId,
      { nome, equipe_id },
      usuarioId
    );

    req.session.mensagemSucesso = resultado && resultado.chaveExcluida
      ? 'Competidor adicionado! A chave de lutas foi reiniciada para incluir o novo atleta. Gere a chave eliminatória novamente.'
      : 'Competidor adicionado com sucesso!';
    return res.redirect(`/eventos/${eventoId}/chaves-rapidas/${chaveRapidaId}`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof ValidationError || erro instanceof BusinessRuleError) {
      const msg = erro.erros && (erro.erros.nome || erro.erros.equipe_id)
        ? (erro.erros.nome || erro.erros.equipe_id)
        : erro.message;
      req.session.mensagemErro = msg;
      return res.redirect(`/eventos/${eventoId}/chaves-rapidas/${chaveRapidaId}`);
    }

    next(erro);
  }
}

async function removerCompetidor(req, res, next) {
  const { eventoId, chaveRapidaId, inscritoId } = req.params;
  const usuarioId = req.session?.usuario?.id || null;

  try {
    const resultado = await chaveRapidaService.removerCompetidor(
      eventoId,
      chaveRapidaId,
      inscritoId,
      usuarioId
    );

    req.session.mensagemSucesso = resultado && resultado.chaveExcluida
      ? 'Competidor removido! A chave de lutas foi reiniciada. Gere a chave eliminatória novamente.'
      : 'Competidor removido com sucesso!';
    return res.redirect(`/eventos/${eventoId}/chaves-rapidas/${chaveRapidaId}`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof BusinessRuleError) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/chaves-rapidas/${chaveRapidaId}`);
    }

    next(erro);
  }
}

async function gerarChave(req, res, next) {
  const { eventoId, chaveRapidaId } = req.params;
  const usuarioId = req.session?.usuario?.id || null;

  try {
    const resultado = await chaveRapidaService.gerarChave(
      eventoId,
      chaveRapidaId,
      usuarioId
    );

    let msg = 'Chave rápida gerada com sucesso!';
    if (resultado.conflitosEquipe > 0) {
      msg += ` Atenção: ${resultado.conflitosEquipe} confronto(s) de atletas da mesma academia na primeira rodada.`;
    }

    req.session.mensagemSucesso = msg;
    return res.redirect(`/eventos/${eventoId}/chaves/${resultado.chave.id}`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof BusinessRuleError || erro instanceof ValidationError) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/chaves-rapidas/${chaveRapidaId}`);
    }

    next(erro);
  }
}

async function excluir(req, res, next) {
  const { eventoId, chaveRapidaId } = req.params;
  const usuarioId = req.session?.usuario?.id || null;

  try {
    await chaveRapidaService.excluir(eventoId, chaveRapidaId, usuarioId);
    req.session.mensagemSucesso = 'Chave rápida excluída com sucesso.';
    return res.redirect(`/eventos/${eventoId}/chaves`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof BusinessRuleError) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/chaves-rapidas/${chaveRapidaId}`);
    }

    next(erro);
  }
}

module.exports = {
  mostrarNova,
  criar,
  mostrarDetalhes,
  adicionarCompetidor,
  removerCompetidor,
  gerarChave,
  excluir,
};
