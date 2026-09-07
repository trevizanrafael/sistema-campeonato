const usuarioRepository = require('../repositories/usuarioRepository');

async function exigirAutenticacao(req, res, next) {
  try {
    const usuarioSessao = req.session.usuario;

    if (!usuarioSessao) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/login');
    }

    // Verificar se o usuário continua ativo no banco
    const usuario = await usuarioRepository.buscarPorId(usuarioSessao.id);

    if (!usuario || !usuario.ativo) {
      return req.session.destroy(() => {
        res.clearCookie('lutas.sid');
        return res.redirect('/login');
      });
    }

    // Disponibilizar dados atualizados do banco
    res.locals.usuarioLogado = usuario;
    next();
  } catch (erro) {
    next(erro);
  }
}

function exigirVisitante(req, res, next) {
  if (req.session.usuario) {
    return res.redirect('/');
  }
  next();
}

function carregarUsuarioLocal(req, res, next) {
  res.locals.usuarioLogado = req.session.usuario || null;
  next();
}

module.exports = {
  exigirAutenticacao,
  exigirVisitante,
  carregarUsuarioLocal,
};
