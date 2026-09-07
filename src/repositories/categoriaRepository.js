const pool = require('../config/database');

/**
 * Repositório de acesso a dados para categorias.
 * Todas as operações garantem segurança e isolamento por evento.
 */

async function listarPorEvento(eventoId, client = pool) {
  const query = `
    SELECT
        c.id,
        c.evento_id,
        c.nome,
        c.idade_minima,
        c.idade_maxima,
        c.peso_minimo,
        c.peso_maximo,
        c.sexo,

        faixa_minima.id AS faixa_minima_id,
        faixa_minima.nome AS faixa_minima_nome,
        faixa_minima.ordem AS faixa_minima_ordem,

        faixa_maxima.id AS faixa_maxima_id,
        faixa_maxima.nome AS faixa_maxima_nome,
        faixa_maxima.ordem AS faixa_maxima_ordem,

        COUNT(DISTINCT i.id)::INTEGER AS total_inscricoes,
        COUNT(DISTINCT ch.id)::INTEGER AS total_chaves,

        c.created_at,
        c.updated_at
    FROM categorias c
    LEFT JOIN faixas faixa_minima
        ON faixa_minima.id = c.faixa_minima_id
    LEFT JOIN faixas faixa_maxima
        ON faixa_maxima.id = c.faixa_maxima_id
    LEFT JOIN inscricoes i
        ON i.categoria_id = c.id
    LEFT JOIN chaves ch
        ON ch.categoria_id = c.id
    WHERE c.evento_id = $1
    GROUP BY
        c.id,
        faixa_minima.id,
        faixa_maxima.id
    ORDER BY
        c.idade_minima NULLS FIRST,
        c.peso_maximo NULLS LAST,
        faixa_minima.ordem NULLS FIRST,
        c.nome;
  `;

  const resultado = await client.query(query, [eventoId]);
  return resultado.rows;
}

async function buscarPorIdNoEvento(id, eventoId, client = pool) {
  const query = `
    SELECT
        c.id,
        c.evento_id,
        c.nome,
        c.idade_minima,
        c.idade_maxima,
        c.peso_minimo,
        c.peso_maximo,
        c.faixa_minima_id,
        c.faixa_maxima_id,
        c.sexo,

        faixa_minima.nome AS faixa_minima_nome,
        faixa_minima.ordem AS faixa_minima_ordem,

        faixa_maxima.nome AS faixa_maxima_nome,
        faixa_maxima.ordem AS faixa_maxima_ordem,

        COUNT(DISTINCT i.id)::INTEGER AS total_inscricoes,
        COUNT(DISTINCT ch.id)::INTEGER AS total_chaves,

        c.created_at,
        c.updated_at
    FROM categorias c
    LEFT JOIN faixas faixa_minima
        ON faixa_minima.id = c.faixa_minima_id
    LEFT JOIN faixas faixa_maxima
        ON faixa_maxima.id = c.faixa_maxima_id
    LEFT JOIN inscricoes i
        ON i.categoria_id = c.id
    LEFT JOIN chaves ch
        ON ch.categoria_id = c.id
    WHERE c.id = $1
      AND c.evento_id = $2
    GROUP BY
        c.id,
        faixa_minima.id,
        faixa_maxima.id;
  `;

  const resultado = await client.query(query, [id, eventoId]);
  return resultado.rows[0] || null;
}

async function buscarPorNomeNoEvento(nome, eventoId, ignorarId = null, client = pool) {
  const query = `
    SELECT id, nome
    FROM categorias
    WHERE evento_id = $1
      AND LOWER(nome) = LOWER($2)
      AND ($3::BIGINT IS NULL OR id <> $3)
    LIMIT 1;
  `;

  const resultado = await client.query(query, [eventoId, nome, ignorarId]);
  return resultado.rows[0] || null;
}

