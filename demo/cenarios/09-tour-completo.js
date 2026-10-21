// Cenário 09: Tour Completo do Sistema (Visão Geral de Ponta a Ponta)
// Mostra: Login -> Entrar no Campeonato -> Inscrições -> Chaves -> Sorteio -> Luta/Vencedor -> Ranking
const { criarSessao } = require('../engine');
const { seed } = require('../seed');

async function executar() {
  const ver = process.argv.includes('--ver');
  console.log('Preparando ambiente para Tour Completo...');
  const { eventoId, planilhaCorrigida } = await seed();

  const d = await criarSessao('09-tour-completo', { headless: !ver });
  const ev = `${d.BASE}/eventos/${eventoId}`;

  console.log('Gravando Cenário 09: Tour Completo...');

  // 1. Login
  await d.irPara(`${d.BASE}/login`);
  await d.legenda('Sistema de Campeonato de Jiu-Jitsu', 'Visão Geral: Da Inscrição ao Pódio');
  await d.esperar(2500);

  await d.digitar('input[name=email]', d.EMAIL, 75);
  await d.digitar('input[name=senha]', d.SENHA, 75);
  await d.clicar('form[action="/login"] button[type=submit]', { navega: true });

  // 2. Entrando no Campeonato
  await d.irPara(ev);
  await d.legenda('1. Painel do Campeonato', 'Visão geral com atalhos rápidos para todas as áreas');
  await d.esperar(2500);

  // 3. Inscrições por Documento
  await d.irPara(`${ev}/inscricoes/documento`);
  await d.legenda('2. Inscrições por Documento (Excel)', 'Cadastro rápido e em lote de competidores');
  await d.esperar(2000);

  await d.digitar('#buscaAcademia', 'Gracie', 80);
  await d.clicar('label.doc-equipe:has-text("Gracie Barra Dracena")');
  await d.page.setInputFiles('#arquivoPlanilha', planilhaCorrigida);
  await d.esperar(1000);
  await d.clicar('#botaoImportar', { navega: true });

  await d.legenda('Atletas Importados e Classificados!', 'Validação automática de peso, idade, sexo e faixa');
  await d.esperar(2500);

  // 4. Chaves de Luta e Sorteio
  await d.irPara(`${ev}/chaves`);
  await d.legenda('3. Gerenciamento de Chaves Eliminatórias', 'Visualização de categorias e situação das chaves');
  await d.esperar(2500);

  const botaoGerar = d.page.locator('form[action*="/chave/gerar"] button').first();
  if (await botaoGerar.count()) {
    await d.clicar(botaoGerar, { navega: true });
  } else {
    await d.clicar('a:has-text("Abrir chave")', { navega: true });
  }

  await d.legenda('Diagrama Eliminatório (Bracket)', 'Atletas distribuídos de forma equilibrada');
  await d.esperar(2500);

  const botaoSortear = d.page.locator('form[action*="/sortear"] button');
  if (await botaoSortear.count()) {
    await d.legenda('Dá para Sortear Novamente!', 'Redistribuição dos atletas na chave a qualquer momento');
    await d.clicar(botaoSortear, { navega: true });
    await d.esperar(2000);
  }

  const botaoIniciar = d.page.locator('form[action*="/iniciar"] button');
  if (await botaoIniciar.count()) {
    await d.legenda('Iniciando a Chave...', 'Libera os confrontos para os mesários');
    await d.clicar(botaoIniciar, { navega: true });
    await d.esperar(2000);
  }

  // 5. Seleção de Ganhador / Resultado
  const botaoLancar = d.page.locator('a[href*="/resultado"]:has-text("Lançar"), a.button-small:has-text("Lançar")').first();
  if (await botaoLancar.count()) {
    await d.legenda('4. Lançamento do Resultado da Luta');
    await d.clicar(botaoLancar);
    await d.esperar(1200);

    if (await d.page.locator('label.modal-resultado-opcao').count()) {
      await d.legenda('Escolhendo o Atleta Vencedor do Combate');
      await d.clicar('label.modal-resultado-opcao');
      await d.esperar(1000);
      await d.clicar('#modalResultadoConfirmar');
      await d.esperar(2000);
    } else if (await d.page.locator('.competitor-choice').count()) {
      await d.legenda('Escolhendo o Atleta Vencedor do Combate');
      await d.clicar('.competitor-choice');
      await d.esperar(1000);
      await d.clicar('#btn-salvar', { navega: true });
      await d.esperar(2000);
    }

    await d.legenda('Resultado Registrado!', 'O vencedor avança na chave e a academia pontua automaticamente');
    await d.esperar(3000);
  }

  // 6. Ranking Geral das Academias
  await d.irPara(`${ev}/ranking`);
  await d.legenda('5. Ranking Geral das Academias', 'Pontuação acumulada em tempo real com medalhas e vitórias');
  await d.esperar(3500);

  const linkEquipe = d.page.locator('table.table tbody tr a').first();
  if (await linkEquipe.count()) {
    await d.clicar(linkEquipe, { navega: true });
    await d.legenda('Extrato de Pontuação da Academia', 'Histórico completo de pontos somados por atleta');
    await d.esperar(3500);
  }

  await d.legenda('Sistema Completo e Integrado!', 'Tudo em tempo real: inscrições, chaves, lutas e ranking');
  await d.esperar(3000);

  await d.finalizar();
}

if (require.main === module) {
  executar().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = executar;
