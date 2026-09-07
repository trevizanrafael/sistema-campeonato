class ValidationError extends Error {
  constructor(erros = []) {
    super('Erro de validação');
    this.name = 'ValidationError';
    this.statusCode = 422;
    this.erros = erros;
  }
}

class AuthenticationError extends Error {
  constructor(mensagem = 'E-mail ou senha inválidos.') {
    super(mensagem);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class NotFoundError extends Error {
  constructor(mensagem = 'Recurso não encontrado.') {
    super(mensagem);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class BusinessRuleError extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'BusinessRuleError';
    this.statusCode = 409;
  }
}

module.exports = {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  BusinessRuleError,
  RegraNegocioError: BusinessRuleError,
};
