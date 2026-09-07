const pool = require('../config/database');
const eventoRepository = require('../repositories/eventoRepository');
const regraPontuacaoRepository = require('../repositories/regraPontuacaoRepository');
const {
  normalizarEvento,
  validarEvento,
  validarId,
} = require('../validators/eventoValidator');
const {
  NotFoundError,
  ValidationError,
  BusinessRuleError,
} = require('../utils/errors');

async function listarEventos({ busca = '', pagina = 1, limite = 10 } = {}) {
  const buscaLimpa = typeof busca === 'string' ? busca.trim() : '';
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const limiteNum = Math.max(1, parseInt(limite, 10) || 10);
  const offset = (paginaNum - 1) * limiteNum;

  const total = await eventoRepository.contar({ busca: buscaLimpa });
  const eventos = await eventoRepository.listar({
    busca: buscaLimpa,
    limite: limiteNum,
    offset,
  });

  const totalPaginas = Math.ceil(total / limiteNum) || 1;

  return {
    eventos,
    busca: buscaLimpa,
    paginaAtual: paginaNum,
    totalPaginas,
    totalRegistros: total,
    limite: limiteNum,
  };
}

async function buscarEvento(id) {
  const validId = validarId(id);
  const evento = await eventoRepository.buscarPorId(validId);
  if (!evento) {
    throw new NotFoundError('Evento não encontrado.');
  }
  return evento;
}

async function buscarEventoComResumo(id) {
  const validId = validarId(id);
  const evento = await eventoRepository.buscarComResumo(validId);
  if (!evento) {
    throw new NotFoundError('Evento não encontrado.');
  }
  return evento;
}

async function criarEvento(dados) {
  const normalizado = normalizarEvento(dados);
  const erros = validarEvento(normalizado);

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const evento = await eventoRepository.criar(normalizado, client);
    await regraPontuacaoRepository.criarPadrao(evento.id, client);

    await client.query('COMMIT');
    return evento;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

async function editarEvento(id, dados) {
  const validId = validarId(id);
  await buscarEvento(validId);

  const normalizado = normalizarEvento(dados);
  const erros = validarEvento(normalizado);

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  return eventoRepository.atualizar(validId, normalizado);
}

async function excluirEvento(id) {
  const validId = validarId(id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const bloqueado = await eventoRepository.bloquearPorId(validId, client);
    if (!bloqueado) {
      throw new NotFoundError('Evento não encontrado.');
    }

    const dependencias = await eventoRepository.contarDependencias(validId, client);
    const possuiDependencias =
      dependencias.total_categorias > 0 ||
      dependencias.total_inscricoes > 0 ||
      dependencias.total_pontos > 0;

    if (possuiDependencias) {
      throw new BusinessRuleError(
        'Este evento não pode ser excluído porque já possui categorias, inscrições ou resultados.'
      );
    }

    await eventoRepository.excluir(validId, client);
    await client.query('COMMIT');
    return true;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

module.exports = {
  listarEventos,
  buscarEvento,
  buscarEventoComResumo,
  criarEvento,
  editarEvento,
  excluirEvento,
};
