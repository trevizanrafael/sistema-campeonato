const pool = require('../src/config/database');
require('dotenv').config();

async function runTests() {
  console.log('--- Iniciando Testes da Fase 5 (CRUD de Eventos) ---');
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
  assert(authRes.status === 302, 'Login com sucesso e redirecionamento (302)');

  // Helper para obter CSRF logado
  async function getSessionCsrf() {
    const r = await fetch('http://localhost:3000/eventos/novo', {
      headers: { Cookie: sessionCookie },
    });
    const h = await r.text();
    const m = h.match(/name="_csrf"\s+value="([^"]+)"/);
    return m ? m[1] : '';
  }

  const currentCsrf = await getSessionCsrf();
  assert(!!currentCsrf, 'Token CSRF obtido para a sessao autenticada');

  // --- TESTES DE CADASTRO ---
  // Cadastro com nome e descrição
  const params1 = new URLSearchParams({
    nome: '  Campeonato Paulista 2026  ',
    descricao: '  Primeira etapa oficial do circuito  ',
    _csrf: currentCsrf,
  });

  const createRes1 = await fetch('http://localhost:3000/eventos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: params1.toString(),
    redirect: 'manual',
  });

  assert(createRes1.status === 302, 'Criar evento com nome e descricao retorna 302');
  const location1 = createRes1.headers.get('location');
  const eventoId1 = location1.replace('/eventos/', '');
  assert(Number(eventoId1) > 0, `Evento criado com ID valido: ${eventoId1}`);

  // Verificar no banco a normalização (trim) e regra de pontuação criada na transação
  const dbEvento1 = await pool.query('SELECT * FROM eventos WHERE id = $1', [eventoId1]);
  assert(dbEvento1.rows[0].nome === 'Campeonato Paulista 2026', 'Espacos externos do nome removidos com trim');
  assert(dbEvento1.rows[0].descricao === 'Primeira etapa oficial do circuito', 'Espacos externos da descricao removidos');

  const dbRegra1 = await pool.query('SELECT * FROM regras_pontuacao WHERE evento_id = $1', [eventoId1]);
  assert(dbRegra1.rows.length === 1, 'Regra de pontuacao padrao criada automaticamente');
  assert(dbRegra1.rows[0].pontos_vitoria === 0, 'Regra de pontuacao inicializada com valores padrao');

  // Cadastro somente com nome (descricao vazia deve virar null)
  const params2 = new URLSearchParams({
    nome: 'Torneio Aberto',
    descricao: '   ',
    _csrf: currentCsrf,
  });

  const createRes2 = await fetch('http://localhost:3000/eventos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: params2.toString(),
    redirect: 'manual',
  });

  const eventoId2 = createRes2.headers.get('location').replace('/eventos/', '');
  const dbEvento2 = await pool.query('SELECT * FROM eventos WHERE id = $1', [eventoId2]);
  assert(dbEvento2.rows[0].descricao === null, 'Descricao vazia convertida para null');

  // Validação: Tentar criar sem nome
  const paramsSemNome = new URLSearchParams({
    nome: '   ',
    descricao: 'teste',
    _csrf: currentCsrf,
  });
  const resSemNome = await fetch('http://localhost:3000/eventos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: paramsSemNome.toString(),
  });
  assert(resSemNome.status === 422, 'Criar sem nome retorna status 422');
  const htmlSemNome = await resSemNome.text();
  assert(htmlSemNome.includes('Informe o nome do evento.'), 'Exibe mensagem de validacao para nome obrigatorio');

  // Validação: Tentar criar com nome de 1 caractere
  const paramsNomeCurto = new URLSearchParams({
    nome: 'A',
    _csrf: currentCsrf,
  });
  const resNomeCurto = await fetch('http://localhost:3000/eventos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: paramsNomeCurto.toString(),
  });
  assert(resNomeCurto.status === 422, 'Nome com 1 caractere retorna status 422');

  // --- TESTES DE LISTAGEM E PESQUISA ---
  const listRes = await fetch('http://localhost:3000/eventos', {
    headers: { Cookie: sessionCookie },
  });
  assert(listRes.status === 200, 'Listagem /eventos retorna status 200');
  const listHtml = await listRes.text();
  assert(listHtml.includes('Campeonato Paulista 2026'), 'Listagem contem o evento criado');

  // Pesquisa por nome
  const searchNomeRes = await fetch('http://localhost:3000/eventos?busca=Paulista', {
    headers: { Cookie: sessionCookie },
  });
  const searchNomeHtml = await searchNomeRes.text();
  assert(searchNomeHtml.includes('Campeonato Paulista 2026'), 'Pesquisa por nome encontra evento');
  assert(!searchNomeHtml.includes('Torneio Aberto'), 'Pesquisa filtra os outros eventos');

  // Pesquisa por descrição
  const searchDescRes = await fetch('http://localhost:3000/eventos?busca=circuito', {
    headers: { Cookie: sessionCookie },
  });
  const searchDescHtml = await searchDescRes.text();
  assert(searchDescHtml.includes('Campeonato Paulista 2026'), 'Pesquisa por descricao encontra evento');

  // Pesquisa sem resultados
  const searchVaziaRes = await fetch('http://localhost:3000/eventos?busca=InexistenteXYZ123', {
    headers: { Cookie: sessionCookie },
  });
  const searchVaziaHtml = await searchVaziaRes.text();
  assert(searchVaziaHtml.includes('Nenhum resultado encontrado'), 'Pesquisa sem resultados exibe empty state correto');
  assert(searchVaziaHtml.includes('Limpar pesquisa'), 'Exibe botao de limpar pesquisa');

  // --- TESTES DE VISUALIZAÇÃO ---
  const showRes = await fetch(`http://localhost:3000/eventos/${eventoId1}`, {
    headers: { Cookie: sessionCookie },
  });
  assert(showRes.status === 200, 'Visualizacao do evento retorna status 200');
  const showHtml = await showRes.text();
  assert(showHtml.includes('Campeonato Paulista 2026'), 'Show exibe o nome do evento');
  assert(showHtml.includes('Categorias') && showHtml.includes('Inscricoes'), 'Show exibe cards de estatisticas');
  assert(showHtml.includes('Excluir evento'), 'Show exibe zona de exclusao');

  // ID inexistente
  const notFoundRes = await fetch('http://localhost:3000/eventos/999999999', {
    headers: { Cookie: sessionCookie },
  });
  assert(notFoundRes.status === 404, 'Evento inexistente retorna 404');

  // ID inválido
  const invalidIdRes = await fetch('http://localhost:3000/eventos/abc', {
    headers: { Cookie: sessionCookie },
  });
  assert(invalidIdRes.status === 404, 'ID invalido (texto) retorna 404');

  const negativeIdRes = await fetch('http://localhost:3000/eventos/-5', {
    headers: { Cookie: sessionCookie },
  });
  assert(negativeIdRes.status === 404, 'ID negativo retorna 404');

  // Subrotas provisórias
  const catRes = await fetch(`http://localhost:3000/eventos/${eventoId1}/categorias`, {
    headers: { Cookie: sessionCookie },
  });
  assert(catRes.status === 200, 'Subrota /categorias retorna 200 (Em construcao)');

  // --- TESTES DE EDIÇÃO ---
  const editParams = new URLSearchParams({
    nome: 'Campeonato Paulista 2026 - Edicao Especial',
    descricao: 'Descricao atualizada com sucesso',
    _csrf: currentCsrf,
  });
  const editRes = await fetch(`http://localhost:3000/eventos/${eventoId1}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: editParams.toString(),
    redirect: 'manual',
  });
  assert(editRes.status === 302, 'Edicao do evento redireciona com status 302');
  assert(editRes.headers.get('location') === '/eventos', 'Redireciona para /eventos');

  const dbEventoEditado = await pool.query('SELECT * FROM eventos WHERE id = $1', [eventoId1]);
  assert(dbEventoEditado.rows[0].nome === 'Campeonato Paulista 2026 - Edicao Especial', 'Nome atualizado no banco');
  assert(dbEventoEditado.rows[0].descricao === 'Descricao atualizada com sucesso', 'Descricao atualizada no banco');

  // --- TESTES DE EXCLUSÃO E INTEGRIDADE ---
  // 1. Tentar excluir evento COM categoria (simulação de dependência)
  // Cria uma categoria vinculada ao eventoId1
  const catInsert = await pool.query(
    `INSERT INTO categorias (evento_id, nome, sexo)
     VALUES ($1, 'Absoluto Adulto', 'MASCULINO') RETURNING id`,
    [eventoId1]
  );
  const catId = catInsert.rows[0].id;

  const deleteBlockedRes = await fetch(`http://localhost:3000/eventos/${eventoId1}/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(deleteBlockedRes.status === 302, 'Exclusao bloqueada redireciona (302)');
  assert(deleteBlockedRes.headers.get('location') === `/eventos/${eventoId1}`, 'Redireciona de volta para o evento');

  const dbAindaExiste = await pool.query('SELECT id FROM eventos WHERE id = $1', [eventoId1]);
  assert(dbAindaExiste.rows.length === 1, 'Evento NAO foi excluido devido as dependencias vinculadas');

  // Remove a categoria de teste
  await pool.query('DELETE FROM categorias WHERE id = $1', [catId]);

  // 2. Excluir evento vazio (deve funcionar e cascade-deletar regras_pontuacao)
  const deleteSuccessRes = await fetch(`http://localhost:3000/eventos/${eventoId1}/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(deleteSuccessRes.status === 302, 'Exclusao de evento vazio redireciona (302)');
  assert(deleteSuccessRes.headers.get('location') === '/eventos', 'Redireciona para /eventos');

  const dbExcluido = await pool.query('SELECT id FROM eventos WHERE id = $1', [eventoId1]);
  assert(dbExcluido.rows.length === 0, 'Evento excluido do banco');

  const dbRegraExcluida = await pool.query('SELECT id FROM regras_pontuacao WHERE evento_id = $1', [eventoId1]);
  assert(dbRegraExcluida.rows.length === 0, 'Regra de pontuacao excluida automaticamente via cascade');

  // Limpa o segundo evento de teste
  await pool.query('DELETE FROM eventos WHERE id = $1', [eventoId2]);

  console.log(`\n--- RESULTADO: ${passedCount} de ${testCount} testes passaram com sucesso! ---`);
  await pool.end();
}

runTests().catch((err) => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
