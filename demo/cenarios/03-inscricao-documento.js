// Cenário 03: Inscrição por Documento (Planilha Excel)
const { criarSessao } = require('../engine');
const { seed } = require('../seed');

async function executar() {
  const ver = process.argv.includes('--ver');
  console.log('Preparando ambiente para Cenário 03...');
  const { eventoId, planilhaComErros, planilhaCorrigida } = await seed();

  const d = await criarSessao('03-inscricao-documento', { headless: !ver });
  const ev = `${d.BASE}/eventos/${eventoId}`;

  console.log('Gravando Cenário 03: Inscrição por Documento...');
  await d.login();

  await d.page.goto(`${ev}/inscricoes`);
  await d.legenda('Inscrições do Campeonato', 'Novo recurso: Inscrição por documento');
  await d.esperar(2000);

  await d.clicar('#botaoInscricaoDocumento', { navega: true });

  await d.legenda('Passo 1: Baixe o modelo padrão', 'O modelo já vem formatado com as colunas certas');
  await d.moverPara('#botaoBaixarModelo');
  await d.esperar(2500);

  await d.legenda('Passo 2: Selecione a Academia', 'Filtre pelo nome no campo de busca');
  await d.digitar('#buscaAcademia', 'Gracie', 85);
  await d.esperar(800);
  await d.clicar('label.doc-equipe:has-text("Gracie Barra Dracena")');
  await d.esperar(1200);

  await d.legenda('Passo 3: Envie a planilha de atletas', 'Exemplo com dados incorretos de propósito');
  await d.moverPara('#dropzonePlanilha');
  await d.page.setInputFiles('#arquivoPlanilha', planilhaComErros);
  await d.esperar(1500);
  await d.clicar('#botaoImportar', { navega: true });

  await d.legenda('Validação Automática!', 'Nada é importado e o sistema aponta linha por linha');
  await d.rolarAte('#errosImportacao');
  const itensErros = d.page.locator('.doc-erros li');
  const totalErros = await itensErros.count();
  for (let i = 0; i < totalErros; i += 1) {
    await d.moverPara(itensErros.nth(i));
    await d.esperar(1600);
  }

  await d.legenda('Passo 4: Envie a planilha corrigida');
  await d.rolarAte('#formInscricaoDocumento');
  const radio = d.page.locator('label.doc-equipe:has-text("Gracie Barra Dracena") input[type=radio]');
  if (!(await radio.isChecked())) await d.clicar('label.doc-equipe:has-text("Gracie Barra Dracena")');
  await d.moverPara('#dropzonePlanilha');
  await d.page.setInputFiles('#arquivoPlanilha', planilhaCorrigida);
  await d.esperar(1500);
  await d.clicar('#botaoImportar', { navega: true });

  await d.legenda('Importação Concluída com Sucesso!', 'Exibe resumo e avisos de chaves geradas/iniciadas');
  await d.rolarAte('#resultadoImportacao');
  const avisos = d.page.locator('.doc-aviso');
  for (let i = 0; i < (await avisos.count()); i += 1) {
    await d.moverPara(avisos.nth(i));
    await d.esperar(2500);
  }

  await d.clicar('#botaoVerInscricoesEquipe', { navega: true });
  await d.legenda('Atletas Registrados', 'Filtrados pela academia selecionada');
  await d.esperar(1500);
  await d.page.mouse.wheel(0, 350);
  await d.esperar(3000);

  await d.finalizar();
}

if (require.main === module) {
  executar().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = executar;
