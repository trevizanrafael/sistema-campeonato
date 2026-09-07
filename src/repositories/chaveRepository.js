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
      c.evento_id,
      e.nome AS evento_nome,
      p1.nome AS primeiro_lugar_nome,
      e1.nome AS primeiro_lugar_equipe_nome,
      p2.nome AS segundo_lugar_nome,
      e2.nome AS segundo_lugar_equipe_nome,
      p3.nome AS terceiro_lugar_nome,
      e3.nome AS terceiro_lugar_equipe_nome
    FROM chaves ch
    JOIN categorias c ON c.id = ch.categoria_id
    JOIN eventos e ON e.id = c.evento_id
    LEFT JOIN inscricoes p1 ON p1.id = ch.primeiro_lugar_id
    LEFT JOIN equipes e1 ON e1.id = p1.equipe_id
    LEFT JOIN inscricoes p2 ON p2.id = ch.segundo_lugar_id
    LEFT JOIN equipes e2 ON e2.id = p2.equipe_id
    LEFT JOIN inscricoes p3 ON p3.id = ch.terceiro_lugar_id
    LEFT JOIN equipes e3 ON e3.id = p3.equipe_id
    WHERE ch.id = $1 AND c.evento_id = $2;
  `;

  const { rows } = await db.query(sql, [chaveId, eventoId]);
  return rows[0] || null;
}

async function bloquearPorIdNoEvento(chaveId, eventoId, client) {
  const db = client || pool;
  const sql = `
    SELECT
      ch.*,
      c.nome AS categoria_nome,
      c.evento_id
    FROM chaves ch
    JOIN categorias c ON c.id = ch.categoria_id
    WHERE ch.id = $1 AND c.evento_id = $2
    FOR UPDATE OF ch;
  `;

  const { rows } = await db.query(sql, [chaveId, eventoId]);
  return rows[0] || null;
}

async function salvarPodio(chaveId, dados, client) {
  const db = client || pool;
  const sql = `
    UPDATE chaves
    SET
      primeiro_lugar_id = $1,
      segundo_lugar_id = $2,
      terceiro_lugar_id = $3,
      colocacao_editada_manualmente = FALSE,
      colocacao_editada_por = NULL,
      colocacao_editada_em = NULL,
      motivo_edicao_colocacao = NULL,
      status = 'FINALIZADA',
      updated_at = NOW()
    WHERE id = $4
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [
    dados.primeiro_lugar_id,
    dados.segundo_lugar_id,
    dados.terceiro_lugar_id,
    chaveId,
  ]);
  return rows[0] || null;
}

async function limparPodioEReabrir(chaveId, client) {
  const db = client || pool;
  const sql = `
    UPDATE chaves
    SET
      primeiro_lugar_id = NULL,
      segundo_lugar_id = NULL,
      terceiro_lugar_id = NULL,
      colocacao_editada_manualmente = FALSE,
      colocacao_editada_por = NULL,
      colocacao_editada_em = NULL,
      motivo_edicao_colocacao = NULL,
      status = 'EM_ANDAMENTO',
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [chaveId]);
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
  bloquearPorIdNoEvento,
  salvarPodio,
  limparPodioEReabrir,
  buscarPorId,
  buscarPorCategoria,
  criar,
  atualizarStatus,
  excluir,
};
