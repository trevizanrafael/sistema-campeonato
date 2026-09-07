const equipeRepository = require('../repositories/equipeRepository');
const {
  normalizarNomeEquipe,
  validarEquipe,
  validarId,
} = require('../validators/equipeValidator');
const {
  NotFoundError,
  ValidationError,
  BusinessRuleError,
} = require('../utils/errors');

async function listarEquipes() {
  return equipeRepository.listarTodas();
}

async function buscarEquipe(id) {
  const validId = validarId(id);
  const equipe = await equipeRepository.buscarPorId(validId);
  if (!equipe) {
    throw new NotFoundError('Equipe não encontrada.');
  }
  return equipe;
}

async function criarEquipe(dados) {
  const nomeNormalizado = normalizarNomeEquipe(dados.nome);
  const erros = validarEquipe({ nome: nomeNormalizado });

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  const existente = await equipeRepository.buscarPorNome(nomeNormalizado);
  if (existente) {
    throw new BusinessRuleError('Já existe uma equipe com este nome.');
  }

  return equipeRepository.criar(nomeNormalizado);
}

async function editarEquipe(id, dados) {
  const validId = validarId(id);
  await buscarEquipe(validId);

  const nomeNormalizado = normalizarNomeEquipe(dados.nome);
  const erros = validarEquipe({ nome: nomeNormalizado });

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  const existente = await equipeRepository.buscarPorNome(nomeNormalizado, validId);
  if (existente) {
    throw new BusinessRuleError('Já existe uma equipe com este nome.');
  }

  return equipeRepository.atualizar(validId, nomeNormalizado);
}

async function excluirEquipe(id) {
  const validId = validarId(id);
  const equipe = await buscarEquipe(validId);

  const totalInscricoes = await equipeRepository.contarInscricoes(validId);
  if (totalInscricoes > 0) {
    throw new BusinessRuleError(
      'Esta equipe não pode ser excluída porque possui inscrições vinculadas.'
    );
  }

  await equipeRepository.excluir(validId);
  return equipe;
}

module.exports = {
  listarEquipes,
  buscarEquipe,
  criarEquipe,
  editarEquipe,
  excluirEquipe,
};
