const { temPermissao, nomeCargo, CARGOS_INFO } = require('../config/permissoes');

function carregarDadosDasViews(req, res, next) {
  res.locals.usuarioLogado =
    req.session && req.session.usuario ? req.session.usuario : null;

  res.locals.currentPath = req.path;

  res.locals.titulo = null;
  res.locals.subtitulo = null;

  res.locals.mensagemSucesso =
    res.locals.mensagemSucesso || null;

  res.locals.mensagemErro =
    res.locals.mensagemErro || null;

  res.locals.formatarData = (data) => {
    if (!data) {
      return '';
    }
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(data));
  };

  const formatters = require('../utils/formatters');
  res.locals.formatarIntervaloIdade = formatters.formatarIntervaloIdade;
  res.locals.formatarIntervaloPeso = formatters.formatarIntervaloPeso;
  res.locals.formatarIntervaloFaixa = formatters.formatarIntervaloFaixa;
  res.locals.formatarSexo = formatters.formatarSexo;

  // Permissões por cargo — lê res.locals.usuarioLogado no momento da renderização,
  // pois exigirAutenticacao o substitui pela versão atualizada do banco.
  res.locals.pode = (permissao) => {
    const usuario = res.locals.usuarioLogado;
    return Boolean(usuario && temPermissao(usuario.cargo, permissao));
  };
  res.locals.nomeCargo = nomeCargo;
  res.locals.CARGOS_INFO = CARGOS_INFO;

  next();
}

module.exports = {
  carregarDadosDasViews,
};
