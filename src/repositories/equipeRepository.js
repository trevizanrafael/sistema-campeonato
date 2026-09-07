const pool = require('../config/database');

async function listarTodas(client) {
  const db = client || pool;
  const sql = `
    SELECT
      e.id,
      e.nome,
      e.created_at,
      COUNT(i.id)::INTEGER AS total_inscricoes
    FROM equipes e
    LEFT JOIN inscricoes i ON i.equipe_id = e.id
    GROUP BY e.id
    ORDER BY e.nome;
  `;
  const { rows } = await db.query(sql);
  return rows;
}

async function buscarPorId(id, client) {
  const db = client || pool;
  const sql = `
    SELECT
      id,
      nome,
      created_at,
      updated_at
    FROM equipes
    WHERE id = $1;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function buscarPorNome(nome, ignorarId = null, client) {
  const db = client || pool;
  const sql = `
    SELECT
      id,
      nome
    FROM equipes
    WHERE LOWER(nome) = LOWER($1)
      AND ($2::BIGINT IS NULL OR id <> $2::BIGINT)
    LIMIT 1;
  `;
  const { rows } = await db.query(sql, [nome, ignorarId]);
  return rows[0] || null;
}

async function criar(nome, client) {
  const db = client || pool;
  const sql = `
    INSERT INTO equipes (nome)
    VALUES ($1)
    RETURNING *;
  `;
  const { rows } = await db.query(sql, [nome]);
  return rows[0];
}

async function atualizar(id, nome, client) {
  const db = client || pool;
  const sql = `
    UPDATE equipes
    SET
      nome = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING *;
  `;
  const { rows } = await db.query(sql, [nome, id]);
  return rows[0] || null;
}

async function contarInscricoes(id, client) {
  const db = client || pool;
  const sql = `
    SELECT COUNT(*)::INTEGER AS total
    FROM inscricoes
    WHERE equipe_id = $1;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0].total;
}

async function excluir(id, client) {
  const db = client || pool;
  const sql = `
    DELETE FROM equipes
    WHERE id = $1
    RETURNING id;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

module.exports = {
  listarTodas,
  buscarPorId,
  buscarPorNome,
  criar,
  atualizar,
  contarInscricoes,
  excluir,
};
