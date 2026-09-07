const pool = require('../config/database');

/**
 * Repositório para operações na tabela chaves.
 */

async function listarPorEvento(eventoId) {
  const sql = `
    SELECT
      c.id AS categoria_id,
      c.nome AS categoria_nome,
      c.sexo AS categoria_sexo,
      c.idade_minima,
      c.idade_maxima,
      c.peso_minimo,
      c.peso_maximo,
      fmin.nome AS faixa_minima_nome,
      fmax.nome AS faixa_maxima_nome,
      COUNT(i.id) FILTER (WHERE i.status = 'CONFIRMADA')::INTEGER AS total_confirmados,
      ch.id AS chave_id,
      ch.nome AS chave_nome,
      ch.tamanho AS chave_tamanho,
      ch.status AS chave_status,
      ch.created_at AS chave_created_at
    FROM categorias c
    LEFT JOIN faixas fmin ON fmin.id = c.faixa_minima_id
    LEFT JOIN faixas fmax ON fmax.id = c.faixa_maxima_id
    LEFT JOIN inscricoes i ON i.categoria_id = c.id
    LEFT JOIN chaves ch ON ch.categoria_id = c.id
    WHERE c.evento_id = $1
    GROUP BY c.id, fmin.nome, fmax.nome, ch.id
    ORDER BY c.nome ASC;
  `;

  const { rows } = await pool.query(sql, [eventoId]);
  return rows;
}

async function buscarPorIdNoEvento(chaveId, eventoId, client) {
  const db = client || pool;
  const sql = `
    SELECT
      ch.*,
      c.nome AS categoria_nome,
      c.evento_id
    FROM chaves ch
    JOIN categorias c ON c.id = ch.categoria_id
    WHERE ch.id = $1 AND c.evento_id = $2;
  `;

  const { rows } = await db.query(sql, [chaveId, eventoId]);
  return rows[0] || null;
}

async function buscarPorId(chaveId, client) {
  const db = client || pool;
  const sql = `
    SELECT
      ch.*,
      c.nome AS categoria_nome,
      c.evento_id
    FROM chaves ch
    JOIN categorias c ON c.id = ch.categoria_id
    WHERE ch.id = $1;
  `;

  const { rows } = await db.query(sql, [chaveId]);
  return rows[0] || null;
}

async function buscarPorCategoria(categoriaId, client) {
  const db = client || pool;
  const sql = `
    SELECT *
    FROM chaves
    WHERE categoria_id = $1;
  `;

  const { rows } = await db.query(sql, [categoriaId]);
  return rows[0] || null;
}

async function criar(dados, client) {
  const db = client || pool;
  const sql = `
    INSERT INTO chaves (
      categoria_id,
      nome,
      tamanho,
      status
    )
    VALUES ($1, $2, $3, COALESCE($4, 'NAO_INICIADA'))
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [
    dados.categoria_id,
    dados.nome,
    dados.tamanho,
    dados.status || 'NAO_INICIADA',
  ]);

  return rows[0];
}

async function atualizarStatus(id, status, client) {
  const db = client || pool;
  const sql = `
    UPDATE chaves
    SET
      status = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [id, status]);
  return rows[0] || null;
}

async function excluir(id, client) {
  const db = client || pool;
  const sql = `
    DELETE FROM chaves
    WHERE id = $1
    RETURNING id;
  `;

  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

module.exports = {
  listarPorEvento,
  buscarPorIdNoEvento,
  buscarPorId,
  buscarPorCategoria,
  criar,
  atualizarStatus,
  excluir,
};
