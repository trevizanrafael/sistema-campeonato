const pool = require('../config/database');

/**
 * Repositório de acesso a dados para Inscrições de competidores.
 * Garante segurança, isolamento por evento e verificação de integridade referencial.
 */

async function listarPorEvento(eventoId, filtros = {}, client = pool) {
  let query = `
    SELECT
        i.id,
        i.evento_id,
        i.categoria_id,
        i.equipe_id,
        i.faixa_id,
        i.nome,
        i.idade,
        i.peso,
        i.sexo,
        i.status,
        i.seed,
        i.created_at,
        i.updated_at,

        e.nome AS equipe_nome,
        f.nome AS faixa_nome,
        f.ordem AS faixa_ordem,
        c.nome AS categoria_nome,

        EXISTS (
            SELECT 1 FROM lutas l
            WHERE l.competidor_1_id = i.id
               OR l.competidor_2_id = i.id
               OR l.vencedor_id = i.id
               OR l.perdedor_id = i.id
        ) AS participa_luta

    FROM inscricoes i
    JOIN equipes e ON e.id = i.equipe_id
    JOIN faixas f ON f.id = i.faixa_id
    LEFT JOIN categorias c ON c.id = i.categoria_id
    WHERE i.evento_id = $1
  `;

  const params = [eventoId];
  let paramIndex = 2;

  if (filtros.busca && filtros.busca.trim() !== '') {
    query += ` AND (
        LOWER(i.nome) LIKE $${paramIndex}
        OR LOWER(e.nome) LIKE $${paramIndex}
        OR LOWER(COALESCE(c.nome, '')) LIKE $${paramIndex}
    )`;
    params.push(`%${filtros.busca.trim().toLowerCase()}%`);
    paramIndex++;
  }

  if (filtros.status && filtros.status.trim() !== '') {
    query += ` AND i.status = $${paramIndex}`;
    params.push(filtros.status.trim());
    paramIndex++;
  }

  if (filtros.categoria_id) {
    if (filtros.categoria_id === 'sem_categoria') {
      query += ` AND i.categoria_id IS NULL`;
    } else {
      query += ` AND i.categoria_id = $${paramIndex}`;
      params.push(filtros.categoria_id);
      paramIndex++;
    }
  }

  if (filtros.equipe_id) {
    query += ` AND i.equipe_id = $${paramIndex}`;
    params.push(filtros.equipe_id);
    paramIndex++;
  }

  query += `
    ORDER BY
        c.nome NULLS FIRST,
        i.nome;
  `;

  const resultado = await client.query(query, params);
  return resultado.rows;
}

async function contarPorEvento(eventoId, filtros = {}, client = pool) {
  let query = `
    SELECT COUNT(*)::INTEGER AS total
    FROM inscricoes i
    JOIN equipes e ON e.id = i.equipe_id
    LEFT JOIN categorias c ON c.id = i.categoria_id
    WHERE i.evento_id = $1
  `;

  const params = [eventoId];
  let paramIndex = 2;

  if (filtros.busca && filtros.busca.trim() !== '') {
    query += ` AND (
        LOWER(i.nome) LIKE $${paramIndex}
        OR LOWER(e.nome) LIKE $${paramIndex}
        OR LOWER(COALESCE(c.nome, '')) LIKE $${paramIndex}
    )`;
    params.push(`%${filtros.busca.trim().toLowerCase()}%`);
    paramIndex++;
  }

  if (filtros.status && filtros.status.trim() !== '') {
    query += ` AND i.status = $${paramIndex}`;
    params.push(filtros.status.trim());
    paramIndex++;
  }

  if (filtros.categoria_id) {
    if (filtros.categoria_id === 'sem_categoria') {
      query += ` AND i.categoria_id IS NULL`;
    } else {
      query += ` AND i.categoria_id = $${paramIndex}`;
      params.push(filtros.categoria_id);
      paramIndex++;
    }
  }

  if (filtros.equipe_id) {
    query += ` AND i.equipe_id = $${paramIndex}`;
    params.push(filtros.equipe_id);
    paramIndex++;
  }

  const resultado = await client.query(query, params);
  return resultado.rows[0].total;
}

async function buscarResumoStatus(eventoId, client = pool) {
  const query = `
    SELECT
        COUNT(*)::INTEGER AS total,

        COUNT(*) FILTER (
            WHERE status = 'CONFIRMADA'
        )::INTEGER AS confirmadas,

        COUNT(*) FILTER (
            WHERE status = 'PENDENTE'
        )::INTEGER AS pendentes,

        COUNT(*) FILTER (
            WHERE status = 'CANCELADA'
        )::INTEGER AS canceladas,

        COUNT(*) FILTER (
            WHERE status = 'DESCLASSIFICADA'
        )::INTEGER AS desclassificadas

    FROM inscricoes
    WHERE evento_id = $1;
  `;

  const resultado = await client.query(query, [eventoId]);
  return (
    resultado.rows[0] || {
      total: 0,
      confirmadas: 0,
      pendentes: 0,
      canceladas: 0,
      desclassificadas: 0,
    }
  );
}

async function buscarPorIdNoEvento(id, eventoId, client = pool) {
  const query = `
    SELECT *
    FROM inscricoes
    WHERE id = $1
      AND evento_id = $2;
  `;

  const resultado = await client.query(query, [id, eventoId]);
  return resultado.rows[0] || null;
}

