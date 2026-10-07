function flashMiddleware(req, res, next) {
  res.locals.mensagemSucesso = req.session.mensagemSucesso || null;
  res.locals.mensagemErro = req.session.mensagemErro || null;
  res.locals.mensagemAviso = req.session.mensagemAviso || null;
  delete req.session.mensagemSucesso;
  delete req.session.mensagemErro;
  delete req.session.mensagemAviso;
  next();
}

module.exports = flashMiddleware;
