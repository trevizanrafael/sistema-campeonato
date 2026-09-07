const pool = require('../config/database');

/**
 * Repositório para operações na tabela lutas.
 */

async function criar(dados, client) {
  const db = client || pool;
  const sql = `
    INSERT INTO lutas (
      chave_id,
      rodada,
      posicao,
      competidor_1_id,
      competidor_2_id,
      status
    )
    VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'AGUARDANDO'))
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [
    dados.chave_id,
    dados.rodada,
    dados.posicao,
    dados.competidor_1_id || null,
    dados.competidor_2_id || null,
    dados.status || 'AGUARDANDO',
  ]);

  return rows[0];
}

async function listarPorChave(chaveId, client) {
  const db = client || pool;
  const sql = `
    SELECT
      l.*,
      i1.nome AS competidor_1_nome,
      i1.seed AS competidor_1_seed,
      e1.nome AS competidor_1_equipe,
      i2.nome AS competidor_2_nome,
      i2.seed AS competidor_2_seed,
      e2.nome AS competidor_2_equipe,
      v.nome AS vencedor_nome
    FROM lutas l
    LEFT JOIN inscricoes i1 ON i1.id = l.competidor_1_id
    LEFT JOIN equipes e1 ON e1.id = i1.equipe_id
    LEFT JOIN inscricoes i2 ON i2.id = l.competidor_2_id
    LEFT JOIN equipes e2 ON e2.id = i2.equipe_id
    LEFT JOIN inscricoes v ON v.id = l.vencedor_id
    WHERE l.chave_id = $1
    ORDER BY l.rodada, l.posicao;
  `;

  const { rows } = await db.query(sql, [chaveId]);
  return rows;
}

async function buscarPorId(id, client) {
  const db = client || pool;
  const sql = `
    SELECT *
    FROM lutas
    WHERE id = $1;
  `;

  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function buscarPrimeiraRodada(chaveId, client) {
  const db = client || pool;
  const sql = `
    SELECT *
    FROM lutas
    WHERE chave_id = $1 AND rodada = 1
    ORDER BY posicao;
  `;

  const { rows } = await db.query(sql, [chaveId]);
  return rows;
}

async function atualizarDestino(id, proximaLutaId, proximoSlot, client) {
  const db = client || pool;
  const sql = `
    UPDATE lutas
    SET
      proxima_luta_id = $2,
      proximo_slot = $3,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [id, proximaLutaId, proximoSlot]);
  return rows[0] || null;
}

async function atualizarCompetidor(id, coluna, inscricaoId, client) {
  if (coluna !== 'competidor_1_id' && coluna !== 'competidor_2_id') {
    throw new Error(`Coluna de competidor inválida: ${coluna}`);
  }

  const db = client || pool;
  const sql = `
    UPDATE lutas
    SET
      ${coluna} = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [id, inscricaoId]);
  return rows[0] || null;
}

async function marcarPronta(id, client) {
  const db = client || pool;
  const sql = `
    UPDATE lutas
    SET
      status = 'PRONTA',
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function finalizarBye(id, vencedorId, client) {
  const db = client || pool;
  const sql = `
    UPDATE lutas
    SET
      vencedor_id = $2,
      perdedor_id = NULL,
      tipo_resultado = 'BYE',
      status = 'FINALIZADA',
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [id, vencedorId]);
  return rows[0] || null;
}

async function excluirPorChave(chaveId, client) {
  const db = client || pool;
  const sql = `
    DELETE FROM lutas
    WHERE chave_id = $1;
  `;

  const { rows } = await db.query(sql, [chaveId]);
  return rows;
}

async function buscarParaResultado(lutaId, chaveId, eventoId, client, paraAtualizacao = false) {
  const db = client || pool;
  const sql = `
    SELECT
      l.*,
      ch.status AS chave_status,
      ch.categoria_id,
      ch.tamanho AS chave_tamanho,
      c.nome AS categoria_nome,
      c.evento_id,
      e.nome AS evento_nome,
      i1.nome AS competidor_1_nome,
      i1.equipe_id AS competidor_1_equipe_id,
      e1.nome AS competidor_1_equipe_nome,
      i2.nome AS competidor_2_nome,
      i2.equipe_id AS competidor_2_equipe_id,
      e2.nome AS competidor_2_equipe_nome
    FROM lutas l
    JOIN chaves ch ON ch.id = l.chave_id
    JOIN categorias c ON c.id = ch.categoria_id
    JOIN eventos e ON e.id = c.evento_id
    LEFT JOIN inscricoes i1 ON i1.id = l.competidor_1_id
    LEFT JOIN equipes e1 ON e1.id = i1.equipe_id
    LEFT JOIN inscricoes i2 ON i2.id = l.competidor_2_id
    LEFT JOIN equipes e2 ON e2.id = i2.equipe_id
    WHERE l.id = $1
      AND l.chave_id = $2
      AND ch.id = $2
      AND c.evento_id = $3
    ${paraAtualizacao ? 'FOR UPDATE OF l' : ''};
  `;

  const { rows } = await db.query(sql, [lutaId, chaveId, eventoId]);
  return rows[0] || null;
}

async function finalizar(lutaId, dados, client) {
  const db = client || pool;
  const sql = `
    UPDATE lutas
    SET
      vencedor_id = $1,
      perdedor_id = $2,
      tipo_resultado = $3,
      placar_1 = $4,
      placar_2 = $5,
      observacao = $6,
      status = 'FINALIZADA',
      updated_at = NOW()
    WHERE id = $7
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [
    dados.vencedor_id,
    dados.perdedor_id,
    dados.tipo_resultado,
    dados.placar_1 !== undefined ? dados.placar_1 : null,
    dados.placar_2 !== undefined ? dados.placar_2 : null,
    dados.observacao || null,
    lutaId,
  ]);

  return rows[0] || null;
}

