const pool = require('../config/database');
const chaveRepository = require('../repositories/chaveRepository');
const lutaRepository = require('../repositories/lutaRepository');
const pontoEquipeRepository = require('../repositories/pontoEquipeRepository');
const regraPontuacaoRepository = require('../repositories/regraPontuacaoRepository');
const { NotFoundError, RegraNegocioError } = require('../utils/errors');

/**
 * Serviço responsável pelo encerramento de categorias,
 * cálculo de pódio, prévia de pontuação e reabertura.
 */

async function calcularPodio(chave, finalLuta, client) {
  if (!finalLuta || !finalLuta.vencedor_id || !finalLuta.perdedor_id) {
    throw new RegraNegocioError(
      'A final precisa estar finalizada com vencedor e perdedor definidos.'
    );
  }

  const primeiro = {
    inscricao_id: finalLuta.vencedor_id,
    nome: finalLuta.vencedor_nome,
    equipe_id: finalLuta.vencedor_equipe_id,
    equipe_nome: finalLuta.vencedor_equipe_nome,
    pontos: 0,
  };

  const segundo = {
    inscricao_id: finalLuta.perdedor_id,
    nome: finalLuta.perdedor_nome,
    equipe_id: finalLuta.perdedor_equipe_id,
    equipe_nome: finalLuta.perdedor_equipe_nome,
    pontos: 0,
  };

  let terceiro = null;

  // Se a final for a primeira rodada (rodada = 1), a chave é de apenas 2 atletas -> sem terceiro lugar
  if (finalLuta.rodada > 1) {
    const rodadaSemifinal = finalLuta.rodada - 1;

    // 1. Procurar o perdedor da semifinal disputada pelo campeão
    const semiCampeao = await lutaRepository.buscarSemifinalDoCampeao(
      chave.id,
      rodadaSemifinal,
      finalLuta.vencedor_id,
      client
    );

    if (semiCampeao && semiCampeao.perdedor_id) {
      terceiro = {
        inscricao_id: semiCampeao.perdedor_id,
        nome: semiCampeao.perdedor_nome,
        equipe_id: semiCampeao.perdedor_equipe_id,
        equipe_nome: semiCampeao.perdedor_equipe_nome,
        pontos: 0,
      };
    } else {
      // 2. Fallback de BYE: se a semifinal do campeão foi BYE ou sem perdedor, busca a outra semifinal
      const outraSemi = await lutaRepository.buscarOutraSemifinalComPerdedor(
        chave.id,
        rodadaSemifinal,
        client
      );

      if (outraSemi && outraSemi.perdedor_id) {
        terceiro = {
          inscricao_id: outraSemi.perdedor_id,
          nome: outraSemi.perdedor_nome,
          equipe_id: outraSemi.perdedor_equipe_id,
          equipe_nome: outraSemi.perdedor_equipe_nome,
          pontos: 0,
        };
      }
    }
  }

  // Validação: primeiro e segundo não podem ser a mesma pessoa
  if (primeiro.inscricao_id === segundo.inscricao_id) {
    throw new RegraNegocioError(
      'Vencedor e perdedor da final não podem ser a mesma inscrição.'
    );
  }

  // Validação: terceiro não pode ser igual a primeiro ou segundo
  if (terceiro) {
    if (
      terceiro.inscricao_id === primeiro.inscricao_id ||
      terceiro.inscricao_id === segundo.inscricao_id
    ) {
      throw new RegraNegocioError(
        'O terceiro colocado não pode ser igual ao primeiro ou segundo colocado.'
      );
    }
  }

  // Buscar regras de pontuação do evento
  const regra = await regraPontuacaoRepository.buscarPorEvento(
    chave.evento_id,
    client
  );

  primeiro.pontos = regra ? regra.pontos_primeiro : 0;
  segundo.pontos = regra ? regra.pontos_segundo : 0;
  if (terceiro) {
    terceiro.pontos = regra ? regra.pontos_terceiro : 0;
  }

  return {
    primeiro,
    segundo,
    terceiro,
  };
}

async function calcularResumoEquipes(eventoId, podio, client) {
  const pontosAtuaisRows = await pontoEquipeRepository.buscarPontosAtuaisPorEvento(
    eventoId,
    client
  );

  const pontosAtuaisMap = new Map();
  for (const row of pontosAtuaisRows) {
    pontosAtuaisMap.set(String(row.equipe_id), parseInt(row.pontos_atuais, 10) || 0);
  }

  const mapaResumo = new Map();
  const colocados = [podio.primeiro, podio.segundo, podio.terceiro].filter(Boolean);

  for (const colocado of colocados) {
    if (!colocado.equipe_id) continue;

    const equipeKey = String(colocado.equipe_id);
    const atual = mapaResumo.get(equipeKey) || {
      equipe_id: colocado.equipe_id,
      equipe_nome: colocado.equipe_nome,
      pontos_atuais: pontosAtuaisMap.get(equipeKey) || 0,
      novos_pontos: 0,
      total_apos: 0,
    };

    atual.novos_pontos += colocado.pontos;
    atual.total_apos = atual.pontos_atuais + atual.novos_pontos;
    mapaResumo.set(equipeKey, atual);
  }

  return Array.from(mapaResumo.values());
}

