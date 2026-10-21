function validarLogin(dados) {
  const erros = [];
  const email = (dados.email || '').trim();
  const senha = dados.senha || '';

  if (!email) {
    erros.push('O e-mail é obrigatório.');
  }

  if (!senha) {
    erros.push('A senha é obrigatória.');
  }

  return erros;
}

module.exports = {
  validarLogin,
};
