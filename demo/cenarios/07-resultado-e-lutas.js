// Cenário 07: Lançamento de Resultado e Avanço de Luta
const { criarSessao } = require('../engine');
const { seed } = require('../seed');

async function executar() {
  const ver = process.argv.includes('--ver');
  console.log('Preparando ambiente para Cenário 07...');
  const { eventoId } = await seed();

  const d = await criarSessao('07-resultado-e-lutas', { headless: !ver });
  const ev = `${d.BASE}/eventos/${eventoId}`;

  console.log('Gravando Cenário 07: Lançamento de Resultado...');
  await d.login();

  await d.page.goto(`${ev}/chaves`);
  await d.legenda('Chaves do Campeonato', 'Acessando uma chave com lutas em andamento');
  await d.esperar(1500);

  // Clica na chave que está em andamento (Master Roxa/Preta)
  await d.clicar('tr:has-text("Em andamento") a:has-text("Abrir chave")', { navega: true });

  await d.legenda('Diagrama de Combates', 'Lutas prontas para lançamento do resultado pelo mesário');
  await d.esperar(2500);

  const botaoLancar = d.page.locator('a[href*="/resultado"]:has-text("Lançar"), a.button-small:has-text("Lançar")').first();
  if (await botaoLancar.count()) {
    await d.legenda('Passo 1: Selecionar o combate pronto');
    await d.clicar(botaoLancar);
    await d.esperar(1200);

    if (await d.page.locator('label.modal-resultado-opcao').count()) {
      await d.legenda('Passo 2: Escolha o Atleta Vencedor', 'Clique sobre o competidor vencedor no modal');
      await d.clicar('label.modal-resultado-opcao');
      await d.esperar(1000);

      await d.legenda('Passo 3: Confirmar a Vitória');
      await d.clicar('#modalResultadoConfirmar');
      await d.esperar(2000);
    } else if (await d.page.locator('.competitor-choice').count()) {
      await d.legenda('Passo 2: Escolha o Atleta Vencedor', 'Clique sobre o competidor vencedor');
      await d.clicar('.competitor-choice');
      await d.esperar(1000);

      await d.legenda('Passo 3: Confirmar a Vitória');
      await d.clicar('#btn-salvar', { navega: true });
      await d.esperar(2000);
    }
  }

  await d.legenda('Avanço Automático no Bracket!', 'O vencedor avança de fase e os pontos da academia já são computados');
  await d.esperar(3500);

  await d.finalizar();
}

if (require.main === module) {
  executar().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = executar;