async function calcularPreview(eventoId, chaveId) {
  const chave = await chaveRepository.buscarPorIdNoEvento(chaveId, eventoId);
  if (!chave) {
    throw new NotFoundError('Chave não encontrada.');
  }

  if (chave.status !== 'EM_ANDAMENTO') {
    if (chave.status === 'FINALIZADA') {
      throw new RegraNegocioError('Esta categoria já foi finalizada.');
    }
    throw new RegraNegocioError(
      'A chave precisa estar em andamento para ser finalizada.'
    );
  }

  const pendentes = await lutaRepository.contarLutasNaoFinalizadas(chaveId);
  if (pendentes > 0) {
    throw new RegraNegocioError(
      'A categoria não pode ser finalizada porque ainda possui lutas pendentes.'
    );
  }

  const finalLuta = await lutaRepository.buscarFinal(chaveId);
  if (
    !finalLuta ||
    finalLuta.status !== 'FINALIZADA' ||
    !finalLuta.vencedor_id ||
    !finalLuta.perdedor_id
  ) {
    throw new RegraNegocioError(
      'A luta final ainda não possui resultado finalizado.'
    );
  }

  const podio = await calcularPodio(chave, finalLuta);
  const resumoEquipes = await calcularResumoEquipes(eventoId, podio);

  return {
    evento: {
      id: chave.evento_id,
      nome: chave.evento_nome || 'Evento',
    },
    categoria: {
      id: chave.categoria_id,
      nome: chave.categoria_nome,
    },
    chave,
    podio,
    resumoEquipes,
  };
}

async function finalizarCategoria(eventoId, chaveId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Bloquear chave
    const chave = await chaveRepository.bloquearPorIdNoEvento(
      chaveId,
      eventoId,
      client
    );
    if (!chave) {
      throw new NotFoundError('Chave não encontrada.');
    }

    if (chave.status !== 'EM_ANDAMENTO') {
      throw new RegraNegocioError(
        'Esta categoria já foi finalizada ou não está em andamento.'
      );
    }

    // 2. Bloquear lutas
    await lutaRepository.bloquearTodasPorChave(chaveId, client);

    // 3. Confirmar ausência de pendências
    const pendentes = await lutaRepository.contarLutasNaoFinalizadas(
      chaveId,
      client
    );
    if (pendentes > 0) {
      throw new RegraNegocioError(
        'A categoria não pode ser finalizada porque ainda possui lutas pendentes.'
      );
    }

    // 4. Localizar a final
    const finalLuta = await lutaRepository.buscarFinal(chaveId, client);
    if (
      !finalLuta ||
      finalLuta.status !== 'FINALIZADA' ||
      !finalLuta.vencedor_id ||
      !finalLuta.perdedor_id
    ) {
      throw new RegraNegocioError(
        'A luta final ainda não possui resultado finalizado.'
      );
    }

    // 5. Recalcular pódio dentro da transação
    const podio = await calcularPodio(chave, finalLuta, client);

    // 6. Criar pontos de colocação se pontos > 0
    if (podio.primeiro.pontos > 0) {
      await pontoEquipeRepository.criarPontoColocacao(
        {
          evento_id: eventoId,
          equipe_id: podio.primeiro.equipe_id,
          inscricao_id: podio.primeiro.inscricao_id,
          chave_id: chaveId,
          tipo: 'PRIMEIRO_LUGAR',
          pontos: podio.primeiro.pontos,
          descricao: `Primeiro lugar de ${podio.primeiro.nome} na categoria ${chave.categoria_nome}.`,
        },
        client
      );
    }

    if (podio.segundo.pontos > 0) {
      await pontoEquipeRepository.criarPontoColocacao(
        {
          evento_id: eventoId,
          equipe_id: podio.segundo.equipe_id,
          inscricao_id: podio.segundo.inscricao_id,
          chave_id: chaveId,
          tipo: 'SEGUNDO_LUGAR',
          pontos: podio.segundo.pontos,
          descricao: `Segundo lugar de ${podio.segundo.nome} na categoria ${chave.categoria_nome}.`,
        },
        client
      );
    }

    if (podio.terceiro && podio.terceiro.pontos > 0) {
      await pontoEquipeRepository.criarPontoColocacao(
        {
          evento_id: eventoId,
          equipe_id: podio.terceiro.equipe_id,
          inscricao_id: podio.terceiro.inscricao_id,
          chave_id: chaveId,
          tipo: 'TERCEIRO_LUGAR',
          pontos: podio.terceiro.pontos,
          descricao: `Terceiro lugar de ${podio.terceiro.nome} na categoria ${chave.categoria_nome}.`,
        },
        client
      );
    }

    // 7. Salvar pódio e alterar status para FINALIZADA
    const chaveFinalizada = await chaveRepository.salvarPodio(
      chaveId,
      {
        primeiro_lugar_id: podio.primeiro.inscricao_id,
        segundo_lugar_id: podio.segundo.inscricao_id,
        terceiro_lugar_id: podio.terceiro ? podio.terceiro.inscricao_id : null,
      },
      client
    );

    await client.query('COMMIT');
    return { chave: chaveFinalizada, podio };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function reabrirCategoria(eventoId, chaveId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Bloquear chave
    const chave = await chaveRepository.bloquearPorIdNoEvento(
      chaveId,
      eventoId,
      client
    );
    if (!chave) {
      throw new NotFoundError('Chave não encontrada.');
    }

    if (chave.status !== 'FINALIZADA') {
      throw new RegraNegocioError(
        'Apenas categorias finalizadas podem ser reabertas.'
      );
    }

    // 2. Excluir pontos de colocação (PRIMEIRO_LUGAR, SEGUNDO_LUGAR, TERCEIRO_LUGAR)
    await pontoEquipeRepository.excluirPontosColocacaoPorChave(chaveId, client);

    // 3. Limpar pódio e reverter status para EM_ANDAMENTO
    const chaveReaberta = await chaveRepository.limparPodioEReabrir(
      chaveId,
      client
    );

    await client.query('COMMIT');
    return { chave: chaveReaberta };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  calcularPodio,
  calcularResumoEquipes,
  calcularPreview,
  finalizarCategoria,
  reabrirCategoria,
};
