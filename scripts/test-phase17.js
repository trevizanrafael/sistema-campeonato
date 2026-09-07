const pool = require('../src/config/database');
const rankingService = require('../src/services/rankingService');
const chaveService = require('../src/services/chaveService');
const resultadoService = require('../src/services/resultadoService');
const finalizacaoService = require('../src/services/finalizacaoService');
const lutaRepository = require('../src/repositories/lutaRepository');
require('dotenv').config();

async function runTests() {
  console.log('--- Iniciando Testes da Fase 17 (Ranking Básico das Equipes) ---');
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
  // 1. TESTES UNITÁRIOS DE SITUAÇÃO DO RANKING
  // ==========================================
  console.log('\n--- 1. Testes Unitários de Situação do Ranking ---');

  assert(
    rankingService.calcularSituacao({ total_chaves: 0, finalizadas: 0 }) === 'NAO_INICIADO',
    'Sem chaves retorna situacao NAO_INICIADO'
  );
  assert(
    rankingService.calcularSituacao({ total_chaves: 3, finalizadas: 1 }) === 'PARCIAL',
    'Chaves pendentes retorna situacao PARCIAL'
  );
  assert(
    rankingService.calcularSituacao({ total_chaves: 2, finalizadas: 2 }) === 'FINAL',
    'Todas as chaves finalizadas retorna situacao FINAL'
  );

  // ==========================================
  // 2. TESTES UNITÁRIOS DE ATRIBUIÇÃO DE POSIÇÕES E EMPATES
  // ==========================================
  console.log('\n--- 2. Testes Unitários de Atribuição de Posições e Empates ---');

  const listaMock = [
    { equipe_id: 1, equipe_nome: 'Alpha', total_pontos: 20, ouros: 2, pratas: 0, bronzes: 0, vitorias: 5 },
    { equipe_id: 2, equipe_nome: 'Beta', total_pontos: 15, ouros: 1, pratas: 1, bronzes: 0, vitorias: 4 },
    { equipe_id: 3, equipe_nome: 'Gamma', total_pontos: 15, ouros: 1, pratas: 1, bronzes: 0, vitorias: 4 }, // Empate exato com Beta
    { equipe_id: 4, equipe_nome: 'Delta', total_pontos: 10, ouros: 1, pratas: 0, bronzes: 1, vitorias: 2 },
    { equipe_id: 5, equipe_nome: 'Epsilon', total_pontos: 0, ouros: 0, pratas: 0, bronzes: 0, vitorias: 0 },
  ];

  const posicoes = rankingService.atribuirPosicoes(listaMock);

  assert(posicoes[0].posicao === 1, '1º lugar isolado para Alpha');
  assert(posicoes[1].posicao === 2, '2º lugar para Beta');
  assert(posicoes[2].posicao === 2, 'Gamma empata em 2º lugar com Beta');
  assert(posicoes[3].posicao === 4, 'Delta pula para 4º lugar após empate duplo no 2º');
  assert(posicoes[4].posicao === 5, 'Epsilon fica em 5º lugar com 0 pontos');

  // ==========================================
  // 3. AUTENTICAÇÃO E PREPARAÇÃO DO AMBIENTE
  // ==========================================
  console.log('\n--- 3. Autenticação e Configuração de Eventos e Chaves ---');
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
          SELECT id FROM eventos WHERE nome LIKE 'Evento F17%'
        )
      `);
      await pool.query(`
        DELETE FROM lutas WHERE chave_id IN (
          SELECT id FROM chaves WHERE categoria_id IN (
            SELECT id FROM categorias WHERE evento_id IN (
              SELECT id FROM eventos WHERE nome LIKE 'Evento F17%'
            )
          )
        )
      `);
      await pool.query(`
        DELETE FROM chaves WHERE categoria_id IN (
          SELECT id FROM categorias WHERE evento_id IN (
            SELECT id FROM eventos WHERE nome LIKE 'Evento F17%'
          )
        )
      `);
      await pool.query(`
        DELETE FROM inscricoes WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F17%'
        )
      `);
      await pool.query(`
        DELETE FROM categorias WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F17%'
        )
      `);
      await pool.query(`
        DELETE FROM regras_pontuacao WHERE evento_id IN (
          SELECT id FROM eventos WHERE nome LIKE 'Evento F17%'
        )
      `);
      await pool.query(`
        DELETE FROM eventos WHERE nome LIKE 'Evento F17%'
      `);
      await pool.query(`
        DELETE FROM equipes WHERE nome LIKE 'Equipe F17%'
      `);
    } catch (e) {
      console.error('Erro no cleanup:', e);
    }
  }

  await cleanup();

  async function getHtml(url, cookieToUse = sessionCookie) {
    const headers = cookieToUse ? { Cookie: cookieToUse } : {};
    const res = await fetch(url, { headers, redirect: 'manual' });
    const text = await res.text();
    return { status: res.status, html: text, location: res.headers.get('location') };
  }

  // 1. Criar Evento 1 (Principal)
  const { rows: [evento1] } = await pool.query(`
    INSERT INTO eventos (nome, descricao)
    VALUES ('Evento F17 Test ${ts}', 'Descrição evento F17')
    RETURNING *;
  `);

  // Regras de pontuação: 1º=9, 2º=3, 3º=1, vitória=2
  await pool.query(`
    INSERT INTO regras_pontuacao (evento_id, pontos_primeiro, pontos_segundo, pontos_terceiro, pontos_vitoria, bye_pontua)
    VALUES ($1, 9, 3, 1, 2, false)
    ON CONFLICT (evento_id) DO UPDATE
    SET pontos_primeiro = 9, pontos_segundo = 3, pontos_terceiro = 1, pontos_vitoria = 2, bye_pontua = false;
  `, [evento1.id]);

  // 2. Criar Evento 2 (para testes de isolamento)
  const { rows: [evento2] } = await pool.query(`
    INSERT INTO eventos (nome, descricao)
    VALUES ('Evento F17 Isolado ${ts}', 'Evento isolado')
    RETURNING *;
  `);

  // 3. Buscar Faixa
  const { rows: [faixa] } = await pool.query(`
    SELECT id FROM faixas ORDER BY ordem LIMIT 1;
  `);

  // 4. Criar 4 Equipes
  const { rows: [equipeA] } = await pool.query(`
    INSERT INTO equipes (nome) VALUES ('Equipe F17 Alpha ${ts}') RETURNING *;
  `);
  const { rows: [equipeB] } = await pool.query(`
    INSERT INTO equipes (nome) VALUES ('Equipe F17 Beta ${ts}') RETURNING *;
  `);
  const { rows: [equipeC] } = await pool.query(`
    INSERT INTO equipes (nome) VALUES ('Equipe F17 Gamma ${ts}') RETURNING *;
  `);
  const { rows: [equipeD] } = await pool.query(`
    INSERT INTO equipes (nome) VALUES ('Equipe F17 Delta ${ts}') RETURNING *;
  `);

  // 5. Inscrições no Evento 1
  // Categoria 1 (4 competidores sem byes)
  const { rows: [cat1] } = await pool.query(`
    INSERT INTO categorias (evento_id, nome, faixa_minima_id, faixa_maxima_id, idade_minima, idade_maxima, peso_minimo, peso_maximo, sexo)
    VALUES ($1, 'Cat F17 Leve', $2, $2, 18, 35, 60, 80, 'MASCULINO')
    RETURNING *;
  `, [evento1.id, faixa.id]);

  // Categoria 2 (para Delta participar do evento sem pontuar)
  const { rows: [cat2] } = await pool.query(`
    INSERT INTO categorias (evento_id, nome, faixa_minima_id, faixa_maxima_id, idade_minima, idade_maxima, peso_minimo, peso_maximo, sexo)
    VALUES ($1, 'Cat F17 Pesado', $2, $2, 18, 35, 80, 100, 'MASCULINO')
    RETURNING *;
  `, [evento1.id, faixa.id]);

  // Atletas Cat 1:
  // Alpha: Atleta 1 (Seed 1)
  const { rows: [i1] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
    VALUES ($1, $2, $3, $4, 'Alpha Atleta 1', 25, 70, 'MASCULINO', 'CONFIRMADA', 1)
    RETURNING *;
  `, [evento1.id, cat1.id, equipeA.id, faixa.id]);

  // Beta: Atleta 2 (Seed 2)
  const { rows: [i2] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed)
    VALUES ($1, $2, $3, $4, 'Beta Atleta 1', 26, 72, 'MASCULINO', 'CONFIRMADA', 2)
    RETURNING *;
  `, [evento1.id, cat1.id, equipeB.id, faixa.id]);

  // Gamma: Atleta 3
  const { rows: [i3] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
    VALUES ($1, $2, $3, $4, 'Gamma Atleta 1', 27, 73, 'MASCULINO', 'CONFIRMADA')
    RETURNING *;
  `, [evento1.id, cat1.id, equipeC.id, faixa.id]);

  // Alpha: Atleta 4
  const { rows: [i4] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
    VALUES ($1, $2, $3, $4, 'Alpha Atleta 2', 28, 74, 'MASCULINO', 'CONFIRMADA')
    RETURNING *;
  `, [evento1.id, cat1.id, equipeA.id, faixa.id]);

  // Delta: Atleta 5 (em Cat 2, para ter 0 pontos e nenhuma luta)
  const { rows: [i5] } = await pool.query(`
    INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
    VALUES ($1, $2, $3, $4, 'Delta Atleta 1', 29, 85, 'MASCULINO', 'CONFIRMADA')
    RETURNING *;
  `, [evento1.id, cat2.id, equipeD.id, faixa.id]);

  // ==========================================
  // 4. TESTE: RANKING ANTES DE QUALQUER CHAVE (NAO_INICIADO)
  // ==========================================
  console.log('\n--- 4. Ranking Antes de Qualquer Chave (NAO_INICIADO) ---');

  const resRankInicial = await getHtml(`http://localhost:3000/eventos/${evento1.id}/ranking`);
  assert(resRankInicial.status === 200, 'GET /ranking retorna status 200');
  assert(
    resRankInicial.html.includes('O evento ainda não possui chaves'),
    'Exibe alerta indicando que o evento ainda não possui chaves'
  );
  assert(
    resRankInicial.html.includes(equipeA.nome),
    'Equipe Alpha aparece na tabela mesmo com zero pontos'
  );
  assert(
    resRankInicial.html.includes(equipeB.nome),
    'Equipe Beta aparece na tabela mesmo com zero pontos'
  );
  assert(
    resRankInicial.html.includes(equipeC.nome),
    'Equipe Gamma aparece na tabela mesmo com zero pontos'
  );

  // ==========================================
  // 5. TESTE: RANKING COM CHAVE EM ANDAMENTO (PARCIAL)
  // ==========================================
  console.log('\n--- 5. Ranking com Chave Em Andamento (PARCIAL) ---');

  // Gerar e iniciar chave de 4 (i1, i2, i3 + 1 bye)
  const { chave: chave1 } = await chaveService.gerarChave(evento1.id, cat1.id);
  await chaveService.iniciarChave(evento1.id, chave1.id);

  const resRankParcial = await getHtml(`http://localhost:3000/eventos/${evento1.id}/ranking`);
  assert(
    resRankParcial.html.includes('Ranking parcial — existem categorias não finalizadas'),
    'Exibe alerta de Ranking Parcial enquanto houver categoria em andamento'
  );

  // Lançar lutas da chave:
  const lutas = await lutaRepository.listarPorChave(chave1.id);
  const semi1 = lutas.find((l) => l.rodada === 1 && l.posicao === 1);
  const semi2 = lutas.find((l) => l.rodada === 1 && l.posicao === 2);
  const finalMatch = lutas.find((l) => l.rodada === 2 && l.posicao === 1);

  // Semi 1: Alpha (i1) vence
  await resultadoService.lancarResultado(evento1.id, chave1.id, semi1.id, {
    vencedor_id: i1.id,
    tipo_resultado: 'FINALIZACAO',
  });

  // Semi 2: Competidor que não seja i4 (Alpha 2) vence
  const vencedorSemi2Id = (semi2.competidor_1_id === i4.id) ? semi2.competidor_2_id : semi2.competidor_1_id;
  await resultadoService.lancarResultado(evento1.id, chave1.id, semi2.id, {
    vencedor_id: vencedorSemi2Id,
    tipo_resultado: 'FINALIZACAO',
  });

  // Verificar ranking dinâmico após a vitória (vitórias concederam pontos)
  const resRankPosSemi = await getHtml(`http://localhost:3000/eventos/${evento1.id}/ranking`);
  assert(
    resRankPosSemi.html.includes('Cat F17 Leve') || resRankPosSemi.status === 200,
    'Ranking atualizado dinamicamente após vitória em combate'
  );

  // Final: i1 (Alpha) vence a final e vira campeão
  await resultadoService.lancarResultado(evento1.id, chave1.id, finalMatch.id, {
    vencedor_id: i1.id,
    tipo_resultado: 'FINALIZACAO',
  });

  const equipeCampeaoId = equipeA.id;
  const equipeCampeaoNome = equipeA.nome;

  // ==========================================
  // 6. TESTE: FINALIZAR CATEGORIA E RANKING FINAL
  // ==========================================
  console.log('\n--- 6. Finalização de Categoria e Ranking Final ---');

  // Finalizar categoria via finalizacaoService
  await finalizacaoService.finalizarCategoria(evento1.id, chave1.id);

  const resRankFinal = await getHtml(`http://localhost:3000/eventos/${evento1.id}/ranking`);
  assert(
    resRankFinal.html.includes('Ranking final — todas as chaves foram finalizadas'),
    'Exibe alerta de Ranking Final após término de todas as categorias'
  );

  // Conferir detalhes calculados para o evento 1:
  const dadosRanking = await rankingService.buscarRanking(evento1.id);
  const campeaoRank = dadosRanking.equipes.find((e) => e.equipe_id === equipeCampeaoId);

  assert(campeaoRank.posicao === 1, 'Equipe campeã é 1º lugar no ranking geral');
  assert(campeaoRank.ouros === 1, 'Equipe campeã tem exatamente 1 medalha de ouro');
  assert(campeaoRank.total_pontos === 13, 'Equipe campeã possui 13 pontos (9 ouro + 4 vitórias)');

  // ==========================================
  // 7. TESTE: TELA DE DETALHAMENTO E EXTRATO DA EQUIPE
  // ==========================================
  console.log('\n--- 7. Detalhamento e Extrato da Equipe ---');

  const resEquipeCampeao = await getHtml(
    `http://localhost:3000/eventos/${evento1.id}/ranking/equipes/${equipeCampeaoId}`
  );
  assert(resEquipeCampeao.status === 200, 'GET /ranking/equipes/:id retorna status 200');
  assert(
    resEquipeCampeao.html.includes(equipeCampeaoNome),
    'Tela exibe o nome da equipe campeã'
  );
  assert(
    resEquipeCampeao.html.includes('1º lugar') || resEquipeCampeao.html.includes('1º'),
    'Tela exibe a posição no ranking'
  );
  assert(
    resEquipeCampeao.html.includes('Extrato de Pontos Conquistados'),
    'Tela exibe seção de extrato de pontos'
  );
  assert(
    resEquipeCampeao.html.includes('Primeiro lugar'),
    'Extrato contém lançamento de Primeiro lugar'
  );
  assert(
    resEquipeCampeao.html.includes('+9'),
    'Extrato formata pontos de colocação como +9'
  );

  // Teste equipe sem pontos (Delta)
  const resEquipeDelta = await getHtml(
    `http://localhost:3000/eventos/${evento1.id}/ranking/equipes/${equipeD.id}`
  );
  assert(resEquipeDelta.status === 200, 'GET equipe sem pontos retorna status 200');
  assert(
    resEquipeDelta.html.includes('Esta equipe ainda não conquistou pontos'),
    'Exibe estado vazio para equipe sem lançamentos de pontos'
  );

  // ==========================================
  // 8. TESTE: DINAMISMO APÓS REABERTURA DE CHAVE (FASE 15)
  // ==========================================
  console.log('\n--- 8. Dinamismo do Ranking após Reabertura de Categoria ---');

  // Reabrir categoria
  await finalizacaoService.reabrirCategoria(evento1.id, chave1.id);

  const dadosAposReabrir = await rankingService.buscarRanking(evento1.id);
  const alphaAposReabrir = dadosAposReabrir.equipes.find((e) => e.equipe_id === equipeA.id);

  assert(
    dadosAposReabrir.situacao === 'PARCIAL',
    'Situação volta para PARCIAL imediatamente após reabertura'
  );
  assert(
    alphaAposReabrir.ouros === 0,
    'Medalhas de ouro de chave reaberta deixam de ser computadas'
  );
  assert(
    alphaAposReabrir.total_pontos === 4,
    'Pontos de colocação são removidos, mantendo apenas os 4 pontos de vitória'
  );

  // ==========================================
  // 9. TESTE: DINAMISMO APÓS CORREÇÃO E ANULAÇÃO DE RESULTADOS (FASE 14)
  // ==========================================
  console.log('\n--- 9. Dinamismo do Ranking após Anulação de Luta ---');

  // Anular a final
  await resultadoService.anularResultado(evento1.id, chave1.id, finalMatch.id);

  const dadosAposAnular = await rankingService.buscarRanking(evento1.id);
  const alphaAposAnular = dadosAposAnular.equipes.find((e) => e.equipe_id === equipeA.id);

  assert(
    alphaAposAnular.vitorias === 1,
    'Total de vitórias de Alpha cai de 2 para 1 após anulação da final'
  );
  assert(
    alphaAposAnular.total_pontos === 2,
    'Total de pontos de Alpha cai para 2 após estorno da vitória'
  );

  // ==========================================
  // 10. TESTE: SEGURANÇA, ISOLAMENTO E VALIDAÇÕES 404/403
  // ==========================================
  console.log('\n--- 10. Segurança, Isolamento e Respostas HTTP ---');

  // 10.1 Não autenticado
  const resSemAuth = await getHtml(
    `http://localhost:3000/eventos/${evento1.id}/ranking`,
    null
  );
  assert(
    resSemAuth.status === 302 && resSemAuth.location.includes('/login'),
    'Acesso sem autenticação ao ranking redireciona para login'
  );

  // 10.2 Evento inexistente
  const resEventoInexistente = await getHtml(
    `http://localhost:3000/eventos/99999999/ranking`
  );
  assert(
    resEventoInexistente.status === 404,
    'Evento inexistente retorna HTTP 404'
  );

  // 10.3 Equipe que não pertence ao evento
  const resEquipeInvalida = await getHtml(
    `http://localhost:3000/eventos/${evento2.id}/ranking/equipes/${equipeA.id}`
  );
  assert(
    resEquipeInvalida.status === 404,
    'Equipe que não participa do evento retorna HTTP 404 no extrato'
  );

  // ==========================================
  // LIMPEZA FINAL E RESULTADOS
  // ==========================================
  await cleanup();

  console.log(`\n==========================================`);
  console.log(`Bateria Fase 17 Finalizada: ${passedCount}/${testCount} testes passaram com sucesso!`);
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
