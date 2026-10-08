// Cenário 02: Criação de Campeonato
const { criarSessao } = require('../engine');

async function executar() {
  const ver = process.argv.includes('--ver');
  const d = await criarSessao('02-criar-campeonato', { headless: !ver });

  console.log('Gravando Cenário 02: Criação de Campeonato...');
  await d.login();

  await d.page.goto(`${d.BASE}/eventos`);
  await d.legenda('Lista de Campeonatos', 'Clique no botão "Novo campeonato"');
  await d.esperar(2000);

  await d.clicar('a[href="/eventos/novo"]', { navega: true });

  await d.legenda('Passo 1: Informe o Nome do Campeonato');
  await d.digitar('#nome', 'Open Interior Paulista de Jiu-Jitsu 2026', 80);
  await d.esperar(1200);

  await d.legenda('Passo 2: Informe a Descrição e Local');
  await d.digitar('#descricao', 'Torneio oficial com disputas de todas as faixas e categorias de peso. Ginásio Municipal de Esportes.', 50);
  await d.esperar(1800);

  await d.legenda('Passo 3: Clique em "Criar campeonato"');
  await d.clicar('form[action="/eventos"] button[type=submit]', { navega: true });

  await d.legenda('Campeonato Criado com Sucesso!', 'Painel de controle com atalhos de Categorias, Inscrições e Chaves');
  await d.esperar(3500);

  await d.finalizar();
}

if (require.main === module) {
  executar().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = executar;
