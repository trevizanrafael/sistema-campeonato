const bcrypt = require('bcrypt');
const pool = require('./database');
require('dotenv').config();

async function seedAdmin() {
  const nome = 'Administrador';
  const email = (process.env.ADMIN_EMAIL || 'admin@sistema.com').toLowerCase();
  const senha = process.env.ADMIN_PASSWORD || 'admin123';

  const client = await pool.connect();

  try {
    // Verifica se o admin já existe
    const { rows } = await client.query(
      'SELECT id FROM usuarios WHERE LOWER(email) = $1',
      [email]
    );

    if (rows.length > 0) {
      console.log('⏭️  Usuário administrador já existe.');
      return;
    }

    // Hash da senha com custo 12
    const senhaHash = await bcrypt.hash(senha, 12);

    await client.query(
      `INSERT INTO usuarios (nome, email, senha_hash, ativo)
       VALUES ($1, $2, $3, TRUE)`,
      [nome, email, senhaHash]
    );

    console.log('✅ Usuário administrador criado com sucesso!');
    console.log(`   Email: ${email}`);
  } catch (err) {
    console.error('❌ Erro ao criar administrador:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdmin().catch((err) => {
  console.error('Erro fatal no seed:', err.message);
  process.exit(1);
});
