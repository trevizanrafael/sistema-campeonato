const pool = require('../config/database');

async function buscarPorId(id) {
  const { rows } = await pool.query(
    `SELECT id, nome, email, cargo, ultimo_evento_id, ativo, created_at, updated_at
     FROM usuarios
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function buscarPorEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, nome, email, cargo, senha_hash, ativo, created_at, updated_at
     FROM usuarios
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function listarTodos() {
  const { rows } = await pool.query(
    `SELECT id, nome, email, cargo, ativo, created_at, updated_at
     FROM usuarios
     ORDER BY nome`
  );
  return rows;
}

async function criar(dados) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, cargo)
     VALUES ($1, LOWER($2), $3, $4)
     RETURNING id, nome, email, cargo, ativo, created_at`,
    [dados.nome, dados.email, dados.senhaHash, dados.cargo]
  );
  return rows[0];
}

async function atualizar(id, dados) {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET nome = $1, email = LOWER($2), cargo = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING id, nome, email, cargo, ativo, updated_at`,
    [dados.nome, dados.email, dados.cargo, id]
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

async function contarAdministradoresAtivos() {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total
     FROM usuarios
     WHERE ativo = TRUE AND cargo = 'ADMINISTRADOR'`
  );
  return parseInt(rows[0].total, 10);
}

async function atualizarUltimoEvento(id, eventoId) {
  await pool.query(
    'UPDATE usuarios SET ultimo_evento_id = $1 WHERE id = $2',
    [eventoId, id]
  );
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
  contarAdministradoresAtivos,
  atualizarUltimoEvento,
};
