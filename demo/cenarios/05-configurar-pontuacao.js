// Cenário 05: Regras de Pontuação do Campeonato
const { criarSessao } = require('../engine');
const { seed } = require('../seed');

async function executar() {
  const ver = process.argv.includes('--ver');
  console.log('Preparando ambiente para Cenário 05...');
  const { eventoId } = await seed();

  const d = await criarSessao('05-configurar-pontuacao', { headless: !ver });
  const ev = `${d.BASE}/eventos/${eventoId}`;

  console.log('Gravando Cenário 05: Configuração de Pontuação...');
  await d.login();

  await d.page.goto(`${ev}/pontuacao`);
  await d.legenda('Regras de Pontuação Geral', 'Critérios que definem a academia campeã do torneio');
  await d.esperar(2500);

  await d.legenda('Regra 1: Pontos por Combate', 'Cada vitória de um atleta soma pontos para a equipe');
  await d.moverPara('#pontos_vitoria');
  await d.digitar('#pontos_vitoria', '3', 80);
  await d.esperar(1200);

  await d.legenda('Regra 2: Avanço por Bye (Chapéu)', 'Define se quem passa sem lutar também pontua');
  await d.moverPara('#bye_pontua');
  await d.clicar('#bye_pontua');
  await d.esperar(1200);

  await d.legenda('Regra 3: Pontos de Pódio', 'Bonificação especial para 1º, 2º e 3º lugares');
  await d.rolarAte('#pontos_primeiro');
  await d.digitar('#pontos_primeiro', '9', 80);
  await d.digitar('#pontos_segundo', '3', 80);
  await d.digitar('#pontos_terceiro', '1', 80);
  await d.esperar(1500);

  await d.legenda('Salvando as regras da competição...');
  await d.clicar('form[action$="/pontuacao"] button[type=submit]', { navega: true });

  await d.legenda('Regras Salvas com Sucesso!', 'Quando o ranking começar a pontuar, a tela trava para manter a integridade');
  await d.esperar(3500);

  await d.finalizar();
}

if (require.main === module) {
  executar().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = executar;
