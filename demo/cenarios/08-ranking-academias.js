// Cenário 08: Ranking Geral das Academias e Extrato de Pontos
const { criarSessao } = require('../engine');
const { seed } = require('../seed');
const pool = require('../../src/config/database');

async function prepararDadosComPontos(eventoId) {
  // Lança uma vitória em uma luta para a academia já ter pontos no ranking
  const { rows: lutas } = await pool.query(
    `SELECT l.id, l.competidor_1_id, l.competidor_2_id, ch.id AS chave_id
     FROM lutas l
     JOIN chaves ch ON ch.id = l.chave_id
     JOIN categorias c ON c.id = ch.categoria_id
     WHERE c.evento_id = $1 AND l.status = 'PRONTA' AND l.competidor_1_id IS NOT NULL AND l.competidor_2_id IS NOT NULL
     LIMIT 1`,
    [eventoId]
  );
  if (lutas.length > 0) {
    const l = lutas[0];
    const { rows: [atleta] } = await pool.query('SELECT equipe_id FROM inscricoes WHERE id = $1', [l.competidor_1_id]);
    await pool.query(
      `UPDATE lutas SET status = 'FINALIZADA', vencedor_id = $1, perdedor_id = $2, tipo_resultado = 'FINALIZACAO' WHERE id = $3`,
      [l.competidor_1_id, l.competidor_2_id, l.id]
    );
    // Insere pontos da equipe
    await pool.query(
      `INSERT INTO pontos_equipes (evento_id, equipe_id, inscricao_id, luta_id, chave_id, pontos, tipo)
       VALUES ($1, $2, $3, $4, $5, 1, 'VITORIA') ON CONFLICT DO NOTHING`,
      [eventoId, atleta.equipe_id, l.competidor_1_id, l.id, l.chave_id]
    );
  }
}

async function executar() {
  const ver = process.argv.includes('--ver');
  console.log('Preparando ambiente para Cenário 08...');
  const { eventoId } = await seed();
  await prepararDadosComPontos(eventoId);

  const d = await criarSessao('08-ranking-academias', { headless: !ver });
  const ev = `${d.BASE}/eventos/${eventoId}`;

  console.log('Gravando Cenário 08: Ranking das Academias...');
  await d.login();

  await d.page.goto(`${ev}/ranking`);
  await d.legenda('Ranking Geral das Academias', 'Pontuação acumulada em tempo real durante o campeonato');
  await d.esperar(3000);

  await d.legenda('Tabela de Classificação', 'Exibe posição, total de pontos, ouros, pratas, bronzes e vitórias');
  await d.esperar(3000);

  const linkEquipe = d.page.locator('table.table tbody tr a').first();
  if (await linkEquipe.count()) {
    await d.legenda('Extrato Detalhado da Academia', 'Clique no nome da equipe para ver o histórico de pontos');
    await d.clicar(linkEquipe, { navega: true });

    await d.legenda('Extrato de Pontuação da Equipe', 'Lista de atletas que pontuaram, lutas vencidas e medalhas conquistadas');
    await d.esperar(3500);
  }

  await d.finalizar();
}

if (require.main === module) {
  executar().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = executar;
