const pool = require('../config/database');

async function listar({ busca = '', limite = 10, offset = 0 } = {}) {
  const sql = `
    SELECT
      e.id,
      e.nome,
      e.descricao,
      e.created_at,
      e.updated_at,
      COUNT(DISTINCT c.id)::INTEGER AS total_categorias,
      COUNT(DISTINCT i.id)::INTEGER AS total_inscricoes
    FROM eventos e
    LEFT JOIN categorias c
      ON c.evento_id = e.id
    LEFT JOIN inscricoes i
      ON i.evento_id = e.id
    WHERE (
      $1 = ''
      OR e.nome ILIKE '%' || $1 || '%'
      OR COALESCE(e.descricao, '') ILIKE '%' || $1 || '%'
    )
    GROUP BY e.id
    ORDER BY e.created_at DESC
    LIMIT $2
    OFFSET $3;
  `;
  const { rows } = await pool.query(sql, [busca, limite, offset]);
  return rows;
}

async function contar({ busca = '' } = {}) {
  const sql = `
    SELECT COUNT(*)::INTEGER AS total
    FROM eventos
    WHERE (
      $1 = ''
      OR nome ILIKE '%' || $1 || '%'
      OR COALESCE(descricao, '') ILIKE '%' || $1 || '%'
    );
  `;
  const { rows } = await pool.query(sql, [busca]);
  return rows[0].total;
}

async function buscarPorId(id, client) {
  const db = client || pool;
  const sql = `
    SELECT
      id,
      nome,
      descricao,
      created_at,
      updated_at
    FROM eventos
    WHERE id = $1;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function buscarComResumo(id) {
  const sql = `
    SELECT
      e.id,
      e.nome,
      e.descricao,
      e.created_at,
      e.updated_at,

      (
        SELECT COUNT(*)::INTEGER
        FROM categorias c
        WHERE c.evento_id = e.id
      ) AS total_categorias,

      (
        SELECT COUNT(*)::INTEGER
        FROM inscricoes i
        WHERE i.evento_id = e.id
      ) AS total_inscricoes,

      (
        SELECT COUNT(*)::INTEGER
        FROM chaves ch
        JOIN categorias c
          ON c.id = ch.categoria_id
        WHERE c.evento_id = e.id
      ) AS total_chaves,

      (
        SELECT COUNT(*)::INTEGER
        FROM chaves ch
        JOIN categorias c
          ON c.id = ch.categoria_id
        WHERE c.evento_id = e.id
          AND ch.status = 'FINALIZADA'
      ) AS chaves_finalizadas

    FROM eventos e
    WHERE e.id = $1;
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

async function criar(dados, client) {
  const db = client || pool;
  const sql = `
    INSERT INTO eventos (nome, descricao)
    VALUES ($1, $2)
    RETURNING id, nome, descricao, created_at, updated_at;
  `;
  const { rows } = await db.query(sql, [dados.nome, dados.descricao]);
  return rows[0];
}

async function atualizar(id, dados, client) {
  const db = client || pool;
  const sql = `
    UPDATE eventos
    SET
      nome = $1,
      descricao = $2,
      updated_at = NOW()
    WHERE id = $3
    RETURNING id, nome, descricao, created_at, updated_at;
  `;
  const { rows } = await db.query(sql, [dados.nome, dados.descricao, id]);
  return rows[0] || null;
}

async function contarDependencias(id, client) {
  const db = client || pool;
  const sql = `
    SELECT
      (
        SELECT COUNT(*)
        FROM categorias
        WHERE evento_id = $1
      )::INTEGER AS total_categorias,

      (
        SELECT COUNT(*)
        FROM inscricoes
        WHERE evento_id = $1
      )::INTEGER AS total_inscricoes,

      (
        SELECT COUNT(*)
        FROM pontos_equipes
        WHERE evento_id = $1
      )::INTEGER AS total_pontos;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0];
}

async function bloquearPorId(id, client) {
  const db = client || pool;
  const sql = `
    SELECT id
    FROM eventos
    WHERE id = $1
    FOR UPDATE;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function excluir(id, client) {
  const db = client || pool;
  const sql = `
    DELETE FROM eventos
    WHERE id = $1
    RETURNING id;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

module.exports = {
  listar,
  contar,
  buscarPorId,
  buscarComResumo,
  criar,
  atualizar,
  contarDependencias,
  bloquearPorId,
  excluir,
};
