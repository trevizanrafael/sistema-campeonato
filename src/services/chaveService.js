const pool = require('../config/database');
const eventoRepository = require('../repositories/eventoRepository');
const chaveRepository = require('../repositories/chaveRepository');
const lutaRepository = require('../repositories/lutaRepository');
const regraPontuacaoRepository = require('../repositories/regraPontuacaoRepository');
const chaveGeneratorService = require('./chaveGeneratorService');
const avancoService = require('./avancoService');
const {
  NotFoundError,
  BusinessRuleError,
} = require('../utils/errors');
const auditoriaService = require('./auditoriaService');

/**
 * Serviço de gerenciamento do ciclo de vida das chaves de luta.
 */

async function listarCategoriasEChaves(eventoId) {
  const evento = await eventoRepository.buscarPorId(eventoId);
  if (!evento) {
    throw new NotFoundError('Evento não encontrado.');
  }

  const categorias = await chaveRepository.listarPorEvento(eventoId);
  return { evento, categorias };
}

async function buscarChave(eventoId, chaveId) {
  const evento = await eventoRepository.buscarPorId(eventoId);
  if (!evento) {
    throw new NotFoundError('Evento não encontrado.');
  }

  const chave = await chaveRepository.buscarPorIdNoEvento(chaveId, eventoId);
  if (!chave) {
    throw new NotFoundError('Chave não encontrada.');
  }

  const lutas = await lutaRepository.listarPorChave(chaveId);

  // Agrupar lutas por rodada para facilitar exibição
  const rodadasMap = new Map();
  for (const luta of lutas) {
    if (!rodadasMap.has(luta.rodada)) {
      rodadasMap.set(luta.rodada, []);
    }
    rodadasMap.get(luta.rodada).push(luta);
  }

  const totalRodadas = chave.tamanho ? Math.log2(chave.tamanho) : 1;
  const rodadas = [];
  for (let r = 1; r <= totalRodadas; r++) {
    rodadas.push({
      numero: r,
      isFinal: r === totalRodadas,
      isSemifinal: totalRodadas > 2 && r === totalRodadas - 1,
      lutas: rodadasMap.get(r) || [],
    });
  }

  return {
    evento,
    chave,
    lutas,
    rodadas,
  };
}

