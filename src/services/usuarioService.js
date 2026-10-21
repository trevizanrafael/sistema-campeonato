const bcrypt = require('bcrypt');
const usuarioRepository = require('../repositories/usuarioRepository');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const { CARGOS, cargoValido } = require('../config/permissoes');

function normalizarCargo(cargo) {
  const valor = String(cargo || '').trim().toUpperCase();
  if (!cargoValido(valor)) {
    throw new BusinessRuleError('Cargo inválido.');
  }
  return valor;
}

async function listarUsuarios() {
  return usuarioRepository.listarTodos();
}

async function buscarUsuario(id) {
  const usuario = await usuarioRepository.buscarPorId(id);
  if (!usuario) {
    throw new NotFoundError('Usuário não encontrado.');
  }
  return usuario;
}

async function criarUsuario(dados) {
  const email = dados.email.trim().toLowerCase();

  const existente = await usuarioRepository.emailJaExiste(email);
  if (existente) {
    throw new BusinessRuleError('Já existe um usuário com este e-mail.');
  }

  const senhaHash = await bcrypt.hash(dados.senha, 12);

  return usuarioRepository.criar({
    nome: dados.nome.trim(),
    email,
    senhaHash,
    cargo: normalizarCargo(dados.cargo),
  });
}

async function editarUsuario(id, dados, usuarioLogadoId) {
  const usuario = await usuarioRepository.buscarPorId(id);
  if (!usuario) {
    throw new NotFoundError('Usuário não encontrado.');
  }

  const email = dados.email.trim().toLowerCase();
  const cargo = normalizarCargo(dados.cargo);

  const duplicado = await usuarioRepository.emailJaExiste(email, id);
  if (duplicado) {
    throw new BusinessRuleError('Já existe outro usuário com este e-mail.');
  }

  if (cargo !== usuario.cargo) {
    // Impedir que alguém rebaixe/altere o próprio cargo e perca o acesso
    if (String(id) === String(usuarioLogadoId)) {
      throw new BusinessRuleError('Você não pode alterar o seu próprio cargo.');
    }

    // Impedir que o sistema fique sem administrador ativo
    if (usuario.cargo === CARGOS.ADMINISTRADOR && usuario.ativo) {
      const totalAdmins = await usuarioRepository.contarAdministradoresAtivos();
      if (totalAdmins <= 1) {
        throw new BusinessRuleError(
          'Não é possível alterar o cargo. O sistema precisa de pelo menos um Administrador ativo.'
        );
      }
    }
  }

  return usuarioRepository.atualizar(id, {
    nome: dados.nome.trim(),
    email,
    cargo,
  });
}

async function alterarSenha(id, senha) {
  const usuario = await usuarioRepository.buscarPorId(id);
  if (!usuario) {
    throw new NotFoundError('Usuário não encontrado.');
  }

  const senhaHash = await bcrypt.hash(senha, 12);
  return usuarioRepository.atualizarSenha(id, senhaHash);
}

async function alterarStatus(id, ativo, usuarioLogadoId) {
  const usuario = await usuarioRepository.buscarPorId(id);
  if (!usuario) {
    throw new NotFoundError('Usuário não encontrado.');
  }

  // Impedir autodesativação
  if (!ativo && String(id) === String(usuarioLogadoId)) {
    throw new BusinessRuleError('Você não pode desativar sua própria conta.');
  }

  // Impedir que o sistema fique sem nenhum usuário ativo
  if (!ativo) {
    const totalAtivos = await usuarioRepository.contarAtivos();
    if (totalAtivos <= 1) {
      throw new BusinessRuleError(
        'Não é possível desativar. O sistema precisa de pelo menos um usuário ativo.'
      );
    }

    // Impedir que o sistema fique sem administrador ativo
    if (usuario.cargo === CARGOS.ADMINISTRADOR && usuario.ativo) {
      const totalAdmins = await usuarioRepository.contarAdministradoresAtivos();
      if (totalAdmins <= 1) {
        throw new BusinessRuleError(
          'Não é possível desativar. O sistema precisa de pelo menos um Administrador ativo.'
        );
      }
    }
  }

  return usuarioRepository.alterarStatus(id, ativo);
}

module.exports = {
  listarUsuarios,
  buscarUsuario,
  criarUsuario,
  editarUsuario,
  alterarSenha,
  alterarStatus,
};