async function atualizarCompetidorSlotVazio(id, coluna, inscricaoId, client) {
  if (coluna !== 'competidor_1_id' && coluna !== 'competidor_2_id') {
    throw new Error(`Coluna de competidor inválida: ${coluna}`);
  }

  const db = client || pool;
  const sql = `
    UPDATE lutas
    SET
      ${coluna} = $2,
      updated_at = NOW()
    WHERE id = $1 AND ${coluna} IS NULL
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [id, inscricaoId]);
  return rows[0] || null;
}

async function buscarParaCorrecao(lutaId, chaveId, eventoId, client, paraAtualizacao = false) {
  const db = client || pool;
  const sql = `
    SELECT
      l.*,
      ch.status AS chave_status,
      ch.categoria_id,
      ch.tamanho AS chave_tamanho,
      c.nome AS categoria_nome,
      c.evento_id,
      e.nome AS evento_nome,
      i1.nome AS competidor_1_nome,
      i1.equipe_id AS competidor_1_equipe_id,
      e1.nome AS competidor_1_equipe_nome,
      i2.nome AS competidor_2_nome,
      i2.equipe_id AS competidor_2_equipe_id,
      e2.nome AS competidor_2_equipe_nome,
      proxima.status AS proxima_luta_status,
      proxima.vencedor_id AS proxima_luta_vencedor_id,
      proxima.competidor_1_id AS proxima_competidor_1_id,
      proxima.competidor_2_id AS proxima_competidor_2_id
    FROM lutas l
    JOIN chaves ch ON ch.id = l.chave_id
    JOIN categorias c ON c.id = ch.categoria_id
    JOIN eventos e ON e.id = c.evento_id
    LEFT JOIN inscricoes i1 ON i1.id = l.competidor_1_id
    LEFT JOIN equipes e1 ON e1.id = i1.equipe_id
    LEFT JOIN inscricoes i2 ON i2.id = l.competidor_2_id
    LEFT JOIN equipes e2 ON e2.id = i2.equipe_id
    LEFT JOIN lutas proxima ON proxima.id = l.proxima_luta_id
    WHERE l.id = $1
      AND l.chave_id = $2
      AND ch.id = $2
      AND c.evento_id = $3
    ${paraAtualizacao ? 'FOR UPDATE OF l' : ''};
  `;

  const { rows } = await db.query(sql, [lutaId, chaveId, eventoId]);
  return rows[0] || null;
}

async function buscarPorIdParaAtualizacao(id, client) {
  const db = client || pool;
  const sql = `
    SELECT *
    FROM lutas
    WHERE id = $1
    FOR UPDATE;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function removerCompetidorSlot(id, coluna, competidorId, client) {
  if (coluna !== 'competidor_1_id' && coluna !== 'competidor_2_id') {
    throw new Error(`Coluna de competidor inválida: ${coluna}`);
  }

  const db = client || pool;
  const sql = `
    UPDATE lutas
    SET
      ${coluna} = NULL,
      status = 'AGUARDANDO',
      updated_at = NOW()
    WHERE id = $1 AND ${coluna} = $2
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [id, competidorId]);
  return rows[0] || null;
}

async function atualizarStatus(id, status, client) {
  const db = client || pool;
  const sql = `
    UPDATE lutas
    SET
      status = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [id, status]);
  return rows[0] || null;
}

