require('dotenv').config();
const pool = require('../src/config/database');
const { verificarIntegridade } = require('../src/utils/verificarIntegridade');

async function main() {
  console.log('=====================================================');
  console.log('  Diagnóstico de Integridade do Banco de Dados');
  console.log('=====================================================\n');

  try {
    const diagnostico = await verificarIntegridade(pool);

    let falhas = 0;

    for (const r of diagnostico.resultados) {
      if (r.passou) {
        console.log(`[PASS] ${r.nome}`);
      } else {
        falhas++;
        console.error(`[FAIL] ${r.nome} -> ${r.totalInconsistencias} inconsistência(s) encontrada(s)!`);
        console.error('       Detalhes:', JSON.stringify(r.detalhes, null, 2));
      }
    }

    console.log('\n-----------------------------------------------------');
    if (diagnostico.valido) {
      console.log('STATUS: INTEGRIDADE PERFEITA! 0 inconsistências detectadas.');
      console.log('=====================================================');
      process.exit(0);
    } else {
      console.error(`STATUS: FALHA! ${diagnostico.totalInconsistencias} inconsistência(s) em ${falhas} verificação(ões).`);
      console.log('=====================================================');
      process.exit(1);
    }
  } catch (error) {
    console.error('Erro ao executar diagnóstico de integridade:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
