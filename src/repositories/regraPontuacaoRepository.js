const pool = require('../config/database');

async function criarPadrao(eventoId, client) {
  const db = client || pool;
  const sql = `
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
  const { rows } = await db.query(sql, [eventoId]);
  return rows[0];
}

module.exports = {
  criarPadrao,
};
