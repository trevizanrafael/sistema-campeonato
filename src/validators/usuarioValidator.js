const { cargoValido } = require('../config/permissoes');

function validarCargo(cargo, erros) {
  if (!cargo) {
    erros.push('O cargo é obrigatório.');
  } else if (!cargoValido(String(cargo).trim().toUpperCase())) {
    erros.push('Cargo inválido.');
  }
}

function validarCriacao(dados) {
  const erros = [];
  const nome = (dados.nome || '').trim();
  const email = (dados.email || '').trim();
  const senha = dados.senha || '';
  const confirmarSenha = dados.confirmar_senha || '';

  if (!nome) {
    erros.push('O nome é obrigatório.');
  } else if (nome.length < 2) {
    erros.push('O nome deve ter pelo menos 2 caracteres.');
  } else if (nome.length > 150) {
    erros.push('O nome deve ter no máximo 150 caracteres.');
  }

  if (!email) {
    erros.push('O e-mail é obrigatório.');
  } else if (email.length > 255) {
    erros.push('O e-mail deve ter no máximo 255 caracteres.');
  }

  if (!senha) {
    erros.push('A senha é obrigatória.');
  }

  if (senha && senha !== confirmarSenha) {
    erros.push('A confirmação de senha não confere.');
  }

  validarCargo(dados.cargo, erros);

  return erros;
}

function validarEdicao(dados) {
  const erros = [];
  const nome = (dados.nome || '').trim();
  const email = (dados.email || '').trim();

  if (!nome) {
    erros.push('O nome é obrigatório.');
  } else if (nome.length < 2) {
    erros.push('O nome deve ter pelo menos 2 caracteres.');
  } else if (nome.length > 150) {
    erros.push('O nome deve ter no máximo 150 caracteres.');
  }

  if (!email) {
    erros.push('O e-mail é obrigatório.');
  } else if (email.length > 255) {
    erros.push('O e-mail deve ter no máximo 255 caracteres.');
  }

  validarCargo(dados.cargo, erros);

  return erros;
}

function validarSenha(dados) {
  const erros = [];
  const senha = dados.senha || '';
  const confirmarSenha = dados.confirmar_senha || '';

  if (!senha) {
    erros.push('A nova senha é obrigatória.');
  }

  if (senha && senha !== confirmarSenha) {
    erros.push('A confirmação de senha não confere.');
  }

  return erros;
}

module.exports = {
  validarCriacao,
  validarEdicao,
  validarSenha,
};
