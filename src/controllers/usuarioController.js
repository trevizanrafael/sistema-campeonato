const usuarioService = require('../services/usuarioService');
const { validarCriacao, validarEdicao, validarSenha } = require('../validators/usuarioValidator');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');

async function listar(req, res, next) {
  try {
    const usuarios = await usuarioService.listarUsuarios();
    return res.render('usuarios/index', {
      titulo: 'Usuarios',
      usuarios,
    });
  } catch (erro) {
    next(erro);
  }
}

function mostrarCadastro(req, res) {
  return res.render('usuarios/create', {
    titulo: 'Novo Usuario',
    dados: { nome: '', email: '', senha: '', confirmar_senha: '' },
    erros: [],
  });
}

async function cadastrar(req, res, next) {
  try {
    const { nome, email, senha, confirmar_senha } = req.body;

    const erros = validarCriacao({ nome, email, senha, confirmar_senha });
    if (erros.length > 0) {
      return res.status(422).render('usuarios/create', {
        titulo: 'Novo Usuario',
        dados: { nome: nome || '', email: email || '', senha: senha || '', confirmar_senha: confirmar_senha || '' },
        erros,
      });
    }

    await usuarioService.criarUsuario({ nome, email, senha });

    req.session.mensagemSucesso = 'Usuario cadastrado com sucesso.';
    return res.redirect('/usuarios');
  } catch (erro) {
    if (erro instanceof BusinessRuleError) {
      return res.status(422).render('usuarios/create', {
        titulo: 'Novo Usuario',
        dados: { nome: req.body.nome || '', email: req.body.email || '', senha: req.body.senha || '', confirmar_senha: req.body.confirmar_senha || '' },
        erros: [erro.message],
      });
    }
    next(erro);
  }
}

async function mostrarEdicao(req, res, next) {
  try {
    const usuario = await usuarioService.buscarUsuario(req.params.id);
    return res.render('usuarios/edit', {
      titulo: 'Editar Usuario',
      dados: { nome: usuario.nome, email: usuario.email },
      usuario,
      erros: [],
    });
  } catch (erro) {
    if (erro instanceof NotFoundError) {
      return res.status(404).render('errors/404', { titulo: 'Nao encontrado' });
    }
    next(erro);
  }
}

async function editar(req, res, next) {
  try {
    const { nome, email } = req.body;
    const id = req.params.id;

    const erros = validarEdicao({ nome, email });
    if (erros.length > 0) {
      const usuario = await usuarioService.buscarUsuario(id);
      return res.status(422).render('usuarios/edit', {
        titulo: 'Editar Usuario',
        dados: { nome: nome || '', email: email || '' },
        usuario,
        erros,
      });
    }

    await usuarioService.editarUsuario(id, { nome, email });

    req.session.mensagemSucesso = 'Usuario atualizado com sucesso.';
    return res.redirect('/usuarios');
  } catch (erro) {
    if (erro instanceof BusinessRuleError) {
      try {
        const usuario = await usuarioService.buscarUsuario(req.params.id);
        return res.status(422).render('usuarios/edit', {
          titulo: 'Editar Usuario',
          dados: { nome: req.body.nome || '', email: req.body.email || '' },
          usuario,
          erros: [erro.message],
        });
      } catch (e) {
        return next(e);
      }
    }
    if (erro instanceof NotFoundError) {
      return res.status(404).render('errors/404', { titulo: 'Nao encontrado' });
    }
    next(erro);
  }
}

function mostrarAlteracaoSenha(req, res, next) {
  usuarioService.buscarUsuario(req.params.id)
    .then((usuario) => {
      return res.render('usuarios/senha', {
        titulo: 'Alterar Senha',
        usuario,
        erros: [],
      });
    })
    .catch((erro) => {
      if (erro instanceof NotFoundError) {
        return res.status(404).render('errors/404', { titulo: 'Nao encontrado' });
      }
      next(erro);
    });
}

async function alterarSenha(req, res, next) {
  try {
    const { senha, confirmar_senha } = req.body;
    const id = req.params.id;

    const erros = validarSenha({ senha, confirmar_senha });
    if (erros.length > 0) {
      const usuario = await usuarioService.buscarUsuario(id);
      return res.status(422).render('usuarios/senha', {
        titulo: 'Alterar Senha',
        usuario,
        erros,
      });
    }

    await usuarioService.alterarSenha(id, senha);

    req.session.mensagemSucesso = 'Senha alterada com sucesso.';
    return res.redirect('/usuarios');
  } catch (erro) {
    if (erro instanceof NotFoundError) {
      return res.status(404).render('errors/404', { titulo: 'Nao encontrado' });
    }
    next(erro);
  }
}

async function ativar(req, res, next) {
  try {
    await usuarioService.alterarStatus(req.params.id, true, req.session.usuario.id);
    req.session.mensagemSucesso = 'Usuario ativado com sucesso.';
    return res.redirect('/usuarios');
  } catch (erro) {
    if (erro instanceof NotFoundError) {
      return res.status(404).render('errors/404', { titulo: 'Nao encontrado' });
    }
    if (erro instanceof BusinessRuleError) {
      req.session.mensagemErro = erro.message;
      return res.redirect('/usuarios');
    }
    next(erro);
  }
}

async function desativar(req, res, next) {
  try {
    await usuarioService.alterarStatus(req.params.id, false, req.session.usuario.id);
    req.session.mensagemSucesso = 'Usuario desativado com sucesso.';
    return res.redirect('/usuarios');
  } catch (erro) {
    if (erro instanceof NotFoundError) {
      return res.status(404).render('errors/404', { titulo: 'Nao encontrado' });
    }
    if (erro instanceof BusinessRuleError) {
      req.session.mensagemErro = erro.message;
      return res.redirect('/usuarios');
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
  mostrarAlteracaoSenha,
  alterarSenha,
  ativar,
  desativar,
};
