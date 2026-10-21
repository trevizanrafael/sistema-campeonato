// Executor principal de demos do sistema.
//
// Exemplos de uso:
//   npm run demo                   -> grava todos os cenários
//   npm run demo -- tour           -> grava o tour completo geral
//   npm run demo -- chaves         -> grava as chaves e sorteio
//   npm run demo -- lutas          -> grava o lançamento de resultado
//   npm run demo -- pontuacao      -> grava a configuração de pontuação
//   npm run demo -- ranking        -> grava o ranking das academias
//   npm run demo -- tour --ver     -> grava mostrando a janela na tela
//
const cenarios = {
  login: require('./cenarios/01-login'),
  campeonato: require('./cenarios/02-criar-campeonato'),
  documento: require('./cenarios/03-inscricao-documento'),
  manual: require('./cenarios/04-inscricao-manual'),
  pontuacao: require('./cenarios/05-configurar-pontuacao'),
  chaves: require('./cenarios/06-chaves-e-sorteio'),
  lutas: require('./cenarios/07-resultado-e-lutas'),
  ranking: require('./cenarios/08-ranking-academias'),
  tour: require('./cenarios/09-tour-completo'),
};

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const filtro = args[0] ? args[0].toLowerCase() : null;

  if (filtro && cenarios[filtro]) {
    console.log(`▶ Executando cenário: ${filtro}`);
    await cenarios[filtro]();
    return;
  }

  if (filtro && filtro !== 'todos') {
    console.error(`Cenário "${filtro}" não encontrado. Escolha entre:\n  ${Object.keys(cenarios).join(', ')}, todos`);
    process.exit(1);
  }

  console.log('▶ Executando todos os cenários passo a passo...');
  for (const [nome, func] of Object.entries(cenarios)) {
    console.log(`\n========================================`);
    console.log(` Gravando: ${nome}`);
    console.log(`========================================`);
    await func();
  }
  console.log('\n✓ Todos os vídeos foram gerados com sucesso na pasta demo/videos/!');
}

main().catch((err) => {
  console.error('Erro na execução da demo:', err);
  process.exit(1);
});
