const pool = require('../config/database');

async function listar({ busca = '', limite = 10, offset = 0 } = {}) {
  const sql = `
    SELECT
      e.id,
      e.nome,
      e.descricao,
      e.created_at,
      e.updated_at,
      COUNT(DISTINCT c.id)::INTEGER AS total_categorias,
      COUNT(DISTINCT i.id)::INTEGER AS total_inscricoes
    FROM eventos e
    LEFT JOIN categorias c
      ON c.evento_id = e.id
    LEFT JOIN inscricoes i
      ON i.evento_id = e.id
    WHERE (
      $1 = ''
      OR e.nome ILIKE '%' || $1 || '%'
      OR COALESCE(e.descricao, '') ILIKE '%' || $1 || '%'
    )
    GROUP BY e.id
    ORDER BY e.created_at DESC
    LIMIT $2
    OFFSET $3;
  `;
  const { rows } = await pool.query(sql, [busca, limite, offset]);
  return rows;
}

async function contar({ busca = '' } = {}) {
  const sql = `
    SELECT COUNT(*)::INTEGER AS total
    FROM eventos
    WHERE (
      $1 = ''
      OR nome ILIKE '%' || $1 || '%'
      OR COALESCE(descricao, '') ILIKE '%' || $1 || '%'
    );
  `;
  const { rows } = await pool.query(sql, [busca]);
  return rows[0].total;
}

