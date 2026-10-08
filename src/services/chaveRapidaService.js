const pool = require('../config/database');
const eventoRepository = require('../repositories/eventoRepository');
const chaveRapidaRepository = require('../repositories/chaveRapidaRepository');
const chaveRepository = require('../repositories/chaveRepository');
const lutaRepository = require('../repositories/lutaRepository');
const equipeRepository = require('../repositories/equipeRepository');
const chaveGeneratorService = require('./chaveGeneratorService');
const auditoriaService = require('./auditoriaService');
const {
  NotFoundError,
  BusinessRuleError,
  ValidationError,
} = require('../utils/errors');

/**
 * Serviço de gerenciamento do ciclo de vida das chaves rápidas e suas inscrições.
 */

async function criar(eventoId, { nome }, usuarioId = null) {
  const evento = await eventoRepository.buscarPorId(eventoId);
  if (!evento) {
    throw new NotFoundError('Campeonato não encontrado.');
  }

  const nomeLimpo = (nome || '').trim();
  if (!nomeLimpo || nomeLimpo.length < 2) {
    throw new ValidationError({
      nome: 'O nome da chave rápida deve conter pelo menos 2 caracteres.',
    });
  }
  if (nomeLimpo.length > 200) {
    throw new ValidationError({
      nome: 'O nome da chave rápida não pode exceder 200 caracteres.',
    });
  }

  const chaveRapida = await chaveRapidaRepository.criar({
    evento_id: eventoId,
    nome: nomeLimpo,
  });

  await auditoriaService.registrar({
    usuarioId,
    eventoId,
    acao: 'CHAVE_RAPIDA_CRIADA',
    entidade: 'CHAVE_RAPIDA',
    entidadeId: chaveRapida.id,
    descricao: `Chave rápida "${chaveRapida.nome}" criada.`,
    dadosAnteriores: null,
    dadosNovos: chaveRapida,
  });

  return chaveRapida;
}

async function buscarDetalhes(eventoId, chaveRapidaId) {
  const evento = await eventoRepository.buscarPorId(eventoId);
  if (!evento) {
    throw new NotFoundError('Campeonato não encontrado.');
  }

  const chaveRapida = await chaveRapidaRepository.buscarPorIdNoEvento(chaveRapidaId, eventoId);
  if (!chaveRapida) {
    throw new NotFoundError('Chave rápida não encontrada.');
  }

  const inscritos = await chaveRapidaRepository.listarInscritos(chaveRapidaId);
  const equipes = await equipeRepository.listarTodas();

  return {
    evento,
    chaveRapida,
    inscritos,
    equipes,
  };
}

