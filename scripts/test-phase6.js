const pool = require('../src/config/database');
require('dotenv').config();

async function runTests() {
  console.log('--- Iniciando Testes da Fase 6 (CRUD e Ordenacao de Faixas) ---');
  let testCount = 0;
  let passedCount = 0;

  function assert(condition, message) {
    testCount++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@campeonato.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'rafael06';

  // 1. Obter cookie de login e token CSRF
  const loginRes = await fetch('http://localhost:3000/login');
  const setCookie = loginRes.headers.get('set-cookie');
  const cookie = setCookie ? setCookie.split(';')[0] : '';
  const loginHtml = await loginRes.text();
  const csrfMatch = loginHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  const csrf = csrfMatch ? csrfMatch[1] : '';

  // 2. Fazer login
  const loginParams = new URLSearchParams({
    email: adminEmail,
    senha: adminPass,
    _csrf: csrf,
  });

  const authRes = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
    },
    body: loginParams.toString(),
    redirect: 'manual',
  });

  const authCookie = authRes.headers.get('set-cookie');
  const sessionCookie = authCookie ? authCookie.split(';')[0] : cookie;
  assert(authRes.status === 302, 'Login efetuado com sucesso');

  // Helper para obter CSRF logado
  async function getSessionCsrf() {
    const r = await fetch('http://localhost:3000/faixas', {
      headers: { Cookie: sessionCookie },
    });
    const h = await r.text();
    const m = h.match(/name="_csrf"\s+value="([^"]+)"/);
    return m ? m[1] : '';
  }

  const currentCsrf = await getSessionCsrf();
  assert(!!currentCsrf, 'Token CSRF obtido com sucesso');

  // Limpeza de testes anteriores
  await pool.query("DELETE FROM faixas WHERE nome ILIKE '%coral%' OR nome ILIKE '%vermelha%'");

  // --- LISTAGEM INICIAL ---
  const listRes = await fetch('http://localhost:3000/faixas', {
    headers: { Cookie: sessionCookie },
  });
  assert(listRes.status === 200, 'Listagem /faixas retorna status 200');
  const listHtml = await listRes.text();
  assert(listHtml.includes('faixas') || listHtml.includes('Ordem'), 'Listagem exibe faixas cadastradas');

  // --- CADASTRO DE FAIXA ---
  // 1. Cadastrar nova faixa com espaços múltiplos
  const createParams1 = new URLSearchParams({
    nome: '   Coral   Vermelha   e   Branca   ',
    _csrf: currentCsrf,
  });

  const createRes1 = await fetch('http://localhost:3000/faixas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: createParams1.toString(),
    redirect: 'manual',
  });

  assert(createRes1.status === 302, 'Criar faixa redireciona para /faixas (302)');
  assert(createRes1.headers.get('location') === '/faixas', 'Redirecionamento correto para /faixas');

  const dbCoral = await pool.query("SELECT * FROM faixas WHERE nome = 'Coral Vermelha e Branca'");
  assert(dbCoral.rows.length === 1, 'Faixa cadastrada com normalizacao de espacos');
  const coralId = dbCoral.rows[0].id;
  const coralOrdem = dbCoral.rows[0].ordem;

  // Verificar se entrou na maior ordem (no final da fila)
  const dbMaxOrdem = await pool.query('SELECT MAX(ordem) as max FROM faixas');
  assert(coralOrdem === dbMaxOrdem.rows[0].max, `Nova faixa entra no final com ordem ${coralOrdem}`);

  // 2. Tentar cadastrar nome duplicado (case insensitive)
  const createDupRes = await fetch('http://localhost:3000/faixas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'CORAL VERMELHA E BRANCA',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(createDupRes.status === 422, 'Nome duplicado (maiusculas) retorna status 422');
  const dupHtml = await createDupRes.text();
  assert(dupHtml.includes('Já existe uma faixa com este nome.'), 'Mensagem de duplicidade exibida');

  // 3. Tentar cadastrar nome vazio ou inválido
  const createVazioRes = await fetch('http://localhost:3000/faixas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: '   ',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(createVazioRes.status === 422, 'Nome vazio retorna status 422');

  const createCurtoRes = await fetch('http://localhost:3000/faixas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'X',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(createCurtoRes.status === 422, 'Nome com 1 caractere retorna status 422');

  // --- EDIÇÃO DE FAIXA ---
  // 1. Alterar nome mantendo a mesma ordem
  const editParams = new URLSearchParams({
    nome: 'Faixa Coral 7 Grau',
    _csrf: currentCsrf,
  });
  const editRes = await fetch(`http://localhost:3000/faixas/${coralId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: editParams.toString(),
    redirect: 'manual',
  });
  assert(editRes.status === 302, 'Edicao redireciona para /faixas (302)');

  const dbCoralEditada = await pool.query('SELECT * FROM faixas WHERE id = $1', [coralId]);
  assert(dbCoralEditada.rows[0].nome === 'Faixa Coral 7 Grau', 'Nome da faixa atualizado no banco');
  assert(dbCoralEditada.rows[0].ordem === coralOrdem, 'Ordem permaneceu inalterada na edicao');

  // 2. Tentar editar usando nome de outra faixa
  const editDupRes = await fetch(`http://localhost:3000/faixas/${coralId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Preta',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(editDupRes.status === 422, 'Edicao com nome ja em uso retorna 422');

  // 3. Editar faixa inexistente
  const editInexistenteRes = await fetch('http://localhost:3000/faixas/999999999', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Teste Inexistente',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(editInexistenteRes.status === 404, 'Editar faixa inexistente retorna 404');

  // --- ORDENAÇÃO (SUBIR / DESCER) ---
  // Cadastrar outra faixa temporária para testar troca
  const createTemp = new URLSearchParams({
    nome: 'Faixa Vermelha 9 Grau',
    _csrf: currentCsrf,
  });
  await fetch('http://localhost:3000/faixas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: createTemp.toString(),
  });

  const dbVermelha = await pool.query("SELECT * FROM faixas WHERE nome = 'Faixa Vermelha 9 Grau'");
  const vermelhaId = dbVermelha.rows[0].id;
  const vermelhaOrdemAntes = dbVermelha.rows[0].ordem;
  const coralOrdemAntes = (await pool.query('SELECT ordem FROM faixas WHERE id = $1', [coralId])).rows[0].ordem;

  assert(vermelhaOrdemAntes > coralOrdemAntes, 'Faixa Vermelha esta apos a Coral');

  // Subir Faixa Vermelha (deve trocar com a Coral)
  const subirRes = await fetch(`http://localhost:3000/faixas/${vermelhaId}/subir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(subirRes.status === 302, 'Subir faixa redireciona para /faixas');

  const dbVermelhaDepois = await pool.query('SELECT ordem FROM faixas WHERE id = $1', [vermelhaId]);
  const dbCoralDepois = await pool.query('SELECT ordem FROM faixas WHERE id = $1', [coralId]);

  assert(dbVermelhaDepois.rows[0].ordem === coralOrdemAntes, 'Vermelha assumiu a ordem anterior da Coral');
  assert(dbCoralDepois.rows[0].ordem === vermelhaOrdemAntes, 'Coral assumiu a ordem anterior da Vermelha');

  // Descer Faixa Vermelha (deve trocar de volta)
  const descerRes = await fetch(`http://localhost:3000/faixas/${vermelhaId}/descer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(descerRes.status === 302, 'Descer faixa redireciona para /faixas');

  const dbVermelhaVoltou = await pool.query('SELECT ordem FROM faixas WHERE id = $1', [vermelhaId]);
  assert(dbVermelhaVoltou.rows[0].ordem === vermelhaOrdemAntes, 'Vermelha voltou para sua posicao original');

  // Testar extremidade: subir primeira faixa (ordem 1)
  const dbPrimeira = await pool.query('SELECT id, ordem FROM faixas ORDER BY ordem ASC LIMIT 1');
  const primeiraId = dbPrimeira.rows[0].id;
  const subirPrimeiraRes = await fetch(`http://localhost:3000/faixas/${primeiraId}/subir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(subirPrimeiraRes.status === 302, 'Subir primeira faixa nao quebra e redireciona normalmente');
  const dbPrimeiraDepois = await pool.query('SELECT ordem FROM faixas WHERE id = $1', [primeiraId]);
  assert(dbPrimeiraDepois.rows[0].ordem === dbPrimeira.rows[0].ordem, 'Primeira faixa permanece na ordem original');

  // Testar extremidade: descer última faixa (Vermelha)
  const descerUltimaRes = await fetch(`http://localhost:3000/faixas/${vermelhaId}/descer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(descerUltimaRes.status === 302, 'Descer ultima faixa nao quebra e redireciona normalmente');
  const dbVermelhaDepoisDescer = await pool.query('SELECT ordem FROM faixas WHERE id = $1', [vermelhaId]);
  assert(dbVermelhaDepoisDescer.rows[0].ordem === vermelhaOrdemAntes, 'Ultima faixa permanece na sua ordem');

  // --- DEPENDÊNCIAS E EXCLUSÃO ---
  // 1. Tentar excluir faixa em uso por categoria (como faixa_minima_id)
  const evRes = await pool.query("INSERT INTO eventos (nome) VALUES ('Evento Teste Faixa') RETURNING id");
  const evId = evRes.rows[0].id;

  await pool.query(
    `INSERT INTO categorias (evento_id, nome, faixa_minima_id, sexo)
     VALUES ($1, 'Categoria Teste Faixa', $2, 'MASCULINO')`,
    [evId, primeiraId]
  );

  const deleteBrancaRes = await fetch(`http://localhost:3000/faixas/${primeiraId}/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });

  assert(deleteBrancaRes.status === 302, 'Tentativa de excluir faixa em uso redireciona com flash de erro');
  const dbBrancaAindaExiste = await pool.query('SELECT id FROM faixas WHERE id = $1', [primeiraId]);
  assert(dbBrancaAindaExiste.rows.length === 1, 'Faixa em uso NÃO foi excluída');

  // Limpa categoria e evento de teste
  await pool.query('DELETE FROM categorias WHERE evento_id = $1', [evId]);
  await pool.query('DELETE FROM eventos WHERE id = $1', [evId]);

  // 2. Excluir faixa sem uso (Coral e Vermelha criadas no teste)
  const deleteVermelhaRes = await fetch(`http://localhost:3000/faixas/${vermelhaId}/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(deleteVermelhaRes.status === 302, 'Excluir faixa sem uso redireciona com sucesso');

  const dbVermelhaExcluida = await pool.query('SELECT id FROM faixas WHERE id = $1', [vermelhaId]);
  assert(dbVermelhaExcluida.rows.length === 0, 'Faixa sem uso excluida do banco de dados');

  // Exclui a Coral também
  await fetch(`http://localhost:3000/faixas/${coralId}/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
  });

  // 3. Tentar excluir sem CSRF (deve dar 403)
  const noCsrfRes = await fetch(`http://localhost:3000/faixas/${primeiraId}/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({}).toString(),
  });
  assert(noCsrfRes.status === 403, 'Requisicao sem CSRF bloqueada com status 403');

  console.log(`\n--- RESULTADO FASE 6: ${passedCount} de ${testCount} testes passaram com sucesso! ---`);
  await pool.end();
}

runTests().catch((err) => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
