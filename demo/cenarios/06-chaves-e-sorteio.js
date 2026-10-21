// Cenário 06: Chaves, Sorteio e Início dos Combates
const { criarSessao } = require('../engine');
const { seed } = require('../seed');

async function executar() {
  const ver = process.argv.includes('--ver');
  console.log('Preparando ambiente para Cenário 06...');
  const { eventoId } = await seed();

  const d = await criarSessao('06-chaves-e-sorteio', { headless: !ver });
  const ev = `${d.BASE}/eventos/${eventoId}`;

  console.log('Gravando Cenário 06: Chaves e Sorteio...');
  await d.login();

  await d.page.goto(`${ev}/chaves`);
  await d.legenda('Gerenciamento de Chaves de Luta', 'Cada categoria tem sua chave eliminatória');
  await d.esperar(2500);

  await d.legenda('Passo 1: Gerar chave para categoria com atletas confirmados');
  const botaoGerar = d.page.locator('form[action*="/chave/gerar"] button').first();
  if (await botaoGerar.count()) {
    await d.clicar(botaoGerar, { navega: true });
  } else {
    await d.clicar('a:has-text("Abrir chave")', { navega: true });
  }

  await d.legenda('Diagrama Eliminatório (Bracket)', 'Os atletas são distribuídos evitando confronto da mesma equipe na 1ª fase');
  await d.esperar(3000);

  const botaoSortear = d.page.locator('form[action*="/sortear"] button');
  if (await botaoSortear.count()) {
    await d.legenda('Recurso: Sortear Novamente', 'Permite redistribuir a chave antes de começar o campeonato');
    await d.moverPara(botaoSortear);
    await d.clicar(botaoSortear, { navega: true });
    await d.legenda('Chave Sorteada Novamente!', 'Nova distribuição aleatória dos competidores');
    await d.esperar(2500);
  }

  const botaoIniciar = d.page.locator('form[action*="/iniciar"] button');
  if (await botaoIniciar.count()) {
    await d.legenda('Passo 2: Iniciar Chave', 'Bloqueia a estrutura e libera as lutas para lançamento de resultado');
    await d.moverPara(botaoIniciar);
    await d.clicar(botaoIniciar, { navega: true });
    await d.legenda('Chave em Andamento!', 'Agora os mesários podem lançar os vencedores de cada luta');
    await d.esperar(3000);
  }

  await d.finalizar();
}

if (require.main === module) {
  executar().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = executar;
