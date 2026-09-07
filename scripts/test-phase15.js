const pool = require('../src/config/database');
const finalizacaoService = require('../src/services/finalizacaoService');
const chaveService = require('../src/services/chaveService');
const resultadoService = require('../src/services/resultadoService');
const lutaRepository = require('../src/repositories/lutaRepository');
require('dotenv').config();

async function runTests() {
  console.log('--- Iniciando Testes da Fase 15 (Finalização Confirmada e Pódio) ---');
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
  // 1. TESTES UNITÁRIOS DE CÁLCULO DE RESUMO DE EQUIPES
  // ==========================================
  console.log('\n--- 1. Testes Unitários de cálculo de resumo por equipe ---');

  const podioMock = {
    primeiro: {
      inscricao_id: 1,
      nome: 'Campeão Silva',
      equipe_id: 10,
      equipe_nome: 'Alpha',
      pontos: 9,
    },
    segundo: {
      inscricao_id: 2,
      nome: 'Vice Santos',
      equipe_id: 20,
      equipe_nome: 'Beta',
      pontos: 3,
    },
    terceiro: {
      inscricao_id: 3,
      nome: 'Bronze Oliveira',
      equipe_id: 10,
      equipe_nome: 'Alpha',
      pontos: 1,
    },
  };

  const mockClient = {
    query: async (sql, params) => {
      return {
        rows: [
          { equipe_id: 10, pontos_atuais: 5 },
          { equipe_id: 20, pontos_atuais: 2 },
        ],
      };
    },
  };

  const resumo = await finalizacaoService.calcularResumoEquipes(999, podioMock, mockClient);
  const alphaResumo = resumo.find((r) => r.equipe_id === 10);
  const betaResumo = resumo.find((r) => r.equipe_id === 20);

  assert(alphaResumo && alphaResumo.novos_pontos === 10, 'Alpha somou 10 novos pontos (9 do 1º + 1 do 3º)');
  assert(alphaResumo && alphaResumo.pontos_atuais === 5, 'Alpha tinha 5 pontos atuais');
  assert(alphaResumo && alphaResumo.total_apos === 15, 'Alpha total após finalizar é 15');
  assert(betaResumo && betaResumo.novos_pontos === 3, 'Beta somou 3 novos pontos (do 2º)');
  assert(betaResumo && betaResumo.total_apos === 5, 'Beta total após finalizar é 5 (2 + 3)');

  // Teste com chaveId e vitórias de equipe fora do pódio (ex: quartas de final)
  const mockClientChave = {
    query: async (sql) => {
      if (sql.includes("pe.tipo = 'VITORIA'")) {
        return {
          rows: [
            { equipe_id: 10, equipe_nome: 'Alpha', pontos_vitorias: 6, total_vitorias: 3 },
            { equipe_id: 20, equipe_nome: 'Beta', pontos_vitorias: 4, total_vitorias: 2 },
            { equipe_id: 30, equipe_nome: 'Gamma', pontos_vitorias: 2, total_vitorias: 1 },
          ],
        };
      }
      return {
        rows: [
          { equipe_id: 10, pontos_atuais: 0 },
          { equipe_id: 20, pontos_atuais: 0 },
          { equipe_id: 30, pontos_atuais: 0 },
        ],
      };
    },
  };

  const resumoComChave = await finalizacaoService.calcularResumoEquipes(999, 123, podioMock, mockClientChave);
  const gammaResumo = resumoComChave.find((r) => r.equipe_id === 30);
  assert(gammaResumo, 'Equipe Gamma (fora do pódio) aparece no resumo de pontuação');
  assert(gammaResumo && gammaResumo.pontos_vitorias === 2, 'Gamma possui 2 pontos de vitória');
  assert(gammaResumo && gammaResumo.pontos_colocacao === 0, 'Gamma possui 0 pontos de colocação');
  assert(gammaResumo && gammaResumo.novos_pontos === 2, 'Gamma possui 2 novos pontos no total');
  assert(gammaResumo && gammaResumo.total_apos === 2, 'Gamma total após finalizar é 2');

  // ==========================================
  // 2. AUTENTICAÇÃO E PREPARAÇÃO DO AMBIENTE
  // ==========================================
  console.log('\n--- 2. Autenticação e Configuração de Evento e Chave ---');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@campeonato.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'rafael06';

  const loginRes = await fetch('http://localhost:3000/login');
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];
  const loginHtml = await loginRes.text();
  const csrfMatch = loginHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  const csrf = csrfMatch ? csrfMatch[1] : '';

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
          SELECT id FROM eventos WHERE nome LIKE 'Evento F15%'
        )
      `);
      await pool.query(`
        DELETE FROM lutas WHERE chave_id IN (
          SELECT id FROM chaves WHERE categoria_id IN (
            SELECT id FROM categorias WHERE evento_id IN (
              SELECT id FROM eventos WHERE nome LIKE 'Evento F15%'
            )
          )
        )
      `);
      await pool.query(`
        DELETE FROM chaves WHERE categoria_id IN (
          SELECT id FROM categorias WHERE evento_id IN (
            SELECT id FROM eventos WHERE nome LIKE 'Evento F15%'
          )
        )
      `);
      await pool.query(`
        DELETE FROM inscricoes WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F15%'
        )
      `);
      await pool.query(`
        DELETE FROM categorias WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F15%'
        )
      `);
      await pool.query(`
        DELETE FROM regras_pontuacao WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F15%'
        )
      `);
      await pool.query(`
        DELETE FROM eventos WHERE nome LIKE 'Evento F15%'
      `);
      await pool.query(`
        DELETE FROM equipes WHERE nome LIKE 'Equipe F15%'
      `);
    } catch (e) {
      console.error('Erro no cleanup:', e);
    }
  }

  await cleanup();

  async function getCsrfToken(url) {
    const res = await fetch(url, { headers: { Cookie: sessionCookie } });
    const html = await res.text();
    const match = html.match(/name="_csrf"\s+value="([^"]+)"/);
    return { csrf: match ? match[1] : null, html, status: res.status };
  }

  // 1. Criar Evento
  const { rows: [evento] } = await pool.query(`
    INSERT INTO eventos (nome, descricao)
    VALUES ('Evento F15 Test ${ts}', 'Descrição evento F15')
    RETURNING *;
  `);

  // Configurar regras de pontuação: 9 para 1º, 3 para 2º, 1 para 3º, 1 por vitória
  await pool.query(`
    INSERT INTO regras_pontuacao (evento_id, pontos_primeiro, pontos_segundo, pontos_terceiro, pontos_vitoria, bye_pontua)
    VALUES ($1, 9, 3, 1, 1, false)
    ON CONFLICT (evento_id) DO UPDATE
    SET pontos_primeiro = 9, pontos_segundo = 3, pontos_terceiro = 1, pontos_vitoria = 1, bye_pontua = false;
  `, [evento.id]);

  // 2. Buscar Faixa existente
  const { rows: [faixa] } = await pool.query(`
    SELECT id FROM faixas ORDER BY ordem LIMIT 1;
  `);

  // 3. Criar Equipes
  const { rows: [equipeA] } = await pool.query(`
    INSERT INTO equipes (nome)
    VALUES ('Equipe F15 Alpha ${ts}')
    RETURNING *;
  `);
  const { rows: [equipeB] } = await pool.query(`
    INSERT INTO equipes (nome)
    VALUES ('Equipe F15 Beta ${ts}')
    RETURNING *;
  `);

  // 4. Criar Categoria
  const { rows: [categoria] } = await pool.query(`
    INSERT INTO categorias (evento_id, nome, faixa_minima_id, faixa_maxima_id, idade_minima, idade_maxima, peso_minimo, peso_maximo, sexo)
    VALUES ($1, 'Adulto Azul Leve', $2, $2, 18, 35, 60, 80, 'MASCULINO')
    RETURNING *;
  `, [evento.id, faixa.id]);

  // 5. Criar 4 Inscrições Confirmadas
  const { rows: [i1] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
    VALUES ($1, $2, $3, $4, 'Atleta Alpha 1', 25, 70, 'MASCULINO', 'CONFIRMADA', 1)
    RETURNING *;
  `, [evento.id, categoria.id, equipeA.id, faixa.id]);

  const { rows: [i2] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
    VALUES ($1, $2, $3, $4, 'Atleta Beta 1', 26, 72, 'MASCULINO', 'CONFIRMADA', 4)
    RETURNING *;
  `, [evento.id, categoria.id, equipeB.id, faixa.id]);

  const { rows: [i3] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
    VALUES ($1, $2, $3, $4, 'Atleta Alpha 2', 27, 71, 'MASCULINO', 'CONFIRMADA', 2)
    RETURNING *;
  `, [evento.id, categoria.id, equipeA.id, faixa.id]);

  const { rows: [i4] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
    VALUES ($1, $2, $3, $4, 'Atleta Beta 2', 28, 73, 'MASCULINO', 'CONFIRMADA', 3)
    RETURNING *;
  `, [evento.id, categoria.id, equipeB.id, faixa.id]);

  // 6. Gerar e Iniciar Chave de 4
  const { chave } = await chaveService.gerarChave(evento.id, categoria.id);
  await chaveService.iniciarChave(evento.id, chave.id);

  // Buscar lutas da chave
  const lutasIniciais = await lutaRepository.listarPorChave(chave.id);
  const semi1 = lutasIniciais.find((l) => l.rodada === 1 && l.posicao === 1);
  const semi2 = lutasIniciais.find((l) => l.rodada === 1 && l.posicao === 2);
  const finalLuta = lutasIniciais.find((l) => l.rodada === 2 && l.posicao === 1);

  // ==========================================
  // 3. TESTE: BLOQUEIO ANTES DE TODAS AS LUTAS FINALIZADAS
  // ==========================================
  console.log('\n--- 3. Bloqueio de finalização com lutas pendentes ---');

  const previewPendRes = await fetch(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}/finalizar`,
    {
      headers: { Cookie: sessionCookie },
      redirect: 'manual',
    }
  );
  assert(
    previewPendRes.status === 302,
    'Acesso à tela de prévia com lutas pendentes redireciona'
  );

  const { csrf: csrfChave } = await getCsrfToken(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}`
  );
  const postPendRes = await fetch(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}/finalizar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: csrfChave }).toString(),
      redirect: 'manual',
    }
  );
  assert(
    postPendRes.status === 302,
    'POST finalizar com lutas pendentes é bloqueado e redireciona'
  );

  // ==========================================
  // 4. LANÇAMENTO DAS SEMIFINAIS E FINAL
  // ==========================================
  console.log('\n--- 4. Lançamento das Semifinais e Final ---');

  // Lançar Semi 1: competidor 1 vence competidor 2
  await resultadoService.lancarResultado(evento.id, chave.id, semi1.id, {
    vencedor_id: semi1.competidor_1_id,
    tipo_resultado: 'FINALIZACAO',
  });

  // Lançar Semi 2: competidor 2 vence competidor 1
  await resultadoService.lancarResultado(evento.id, chave.id, semi2.id, {
    vencedor_id: semi2.competidor_2_id,
    tipo_resultado: 'FINALIZACAO',
  });

  // Verificar que a final ainda não está FINALIZADA
  const { html: htmlChaveAntesFinal } = await getCsrfToken(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}`
  );
  assert(
    !htmlChaveAntesFinal.includes('Finalizar categoria'),
    'Botão "Finalizar categoria" NÃO aparece enquanto a final estiver pendente'
  );

  // Lançar a Final
  const finalPronta = await lutaRepository.buscarPorId(finalLuta.id);
  await resultadoService.lancarResultado(evento.id, chave.id, finalPronta.id, {
    vencedor_id: finalPronta.competidor_1_id,
    tipo_resultado: 'FINALIZACAO',
  });

  // ==========================================
  // 5. TESTE: BOTÃO DE FINALIZAR E TELA DE PRÉVIA (LEITURA PURA)
  // ==========================================
  console.log('\n--- 5. Botão "Finalizar categoria" e Tela de Prévia (Sem Efeitos Colaterais) ---');

  const { html: htmlChaveAposFinal } = await getCsrfToken(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}`
  );
  assert(
    htmlChaveAposFinal.includes('Finalizar categoria'),
    'Botão "Finalizar categoria" APARECE quando todas as lutas estão finalizadas'
  );

  const { status: statusPreview, html: htmlPreview } = await getCsrfToken(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}/finalizar`
  );
  assert(statusPreview === 200, 'Tela de prévia acessada com HTTP 200');
  assert(htmlPreview.includes('Finalizar categoria'), 'Página de prévia contém título "Finalizar categoria"');
  assert(htmlPreview.includes('Pódio Previsto'), 'Página de prévia contém seção de pódio');
  assert(htmlPreview.includes('1º lugar'), 'Página de prévia contém 1º lugar');
  assert(htmlPreview.includes('2º lugar'), 'Página de prévia contém 2º lugar');
  assert(htmlPreview.includes('3º lugar'), 'Página de prévia contém 3º lugar');
  assert(htmlPreview.includes('+9'), 'Página de prévia exibe +9 pontos para o 1º lugar');
  assert(htmlPreview.includes('+3'), 'Página de prévia exibe +3 pontos para o 2º lugar');
  assert(htmlPreview.includes('+1'), 'Página de prévia exibe +1 ponto para o 3º lugar');
  assert(htmlPreview.includes('Resumo de Pontuação por Equipe'), 'Página de prévia exibe tabela de equipes');

  // Confirmar que o banco de dados NÃO sofreu alterações no GET
  const { rows: [chaveBancoAposPreview] } = await pool.query(
    'SELECT * FROM chaves WHERE id = $1',
    [chave.id]
  );
  assert(
    chaveBancoAposPreview.status === 'EM_ANDAMENTO',
    'Abertura da prévia NÃO altera status da chave (continua EM_ANDAMENTO)'
  );
  assert(
    chaveBancoAposPreview.primeiro_lugar_id === null &&
    chaveBancoAposPreview.segundo_lugar_id === null &&
    chaveBancoAposPreview.terceiro_lugar_id === null,
    'Abertura da prévia NÃO salva colocados no banco de dados'
  );

  const { rows: pontosColocacaoAposPreview } = await pool.query(`
    SELECT * FROM pontos_equipes
    WHERE chave_id = $1 AND tipo IN ('PRIMEIRO_LUGAR', 'SEGUNDO_LUGAR', 'TERCEIRO_LUGAR');
  `, [chave.id]);
  assert(
    pontosColocacaoAposPreview.length === 0,
    'Abertura da prévia NÃO insere nenhum ponto de colocação no banco'
  );

  // ==========================================
  // 6. TESTE: CONFIRMAÇÃO DE FINALIZAÇÃO (POST)
  // ==========================================
  console.log('\n--- 6. Confirmação de Finalização (POST) ---');

  const { csrf: csrfPreview } = await getCsrfToken(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}/finalizar`
  );

  const postFinalizarRes = await fetch(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}/finalizar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: csrfPreview }).toString(),
      redirect: 'manual',
    }
  );

  assert(
    postFinalizarRes.status === 302,
    'POST finalizar redireciona com sucesso após confirmação'
  );

  const { rows: [chaveFinalizada] } = await pool.query(
    'SELECT * FROM chaves WHERE id = $1',
    [chave.id]
  );

  assert(
    chaveFinalizada.status === 'FINALIZADA',
    'Chave transicionou para status FINALIZADA'
  );
  assert(
    chaveFinalizada.primeiro_lugar_id !== null,
    '1º lugar preenchido na chave'
  );
  assert(
    chaveFinalizada.segundo_lugar_id !== null,
    '2º lugar preenchido na chave'
  );
  assert(
    chaveFinalizada.terceiro_lugar_id !== null,
    '3º lugar preenchido na chave'
  );
  assert(
    chaveFinalizada.primeiro_lugar_id !== chaveFinalizada.segundo_lugar_id &&
    chaveFinalizada.primeiro_lugar_id !== chaveFinalizada.terceiro_lugar_id &&
    chaveFinalizada.segundo_lugar_id !== chaveFinalizada.terceiro_lugar_id,
    '1º, 2º e 3º lugares são atletas distintos'
  );

  const { rows: pontosColocacao } = await pool.query(`
    SELECT * FROM pontos_equipes
    WHERE chave_id = $1 AND tipo IN ('PRIMEIRO_LUGAR', 'SEGUNDO_LUGAR', 'TERCEIRO_LUGAR')
    ORDER BY tipo;
  `, [chave.id]);

  assert(
    pontosColocacao.length === 3,
    'Foram criados exatamente 3 lançamentos de colocação em pontos_equipes'
  );

  const ponto1 = pontosColocacao.find((p) => p.tipo === 'PRIMEIRO_LUGAR');
  const ponto2 = pontosColocacao.find((p) => p.tipo === 'SEGUNDO_LUGAR');
  const ponto3 = pontosColocacao.find((p) => p.tipo === 'TERCEIRO_LUGAR');

  assert(ponto1 && ponto1.pontos === 9, 'Pontos do 1º lugar gravados como 9');
  assert(ponto2 && ponto2.pontos === 3, 'Pontos do 2º lugar gravados como 3');
  assert(ponto3 && ponto3.pontos === 1, 'Pontos do 3º lugar gravados como 1');

  const { rows: pontosVitoria } = await pool.query(`
    SELECT * FROM pontos_equipes
    WHERE chave_id = $1 AND tipo = 'VITORIA';
  `, [chave.id]);
  assert(
    pontosVitoria.length === 3,
    'Os 3 pontos de vitória (2 semis + 1 final) permanecem intactos'
  );

  // ==========================================
  // 7. TESTE: TELA DA CHAVE FINALIZADA E PROTEÇÃO DUPLA
  // ==========================================
  console.log('\n--- 7. Visualização da Chave Finalizada e Proteção contra Duplicação ---');

  const { html: htmlChaveFinalizada } = await getCsrfToken(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}`
  );

  assert(
    htmlChaveFinalizada.includes('Categoria finalizada'),
    'Página da chave exibe aviso de Categoria finalizada'
  );
  assert(
    htmlChaveFinalizada.includes('Pódio Oficial'),
    'Página da chave exibe Pódio Oficial'
  );
  assert(
    htmlChaveFinalizada.includes('Colocações calculadas automaticamente'),
    'Página da chave exibe legenda de cálculo automático'
  );
  assert(
    htmlChaveFinalizada.includes('Reabrir categoria'),
    'Página da chave exibe botão "Reabrir categoria"'
  );
  assert(
    !htmlChaveFinalizada.includes('Finalizar categoria'),
    'Botão "Finalizar categoria" não aparece em chave já finalizada'
  );

  // Tentativa de segunda finalização (duplo clique / concorrência)
  const { csrf: csrfSegundaFinalizacao } = await getCsrfToken(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}`
  );
  const postDuploRes = await fetch(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}/finalizar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: csrfSegundaFinalizacao }).toString(),
      redirect: 'manual',
    }
  );
  assert(
    postDuploRes.status === 302,
    'Tentativa de segunda finalização é rejeitada'
  );

  const { rows: pontosDuplicados } = await pool.query(`
    SELECT COUNT(*)::INTEGER as count FROM pontos_equipes
    WHERE chave_id = $1 AND tipo IN ('PRIMEIRO_LUGAR', 'SEGUNDO_LUGAR', 'TERCEIRO_LUGAR');
  `, [chave.id]);
  assert(
    pontosDuplicados[0].count === 3,
    'Pontos de colocação NÃO foram duplicados'
  );

  // ==========================================
  // 8. TESTE: REABERTURA DE CATEGORIA
  // ==========================================
  console.log('\n--- 8. Reabertura de Categoria Finalizada ---');

  const { csrf: csrfReabrir } = await getCsrfToken(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}`
  );

  const postReabrirRes = await fetch(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}/reabrir`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: csrfReabrir }).toString(),
      redirect: 'manual',
    }
  );

  assert(
    postReabrirRes.status === 302,
    'POST reabrir redireciona com sucesso'
  );

  const { rows: [chaveReaberta] } = await pool.query(
    'SELECT * FROM chaves WHERE id = $1',
    [chave.id]
  );
  assert(
    chaveReaberta.status === 'EM_ANDAMENTO',
    'Status da chave voltou para EM_ANDAMENTO'
  );
  assert(
    chaveReaberta.primeiro_lugar_id === null &&
    chaveReaberta.segundo_lugar_id === null &&
    chaveReaberta.terceiro_lugar_id === null,
    'Pódio foi completamente limpo da chave'
  );

  const { rows: pontosAposReabrir } = await pool.query(`
    SELECT * FROM pontos_equipes
    WHERE chave_id = $1 AND tipo IN ('PRIMEIRO_LUGAR', 'SEGUNDO_LUGAR', 'TERCEIRO_LUGAR');
  `, [chave.id]);
  assert(
    pontosAposReabrir.length === 0,
    'Todos os pontos de colocação foram removidos do banco'
  );

  const { rows: vitoriasAposReabrir } = await pool.query(`
    SELECT * FROM pontos_equipes
    WHERE chave_id = $1 AND tipo = 'VITORIA';
  `, [chave.id]);
  assert(
    vitoriasAposReabrir.length === 3,
    'Pontos de vitória continuam intactos após reabertura'
  );

  // Tentativa de reabrir chave que já está EM_ANDAMENTO
  const postReabrirInvalidoRes = await fetch(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}/reabrir`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: csrfReabrir }).toString(),
      redirect: 'manual',
    }
  );
  assert(
    postReabrirInvalidoRes.status === 302,
    'Tentativa de reabrir chave não finalizada é rejeitada'
  );

  // ==========================================
  // 9. TESTE: CORREÇÃO DA FINAL E REFINALIZAÇÃO (INTEGRAÇÃO FASE 14)
  // ==========================================
  console.log('\n--- 9. Correção de Resultado e Refinalização ---');

  const novoVencedorId = finalPronta.competidor_2_id;
  await resultadoService.corrigirResultado(evento.id, chave.id, finalPronta.id, {
    vencedor_id: novoVencedorId,
    tipo_resultado: 'FINALIZACAO',
  });

  const { csrf: csrfRefinalizar } = await getCsrfToken(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}/finalizar`
  );
  await fetch(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave.id}/finalizar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: csrfRefinalizar }).toString(),
      redirect: 'manual',
    }
  );

  const { rows: [chaveRefinalizada] } = await pool.query(
    'SELECT * FROM chaves WHERE id = $1',
    [chave.id]
  );
  assert(
    chaveRefinalizada.status === 'FINALIZADA',
    'Chave refinalizada com sucesso'
  );
  assert(
    chaveRefinalizada.primeiro_lugar_id === novoVencedorId,
    'Novo campeão registrado como 1º lugar após correção'
  );

  // ==========================================
  // 10. TESTE: CHAVE DE 2 COMPETIDORES (SEM TERCEIRO LUGAR)
  // ==========================================
  console.log('\n--- 10. Chave de 2 competidores (sem terceiro lugar) ---');

  const { rows: [cat2] } = await pool.query(`
    INSERT INTO categorias (evento_id, nome, faixa_minima_id, faixa_maxima_id, idade_minima, idade_maxima, peso_minimo, peso_maximo, sexo)
    VALUES ($1, 'Master Azul Pesado', $2, $2, 30, 99, 80, 120, 'MASCULINO')
    RETURNING *;
  `, [evento.id, faixa.id]);

  const { rows: [i2_1] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
    VALUES ($1, $2, $3, $4, 'Competidor 1 Chave 2', 32, 85, 'MASCULINO', 'CONFIRMADA', 1)
    RETURNING *;
  `, [evento.id, cat2.id, equipeA.id, faixa.id]);

  const { rows: [i2_2] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
    VALUES ($1, $2, $3, $4, 'Competidor 2 Chave 2', 33, 88, 'MASCULINO', 'CONFIRMADA', 2)
    RETURNING *;
  `, [evento.id, cat2.id, equipeB.id, faixa.id]);

  const { chave: chave2 } = await chaveService.gerarChave(evento.id, cat2.id);
  await chaveService.iniciarChave(evento.id, chave2.id);

  const lutasChave2 = await lutaRepository.listarPorChave(chave2.id);
  assert(lutasChave2.length === 1, 'Chave de 2 competidores possui exatamente 1 luta (final na rodada 1)');

  await resultadoService.lancarResultado(evento.id, chave2.id, lutasChave2[0].id, {
    vencedor_id: i2_1.id,
    tipo_resultado: 'FINALIZACAO',
  });

  const { html: htmlPreview2 } = await getCsrfToken(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave2.id}/finalizar`
  );
  assert(
    htmlPreview2.includes('Não haverá terceiro lugar nesta categoria'),
    'Prévia da chave de 2 exibe mensagem informando ausência de terceiro lugar'
  );

  const { csrf: csrfChave2 } = await getCsrfToken(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave2.id}/finalizar`
  );
  await fetch(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave2.id}/finalizar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: csrfChave2 }).toString(),
      redirect: 'manual',
    }
  );

  const { rows: [chave2Finalizada] } = await pool.query(
    'SELECT * FROM chaves WHERE id = $1',
    [chave2.id]
  );
  assert(
    chave2Finalizada.status === 'FINALIZADA',
    'Chave de 2 finalizada com sucesso'
  );
  assert(
    chave2Finalizada.primeiro_lugar_id === i2_1.id,
    '1º lugar da chave de 2 registrado corretamente'
  );
  assert(
    chave2Finalizada.segundo_lugar_id === i2_2.id,
    '2º lugar da chave de 2 registrado corretamente'
  );
  assert(
    chave2Finalizada.terceiro_lugar_id === null,
    '3º lugar da chave de 2 é NULL'
  );

  const { rows: pontosChave2 } = await pool.query(`
    SELECT * FROM pontos_equipes WHERE chave_id = $1 AND tipo = 'TERCEIRO_LUGAR';
  `, [chave2.id]);
  assert(
    pontosChave2.length === 0,
    'Nenhum ponto de terceiro lugar lançado para chave de 2'
  );

  // ==========================================
  // 11. TESTE: CASO ESPECIAL DE BYE NA SEMIFINAL (CHAVE DE 3)
  // ==========================================
  console.log('\n--- 11. Caso Especial: Campeão avançou por BYE na semifinal (Chave de 3) ---');

  const { rows: [cat3] } = await pool.query(`
    INSERT INTO categorias (evento_id, nome, faixa_minima_id, faixa_maxima_id, idade_minima, idade_maxima, peso_minimo, peso_maximo, sexo)
    VALUES ($1, 'Master Azul Superpesado', $2, $2, 30, 99, 80, 130, 'MASCULINO')
    RETURNING *;
  `, [evento.id, faixa.id]);

  const { rows: [i3_1] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
    VALUES ($1, $2, $3, $4, 'Atleta Bye Campeão', 31, 90, 'MASCULINO', 'CONFIRMADA', 1)
    RETURNING *;
  `, [evento.id, cat3.id, equipeA.id, faixa.id]);

  const { rows: [i3_2] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
    VALUES ($1, $2, $3, $4, 'Atleta Luta Semi 1', 32, 91, 'MASCULINO', 'CONFIRMADA', 2)
    RETURNING *;
  `, [evento.id, cat3.id, equipeB.id, faixa.id]);

  const { rows: [i3_3] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
    VALUES ($1, $2, $3, $4, 'Atleta Luta Semi 2', 33, 92, 'MASCULINO', 'CONFIRMADA', 3)
    RETURNING *;
  `, [evento.id, cat3.id, equipeA.id, faixa.id]);

  const { chave: chave3 } = await chaveService.gerarChave(evento.id, cat3.id);
  await chaveService.iniciarChave(evento.id, chave3.id);

  const lutasChave3 = await lutaRepository.listarPorChave(chave3.id);
  const semiBye = lutasChave3.find((l) => l.rodada === 1 && l.tipo_resultado === 'BYE');
  const semiDisputada = lutasChave3.find((l) => l.rodada === 1 && l.tipo_resultado !== 'BYE');
  const finalChave3 = lutasChave3.find((l) => l.rodada === 2);

  assert(Boolean(semiBye), 'Chave de 3 possui uma semifinal finalizada como BYE');
  assert(Boolean(semiDisputada), 'Chave de 3 possui uma semifinal disputada');

  const campeaoByeId = semiBye.vencedor_id;

  // Lançar a semifinal disputada: competidor 1 vence competidor 2
  await resultadoService.lancarResultado(evento.id, chave3.id, semiDisputada.id, {
    vencedor_id: semiDisputada.competidor_1_id,
    tipo_resultado: 'FINALIZACAO',
  });

  const perdedorSemiDisputadaId = semiDisputada.competidor_2_id;

  // Lançar a final: o atleta que veio por BYE é campeão!
  await resultadoService.lancarResultado(evento.id, chave3.id, finalChave3.id, {
    vencedor_id: campeaoByeId,
    tipo_resultado: 'FINALIZACAO',
  });

  // Finalizar a chave de 3
  const { csrf: csrfChave3 } = await getCsrfToken(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave3.id}/finalizar`
  );
  await fetch(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave3.id}/finalizar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({ _csrf: csrfChave3 }).toString(),
      redirect: 'manual',
    }
  );

  const { rows: [chave3Finalizada] } = await pool.query(
    'SELECT * FROM chaves WHERE id = $1',
    [chave3.id]
  );
  assert(
    chave3Finalizada.primeiro_lugar_id === campeaoByeId,
    'Campeão que avançou por BYE foi coroado 1º lugar'
  );
  assert(
    chave3Finalizada.terceiro_lugar_id === perdedorSemiDisputadaId,
    'Fallback de BYE: 3º lugar atribuído corretamente ao perdedor da outra semifinal'
  );

  // ==========================================
  // 12. TESTE: SEGURANÇA E CSRF
  // ==========================================
  console.log('\n--- 12. Segurança e CSRF ---');

  const postSemCsrfFinalizar = await fetch(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave3.id}/finalizar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({}).toString(),
      redirect: 'manual',
    }
  );
  assert(
    postSemCsrfFinalizar.status === 403,
    'Tentativa de POST finalizar sem CSRF retorna 403'
  );

  const postSemCsrfReabrir = await fetch(
    `http://localhost:3000/eventos/${evento.id}/chaves/${chave3.id}/reabrir`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sessionCookie },
      body: new URLSearchParams({}).toString(),
      redirect: 'manual',
    }
  );
  assert(
    postSemCsrfReabrir.status === 403,
    'Tentativa de POST reabrir sem CSRF retorna 403'
  );

  // ==========================================
  // LIMPEZA FINAL E RESULTADOS
  // ==========================================
  await cleanup();

  console.log(`\n==========================================`);
  console.log(`Bateria Fase 15 Finalizada: ${passedCount}/${testCount} testes passaram com sucesso!`);
  console.log(`==========================================\n`);

  if (passedCount !== testCount) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Erro fatal nos testes:', e);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
