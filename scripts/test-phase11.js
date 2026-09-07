const pool = require('../src/config/database');
const {
  calcularTamanhoChave,
  calcularTotalRodadas,
  calcularTotalLutas,
  gerarOrdemSeeds,
  validarSeeds,
  distribuirSeeds,
  distribuirByes,
  calcularConflitos,
  gerarChave,
  BYE,
} = require('../src/services/chaveGeneratorService');
require('dotenv').config();

async function runTests() {
  console.log('--- Iniciando Testes da Fase 11 (Geração das Chaves e Sorteio) ---');
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
  // 1. TESTES UNITÁRIOS MATEMÁTICOS E ESTRUTURAIS
  // ==========================================
  console.log('\n--- 1. Testes Unitários de Funções Matemáticas ---');

  // calcularTamanhoChave
  assert(calcularTamanhoChave(2) === 2, '2 competidores geram chave de 2');
  assert(calcularTamanhoChave(3) === 4, '3 competidores geram chave de 4');
  assert(calcularTamanhoChave(4) === 4, '4 competidores geram chave de 4');
  assert(calcularTamanhoChave(5) === 8, '5 competidores geram chave de 8');
  assert(calcularTamanhoChave(8) === 8, '8 competidores geram chave de 8');
  assert(calcularTamanhoChave(9) === 16, '9 competidores geram chave de 16');
  assert(calcularTamanhoChave(16) === 16, '16 competidores geram chave de 16');

  let erroTamMenor2 = false;
  try {
    calcularTamanhoChave(1);
  } catch (_) {
    erroTamMenor2 = true;
  }
  assert(erroTamMenor2, 'Menos de 2 competidores lança erro');

  // calcularTotalRodadas
  assert(calcularTotalRodadas(2) === 1, 'Chave de 2 tem 1 rodada');
  assert(calcularTotalRodadas(4) === 2, 'Chave de 4 tem 2 rodadas');
  assert(calcularTotalRodadas(8) === 3, 'Chave de 8 tem 3 rodadas');
  assert(calcularTotalRodadas(16) === 4, 'Chave de 16 tem 4 rodadas');

  // calcularTotalLutas
  assert(calcularTotalLutas(2) === 1, 'Chave de 2 tem 1 luta');
  assert(calcularTotalLutas(4) === 3, 'Chave de 4 tem 3 lutas');
  assert(calcularTotalLutas(8) === 7, 'Chave de 8 tem 7 lutas');
  assert(calcularTotalLutas(16) === 15, 'Chave de 16 tem 15 lutas');

  // gerarOrdemSeeds
  const seeds2 = gerarOrdemSeeds(2);
  assert(JSON.stringify(seeds2) === JSON.stringify([1, 2]), 'Ordem de seeds para 2 é [1, 2]');

  const seeds4 = gerarOrdemSeeds(4);
  assert(JSON.stringify(seeds4) === JSON.stringify([1, 4, 2, 3]), 'Ordem de seeds para 4 é [1, 4, 2, 3]');

  const seeds8 = gerarOrdemSeeds(8);
  assert(
    JSON.stringify(seeds8) === JSON.stringify([1, 8, 4, 5, 2, 7, 3, 6]),
    'Ordem de seeds para 8 é [1, 8, 4, 5, 2, 7, 3, 6]'
  );

  const seeds16 = gerarOrdemSeeds(16);
  assert(
    JSON.stringify(seeds16) ===
      JSON.stringify([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]),
    'Ordem de seeds para 16 é [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]'
  );

  // ==========================================
  // 2. TESTES UNITÁRIOS DE SEEDS E BYES
  // ==========================================
  console.log('\n--- 2. Validação de Seeds e Distribuição de Byes ---');

  // validarSeeds
  const semSeeds = [{ id: 1, nome: 'A' }, { id: 2, nome: 'B' }];
  assert(validarSeeds(semSeeds).valido === true, 'Inscritos sem seed são aceitos');

  const comSeedsValidos = [
    { id: 1, nome: 'A', seed: 1 },
    { id: 2, nome: 'B', seed: 2 },
    { id: 3, nome: 'C' },
  ];
  assert(validarSeeds(comSeedsValidos).valido === true, 'Seeds 1 e 2 sequenciais são aceitos');

  let erroSeedRepetido = false;
  try {
    validarSeeds([
      { id: 1, nome: 'A', seed: 1 },
      { id: 2, nome: 'B', seed: 1 },
    ]);
  } catch (_) {
    erroSeedRepetido = true;
  }
  assert(erroSeedRepetido, 'Seed repetido é rejeitado');

  let erroSeedLacuna = false;
  try {
    validarSeeds([
      { id: 1, nome: 'A', seed: 1 },
      { id: 2, nome: 'B', seed: 3 },
    ]);
  } catch (_) {
    erroSeedLacuna = true;
  }
  assert(erroSeedLacuna, 'Seed com lacuna (1 e 3) é rejeitado');

  let erroSeedMaior = false;
  try {
    validarSeeds([
      { id: 1, nome: 'A', seed: 1 },
      { id: 2, nome: 'B', seed: 5 },
    ]);
  } catch (_) {
    erroSeedMaior = true;
  }
  assert(erroSeedMaior, 'Seed maior que o total de atletas é rejeitado');

  // distribuição de byes sem BYE x BYE
  const resChave3 = gerarChave({
    inscritos: [
      { id: 101, nome: 'Atleta 1', equipe_id: 1, seed: 1 },
      { id: 102, nome: 'Atleta 2', equipe_id: 2 },
      { id: 103, nome: 'Atleta 3', equipe_id: 3 },
    ],
  });
  assert(resChave3.tamanho === 4, 'Chave de 3 atletas tem tamanho 4');
  assert(resChave3.totalByes === 1, 'Chave de 3 atletas tem 1 bye');
  assert(resChave3.totalLutas === 3, 'Chave de 3 atletas tem 3 lutas');

  // Verificar que Seed 1 teve o adversário como bye
  // Na chave de 4: slots são [1, 4, 2, 3] -> slot 0 é seed 1, seu adversário é slot 1 (seed 4 teorico)
  assert(resChave3.slots[1] === BYE, 'Adversário do Seed 1 na chave de 4 recebe o BYE');

  // Verificar que nenhuma luta tem 2 byes
  let temByeXBye = false;
  for (let i = 0; i < resChave3.slots.length; i += 2) {
    if (resChave3.slots[i] === BYE && resChave3.slots[i + 1] === BYE) {
      temByeXBye = true;
    }
  }
  assert(!temByeXBye, 'Nenhum combate possui BYE x BYE');

  // Teste de chave de 5 competidores (tamanho 8, 3 byes)
  const resChave5 = gerarChave({
    inscritos: [
      { id: 1, nome: 'A1', equipe_id: 1, seed: 1 },
      { id: 2, nome: 'A2', equipe_id: 2, seed: 2 },
      { id: 3, nome: 'A3', equipe_id: 3 },
      { id: 4, nome: 'A4', equipe_id: 4 },
      { id: 5, nome: 'A5', equipe_id: 5 },
    ],
  });
  assert(resChave5.tamanho === 8, 'Chave de 5 competidores tem tamanho 8');
  assert(resChave5.totalByes === 3, 'Chave de 5 competidores tem 3 byes');
  assert(resChave5.lutas.length === 7, 'Chave de 8 tem 7 lutas criadas');

  let temByeXBye5 = false;
  for (let i = 0; i < resChave5.slots.length; i += 2) {
    if (resChave5.slots[i] === BYE && resChave5.slots[i + 1] === BYE) {
      temByeXBye5 = true;
    }
  }
  assert(!temByeXBye5, 'Chave de 8 com 3 byes não possui nenhum BYE x BYE');

  // ==========================================
  // 3. SEPARAÇÃO DE EQUIPES
  // ==========================================
  console.log('\n--- 3. Separação de Equipes na Primeira Rodada ---');
  const resSeparacao = gerarChave({
    inscritos: [
      { id: 1, nome: 'G1', equipe_id: 10 },
      { id: 2, nome: 'G2', equipe_id: 10 },
      { id: 3, nome: 'A1', equipe_id: 20 },
      { id: 4, nome: 'A2', equipe_id: 20 },
    ],
  });
  assert(resSeparacao.conflitosEquipe === 0, '4 atletas (2 de cada equipe) são 100% separados (0 conflitos)');

  // ==========================================
  // 4. CONFIGURAÇÃO DE AMBIENTE E TESTES HTTP
  // ==========================================
  console.log('\n--- 4. Autenticação e Configuração de Eventos e Categorias ---');
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
          SELECT id FROM eventos WHERE nome LIKE 'Evento Chaves F11%'
        )
      `);
      await pool.query(`
        DELETE FROM lutas WHERE chave_id IN (
          SELECT id FROM chaves WHERE categoria_id IN (
            SELECT id FROM categorias WHERE evento_id IN (
              SELECT id FROM eventos WHERE nome LIKE 'Evento Chaves F11%'
            )
          )
        )
      `);
      await pool.query(`
        DELETE FROM chaves WHERE categoria_id IN (
          SELECT id FROM categorias WHERE evento_id IN (
            SELECT id FROM eventos WHERE nome LIKE 'Evento Chaves F11%'
          )
        )
      `);
      await pool.query(`
        DELETE FROM inscricoes WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento Chaves F11%'
        )
      `);
      await pool.query(`
        DELETE FROM categorias WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento Chaves F11%'
        )
      `);
      await pool.query(`
        DELETE FROM regras_pontuacao WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento Chaves F11%'
        )
      `);
      await pool.query(`
        DELETE FROM eventos WHERE nome LIKE 'Evento Chaves F11%'
      `);
      await pool.query(`
        DELETE FROM equipes WHERE nome LIKE 'Equipe Teste F11%'
      `);
    } catch (err) {
      console.error('Erro no cleanup:', err.message);
    }
  }

  await cleanup();

  // Criar 2 eventos para testar isolamento
  const ev1Res = await pool.query(
    "INSERT INTO eventos (nome, descricao) VALUES ('Evento Chaves F11 Alpha " + ts + "', 'Teste chaves') RETURNING id"
  );
  const ev1Id = ev1Res.rows[0].id;

  const ev2Res = await pool.query(
    "INSERT INTO eventos (nome, descricao) VALUES ('Evento Chaves F11 Beta " + ts + "', 'Outro evento') RETURNING id"
  );
  const ev2Id = ev2Res.rows[0].id;

  // Configurar pontuação com bye_pontua = true no Evento 1
  await pool.query(
    `INSERT INTO regras_pontuacao (evento_id, pontos_vitoria, pontos_primeiro, pontos_segundo, pontos_terceiro, bye_pontua)
     VALUES ($1, 2, 9, 3, 1, true)
     ON CONFLICT (evento_id) DO UPDATE SET bye_pontua = true, pontos_vitoria = 2`,
    [ev1Id]
  );

  // Criar 2 equipes
  const eq1Res = await pool.query("INSERT INTO equipes (nome) VALUES ('Equipe Teste F11 Alpha " + ts + "') RETURNING id");
  const eq1Id = eq1Res.rows[0].id;

  const eq2Res = await pool.query("INSERT INTO equipes (nome) VALUES ('Equipe Teste F11 Beta " + ts + "') RETURNING id");
  const eq2Id = eq2Res.rows[0].id;

  // Obter faixa
  const faixaRes = await pool.query('SELECT id FROM faixas ORDER BY ordem LIMIT 1');
  const faixaId = faixaRes.rows[0].id;

  // Criar Categoria 1 no Evento 1 (terá 3 atletas confirmados)
  const cat1Res = await pool.query(
    `INSERT INTO categorias (evento_id, nome, idade_minima, idade_maxima, peso_minimo, peso_maximo, faixa_minima_id, faixa_maxima_id, sexo)
     VALUES ($1, 'Cat 3 Atletas', 18, 35, NULL, 80.00, $2, $2, 'MASCULINO') RETURNING id`,
    [ev1Id, faixaId]
  );
  const cat1Id = cat1Res.rows[0].id;

  // Criar Categoria 2 no Evento 1 (terá apenas 1 atleta - insuficiente)
  const cat2Res = await pool.query(
    `INSERT INTO categorias (evento_id, nome, idade_minima, idade_maxima, peso_minimo, peso_maximo, faixa_minima_id, faixa_maxima_id, sexo)
     VALUES ($1, 'Cat 1 Atleta', 18, 35, NULL, 80.00, $2, $2, 'MASCULINO') RETURNING id`,
    [ev1Id, faixaId]
  );
  const cat2Id = cat2Res.rows[0].id;

  // Criar Categoria 3 no Evento 1 (terá 4 atletas: 2 da equipe 1 e 2 da equipe 2)
  const cat3Res = await pool.query(
    `INSERT INTO categorias (evento_id, nome, idade_minima, idade_maxima, peso_minimo, peso_maximo, faixa_minima_id, faixa_maxima_id, sexo)
     VALUES ($1, 'Cat 4 Atletas Equipes', 18, 35, NULL, 80.00, $2, $2, 'MASCULINO') RETURNING id`,
    [ev1Id, faixaId]
  );
  const cat3Id = cat3Res.rows[0].id;

  // Inserir atletas na Categoria 1 (3 atletas, sendo um com Seed 1)
  const a1Res = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, seed, status)
     VALUES ($1, $2, $3, $4, 'Competidor Seed 1', 22, 75.0, 'MASCULINO', 1, 'CONFIRMADA') RETURNING id`,
    [ev1Id, cat1Id, eq1Id, faixaId]
  );
  const a1Id = a1Res.rows[0].id;

  const a2Res = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
     VALUES ($1, $2, $3, $4, 'Competidor Sem Seed 2', 24, 76.0, 'MASCULINO', 'CONFIRMADA') RETURNING id`,
    [ev1Id, cat1Id, eq2Id, faixaId]
  );

  const a3Res = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
     VALUES ($1, $2, $3, $4, 'Competidor Sem Seed 3', 25, 77.0, 'MASCULINO', 'CONFIRMADA') RETURNING id`,
    [ev1Id, cat1Id, eq1Id, faixaId]
  );

  // Inserir 1 atleta na Categoria 2
  await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
     VALUES ($1, $2, $3, $4, 'Atleta Solitário', 26, 75.0, 'MASCULINO', 'CONFIRMADA')`,
    [ev1Id, cat2Id, eq1Id, faixaId]
  );

  // Inserir 4 atletas na Categoria 3
  for (let i = 1; i <= 4; i++) {
    const eq = i <= 2 ? eq1Id : eq2Id;
    await pool.query(
      `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
       VALUES ($1, $2, $3, $4, 'Atleta Cat3 - ' || $5, 25, 75.0, 'MASCULINO', 'CONFIRMADA')`,
      [ev1Id, cat3Id, eq, faixaId, i]
    );
  }

  // ==========================================
  // 5. GET /eventos/:id/chaves (TELA DE LISTAGEM)
  // ==========================================
  console.log('\n--- 5. Visualização da Lista de Chaves ---');
  const getChavesRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves`, {
    headers: { Cookie: sessionCookie },
  });
  assert(getChavesRes.status === 200, 'GET /eventos/:id/chaves retorna 200');

  const chavesHtml = await getChavesRes.text();
  assert(chavesHtml.includes('Chaves de Luta'), 'Exibe título da tela de chaves');
  assert(chavesHtml.includes('Cat 3 Atletas'), 'Lista Categoria 1');
  assert(chavesHtml.includes('Cat 1 Atleta'), 'Lista Categoria 2');
  assert(chavesHtml.includes('Gerar chave'), 'Contém botão Gerar chave para Cat 1');
  assert(chavesHtml.includes('Inscritos insuficientes'), 'Exibe badge de inscritos insuficientes para Cat 2');

  let currentCsrf = chavesHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // ==========================================
  // 6. BLOQUEIO DE GERAÇÃO COM < 2 ATLETAS
  // ==========================================
  console.log('\n--- 6. Bloqueio de Geração com Menos de 2 Inscritos ---');
  const postInsufRes = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/categorias/${cat2Id}/chave/gerar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
      redirect: 'manual',
    }
  );
  assert(postInsufRes.status === 302, 'Tentativa com 1 atleta redireciona (302)');

  const dbChaveCat2 = await pool.query('SELECT id FROM chaves WHERE categoria_id = $1', [cat2Id]);
  assert(dbChaveCat2.rows.length === 0, 'Nenhuma chave criada para categoria insuficiente');

  // ==========================================
  // 7. GERAÇÃO COM SUCESSO DA CHAVE (3 ATLETAS -> TAMANHO 4)
  // ==========================================
  console.log('\n--- 7. Geração de Chave com 3 Atletas (Tamanho 4) ---');
  const postGerarRes = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/categorias/${cat1Id}/chave/gerar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
      redirect: 'manual',
    }
  );
  assert(postGerarRes.status === 302, 'Geração de chave redireciona (302)');
  const redirectUrl = postGerarRes.headers.get('location');
  assert(redirectUrl.includes(`/eventos/${ev1Id}/chaves/`), 'Redireciona para visualização da chave criada');

  const chaveId = redirectUrl.split('/').pop();

  // Verificar dados no banco
  const dbChave = await pool.query('SELECT * FROM chaves WHERE id = $1', [chaveId]);
  assert(dbChave.rows.length === 1, 'Chave gravada no banco de dados');
  assert(dbChave.rows[0].status === 'NAO_INICIADA', 'Status inicial é NAO_INICIADA');
  assert(dbChave.rows[0].tamanho === 4, 'Tamanho calculado é 4');

  const dbLutas = await pool.query('SELECT * FROM lutas WHERE chave_id = $1 ORDER BY rodada, posicao', [chaveId]);
  assert(dbLutas.rows.length === 3, 'Chave de 4 possui exatamente 3 lutas no banco');

  // Verificar que lutas de R1 apontam para a final (R2 P1)
  const finalLuta = dbLutas.rows.find((l) => l.rodada === 2 && l.posicao === 1);
  const r1Lutas = dbLutas.rows.filter((l) => l.rodada === 1);

  assert(finalLuta.proxima_luta_id === null, 'Luta final não possui próxima luta');
  assert(r1Lutas.length === 2, 'Rodada 1 possui 2 lutas');
  assert(r1Lutas[0].proxima_luta_id === finalLuta.id, 'R1 P1 aponta para R2 P1');
  assert(r1Lutas[1].proxima_luta_id === finalLuta.id, 'R1 P2 aponta para R2 P1');
  assert(r1Lutas[0].proximo_slot === 1, 'R1 P1 tem destino no slot 1');
  assert(r1Lutas[1].proximo_slot === 2, 'R1 P2 tem destino no slot 2');

  // Verificar presença de 1 bye em R1
  const lutaComBye = r1Lutas.find((l) => l.competidor_1_id === null || l.competidor_2_id === null);
  assert(lutaComBye !== undefined, 'Existe exatamente uma luta com BYE na R1');
  assert(
    (lutaComBye.competidor_1_id !== null && lutaComBye.competidor_2_id === null) ||
      (lutaComBye.competidor_1_id === null && lutaComBye.competidor_2_id !== null),
    'Luta com bye possui exatamente um competidor não nulo'
  );

  // ==========================================
  // 8. TELA DA CHAVE E SORTEAR NOVAMENTE
  // ==========================================
  console.log('\n--- 8. Visualização e Novo Sorteio da Chave ---');
  const getChaveView = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}`, {
    headers: { Cookie: sessionCookie },
  });
  assert(getChaveView.status === 200, 'GET da chave retorna 200');
  const chaveViewHtml = await getChaveView.text();
  assert(chaveViewHtml.includes('Nao iniciada'), 'Exibe badge de Não iniciada');
  assert(chaveViewHtml.includes('Sortear novamente'), 'Exibe botão Sortear novamente');
  assert(chaveViewHtml.includes('Iniciar chave'), 'Exibe botão Iniciar chave');
  assert(chaveViewHtml.includes('Excluir chave'), 'Exibe botão Excluir chave');

  currentCsrf = chaveViewHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // Executar Sortear Novamente
  const postSortearRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/sortear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(postSortearRes.status === 302, 'Sortear novamente redireciona (302)');

  const novaChaveId = postSortearRes.headers.get('location').split('/').pop();
  const dbChaveSorteada = await pool.query('SELECT * FROM chaves WHERE id = $1', [novaChaveId]);
  assert(dbChaveSorteada.rows.length === 1, 'Nova chave sorteada existe no banco');
  assert(dbChaveSorteada.rows[0].status === 'NAO_INICIADA', 'Permanece NAO_INICIADA após novo sorteio');

  // ==========================================
  // 9. INICIAR A CHAVE E AVANÇAR BYES
  // ==========================================
  console.log('\n--- 9. Iniciar Chave, Avanço de Byes e Pontuação ---');
  const getChaveView2 = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${novaChaveId}`, {
    headers: { Cookie: sessionCookie },
  });
  currentCsrf = (await getChaveView2.text()).match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const postIniciarRes = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${novaChaveId}/iniciar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(postIniciarRes.status === 302, 'Iniciar chave redireciona (302)');

  // Verificar status da chave no banco
  const dbChaveIniciada = await pool.query('SELECT * FROM chaves WHERE id = $1', [novaChaveId]);
  assert(dbChaveIniciada.rows[0].status === 'EM_ANDAMENTO', 'Status da chave atualizado para EM_ANDAMENTO');

  // Verificar lutas após início
  const dbLutasIniciadas = await pool.query(
    'SELECT * FROM lutas WHERE chave_id = $1 ORDER BY rodada, posicao',
    [novaChaveId]
  );
  const r1Iniciadas = dbLutasIniciadas.rows.filter((l) => l.rodada === 1);
  const finalIniciada = dbLutasIniciadas.rows.find((l) => l.rodada === 2);

  // Luta de 2 atletas deve estar PRONTA
  const lutaNormal = r1Iniciadas.find((l) => l.competidor_1_id && l.competidor_2_id);
  assert(lutaNormal.status === 'PRONTA', 'Luta de 1ª rodada com 2 competidores fica PRONTA');

  // Luta com BYE deve estar FINALIZADA
  const lutaBye = r1Iniciadas.find((l) => !l.competidor_1_id || !l.competidor_2_id);
  assert(lutaBye.status === 'FINALIZADA', 'Luta com BYE na 1ª rodada fica FINALIZADA');
  assert(lutaBye.tipo_resultado === 'BYE', 'Luta com BYE tem tipo_resultado = BYE');
  assert(lutaBye.vencedor_id !== null, 'Vencedor do BYE está definido');

  // Vencedor do BYE deve ter avançado para a Final
  const atletaVencedorBye = lutaBye.vencedor_id;
  assert(
    finalIniciada.competidor_1_id === atletaVencedorBye || finalIniciada.competidor_2_id === atletaVencedorBye,
    'Vencedor do BYE avançou para a luta da rodada seguinte'
  );

  // Verificar lançamento de pontos em pontos_equipes (pois bye_pontua = true)
  const dbPontos = await pool.query(
    'SELECT * FROM pontos_equipes WHERE luta_id = $1 AND tipo = $2',
    [lutaBye.id, 'VITORIA']
  );
  assert(dbPontos.rows.length === 1, 'Pontos por avanço de BYE foram gerados em pontos_equipes');
  assert(dbPontos.rows[0].pontos === 2, 'Pontuação gravada corresponde a pontos_vitoria (2)');

  // ==========================================
  // 10. BLOQUEIOS EM CHAVE EM ANDAMENTO
  // ==========================================
  console.log('\n--- 10. Proteções de Chave em Andamento ---');
  const getChaveView3 = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${novaChaveId}`, {
    headers: { Cookie: sessionCookie },
  });
  const htmlIniciada = await getChaveView3.text();
  assert(htmlIniciada.includes('Em andamento'), 'Exibe badge de Em andamento');
  assert(!htmlIniciada.includes('Sortear novamente'), 'Botão Sortear novamente não é exibido');
  assert(!htmlIniciada.includes('Iniciar chave'), 'Botão Iniciar chave não é exibido');

  currentCsrf = htmlIniciada.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // Tentativa de sortear chave em andamento
  const postSortearBloq = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${novaChaveId}/sortear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(postSortearBloq.status === 302, 'Sortear chave em andamento é bloqueado (302 redirect)');

  // Tentativa de excluir chave em andamento
  const postExcluirBloq = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${novaChaveId}/excluir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(postExcluirBloq.status === 302, 'Excluir chave em andamento é bloqueado (302 redirect)');

  // Chave continua existindo intacta
  const dbChaveAposBloq = await pool.query('SELECT * FROM chaves WHERE id = $1', [novaChaveId]);
  assert(dbChaveAposBloq.rows.length === 1, 'Chave em andamento não foi excluída');

  // ==========================================
  // 11. EXCLUSÃO DE CHAVE NÃO INICIADA
  // ==========================================
  console.log('\n--- 11. Exclusão de Chave Não Iniciada ---');
  // Gerar chave para a Categoria 3
  const postGerarCat3 = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/categorias/${cat3Id}/chave/gerar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
      redirect: 'manual',
    }
  );
  const chave3Id = postGerarCat3.headers.get('location').split('/').pop();

  const getChave3View = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chave3Id}`, {
    headers: { Cookie: sessionCookie },
  });
  currentCsrf = (await getChave3View.text()).match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // Excluir chave 3
  const postExcluirOk = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chave3Id}/excluir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(postExcluirOk.status === 302, 'Exclusão de chave não iniciada redireciona (302)');

  const dbChave3 = await pool.query('SELECT * FROM chaves WHERE id = $1', [chave3Id]);
  assert(dbChave3.rows.length === 0, 'Chave não iniciada foi excluída do banco');

  const dbLutas3 = await pool.query('SELECT * FROM lutas WHERE chave_id = $1', [chave3Id]);
  assert(dbLutas3.rows.length === 0, 'Lutas da chave excluída foram removidas em cascata');

  // ==========================================
  // 12. SEGURANÇA, ISOLAMENTO E CSRF
  // ==========================================
  console.log('\n--- 12. Segurança, Isolamento Entre Eventos e CSRF ---');
  // Acesso com evento divergente
  const getFakeEv = await fetch(`http://localhost:3000/eventos/${ev2Id}/chaves/${novaChaveId}`, {
    headers: { Cookie: sessionCookie },
  });
  assert(getFakeEv.status === 404, 'Acesso a chave de outro evento retorna 404');

  const postFakeEv = await fetch(`http://localhost:3000/eventos/${ev2Id}/chaves/${novaChaveId}/iniciar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
  });
  assert(postFakeEv.status === 404, 'Operação em chave de outro evento retorna 404');

  // POST sem CSRF
  const postNoCsrf = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/categorias/${cat3Id}/chave/gerar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({}).toString(),
    }
  );
  assert(postNoCsrf.status === 403, 'POST sem CSRF token retorna 403 Forbidden');

  // ==========================================
  // 13. LIMPEZA FINAL
  // ==========================================
  await cleanup();

  console.log(`\n--- RESULTADO FASE 11: ${passedCount} de ${testCount} testes passaram com sucesso! ---`);
  await pool.end();
}

runTests().catch((err) => {
  console.error('Erro nos testes da Fase 11:', err);
  process.exit(1);
});
