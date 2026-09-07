const pool = require('../src/config/database');
require('dotenv').config();

async function runTests() {
  console.log('--- Iniciando Testes da Fase 7 (CRUD de Equipes) ---');
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
  assert(authRes.status === 302, 'Login autenticado com sucesso');

  // Helper para obter CSRF
  async function getSessionCsrf() {
    const r = await fetch('http://localhost:3000/equipes', {
      headers: { Cookie: sessionCookie },
    });
    const h = await r.text();
    const m = h.match(/name="_csrf"\s+value="([^"]+)"/);
    return m ? m[1] : '';
  }

  const currentCsrf = await getSessionCsrf();
  assert(!!currentCsrf, 'Token CSRF obtido com sucesso');

  // --- LISTAGEM INICIAL ---
  const listRes = await fetch('http://localhost:3000/equipes', {
    headers: { Cookie: sessionCookie },
  });
  assert(listRes.status === 200, 'Listagem /equipes retorna status 200');

  // --- CADASTRO DE EQUIPE ---
  // 1. Cadastrar equipe com espaços múltiplos
  const createParams1 = new URLSearchParams({
    nome: '   Equipe   Gracie   Barra   ',
    _csrf: currentCsrf,
  });

  const createRes1 = await fetch('http://localhost:3000/equipes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: createParams1.toString(),
    redirect: 'manual',
  });

  assert(createRes1.status === 302, 'Criar equipe redireciona para /equipes (302)');
  assert(createRes1.headers.get('location') === '/equipes', 'Redirecionamento correto para /equipes');

  const dbEquipe1 = await pool.query("SELECT * FROM equipes WHERE nome = 'Equipe Gracie Barra'");
  assert(dbEquipe1.rows.length === 1, 'Equipe cadastrada com normalizacao de espacos');
  const equipeId1 = dbEquipe1.rows[0].id;

  // 2. Tentar cadastrar nome duplicado (case-insensitive)
  const createDupRes = await fetch('http://localhost:3000/equipes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'EQUIPE GRACIE BARRA',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(createDupRes.status === 422, 'Nome duplicado retorna status 422');
  const dupHtml = await createDupRes.text();
  assert(dupHtml.includes('Já existe uma equipe com este nome.'), 'Mensagem de duplicidade exibida');

  // 3. Tentar cadastrar nome vazio ou com 1 caractere
  const createVazioRes = await fetch('http://localhost:3000/equipes', {
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

  const createCurtoRes = await fetch('http://localhost:3000/equipes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'G',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(createCurtoRes.status === 422, 'Nome com 1 caractere retorna status 422');

  // --- EDIÇÃO DE EQUIPE ---
  // 1. Atualizar nome
  const editParams = new URLSearchParams({
    nome: 'Gracie Barra Premium',
    _csrf: currentCsrf,
  });
  const editRes = await fetch(`http://localhost:3000/equipes/${equipeId1}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: editParams.toString(),
    redirect: 'manual',
  });
  assert(editRes.status === 302, 'Edicao redireciona para /equipes (302)');

  const dbEquipeEditada = await pool.query('SELECT * FROM equipes WHERE id = $1', [equipeId1]);
  assert(dbEquipeEditada.rows[0].nome === 'Gracie Barra Premium', 'Nome da equipe atualizado no banco');

  // 2. Cadastrar uma segunda equipe para testar duplicidade na edição
  await fetch('http://localhost:3000/equipes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Checkmat',
      _csrf: currentCsrf,
    }).toString(),
  });
  const dbCheckmat = await pool.query("SELECT id FROM equipes WHERE nome = 'Checkmat'");
  const checkmatId = dbCheckmat.rows[0].id;

  // Tentar editar a segunda com o nome da primeira
  const editDupRes = await fetch(`http://localhost:3000/equipes/${checkmatId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Gracie Barra Premium',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(editDupRes.status === 422, 'Editar usando nome de outra equipe retorna 422');

  // 3. Editar equipe inexistente ou ID inválido
  const editInexistenteRes = await fetch('http://localhost:3000/equipes/999999999', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Nova Checkmat',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(editInexistenteRes.status === 404, 'Editar equipe inexistente retorna 404');

  const editIdInvalidoRes = await fetch('http://localhost:3000/equipes/abc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({
      nome: 'Nova Checkmat',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(editIdInvalidoRes.status === 404, 'Editar ID invalido retorna 404');

  // --- DEPENDÊNCIAS E EXCLUSÃO ---
  // 1. Tentar excluir equipe com inscrição vinculada
  const evRes = await pool.query("INSERT INTO eventos (nome) VALUES ('Evento Teste Equipe') RETURNING id");
  const evId = evRes.rows[0].id;

  const catRes = await pool.query(
    `INSERT INTO categorias (evento_id, nome, sexo)
     VALUES ($1, 'Categoria Teste Equipe', 'MASCULINO') RETURNING id`,
    [evId]
  );
  const catId = catRes.rows[0].id;

  const faixaRes = await pool.query('SELECT id FROM faixas LIMIT 1');
  const faixaId = faixaRes.rows[0].id;

  const inscricaoRes = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo)
     VALUES ($1, $2, $3, $4, 'Atleta Teste', 25, 75.50, 'MASCULINO') RETURNING id`,
    [evId, catId, equipeId1, faixaId]
  );
  const inscricaoId = inscricaoRes.rows[0].id;

  // Tentar excluir equipeId1 (tem inscrição vinculada)
  const deleteBlockedRes = await fetch(`http://localhost:3000/equipes/${equipeId1}/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });

  assert(deleteBlockedRes.status === 302, 'Tentativa de excluir equipe com inscricao redireciona (302)');
  const dbEquipeAindaExiste = await pool.query('SELECT id FROM equipes WHERE id = $1', [equipeId1]);
  assert(dbEquipeAindaExiste.rows.length === 1, 'Equipe com inscricao vinculada NAO foi excluida');

  // Limpa dados vinculados de teste
  await pool.query('DELETE FROM inscricoes WHERE id = $1', [inscricaoId]);
  await pool.query('DELETE FROM categorias WHERE id = $1', [catId]);
  await pool.query('DELETE FROM eventos WHERE id = $1', [evId]);

  // 2. Excluir equipe livre (sem inscrições)
  const deleteSuccessRes1 = await fetch(`http://localhost:3000/equipes/${equipeId1}/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(deleteSuccessRes1.status === 302, 'Excluir equipe livre redireciona para /equipes');

  const dbEquipeExcluida1 = await pool.query('SELECT id FROM equipes WHERE id = $1', [equipeId1]);
  assert(dbEquipeExcluida1.rows.length === 0, 'Equipe excluida do banco de dados');

  // Excluir a Checkmat também
  await fetch(`http://localhost:3000/equipes/${checkmatId}/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
  });

  // 3. Tentar excluir sem CSRF (403)
  const noCsrfRes = await fetch(`http://localhost:3000/equipes/1/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({}).toString(),
  });
  assert(noCsrfRes.status === 403, 'Exclusao sem CSRF bloqueada com status 403');

  console.log(`\n--- RESULTADO FASE 7: ${passedCount} de ${testCount} testes passaram com sucesso! ---`);
  await pool.end();
}

runTests().catch((err) => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
