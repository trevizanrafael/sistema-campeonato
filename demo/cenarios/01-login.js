// Cenário 01: Login no Sistema
const { criarSessao } = require('../engine');

async function executar() {
  const ver = process.argv.includes('--ver');
  const d = await criarSessao('01-login', { headless: !ver });

  console.log('Gravando Cenário 01: Login...');
  await d.page.goto(`${d.BASE}/login`);

  await d.legenda('Bem-vindo ao Sistema de Campeonato', 'Painel de Gestão Araújo JJ Team');
  await d.esperar(2500);

  await d.legenda('Passo 1: Digite seu e-mail de acesso');
  await d.digitar('input[name=email]', d.EMAIL, 95);
  await d.esperar(1200);

  await d.legenda('Passo 2: Digite sua senha');
  await d.digitar('input[name=senha]', d.SENHA, 95);
  await d.esperar(1200);

  await d.legenda('Passo 3: Clique em "Entrar no Sistema"');
  await d.clicar('form[action="/login"] button[type=submit]', { navega: true });

  await d.legenda('Login realizado com sucesso!', 'Acesso liberado aos campeonatos');
  await d.esperar(3000);

  await d.finalizar();
}

if (require.main === module) {
  executar().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = executar;
