// Cenário 04: Inscrição Manual e Regra de Chave Iniciada
const { criarSessao } = require('../engine');
const { seed } = require('../seed');

async function executar() {
  const ver = process.argv.includes('--ver');
  console.log('Preparando ambiente para Cenário 04...');
  const { eventoId } = await seed();

  const d = await criarSessao('04-inscricao-manual', { headless: !ver });
  const ev = `${d.BASE}/eventos/${eventoId}`;

  console.log('Gravando Cenário 04: Inscrição Manual...');
  await d.login();

  await d.page.goto(`${ev}/inscricoes/nova`);
  await d.legenda('Formulário de Inscrição Manual', 'Preenchimento passo a passo do atleta');
  await d.esperar(2000);

  await d.legenda('Passo 1: Nome do Atleta');
  await d.digitar('#nome', 'Rodrigo Mendes', 80);
  await d.esperar(1000);

  await d.legenda('Passo 2: Idade');
  await d.digitar('#idade', 36, 80);
  await d.esperar(1000);

  await d.legenda('Passo 3: Sexo');
  await d.escolher('#sexo', 'MASCULINO');
  await d.esperar(1000);

  await d.legenda('Passo 4: Peso em kg');
  await d.digitar('#peso', '84.00', 80);
  await d.esperar(1000);

  await d.legenda('Passo 5: Faixa');
  await d.escolher('#faixa_id', { label: 'Roxa' });
  await d.esperar(1000);

  await d.legenda('Passo 6: Academia / Equipe');
  await d.escolher('#equipe_id', { label: 'Araújo JJ Team' });
  await d.esperar(1200);

  await d.legenda('Passo 7: Salvar Inscrição');
  await d.clicar('main form[method="POST"] button[type=submit]', { navega: true });

  if (d.page.url().includes('escolher-categoria') || (await d.page.locator('.category-selection-list').count()) > 0) {
    await d.clicar('button[type="submit"]', { navega: true });
  }

  const aviso = d.page.locator('.alert-aviso, .alert-warning');
  if (await aviso.count()) {
    await d.legenda('Aviso Automático: Chave já iniciada!', 'A inscrição fica PENDENTE para decisão do organizador');
    await d.rolarAte('.alert-aviso, .alert-warning');
    await d.moverPara(aviso.first());
  } else {
    await d.legenda('Inscrição concluída com sucesso!');
  }
  await d.esperar(3500);

  await d.finalizar();
}

if (require.main === module) {
  executar().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = executar;