async function adicionarCompetidor(eventoId, chaveRapidaId, { nome, equipe_id }, usuarioId = null) {
  const evento = await eventoRepository.buscarPorId(eventoId);
  if (!evento) {
    throw new NotFoundError('Campeonato não encontrado.');
  }

  const chaveRapida = await chaveRapidaRepository.buscarPorIdNoEvento(chaveRapidaId, eventoId);
  if (!chaveRapida) {
    throw new NotFoundError('Chave rápida não encontrada.');
  }

  const isEmAndamento = chaveRapida.status === 'EM_ANDAMENTO' || chaveRapida.status === 'FINALIZADA' || chaveRapida.chave_status === 'EM_ANDAMENTO' || chaveRapida.chave_status === 'FINALIZADA';
  if (isEmAndamento) {
    throw new BusinessRuleError('A chave já foi iniciada ou finalizada. Não é mais possível adicionar novos competidores.');
  }

  const nomeLimpo = (nome || '').trim();
  if (!nomeLimpo || nomeLimpo.length < 2) {
    throw new ValidationError({
      nome: 'O nome do atleta deve conter pelo menos 2 caracteres.',
    });
  }
  if (nomeLimpo.length > 200) {
    throw new ValidationError({
      nome: 'O nome do atleta não pode exceder 200 caracteres.',
    });
  }

  let equipeId = null;
  if (equipe_id && String(equipe_id).trim() !== '') {
    const eq = await equipeRepository.buscarPorId(Number(equipe_id));
    if (!eq) {
      throw new ValidationError({
        equipe_id: 'Academia selecionada não encontrada.',
      });
    }
    equipeId = eq.id;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bloquear chave rápida para evitar concorrência e duplicidade
    await client.query(
      'SELECT id FROM chaves_rapidas WHERE id = $1 FOR UPDATE',
      [chaveRapidaId]
    );

    // Se já existia uma chave gerada mas ainda NÃO iniciada, exclui para atualizar com o novo atleta
    const chExistente = await client.query(
      'SELECT id, status FROM chaves WHERE chave_rapida_id = $1 FOR UPDATE',
      [chaveRapidaId]
    );
    if (chExistente.rows.length > 0) {
      if (chExistente.rows[0].status !== 'NAO_INICIADA') {
        throw new BusinessRuleError('A chave já foi iniciada e não aceita novos competidores.');
      }
      await chaveRepository.excluir(chExistente.rows[0].id, client);
    }

    // Verificar se já existe atleta com o mesmo nome nesta chave rápida (proteção contra duplo envio)
    const existente = await client.query(
      'SELECT id FROM inscricoes_chaves_rapidas WHERE chave_rapida_id = $1 AND LOWER(TRIM(nome)) = LOWER(TRIM($2))',
      [chaveRapidaId, nomeLimpo]
    );
    if (existente.rows.length > 0) {
      throw new BusinessRuleError(`O atleta "${nomeLimpo}" já está cadastrado nesta chave rápida.`);
    }

    // Inserir registro na tabela geral de inscricoes com status CONFIRMADA
    const insRes = await client.query(
      `INSERT INTO inscricoes (
         evento_id,
         chave_rapida_id,
         nome,
         equipe_id,
         status
       )
       VALUES ($1, $2, $3, $4, 'CONFIRMADA')
       RETURNING *;`,
      [eventoId, chaveRapidaId, nomeLimpo, equipeId]
    );
    const inscricao = insRes.rows[0];

    // Inserir na tabela específica de inscricoes_chaves_rapidas
    const inscricaoRapida = await chaveRapidaRepository.adicionarInscrito(
      {
        chave_rapida_id: chaveRapidaId,
        nome: nomeLimpo,
        equipe_id: equipeId,
        inscricao_id: inscricao.id,
      },
      client
    );

    await auditoriaService.registrar({
      usuarioId,
      eventoId,
      acao: 'COMPETIDOR_CHAVE_RAPIDA_ADICIONADO',
      entidade: 'CHAVE_RAPIDA',
      entidadeId: chaveRapidaId,
      descricao: `Atleta "${nomeLimpo}" adicionado à chave rápida "${chaveRapida.nome}".`,
      dadosAnteriores: null,
      dadosNovos: {
        inscrito_id: inscricaoRapida.id,
        inscricao_id: inscricao.id,
        nome: nomeLimpo,
        equipe_id: equipeId,
      },
      client,
    });

    await client.query('COMMIT');
    return { ...inscricaoRapida, chaveExcluida: chExistente.rows.length > 0 };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function removerCompetidor(eventoId, chaveRapidaId, inscritoId, usuarioId = null) {
  const evento = await eventoRepository.buscarPorId(eventoId);
  if (!evento) {
    throw new NotFoundError('Campeonato não encontrado.');
  }

  const chaveRapida = await chaveRapidaRepository.buscarPorIdNoEvento(chaveRapidaId, eventoId);
  if (!chaveRapida) {
    throw new NotFoundError('Chave rápida não encontrada.');
  }

  const isEmAndamento = chaveRapida.status === 'EM_ANDAMENTO' || chaveRapida.status === 'FINALIZADA' || chaveRapida.chave_status === 'EM_ANDAMENTO' || chaveRapida.chave_status === 'FINALIZADA';
  if (isEmAndamento) {
    throw new BusinessRuleError('A chave já foi iniciada ou finalizada. Não é mais possível remover competidores.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Se já existia uma chave gerada mas ainda NÃO iniciada, exclui para atualizar com a remoção
    const chExistenteRem = await client.query(
      'SELECT id, status FROM chaves WHERE chave_rapida_id = $1 FOR UPDATE',
      [chaveRapidaId]
    );
    if (chExistenteRem.rows.length > 0) {
      if (chExistenteRem.rows[0].status !== 'NAO_INICIADA') {
        throw new BusinessRuleError('A chave já foi iniciada e não permite alterações de competidores.');
      }
      await chaveRepository.excluir(chExistenteRem.rows[0].id, client);
    }

    const checkRes = await client.query(
      `SELECT * FROM inscricoes_chaves_rapidas
       WHERE id = $1 AND chave_rapida_id = $2
       FOR UPDATE`,
      [inscritoId, chaveRapidaId]
    );

    if (checkRes.rows.length === 0) {
      throw new NotFoundError('Inscrição não encontrada nesta chave rápida.');
    }

    const inscrito = checkRes.rows[0];

    // Remover de inscricoes_chaves_rapidas
    await chaveRapidaRepository.removerInscrito(inscritoId, chaveRapidaId, client);

    // Remover de inscricoes gerais se existir
    if (inscrito.inscricao_id) {
      await client.query(
        'DELETE FROM inscricoes WHERE id = $1 AND chave_rapida_id = $2',
        [inscrito.inscricao_id, chaveRapidaId]
      );
    }

    await auditoriaService.registrar({
      usuarioId,
      eventoId,
      acao: 'COMPETIDOR_CHAVE_RAPIDA_REMOVIDO',
      entidade: 'CHAVE_RAPIDA',
      entidadeId: chaveRapidaId,
      descricao: `Atleta "${inscrito.nome}" removido da chave rápida "${chaveRapida.nome}".`,
      dadosAnteriores: inscrito,
      dadosNovos: null,
      client,
    });

    await client.query('COMMIT');
    return { sucesso: true, chaveExcluida: chExistenteRem.rows.length > 0 };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function gerarChave(eventoId, chaveRapidaId, usuarioId = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Bloquear chave rápida
    const crRes = await client.query(
      `SELECT cr.*
       FROM chaves_rapidas cr
       WHERE cr.id = $1 AND cr.evento_id = $2
       FOR UPDATE`,
      [chaveRapidaId, eventoId]
    );

    if (crRes.rows.length === 0) {
      throw new NotFoundError('Chave rápida não encontrada.');
    }
    const chaveRapida = crRes.rows[0];

    // 2. Verificar se já existe chave gerada
    const chaveExistente = await client.query(
      'SELECT id, status FROM chaves WHERE chave_rapida_id = $1 FOR UPDATE',
      [chaveRapidaId]
    );
    if (chaveExistente.rows.length > 0) {
      if (chaveExistente.rows[0].status !== 'NAO_INICIADA') {
        throw new BusinessRuleError('A chave já foi iniciada e não pode ser gerada novamente.');
      }
      // Se ainda não foi iniciada, exclui a chave antiga para recriar com a lista atualizada
      await chaveRepository.excluir(chaveExistente.rows[0].id, client);
    }

    // 3. Buscar competidores confirmados
    const inscritosRes = await client.query(
      `SELECT
         i.id,
         i.nome,
         i.equipe_id,
         i.seed,
         e.nome AS equipe_nome
       FROM inscricoes i
       LEFT JOIN equipes e ON e.id = i.equipe_id
       WHERE i.evento_id = $1
         AND i.chave_rapida_id = $2
         AND i.status = 'CONFIRMADA'
       ORDER BY i.nome
`,
      [eventoId, chaveRapidaId]
    );

    const inscritos = inscritosRes.rows;
    if (inscritos.length < 2) {
      throw new BusinessRuleError('São necessários pelo menos dois competidores para gerar a chave.');
    }

    // 4. Calcular estrutura da chave eliminatória
    const resultadoCalculo = chaveGeneratorService.gerarChave({
      inscritos,
    });

    // 5. Inserir chave
    const chaveNome = `Chave — ${chaveRapida.nome}`;
    const novaChave = await chaveRepository.criar(
      {
        categoria_id: null,
        chave_rapida_id: chaveRapidaId,
        nome: chaveNome,
        tamanho: resultadoCalculo.tamanho,
        status: 'NAO_INICIADA',
      },
      client
    );

    // 6. Inserir lutas
    const mapaIds = new Map();
    const lutasSalvas = [];

    for (const lutaDados of resultadoCalculo.lutas) {
      const lutaSalva = await lutaRepository.criar(
        {
          chave_id: novaChave.id,
          rodada: lutaDados.rodada,
          posicao: lutaDados.posicao,
          competidor_1_id: lutaDados.competidor_1_id,
          competidor_2_id: lutaDados.competidor_2_id,
          status: 'AGUARDANDO',
        },
        client
      );

      mapaIds.set(`${lutaDados.rodada}-${lutaDados.posicao}`, lutaSalva.id);
      lutasSalvas.push({
        ...lutaDados,
        id: lutaSalva.id,
      });
    }

    // 7. Conectar destinos de avanço
    for (const luta of lutasSalvas) {
      if (luta.proximaRodada && luta.proximaPosicao) {
        const proximaLutaId = mapaIds.get(`${luta.proximaRodada}-${luta.proximaPosicao}`);
        if (proximaLutaId) {
          await lutaRepository.atualizarDestino(
            luta.id,
            proximaLutaId,
            luta.proximoSlot,
            client
          );
        }
      }
    }

    await auditoriaService.registrar({
      usuarioId,
      eventoId,
      acao: 'CHAVE_RAPIDA_GERADA',
      entidade: 'CHAVE',
      entidadeId: novaChave.id,
      descricao: `Chave rápida "${novaChave.nome}" gerada com ${resultadoCalculo.totalLutas} lutas.`,
      dadosAnteriores: null,
      dadosNovos: {
        chave_rapida_id: chaveRapidaId,
        nome: novaChave.nome,
        tamanho: novaChave.tamanho,
        totalLutas: resultadoCalculo.totalLutas,
      },
      client,
    });

    await client.query('COMMIT');
    return {
      chave: novaChave,
      totalLutas: resultadoCalculo.totalLutas,
      conflitosEquipe: resultadoCalculo.conflitosEquipe,
    };
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

async function excluir(eventoId, chaveRapidaId, usuarioId = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const chaveRapida = await chaveRapidaRepository.buscarPorIdNoEvento(chaveRapidaId, eventoId, client);
    if (!chaveRapida) {
      throw new NotFoundError('Chave rápida não encontrada.');
    }

    if (chaveRapida.status !== 'NAO_INICIADA') {
      throw new BusinessRuleError('Uma chave rápida que já foi iniciada não pode ser excluída.');
    }

    // Excluir chave de lutas se existir (cascateia as lutas)
    if (chaveRapida.chave_id) {
      await chaveRepository.excluir(chaveRapida.chave_id, client);
    }

    // Excluir inscricoes correspondentes
    await client.query(
      'DELETE FROM inscricoes WHERE chave_rapida_id = $1 AND evento_id = $2',
      [chaveRapidaId, eventoId]
    );

    // Excluir chave rápida (cascateia inscricoes_chaves_rapidas)
    await chaveRapidaRepository.excluir(chaveRapidaId, eventoId, client);

    await auditoriaService.registrar({
      usuarioId,
      eventoId,
      acao: 'CHAVE_RAPIDA_EXCLUIDA',
      entidade: 'CHAVE_RAPIDA',
      entidadeId: chaveRapidaId,
      descricao: `Chave rápida "${chaveRapida.nome}" excluída.`,
      dadosAnteriores: chaveRapida,
      dadosNovos: null,
      client,
    });

    await client.query('COMMIT');
    return { id: chaveRapidaId };
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

module.exports = {
  criar,
  buscarDetalhes,
  adicionarCompetidor,
  removerCompetidor,
  gerarChave,
  excluir,
};
