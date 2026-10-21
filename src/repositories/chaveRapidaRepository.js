const pool = require('../config/database');

/**
 * Repositório para operações nas tabelas chaves_rapidas e inscricoes_chaves_rapidas.
 */

async function criar({ evento_id, nome }, client = pool) {
  const sql = `
    INSERT INTO chaves_rapidas (evento_id, nome)
    VALUES ($1, $2)
    RETURNING *;
  `;
  const { rows } = await client.query(sql, [evento_id, nome]);
  return rows[0];
}

async function buscarPorIdNoEvento(id, eventoId, client = pool) {
  const sql = `
    SELECT
      cr.*,
      e.nome AS evento_nome,
      ch.id AS chave_id,
      ch.tamanho AS chave_tamanho,
      ch.status AS chave_status,
      COUNT(icr.id)::INTEGER AS total_inscritos
    FROM chaves_rapidas cr
    JOIN eventos e ON e.id = cr.evento_id
    LEFT JOIN chaves ch ON ch.chave_rapida_id = cr.id
    LEFT JOIN inscricoes_chaves_rapidas icr ON icr.chave_rapida_id = cr.id
    WHERE cr.id = $1 AND cr.evento_id = $2
    GROUP BY cr.id, e.nome, ch.id, ch.tamanho, ch.status;
  `;
  const { rows } = await client.query(sql, [id, eventoId]);
  return rows[0] || null;
}

async function listarPorEvento(eventoId, client = pool) {
  const sql = `
    SELECT
      cr.id,
      cr.evento_id,
      cr.nome,
      cr.status,
      cr.created_at,
      cr.updated_at,
      ch.id AS chave_id,
      ch.tamanho AS chave_tamanho,
      ch.status AS chave_status,
      COUNT(icr.id)::INTEGER AS total_inscritos
    FROM chaves_rapidas cr
    LEFT JOIN chaves ch ON ch.chave_rapida_id = cr.id
    LEFT JOIN inscricoes_chaves_rapidas icr ON icr.chave_rapida_id = cr.id
    WHERE cr.evento_id = $1
    GROUP BY cr.id, ch.id, ch.tamanho, ch.status
    ORDER BY cr.created_at DESC;
  `;
  const { rows } = await client.query(sql, [eventoId]);
  return rows;
}

async function excluir(id, eventoId, client = pool) {
  const sql = `
    DELETE FROM chaves_rapidas
    WHERE id = $1 AND evento_id = $2
    RETURNING *;
  `;
  const { rows } = await client.query(sql, [id, eventoId]);
  return rows[0] || null;
}

async function adicionarInscrito({ chave_rapida_id, nome, equipe_id, inscricao_id }, client = pool) {
  const sql = `
    INSERT INTO inscricoes_chaves_rapidas (chave_rapida_id, nome, equipe_id, inscricao_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const { rows } = await client.query(sql, [
    chave_rapida_id,
    nome,
    equipe_id || null,
    inscricao_id || null,
  ]);
  return rows[0];
}

async function removerInscrito(id, chaveRapidaId, client = pool) {
  const sql = `
    DELETE FROM inscricoes_chaves_rapidas
    WHERE id = $1 AND chave_rapida_id = $2
    RETURNING *;
  `;
  const { rows } = await client.query(sql, [id, chaveRapidaId]);
  return rows[0] || null;
}

async function listarInscritos(chaveRapidaId, client = pool) {
  const sql = `
    SELECT
      icr.id,
      icr.chave_rapida_id,
      icr.inscricao_id,
      icr.nome,
      icr.equipe_id,
      icr.created_at,
      eq.nome AS equipe_nome
    FROM inscricoes_chaves_rapidas icr
    LEFT JOIN equipes eq ON eq.id = icr.equipe_id
    WHERE icr.chave_rapida_id = $1
    ORDER BY icr.id ASC;
  `;
  const { rows } = await client.query(sql, [chaveRapidaId]);
  return rows;
}

async function atualizarStatus(id, status, client = pool) {
  const sql = `
    UPDATE chaves_rapidas
    SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;
  const { rows } = await client.query(sql, [id, status]);
  return rows[0] || null;
}

module.exports = {
  criar,
  buscarPorIdNoEvento,
  listarPorEvento,
  excluir,
  adicionarInscrito,
  removerInscrito,
  listarInscritos,
  atualizarStatus,
};
