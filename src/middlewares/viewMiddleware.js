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

  next();
}

module.exports = {
  carregarDadosDasViews,
};