async function buscarComRelacionamentos(id, eventoId, client = pool) {
  const query = `
    SELECT
        i.id,
        i.evento_id,
        i.categoria_id,
        i.equipe_id,
        i.faixa_id,
        i.nome,
        i.idade,
        i.peso,
        i.sexo,
        i.status,
        i.seed,
        i.created_at,
        i.updated_at,

        e.nome AS equipe_nome,
        f.nome AS faixa_nome,
        f.ordem AS faixa_ordem,
        c.nome AS categoria_nome,

        EXISTS (
            SELECT 1 FROM lutas l
            WHERE l.competidor_1_id = i.id
               OR l.competidor_2_id = i.id
               OR l.vencedor_id = i.id
               OR l.perdedor_id = i.id
        ) AS participa_luta,

        EXISTS (
            SELECT 1 FROM pontos_equipes pe
            WHERE pe.inscricao_id = i.id
        ) AS possui_pontos

    FROM inscricoes i
    JOIN equipes e ON e.id = i.equipe_id
    JOIN faixas f ON f.id = i.faixa_id
    LEFT JOIN categorias c ON c.id = i.categoria_id
    WHERE i.id = $1
      AND i.evento_id = $2;
  `;

  const resultado = await client.query(query, [id, eventoId]);
  return resultado.rows[0] || null;
}

async function criar(dados, client = pool) {
  const query = `
    INSERT INTO inscricoes (
        evento_id,
        categoria_id,
        equipe_id,
        faixa_id,
        nome,
        idade,
        peso,
        sexo,
        status,
        seed
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;

  const params = [
    dados.evento_id,
    dados.categoria_id || null,
    dados.equipe_id,
    dados.faixa_id,
    dados.nome,
    dados.idade,
    dados.peso,
    dados.sexo,
    dados.status || 'PENDENTE',
    dados.seed || null,
  ];

  const resultado = await client.query(query, params);
  return resultado.rows[0];
}

async function atualizar(id, eventoId, dados, client = pool) {
  const query = `
    UPDATE inscricoes
    SET
        categoria_id = $1,
        equipe_id = $2,
        faixa_id = $3,
        nome = $4,
        idade = $5,
        peso = $6,
        sexo = $7,
        status = $8,
        seed = $9,
        updated_at = NOW()
    WHERE id = $10
      AND evento_id = $11
    RETURNING *;
  `;

  const params = [
    dados.categoria_id || null,
    dados.equipe_id,
    dados.faixa_id,
    dados.nome,
    dados.idade,
    dados.peso,
    dados.sexo,
    dados.status,
    dados.seed || null,
    id,
    eventoId,
  ];

  const resultado = await client.query(query, params);
  return resultado.rows[0] || null;
}

async function atualizarApenasNome(id, eventoId, nome, client = pool) {
  const query = `
    UPDATE inscricoes
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

async function alterarStatus(id, eventoId, status, categoriaId = undefined, client = pool) {
  let query;
  let params;

  if (categoriaId !== undefined) {
    query = `
      UPDATE inscricoes
      SET
          status = $1,
          categoria_id = $2,
          updated_at = NOW()
      WHERE id = $3
        AND evento_id = $4
      RETURNING *;
    `;
    params = [status, categoriaId, id, eventoId];
  } else {
    query = `
      UPDATE inscricoes
      SET
          status = $1,
          updated_at = NOW()
      WHERE id = $2
        AND evento_id = $3
      RETURNING *;
    `;
    params = [status, id, eventoId];
  }

  const resultado = await client.query(query, params);
  return resultado.rows[0] || null;
}

async function verificarParticipacaoEmLutas(inscricaoId, client = pool) {
  const query = `
    SELECT EXISTS (
        SELECT 1
        FROM lutas
        WHERE competidor_1_id = $1
           OR competidor_2_id = $1
           OR vencedor_id = $1
           OR perdedor_id = $1
    ) AS participa;
  `;

  const resultado = await client.query(query, [inscricaoId]);
  return Boolean(resultado.rows[0]?.participa);
}

async function verificarPontosGerados(inscricaoId, client = pool) {
  const query = `
    SELECT EXISTS (
        SELECT 1
        FROM pontos_equipes
        WHERE inscricao_id = $1
    ) AS possui_pontos;
  `;

  const resultado = await client.query(query, [inscricaoId]);
  return Boolean(resultado.rows[0]?.possui_pontos);
}

async function bloquearPorIdNoEvento(id, eventoId, client) {
  const query = `
    SELECT id, nome, status, categoria_id
    FROM inscricoes
    WHERE id = $1
      AND evento_id = $2
    FOR UPDATE;
  `;

  const resultado = await client.query(query, [id, eventoId]);
  return resultado.rows[0] || null;
}

async function excluir(id, eventoId, client = pool) {
  const query = `
    DELETE FROM inscricoes
    WHERE id = $1
      AND evento_id = $2
    RETURNING id, nome;
  `;

  const resultado = await client.query(query, [id, eventoId]);
  return resultado.rows[0] || null;
}

module.exports = {
  listarPorEvento,
  contarPorEvento,
  buscarResumoStatus,
  buscarPorIdNoEvento,
  buscarComRelacionamentos,
  criar,
  atualizar,
  atualizarApenasNome,
  alterarStatus,
  verificarParticipacaoEmLutas,
  verificarPontosGerados,
  bloquearPorIdNoEvento,
  excluir,
};
