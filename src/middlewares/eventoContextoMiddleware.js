const pool = require('../config/database');

/**
 * Carrega o "contexto do campeonato" para todas as rotas /eventos/:eventoId/...
 * Usado pelo menu lateral contextual e pela trilha de navegação.
 *
 * res.locals.eventoContexto = {
 *   id, nome,
 *   badges: { inscricoes: <sem categoria>, chaves: <lutas prontas> }
 * }
 *
 * Uma única consulta leve por requisição. Se o evento não existir,
 * não define nada (o controller responde 404 normalmente).
 */
async function carregarContextoEvento(req, res, next) {
  const eventoId = req.params.eventoId;

  if (!eventoId || !/^\d+$/.test(String(eventoId))) {
    return next();
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         e.id,
         e.nome,
         (
           SELECT COUNT(*)::INTEGER
           FROM inscricoes i
           WHERE i.evento_id = e.id
             AND i.categoria_id IS NULL
             AND i.status NOT IN ('CANCELADA', 'DESCLASSIFICADA')
         ) AS inscricoes_sem_categoria,
         (
           SELECT COUNT(*)::INTEGER
           FROM lutas l
           JOIN chaves ch ON ch.id = l.chave_id
           JOIN categorias c ON c.id = ch.categoria_id
           WHERE c.evento_id = e.id
             AND ch.status = 'EM_ANDAMENTO'
             AND l.status = 'PRONTA'
         ) AS lutas_prontas
       FROM eventos e
       WHERE e.id = $1`,
      [eventoId]
    );

    const evento = rows[0];
    if (evento) {
      res.locals.eventoContexto = {
        id: evento.id,
        nome: evento.nome,
        badges: {
          inscricoes: evento.inscricoes_sem_categoria,
          chaves: evento.lutas_prontas,
        },
      };
    }
    next();
  } catch (erro) {
    next(erro);
  }
}

module.exports = {
  carregarContextoEvento,
};
