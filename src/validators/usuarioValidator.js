function validarCriacao(dados) {
  const erros = [];
  const nome = (dados.nome || '').trim();
  const email = (dados.email || '').trim();
  const senha = dados.senha || '';
  const confirmarSenha = dados.confirmar_senha || '';

  if (!nome) {
    erros.push('O nome e obrigatorio.');
  } else if (nome.length < 2) {
    erros.push('O nome deve ter pelo menos 2 caracteres.');
  } else if (nome.length > 150) {
    erros.push('O nome deve ter no maximo 150 caracteres.');
  }

  if (!email) {
    erros.push('O e-mail e obrigatorio.');
  } else if (email.length > 255) {
    erros.push('O e-mail deve ter no maximo 255 caracteres.');
  }

  if (!senha) {
    erros.push('A senha e obrigatoria.');
  }

  if (senha && senha !== confirmarSenha) {
    erros.push('A confirmacao de senha nao confere.');
  }

  return erros;
}

function validarEdicao(dados) {
  const erros = [];
  const nome = (dados.nome || '').trim();
  const email = (dados.email || '').trim();

  if (!nome) {
    erros.push('O nome e obrigatorio.');
  } else if (nome.length < 2) {
    erros.push('O nome deve ter pelo menos 2 caracteres.');
  } else if (nome.length > 150) {
    erros.push('O nome deve ter no maximo 150 caracteres.');
  }

  if (!email) {
    erros.push('O e-mail e obrigatorio.');
  } else if (email.length > 255) {
    erros.push('O e-mail deve ter no maximo 255 caracteres.');
  }

  return erros;
}

function validarSenha(dados) {
  const erros = [];
  const senha = dados.senha || '';
  const confirmarSenha = dados.confirmar_senha || '';

  if (!senha) {
    erros.push('A nova senha e obrigatoria.');
  }

  if (senha && senha !== confirmarSenha) {
    erros.push('A confirmacao de senha nao confere.');
  }

  return erros;
}

module.exports = {
  validarCriacao,
  validarEdicao,
  validarSenha,
};
