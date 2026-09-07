const pool = require('../src/config/database');
const { calcularStatusLuta } = require('../src/services/avancoService');
require('dotenv').config();

async function runTests() {
  console.log('--- Iniciando Testes da Fase 14 (Correção e Anulação de Resultados) ---');
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
  // 1. TESTES UNITÁRIOS DE CÁLCULO DE STATUS
  // ==========================================
  console.log('\n--- 1. Testes Unitários de calcularStatusLuta ---');

  assert(
    calcularStatusLuta({ status: 'FINALIZADA', vencedor_id: 1, competidor_1_id: 1, competidor_2_id: 2 }) ===
      'FINALIZADA',
    'Luta com status FINALIZADA retorna FINALIZADA'
  );
  assert(
    calcularStatusLuta({ status: 'PRONTA', vencedor_id: 2, competidor_1_id: 1, competidor_2_id: 2 }) ===
      'FINALIZADA',
    'Luta com vencedor_id preenchido retorna FINALIZADA'
  );
  assert(
    calcularStatusLuta({ status: 'AGUARDANDO', vencedor_id: null, competidor_1_id: 10, competidor_2_id: 20 }) ===
      'PRONTA',
    'Luta com ambos competidores e sem vencedor retorna PRONTA'
  );
  assert(
    calcularStatusLuta({ status: 'AGUARDANDO', vencedor_id: null, competidor_1_id: 10, competidor_2_id: null }) ===
      'AGUARDANDO',
    'Luta com apenas 1 competidor retorna AGUARDANDO'
  );
  assert(
    calcularStatusLuta({ status: 'AGUARDANDO', vencedor_id: null, competidor_1_id: null, competidor_2_id: null }) ===
      'AGUARDANDO',
    'Luta sem nenhum competidor retorna AGUARDANDO'
  );

  // ==========================================
  // 2. CONFIGURAÇÃO DE AMBIENTE E AUTENTICAÇÃO
  // ==========================================
  console.log('\n--- 2. Autenticação e Configuração de Eventos e Chave ---');
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
        DELETE FROM pontos_equipes WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F14%'
        )
      `);
      await pool.query(`
        DELETE FROM lutas WHERE chave_id IN (
          SELECT id FROM chaves WHERE categoria_id IN (
            SELECT id FROM categorias WHERE evento_id IN (
              SELECT id FROM eventos WHERE nome LIKE 'Evento F14%'
            )
          )
        )
      `);
      await pool.query(`
        DELETE FROM chaves WHERE categoria_id IN (
          SELECT id FROM categorias WHERE evento_id IN (
            SELECT id FROM eventos WHERE nome LIKE 'Evento F14%'
          )
        )
      `);
      await pool.query(`
        DELETE FROM inscricoes WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F14%'
        )
      `);
      await pool.query(`
        DELETE FROM categorias WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F14%'
        )
      `);
      await pool.query(`
        DELETE FROM regras_pontuacao WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F14%'
        )
      `);
      await pool.query(`
        DELETE FROM eventos WHERE nome LIKE 'Evento F14%'
      `);
      await pool.query(`
        DELETE FROM equipes WHERE nome LIKE 'Equipe Teste F14%'
      `);
    } catch (err) {
      console.error('Erro no cleanup:', err.message);
    }
  }

  await cleanup();

  // Criar 2 eventos para testes de isolamento
  const ev1Res = await pool.query(
    "INSERT INTO eventos (nome, descricao) VALUES ('Evento F14 Alpha " + ts + "', 'Teste correções') RETURNING id"
  );
  const ev1Id = ev1Res.rows[0].id;

  const ev2Res = await pool.query(
    "INSERT INTO eventos (nome, descricao) VALUES ('Evento F14 Beta " + ts + "', 'Outro evento') RETURNING id"
  );
  const ev2Id = ev2Res.rows[0].id;

  // Regras de pontuação: 3 pontos por vitória
  await pool.query(
    `INSERT INTO regras_pontuacao (evento_id, pontos_vitoria, pontos_primeiro, pontos_segundo, pontos_terceiro, bye_pontua)
     VALUES ($1, 3, 9, 3, 1, false)
     ON CONFLICT (evento_id) DO UPDATE SET pontos_vitoria = 3`,
    [ev1Id]
  );

  // Criar 2 equipes
  const eq1Res = await pool.query("INSERT INTO equipes (nome) VALUES ('Equipe Teste F14 Gracie " + ts + "') RETURNING id");
  const eq1Id = eq1Res.rows[0].id;

  const eq2Res = await pool.query("INSERT INTO equipes (nome) VALUES ('Equipe Teste F14 Alliance " + ts + "') RETURNING id");
  const eq2Id = eq2Res.rows[0].id;

  // Obter faixa
  const faixaRes = await pool.query('SELECT id FROM faixas ORDER BY ordem LIMIT 1');
  const faixaId = faixaRes.rows[0].id;

  // Criar Categoria com 4 atletas no Evento 1
  const catRes = await pool.query(
    `INSERT INTO categorias (evento_id, nome, idade_minima, idade_maxima, peso_minimo, peso_maximo, faixa_minima_id, faixa_maxima_id, sexo)
     VALUES ($1, 'Médio Adulto', 18, 35, NULL, 82.30, $2, $2, 'MASCULINO') RETURNING id`,
    [ev1Id, faixaId]
  );
  const catId = catRes.rows[0].id;

  // Cadastrar 4 competidores confirmados
  const c1Res = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
     VALUES ($1, $2, $3, $4, 'Atleta 1 (Gracie)', 25, 80.00, 'MASCULINO', 'CONFIRMADA', 1) RETURNING id`,
    [ev1Id, catId, eq1Id, faixaId]
  );
  const c1Id = c1Res.rows[0].id;

  const c2Res = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
     VALUES ($1, $2, $3, $4, 'Atleta 2 (Alliance)', 26, 81.00, 'MASCULINO', 'CONFIRMADA', 4) RETURNING id`,
    [ev1Id, catId, eq2Id, faixaId]
  );
  const c2Id = c2Res.rows[0].id;

  const c3Res = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
     VALUES ($1, $2, $3, $4, 'Atleta 3 (Gracie)', 27, 79.50, 'MASCULINO', 'CONFIRMADA', 2) RETURNING id`,
    [ev1Id, catId, eq1Id, faixaId]
  );
  const c3Id = c3Res.rows[0].id;

  const c4Res = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
     VALUES ($1, $2, $3, $4, 'Atleta 4 (Alliance)', 28, 80.50, 'MASCULINO', 'CONFIRMADA', 3) RETURNING id`,
    [ev1Id, catId, eq2Id, faixaId]
  );
  const c4Id = c4Res.rows[0].id;

  // Pegar CSRF e gerar chave
  const getChavesPage = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves`, {
    headers: { Cookie: sessionCookie },
  });
  let currentCsrf = (await getChavesPage.text()).match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const postGerar = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/categorias/${catId}/chave/gerar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
      redirect: 'manual',
    }
  );
  const chaveId = postGerar.headers.get('location').split('/').pop();

  // Iniciar chave
  const getChaveView = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}`, {
    headers: { Cookie: sessionCookie },
  });
  currentCsrf = (await getChaveView.text()).match(/name="_csrf"\s+value="([^"]+)"/)[1];

  await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/iniciar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
  });

  const { rows: lutas } = await pool.query(
    'SELECT * FROM lutas WHERE chave_id = $1 ORDER BY rodada ASC, posicao ASC',
    [chaveId]
  );
  const luta1 = lutas[0]; // Semifinal 1 (Atleta 1 vs Atleta 2)
  const luta2 = lutas[1]; // Semifinal 2 (Atleta 3 vs Atleta 4)
  const lutaFinal = lutas[2]; // Final

  // Finalizar Semifinal 1 com vitória de Atleta 1 (Gracie)
  await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf, vencedor_id: luta1.competidor_1_id }).toString(),
  });

  // Verificar estado inicial da final e pontuação
  const { rows: dbFinalInit } = await pool.query('SELECT * FROM lutas WHERE id = $1', [lutaFinal.id]);
  assert(dbFinalInit[0].competidor_1_id === luta1.competidor_1_id, 'Atleta 1 avançou para slot 1 da final');

  const { rows: pontosInit } = await pool.query(
    'SELECT * FROM pontos_equipes WHERE luta_id = $1 AND tipo = $2',
    [luta1.id, 'VITORIA']
  );
  assert(pontosInit[0].equipe_id === eq1Id && pontosInit[0].pontos === 3, 'Equipe 1 recebeu 3 pontos de vitória');

  // ==========================================
  // 3. TELA DE EDIÇÃO / CORREÇÃO
  // ==========================================
  console.log('\n--- 3. Acesso à Tela de Correção de Resultado ---');
  const getEditRes = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado/editar`,
    { headers: { Cookie: sessionCookie } }
  );
  assert(getEditRes.status === 200, 'GET tela de edição de resultado retorna 200 OK');
  const editHtml = await getEditRes.text();
  assert(editHtml.includes('Corrigir resultado'), 'Tela contém título de correção');
  assert(editHtml.includes('Vencedor Atual'), 'Tela destaca o vencedor atual');
  currentCsrf = editHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // ==========================================
  // 4. CORREÇÃO DE VENCEDOR E TRANSFERÊNCIA DE PONTOS
  // ==========================================
  console.log('\n--- 4. Executando Correção do Vencedor (Atleta 1 -> Atleta 2) ---');
  const postCorrigirOk = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado/editar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({
        _csrf: currentCsrf,
        vencedor_id: luta1.competidor_2_id,
      }).toString(),
      redirect: 'manual',
    }
  );
  assert(postCorrigirOk.status === 302, 'Correção de resultado redireciona com sucesso (302)');
  assert(
    postCorrigirOk.headers.get('location').includes(`#match-${luta1.id}`),
    'Redireciona para a chave com âncora na luta'
  );

  // Verificar DB da Luta 1
  const { rows: dbLuta1PosCorrecao } = await pool.query('SELECT * FROM lutas WHERE id = $1', [luta1.id]);
  assert(dbLuta1PosCorrecao[0].vencedor_id === luta1.competidor_2_id, 'Vencedor alterado para Atleta 2');
  assert(dbLuta1PosCorrecao[0].perdedor_id === luta1.competidor_1_id, 'Perdedor deduzido como Atleta 1');

  // Verificar Avanço da Final (Slot 1 substituído de Atleta 1 para Atleta 2)
  const { rows: dbFinalPosCorrecao } = await pool.query('SELECT * FROM lutas WHERE id = $1', [lutaFinal.id]);
  assert(
    dbFinalPosCorrecao[0].competidor_1_id === luta1.competidor_2_id,
    'Slot 1 da final agora contém o novo vencedor Atleta 2'
  );
  assert(dbFinalPosCorrecao[0].competidor_2_id === null, 'Slot 2 da final continua vazio');
  assert(dbFinalPosCorrecao[0].status === 'AGUARDANDO', 'Final permanece em AGUARDANDO');

  // Verificar Pontuação (Transferida de Equipe 1 para Equipe 2)
  const { rows: pontosPosCorrecao } = await pool.query(
    'SELECT * FROM pontos_equipes WHERE luta_id = $1 AND tipo = $2',
    [luta1.id, 'VITORIA']
  );
  assert(pontosPosCorrecao.length === 1, 'Permanece apenas 1 registro de pontos de vitória para a luta 1');
  assert(pontosPosCorrecao[0].equipe_id === eq2Id, 'Pontos transferidos para a Equipe 2 do novo vencedor');
  assert(pontosPosCorrecao[0].pontos === 3, 'Valor correto dos pontos mantido');

  // ==========================================
  // 5. FINALIZAÇÃO DA SEMIFINAL 2 E LIBERAÇÃO DA FINAL
  // ==========================================
  console.log('\n--- 5. Finalização da Semifinal 2 ---');
  await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta2.id}/resultado`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf, vencedor_id: luta2.competidor_2_id }).toString(),
  });

  const { rows: dbFinalPronta } = await pool.query('SELECT * FROM lutas WHERE id = $1', [lutaFinal.id]);
  assert(
    dbFinalPronta[0].competidor_1_id === luta1.competidor_2_id &&
      dbFinalPronta[0].competidor_2_id === luta2.competidor_2_id,
    'Ambos os finalistas definidos na final'
  );
  assert(dbFinalPronta[0].status === 'PRONTA', 'Final transicionou para PRONTA');

  // ==========================================
  // 6. BLOQUEIO POR RESULTADO POSTERIOR
  // ==========================================
  console.log('\n--- 6. Bloqueio Quando Luta Posterior Já Possui Resultado ---');
  // Finalizar a Grande Final com vitória do competidor 2
  await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${lutaFinal.id}/resultado`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf, vencedor_id: dbFinalPronta[0].competidor_1_id }).toString(),
  });

  // Tentar acessar GET /editar na Semifinal 1
  const getBloqRes = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado/editar`,
    { headers: { Cookie: sessionCookie }, redirect: 'manual' }
  );
  assert(getBloqRes.status === 302, 'GET /editar em semifinal com final já encerrada é bloqueado (302 redirect)');

  // Tentar POST /editar na Semifinal 1
  const postCorrigirBloq = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado/editar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf, vencedor_id: luta1.competidor_1_id }).toString(),
      redirect: 'manual',
    }
  );
  assert(postCorrigirBloq.status === 302, 'POST /editar em semifinal com final já encerrada é bloqueado (302)');

  // Tentar POST /anular na Semifinal 1
  const postAnularBloq = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado/anular`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
      redirect: 'manual',
    }
  );
  assert(postAnularBloq.status === 302, 'POST /anular em semifinal com final já encerrada é bloqueado (302)');

  // Visualização da chave deve mostrar indicador de bloqueio
  const getChaveViewBloq = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}`, {
    headers: { Cookie: sessionCookie },
  });
  const chaveHtmlBloq = await getChaveViewBloq.text();
  assert(
    chaveHtmlBloq.includes('Resultado bloqueado — próxima luta finalizada'),
    'Exibe indicador visual de resultado bloqueado na chave'
  );

  // ==========================================
  // 7. ANULAÇÃO DA GRANDE FINAL (DESFAZENDO DE TRÁS PARA FRENTE)
  // ==========================================
  console.log('\n--- 7. Anulação da Grande Final ---');
  currentCsrf = chaveHtmlBloq.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const postAnularFinalOk = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${lutaFinal.id}/resultado/anular`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
      redirect: 'manual',
    }
  );
  assert(postAnularFinalOk.status === 302, 'Anulação da final redireciona com sucesso (302)');

  // Verificar DB da Final
  const { rows: dbFinalPosAnulacao } = await pool.query('SELECT * FROM lutas WHERE id = $1', [lutaFinal.id]);
  assert(dbFinalPosAnulacao[0].status === 'PRONTA', 'Final voltou para o status PRONTA');
  assert(dbFinalPosAnulacao[0].vencedor_id === null, 'Vencedor da final foi limpo');
  assert(dbFinalPosAnulacao[0].perdedor_id === null, 'Perdedor da final foi limpo');

  // Pontos da final foram removidos
  const { rows: pontosFinalAnulada } = await pool.query(
    'SELECT * FROM pontos_equipes WHERE luta_id = $1 AND tipo = $2',
    [lutaFinal.id, 'VITORIA']
  );
  assert(pontosFinalAnulada.length === 0, 'Pontos de vitória da final foram removidos');

  // ==========================================
  // 8. ANULAÇÃO DE SEMIFINAL (RECUO DO SLOT E STATUS)
  // ==========================================
  console.log('\n--- 8. Anulação da Semifinal 2 (Recuo de Slot e Status da Próxima Luta) ---');
  // Agora que a final foi anulada, a Semifinal 2 está desbloqueada
  const postAnularSemi2 = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta2.id}/resultado/anular`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
      redirect: 'manual',
    }
  );
  assert(postAnularSemi2.status === 302, 'Anulação da semifinal 2 redireciona com sucesso (302)');

  // Verificar DB da Semifinal 2
  const { rows: dbSemi2PosAnulacao } = await pool.query('SELECT * FROM lutas WHERE id = $1', [luta2.id]);
  assert(dbSemi2PosAnulacao[0].status === 'PRONTA', 'Semifinal 2 voltou para o status PRONTA');
  assert(dbSemi2PosAnulacao[0].vencedor_id === null, 'Vencedor da semifinal 2 foi limpo');

  // Pontos da semifinal 2 removidos
  const { rows: pontosSemi2Anulada } = await pool.query(
    'SELECT * FROM pontos_equipes WHERE luta_id = $1 AND tipo = $2',
    [luta2.id, 'VITORIA']
  );
  assert(pontosSemi2Anulada.length === 0, 'Pontos da semifinal 2 foram removidos');

  // Verificar Recuo na Final: Slot 2 limpo e status volta de PRONTA para AGUARDANDO
  const { rows: dbFinalPosRecuo } = await pool.query('SELECT * FROM lutas WHERE id = $1', [lutaFinal.id]);
  assert(
    dbFinalPosRecuo[0].competidor_1_id === luta1.competidor_2_id,
    'Slot 1 da final continua preservado com o vencedor da Semifinal 1'
  );
  assert(dbFinalPosRecuo[0].competidor_2_id === null, 'Slot 2 da final foi limpo e desocupado');
  assert(dbFinalPosRecuo[0].status === 'AGUARDANDO', 'Final voltou de PRONTA para AGUARDANDO');

  // ==========================================
  // 9. BYES NÃO PODEM SER CORRIGIDOS NEM ANULADOS
  // ==========================================
  console.log('\n--- 9. Bloqueio Estrito de Correção e Anulação de BYE ---');
  // Criar categoria com 3 atletas no Evento 1 para gerar um BYE automático na chave de 4
  const catByeRes = await pool.query(
    `INSERT INTO categorias (evento_id, nome, idade_minima, idade_maxima, peso_minimo, peso_maximo, faixa_minima_id, faixa_maxima_id, sexo)
     VALUES ($1, 'Cat com BYE', 18, 35, NULL, 75.00, $2, $2, 'MASCULINO') RETURNING id`,
    [ev1Id, faixaId]
  );
  const catByeId = catByeRes.rows[0].id;

  for (let i = 1; i <= 3; i++) {
    await pool.query(
      `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
       VALUES ($1, $2, $3, $4, 'Atleta Bye ${i}', 20, 70.00, 'MASCULINO', 'CONFIRMADA')`,
      [ev1Id, catByeId, eq1Id, faixaId]
    );
  }

  // Gerar e iniciar chave com BYE
  const postGerarBye = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/categorias/${catByeId}/chave/gerar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
      redirect: 'manual',
    }
  );
  const chaveByeId = postGerarBye.headers.get('location').split('/').pop();

  await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveByeId}/iniciar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
  });

  // Localizar a luta que foi finalizada como BYE
  const { rows: lutasBye } = await pool.query(
    "SELECT * FROM lutas WHERE chave_id = $1 AND tipo_resultado = 'BYE'",
    [chaveByeId]
  );
  assert(lutasBye.length === 1, 'Chave de 3 atletas possui exatamente 1 luta de BYE finalizada');
  const lutaBye = lutasBye[0];

  // Tentar acessar GET /editar no BYE
  const getByeEdit = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveByeId}/lutas/${lutaBye.id}/resultado/editar`,
    { headers: { Cookie: sessionCookie }, redirect: 'manual' }
  );
  assert(getByeEdit.status === 302, 'Acesso GET /editar em luta de BYE é bloqueado (302)');

  // Tentar POST /editar no BYE
  const postByeEdit = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveByeId}/lutas/${lutaBye.id}/resultado/editar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf, vencedor_id: lutaBye.competidor_1_id }).toString(),
      redirect: 'manual',
    }
  );
  assert(postByeEdit.status === 302, 'POST /editar em luta de BYE é bloqueado (302)');

  // Tentar POST /anular no BYE
  const postByeAnular = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveByeId}/lutas/${lutaBye.id}/resultado/anular`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
      redirect: 'manual',
    }
  );
  assert(postByeAnular.status === 302, 'POST /anular em luta de BYE é bloqueado (302)');

  // ==========================================
  // 10. SEGURANÇA, ISOLAMENTO E CSRF
  // ==========================================
  console.log('\n--- 10. Segurança, Isolamento e CSRF ---');

  // Acesso com evento divergente
  const getDivergenteEv = await fetch(
    `http://localhost:3000/eventos/${ev2Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado/editar`,
    { headers: { Cookie: sessionCookie } }
  );
  assert(getDivergenteEv.status === 404, 'Acesso à correção com evento divergente retorna 404');

  // POST anular com chave divergente
  const postDivergenteChave = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveByeId}/lutas/${luta1.id}/resultado/anular`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    }
  );
  assert(postDivergenteChave.status === 404, 'POST anular com chave divergente retorna 404');

  // POST editar sem CSRF
  const postNoCsrfEdit = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado/editar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ vencedor_id: luta1.competidor_1_id }).toString(),
    }
  );
  assert(postNoCsrfEdit.status === 403, 'POST /editar sem CSRF retorna 403 Forbidden');

  // POST anular sem CSRF
  const postNoCsrfAnular = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado/anular`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({}).toString(),
    }
  );
  assert(postNoCsrfAnular.status === 403, 'POST /anular sem CSRF retorna 403 Forbidden');

  // ==========================================
  // 11. LIMPEZA FINAL
  // ==========================================
  await cleanup();

  console.log(`\n--- RESULTADO FASE 14: ${passedCount} de ${testCount} testes passaram com sucesso! ---`);
  await pool.end();
}

runTests().catch((err) => {
  console.error('Erro nos testes da Fase 14:', err);
  process.exit(1);
});
