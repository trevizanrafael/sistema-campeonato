const pool = require('../config/database');

/**
 * Repositório de acesso a dados para regras de pontuação de eventos.
 */

async function buscarPorEvento(eventoId, client = pool) {
  const query = `
    SELECT
        id,
        evento_id,
        pontos_vitoria,
        pontos_primeiro,
        pontos_segundo,
        pontos_terceiro,
        bye_pontua,
        created_at,
        updated_at
    FROM regras_pontuacao
    WHERE evento_id = $1;
  `;

  const resultado = await client.query(query, [eventoId]);
  return resultado.rows[0] || null;
}

async function buscarPorEventoParaAtualizacao(eventoId, client) {
  const query = `
    SELECT *
    FROM regras_pontuacao
    WHERE evento_id = $1
    FOR UPDATE;
  `;

  const resultado = await client.query(query, [eventoId]);
  return resultado.rows[0] || null;
}

async function criarPadrao(eventoId, client = pool) {
  const query = `
    INSERT INTO regras_pontuacao (
        evento_id,
        pontos_vitoria,
        pontos_primeiro,
        pontos_segundo,
        pontos_terceiro,
        bye_pontua
    )
    VALUES ($1, 0, 0, 0, 0, FALSE)
    RETURNING *;
  `;

  const resultado = await client.query(query, [eventoId]);
  return resultado.rows[0];
}

async function atualizar(eventoId, dados, client = pool) {
  const query = `
    UPDATE regras_pontuacao
    SET
        pontos_vitoria = $1,
        pontos_primeiro = $2,
        pontos_segundo = $3,
        pontos_terceiro = $4,
        bye_pontua = $5,
        updated_at = NOW()
    WHERE evento_id = $6
    RETURNING *;
  `;

  const params = [
    dados.pontos_vitoria,
    dados.pontos_primeiro,
    dados.pontos_segundo,
    dados.pontos_terceiro,
    Boolean(dados.bye_pontua),
    eventoId,
  ];

  const resultado = await client.query(query, params);
  return resultado.rows[0] || null;
}

async function possuiLancamentos(eventoId, client = pool) {
  const query = `
    SELECT EXISTS (
        SELECT 1
        FROM pontos_equipes
        WHERE evento_id = $1
    ) AS possui_lancamentos;
  `;

  const resultado = await client.query(query, [eventoId]);
  return Boolean(resultado.rows[0]?.possui_lancamentos);
}

module.exports = {
  buscarPorEvento,
  buscarPorEventoParaAtualizacao,
  criarPadrao,
  atualizar,
  possuiLancamentos,
};
