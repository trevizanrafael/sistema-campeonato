const authService = require('../services/authService');
const { validarLogin } = require('../validators/authValidator');

function mostrarLogin(req, res) {
  return res.render('auth/login', {
    layout: false,
    titulo: 'Entrar',
    email: '',
    erros: [],
  });
}

async function entrar(req, res, next) {
  try {
    const { email, senha } = req.body;

    // Validar campos
    const erros = validarLogin({ email, senha });
    if (erros.length > 0) {
      return res.status(422).render('auth/login', {
        layout: false,
        titulo: 'Entrar',
        email: email || '',
        erros,
      });
    }

    // Autenticar
    const usuario = await authService.autenticar(email, senha);

    if (!usuario) {
      return res.status(401).render('auth/login', {
        layout: false,
        titulo: 'Entrar',
        email: email || '',
        erros: ['E-mail ou senha inválidos.'],
      });
    }

    // Captura returnTo antes de regenerar
    const returnTo = req.session.returnTo || '/';

    // Regenerar sessão para prevenir fixação
    req.session.regenerate((erro) => {
      if (erro) {
        return next(erro);
      }

      req.session.usuario = usuario;
      req.session.save((erroSalvar) => {
        if (erroSalvar) {
          return next(erroSalvar);
        }

        // Valida que returnTo é rota interna
        const destino = (returnTo && returnTo.startsWith('/')) ? returnTo : '/';
        return res.redirect(destino);
      });
    });
  } catch (erro) {
    next(erro);
  }
}

function sair(req, res, next) {
  req.session.destroy((erro) => {
    if (erro) {
      return next(erro);
    }
    res.clearCookie('lutas.sid');
    return res.redirect('/login');
  });
}

module.exports = {
  mostrarLogin,
  entrar,
  sair,
};
