const pool = require('../config/database');
const chaveRepository = require('../repositories/chaveRepository');
const lutaRepository = require('../repositories/lutaRepository');
const pontoEquipeRepository = require('../repositories/pontoEquipeRepository');
const regraPontuacaoRepository = require('../repositories/regraPontuacaoRepository');
const { NotFoundError, RegraNegocioError } = require('../utils/errors');
const auditoriaService = require('./auditoriaService');

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

async function calcularResumoEquipes(eventoId, chaveIdOrPodio, podioOrClient, maybeClient) {
  let chaveId = null;
  let podio = null;
  let client = null;

  if (chaveIdOrPodio && typeof chaveIdOrPodio === 'object' && chaveIdOrPodio.primeiro) {
    // Assinatura de compatibilidade: (eventoId, podio, client)
    podio = chaveIdOrPodio;
    client = podioOrClient;
  } else {
    // Assinatura completa: (eventoId, chaveId, podio, client)
    chaveId = chaveIdOrPodio;
    podio = podioOrClient;
    client = maybeClient;
  }

  // 1. Pontos anteriores das equipes (fora desta chave)
  const pontosAtuaisRows = await pontoEquipeRepository.buscarPontosAtuaisPorEvento(
    eventoId,
    chaveId,
    client
  );

  const pontosAtuaisMap = new Map();
  for (const row of pontosAtuaisRows) {
    pontosAtuaisMap.set(String(row.equipe_id), parseInt(row.pontos_atuais, 10) || 0);
  }

  // 2. Pontos de vitória conquistados nesta chave
  const pontosVitoriasMap = new Map();
  const nomesEquipesMap = new Map();
  if (chaveId) {
    const vitoriasRows = await pontoEquipeRepository.buscarPontosVitoriaPorChave(
      chaveId,
      client
    );
    for (const row of vitoriasRows) {
      const key = String(row.equipe_id);
      pontosVitoriasMap.set(key, parseInt(row.pontos_vitorias, 10) || 0);
      nomesEquipesMap.set(key, row.equipe_nome);
    }
  }

  // 3. Pontos de colocação do pódio previsto
  const pontosPodioMap = new Map();
  const colocados = podio ? [podio.primeiro, podio.segundo, podio.terceiro].filter(Boolean) : [];
  for (const colocado of colocados) {
    if (!colocado.equipe_id) continue;
    const key = String(colocado.equipe_id);
    pontosPodioMap.set(key, (pontosPodioMap.get(key) || 0) + (Number(colocado.pontos) || 0));
    if (colocado.equipe_nome) {
      nomesEquipesMap.set(key, colocado.equipe_nome);
    }
  }

  // 4. Reunir todas as equipes envolvidas (que pontuaram nesta chave ou estão no pódio)
  const todasEquipesKeys = new Set([
    ...pontosVitoriasMap.keys(),
    ...pontosPodioMap.keys(),
  ]);

  const listaResumo = [];
  for (const key of todasEquipesKeys) {
    const pontos_anteriores = pontosAtuaisMap.get(key) || 0;
    const pontos_vitorias = pontosVitoriasMap.get(key) || 0;
    const pontos_colocacao = pontosPodioMap.get(key) || 0;
    const novos_pontos = pontos_vitorias + pontos_colocacao;
    const total_apos = pontos_anteriores + novos_pontos;

    listaResumo.push({
      equipe_id: Number(key),
      equipe_nome: nomesEquipesMap.get(key) || `Equipe #${key}`,
      pontos_atuais: pontos_anteriores,
      pontos_vitorias,
      pontos_colocacao,
      novos_pontos,
      total_apos,
    });
  }

  // Ordenar: total_apos DESC, novos_pontos DESC, equipe_nome ASC
  listaResumo.sort((a, b) => {
    if (b.total_apos !== a.total_apos) return b.total_apos - a.total_apos;
    if (b.novos_pontos !== a.novos_pontos) return b.novos_pontos - a.novos_pontos;
    return a.equipe_nome.localeCompare(b.equipe_nome);
  });

  return listaResumo;
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
  const resumoEquipes = await calcularResumoEquipes(eventoId, chaveId, podio);

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

async function finalizarCategoria(eventoId, chaveId, usuarioId = null) {
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

    await auditoriaService.registrar({
      usuarioId,
      eventoId,
      acao: 'CATEGORIA_FINALIZADA',
      entidade: 'CHAVE',
      entidadeId: chaveId,
      descricao: `Categoria "${chave.categoria_nome}" finalizada.`,
      dadosAnteriores: {
        status: chave.status,
      },
      dadosNovos: {
        status: 'FINALIZADA',
        podio: {
          primeiro: podio.primeiro,
          segundo: podio.segundo,
          terceiro: podio.terceiro,
        },
      },
      client,
    });

    await client.query('COMMIT');
    return { chave: chaveFinalizada, podio };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function reabrirCategoria(eventoId, chaveId, usuarioId = null) {
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

    await auditoriaService.registrar({
      usuarioId,
      eventoId,
      acao: 'CATEGORIA_REABERTA',
      entidade: 'CHAVE',
      entidadeId: chaveId,
      descricao: `Categoria "${chave.categoria_nome}" reaberta.`,
      dadosAnteriores: {
        status: chave.status,
        primeiro_lugar_id: chave.primeiro_lugar_id,
        segundo_lugar_id: chave.segundo_lugar_id,
        terceiro_lugar_id: chave.terceiro_lugar_id,
      },
      dadosNovos: {
        status: 'EM_ANDAMENTO',
        primeiro_lugar_id: null,
        segundo_lugar_id: null,
        terceiro_lugar_id: null,
      },
      client,
    });

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
