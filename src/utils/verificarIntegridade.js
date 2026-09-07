const pool = require('../config/database');

/**
 * Utilitário de diagnóstico e verificação de integridade relacional do campeonato.
 * Executa as 12 checagens de consistência estrutural conforme especificações da Fase 18.
 */
async function verificarIntegridade(client = pool) {
  const checagens = [
    {
      codigo: 'LUTAS_VENCEDOR_INVALIDO',
      nome: 'Lutas com vencedor que não é competidor da luta',
      query: `
        SELECT id, chave_id, competidor_1_id, competidor_2_id, vencedor_id
        FROM lutas
        WHERE status = 'FINALIZADA'
          AND vencedor_id IS NOT NULL
          AND vencedor_id NOT IN (competidor_1_id, competidor_2_id);
      `,
    },
    {
      codigo: 'LUTAS_FINALIZADAS_SEM_VENCEDOR',
      nome: 'Lutas finalizadas sem vencedor ou perdedor definidos',
      query: `
        SELECT id, chave_id, status, vencedor_id, perdedor_id
        FROM lutas
        WHERE status = 'FINALIZADA'
          AND (vencedor_id IS NULL OR perdedor_id IS NULL);
      `,
    },
    {
      codigo: 'LUTAS_PRONTAS_SEM_DOIS_COMPETIDORES',
      nome: 'Lutas com status PRONTA mas sem ambos competidores preenchidos',
      query: `
        SELECT id, chave_id, status, competidor_1_id, competidor_2_id
        FROM lutas
        WHERE status = 'PRONTA'
          AND (competidor_1_id IS NULL OR competidor_2_id IS NULL);
      `,
    },
    {
      codigo: 'LUTAS_AGUARDANDO_COM_DOIS_COMPETIDORES',
      nome: 'Lutas com status AGUARDANDO que já possuem ambos competidores (deveriam ser PRONTA)',
      query: `
        SELECT id, chave_id, status, competidor_1_id, competidor_2_id
        FROM lutas
        WHERE status = 'AGUARDANDO'
          AND competidor_1_id IS NOT NULL
          AND competidor_2_id IS NOT NULL
          AND vencedor_id IS NULL;
      `,
    },
    {
      codigo: 'INSCRICOES_CATEGORIA_INCOMPATIVEL',
      nome: 'Inscrições confirmadas com peso/idade/sexo incompatível com a categoria',
      query: `
        SELECT i.id, i.nome, i.peso, i.idade, i.sexo, c.nome AS categoria_nome,
               c.peso_minimo, c.peso_maximo, c.idade_minima, c.idade_maxima, c.sexo AS categoria_sexo
        FROM inscricoes i
        JOIN categorias c ON c.id = i.categoria_id
        WHERE i.status = 'CONFIRMADA'
          AND (
            (c.peso_maximo IS NOT NULL AND i.peso > c.peso_maximo)
            OR (c.peso_minimo IS NOT NULL AND i.peso <= c.peso_minimo)
            OR (c.idade_minima IS NOT NULL AND i.idade < c.idade_minima)
            OR (c.idade_maxima IS NOT NULL AND i.idade > c.idade_maxima)
            OR (c.sexo <> 'MISTO' AND c.sexo <> i.sexo)
          );
      `,
    },
    {
      codigo: 'PONTOS_VITORIA_ORFAOS',
      nome: 'Pontos de vitória vinculados a lutas não finalizadas',
      query: `
        SELECT pe.id, pe.luta_id, pe.equipe_id, pe.pontos, l.status AS luta_status
        FROM pontos_equipes pe
        JOIN lutas l ON l.id = pe.luta_id
        WHERE pe.tipo = 'VITORIA'
          AND l.status <> 'FINALIZADA';
      `,
    },
    {
      codigo: 'PONTOS_VITORIA_DUPLICADOS',
      nome: 'Lutas com mais de um ponto de vitória lançado',
      query: `
        SELECT luta_id, COUNT(*)::INTEGER AS total
        FROM pontos_equipes
        WHERE tipo = 'VITORIA' AND luta_id IS NOT NULL
        GROUP BY luta_id
        HAVING COUNT(*) > 1;
      `,
    },
    {
      codigo: 'PONTOS_VITORIA_EQUIPE_DIVERGENTE',
      nome: 'Pontos de vitória atribuídos a equipe divergente da equipe do vencedor',
      query: `
        SELECT pe.id, pe.luta_id, pe.equipe_id AS equipe_pontuada, i.equipe_id AS equipe_atleta
        FROM pontos_equipes pe
        JOIN lutas l ON l.id = pe.luta_id
        JOIN inscricoes i ON i.id = l.vencedor_id
        WHERE pe.tipo = 'VITORIA'
          AND pe.equipe_id <> i.equipe_id;
      `,
    },
    {
      codigo: 'PONTOS_COLOCACAO_ORFAOS',
      nome: 'Pontos de colocação vinculados a chave não finalizada',
      query: `
        SELECT pe.id, pe.chave_id, pe.tipo, ch.status AS chave_status
        FROM pontos_equipes pe
        JOIN chaves ch ON ch.id = pe.chave_id
        WHERE pe.tipo IN ('PRIMEIRO_LUGAR', 'SEGUNDO_LUGAR', 'TERCEIRO_LUGAR')
          AND ch.status <> 'FINALIZADA';
      `,
    },
    {
      codigo: 'CHAVES_FINALIZADAS_COM_LUTAS_PENDENTES',
      nome: 'Chaves com status FINALIZADA mas que ainda têm lutas pendentes',
      query: `
        SELECT ch.id, ch.nome, COUNT(l.id)::INTEGER AS pendentes
        FROM chaves ch
        JOIN lutas l ON l.chave_id = ch.id
        WHERE ch.status = 'FINALIZADA'
          AND l.status <> 'FINALIZADA'
        GROUP BY ch.id, ch.nome;
      `,
    },
    {
      codigo: 'CHAVES_FINALIZADAS_SEM_PODIO',
      nome: 'Chaves finalizadas sem 1º ou 2º lugar definidos',
      query: `
        SELECT id, nome, status, primeiro_lugar_id, segundo_lugar_id
        FROM chaves
        WHERE status = 'FINALIZADA'
          AND (primeiro_lugar_id IS NULL OR segundo_lugar_id IS NULL);
      `,
    },
    {
      codigo: 'PODIO_COM_MESMO_ATLETA',
      nome: 'Pódio oficial contendo o mesmo atleta em mais de uma colocação',
      query: `
        SELECT id, nome, primeiro_lugar_id, segundo_lugar_id, terceiro_lugar_id
        FROM chaves
        WHERE status = 'FINALIZADA'
          AND (
            primeiro_lugar_id = segundo_lugar_id
            OR (terceiro_lugar_id IS NOT NULL AND terceiro_lugar_id IN (primeiro_lugar_id, segundo_lugar_id))
          );
      `,
    },
  ];

  const resultados = [];
  let totalInconsistencias = 0;

  for (const c of checagens) {
    const res = await client.query(c.query);
    const count = res.rows.length;
    totalInconsistencias += count;
    resultados.push({
      codigo: c.codigo,
      nome: c.nome,
      passou: count === 0,
      totalInconsistencias: count,
      detalhes: res.rows,
    });
  }

  return {
    valido: totalInconsistencias === 0,
    totalInconsistencias,
    resultados,
  };
}

module.exports = {
  verificarIntegridade,
};