async function gerarChave(eventoId, categoriaId, usuarioId = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Validar e bloquear categoria
    const catRes = await client.query(
      `SELECT c.*
       FROM categorias c
       WHERE c.id = $1 AND c.evento_id = $2
       FOR UPDATE`,
      [categoriaId, eventoId]
    );

    if (catRes.rows.length === 0) {
      throw new NotFoundError('Categoria não encontrada neste evento.');
    }
    const categoria = catRes.rows[0];

    // 2. Verificar se já existe chave para a categoria
    const chaveExistente = await client.query(
      'SELECT id FROM chaves WHERE categoria_id = $1 FOR UPDATE',
      [categoriaId]
    );
    if (chaveExistente.rows.length > 0) {
      throw new BusinessRuleError('Esta categoria já possui uma chave gerada.');
    }

    // 3. Buscar inscrições confirmadas
    const inscritosRes = await client.query(
      `SELECT
         i.id,
         i.nome,
         i.equipe_id,
         i.seed,
         e.nome AS equipe_nome
       FROM inscricoes i
       JOIN equipes e ON e.id = i.equipe_id
       WHERE i.evento_id = $1
         AND i.categoria_id = $2
         AND i.status = 'CONFIRMADA'
       ORDER BY i.nome
       FOR SHARE`,
      [eventoId, categoriaId]
    );

    const inscritos = inscritosRes.rows;
    if (inscritos.length < 2) {
      throw new BusinessRuleError('São necessários pelo menos dois competidores confirmados para gerar a chave.');
    }

    // 4. Calcular estrutura em memória via gerador puro
    const resultadoCalculo = chaveGeneratorService.gerarChave({
      inscritos,
    });

    // 5. Inserir chave
    const chaveNome = `Chave — ${categoria.nome}`;
    const novaChave = await chaveRepository.criar(
      {
        categoria_id: categoriaId,
        nome: chaveNome,
        tamanho: resultadoCalculo.tamanho,
        status: 'NAO_INICIADA',
      },
      client
    );

    // 6. Inserir lutas e mapear IDs por "rodada-posicao"
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

    // 7. Atualizar destinos (próxima luta e slot)
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
      acao: 'CHAVE_GERADA',
      entidade: 'CHAVE',
      entidadeId: novaChave.id,
      descricao: `Chave "${novaChave.nome}" gerada com ${resultadoCalculo.totalLutas} lutas.`,
      dadosAnteriores: null,
      dadosNovos: {
        categoria_id: categoriaId,
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

async function sortearNovamente(eventoId, chaveId, usuarioId = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Bloquear e validar chave
    const chaveRes = await client.query(
      `SELECT
         ch.*,
         c.evento_id,
         c.id AS categoria_id,
         c.nome AS categoria_nome
       FROM chaves ch
       JOIN categorias c ON c.id = ch.categoria_id
       WHERE ch.id = $1 AND c.evento_id = $2
       FOR UPDATE OF ch`,
      [chaveId, eventoId]
    );

    if (chaveRes.rows.length === 0) {
      throw new NotFoundError('Chave não encontrada.');
    }

    const chaveAtual = chaveRes.rows[0];
    if (chaveAtual.status !== 'NAO_INICIADA') {
      throw new BusinessRuleError('Uma chave já iniciada não pode ser sorteada novamente.');
    }

    const categoriaId = chaveAtual.categoria_id;

    // 2. Buscar inscrições confirmadas atuais
    const inscritosRes = await client.query(
      `SELECT
         i.id,
         i.nome,
         i.equipe_id,
         i.seed,
         e.nome AS equipe_nome
       FROM inscricoes i
       JOIN equipes e ON e.id = i.equipe_id
       WHERE i.evento_id = $1
         AND i.categoria_id = $2
         AND i.status = 'CONFIRMADA'
       ORDER BY i.nome
       FOR SHARE`,
      [eventoId, categoriaId]
    );

    const inscritos = inscritosRes.rows;
    if (inscritos.length < 2) {
      throw new BusinessRuleError('São necessários pelo menos dois competidores confirmados para gerar a chave.');
    }

    // 3. Excluir chave anterior (cascateia as lutas automaticamente)
    await chaveRepository.excluir(chaveId, client);

    // 4. Gerar nova estrutura
    const resultadoCalculo = chaveGeneratorService.gerarChave({
      inscritos,
    });

    // 5. Inserir nova chave
    const novaChave = await chaveRepository.criar(
      {
        categoria_id: categoriaId,
        nome: chaveAtual.nome,
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

    // 7. Conectar destinos
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
      acao: 'CHAVE_SORTEADA_NOVAMENTE',
      entidade: 'CHAVE',
      entidadeId: novaChave.id,
      descricao: `Chave "${novaChave.nome}" sorteada novamente com ${resultadoCalculo.totalLutas} lutas.`,
      dadosAnteriores: {
        chave_id: chaveAtual.id,
        tamanho: chaveAtual.tamanho,
      },
      dadosNovos: {
        chave_id: novaChave.id,
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

async function iniciarChave(eventoId, chaveId, usuarioId = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Bloquear e validar chave
    const chaveRes = await client.query(
      `SELECT
         ch.*,
         c.evento_id,
         c.id AS categoria_id
       FROM chaves ch
       JOIN categorias c ON c.id = ch.categoria_id
       WHERE ch.id = $1 AND c.evento_id = $2
       FOR UPDATE OF ch`,
      [chaveId, eventoId]
    );

    if (chaveRes.rows.length === 0) {
      throw new NotFoundError('Chave não encontrada.');
    }

    const chave = chaveRes.rows[0];
    if (chave.status !== 'NAO_INICIADA') {
      throw new BusinessRuleError('A chave já foi iniciada ou finalizada.');
    }

    // 2. Buscar regras de pontuação do evento
    const regra =
      (await regraPontuacaoRepository.buscarPorEvento(eventoId, client)) || {
        bye_pontua: false,
        pontos_vitoria: 0,
      };

    // 3. Atualizar status da chave para EM_ANDAMENTO
    await chaveRepository.atualizarStatus(chaveId, 'EM_ANDAMENTO', client);

    // 4. Buscar lutas da 1ª rodada
    const lutasR1 = await lutaRepository.buscarPrimeiraRodada(chaveId, client);

    // 5. Processar lutas da primeira rodada
    for (const luta of lutasR1) {
      const temComp1 = luta.competidor_1_id !== null;
      const temComp2 = luta.competidor_2_id !== null;

      if (temComp1 && temComp2) {
        // Luta normal com 2 atletas: pronta para combate
        await lutaRepository.marcarPronta(luta.id, client);
      } else if (temComp1 || temComp2) {
        // Luta com apenas 1 competidor: BYE!
        const vencedorId = await avancoService.processarBye(luta, client);

        // Se pontuação de bye estiver configurada e for > 0, lança ponto para a equipe
        if (regra.bye_pontua === true && Number(regra.pontos_vitoria) > 0) {
          const atRes = await client.query(
            'SELECT equipe_id FROM inscricoes WHERE id = $1',
            [vencedorId]
          );

          if (atRes.rows.length > 0) {
            const equipeId = atRes.rows[0].equipe_id;

            await client.query(
              `INSERT INTO pontos_equipes (
                 evento_id,
                 equipe_id,
                 inscricao_id,
                 luta_id,
                 chave_id,
                 tipo,
                 pontos,
                 descricao
               )
               VALUES ($1, $2, $3, $4, $5, 'VITORIA', $6, 'Vitória por avanço de bye na primeira rodada')
               ON CONFLICT (luta_id) WHERE tipo = 'VITORIA' DO NOTHING`,
              [
                eventoId,
                equipeId,
                vencedorId,
                luta.id,
                chaveId,
                Number(regra.pontos_vitoria),
              ]
            );
          }
        }
      }
    }

    await auditoriaService.registrar({
      usuarioId,
      eventoId,
      acao: 'CHAVE_INICIADA',
      entidade: 'CHAVE',
      entidadeId: chave.id,
      descricao: `Chave "${chave.nome}" iniciada.`,
      dadosAnteriores: { status: chave.status },
      dadosNovos: { status: 'EM_ANDAMENTO' },
      client,
    });

    await client.query('COMMIT');
    return { chaveId, status: 'EM_ANDAMENTO' };
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

async function excluirChave(eventoId, chaveId, usuarioId = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Bloquear e validar chave
    const chaveRes = await client.query(
      `SELECT
         ch.*,
         c.evento_id
       FROM chaves ch
       JOIN categorias c ON c.id = ch.categoria_id
       WHERE ch.id = $1 AND c.evento_id = $2
       FOR UPDATE OF ch`,
      [chaveId, eventoId]
    );

    if (chaveRes.rows.length === 0) {
      throw new NotFoundError('Chave não encontrada.');
    }

    const chave = chaveRes.rows[0];
    if (chave.status !== 'NAO_INICIADA') {
      throw new BusinessRuleError('Uma chave iniciada não pode ser excluída.');
    }

    // 2. Excluir chave (cascateia lutas)
    await chaveRepository.excluir(chaveId, client);

    await auditoriaService.registrar({
      usuarioId,
      eventoId,
      acao: 'CHAVE_EXCLUIDA',
      entidade: 'CHAVE',
      entidadeId: chave.id,
      descricao: `Chave "${chave.nome}" excluída.`,
      dadosAnteriores: {
        id: chave.id,
        categoria_id: chave.categoria_id,
        nome: chave.nome,
        status: chave.status,
        tamanho: chave.tamanho,
      },
      dadosNovos: null,
      client,
    });

    await client.query('COMMIT');
    return { id: chaveId };
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

module.exports = {
  listarCategoriasEChaves,
  buscarChave,
  gerarChave,
  sortearNovamente,
  iniciarChave,
  excluirChave,
};
