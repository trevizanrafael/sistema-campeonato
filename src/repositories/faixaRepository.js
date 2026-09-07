const pool = require('../config/database');

async function listarTodas(client) {
  const db = client || pool;
  const sql = `
    SELECT
      id,
      nome,
      ordem,
      created_at,
      updated_at
    FROM faixas
    ORDER BY ordem ASC, nome ASC;
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
      ordem,
      created_at,
      updated_at
    FROM faixas
    WHERE id = $1;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function buscarPorIdParaAtualizacao(id, client) {
  const db = client || pool;
  const sql = `
    SELECT
      id,
      nome,
      ordem
    FROM faixas
    WHERE id = $1
    FOR UPDATE;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function buscarPorNome(nome, ignorarId = null, client) {
  const db = client || pool;
  const sql = `
    SELECT
      id,
      nome,
      ordem
    FROM faixas
    WHERE LOWER(nome) = LOWER($1)
      AND ($2::BIGINT IS NULL OR id <> $2::BIGINT)
    LIMIT 1;
  `;
  const { rows } = await db.query(sql, [nome, ignorarId]);
  return rows[0] || null;
}

async function buscarAnterior(ordem, client) {
  const db = client || pool;
  const sql = `
    SELECT
      id,
      nome,
      ordem
    FROM faixas
    WHERE ordem < $1
    ORDER BY ordem DESC
    LIMIT 1
    FOR UPDATE;
  `;
  const { rows } = await db.query(sql, [ordem]);
  return rows[0] || null;
}

async function buscarProxima(ordem, client) {
  const db = client || pool;
  const sql = `
    SELECT
      id,
      nome,
      ordem
    FROM faixas
    WHERE ordem > $1
    ORDER BY ordem ASC
    LIMIT 1
    FOR UPDATE;
  `;
  const { rows } = await db.query(sql, [ordem]);
  return rows[0] || null;
}

async function buscarMaiorOrdem(client) {
  const db = client || pool;
  const sql = `
    SELECT COALESCE(MAX(ordem), 0) AS maior_ordem
    FROM faixas;
  `;
  const { rows } = await db.query(sql);
  return rows[0].maior_ordem;
}

async function buscarProximaOrdem(client) {
  const db = client || pool;
  const sql = `
    SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem
    FROM faixas;
  `;
  const { rows } = await db.query(sql);
  return rows[0].proxima_ordem;
}

async function criar(dados, client) {
  const db = client || pool;
  const sql = `
    INSERT INTO faixas (
      nome,
      ordem
    )
    VALUES ($1, $2)
    RETURNING
      id,
      nome,
      ordem,
      created_at,
      updated_at;
  `;
  const { rows } = await db.query(sql, [dados.nome, dados.ordem]);
  return rows[0];
}

async function atualizar(id, dados, client) {
  const db = client || pool;
  const sql = `
    UPDATE faixas
    SET
      nome = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING
      id,
      nome,
      ordem,
      created_at,
      updated_at;
  `;
  const { rows } = await db.query(sql, [dados.nome, id]);
  return rows[0] || null;
}

async function alterarOrdem(id, ordem, client) {
  const db = client || pool;
  const sql = `
    UPDATE faixas
    SET
      ordem = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING
      id,
      nome,
      ordem;
  `;
  const { rows } = await db.query(sql, [ordem, id]);
  return rows[0] || null;
}

async function contarDependencias(id, client) {
  const db = client || pool;
  const sql = `
    SELECT
      (
        SELECT COUNT(*)
        FROM categorias
        WHERE faixa_minima_id = $1
      )::INTEGER AS total_como_minima,

      (
        SELECT COUNT(*)
        FROM categorias
        WHERE faixa_maxima_id = $1
      )::INTEGER AS total_como_maxima,

      (
        SELECT COUNT(*)
        FROM inscricoes
        WHERE faixa_id = $1
      )::INTEGER AS total_inscricoes;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0];
}

async function excluir(id, client) {
  const db = client || pool;
  const sql = `
    DELETE FROM faixas
    WHERE id = $1
    RETURNING id, nome, ordem;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

module.exports = {
  listarTodas,
  buscarPorId,
  buscarPorIdParaAtualizacao,
  buscarPorNome,
  buscarAnterior,
  buscarProxima,
  buscarMaiorOrdem,
  buscarProximaOrdem,
  criar,
  atualizar,
  alterarOrdem,
  contarDependencias,
  excluir,
};
