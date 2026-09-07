const pool = require('../config/database');

async function buscarPorId(id) {
  const { rows } = await pool.query(
    `SELECT id, nome, email, ativo, created_at, updated_at
     FROM usuarios
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function buscarPorEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, nome, email, senha_hash, ativo, created_at, updated_at
     FROM usuarios
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function listarTodos() {
  const { rows } = await pool.query(
    `SELECT id, nome, email, ativo, created_at, updated_at
     FROM usuarios
     ORDER BY nome`
  );
  return rows;
}

async function criar(dados) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash)
     VALUES ($1, LOWER($2), $3)
     RETURNING id, nome, email, ativo, created_at`,
    [dados.nome, dados.email, dados.senhaHash]
  );
  return rows[0];
}

async function atualizar(id, dados) {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET nome = $1, email = LOWER($2), updated_at = NOW()
     WHERE id = $3
     RETURNING id, nome, email, ativo, updated_at`,
    [dados.nome, dados.email, id]
  );
  return rows[0] || null;
}

async function atualizarSenha(id, senhaHash) {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET senha_hash = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id`,
    [senhaHash, id]
  );
  return rows[0] || null;
}

async function alterarStatus(id, ativo) {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET ativo = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, nome, email, ativo`,
    [ativo, id]
  );
  return rows[0] || null;
}

async function emailJaExiste(email, ignorarUsuarioId = null) {
  let query = 'SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)';
  const params = [email];

  if (ignorarUsuarioId) {
    query += ' AND id <> $2';
    params.push(ignorarUsuarioId);
  }

  const { rows } = await pool.query(query, params);
  return rows.length > 0;
}

async function contarAtivos() {
  const { rows } = await pool.query(
    'SELECT COUNT(*) AS total FROM usuarios WHERE ativo = TRUE'
  );
  return parseInt(rows[0].total, 10);
}

module.exports = {
  buscarPorId,
  buscarPorEmail,
  listarTodos,
  criar,
  atualizar,
  atualizarSenha,
  alterarStatus,
  emailJaExiste,
  contarAtivos,
};
