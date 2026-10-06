const usuarioRepository = require('../repositories/usuarioRepository');
const { temPermissao, nomeCargo } = require('../config/permissoes');

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

/**
 * Bloqueia a rota caso o cargo do usuário não possua a permissão informada.
 * Deve ser usado DEPOIS de exigirAutenticacao (depende de res.locals.usuarioLogado).
 */
function exigirPermissao(permissao) {
  return function verificarPermissao(req, res, next) {
    const usuario = res.locals.usuarioLogado;

    if (!usuario) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/login');
    }

    if (!temPermissao(usuario.cargo, permissao)) {
      return res.status(403).render('errors/403', {
        titulo: 'Acesso não permitido',
        mensagem: `Seu cargo (${nomeCargo(usuario.cargo)}) não tem acesso a esta área.`,
      });
    }

    next();
  };
}

/**
 * Memoriza o último campeonato aberto pelo usuário (atalho da tela inicial).
 * Só grava no banco quando o evento muda, para não gerar escrita a cada clique.
 */
function registrarUltimoEvento(req, res, next) {
  const usuario = res.locals.usuarioLogado;
  const eventoId = req.params.eventoId || req.params.id;

  if (!usuario || !eventoId || !/^\d+$/.test(String(eventoId))) {
    return next();
  }

  if (String(usuario.ultimo_evento_id) === String(eventoId)) {
    return next();
  }

  usuario.ultimo_evento_id = eventoId;
  usuarioRepository
    .atualizarUltimoEvento(usuario.id, eventoId)
    .catch(() => {
      // Evento inexistente (FK) ou falha pontual: não interrompe a navegação
    });

  next();
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
  exigirPermissao,
  registrarUltimoEvento,
  exigirVisitante,
  carregarUsuarioLocal,
};
