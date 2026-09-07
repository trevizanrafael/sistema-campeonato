function validarLogin(dados) {
  const erros = [];
  const email = (dados.email || '').trim();
  const senha = dados.senha || '';

  if (!email) {
    erros.push('O e-mail e obrigatorio.');
  }

  if (!senha) {
    erros.push('A senha e obrigatoria.');
  }

  return erros;
}

module.exports = {
  validarLogin,
};
