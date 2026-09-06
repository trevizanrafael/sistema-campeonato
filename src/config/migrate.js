const fs = require('fs');
const path = require('path');
const pool = require('./database');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
  const client = await pool.connect();

  try {
    // Cria tabela de controle de migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        nome VARCHAR(255) NOT NULL UNIQUE,
        executada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Lê os arquivos .sql em ordem
    const arquivos = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const arquivo of arquivos) {
      // Verifica se já foi executada
      const { rows } = await client.query(
        'SELECT id FROM migrations WHERE nome = $1',
        [arquivo]
      );

      if (rows.length > 0) {
        console.log(`⏭️  Já executada: ${arquivo}`);
        continue;
      }

      // Lê e executa o SQL
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, arquivo), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (nome) VALUES ($1)',
          [arquivo]
        );
        await client.query('COMMIT');
        console.log(`✅ Executada: ${arquivo}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Erro na migration ${arquivo}:`, err.message);
        throw err;
      }
    }

    console.log('\n🎉 Todas as migrations foram executadas com sucesso!');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Erro fatal nas migrations:', err.message);
  process.exit(1);
});
