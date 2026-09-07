const pontuacaoService = require('../services/pontuacaoService');
const {
  ValidationError,
  BusinessRuleError,
  NotFoundError,
} = require('../utils/errors');

async function mostrar(req, res, next) {
  try {
    const { eventoId } = req.params;
    const resultado = await pontuacaoService.buscarConfiguracao(eventoId);

    return res.render('pontuacao/edit', {
      titulo: 'Configuração de pontuação',
      evento: resultado.evento,
      regra: resultado.regra,
      bloqueada: resultado.bloqueada,
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

async function atualizar(req, res, next) {
  const { eventoId } = req.params;

  try {
    await pontuacaoService.atualizarConfiguracao(eventoId, req.body);
    req.session.mensagemSucesso = 'Configuração de pontuação atualizada com sucesso.';
    return res.redirect(`/eventos/${eventoId}/pontuacao`);
  } catch (erro) {
    if (erro instanceof NotFoundError || erro.statusCode === 404) {
      return res.status(404).render('errors/404', {
        titulo: 'Página não encontrada',
      });
    }

    if (erro instanceof BusinessRuleError || erro.statusCode === 409) {
      req.session.mensagemErro = erro.message;
      return res.redirect(`/eventos/${eventoId}/pontuacao`);
    }

    if (erro instanceof ValidationError || erro.statusCode === 422) {
      try {
        const configAtual = await pontuacaoService.buscarConfiguracao(eventoId);
        return res.status(422).render('pontuacao/edit', {
          titulo: 'Configuração de pontuação',
          evento: configAtual.evento,
          regra: {
            ...req.body,
            bye_pontua:
              req.body.bye_pontua === '1' ||
              req.body.bye_pontua === 'on' ||
              req.body.bye_pontua === 'true' ||
              req.body.bye_pontua === true,
          },
          bloqueada: configAtual.bloqueada,
          erros: erro.erros || { geral: erro.message },
        });
      } catch (errInner) {
        return next(errInner);
      }
    }

    next(erro);
  }
}

module.exports = {
  mostrar,
  atualizar,
};
