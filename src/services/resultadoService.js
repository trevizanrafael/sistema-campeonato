const pool = require('../config/database');
const lutaRepository = require('../repositories/lutaRepository');
const pontoEquipeRepository = require('../repositories/pontoEquipeRepository');
const avancoService = require('./avancoService');
const pontuacaoLancamentoService = require('./pontuacaoLancamentoService');
const {
  normalizarResultado,
  validarResultado,
} = require('../validators/resultadoValidator');
const {
  NotFoundError,
  BusinessRuleError,
  ValidationError,
} = require('../utils/errors');

/**
 * Serviço responsável pelas operações, lançamento, correção e anulação de resultados de lutas.
 */

function validarCorrecao(luta, proximaLuta = null) {
  if (luta.chave_status !== 'EM_ANDAMENTO') {
    throw new BusinessRuleError('A chave não está disponível para correção.');
  }

  if (luta.status !== 'FINALIZADA') {
    throw new BusinessRuleError('A luta ainda não possui resultado.');
  }

  if (luta.tipo_resultado === 'BYE') {
    throw new BusinessRuleError('Um avanço por bye não pode ser corrigido individualmente.');
  }

  if (
    proximaLuta &&
    (proximaLuta.status === 'FINALIZADA' || proximaLuta.vencedor_id)
  ) {
    throw new BusinessRuleError(
      'Este resultado não pode ser alterado porque o vencedor já participou de uma luta posterior. Anule primeiro os resultados posteriores.'
    );
  }
}

async function buscarLutaParaResultado(eventoId, chaveId, lutaId) {
  const luta = await lutaRepository.buscarParaResultado(
    lutaId,
    chaveId,
    eventoId
  );

  if (!luta) {
    throw new NotFoundError('Luta não encontrada.');
  }

  if (luta.chave_status !== 'EM_ANDAMENTO') {
    throw new BusinessRuleError(
      'A chave precisa estar em andamento para lançar resultados.'
    );
  }

  if (luta.status === 'FINALIZADA') {
    throw new BusinessRuleError('Esta luta já foi finalizada.');
  }

  if (luta.status !== 'PRONTA') {
    throw new BusinessRuleError(
      'A luta ainda não está pronta para realização.'
    );
  }

  if (!luta.competidor_1_id || !luta.competidor_2_id) {
    throw new BusinessRuleError(
      'A luta precisa de dois competidores definidos para ter o resultado lançado.'
    );
  }

  if (luta.vencedor_id) {
    throw new BusinessRuleError('O vencedor desta luta já foi definido.');
  }

  return luta;
}

