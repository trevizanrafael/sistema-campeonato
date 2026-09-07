const pool = require('../config/database');

/**
 * Repositório para lançamentos na tabela pontos_equipes.
 */

async function criarPontoVitoria(dados, client) {
  const db = client || pool;
  const sql = `
    INSERT INTO pontos_equipes (
      evento_id,
      equipe_id,
      inscricao_id,
      luta_id,
      chave_id,
      tipo,
      pontos,
      descricao
    )
    VALUES ($1, $2, $3, $4, $5, 'VITORIA', $6, $7)
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [
    dados.evento_id,
    dados.equipe_id,
    dados.inscricao_id || null,
    dados.luta_id || null,
    dados.chave_id || null,
    dados.pontos,
    dados.descricao || null,
  ]);

  return rows[0];
}

async function buscarPorLuta(lutaId, client) {
  const db = client || pool;
  const sql = `
    SELECT *
    FROM pontos_equipes
    WHERE luta_id = $1 AND tipo = 'VITORIA';
  `;

  const { rows } = await db.query(sql, [lutaId]);
  return rows[0] || null;
}

async function excluirPontoVitoria(lutaId, client) {
  const db = client || pool;
  const sql = `
    DELETE FROM pontos_equipes
    WHERE luta_id = $1 AND tipo = 'VITORIA'
    RETURNING id;
  `;

  const { rows } = await db.query(sql, [lutaId]);
  return rows[0] || null;
}

async function criarPontoColocacao(dados, client) {
  const db = client || pool;
  const sql = `
    INSERT INTO pontos_equipes (
      evento_id,
      equipe_id,
      inscricao_id,
      chave_id,
      tipo,
      pontos,
      descricao
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [
    dados.evento_id,
    dados.equipe_id,
    dados.inscricao_id || null,
    dados.chave_id,
    dados.tipo,
    dados.pontos,
    dados.descricao || null,
  ]);

  return rows[0];
}

async function buscarPontosAtuaisPorEvento(eventoId, chaveIdExcluida = null, client = null) {
  let clientToUse = client;
  let chaveExcluir = chaveIdExcluida;
  if (chaveIdExcluida && typeof chaveIdExcluida === 'object' && chaveIdExcluida.query) {
    clientToUse = chaveIdExcluida;
    chaveExcluir = null;
  }

  const db = clientToUse || pool;
  let sql = `
    SELECT
      equipe_id,
      COALESCE(SUM(pontos), 0)::INTEGER AS pontos_atuais
    FROM pontos_equipes
    WHERE evento_id = $1
  `;
  const params = [eventoId];

  if (chaveExcluir) {
    params.push(chaveExcluir);
    sql += ` AND (chave_id IS NULL OR chave_id <> $2)`;
  }

  sql += ` GROUP BY equipe_id;`;

  const { rows } = await db.query(sql, params);
  return rows;
}

async function buscarPontosVitoriaPorChave(chaveId, client = null) {
  const db = client || pool;
  const sql = `
    SELECT
      pe.equipe_id,
      e.nome AS equipe_nome,
      COALESCE(SUM(pe.pontos), 0)::INTEGER AS pontos_vitorias,
      COUNT(*)::INTEGER AS total_vitorias
    FROM pontos_equipes pe
    JOIN equipes e ON e.id = pe.equipe_id
    WHERE pe.chave_id = $1
      AND pe.tipo = 'VITORIA'
    GROUP BY pe.equipe_id, e.nome;
  `;

  const { rows } = await db.query(sql, [chaveId]);
  return rows;
}

async function buscarPorChave(chaveId, client = null) {
  const db = client || pool;
  const sql = `
    SELECT *
    FROM pontos_equipes
    WHERE chave_id = $1
    ORDER BY id ASC;
  `;
  const { rows } = await db.query(sql, [chaveId]);
  return rows;
}

async function excluirPontosColocacaoPorChave(chaveId, client) {
  const db = client || pool;
  const sql = `
    DELETE FROM pontos_equipes
    WHERE chave_id = $1
      AND tipo IN ('PRIMEIRO_LUGAR', 'SEGUNDO_LUGAR', 'TERCEIRO_LUGAR')
    RETURNING id;
  `;

  const { rows } = await db.query(sql, [chaveId]);
  return rows;
}

module.exports = {
  criarPontoVitoria,
  buscarPorLuta,
  excluirPontoVitoria,
  criarPontoColocacao,
  buscarPontosAtuaisPorEvento,
  buscarPontosVitoriaPorChave,
  buscarPorChave,
  excluirPontosColocacaoPorChave,
};
