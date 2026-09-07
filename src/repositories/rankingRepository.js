const pool = require('../config/database');

/**
 * Repositório para consultas analíticas do ranking de equipes.
 */

async function buscarRanking(eventoId, client) {
  const db = client || pool;
  const sql = `
    WITH equipes_evento AS (
        SELECT DISTINCT
            e.id AS equipe_id,
            e.nome AS equipe_nome
        FROM equipes e
        JOIN inscricoes i
            ON i.equipe_id = e.id
        WHERE i.evento_id = $1
          AND i.status <> 'CANCELADA'
    ),

    pontos AS (
        SELECT
            pe.equipe_id,
            COALESCE(SUM(pe.pontos), 0)::INTEGER AS total_pontos,
            COALESCE(SUM(pe.pontos) FILTER (
                WHERE pe.tipo = 'VITORIA'
            ), 0)::INTEGER AS pontos_vitorias,
            COALESCE(SUM(pe.pontos) FILTER (
                WHERE pe.tipo IN (
                    'PRIMEIRO_LUGAR',
                    'SEGUNDO_LUGAR',
                    'TERCEIRO_LUGAR'
                )
            ), 0)::INTEGER AS pontos_colocacoes
        FROM pontos_equipes pe
        WHERE pe.evento_id = $1
          AND pe.tipo IN (
              'VITORIA',
              'PRIMEIRO_LUGAR',
              'SEGUNDO_LUGAR',
              'TERCEIRO_LUGAR'
          )
        GROUP BY pe.equipe_id
    ),

    medalhas AS (
        SELECT
            resultados.equipe_id,
            COUNT(*) FILTER (
                WHERE resultados.tipo = 'OURO'
            )::INTEGER AS ouros,
            COUNT(*) FILTER (
                WHERE resultados.tipo = 'PRATA'
            )::INTEGER AS pratas,
            COUNT(*) FILTER (
                WHERE resultados.tipo = 'BRONZE'
            )::INTEGER AS bronzes
        FROM (
            SELECT
                inscricao.equipe_id,
                'OURO' AS tipo
            FROM chaves chave
            JOIN categorias categoria
                ON categoria.id = chave.categoria_id
            JOIN inscricoes inscricao
                ON inscricao.id = chave.primeiro_lugar_id
            WHERE categoria.evento_id = $1
              AND chave.status = 'FINALIZADA'

            UNION ALL

            SELECT
                inscricao.equipe_id,
                'PRATA' AS tipo
            FROM chaves chave
            JOIN categorias categoria
                ON categoria.id = chave.categoria_id
            JOIN inscricoes inscricao
                ON inscricao.id = chave.segundo_lugar_id
            WHERE categoria.evento_id = $1
              AND chave.status = 'FINALIZADA'

            UNION ALL

            SELECT
                inscricao.equipe_id,
                'BRONZE' AS tipo
            FROM chaves chave
            JOIN categorias categoria
                ON categoria.id = chave.categoria_id
            JOIN inscricoes inscricao
                ON inscricao.id = chave.terceiro_lugar_id
            WHERE categoria.evento_id = $1
              AND chave.status = 'FINALIZADA'
        ) resultados
        GROUP BY resultados.equipe_id
    ),

    vitorias AS (
        SELECT
            vencedor.equipe_id,
            COUNT(*) FILTER (
                WHERE luta.tipo_resultado <> 'BYE'
            )::INTEGER AS vitorias,
            COUNT(*) FILTER (
                WHERE luta.tipo_resultado = 'BYE'
            )::INTEGER AS byes
        FROM lutas luta
        JOIN chaves chave
            ON chave.id = luta.chave_id
        JOIN categorias categoria
            ON categoria.id = chave.categoria_id
        JOIN inscricoes vencedor
            ON vencedor.id = luta.vencedor_id
        WHERE categoria.evento_id = $1
          AND luta.status = 'FINALIZADA'
        GROUP BY vencedor.equipe_id
    )

    SELECT
        equipe.equipe_id,
        equipe.equipe_nome,
        COALESCE(pontos.total_pontos, 0)::INTEGER AS total_pontos,
        COALESCE(pontos.pontos_vitorias, 0)::INTEGER AS pontos_vitorias,
        COALESCE(pontos.pontos_colocacoes, 0)::INTEGER AS pontos_colocacoes,
        COALESCE(medalhas.ouros, 0)::INTEGER AS ouros,
        COALESCE(medalhas.pratas, 0)::INTEGER AS pratas,
        COALESCE(medalhas.bronzes, 0)::INTEGER AS bronzes,
        COALESCE(vitorias.vitorias, 0)::INTEGER AS vitorias,
        COALESCE(vitorias.byes, 0)::INTEGER AS byes
    FROM equipes_evento equipe
    LEFT JOIN pontos
        ON pontos.equipe_id = equipe.equipe_id
    LEFT JOIN medalhas
        ON medalhas.equipe_id = equipe.equipe_id
    LEFT JOIN vitorias
        ON vitorias.equipe_id = equipe.equipe_id
    ORDER BY
        total_pontos DESC,
        ouros DESC,
        pratas DESC,
        bronzes DESC,
        vitorias DESC,
        equipe.equipe_nome ASC;
  `;

  const { rows } = await db.query(sql, [eventoId]);
  return rows;
}

