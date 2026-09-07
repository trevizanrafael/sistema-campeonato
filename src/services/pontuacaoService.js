const pool = require('../config/database');
const regraPontuacaoRepository = require('../repositories/regraPontuacaoRepository');
const eventoRepository = require('../repositories/eventoRepository');
const {
  normalizarPontuacao,
  validarPontuacao,
  validarId,
} = require('../validators/pontuacaoValidator');
const {
  NotFoundError,
  ValidationError,
  BusinessRuleError,
} = require('../utils/errors');

async function validarEventoExistente(eventoId, client = pool) {
  const validId = validarId(eventoId);
  if (!validId) {
    throw new NotFoundError('Evento não encontrado.');
  }

  const evento = await eventoRepository.buscarPorId(validId, client);
  if (!evento) {
    throw new NotFoundError('Evento não encontrado.');
  }

  return evento;
}

async function buscarOuCriarPadrao(eventoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let regra = await regraPontuacaoRepository.buscarPorEvento(
      eventoId,
      client
    );

    if (!regra) {
      regra = await regraPontuacaoRepository.criarPadrao(eventoId, client);
    }

    await client.query('COMMIT');
    return regra;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

async function buscarConfiguracao(eventoId) {
  const evento = await validarEventoExistente(eventoId);
  const regra = await buscarOuCriarPadrao(evento.id);
  const bloqueada = await regraPontuacaoRepository.possuiLancamentos(evento.id);

  return {
    evento,
    regra,
    bloqueada,
  };
}

async function atualizarConfiguracao(eventoId, body) {
  const evento = await validarEventoExistente(eventoId);

  const dados = normalizarPontuacao(body);
  const erros = validarPontuacao(dados);

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let regra = await regraPontuacaoRepository.buscarPorEventoParaAtualizacao(
      evento.id,
      client
    );

    if (!regra) {
      regra = await regraPontuacaoRepository.criarPadrao(evento.id, client);
    }

    const possuiLancamentos = await regraPontuacaoRepository.possuiLancamentos(
      evento.id,
      client
    );

    if (possuiLancamentos) {
      throw new BusinessRuleError(
        'A pontuação não pode ser alterada porque o evento já possui lançamentos.'
      );
    }

    const atualizada = await regraPontuacaoRepository.atualizar(
      evento.id,
      dados,
      client
    );

    await client.query('COMMIT');
    return atualizada;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

module.exports = {
  buscarConfiguracao,
  atualizarConfiguracao,
};