async function buscarPorId(id, client) {
  const db = client || pool;
  const sql = `
    SELECT
      id,
      nome,
      descricao,
      created_at,
      updated_at
    FROM eventos
    WHERE id = $1;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function buscarComResumo(id) {
  const sql = `
    SELECT
      e.id,
      e.nome,
      e.descricao,
      e.created_at,
      e.updated_at,

      (
        SELECT COUNT(*)::INTEGER
        FROM categorias c
        WHERE c.evento_id = e.id
      ) AS total_categorias,

      (
        SELECT COUNT(*)::INTEGER
        FROM inscricoes i
        WHERE i.evento_id = e.id
      ) AS total_inscricoes,

      (
        SELECT COUNT(*)::INTEGER
        FROM chaves ch
        JOIN categorias c
          ON c.id = ch.categoria_id
        WHERE c.evento_id = e.id
      ) AS total_chaves,

      (
        SELECT COUNT(*)::INTEGER
        FROM chaves ch
        LEFT JOIN categorias c ON c.id = ch.categoria_id
        LEFT JOIN chaves_rapidas cr ON cr.id = ch.chave_rapida_id
        WHERE COALESCE(c.evento_id, cr.evento_id) = e.id
          AND ch.status = 'FINALIZADA'
      ) AS chaves_finalizadas

    FROM eventos e
    WHERE e.id = $1;
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

/**
 * Números de progresso do campeonato para o painel (etapas, próximo passo e pendências).
 * Uma única consulta; lutas de BYE e canceladas não entram na contagem de lutas.
 */
async function buscarProgresso(id) {
  const sql = `
    WITH cat AS (
      SELECT
        c.id,
        ch.id AS chave_id,
        ch.status AS chave_status,
        (
          SELECT COUNT(*)
          FROM inscricoes i
          WHERE i.categoria_id = c.id
            AND i.status = 'CONFIRMADA'
        )::INTEGER AS confirmados
      FROM categorias c
      LEFT JOIN chaves ch
        ON ch.categoria_id = c.id
      WHERE c.evento_id = $1
    ),
    chv AS (
      SELECT
        ch.id,
        ch.status,
        ch.categoria_id,
        ch.chave_rapida_id,
        CASE WHEN ch.chave_rapida_id IS NOT NULL THEN 'RAPIDA' ELSE 'NORMAL' END AS tipo,
        (
          SELECT COUNT(*)
          FROM lutas l
          WHERE l.chave_id = ch.id
            AND l.status IN ('AGUARDANDO', 'PRONTA')
        )::INTEGER AS lutas_abertas
      FROM chaves ch
      LEFT JOIN categorias c ON c.id = ch.categoria_id
      LEFT JOIN chaves_rapidas cr ON cr.id = ch.chave_rapida_id
      WHERE COALESCE(c.evento_id, cr.evento_id) = $1
    ),
    lut AS (
      SELECT
        COUNT(*)::INTEGER AS total,
        COUNT(*) FILTER (WHERE l.status = 'FINALIZADA')::INTEGER AS finalizadas,
        COUNT(*) FILTER (WHERE l.status = 'PRONTA')::INTEGER AS prontas
      FROM lutas l
      JOIN chaves ch ON ch.id = l.chave_id
      LEFT JOIN categorias c ON c.id = ch.categoria_id
      LEFT JOIN chaves_rapidas cr ON cr.id = ch.chave_rapida_id
      WHERE COALESCE(c.evento_id, cr.evento_id) = $1
        AND ch.status IN ('EM_ANDAMENTO', 'FINALIZADA')
        AND l.status <> 'CANCELADA'
        AND COALESCE(l.tipo_resultado, '') <> 'BYE'
    ),
    ins AS (
      SELECT
        COUNT(*) FILTER (WHERE i.status NOT IN ('CANCELADA', 'DESCLASSIFICADA'))::INTEGER AS total,
        COUNT(*) FILTER (WHERE i.status = 'CONFIRMADA')::INTEGER AS confirmadas,
        COUNT(*) FILTER (
          WHERE i.categoria_id IS NULL
            AND i.chave_rapida_id IS NULL
            AND i.status NOT IN ('CANCELADA', 'DESCLASSIFICADA')
        )::INTEGER AS sem_categoria,
        COUNT(*) FILTER (
          WHERE i.categoria_id IS NOT NULL
            AND i.status = 'PENDENTE'
        )::INTEGER AS pendentes
      FROM inscricoes i
      WHERE i.evento_id = $1
    )
    SELECT
      (SELECT COUNT(*) FROM cat)::INTEGER AS categorias,
      (SELECT COUNT(*) FROM cat WHERE chave_id IS NULL AND confirmados >= 2)::INTEGER AS categorias_prontas_sem_chave,
      (SELECT COUNT(*) FROM cat WHERE chave_id IS NULL AND confirmados = 1)::INTEGER AS categorias_um_atleta,
      (SELECT COUNT(*) FROM chv)::INTEGER AS chaves_total,
      (SELECT COUNT(*) FILTER (WHERE tipo = 'NORMAL') FROM chv)::INTEGER AS chaves_normais,
      (SELECT COUNT(*) FILTER (WHERE tipo = 'RAPIDA') FROM chv)::INTEGER AS chaves_rapidas,
      (SELECT COUNT(*) FILTER (WHERE status = 'NAO_INICIADA') FROM chv)::INTEGER AS chaves_nao_iniciadas,
      (SELECT COUNT(*) FILTER (WHERE status = 'EM_ANDAMENTO') FROM chv)::INTEGER AS chaves_em_andamento,
      (SELECT COUNT(*) FILTER (WHERE status = 'FINALIZADA') FROM chv)::INTEGER AS chaves_finalizadas,
      (SELECT COUNT(*) FILTER (WHERE status = 'EM_ANDAMENTO' AND lutas_abertas = 0) FROM chv)::INTEGER AS chaves_prontas_finalizar,
      ins.total AS inscricoes_total,
      ins.confirmadas AS inscricoes_confirmadas,
      ins.sem_categoria AS inscricoes_sem_categoria,
      ins.pendentes AS inscricoes_pendentes,
      lut.total AS lutas_total,
      lut.finalizadas AS lutas_finalizadas,
      lut.prontas AS lutas_prontas,
      COALESCE((
        SELECT rp.pontos_vitoria + rp.pontos_primeiro + rp.pontos_segundo + rp.pontos_terceiro
        FROM regras_pontuacao rp
        WHERE rp.evento_id = $1
      ), 0)::INTEGER AS pontuacao_soma,
      (
        SELECT COUNT(*)
        FROM pontos_equipes pe
        WHERE pe.evento_id = $1
      )::INTEGER AS pontos_lancados
    FROM ins, lut;
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

async function criar(dados, client) {
  const db = client || pool;
  const sql = `
    INSERT INTO eventos (nome, descricao)
    VALUES ($1, $2)
    RETURNING id, nome, descricao, created_at, updated_at;
  `;
  const { rows } = await db.query(sql, [dados.nome, dados.descricao]);
  return rows[0];
}

async function atualizar(id, dados, client) {
  const db = client || pool;
  const sql = `
    UPDATE eventos
    SET
      nome = $1,
      descricao = $2,
      updated_at = NOW()
    WHERE id = $3
    RETURNING id, nome, descricao, created_at, updated_at;
  `;
  const { rows } = await db.query(sql, [dados.nome, dados.descricao, id]);
  return rows[0] || null;
}

async function contarDependencias(id, client) {
  const db = client || pool;
  const sql = `
    SELECT
      (
        SELECT COUNT(*)
        FROM categorias
        WHERE evento_id = $1
      )::INTEGER AS total_categorias,

      (
        SELECT COUNT(*)
        FROM inscricoes
        WHERE evento_id = $1
      )::INTEGER AS total_inscricoes,

      (
        SELECT COUNT(*)
        FROM pontos_equipes
        WHERE evento_id = $1
      )::INTEGER AS total_pontos;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0];
}

async function bloquearPorId(id, client) {
  const db = client || pool;
  const sql = `
    SELECT id
    FROM eventos
    WHERE id = $1
    FOR UPDATE;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function excluir(id, client) {
  const db = client || pool;
  const sql = `
    DELETE FROM eventos
    WHERE id = $1
    RETURNING id;
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

module.exports = {
  listar,
  contar,
  buscarPorId,
  buscarComResumo,
  buscarProgresso,
  criar,
  atualizar,
  contarDependencias,
  bloquearPorId,
  excluir,
};
