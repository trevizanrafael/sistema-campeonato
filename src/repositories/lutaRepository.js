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
      e1.nome AS competidor_1_equipe,
      i2.nome AS competidor_2_nome,
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

module.exports = {
  criar,
  listarPorChave,
  buscarPorId,
  buscarPrimeiraRodada,
  atualizarDestino,
  atualizarCompetidor,
  marcarPronta,
  finalizarBye,
  excluirPorChave,
};
