const bcrypt = require('bcrypt');
const usuarioRepository = require('../repositories/usuarioRepository');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');

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
  });
}

async function editarUsuario(id, dados) {
  const usuario = await usuarioRepository.buscarPorId(id);
  if (!usuario) {
    throw new NotFoundError('Usuário não encontrado.');
  }

  const email = dados.email.trim().toLowerCase();

  const duplicado = await usuarioRepository.emailJaExiste(email, id);
  if (duplicado) {
    throw new BusinessRuleError('Já existe outro usuário com este e-mail.');
  }

  return usuarioRepository.atualizar(id, {
    nome: dados.nome.trim(),
    email,
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
