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

module.exports = {
  criarPontoVitoria,
  buscarPorLuta,
  excluirPontoVitoria,
};
