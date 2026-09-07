const bcrypt = require('bcrypt');
const pool = require('../src/config/database');
require('dotenv').config();

async function createAdmin() {
  const nome = (process.env.ADMIN_NAME || 'Administrador').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const senha = process.env.ADMIN_PASSWORD || '';

  // Validações
  if (!email) {
    console.error('ADMIN_EMAIL nao definido no .env');
    process.exit(1);
  }

  if (!senha) {
    console.error('ADMIN_PASSWORD nao definido no .env');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    // Verifica se o admin já existe
    const { rows } = await client.query(
      'SELECT id FROM usuarios WHERE LOWER(email) = $1',
      [email]
    );

    if (rows.length > 0) {
      console.log('Usuario administrador ja existe.');
      console.log(`   Email: ${email}`);
      return;
    }

    // Hash da senha com custo 12
    const senhaHash = await bcrypt.hash(senha, 12);

    await client.query(
      `INSERT INTO usuarios (nome, email, senha_hash, ativo)
       VALUES ($1, $2, $3, TRUE)`,
      [nome, email, senhaHash]
    );

    console.log('Usuario administrador criado com sucesso.');
    console.log(`   Nome: ${nome}`);
    console.log(`   Email: ${email}`);
  } catch (err) {
    console.error('Erro ao criar administrador:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdmin();
