require('dotenv').config();
const pool = require('../../src/config/database');

/**
 * Limpa com segurança todas as tabelas de dados de teste (com prefixo TEST_ ou específicas)
 * ou realiza truncamento seguro preservando as faixas padrão se necessário.
 */
async function limparDadosDeTeste(prefixo = 'TEST_%') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM logs_auditoria WHERE evento_id IN (SELECT id FROM eventos WHERE nome LIKE $1)', [prefixo]);
    await client.query('DELETE FROM pontos_equipes WHERE evento_id IN (SELECT id FROM eventos WHERE nome LIKE $1)', [prefixo]);
    await client.query(`
      DELETE FROM lutas WHERE chave_id IN (
        SELECT ch.id FROM chaves ch
        JOIN categorias c ON c.id = ch.categoria_id
        WHERE c.evento_id IN (SELECT id FROM eventos WHERE nome LIKE $1)
      )
    `, [prefixo]);
    await client.query(`
      DELETE FROM chaves WHERE categoria_id IN (
        SELECT c.id FROM categorias c
        WHERE c.evento_id IN (SELECT id FROM eventos WHERE nome LIKE $1)
      )
    `, [prefixo]);
    await client.query('DELETE FROM inscricoes WHERE evento_id IN (SELECT id FROM eventos WHERE nome LIKE $1)', [prefixo]);
    await client.query('DELETE FROM categorias WHERE evento_id IN (SELECT id FROM eventos WHERE nome LIKE $1)', [prefixo]);
    await client.query('DELETE FROM regras_pontuacao WHERE evento_id IN (SELECT id FROM eventos WHERE nome LIKE $1)', [prefixo]);
    await client.query('DELETE FROM eventos WHERE nome LIKE $1', [prefixo]);
    await client.query('DELETE FROM equipes WHERE nome LIKE $1', [prefixo]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  limparDadosDeTeste,
};