async function lancarResultado(eventoId, chaveId, lutaId, body) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Bloqueia a linha da luta no banco de dados para evitar condições de corrida (double click)
    const luta = await lutaRepository.buscarParaResultado(
      lutaId,
      chaveId,
      eventoId,
      client,
      true
    );

    if (!luta) {
      throw new NotFoundError('Luta não encontrada.');
    }

    if (luta.chave_status !== 'EM_ANDAMENTO') {
      throw new BusinessRuleError(
        'A chave precisa estar em andamento para lançar resultados.'
      );
    }

    if (luta.status === 'FINALIZADA') {
      throw new BusinessRuleError('Esta luta já foi finalizada.');
    }

    if (luta.status !== 'PRONTA') {
      throw new BusinessRuleError(
        'A luta ainda não está pronta para realização.'
      );
    }

    if (!luta.competidor_1_id || !luta.competidor_2_id) {
      throw new BusinessRuleError(
        'A luta precisa de dois competidores definidos para ter o resultado lançado.'
      );
    }

    if (luta.vencedor_id) {
      throw new BusinessRuleError('O vencedor desta luta já foi definido.');
    }

    // 2. Normalização e validação dos dados submetidos
    const dados = normalizarResultado(body);
    const erros = validarResultado(dados, luta);

    if (Object.keys(erros).length > 0) {
      throw new ValidationError(erros);
    }

    // 3. O perdedor é calculado automaticamente pelo backend
    const perdedorId =
      dados.vencedor_id === Number(luta.competidor_1_id)
        ? Number(luta.competidor_2_id)
        : Number(luta.competidor_1_id);

    // 4. Finalizar a luta
    const lutaFinalizada = await lutaRepository.finalizar(
      luta.id,
      {
        vencedor_id: dados.vencedor_id,
        perdedor_id: perdedorId,
        tipo_resultado: dados.tipo_resultado,
        placar_1: dados.placar_1,
        placar_2: dados.placar_2,
        observacao: dados.observacao,
      },
      client
    );

    // 5. Avançar o vencedor para a próxima luta (se houver)
    if (luta.proxima_luta_id) {
      await avancoService.avancarVencedor(luta, dados.vencedor_id, client);
    }

    // 6. Registrar a pontuação da equipe (se regra do evento pontuar vitórias)
    await pontuacaoLancamentoService.registrarVitoria(
      eventoId,
      luta,
      dados.vencedor_id,
      client
    );

    await client.query('COMMIT');

    return {
      luta: lutaFinalizada,
      proximaLutaId: luta.proxima_luta_id,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function buscarParaEdicao(eventoId, chaveId, lutaId) {
  const luta = await lutaRepository.buscarParaCorrecao(
    lutaId,
    chaveId,
    eventoId
  );

  if (!luta) {
    throw new NotFoundError('Luta não encontrada.');
  }

  const proximaInfo = luta.proxima_luta_id
    ? {
        status: luta.proxima_luta_status,
        vencedor_id: luta.proxima_luta_vencedor_id,
      }
    : null;

  validarCorrecao(luta, proximaInfo);

  return luta;
}

async function corrigirResultado(eventoId, chaveId, lutaId, body) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Bloqueia a luta atual
    const luta = await lutaRepository.buscarParaCorrecao(
      lutaId,
      chaveId,
      eventoId,
      client,
      true
    );

    if (!luta) {
      throw new NotFoundError('Luta não encontrada.');
    }

    // 2. Se houver próxima luta, bloqueia a próxima luta
    let proximaLuta = null;
    if (luta.proxima_luta_id) {
      proximaLuta = await lutaRepository.buscarPorIdParaAtualizacao(
        luta.proxima_luta_id,
        client
      );
    }

    // 3. Validação de elegibilidade e ausência de resultado posterior
    validarCorrecao(luta, proximaLuta);

    // 4. Validação dos novos dados
    const dados = normalizarResultado(body);
    const erros = validarResultado(dados, luta);

    if (Object.keys(erros).length > 0) {
      throw new ValidationError(erros);
    }

    const perdedorId =
      dados.vencedor_id === Number(luta.competidor_1_id)
        ? Number(luta.competidor_2_id)
        : Number(luta.competidor_1_id);

    // 5. Remover pontos da vitória anterior
    await pontoEquipeRepository.excluirPontoVitoria(luta.id, client);

    // 6. Se houver próxima luta, remover vencedor antigo do slot
    if (proximaLuta) {
      await avancoService.removerVencedor(luta, luta.vencedor_id, client);
    }

    // 7. Atualizar luta com o novo resultado
    const lutaAtualizada = await lutaRepository.finalizar(
      luta.id,
      {
        vencedor_id: dados.vencedor_id,
        perdedor_id: perdedorId,
        tipo_resultado: dados.tipo_resultado,
        placar_1: dados.placar_1,
        placar_2: dados.placar_2,
        observacao: dados.observacao,
      },
      client
    );

    // 8. Se houver próxima luta, avançar o novo vencedor para a próxima luta
    if (proximaLuta) {
      await avancoService.avancarVencedor(luta, dados.vencedor_id, client);
    }

    // 9. Registrar pontos para a equipe do novo vencedor
    await pontuacaoLancamentoService.registrarVitoria(
      eventoId,
      luta,
      dados.vencedor_id,
      client
    );

    await client.query('COMMIT');

    return {
      luta: lutaAtualizada,
      proximaLutaId: luta.proxima_luta_id,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function anularResultado(eventoId, chaveId, lutaId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Bloqueia a luta atual
    const luta = await lutaRepository.buscarParaCorrecao(
      lutaId,
      chaveId,
      eventoId,
      client,
      true
    );

    if (!luta) {
      throw new NotFoundError('Luta não encontrada.');
    }

    // 2. Se houver próxima luta, bloqueia a próxima luta
    let proximaLuta = null;
    if (luta.proxima_luta_id) {
      proximaLuta = await lutaRepository.buscarPorIdParaAtualizacao(
        luta.proxima_luta_id,
        client
      );
    }

    // 3. Validação de elegibilidade e ausência de resultado posterior
    validarCorrecao(luta, proximaLuta);

    // 4. Remover pontos de vitória vinculados a esta luta
    await pontoEquipeRepository.excluirPontoVitoria(luta.id, client);

    // 5. Se houver próxima luta, remover vencedor antigo do slot e recalcular status
    if (proximaLuta) {
      await avancoService.removerVencedor(luta, luta.vencedor_id, client);
    }

    // 6. Limpar dados de resultado e voltar luta para PRONTA
    const lutaAnulada = await lutaRepository.anular(luta.id, client);

    await client.query('COMMIT');

    return {
      luta: lutaAnulada,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  buscarLutaParaResultado,
  lancarResultado,
  buscarParaEdicao,
  corrigirResultado,
  anularResultado,
};
