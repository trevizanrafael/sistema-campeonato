const pool = require('../src/config/database');
const { buscarCategoriasCompativeis } = require('../src/services/classificacaoService');
require('dotenv').config();

async function runTests() {
  console.log('--- Iniciando Testes da Fase 9 (Inscrições Manuais e Classificação) ---');
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

  // ==========================================
  // 1. TESTES UNITÁRIOS DE CLASSIFICAÇÃO
  // ==========================================
  console.log('\n--- 1. Testes Unitários de buscarCategoriasCompativeis ---');
  const categoriasMock = [
    { id: 1, nome: 'Cat A', idade_minima: 18, idade_maxima: 29, peso_minimo: null, peso_maximo: 70, faixa_minima_ordem: 2, faixa_maxima_ordem: 2, sexo: 'MASCULINO' },
    { id: 2, nome: 'Cat B', idade_minima: 18, idade_maxima: 29, peso_minimo: 70, peso_maximo: 80, faixa_minima_ordem: 2, faixa_maxima_ordem: 2, sexo: 'MASCULINO' },
    { id: 3, nome: 'Cat C (Sobreposta)', idade_minima: 18, idade_maxima: 35, peso_minimo: null, peso_maximo: 75, faixa_minima_ordem: 2, faixa_maxima_ordem: 3, sexo: 'MASCULINO' },
  ];

  // Atleta com 68 kg, 20 anos, faixa ordem 2
  const compativeis1 = buscarCategoriasCompativeis(
    { idade: 20, peso: 68, faixa_ordem: 2, sexo: 'MASCULINO' },
    categoriasMock
  );
  assert(compativeis1.length === 2, 'Encontra 2 categorias compativeis quando ha sobreposicao (Cat A e Cat C)');

  // Atleta com exatamente 70.00 kg
  const compativeis70 = buscarCategoriasCompativeis(
    { idade: 20, peso: 70.0, faixa_ordem: 2, sexo: 'MASCULINO' },
    categoriasMock
  );
  assert(compativeis70.some((c) => c.id === 1), 'Atleta de 70 kg entra em Cat A (ate 70 kg)');
  assert(!compativeis70.some((c) => c.id === 2), 'Atleta de 70 kg NAO entra em Cat B (acima de 70 kg)');

  // Atleta com 70.01 kg
  const compativeis7001 = buscarCategoriasCompativeis(
    { idade: 20, peso: 70.01, faixa_ordem: 2, sexo: 'MASCULINO' },
    categoriasMock
  );
  assert(compativeis7001.some((c) => c.id === 2), 'Atleta de 70.01 kg entra em Cat B (acima de 70 kg)');

  // ==========================================
  // 2. CONFIGURAÇÃO DE AMBIENTE PARA TESTES HTTP
  // ==========================================
  console.log('\n--- 2. Autenticação e Criação de Eventos, Equipes e Categorias ---');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@campeonato.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'rafael06';

  const loginRes = await fetch('http://localhost:3000/login');
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];
  const loginHtml = await loginRes.text();
  const csrf = loginHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const authRes = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: new URLSearchParams({ email: adminEmail, senha: adminPass, _csrf: csrf }).toString(),
    redirect: 'manual',
  });
  const sessionCookie = authRes.headers.get('set-cookie').split(';')[0];
  assert(authRes.status === 302, 'Admin autenticado com sucesso');

  const ts = Date.now();

  async function cleanup() {
    try {
      await pool.query(`
        DELETE FROM lutas WHERE chave_id IN (
          SELECT id FROM chaves WHERE categoria_id IN (
            SELECT id FROM categorias WHERE evento_id IN (
              SELECT id FROM eventos WHERE nome LIKE 'Evento Alpha F9%' OR nome LIKE 'Evento Beta F9%'
            )
          )
        )
      `);
      await pool.query(`
        DELETE FROM chaves WHERE categoria_id IN (
          SELECT id FROM categorias WHERE evento_id IN (
            SELECT id FROM eventos WHERE nome LIKE 'Evento Alpha F9%' OR nome LIKE 'Evento Beta F9%'
          )
        )
      `);
      await pool.query(`
        DELETE FROM inscricoes WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento Alpha F9%' OR nome LIKE 'Evento Beta F9%'
        )
      `);
      await pool.query(`
        DELETE FROM categorias WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento Alpha F9%' OR nome LIKE 'Evento Beta F9%'
        )
      `);
      await pool.query(`
        DELETE FROM regras_pontuacao WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento Alpha F9%' OR nome LIKE 'Evento Beta F9%'
        )
      `);
      await pool.query(`
        DELETE FROM eventos WHERE nome LIKE 'Evento Alpha F9%' OR nome LIKE 'Evento Beta F9%'
      `);
      await pool.query(`
        DELETE FROM equipes WHERE nome LIKE 'Equipe Gracie Alpha%' OR nome LIKE 'Equipe Alliance Beta%'
      `);
    } catch (_) {}
  }

  // Limpar dados anteriores
  await cleanup();

  // Criar 2 eventos para testar isolamento
  const ev1Res = await pool.query("INSERT INTO eventos (nome) VALUES ('Evento Alpha F9 " + ts + "') RETURNING id");
  const ev1Id = ev1Res.rows[0].id;

  const ev2Res = await pool.query("INSERT INTO eventos (nome) VALUES ('Evento Beta F9 " + ts + "') RETURNING id");
  const ev2Id = ev2Res.rows[0].id;

  // Criar 2 equipes
  const eq1Res = await pool.query("INSERT INTO equipes (nome) VALUES ('Equipe Gracie Alpha " + ts + "') RETURNING id");
  const eq1Id = eq1Res.rows[0].id;

  const eq2Res = await pool.query("INSERT INTO equipes (nome) VALUES ('Equipe Alliance Beta " + ts + "') RETURNING id");
  const eq2Id = eq2Res.rows[0].id;

  // Obter faixas do seed
  const faixasRows = (await pool.query('SELECT id, nome, ordem FROM faixas ORDER BY ordem')).rows;
  const faixaBranca = faixasRows.find((f) => f.nome.toLowerCase().includes('branca')) || faixasRows[0];
  const faixaAzul = faixasRows.find((f) => f.nome.toLowerCase().includes('azul')) || faixasRows[1];
  const faixaRoxa = faixasRows.find((f) => f.nome.toLowerCase().includes('roxa')) || faixasRows[2];

  // Criar categorias no Evento 1:
  // Cat 1: Juvenil Azul ate 60 kg (16-17 anos, <= 60 kg, faixa Azul, MASCULINO)
  const cat1Res = await pool.query(
    `INSERT INTO categorias (evento_id, nome, idade_minima, idade_maxima, peso_minimo, peso_maximo, faixa_minima_id, faixa_maxima_id, sexo)
     VALUES ($1, 'Juvenil Azul ate 60 kg', 16, 17, NULL, 60.00, $2, $2, 'MASCULINO') RETURNING id`,
    [ev1Id, faixaAzul.id]
  );
  const cat1Id = cat1Res.rows[0].id;

  // Cat 2: Adulto Azul 70 a 80 kg (18-35 anos, > 70 e <= 80 kg, faixa Azul, MASCULINO)
  const cat2Res = await pool.query(
    `INSERT INTO categorias (evento_id, nome, idade_minima, idade_maxima, peso_minimo, peso_maximo, faixa_minima_id, faixa_maxima_id, sexo)
     VALUES ($1, 'Adulto Azul 70 a 80 kg', 18, 35, 70.00, 80.00, $2, $2, 'MASCULINO') RETURNING id`,
    [ev1Id, faixaAzul.id]
  );
  const cat2Id = cat2Res.rows[0].id;

  // Cat 3 (Sobreposta com Cat 2): Adulto Azul ate 75 kg (18-35 anos, <= 75 kg, faixa Azul, MASCULINO)
  // Atleta de 73 kg se sobrepõe em Cat 2 (>70 e <=80) e Cat 3 (<=75)!
  const cat3Res = await pool.query(
    `INSERT INTO categorias (evento_id, nome, idade_minima, idade_maxima, peso_minimo, peso_maximo, faixa_minima_id, faixa_maxima_id, sexo)
     VALUES ($1, 'Adulto Azul ate 75 kg', 18, 35, NULL, 75.00, $2, $2, 'MASCULINO') RETURNING id`,
    [ev1Id, faixaAzul.id]
  );
  const cat3Id = cat3Res.rows[0].id;

  // Helper CSRF
  async function getCsrf(url = `http://localhost:3000/eventos/${ev1Id}/inscricoes/nova`) {
    const r = await fetch(url, { headers: { Cookie: sessionCookie } });
    const h = await r.text();
    const m = h.match(/name="_csrf"\s+value="([^"]+)"/);
    return m ? m[1] : '';
  }

  const currentCsrf = await getCsrf();
  assert(!!currentCsrf, 'Token CSRF obtido com sucesso para inscrições');

  // ==========================================
  // 3. CLASSIFICAÇÃO AUTOMÁTICA ÚNICA (1 CATEGORIA)
  // ==========================================
  console.log('\n--- 3. Classificação Automática Única ---');
  // Competidor com 16 anos, 58 kg, faixa Azul, Masculino -> Deve cair em Cat 1
  const cadUnicaRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Carlos Juvenil',
      idade: '16',
      peso: '58,5',
      sexo: 'MASCULINO',
      faixa_id: String(faixaAzul.id),
      equipe_id: String(eq1Id),
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });

  assert(cadUnicaRes.status === 302, 'Cadastro com classificacao unica redireciona (302)');
  assert(
    cadUnicaRes.headers.get('location') === `/eventos/${ev1Id}/inscricoes`,
    'Redireciona para /eventos/:id/inscricoes'
  );

  const inscDb1 = await pool.query(
    "SELECT * FROM inscricoes WHERE evento_id = $1 AND nome = 'Carlos Juvenil'",
    [ev1Id]
  );
  assert(inscDb1.rows.length === 1, 'Inscricao gravada no banco');
  assert(String(inscDb1.rows[0].categoria_id) === String(cat1Id), 'Associada automaticamente a Cat 1');
  assert(inscDb1.rows[0].status === 'CONFIRMADA', 'Status definido como CONFIRMADA');
  assert(Number(inscDb1.rows[0].peso) === 58.5, 'Peso normalizado de virgula para float (58.5)');
  const insc1Id = inscDb1.rows[0].id;

  // ==========================================
  // 4. CLASSIFICAÇÃO PENDENTE (0 CATEGORIAS)
  // ==========================================
  console.log('\n--- 4. Nenhuma Categoria Compatível (Pendente) ---');
  // Atleta Faixa Roxa (não há categoria roxa no evento)
  const cadSemCatRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Rodrigo Sem Categoria',
      idade: '25',
      peso: '85.0',
      sexo: 'MASCULINO',
      faixa_id: String(faixaRoxa.id),
      equipe_id: String(eq2Id),
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });

  assert(cadSemCatRes.status === 302, 'Cadastro sem categoria compativel redireciona (302)');
  const inscDbPendente = await pool.query(
    "SELECT * FROM inscricoes WHERE evento_id = $1 AND nome = 'Rodrigo Sem Categoria'",
    [ev1Id]
  );
  assert(inscDbPendente.rows.length === 1, 'Inscricao pendente salva no banco');
  assert(inscDbPendente.rows[0].categoria_id === null, 'categoria_id salvo como NULL');
  assert(inscDbPendente.rows[0].status === 'PENDENTE', 'status salvo como PENDENTE');
  const inscPendenteId = inscDbPendente.rows[0].id;

  // ==========================================
  // 5. MÚLTIPLAS CATEGORIAS (ESCOLHA)
  // ==========================================
  console.log('\n--- 5. Múltiplas Categorias Compatíveis (Tela de Escolha) ---');
  // Atleta com 25 anos, 73 kg, faixa Azul, Masculino -> Compatível com Cat 2 e Cat 3
  const cadMultiplaRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Marcos Empate',
      idade: '25',
      peso: '73.0',
      sexo: 'MASCULINO',
      faixa_id: String(faixaAzul.id),
      equipe_id: String(eq1Id),
      _csrf: currentCsrf,
    }).toString(),
  });

  assert(cadMultiplaRes.status === 200, 'Multiplas categorias renderiza tela de escolha (status 200)');
  const chooseHtml = await cadMultiplaRes.text();
  assert(chooseHtml.includes('Escolha a categoria do competidor'), 'Exibe titulo da tela de escolha');
  assert(chooseHtml.includes('Adulto Azul 70 a 80 kg'), 'Contem primeira opcao compativel (Cat 2)');
  assert(chooseHtml.includes('Adulto Azul ate 75 kg'), 'Contem segunda opcao compativel (Cat 3)');
  assert(chooseHtml.includes('name="categoria_confirmada"'), 'Contem flag categoria_confirmada');

  // Confirmar escolha selecionando Cat 3
  const confirmChoiceRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Marcos Empate',
      idade: '25',
      peso: '73.0',
      sexo: 'MASCULINO',
      faixa_id: String(faixaAzul.id),
      equipe_id: String(eq1Id),
      categoria_id: String(cat3Id),
      categoria_confirmada: '1',
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });

  assert(confirmChoiceRes.status === 302, 'Confirmacao da escolha redireciona para a lista (302)');
  const inscDbConfirmada = await pool.query(
    "SELECT * FROM inscricoes WHERE evento_id = $1 AND nome = 'Marcos Empate'",
    [ev1Id]
  );
  assert(inscDbConfirmada.rows.length === 1, 'Inscricao confirmada salva no banco');
  assert(String(inscDbConfirmada.rows[0].categoria_id) === String(cat3Id), 'Gravada na categoria escolhida (Cat 3)');
  assert(inscDbConfirmada.rows[0].status === 'CONFIRMADA', 'Status definido como CONFIRMADA');
  const inscMultiplaId = inscDbConfirmada.rows[0].id;

  // Tentativa maliciosa: escolher categoria de outro evento (deve retornar 422)
  const cadCatOutroEventoRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Atleta Malicioso',
      idade: '25',
      peso: '73.0',
      sexo: 'MASCULINO',
      faixa_id: String(faixaAzul.id),
      equipe_id: String(eq1Id),
      categoria_id: '999999',
      categoria_confirmada: '1',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(cadCatOutroEventoRes.status === 422, 'Escolha de categoria inexistente ou de outro evento rejeitada (422)');

  // Tentativa maliciosa: escolher categoria incompatível com os dados
  const cadCatIncompativelRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Atleta Incompativel',
      idade: '25',
      peso: '73.0', // > 60 kg e idade > 17
      sexo: 'MASCULINO',
      faixa_id: String(faixaAzul.id),
      equipe_id: String(eq1Id),
      categoria_id: String(cat1Id), // Cat 1 exige idade 16-17 e peso <= 60
      categoria_confirmada: '1',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(cadCatIncompativelRes.status === 422, 'Escolha forçada de categoria incompatível rejeitada (422)');

  // ==========================================
  // 6. VALIDAÇÕES DO FORMULÁRIO
  // ==========================================
  console.log('\n--- 6. Validações de Formulário ---');
  // Idade inválida (< 0)
  const erroIdadeRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Teste Idade',
      idade: '-1',
      peso: '70',
      sexo: 'MASCULINO',
      faixa_id: String(faixaAzul.id),
      equipe_id: String(eq1Id),
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(erroIdadeRes.status === 422, 'Bloqueia idade negativa (422)');

  // Peso inválido (<= 0)
  const erroPesoRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Teste Peso',
      idade: '20',
      peso: '0',
      sexo: 'MASCULINO',
      faixa_id: String(faixaAzul.id),
      equipe_id: String(eq1Id),
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(erroPesoRes.status === 422, 'Bloqueia peso zero ou negativo (422)');

  // Sexo inválido
  const erroSexoRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Teste Sexo',
      idade: '20',
      peso: '70',
      sexo: 'MISTO', // competidor não pode ter sexo MISTO
      faixa_id: String(faixaAzul.id),
      equipe_id: String(eq1Id),
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(erroSexoRes.status === 422, 'Bloqueia competidor com sexo diferente de MASCULINO/FEMININO (422)');

  // ==========================================
  // 7. EDIÇÃO E RECLASSIFICAÇÃO
  // ==========================================
  console.log('\n--- 7. Edição e Reclassificação ---');
  // 1. Alterar apenas o nome: preserva a categoria atual
  const editNomeRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes/${insc1Id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Carlos Juvenil da Silva',
      idade: '16',
      peso: '58.5',
      sexo: 'MASCULINO',
      faixa_id: String(faixaAzul.id),
      equipe_id: String(eq1Id),
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });
  assert(editNomeRes.status === 302, 'Edicao de nome redireciona (302)');

  const dbInscEdit1 = await pool.query('SELECT * FROM inscricoes WHERE id = $1', [insc1Id]);
  assert(dbInscEdit1.rows[0].nome === 'Carlos Juvenil da Silva', 'Nome atualizado com sucesso');
  assert(String(dbInscEdit1.rows[0].categoria_id) === String(cat1Id), 'Categoria preservada após alteração de nome');

  // 2. Alterar idade para 25 e peso para 72: deve reclassificar
  // Competidor estava em Cat 1; com novos dados torna-se compatível com Cat 2 e Cat 3
  const editReclassRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes/${insc1Id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Carlos Juvenil da Silva',
      idade: '25',
      peso: '72.0',
      sexo: 'MASCULINO',
      faixa_id: String(faixaAzul.id),
      equipe_id: String(eq1Id),
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(editReclassRes.status === 200, 'Reclassificacao com multiplas categorias exibe escolha na edicao (200)');

  // Confirmar escolha na edição
  const editConfirmRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes/${insc1Id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Carlos Juvenil da Silva',
      idade: '25',
      peso: '72.0',
      sexo: 'MASCULINO',
      faixa_id: String(faixaAzul.id),
      equipe_id: String(eq1Id),
      categoria_id: String(cat2Id),
      categoria_confirmada: '1',
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });
  assert(editConfirmRes.status === 302, 'Confirmacao de categoria na edicao redireciona (302)');

  const dbInscReclass = await pool.query('SELECT * FROM inscricoes WHERE id = $1', [insc1Id]);
  assert(String(dbInscReclass.rows[0].categoria_id) === String(cat2Id), 'Reclassificado para Cat 2');

  // ==========================================
  // 8. CANCELAMENTO E REATIVAÇÃO
  // ==========================================
  console.log('\n--- 8. Cancelamento e Reativação ---');
  // Cancelar inscrição
  const cancelarRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes/${insc1Id}/cancelar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(cancelarRes.status === 302, 'Cancelar inscricao redireciona (302)');

  const dbInscCancelada = await pool.query('SELECT status FROM inscricoes WHERE id = $1', [insc1Id]);
  assert(dbInscCancelada.rows[0].status === 'CANCELADA', 'Status atualizado para CANCELADA');

  // Reativar inscrição: deve reclassificar automaticamente
  const reativarRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes/${insc1Id}/reativar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(reativarRes.status === 302, 'Reativar inscricao redireciona (302)');

  const dbInscReativada = await pool.query('SELECT status, categoria_id FROM inscricoes WHERE id = $1', [insc1Id]);
  assert(dbInscReativada.rows[0].status === 'CONFIRMADA', 'Status reativado para CONFIRMADA');
  assert(dbInscReativada.rows[0].categoria_id !== null, 'Categoria associada na reativacao');

  // ==========================================
  // 9. PROTEÇÃO CONTRA CHAVES E LUTAS
  // ==========================================
  console.log('\n--- 9. Proteção Contra Chaves e Lutas ---');
  // Criar chave e luta simulada envolvendo insc1Id
  const chaveRes = await pool.query(
    "INSERT INTO chaves (categoria_id, nome, tamanho, status) VALUES ($1, 'Chave Teste', 2, 'EM_ANDAMENTO') RETURNING id",
    [cat2Id]
  );
  const chaveId = chaveRes.rows[0].id;

  const lutaRes = await pool.query(
    `INSERT INTO lutas (chave_id, rodada, posicao, competidor_1_id, status)
     VALUES ($1, 1, 1, $2, 'AGUARDANDO') RETURNING id`,
    [chaveId, insc1Id]
  );
  const lutaId = lutaRes.rows[0].id;

  // 1. Tentar cancelar inscrição em luta (deve bloquear)
  const cancBloqRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes/${insc1Id}/cancelar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(cancBloqRes.status === 302, 'Tentativa de cancelar inscricao em luta redireciona com aviso (302)');
  const dbAindaConfirmada = await pool.query('SELECT status FROM inscricoes WHERE id = $1', [insc1Id]);
  assert(dbAindaConfirmada.rows[0].status === 'CONFIRMADA', 'Status NAO foi cancelado (bloqueado por luta)');

  // 2. Tentar alterar peso/dados competitivos de atleta em luta: deve salvar apenas o nome
  const editLutaRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes/${insc1Id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      nome: 'Nome Atualizado Durante Luta',
      idade: '50', // tentativa maliciosa
      peso: '99', // tentativa maliciosa
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });
  assert(editLutaRes.status === 302, 'Edicao de atleta em luta redireciona (302)');

  const dbInscLuta = await pool.query('SELECT * FROM inscricoes WHERE id = $1', [insc1Id]);
  assert(dbInscLuta.rows[0].nome === 'Nome Atualizado Durante Luta', 'Nome foi atualizado com sucesso');
  assert(Number(dbInscLuta.rows[0].peso) === 72, 'Peso foi protegido e mantido inalterado');
  assert(dbInscLuta.rows[0].idade === 25, 'Idade foi protegida e mantida inalterada');

  // 3. Tentar excluir atleta em luta: deve bloquear
  const delLutaRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes/${insc1Id}/excluir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(delLutaRes.status === 302, 'Exclusao de atleta em luta redireciona com bloqueio');
  const dbExisteLuta = await pool.query('SELECT id FROM inscricoes WHERE id = $1', [insc1Id]);
  assert(dbExisteLuta.rows.length === 1, 'Inscricao em luta NAO foi excluida');

  // ==========================================
  // 10. EXCLUSÃO DE INSCRIÇÃO LIVRE
  // ==========================================
  console.log('\n--- 10. Exclusão de Inscrição Livre ---');
  const delLivreRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/inscricoes/${inscPendenteId}/excluir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(delLivreRes.status === 302, 'Excluir inscricao livre redireciona com sucesso (302)');

  const dbExcluida = await pool.query('SELECT id FROM inscricoes WHERE id = $1', [inscPendenteId]);
  assert(dbExcluida.rows.length === 0, 'Inscricao livre excluida do banco de dados');

  // ==========================================
  // 11. ISOLAMENTO E SEGURANÇA ENTRE EVENTOS (404)
  // ==========================================
  console.log('\n--- 11. Isolamento Entre Eventos (404) ---');
  // Tentar acessar atleta do Evento 1 na rota do Evento 2
  const fakeEditRes = await fetch(`http://localhost:3000/eventos/${ev2Id}/inscricoes/${inscMultiplaId}/editar`, {
    headers: { Cookie: sessionCookie },
  });
  assert(fakeEditRes.status === 404, 'Acesso a edicao com evento incorreto retorna 404');

  const fakePostEditRes = await fetch(`http://localhost:3000/eventos/${ev2Id}/inscricoes/${inscMultiplaId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ nome: 'Invasao', _csrf: currentCsrf }).toString(),
  });
  assert(fakePostEditRes.status === 404, 'Post de edicao com evento incorreto retorna 404');

  const fakeDelRes = await fetch(`http://localhost:3000/eventos/${ev2Id}/inscricoes/${inscMultiplaId}/excluir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
  });
  assert(fakeDelRes.status === 404, 'Post de exclusao com evento incorreto retorna 404');

  await cleanup();

  console.log(`\n--- RESULTADO FASE 9: ${passedCount} de ${testCount} testes passaram com sucesso! ---`);
  await pool.end();
}

runTests().catch((err) => {
  console.error('Erro nos testes da Fase 9:', err);
  process.exit(1);
});
