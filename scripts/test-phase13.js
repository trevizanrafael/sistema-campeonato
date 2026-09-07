const pool = require('../src/config/database');
const {
  converterPlacar,
  normalizarResultado,
  validarResultado,
} = require('../src/validators/resultadoValidator');
require('dotenv').config();

async function runTests() {
  console.log('--- Iniciando Testes da Fase 13 (Lançamento de Resultados e Operação do Tatame) ---');
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
  // 1. TESTES UNITÁRIOS DO VALIDATOR
  // ==========================================
  console.log('\n--- 1. Testes Unitários de resultadoValidator ---');

  // converterPlacar
  assert(converterPlacar('10') === 10, 'converterPlacar converte string numérica');
  assert(converterPlacar(0) === 0, 'converterPlacar mantém número 0');
  assert(converterPlacar('0') === 0, 'converterPlacar converte string "0"');
  assert(converterPlacar('') === null, 'converterPlacar retorna null para vazio');
  assert(converterPlacar(null) === null, 'converterPlacar retorna null para null');
  assert(converterPlacar(undefined) === null, 'converterPlacar retorna null para undefined');
  assert(Number.isNaN(converterPlacar('abc')), 'converterPlacar retorna NaN para letras');
  assert(Number.isNaN(converterPlacar('2.5')), 'converterPlacar retorna NaN para float');

  // normalizarResultado
  const norm1 = normalizarResultado({
    vencedor_id: '15',
    tipo_resultado: ' pontos ',
    placar_1: ' 4 ',
    placar_2: ' 2 ',
    observacao: '  Final de raspagem  ',
  });
  assert(norm1.vencedor_id === 15, 'normalizarResultado converte vencedor_id para número');
  assert(norm1.tipo_resultado === 'PONTOS', 'normalizarResultado aplica trim e uppercase');
  assert(norm1.placar_1 === 4 && norm1.placar_2 === 2, 'normalizarResultado converte placares');
  assert(norm1.observacao === 'Final de raspagem', 'normalizarResultado aplica trim em observacao');

  // validarResultado
  const mockLuta = {
    id: 100,
    competidor_1_id: 10,
    competidor_2_id: 20,
  };

  // Vencedor obrigatório e válido
  assert(
    validarResultado({ vencedor_id: null }, mockLuta).vencedor_id !== undefined,
    'Rejeita lançamento sem vencedor selecionado'
  );
  assert(
    validarResultado({ vencedor_id: 99 }, mockLuta).vencedor_id !== undefined,
    'Rejeita vencedor que não pertence à luta'
  );
  assert(
    Object.keys(validarResultado({ vencedor_id: 10 }, mockLuta)).length === 0,
    'Aceita resultado simples apenas com vencedor_id (sem tipo, placar ou observação)'
  );

  // Tipo de resultado (quando informado)
  assert(
    validarResultado({ vencedor_id: 10, tipo_resultado: 'BYE' }, mockLuta).tipo_resultado !== undefined,
    'Rejeita estritamente tipo BYE em lançamento manual'
  );
  assert(
    validarResultado({ vencedor_id: 10, tipo_resultado: 'INEXISTENTE' }, mockLuta).tipo_resultado !== undefined,
    'Rejeita tipo de resultado inválido'
  );

  // PONTOS
  assert(
    validarResultado(
      { vencedor_id: 10, tipo_resultado: 'PONTOS', placar_1: null, placar_2: null },
      mockLuta
    ).placar !== undefined,
    'Rejeita PONTOS sem placar informado'
  );
  assert(
    validarResultado(
      { vencedor_id: 10, tipo_resultado: 'PONTOS', placar_1: -1, placar_2: 0 },
      mockLuta
    ).placar !== undefined,
    'Rejeita PONTOS com placar negativo'
  );
  assert(
    validarResultado(
      { vencedor_id: 10, tipo_resultado: 'PONTOS', placar_1: 2, placar_2: 2 },
      mockLuta
    ).placar !== undefined,
    'Rejeita PONTOS com empate no placar'
  );
  assert(
    validarResultado(
      { vencedor_id: 10, tipo_resultado: 'PONTOS', placar_1: 2, placar_2: 4 },
      mockLuta
    ).vencedor_id !== undefined,
    'Rejeita PONTOS se vencedor selecionado tiver placar menor que o perdedor'
  );
  assert(
    Object.keys(
      validarResultado(
        { vencedor_id: 10, tipo_resultado: 'PONTOS', placar_1: 4, placar_2: 2 },
        mockLuta
      )
    ).length === 0,
    'Aceita PONTOS válido com competidor 1 vencedor e maior placar'
  );
  assert(
    Object.keys(
      validarResultado(
        { vencedor_id: 20, tipo_resultado: 'PONTOS', placar_1: 0, placar_2: 3 },
        mockLuta
      )
    ).length === 0,
    'Aceita PONTOS válido com competidor 2 vencedor e maior placar'
  );

  // DECISAO
  assert(
    validarResultado(
      { vencedor_id: 10, tipo_resultado: 'DECISAO', placar_1: 2, placar_2: null },
      mockLuta
    ).placar !== undefined,
    'Rejeita DECISAO com apenas um placar preenchido'
  );
  assert(
    Object.keys(
      validarResultado(
        { vencedor_id: 10, tipo_resultado: 'DECISAO', placar_1: null, placar_2: null },
        mockLuta
      )
    ).length === 0,
    'Aceita DECISAO sem placar'
  );
  assert(
    Object.keys(
      validarResultado(
        { vencedor_id: 10, tipo_resultado: 'DECISAO', placar_1: 0, placar_2: 0 },
        mockLuta
      )
    ).length === 0,
    'Aceita DECISAO com placar empatado 0x0'
  );

  // FINALIZACAO / WO / DESCLASSIFICACAO
  const payloadFin = {
    vencedor_id: 10,
    tipo_resultado: 'FINALIZACAO',
    placar_1: 99,
    placar_2: 99,
  };
  const errosFin = validarResultado(payloadFin, mockLuta);
  assert(Object.keys(errosFin).length === 0, 'Aceita FINALIZACAO');
  assert(payloadFin.placar_1 === null && payloadFin.placar_2 === null, 'Limpa placares em FINALIZACAO');

  const payloadWo = { vencedor_id: 20, tipo_resultado: 'WO' };
  assert(Object.keys(validarResultado(payloadWo, mockLuta)).length === 0, 'Aceita WO');

  const payloadDq = { vencedor_id: 10, tipo_resultado: 'DESCLASSIFICACAO' };
  assert(Object.keys(validarResultado(payloadDq, mockLuta)).length === 0, 'Aceita DESCLASSIFICACAO');

  // Observação > 1000 caracteres
  const obsLonga = 'a'.repeat(1001);
  assert(
    validarResultado(
      { vencedor_id: 10, tipo_resultado: 'FINALIZACAO', observacao: obsLonga },
      mockLuta
    ).observacao !== undefined,
    'Rejeita observação com mais de 1.000 caracteres'
  );

  // ==========================================
  // 2. AMBIENTE DE TESTE E AUTENTICAÇÃO
  // ==========================================
  console.log('\n--- 2. Autenticação e Configuração de Evento e Chave ---');
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
          SELECT id FROM eventos WHERE nome LIKE 'Evento F13%'
        )
      `);
      await pool.query(`
        DELETE FROM lutas WHERE chave_id IN (
          SELECT id FROM chaves WHERE categoria_id IN (
            SELECT id FROM categorias WHERE evento_id IN (
              SELECT id FROM eventos WHERE nome LIKE 'Evento F13%'
            )
          )
        )
      `);
      await pool.query(`
        DELETE FROM chaves WHERE categoria_id IN (
          SELECT id FROM categorias WHERE evento_id IN (
            SELECT id FROM eventos WHERE nome LIKE 'Evento F13%'
          )
        )
      `);
      await pool.query(`
        DELETE FROM inscricoes WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F13%'
        )
      `);
      await pool.query(`
        DELETE FROM categorias WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F13%'
        )
      `);
      await pool.query(`
        DELETE FROM regras_pontuacao WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F13%'
        )
      `);
      await pool.query(`
        DELETE FROM eventos WHERE nome LIKE 'Evento F13%'
      `);
      await pool.query(`
        DELETE FROM equipes WHERE nome LIKE 'Equipe Teste F13%'
      `);
    } catch (err) {
      console.error('Erro no cleanup:', err.message);
    }
  }

  await cleanup();

  // Criar 2 eventos para testar lançamento e isolamento
  const ev1Res = await pool.query(
    "INSERT INTO eventos (nome, descricao) VALUES ('Evento F13 Alpha " + ts + "', 'Teste resultados') RETURNING id"
  );
  const ev1Id = ev1Res.rows[0].id;

  const ev2Res = await pool.query(
    "INSERT INTO eventos (nome, descricao) VALUES ('Evento F13 Beta " + ts + "', 'Outro evento') RETURNING id"
  );
  const ev2Id = ev2Res.rows[0].id;

  // Configurar pontuação no Evento 1: pontos_vitoria = 3
  await pool.query(
    `INSERT INTO regras_pontuacao (evento_id, pontos_vitoria, pontos_primeiro, pontos_segundo, pontos_terceiro, bye_pontua)
     VALUES ($1, 3, 9, 3, 1, false)
     ON CONFLICT (evento_id) DO UPDATE SET pontos_vitoria = 3`,
    [ev1Id]
  );

  // Configurar pontuação no Evento 2: pontos_vitoria = 0 (não deve pontuar vitória)
  await pool.query(
    `INSERT INTO regras_pontuacao (evento_id, pontos_vitoria, pontos_primeiro, pontos_segundo, pontos_terceiro, bye_pontua)
     VALUES ($1, 0, 9, 3, 1, false)
     ON CONFLICT (evento_id) DO UPDATE SET pontos_vitoria = 0`,
    [ev2Id]
  );

  // Criar 2 equipes
  const eq1Res = await pool.query("INSERT INTO equipes (nome) VALUES ('Equipe Teste F13 Gracie " + ts + "') RETURNING id");
  const eq1Id = eq1Res.rows[0].id;

  const eq2Res = await pool.query("INSERT INTO equipes (nome) VALUES ('Equipe Teste F13 Alliance " + ts + "') RETURNING id");
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
     VALUES ($1, $2, $3, $4, 'Competidor 1', 25, 80.00, 'MASCULINO', 'CONFIRMADA', 1) RETURNING id`,
    [ev1Id, catId, eq1Id, faixaId]
  );
  const c1Id = c1Res.rows[0].id;

  const c2Res = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
     VALUES ($1, $2, $3, $4, 'Competidor 2', 26, 81.00, 'MASCULINO', 'CONFIRMADA', 4) RETURNING id`,
    [ev1Id, catId, eq2Id, faixaId]
  );
  const c2Id = c2Res.rows[0].id;

  const c3Res = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
     VALUES ($1, $2, $3, $4, 'Competidor 3', 27, 79.50, 'MASCULINO', 'CONFIRMADA', 2) RETURNING id`,
    [ev1Id, catId, eq1Id, faixaId]
  );
  const c3Id = c3Res.rows[0].id;

  const c4Res = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
     VALUES ($1, $2, $3, $4, 'Competidor 4', 28, 80.50, 'MASCULINO', 'CONFIRMADA', 3) RETURNING id`,
    [ev1Id, catId, eq2Id, faixaId]
  );
  const c4Id = c4Res.rows[0].id;

  // Pegar token CSRF
  const getChavesPage = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves`, {
    headers: { Cookie: sessionCookie },
  });
  let currentCsrf = (await getChavesPage.text()).match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // Gerar chave para a categoria
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
  assert(postGerar.status === 302, 'Chave gerada com sucesso');

  // Iniciar chave (passar para EM_ANDAMENTO)
  const getChaveView = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}`, {
    headers: { Cookie: sessionCookie },
  });
  currentCsrf = (await getChaveView.text()).match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const postIniciar = await fetch(`http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/iniciar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    redirect: 'manual',
  });
  assert(postIniciar.status === 302, 'Chave iniciada com sucesso (status EM_ANDAMENTO)');

  // Buscar lutas no banco
  const { rows: lutas } = await pool.query(
    'SELECT * FROM lutas WHERE chave_id = $1 ORDER BY rodada ASC, posicao ASC',
    [chaveId]
  );
  assert(lutas.length === 3, 'Chave de 4 possui 3 lutas (2 semifinais e 1 final)');

  const luta1 = lutas[0]; // Semifinal 1 (PRONTA)
  const luta2 = lutas[1]; // Semifinal 2 (PRONTA)
  const lutaFinal = lutas[2]; // Final (AGUARDANDO)

  assert(luta1.status === 'PRONTA' && luta2.status === 'PRONTA', 'Lutas da rodada 1 estão em status PRONTA');
  assert(lutaFinal.status === 'AGUARDANDO', 'Luta da final está em status AGUARDANDO');

  // ==========================================
  // 3. ACESSO À TELA DE LANÇAMENTO DE RESULTADO
  // ==========================================
  console.log('\n--- 3. Acesso à Tela de Lançamento de Resultado ---');

  // Acesso a luta pronta: deve retornar 200 e formulário
  const getLuta1Res = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado`,
    { headers: { Cookie: sessionCookie } }
  );
  assert(getLuta1Res.status === 200, 'GET formulário de resultado para luta PRONTA retorna 200 OK');
  const formHtml = await getLuta1Res.text();
  assert(formHtml.includes('Definir vencedor') || formHtml.includes('Lançar resultado'), 'Página contém título');
  assert(formHtml.includes('name="vencedor_id"'), 'Página contém seleção do vencedor');
  assert(!formHtml.includes('name="tipo_resultado"'), 'Página NÃO exige tipo de resultado');
  assert(!formHtml.includes('name="placar_1"'), 'Página NÃO exige placares');
  assert(!formHtml.includes('name="observacao"'), 'Página NÃO exige campo de observações');
  currentCsrf = formHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // Acesso a luta em AGUARDANDO: deve redirecionar com erro (BusinessRuleError)
  const getFinalRes = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${lutaFinal.id}/resultado`,
    { headers: { Cookie: sessionCookie }, redirect: 'manual' }
  );
  assert(getFinalRes.status === 302, 'GET em luta AGUARDANDO redireciona para a chave (302)');

  // ==========================================
  // 4. VALIDAÇÃO DE SUBMISSÃO HTTP (ERROS 422)
  // ==========================================
  console.log('\n--- 4. Validação de Submissão HTTP ---');

  // 1. Sem vencedor
  const postSemVencedor = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({
        _csrf: currentCsrf,
        tipo_resultado: 'FINALIZACAO',
      }).toString(),
    }
  );
  assert(postSemVencedor.status === 422, 'Submissão sem vencedor retorna 422 Unprocessable Entity');

  // 2. Pontos empatados
  const postEmpate = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({
        _csrf: currentCsrf,
        vencedor_id: luta1.competidor_1_id,
        tipo_resultado: 'PONTOS',
        placar_1: '2',
        placar_2: '2',
      }).toString(),
    }
  );
  assert(postEmpate.status === 422, 'Submissão PONTOS com placar empatado retorna 422');

  // 3. Vencedor com placar inferior
  const postPlacarInvertido = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({
        _csrf: currentCsrf,
        vencedor_id: luta1.competidor_1_id,
        tipo_resultado: 'PONTOS',
        placar_1: '0',
        placar_2: '4',
      }).toString(),
    }
  );
  assert(postPlacarInvertido.status === 422, 'Submissão com vencedor tendo menor placar retorna 422');

  // ==========================================
  // 5. LANÇAMENTO DE SUCESSO E AVANÇO (LUTA 1)
  // ==========================================
  console.log('\n--- 5. Lançamento com Sucesso na Semifinal 1 (Apenas Vencedor) ---');
  const postLuta1Ok = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({
        _csrf: currentCsrf,
        vencedor_id: luta1.competidor_1_id,
      }).toString(),
      redirect: 'manual',
    }
  );
  assert(postLuta1Ok.status === 302, 'Lançamento com sucesso redireciona (302)');
  const locLuta1 = postLuta1Ok.headers.get('location');
  assert(
    locLuta1.includes(`#match-${lutaFinal.id}`),
    'Redireciona com âncora para a próxima luta (#match-{proximaLutaId})'
  );

  // Verificar DB da Luta 1
  const { rows: dbLuta1 } = await pool.query('SELECT * FROM lutas WHERE id = $1', [luta1.id]);
  assert(dbLuta1[0].status === 'FINALIZADA', 'Luta 1 foi marcada como FINALIZADA');
  assert(dbLuta1[0].vencedor_id === luta1.competidor_1_id, 'Vencedor correto gravado na Luta 1');
  assert(dbLuta1[0].perdedor_id === luta1.competidor_2_id, 'Perdedor deduzido e gravado automaticamente');

  // Verificar Avanço na Final
  const { rows: dbFinalAposLuta1 } = await pool.query('SELECT * FROM lutas WHERE id = $1', [lutaFinal.id]);
  assert(
    dbFinalAposLuta1[0].competidor_1_id === luta1.competidor_1_id,
    'Vencedor da Luta 1 avançou para o slot 1 da final'
  );
  assert(
    dbFinalAposLuta1[0].competidor_2_id === null,
    'Slot 2 da final ainda está vazio'
  );
  assert(
    dbFinalAposLuta1[0].status === 'AGUARDANDO',
    'Final continua em AGUARDANDO pois falta o segundo competidor'
  );

  // Verificar Pontuação da Equipe
  const { rows: pontosLuta1 } = await pool.query(
    'SELECT * FROM pontos_equipes WHERE luta_id = $1 AND tipo = $2',
    [luta1.id, 'VITORIA']
  );
  assert(pontosLuta1.length === 1, 'Exatamente um registro de pontos de vitória foi criado');
  assert(pontosLuta1[0].pontos === 3, 'Equipe recebeu os 3 pontos de vitória definidos nas regras');
  assert(pontosLuta1[0].equipe_id === eq1Id, 'Pontos atribuídos à equipe correta do vencedor');

  // ==========================================
  // 6. PROTEÇÃO CONTRA DUPLO LANÇAMENTO
  // ==========================================
  console.log('\n--- 6. Proteção Contra Duplo Lançamento e Modificação ---');
  const postLuta1Novamente = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta1.id}/resultado`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({
        _csrf: currentCsrf,
        vencedor_id: luta1.competidor_1_id,
        tipo_resultado: 'FINALIZACAO',
      }).toString(),
      redirect: 'manual',
    }
  );
  assert(postLuta1Novamente.status === 302, 'Tentativa de relançar luta finalizada é bloqueada (302)');

  const { rows: pontosLuta1PosTentativa } = await pool.query(
    'SELECT COUNT(*)::int AS total FROM pontos_equipes WHERE luta_id = $1 AND tipo = $2',
    [luta1.id, 'VITORIA']
  );
  assert(pontosLuta1PosTentativa[0].total === 1, 'Índice de segurança garantiu que não houve duplicação de pontos');

  // ==========================================
  // 7. LANÇAMENTO DA SEMIFINAL 2 E LIBERAÇÃO DA FINAL
  // ==========================================
  console.log('\n--- 7. Lançamento da Semifinal 2 e Transição Automática para PRONTA ---');
  const postLuta2Ok = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${luta2.id}/resultado`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({
        _csrf: currentCsrf,
        vencedor_id: luta2.competidor_2_id,
        tipo_resultado: 'FINALIZACAO',
        observacao: 'Armlock aos 2min30s',
      }).toString(),
      redirect: 'manual',
    }
  );
  assert(postLuta2Ok.status === 302, 'Luta 2 finalizada com sucesso');

  // Verificar que a final agora tem 2 competidores e passou automaticamente para PRONTA
  const { rows: dbFinalAposLuta2 } = await pool.query('SELECT * FROM lutas WHERE id = $1', [lutaFinal.id]);
  assert(
    dbFinalAposLuta2[0].competidor_2_id === luta2.competidor_2_id,
    'Vencedor da Luta 2 avançou para o slot 2 da final'
  );
  assert(
    dbFinalAposLuta2[0].status === 'PRONTA',
    'Final agora possui dois competidores e transicionou automaticamente para PRONTA'
  );

  // Verificar pontuação para a equipe 2
  const { rows: pontosLuta2 } = await pool.query(
    'SELECT * FROM pontos_equipes WHERE luta_id = $1 AND tipo = $2',
    [luta2.id, 'VITORIA']
  );
  assert(pontosLuta2.length === 1 && pontosLuta2[0].equipe_id === eq2Id, 'Equipe 2 recebeu 3 pontos de vitória');

  // ==========================================
  // 8. FINALIZANDO A GRANDE FINAL
  // ==========================================
  console.log('\n--- 8. Finalizando a Grande Final (Sem Próxima Luta) ---');
  const postFinalOk = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveId}/lutas/${lutaFinal.id}/resultado`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({
        _csrf: currentCsrf,
        vencedor_id: dbFinalAposLuta2[0].competidor_1_id,
        tipo_resultado: 'DECISAO',
        observacao: 'Decisão unânime dos juízes',
      }).toString(),
      redirect: 'manual',
    }
  );
  assert(postFinalOk.status === 302, 'Final finalizada com sucesso');
  const locFinal = postFinalOk.headers.get('location');
  assert(
    locFinal.includes(`#match-${lutaFinal.id}`),
    'Redireciona com âncora para a própria final (#match-{lutaId}) quando não há próxima luta'
  );

  const { rows: dbFinalConcluida } = await pool.query('SELECT * FROM lutas WHERE id = $1', [lutaFinal.id]);
  assert(dbFinalConcluida[0].status === 'FINALIZADA', 'Final marcada como FINALIZADA');
  assert(dbFinalConcluida[0].vencedor_id === dbFinalAposLuta2[0].competidor_1_id, 'Campeão gravado como vencedor da final');

  // Verificar total de pontos de vitórias concedidos no evento 1
  const { rows: totalPontosEv1 } = await pool.query(
    'SELECT equipe_id, SUM(pontos)::int AS total FROM pontos_equipes WHERE evento_id = $1 GROUP BY equipe_id ORDER BY total DESC',
    [ev1Id]
  );
  // Equipe 1 venceu 2 lutas (semifinal 1 e final) = 6 pontos
  // Equipe 2 venceu 1 luta (semifinal 2) = 3 pontos
  assert(totalPontosEv1.find((p) => p.equipe_id === eq1Id)?.total === 6, 'Equipe 1 acumulou 6 pontos de vitórias (2 vitórias)');
  assert(totalPontosEv1.find((p) => p.equipe_id === eq2Id)?.total === 3, 'Equipe 2 acumulou 3 pontos de vitórias (1 vitória)');

  // ==========================================
  // 9. EVENTO COM REGRA DE PONTOS_VITORIA = 0
  // ==========================================
  console.log('\n--- 9. Evento com Regra de Pontos por Vitória Zerada ---');
  // Criar categoria com 2 atletas no Evento 2
  const catEv2Res = await pool.query(
    `INSERT INTO categorias (evento_id, nome, idade_minima, idade_maxima, peso_minimo, peso_maximo, faixa_minima_id, faixa_maxima_id, sexo)
     VALUES ($1, 'Pena Adulto', 18, 35, NULL, 70.00, $2, $2, 'MASCULINO') RETURNING id`,
    [ev2Id, faixaId]
  );
  const catEv2Id = catEv2Res.rows[0].id;

  const a1Res = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
     VALUES ($1, $2, $3, $4, 'Atleta Zero 1', 20, 68.00, 'MASCULINO', 'CONFIRMADA') RETURNING id`,
    [ev2Id, catEv2Id, eq1Id, faixaId]
  );
  const a1Id = a1Res.rows[0].id;

  const a2Res = await pool.query(
    `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
     VALUES ($1, $2, $3, $4, 'Atleta Zero 2', 21, 69.00, 'MASCULINO', 'CONFIRMADA') RETURNING id`,
    [ev2Id, catEv2Id, eq2Id, faixaId]
  );
  const a2Id = a2Res.rows[0].id;

  // Gerar e iniciar chave no Evento 2
  await fetch(
    `http://localhost:3000/eventos/${ev2Id}/categorias/${catEv2Id}/chave/gerar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
    }
  );

  const { rows: chaveEv2Rows } = await pool.query('SELECT id FROM chaves WHERE categoria_id = $1', [catEv2Id]);
  const chaveEv2Id = chaveEv2Rows[0].id;

  await fetch(`http://localhost:3000/eventos/${ev2Id}/chaves/${chaveEv2Id}/iniciar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({ _csrf: currentCsrf }).toString(),
  });

  const { rows: lutaEv2Rows } = await pool.query('SELECT * FROM lutas WHERE chave_id = $1', [chaveEv2Id]);
  const lutaEv2 = lutaEv2Rows[0];

  const postLutaZeroOk = await fetch(
    `http://localhost:3000/eventos/${ev2Id}/chaves/${chaveEv2Id}/lutas/${lutaEv2.id}/resultado`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({
        _csrf: currentCsrf,
        vencedor_id: a1Id,
        tipo_resultado: 'WO',
      }).toString(),
      redirect: 'manual',
    }
  );
  assert(postLutaZeroOk.status === 302, 'Luta no evento com regra zerada finalizada com sucesso');

  const { rows: pontosEv2 } = await pool.query('SELECT * FROM pontos_equipes WHERE evento_id = $1', [ev2Id]);
  assert(pontosEv2.length === 0, 'Nenhum registro de pontos foi criado quando pontos_vitoria = 0');

  // ==========================================
  // 10. SEGURANÇA, ISOLAMENTO E CSRF
  // ==========================================
  console.log('\n--- 10. Segurança, Isolamento entre Eventos e CSRF ---');

  // Tentativa de acessar resultado com evento divergente
  const getDivergenteEv = await fetch(
    `http://localhost:3000/eventos/${ev1Id}/chaves/${chaveEv2Id}/lutas/${lutaEv2.id}/resultado`,
    { headers: { Cookie: sessionCookie } }
  );
  assert(getDivergenteEv.status === 404, 'Acesso a luta informando evento divergente retorna 404');

  // Tentativa de POST com chave divergente
  const postDivergenteChave = await fetch(
    `http://localhost:3000/eventos/${ev2Id}/chaves/${chaveId}/lutas/${lutaEv2.id}/resultado`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({
        _csrf: currentCsrf,
        vencedor_id: a1Id,
        tipo_resultado: 'WO',
      }).toString(),
    }
  );
  assert(postDivergenteChave.status === 404, 'POST informando chave divergente retorna 404');

  // POST sem CSRF token
  const postSemCsrf = await fetch(
    `http://localhost:3000/eventos/${ev2Id}/chaves/${chaveEv2Id}/lutas/${lutaEv2.id}/resultado`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({
        vencedor_id: a1Id,
        tipo_resultado: 'WO',
      }).toString(),
    }
  );
  assert(postSemCsrf.status === 403, 'POST sem CSRF token retorna 403 Forbidden');

  // ==========================================
  // 11. LIMPEZA FINAL
  // ==========================================
  await cleanup();

  console.log(`\n--- RESULTADO FASE 13: ${passedCount} de ${testCount} testes passaram com sucesso! ---`);
  await pool.end();
}

runTests().catch((err) => {
  console.error('Erro nos testes da Fase 13:', err);
  process.exit(1);
});
