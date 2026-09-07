const pool = require('../src/config/database');
const {
  calcularNomeRodada,
  prepararSlot,
  agruparPorRodada,
} = require('../src/services/chaveVisualizacaoService');
require('dotenv').config();

async function runTests() {
  console.log('--- Iniciando Testes da Fase 12 (Visualização Gráfica da Chave) ---');
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
  // 1. TESTES UNITÁRIOS DO SERVIÇO DE VISUALIZAÇÃO
  // ==========================================
  console.log('\n--- 1. Testes Unitários de chaveVisualizacaoService ---');

  // calcularNomeRodada
  assert(calcularNomeRodada(1) === 'Final', '1 luta = Final');
  assert(calcularNomeRodada(2) === 'Semifinal', '2 lutas = Semifinal');
  assert(calcularNomeRodada(4) === 'Quartas de final', '4 lutas = Quartas de final');
  assert(calcularNomeRodada(8) === 'Oitavas de final', '8 lutas = Oitavas de final');
  assert(calcularNomeRodada(16) === '16 avos de final', '16 lutas = 16 avos de final');
  assert(calcularNomeRodada(32) === '32 avos de final', '32 lutas = 32 avos de final');
  assert(calcularNomeRodada(64) === '64 avos de final', '64 lutas = 64 avos de final');

  // prepararSlot
  const lutaMock = {
    id: 1,
    rodada: 1,
    competidor_1_id: 10,
    competidor_1_nome: 'Joao Silva',
    competidor_1_equipe: 'Equipe Alpha',
    competidor_1_seed: 1,
    competidor_2_id: null,
    competidor_2_nome: null,
    competidor_2_equipe: null,
    competidor_2_seed: null,
    vencedor_id: 10,
    tipo_resultado: 'BYE',
  };

  const slot1 = prepararSlot(lutaMock, 1, { status: 'NAO_INICIADA' });
  assert(slot1.tipo === 'COMPETIDOR', 'Slot 1 com atleta retorna tipo COMPETIDOR');
  assert(slot1.nome === 'Joao Silva', 'Slot 1 traz nome correto do atleta');
  assert(slot1.equipe === 'Equipe Alpha', 'Slot 1 traz equipe correta');
  assert(slot1.seed === 1, 'Slot 1 traz seed correto');
  assert(slot1.vencedor === true, 'Slot 1 identifica vencedor corretamente');

  const slot2 = prepararSlot(lutaMock, 2, { status: 'NAO_INICIADA' });
  assert(slot2.tipo === 'BYE', 'Slot 2 vazio com adversário presente na R1 retorna tipo BYE');
  assert(slot2.nome === 'BYE', 'Slot 2 traz texto BYE');

  const lutaFutura = {
    id: 2,
    rodada: 2,
    competidor_1_id: null,
    competidor_2_id: null,
  };
  const slotFuturo = prepararSlot(lutaFutura, 1, { status: 'NAO_INICIADA' });
  assert(slotFuturo.tipo === 'AGUARDANDO', 'Slot de rodada futura sem atleta retorna tipo AGUARDANDO');
  assert(slotFuturo.nome === 'Aguardando', 'Slot futuro traz texto Aguardando');

  // agruparPorRodada
  const lutasChave8 = [
    { id: 1, rodada: 1, posicao: 1 },
    { id: 2, rodada: 1, posicao: 2 },
    { id: 3, rodada: 1, posicao: 3 },
    { id: 4, rodada: 1, posicao: 4 },
    { id: 5, rodada: 2, posicao: 1 },
    { id: 6, rodada: 2, posicao: 2 },
    { id: 7, rodada: 3, posicao: 1 },
  ];
  const { rodadas, alturaMinima } = agruparPorRodada(lutasChave8, { status: 'NAO_INICIADA' });
  assert(rodadas.length === 3, 'Chave de 8 tem 3 rodadas agrupadas');
  assert(rodadas[0].nome === 'Quartas de final', 'R1 nomeada como Quartas de final');
  assert(rodadas[1].nome === 'Semifinal', 'R2 nomeada como Semifinal');
  assert(rodadas[2].nome === 'Final', 'R3 nomeada como Final');
  assert(alturaMinima === 680, 'Altura mínima para 4 lutas na R1 é 680px (4 * 170)');

  // ==========================================
  // 2. ENTREGA DE ARQUIVOS ESTÁTICOS
  // ==========================================
  console.log('\n--- 2. Verificação de Arquivos Estáticos (CSS e JS) ---');

  const cssRes = await fetch('http://localhost:3000/css/bracket.css');
  assert(cssRes.status === 200, 'GET /css/bracket.css retorna status 200');
  const cssText = await cssRes.text();
  assert(cssText.includes('.bracket-scroll'), 'bracket.css contém .bracket-scroll');
  assert(cssText.includes('.bracket-connections'), 'bracket.css contém .bracket-connections');
  assert(cssText.includes('@media print'), 'bracket.css contém regras de impressão @media print');

  const jsRes = await fetch('http://localhost:3000/js/bracket.js');
  assert(jsRes.status === 200, 'GET /js/bracket.js retorna status 200');
  const jsText = await jsRes.text();
  assert(jsText.includes('desenharConexoes'), 'bracket.js contém função desenharConexoes');
  assert(jsText.includes('bracketConnections'), 'bracket.js manipula elemento bracketConnections');

  // ==========================================
  // 3. AUTENTICAÇÃO E CRIAÇÃO DE DADOS PARA TESTE
  // ==========================================
  console.log('\n--- 3. Autenticação e Configuração de Evento e Chave ---');
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
          SELECT id FROM eventos WHERE nome LIKE 'Evento Visualizacao F12%'
        )
      `);
      await pool.query(`
        DELETE FROM lutas WHERE chave_id IN (
          SELECT id FROM chaves WHERE categoria_id IN (
            SELECT id FROM categorias WHERE evento_id IN (
              SELECT id FROM eventos WHERE nome LIKE 'Evento Visualizacao F12%'
            )
          )
        )
      `);
      await pool.query(`
        DELETE FROM chaves WHERE categoria_id IN (
          SELECT id FROM categorias WHERE evento_id IN (
            SELECT id FROM eventos WHERE nome LIKE 'Evento Visualizacao F12%'
          )
        )
      `);
      await pool.query(`
        DELETE FROM inscricoes WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento Visualizacao F12%'
        )
      `);
      await pool.query(`
        DELETE FROM categorias WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento Visualizacao F12%'
        )
      `);
      await pool.query(`
        DELETE FROM regras_pontuacao WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento Visualizacao F12%'
        )
      `);
      await pool.query(`
        DELETE FROM eventos WHERE nome LIKE 'Evento Visualizacao F12%'
      `);
      await pool.query(`
        DELETE FROM equipes WHERE nome LIKE 'Equipe Visual F12%'
      `);
    } catch (err) {
      console.error('Erro no cleanup:', err.message);
    }
  }

  await cleanup();

  // Criar 2 eventos para testar isolamento
  const ev1Res = await pool.query(
    "INSERT INTO eventos (nome, descricao) VALUES ('Evento Visualizacao F12 Alpha " + ts + "', 'Teste visualizacao') RETURNING id"
  );
  const ev1Id = ev1Res.rows[0].id;

  const ev2Res = await pool.query(
    "INSERT INTO eventos (nome, descricao) VALUES ('Evento Visualizacao F12 Beta " + ts + "', 'Outro evento') RETURNING id"
  );
  const ev2Id = ev2Res.rows[0].id;

  // Criar regras pontuacao com bye_pontua = true
  await pool.query(
    `INSERT INTO regras_pontuacao (evento_id, pontos_vitoria, pontos_primeiro, pontos_segundo, pontos_terceiro, bye_pontua)
     VALUES ($1, 2, 9, 3, 1, true)
     ON CONFLICT (evento_id) DO UPDATE SET bye_pontua = true, pontos_vitoria = 2`,
    [ev1Id]
  );

  // Criar equipes
  const eq1Res = await pool.query("INSERT INTO equipes (nome) VALUES ('Equipe Visual F12 Alpha " + ts + "') RETURNING id");
  const eq1Id = eq1Res.rows[0].id;

  const eq2Res = await pool.query("INSERT INTO equipes (nome) VALUES ('Equipe Visual F12 Beta " + ts + "') RETURNING id");
  const eq2Id = eq2Res.rows[0].id;

  // Obter faixa
  const faixaRes = await pool.query('SELECT id FROM faixas ORDER BY ordem LIMIT 1');
  const faixaId = faixaRes.rows[0].id;

  // Criar Categoria com 3 atletas (gerará chave de 4 com 1 bye)
  const catRes = await pool.query(
    `INSERT INTO categorias (evento_id, nome, idade_minima, idade_maxima, peso_minimo, peso_maximo, faixa_minima_id, faixa_maxima_id, sexo)
     VALUES ($1, 'Cat Grafica 3 Atletas', 18, 35, NULL, 80.00, $2, $2, 'MASCULINO') RETURNING id`,
    [ev1Id, faixaId]
  );
  const catId = catRes.rows[0].id;

  // Inserir 3 atletas confirmados (um com seed 1)
  await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, seed, status)
     VALUES ($1, $2, $3, $4, 'Campeao Seed Um', 22, 75.0, 'MASCULINO', 1, 'CONFIRMADA')`,
    [ev1Id, catId, eq1Id, faixaId]
  );
  await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
     VALUES ($1, $2, $3, $4, 'Guerreiro Sem Seed Dois', 24, 76.0, 'MASCULINO', 'CONFIRMADA')`,
    [ev1Id, catId, eq2Id, faixaId]
  );
  await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
     VALUES ($1, $2, $3, $4, 'Lutador Sem Seed Tres', 25, 77.0, 'MASCULINO', 'CONFIRMADA')`,
    [ev1Id, catId, eq1Id, faixaId]
  );

  // Gerar chave via POST
  const getCsrfRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves`, {
    headers: { Cookie: sessionCookie },
  });
  let currentCsrf = (await getCsrfRes.text()).match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const postGerarRes = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/categorias/${catId}/chave/gerar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
      redirect: 'manual',
    }
  );
  assert(postGerarRes.status === 302, 'Geração da chave redireciona (302)');
  const chaveId = postGerarRes.headers.get('location').split('/').pop();

  // ==========================================
  // 4. VERIFICAÇÃO DO HTML DA TELA GRÁFICA (PRÉVIA NAO_INICIADA)
  // ==========================================
  console.log('\n--- 4. Visualização Gráfica da Chave (NAO_INICIADA) ---');
  const getChaveRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}`, {
    headers: { Cookie: sessionCookie },
  });
  assert(getChaveRes.status === 200, 'GET /eventos/:id/chaves/:chaveId retorna 200');

  const chaveHtml = await getChaveRes.text();

  // Tags CSS e JS
  assert(chaveHtml.includes('/css/bracket.css'), 'Página inclui tag link para bracket.css');
  assert(chaveHtml.includes('/js/bracket.js'), 'Página inclui tag script para bracket.js');

  // Elementos estruturais da chave
  assert(chaveHtml.includes('class="bracket-scroll"'), 'Página possui contêiner bracket-scroll');
  assert(chaveHtml.includes('id="bracket"'), 'Página possui elemento #bracket');
  assert(chaveHtml.includes('id="bracketConnections"'), 'Página possui elemento SVG #bracketConnections');
  assert(chaveHtml.includes('class="bracket-round"'), 'Página possui seções bracket-round');
  assert(chaveHtml.includes('Semifinal'), 'Exibe nome da rodada Semifinal');
  assert(chaveHtml.includes('Final'), 'Exibe nome da rodada Final');

  // Conectores e atributos de dados para o JS
  assert(chaveHtml.includes('data-match-id='), 'Card de luta possui atributo data-match-id');
  assert(chaveHtml.includes('data-next-match-id='), 'Card de luta possui atributo data-next-match-id');
  assert(chaveHtml.includes('data-status="AGUARDANDO"'), 'Card de luta possui atributo data-status');

  // Dados dos competidores, seeds e byes
  assert(chaveHtml.includes('Campeao Seed Um'), 'Exibe nome do competidor');
  assert(chaveHtml.includes('class="competitor-seed"'), 'Exibe badge de seed');
  assert(chaveHtml.includes('BYE'), 'Exibe slot de avanço livre BYE');
  assert(chaveHtml.includes('Aguardando'), 'Exibe slot futuro Aguardando');

  // Legenda e ações de chave não iniciada
  assert(chaveHtml.includes('class="bracket-legend"'), 'Exibe legenda explicativa da chave');
  assert(chaveHtml.includes('Sortear novamente'), 'Exibe botão Sortear novamente');
  assert(chaveHtml.includes('Iniciar chave'), 'Exibe botão Iniciar chave');
  assert(chaveHtml.includes('Excluir chave'), 'Exibe botão Excluir chave');

  currentCsrf = chaveHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // ==========================================
  // 5. VISUALIZAÇÃO GRÁFICA COM CHAVE EM ANDAMENTO
  // ==========================================
  console.log('\n--- 5. Visualização Gráfica da Chave (EM_ANDAMENTO) ---');
  const postIniciarRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/iniciar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(postIniciarRes.status === 302, 'Iniciar chave redireciona (302)');

  const getChaveIniciadaRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}`, {
    headers: { Cookie: sessionCookie },
  });
  assert(getChaveIniciadaRes.status === 200, 'GET da chave em andamento retorna 200');

  const iniciadaHtml = await getChaveIniciadaRes.text();
  assert(iniciadaHtml.includes('Em andamento'), 'Exibe badge de status Em andamento');
  assert(iniciadaHtml.includes('match-pronta'), 'Luta normal possui classe match-pronta');
  assert(iniciadaHtml.includes('match-finalizada'), 'Luta de BYE possui classe match-finalizada');
  assert(iniciadaHtml.includes('Avanco por BYE') || iniciadaHtml.includes('BYE'), 'Exibe tag de resultado de avanço por BYE');
  assert(iniciadaHtml.includes('class="match-competitor winner'), 'Competidor vencedor do BYE possui classe winner destacada');
  assert(!iniciadaHtml.includes('Sortear novamente'), 'Botão Sortear novamente ocultado em chave iniciada');
  assert(!iniciadaHtml.includes('Iniciar chave'), 'Botão Iniciar chave ocultado em chave iniciada');

  // ==========================================
  // 6. SEGURANÇA E ISOLAMENTO
  // ==========================================
  console.log('\n--- 6. Testes de Segurança e Isolamento ---');
  // Chave com evento divergente retorna 404
  const getFakeEvRes = await fetch(`http://localhost:3000/eventos/${ev2Id}/chaves/${chaveId}`, {
    headers: { Cookie: sessionCookie },
  });
  assert(getFakeEvRes.status === 404, 'Acesso à chave usando outro eventoId retorna 404');

  // Chave inexistente retorna 404
  const getInexistenteRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/99999999`, {
    headers: { Cookie: sessionCookie },
  });
  assert(getInexistenteRes.status === 404, 'Acesso à chave inexistente retorna 404');

  // Acesso desautenticado redireciona para login
  const getDesautenticado = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}`, {
    redirect: 'manual',
  });
  assert(getDesautenticado.status === 302, 'Acesso sem autenticação redireciona com 302 para login');

  // ==========================================
  // 7. LIMPEZA FINAL
  // ==========================================
  await cleanup();

  console.log(`\n--- RESULTADO FASE 12: ${passedCount} de ${testCount} testes passaram com sucesso! ---`);
  await pool.end();
}

runTests().catch((err) => {
  console.error('Erro nos testes da Fase 12:', err);
  process.exit(1);
});