async function anular(id, client) {
  const db = client || pool;
  const sql = `
    UPDATE lutas
    SET
      vencedor_id = NULL,
      perdedor_id = NULL,
      tipo_resultado = NULL,
      placar_1 = NULL,
      placar_2 = NULL,
      observacao = NULL,
      status = 'PRONTA',
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function contarLutasNaoFinalizadas(chaveId, client) {
  const db = client || pool;
  const sql = `
    SELECT COUNT(*)::INTEGER AS pendentes
    FROM lutas
    WHERE chave_id = $1
      AND status <> 'FINALIZADA';
  `;

  const { rows } = await db.query(sql, [chaveId]);
  return parseInt(rows[0].pendentes, 10) || 0;
}

async function buscarFinal(chaveId, client) {
  const db = client || pool;
  const sql = `
    SELECT
      l.*,
      vencedor.nome AS vencedor_nome,
      vencedor.equipe_id AS vencedor_equipe_id,
      equipe_vencedor.nome AS vencedor_equipe_nome,
      perdedor.nome AS perdedor_nome,
      perdedor.equipe_id AS perdedor_equipe_id,
      equipe_perdedor.nome AS perdedor_equipe_nome
    FROM lutas l
    LEFT JOIN inscricoes vencedor
      ON vencedor.id = l.vencedor_id
    LEFT JOIN equipes equipe_vencedor
      ON equipe_vencedor.id = vencedor.equipe_id
    LEFT JOIN inscricoes perdedor
      ON perdedor.id = l.perdedor_id
    LEFT JOIN equipes equipe_perdedor
      ON equipe_perdedor.id = perdedor.equipe_id
    WHERE l.chave_id = $1
      AND l.proxima_luta_id IS NULL;
  `;

  const { rows } = await db.query(sql, [chaveId]);
  return rows[0] || null;
}

async function buscarSemifinalDoCampeao(chaveId, rodadaSemifinal, campeaoId, client) {
  const db = client || pool;
  const sql = `
    SELECT
      l.*,
      perdedor.nome AS perdedor_nome,
      perdedor.equipe_id AS perdedor_equipe_id,
      equipe.nome AS perdedor_equipe_nome
    FROM lutas l
    LEFT JOIN inscricoes perdedor
      ON perdedor.id = l.perdedor_id
    LEFT JOIN equipes equipe
      ON equipe.id = perdedor.equipe_id
    WHERE l.chave_id = $1
      AND l.rodada = $2
      AND l.vencedor_id = $3
    LIMIT 1;
  `;

  const { rows } = await db.query(sql, [chaveId, rodadaSemifinal, campeaoId]);
  return rows[0] || null;
}

async function buscarOutraSemifinalComPerdedor(chaveId, rodadaSemifinal, client) {
  const db = client || pool;
  const sql = `
    SELECT
      l.*,
      perdedor.nome AS perdedor_nome,
      perdedor.equipe_id AS perdedor_equipe_id,
      equipe.nome AS perdedor_equipe_nome
    FROM lutas l
    LEFT JOIN inscricoes perdedor
      ON perdedor.id = l.perdedor_id
    LEFT JOIN equipes equipe
      ON equipe.id = perdedor.equipe_id
    WHERE l.chave_id = $1
      AND l.rodada = $2
      AND l.perdedor_id IS NOT NULL
    ORDER BY l.posicao
    LIMIT 1;
  `;

  const { rows } = await db.query(sql, [chaveId, rodadaSemifinal]);
  return rows[0] || null;
}

async function bloquearTodasPorChave(chaveId, client) {
  const db = client || pool;
  const sql = `
    SELECT id, status, vencedor_id, perdedor_id
    FROM lutas
    WHERE chave_id = $1
    FOR UPDATE;
  `;

  const { rows } = await db.query(sql, [chaveId]);
  return rows;
}

module.exports = {
  criar,
  listarPorChave,
  buscarPorId,
  buscarPorIdParaAtualizacao,
  buscarPrimeiraRodada,
  atualizarDestino,
  atualizarCompetidor,
  atualizarCompetidorSlotVazio,
  removerCompetidorSlot,
  atualizarStatus,
  marcarPronta,
  finalizarBye,
  excluirPorChave,
  buscarParaResultado,
  buscarParaCorrecao,
  finalizar,
  anular,
  contarLutasNaoFinalizadas,
  buscarFinal,
  buscarSemifinalDoCampeao,
  buscarOutraSemifinalComPerdedor,
  bloquearTodasPorChave,
};
