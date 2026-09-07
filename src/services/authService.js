const bcrypt = require('bcrypt');
const usuarioRepository = require('../repositories/usuarioRepository');

async function autenticar(email, senha) {
  const emailNormalizado = email.trim().toLowerCase();

  const usuario = await usuarioRepository.buscarPorEmail(emailNormalizado);

  if (!usuario) {
    return null;
  }

  if (!usuario.ativo) {
    return null;
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

  if (!senhaCorreta) {
    return null;
  }

  // Retorna apenas dados seguros para a sessão
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
  };
}

module.exports = {
  autenticar,
};