async function buscarSituacao(eventoId, client) {
  const db = client || pool;
  const sql = `
    SELECT
        COUNT(*)::INTEGER AS total_chaves,
        COUNT(*) FILTER (
            WHERE chave.status = 'FINALIZADA'
        )::INTEGER AS finalizadas
    FROM chaves chave
    JOIN categorias categoria
        ON categoria.id = chave.categoria_id
    WHERE categoria.evento_id = $1;
  `;

  const { rows } = await db.query(sql, [eventoId]);
  return rows[0] || { total_chaves: 0, finalizadas: 0 };
}

async function buscarEquipeNoEvento(eventoId, equipeId, client) {
  const db = client || pool;
  const sql = `
    SELECT DISTINCT
        e.id,
        e.nome
    FROM equipes e
    JOIN inscricoes i
        ON i.equipe_id = e.id
    WHERE e.id = $1
      AND i.evento_id = $2
      AND i.status <> 'CANCELADA';
  `;

  const { rows } = await db.query(sql, [equipeId, eventoId]);
  return rows[0] || null;
}

async function buscarExtratoEquipe(eventoId, equipeId, client) {
  const db = client || pool;
  const sql = `
    SELECT
        ponto.id,
        ponto.tipo,
        ponto.pontos,
        ponto.descricao,
        ponto.created_at,
        inscricao.nome AS competidor_nome,
        categoria.nome AS categoria_nome,
        luta.rodada,
        luta.posicao AS luta_posicao
    FROM pontos_equipes ponto
    LEFT JOIN inscricoes inscricao
        ON inscricao.id = ponto.inscricao_id
    LEFT JOIN chaves chave
        ON chave.id = ponto.chave_id
    LEFT JOIN categorias categoria
        ON categoria.id = chave.categoria_id
    LEFT JOIN lutas luta
        ON luta.id = ponto.luta_id
    WHERE ponto.evento_id = $1
      AND ponto.equipe_id = $2
      AND ponto.tipo IN (
          'VITORIA',
          'PRIMEIRO_LUGAR',
          'SEGUNDO_LUGAR',
          'TERCEIRO_LUGAR'
      )
    ORDER BY
        ponto.created_at DESC,
        ponto.id DESC;
  `;

  const { rows } = await db.query(sql, [eventoId, equipeId]);
  return rows;
}

module.exports = {
  buscarRanking,
  buscarSituacao,
  buscarEquipeNoEvento,
  buscarExtratoEquipe,
};
