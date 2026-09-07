const pool = require('../src/config/database');
const {
  converterPontos,
  normalizarPontuacao,
  validarPontuacao,
} = require('../src/validators/pontuacaoValidator');
require('dotenv').config();

async function runTests() {
  console.log('--- Iniciando Testes da Fase 10 (Configuracao de Pontuacao) ---');
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
  // 1. TESTES UNITARIOS DO VALIDATOR
  // ==========================================
  console.log('\n--- 1. Testes Unitarios de pontuacaoValidator ---');

  // converterPontos
  assert(converterPontos('10') === 10, 'converterPontos converte string numerica para inteiro');
  assert(converterPontos(0) === 0, 'converterPontos mantem 0');
  assert(converterPontos('0') === 0, 'converterPontos converte string 0');
  assert(converterPontos('') === null, 'converterPontos retorna null para string vazia');
  assert(converterPontos('abc') === null, 'converterPontos retorna null para string alfabetica');
  assert(converterPontos('1.5') === null, 'converterPontos retorna null para numero decimal');
  assert(converterPontos(undefined) === null, 'converterPontos retorna null para undefined');

  // normalizarPontuacao
  const norm1 = normalizarPontuacao({
    pontos_vitoria: ' 2 ',
    pontos_primeiro: '9',
    pontos_segundo: '3',
    pontos_terceiro: '1',
    bye_pontua: '1',
  });
  assert(norm1.pontos_vitoria === 2, 'normalizarPontuacao converte pontos_vitoria com trim');
  assert(norm1.bye_pontua === true, 'normalizarPontuacao normaliza bye_pontua 1 para true');

  const norm2 = normalizarPontuacao({
    pontos_vitoria: 0,
    pontos_primeiro: 0,
    pontos_segundo: 0,
    pontos_terceiro: 0,
  });
  assert(norm2.bye_pontua === false, 'normalizarPontuacao define bye_pontua como false quando ausente');

  // validarPontuacao
  const validPayload = {
    pontos_vitoria: 1,
    pontos_primeiro: 9,
    pontos_segundo: 3,
    pontos_terceiro: 1,
    bye_pontua: false,
  };
  const resValido = validarPontuacao(validPayload);
  assert(Object.keys(resValido).length === 0, 'Payload valido passa na validacao sem erros');

  const payloadZero = {
    pontos_vitoria: 0,
    pontos_primeiro: 0,
    pontos_segundo: 0,
    pontos_terceiro: 0,
    bye_pontua: true,
  };
  assert(Object.keys(validarPontuacao(payloadZero)).length === 0, 'Valores zerados sao permitidos');

  const payloadNegativo = {
    pontos_vitoria: -1,
    pontos_primeiro: 9,
    pontos_segundo: 3,
    pontos_terceiro: 1,
  };
  const resNeg = validarPontuacao(payloadNegativo);
  assert(!!resNeg.pontos_vitoria, 'Rejeita pontos negativos');

  const payloadMaior1000 = {
    pontos_vitoria: 1,
    pontos_primeiro: 1001,
    pontos_segundo: 3,
    pontos_terceiro: 1,
  };
  const resMax = validarPontuacao(payloadMaior1000);
  assert(!!resMax.pontos_primeiro, 'Rejeita valores superiores a 1000');

  const payloadDecimal = {
    pontos_vitoria: 1,
    pontos_primeiro: 9,
    pontos_segundo: '3.5',
    pontos_terceiro: 1,
  };
  const resDec = validarPontuacao(payloadDecimal);
  assert(!!resDec.pontos_segundo, 'Rejeita valores decimais');

  // ==========================================
  // 2. CONFIGURACAO DE AMBIENTE E AUTENTICACAO HTTP
  // ==========================================
  console.log('\n--- 2. Autenticacao e Criacao de Evento para Testes HTTP ---');
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
          SELECT id FROM eventos WHERE nome LIKE 'Evento Pontuacao F10%'
        )
      `);
      await pool.query(`
        DELETE FROM regras_pontuacao WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento Pontuacao F10%'
        )
      `);
      await pool.query(`
        DELETE FROM eventos WHERE nome LIKE 'Evento Pontuacao F10%'
      `);
      await pool.query(`
        DELETE FROM equipes WHERE nome LIKE 'Equipe Teste F10%'
      `);
    } catch (err) {
      console.error('Erro no cleanup:', err.message);
    }
  }

  await cleanup();

  // Criar evento para testes
  const evRes = await pool.query(
    "INSERT INTO eventos (nome, descricao) VALUES ('Evento Pontuacao F10 " + ts + "', 'Descricao teste') RETURNING id"
  );
  const eventoId = evRes.rows[0].id;

  // Garantir regra padrao inicial criada
  await pool.query(
    'INSERT INTO regras_pontuacao (evento_id, pontos_vitoria, pontos_primeiro, pontos_segundo, pontos_terceiro, bye_pontua) VALUES ($1, 0, 0, 0, 0, false) ON CONFLICT (evento_id) DO NOTHING',
    [eventoId]
  );

  // ==========================================
  // 3. GET /eventos/:id/pontuacao (TELA INICIAL)
  // ==========================================
  console.log('\n--- 3. Visualizacao da Tela de Pontuacao ---');
  const getRes = await fetch(`http://localhost:3000/eventos/${eventoId}/pontuacao`, {
    headers: { Cookie: sessionCookie },
  });
  assert(getRes.status === 200, 'GET /eventos/:id/pontuacao retorna status 200');

  const getHtml = await getRes.text();
  assert(getHtml.includes('Configuracao de pontuacao'), 'Exibe titulo da tela');
  assert(getHtml.includes('name="pontos_vitoria"'), 'Contem campo pontos_vitoria');
  assert(getHtml.includes('name="pontos_primeiro"'), 'Contem campo pontos_primeiro');
  assert(getHtml.includes('name="pontos_segundo"'), 'Contem campo pontos_segundo');
  assert(getHtml.includes('name="pontos_terceiro"'), 'Contem campo pontos_terceiro');
  assert(getHtml.includes('name="bye_pontua"'), 'Contem checkbox bye_pontua');
  assert(getHtml.includes(`href="/eventos/${eventoId}"`), 'Contem link de retorno para o evento');
  assert(!getHtml.includes('disabled'), 'Campos nao estao desabilitados inicialmente');

  let currentCsrf = getHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // ==========================================
  // 4. POST /eventos/:id/pontuacao (SUCESSO)
  // ==========================================
  console.log('\n--- 4. Atualizacao com Sucesso das Regras ---');
  const postSuccessRes = await fetch(`http://localhost:3000/eventos/${eventoId}/pontuacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      pontos_vitoria: '1',
      pontos_primeiro: '9',
      pontos_segundo: '3',
      pontos_terceiro: '1',
      bye_pontua: '1',
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });

  assert(postSuccessRes.status === 302, 'POST com dados validos redireciona com 302');
  assert(
    postSuccessRes.headers.get('location') === `/eventos/${eventoId}/pontuacao`,
    'Redireciona de volta para a rota de pontuacao'
  );

  // Verificar persistencia no banco
  const dbRegra1 = await pool.query('SELECT * FROM regras_pontuacao WHERE evento_id = $1', [eventoId]);
  assert(dbRegra1.rows.length === 1, 'Regra existe no banco de dados');
  assert(dbRegra1.rows[0].pontos_vitoria === 1, 'pontos_vitoria atualizado para 1');
  assert(dbRegra1.rows[0].pontos_primeiro === 9, 'pontos_primeiro atualizado para 9');
  assert(dbRegra1.rows[0].pontos_segundo === 3, 'pontos_segundo atualizado para 3');
  assert(dbRegra1.rows[0].pontos_terceiro === 1, 'pontos_terceiro atualizado para 1');
  assert(dbRegra1.rows[0].bye_pontua === true, 'bye_pontua atualizado para true');

  // Verificar renderizacao dos novos valores e mensagem flash de sucesso
  const getUpdatedRes = await fetch(`http://localhost:3000/eventos/${eventoId}/pontuacao`, {
    headers: { Cookie: sessionCookie },
  });
  const updatedHtml = await getUpdatedRes.text();
  assert(updatedHtml.includes('Configuração de pontuação atualizada com sucesso') || updatedHtml.includes('sucesso'), 'Exibe mensagem flash de sucesso');
  assert(updatedHtml.includes('value="1"'), 'Formulario reflete novo valor de vitoria');
  assert(updatedHtml.includes('value="9"'), 'Formulario reflete novo valor de primeiro lugar');
  assert(updatedHtml.includes('checked'), 'Checkbox bye_pontua esta marcado');

  currentCsrf = updatedHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // ==========================================
  // 5. POST /eventos/:id/pontuacao (TOGGLE BYE_PONTUA PARA FALSE)
  // ==========================================
  console.log('\n--- 5. Atualizacao Desmarcando bye_pontua ---');
  const postToggleRes = await fetch(`http://localhost:3000/eventos/${eventoId}/pontuacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      pontos_vitoria: '2',
      pontos_primeiro: '10',
      pontos_segundo: '5',
      pontos_terceiro: '2',
      // bye_pontua omitido (como ocorre no form HTML quando desmarcado)
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });
  assert(postToggleRes.status === 302, 'Atualizacao sem bye_pontua redireciona 302');

  const dbRegra2 = await pool.query('SELECT * FROM regras_pontuacao WHERE evento_id = $1', [eventoId]);
  assert(dbRegra2.rows[0].pontos_vitoria === 2, 'pontos_vitoria atualizado para 2');
  assert(dbRegra2.rows[0].bye_pontua === false, 'bye_pontua atualizado para false');

  // ==========================================
  // 6. VALIDACAO DE ENTRADA (ERROS 422)
  // ==========================================
  console.log('\n--- 6. Validacao e Rejeicao de Dados Invalidos (422) ---');
  const getBeforeInv = await fetch(`http://localhost:3000/eventos/${eventoId}/pontuacao`, {
    headers: { Cookie: sessionCookie },
  });
  currentCsrf = (await getBeforeInv.text()).match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // Valor negativo
  const postNegRes = await fetch(`http://localhost:3000/eventos/${eventoId}/pontuacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      pontos_vitoria: '-5',
      pontos_primeiro: '9',
      pontos_segundo: '3',
      pontos_terceiro: '1',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(postNegRes.status === 422, 'Envio de pontos negativos retorna 422');
  const postNegHtml = await postNegRes.text();
  assert(
    postNegHtml.includes('menor que zero') || postNegHtml.includes('invalido') || postNegHtml.includes('form-error'),
    'Exibe erro de validacao para valor negativo'
  );

  // Valor > 1000
  const postMaxRes = await fetch(`http://localhost:3000/eventos/${eventoId}/pontuacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      pontos_vitoria: '1',
      pontos_primeiro: '1001',
      pontos_segundo: '3',
      pontos_terceiro: '1',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(postMaxRes.status === 422, 'Envio de valor > 1000 retorna 422');

  // Valor decimal invalido
  const postDecRes = await fetch(`http://localhost:3000/eventos/${eventoId}/pontuacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      pontos_vitoria: '1',
      pontos_primeiro: '9.75',
      pontos_segundo: '3',
      pontos_terceiro: '1',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(postDecRes.status === 422, 'Envio de valor decimal retorna 422');

  // Garantir que o banco de dados nao foi corrompido
  const dbRegraAposErros = await pool.query('SELECT * FROM regras_pontuacao WHERE evento_id = $1', [eventoId]);
  assert(dbRegraAposErros.rows[0].pontos_vitoria === 2, 'Banco preserva valores validos anteriores');

  // ==========================================
  // 7. BLOQUEIO QUANDO EVENTO JA POSSUI PONTOS LANCADOS
  // ==========================================
  console.log('\n--- 7. Bloqueio de Edicao Quando Ja Existem Pontos Lancados ---');
  // Criar uma equipe para o lancamento
  const eqRes = await pool.query("INSERT INTO equipes (nome) VALUES ('Equipe Teste F10 " + ts + "') RETURNING id");
  const equipeId = eqRes.rows[0].id;

  // Inserir registro em pontos_equipes para bloquear a edicao
  await pool.query(
    `INSERT INTO pontos_equipes (evento_id, equipe_id, tipo, pontos, descricao)
     VALUES ($1, $2, 'AJUSTE', 10, 'Bonus inicial de teste')`,
    [eventoId, equipeId]
  );

  // 7.1 GET na tela deve vir com bloqueada = true
  const getBlockedRes = await fetch(`http://localhost:3000/eventos/${eventoId}/pontuacao`, {
    headers: { Cookie: sessionCookie },
  });
  const blockedHtml = await getBlockedRes.text();
  assert(blockedHtml.includes('Configuracao bloqueada') || blockedHtml.includes('bloqueada'), 'Exibe aviso de configuracao bloqueada');
  assert(blockedHtml.includes('disabled'), 'Campos aparecem com atributo disabled');
  assert(!blockedHtml.includes('Salvar pontuacao'), 'Botao salvar pontuacao nao e exibido');

  currentCsrf = blockedHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // 7.2 POST deve ser rejeitado no backend por regra de negocio
  const postBlockedRes = await fetch(`http://localhost:3000/eventos/${eventoId}/pontuacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      pontos_vitoria: '99',
      pontos_primeiro: '99',
      pontos_segundo: '99',
      pontos_terceiro: '99',
      _csrf: currentCsrf,
    }).toString(),
    redirect: 'manual',
  });
  assert(postBlockedRes.status === 302, 'POST em evento bloqueado redireciona com flash de erro');

  const dbRegraAposBloqueio = await pool.query('SELECT * FROM regras_pontuacao WHERE evento_id = $1', [eventoId]);
  assert(dbRegraAposBloqueio.rows[0].pontos_vitoria === 2, 'Tentativa de alteracao foi bloqueada no banco (continua 2)');

  // ==========================================
  // 8. AUTO-RECUPERACAO SE LINHA NAO EXISTIR
  // ==========================================
  console.log('\n--- 8. Auto-recuperacao Se Regra Nao Existir no Banco ---');
  const ev2Res = await pool.query(
    "INSERT INTO eventos (nome, descricao) VALUES ('Evento Pontuacao F10 SemRegra " + ts + "', 'Sem regra') RETURNING id"
  );
  const ev2Id = ev2Res.rows[0].id;

  // Deletar qualquer regra associada
  await pool.query('DELETE FROM regras_pontuacao WHERE evento_id = $1', [ev2Id]);

  // Acessar GET deve auto-criar e renderizar sem erros
  const getAutoRes = await fetch(`http://localhost:3000/eventos/${ev2Id}/pontuacao`, {
    headers: { Cookie: sessionCookie },
  });
  assert(getAutoRes.status === 200, 'GET em evento sem regras_pontuacao responde 200');

  const dbAutoRegra = await pool.query('SELECT * FROM regras_pontuacao WHERE evento_id = $1', [ev2Id]);
  assert(dbAutoRegra.rows.length === 1, 'Auto-criou linha em regras_pontuacao com valores padrao');
  assert(dbAutoRegra.rows[0].pontos_vitoria === 0, 'Valores padrao inicializados com 0');

  // ==========================================
  // 9. SEGURANCA E ISOLAMENTO (404 E CSRF 403)
  // ==========================================
  console.log('\n--- 9. Seguranca, 404 e CSRF 403 ---');
  const getFakeRes = await fetch('http://localhost:3000/eventos/99999999/pontuacao', {
    headers: { Cookie: sessionCookie },
  });
  assert(getFakeRes.status === 404, 'GET para evento inexistente retorna 404');

  const postFakeRes = await fetch('http://localhost:3000/eventos/99999999/pontuacao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      pontos_vitoria: '1',
      pontos_primeiro: '1',
      pontos_segundo: '1',
      pontos_terceiro: '1',
      _csrf: currentCsrf,
    }).toString(),
  });
  assert(postFakeRes.status === 404, 'POST para evento inexistente retorna 404');

  const postNoCsrfRes = await fetch(`http://localhost:3000/eventos/${ev2Id}/pontuacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
    body: new URLSearchParams({
      pontos_vitoria: '1',
      pontos_primeiro: '1',
      pontos_segundo: '1',
      pontos_terceiro: '1',
    }).toString(),
  });
  assert(postNoCsrfRes.status === 403, 'POST sem CSRF token retorna 403 Forbidden');

  // ==========================================
  // 10. LIMPEZA FINAL
  // ==========================================
  await cleanup();

  console.log(`\n--- RESULTADO FASE 10: ${passedCount} de ${testCount} testes passaram com sucesso! ---`);
  await pool.end();
}

runTests().catch((err) => {
  console.error('Erro nos testes da Fase 10:', err);
  process.exit(1);
});
