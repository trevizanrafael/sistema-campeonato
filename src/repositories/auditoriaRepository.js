const pool = require('../config/database');

/**
 * Repositório para persistência e consultas de logs de auditoria.
 */

async function registrar(dados, client) {
  const db = client || pool;
  const sql = `
    INSERT INTO logs_auditoria (
      usuario_id,
      evento_id,
      acao,
      entidade,
      entidade_id,
      descricao,
      dados_anteriores,
      dados_novos
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [
    dados.usuario_id || null,
    dados.evento_id || null,
    dados.acao,
    dados.entidade,
    dados.entidade_id || null,
    dados.descricao,
    dados.dados_anteriores ? JSON.stringify(dados.dados_anteriores) : null,
    dados.dados_novos ? JSON.stringify(dados.dados_novos) : null,
  ]);

  return rows[0];
}

async function listarPorEvento(eventoId, filtros = {}, client) {
  const db = client || pool;
  const conditions = ['l.evento_id = $1'];
  const params = [eventoId];
  let paramIndex = 2;

  if (filtros.acao && filtros.acao.trim()) {
    conditions.push(`l.acao = $${paramIndex}`);
    params.push(filtros.acao.trim());
    paramIndex++;
  }

  if (filtros.usuario_id) {
    conditions.push(`l.usuario_id = $${paramIndex}`);
    params.push(filtros.usuario_id);
    paramIndex++;
  }

  const limite = Math.max(1, parseInt(filtros.limite, 10) || 25);
  const offset = Math.max(0, parseInt(filtros.offset, 10) || 0);

  const sql = `
    SELECT
      l.*,
      u.nome AS usuario_nome,
      u.email AS usuario_email
    FROM logs_auditoria l
    LEFT JOIN usuarios u ON u.id = l.usuario_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
  `;
  params.push(limite, offset);

  const { rows } = await db.query(sql, params);
  return rows;
}

async function contarPorEvento(eventoId, filtros = {}, client) {
  const db = client || pool;
  const conditions = ['evento_id = $1'];
  const params = [eventoId];
  let paramIndex = 2;

  if (filtros.acao && filtros.acao.trim()) {
    conditions.push(`acao = $${paramIndex}`);
    params.push(filtros.acao.trim());
    paramIndex++;
  }

  if (filtros.usuario_id) {
    conditions.push(`usuario_id = $${paramIndex}`);
    params.push(filtros.usuario_id);
    paramIndex++;
  }

  const sql = `
    SELECT COUNT(*)::INTEGER AS total
    FROM logs_auditoria
    WHERE ${conditions.join(' AND ')};
  `;

  const { rows } = await db.query(sql, params);
  return rows[0] ? rows[0].total : 0;
}

async function buscarPorIdNoEvento(logId, eventoId, client) {
  const db = client || pool;
  const sql = `
    SELECT
      l.*,
      u.nome AS usuario_nome,
      u.email AS usuario_email
    FROM logs_auditoria l
    LEFT JOIN usuarios u ON u.id = l.usuario_id
    WHERE l.id = $1 AND l.evento_id = $2;
  `;

  const { rows } = await db.query(sql, [logId, eventoId]);
  return rows[0] || null;
}

module.exports = {
  registrar,
  listarPorEvento,
  contarPorEvento,
  buscarPorIdNoEvento,
};