async function criar(dados, client = pool) {
  const query = `
    INSERT INTO categorias (
        evento_id,
        nome,
        idade_minima,
        idade_maxima,
        peso_minimo,
        peso_maximo,
        faixa_minima_id,
        faixa_maxima_id,
        sexo
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;

  const params = [
    dados.evento_id,
    dados.nome,
    dados.idade_minima,
    dados.idade_maxima,
    dados.peso_minimo,
    dados.peso_maximo,
    dados.faixa_minima_id,
    dados.faixa_maxima_id,
    dados.sexo,
  ];

  const resultado = await client.query(query, params);
  return resultado.rows[0];
}

async function atualizar(id, eventoId, dados, client = pool) {
  const query = `
    UPDATE categorias
    SET
        nome = $1,
        idade_minima = $2,
        idade_maxima = $3,
        peso_minimo = $4,
        peso_maximo = $5,
        faixa_minima_id = $6,
        faixa_maxima_id = $7,
        sexo = $8,
        updated_at = NOW()
    WHERE id = $9
      AND evento_id = $10
    RETURNING *;
  `;

  const params = [
    dados.nome,
    dados.idade_minima,
    dados.idade_maxima,
    dados.peso_minimo,
    dados.peso_maximo,
    dados.faixa_minima_id,
    dados.faixa_maxima_id,
    dados.sexo,
    id,
    eventoId,
  ];

  const resultado = await client.query(query, params);
  return resultado.rows[0] || null;
}

async function atualizarApenasNome(id, eventoId, nome, client = pool) {
  const query = `
    UPDATE categorias
    SET
        nome = $1,
        updated_at = NOW()
    WHERE id = $2
      AND evento_id = $3
    RETURNING *;
  `;

  const resultado = await client.query(query, [nome, id, eventoId]);
  return resultado.rows[0] || null;
}

async function listarPossiveisConflitos(eventoId, ignorarId = null, client = pool) {
  const query = `
    SELECT
        c.id,
        c.evento_id,
        c.nome,
        c.idade_minima,
        c.idade_maxima,
        c.peso_minimo,
        c.peso_maximo,
        c.sexo,
        c.faixa_minima_id,
        c.faixa_maxima_id,
        faixa_minima.ordem AS faixa_minima_ordem,
        faixa_maxima.ordem AS faixa_maxima_ordem
    FROM categorias c
    LEFT JOIN faixas faixa_minima
        ON faixa_minima.id = c.faixa_minima_id
    LEFT JOIN faixas faixa_maxima
        ON faixa_maxima.id = c.faixa_maxima_id
    WHERE c.evento_id = $1
      AND ($2::BIGINT IS NULL OR c.id <> $2)
    ORDER BY c.nome;
  `;

  const resultado = await client.query(query, [eventoId, ignorarId]);
  return resultado.rows;
}

async function listarInscricoesVinculadas(categoriaId, client = pool) {
  const query = `
    SELECT
        i.id,
        i.nome,
        i.idade,
        i.peso,
        i.sexo,
        f.id AS faixa_id,
        f.nome AS faixa_nome,
        f.ordem AS faixa_ordem
    FROM inscricoes i
    JOIN faixas f ON f.id = i.faixa_id
    WHERE i.categoria_id = $1
    ORDER BY i.nome;
  `;

  const resultado = await client.query(query, [categoriaId]);
  return resultado.rows;
}

async function contarDependencias(categoriaId, client = pool) {
  const query = `
    SELECT
        (
            SELECT COUNT(*)
            FROM inscricoes
            WHERE categoria_id = $1
        )::INTEGER AS total_inscricoes,

        (
            SELECT COUNT(*)
            FROM chaves
            WHERE categoria_id = $1
        )::INTEGER AS total_chaves;
  `;

  const resultado = await client.query(query, [categoriaId]);
  return (
    resultado.rows[0] || {
      total_inscricoes: 0,
      total_chaves: 0,
    }
  );
}

async function bloquearPorIdNoEvento(id, eventoId, client) {
  const query = `
    SELECT id, nome
    FROM categorias
    WHERE id = $1
      AND evento_id = $2
    FOR UPDATE;
  `;

  const resultado = await client.query(query, [id, eventoId]);
  return resultado.rows[0] || null;
}

async function excluir(id, eventoId, client = pool) {
  const query = `
    DELETE FROM categorias
    WHERE id = $1
      AND evento_id = $2
    RETURNING id, nome;
  `;

  const resultado = await client.query(query, [id, eventoId]);
  return resultado.rows[0] || null;
}

module.exports = {
  listarPorEvento,
  buscarPorIdNoEvento,
  buscarPorNomeNoEvento,
  criar,
  atualizar,
  atualizarApenasNome,
  listarPossiveisConflitos,
  listarInscricoesVinculadas,
  contarDependencias,
  bloquearPorIdNoEvento,
  excluir,
};
