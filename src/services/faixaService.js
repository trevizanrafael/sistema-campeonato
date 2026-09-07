const pool = require('../config/database');
const faixaRepository = require('../repositories/faixaRepository');
const {
  normalizarNomeFaixa,
  validarFaixa,
  validarId,
} = require('../validators/faixaValidator');
const {
  NotFoundError,
  ValidationError,
  BusinessRuleError,
} = require('../utils/errors');

async function listarFaixas() {
  return faixaRepository.listarTodas();
}

async function buscarFaixa(id) {
  const validId = validarId(id);
  const faixa = await faixaRepository.buscarPorId(validId);
  if (!faixa) {
    throw new NotFoundError('Faixa não encontrada.');
  }
  return faixa;
}

async function criarFaixa(dados) {
  const nomeNormalizado = normalizarNomeFaixa(dados.nome);
  const erros = validarFaixa({ nome: nomeNormalizado });

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE faixas IN SHARE ROW EXCLUSIVE MODE');

    const existente = await faixaRepository.buscarPorNome(nomeNormalizado, null, client);
    if (existente) {
      throw new BusinessRuleError('Já existe uma faixa com este nome.');
    }

    const proximaOrdem = await faixaRepository.buscarProximaOrdem(client);

    const faixa = await faixaRepository.criar(
      {
        nome: nomeNormalizado,
        ordem: proximaOrdem,
      },
      client
    );

    await client.query('COMMIT');
    return faixa;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

async function editarFaixa(id, dados) {
  const validId = validarId(id);
  await buscarFaixa(validId);

  const nomeNormalizado = normalizarNomeFaixa(dados.nome);
  const erros = validarFaixa({ nome: nomeNormalizado });

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  const existente = await faixaRepository.buscarPorNome(nomeNormalizado, validId);
  if (existente) {
    throw new BusinessRuleError('Já existe uma faixa com este nome.');
  }

  return faixaRepository.atualizar(validId, { nome: nomeNormalizado });
}

async function subirFaixa(id) {
  const validId = validarId(id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE faixas IN SHARE ROW EXCLUSIVE MODE');

    const faixa = await faixaRepository.buscarPorId(validId, client);
    if (!faixa) {
      throw new NotFoundError('Faixa não encontrada.');
    }

    const anterior = await faixaRepository.buscarAnterior(faixa.ordem, client);
    if (!anterior) {
      await client.query('COMMIT');
      return faixa;
    }

    const ordemTemporaria = await faixaRepository.buscarProximaOrdem(client);

    await faixaRepository.alterarOrdem(faixa.id, ordemTemporaria, client);
    await faixaRepository.alterarOrdem(anterior.id, faixa.ordem, client);
    await faixaRepository.alterarOrdem(faixa.id, anterior.ordem, client);

    await client.query('COMMIT');
    return faixa;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

async function descerFaixa(id) {
  const validId = validarId(id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE faixas IN SHARE ROW EXCLUSIVE MODE');

    const faixa = await faixaRepository.buscarPorId(validId, client);
    if (!faixa) {
      throw new NotFoundError('Faixa não encontrada.');
    }

    const proxima = await faixaRepository.buscarProxima(faixa.ordem, client);
    if (!proxima) {
      await client.query('COMMIT');
      return faixa;
    }

    const ordemTemporaria = await faixaRepository.buscarProximaOrdem(client);

    await faixaRepository.alterarOrdem(faixa.id, ordemTemporaria, client);
    await faixaRepository.alterarOrdem(proxima.id, faixa.ordem, client);
    await faixaRepository.alterarOrdem(faixa.id, proxima.ordem, client);

    await client.query('COMMIT');
    return faixa;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

async function excluirFaixa(id) {
  const validId = validarId(id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const faixa = await faixaRepository.buscarPorIdParaAtualizacao(validId, client);
    if (!faixa) {
      throw new NotFoundError('Faixa não encontrada.');
    }

    const dependencias = await faixaRepository.contarDependencias(validId, client);
    if (
      dependencias.total_como_minima > 0 ||
      dependencias.total_como_maxima > 0 ||
      dependencias.total_inscricoes > 0
    ) {
      throw new BusinessRuleError(
        'Esta faixa está sendo utilizada e não pode ser excluída.'
      );
    }

    await faixaRepository.excluir(validId, client);
    await client.query('COMMIT');
    return faixa;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

module.exports = {
  listarFaixas,
  buscarFaixa,
  criarFaixa,
  editarFaixa,
  subirFaixa,
  descerFaixa,
  excluirFaixa,
};
