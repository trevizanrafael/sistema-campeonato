/**
 * Script de Simulação de Campeonato de Jiu-Jitsu com Dados 100% Reais (IBJJF)
 * 
 * Limpa o banco de dados atual (com confirmação no terminal) e gera uma
 * simulação completa e realista de torneio com:
 * - 15 equipes consagradas do Jiu-Jitsu mundial
 * - 12 categorias cobrindo todas as 5 faixas (Branca, Azul, Roxa, Marrom e Preta)
 * - 55+ atletas reais com nomes, pesos, idades e graduações autênticas
 * - 8 chaves de categorias geradas (status: NAO_INICIADA, sem nada iniciado ainda)
 * - 4 categorias prontas aguardando geração de chaves (para testar o fluxo no painel)
 * - 1 Chave Rápida GP Desafio Superluta (4 atletas de elite, chave gerada e pronta)
 * 
 * Uso:
 *   npm run simular
 *   npm run simular -- --force   (pula confirmação interativa)
 */

require('dotenv').config({ quiet: true });
const readline = require('readline');
const bcrypt = require('bcrypt');
const pool = require('../src/config/database');
const chaveService = require('../src/services/chaveService');
const chaveRapidaService = require('../src/services/chaveRapidaService');

// ---------------------------------------------------------------------------
// 1. Confirmação no Terminal
// ---------------------------------------------------------------------------
async function confirmarTerminal() {
  const bypass = process.argv.includes('--force') ||
                 process.argv.includes('-y') ||
                 process.argv.includes('-f');
  if (bypass) {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('');
    console.log('\x1b[33m%s\x1b[0m', '============================================================');
    console.log('\x1b[1m\x1b[36m%s\x1b[0m', '      🥋 SIMULAÇÃO DE CAMPEONATO (JIU-JITSU REAL) 🥋       ');
    console.log('\x1b[33m%s\x1b[0m', '============================================================');
    console.log('\x1b[31m%s\x1b[0m', '⚠️  ATENÇÃO:');
    console.log('   Esta ação irá LIMPAR COMPLETAMENTE o banco de dados atual:');
    console.log('   - Todos os campeonatos, categorias, inscrições e academias');
    console.log('   - Todas as chaves, lutas e registros de pontuação');
    console.log('   E criará um campeonato completo com dados reais da IBJJF');
    console.log('   (todas as 5 faixas, atletas reais e chaves prontas).');
    console.log('\x1b[33m%s\x1b[0m', '------------------------------------------------------------');

    rl.question('Deseja continuar e recriar o banco? (s/N): ', (resposta) => {
      rl.close();
      const limpo = (resposta || '').trim().toLowerCase();
      const confirmado = limpo === 's' || limpo === 'sim' || limpo === 'y' || limpo === 'yes';
      resolve(confirmado);
    });
  });
}

// ---------------------------------------------------------------------------
// 2. Limpeza do Banco de Dados
// ---------------------------------------------------------------------------
async function limparBanco(client) {
  // Desvincula referências que poderiam bloquear remoções
  await client.query('UPDATE usuarios SET ultimo_evento_id = NULL;');
  await client.query('UPDATE lutas SET proxima_luta_id = NULL;');

  // Exclusão ordenada respeitando chaves estrangeiras
  await client.query('DELETE FROM pontos_equipes;');
  await client.query('DELETE FROM lutas;');
  await client.query('DELETE FROM chaves;');
  await client.query('DELETE FROM inscricoes_chaves_rapidas;');
  await client.query('DELETE FROM chaves_rapidas;');
  await client.query('DELETE FROM logs_auditoria;');
  await client.query('DELETE FROM inscricoes;');
  await client.query('DELETE FROM categorias;');
  await client.query('DELETE FROM regras_pontuacao;');
  await client.query('DELETE FROM user_sessions;');
  await client.query('DELETE FROM eventos;');
  await client.query('DELETE FROM equipes;');

  // Reinicia as sequences de IDs para manter IDs previsíveis (começando em 1)
  const tabelas = [
    'eventos', 'categorias', 'equipes', 'inscricoes',
    'chaves', 'lutas', 'regras_pontuacao', 'pontos_equipes',
    'logs_auditoria', 'chaves_rapidas', 'inscricoes_chaves_rapidas',
  ];
  for (const tab of tabelas) {
    try {
      await client.query(`ALTER SEQUENCE IF EXISTS ${tab}_id_seq RESTART WITH 1;`);
    } catch (_) {}
    try {
      await client.query(`ALTER TABLE ${tab} ALTER COLUMN id RESTART WITH 1;`);
    } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// 3. Garantir Faixas Oficiais do Jiu-Jitsu
// ---------------------------------------------------------------------------
async function garantirFaixas(client) {
  const faixasPadrao = [
    { nome: 'Branca', ordem: 1 },
    { nome: 'Azul', ordem: 2 },
    { nome: 'Roxa', ordem: 3 },
    { nome: 'Marrom', ordem: 4 },
    { nome: 'Preta', ordem: 5 },
  ];

  for (const f of faixasPadrao) {
    await client.query(
      `INSERT INTO faixas (nome, ordem) VALUES ($1, $2)
       ON CONFLICT (ordem) DO UPDATE SET nome = EXCLUDED.nome`,
      [f.nome, f.ordem]
    );
  }

  const { rows } = await client.query('SELECT id, nome FROM faixas');
  const mapa = {};
  rows.forEach((r) => {
    mapa[r.nome.toLowerCase()] = r.id;
  });

  return (nome) => {
    const id = mapa[nome.toLowerCase()];
    if (!id) throw new Error(`Faixa "${nome}" não encontrada.`);
    return id;
  };
}

// ---------------------------------------------------------------------------
// 4. Garantir Usuário Administrador
// ---------------------------------------------------------------------------
async function garantirAdmin(client) {
  const adminEmail = (process.env.ADMIN_EMAIL || 'araujo@araujo.com').trim().toLowerCase();
  const adminSenha = process.env.ADMIN_PASSWORD || 'araujo';
  const adminNome = (process.env.ADMIN_NAME || 'Administrador').trim();

  const { rows } = await client.query(
    'SELECT id FROM usuarios WHERE LOWER(email) = $1',
    [adminEmail]
  );

  if (rows.length === 0) {
    const senhaHash = await bcrypt.hash(adminSenha, 12);
    const { rows: [novo] } = await client.query(
      `INSERT INTO usuarios (nome, email, senha_hash, ativo, cargo)
       VALUES ($1, $2, $3, TRUE, 'ADMINISTRADOR')
       RETURNING id`,
      [adminNome, adminEmail, senhaHash]
    );
    return novo.id;
  }

  const adminId = rows[0].id;
  await client.query(
    `UPDATE usuarios SET ativo = TRUE, cargo = 'ADMINISTRADOR' WHERE id = $1`,
    [adminId]
  );
  return adminId;
}

// ---------------------------------------------------------------------------
// 5. Lista de Academias / Equipes Reais
// ---------------------------------------------------------------------------
const EQUIPES_REAIS = [
  'Araújo JJ Team',
  'Alliance Jiu-Jitsu',
  'Atos Jiu-Jitsu',
  'Melqui Galvão Jiu-Jitsu',
  'Art of Jiu Jitsu (AOJ)',
  'Dream Art',
  'Checkmat',
  'Gracie Barra',
  'GFTeam',
  'Nova União',
  'Cicero Costha',
  'Fratres Brazilian Jiu-Jitsu',
  'B-Team Jiu-Jitsu',
  'Fight Sports',
  'Ribeiro Jiu-Jitsu',
];

// ---------------------------------------------------------------------------
// 6. Execução Principal da Simulação
// ---------------------------------------------------------------------------
async function simular() {
  const confirmado = await confirmarTerminal();
  if (!confirmado) {
    console.log('\n\x1b[33m%s\x1b[0m\n', '❌ Operação cancelada. O banco de dados NÃO foi alterado.');
    return;
  }

  console.log('\n\x1b[32m%s\x1b[0m', 'Iniciando simulação de campeonato...');
  const inicioTempo = Date.now();

  const client = await pool.connect();

  let eventoId;
  let adminId;
  const equipesMap = {};
  const categoriasMap = {};

  try {
    await client.query('BEGIN');

    // 1. Limpeza
    console.log('[1/6] 🧹 Limpando dados anteriores do banco de dados...');
    await limparBanco(client);

    // 2. Faixas e Usuário Admin
    console.log('[2/6] 🥋 Verificando faixas e usuário administrador...');
    const faixaId = await garantirFaixas(client);
    adminId = await garantirAdmin(client);

    // 3. Evento e Regras de Pontuação
    console.log('[3/6] 🏆 Criando evento oficial e regras de pontuação...');
    const resEvento = await client.query(
      `INSERT INTO eventos (nome, descricao)
       VALUES ($1, $2)
       RETURNING id`,
      [
        'Copa Internacional de Jiu-Jitsu IBJJF Pro 2026',
        'Campeonato oficial de Jiu-Jitsu reunindo atletas de ponta da IBJJF nas faixas Branca, Azul, Roxa, Marrom e Preta.'
      ]
    );
    eventoId = resEvento.rows[0].id;

    // Regras padrão oficiais: 9 pts ouro, 3 pts prata, 1 pt bronze, 3 pts vitória por luta
    await client.query(
      `INSERT INTO regras_pontuacao (evento_id, pontos_primeiro, pontos_segundo, pontos_terceiro, pontos_vitoria, bye_pontua)
       VALUES ($1, 9, 3, 1, 3, FALSE)`,
      [eventoId]
    );

    // Atualiza último evento do admin
    await client.query('UPDATE usuarios SET ultimo_evento_id = $1 WHERE id = $2', [eventoId, adminId]);

    // 4. Inserir Equipes Reais
    console.log(`[4/6] 🏢 Cadastrando ${EQUIPES_REAIS.length} academias/equipes oficiais...`);
    for (const nomeEquipe of EQUIPES_REAIS) {
      const resEq = await client.query(
        'INSERT INTO equipes (nome) VALUES ($1) RETURNING id',
        [nomeEquipe]
      );
      equipesMap[nomeEquipe] = resEq.rows[0].id;
    }

    // 5. Cadastrar Categorias (todas as 5 faixas)
    console.log('[5/6] 📂 Cadastrando categorias nas 5 faixas (Branca, Azul, Roxa, Marrom e Preta)...');

    async function criarCategoria(nome, idMin, idMax, pMin, pMax, fMin, fMax, sexo) {
      const { rows } = await client.query(
        `INSERT INTO categorias (
           evento_id, nome, idade_minima, idade_maxima, peso_minimo, peso_maximo,
           faixa_minima_id, faixa_maxima_id, sexo
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [eventoId, nome, idMin, idMax, pMin, pMax, faixaId(fMin), faixaId(fMax), sexo]
      );
      return rows[0].id;
    }

    // Categorias Faixa Preta
    categoriasMap.pretaPena = await criarCategoria(
      'Masculino Adulto Preta - Pena (-70,0kg)', 18, 35, null, 70.0, 'Preta', 'Preta', 'MASCULINO'
    );
    categoriasMap.pretaMedio = await criarCategoria(
      'Masculino Adulto Preta - Médio (-82,3kg)', 18, 35, 70.0, 82.3, 'Preta', 'Preta', 'MASCULINO'
    );
    categoriasMap.pretaPesadissimo = await criarCategoria(
      'Masculino Adulto Preta - Pesadíssimo (+100,5kg)', 18, 35, 100.5, null, 'Preta', 'Preta', 'MASCULINO'
    );
    categoriasMap.pretaFemMedio = await criarCategoria(
      'Feminino Adulto Preta - Médio (-69,0kg)', 18, 35, null, 69.0, 'Preta', 'Preta', 'FEMININO'
    );

    // Categorias Faixa Marrom
    categoriasMap.marromMeioPesado = await criarCategoria(
      'Masculino Adulto Marrom - Meio-Pesado (-88,3kg)', 18, 35, null, 88.3, 'Marrom', 'Marrom', 'MASCULINO'
    );
    categoriasMap.marromFemLeve = await criarCategoria(
      'Feminino Adulto Marrom - Leve (-64,0kg)', 18, 35, null, 64.0, 'Marrom', 'Marrom', 'FEMININO'
    );

    // Categorias Faixa Roxa
    categoriasMap.roxaLeve = await criarCategoria(
      'Masculino Adulto Roxa - Leve (-76,0kg)', 18, 35, null, 76.0, 'Roxa', 'Roxa', 'MASCULINO'
    );
    categoriasMap.roxaPesado = await criarCategoria(
      'Masculino Adulto Roxa - Pesado (-94,3kg)', 18, 35, 76.0, 94.3, 'Roxa', 'Roxa', 'MASCULINO'
    );

    // Categorias Faixa Azul
    categoriasMap.azulLeve = await criarCategoria(
      'Masculino Adulto Azul - Leve (-76,0kg)', 18, 29, null, 76.0, 'Azul', 'Azul', 'MASCULINO'
    );
    categoriasMap.azulMasterMedio = await criarCategoria(
      'Masculino Master 1 Azul - Médio (-82,3kg)', 30, 39, null, 82.3, 'Azul', 'Azul', 'MASCULINO'
    );

    // Categorias Faixa Branca
    categoriasMap.brancaMedio = await criarCategoria(
      'Masculino Adulto Branca - Médio (-82,3kg)', 18, 29, null, 82.3, 'Branca', 'Branca', 'MASCULINO'
    );
    categoriasMap.brancaPesado = await criarCategoria(
      'Masculino Adulto Branca - Pesado (-94,3kg)', 18, 29, 82.3, 94.3, 'Branca', 'Branca', 'MASCULINO'
    );

    // Função de Inscrição de Atletas Confirmados
    async function inscrever(catId, equipeNome, faixaNome, nome, idade, peso, sexo, seed = null) {
      const eqId = equipesMap[equipeNome];
      if (!eqId) throw new Error(`Equipe "${equipeNome}" não mapeada.`);
      await client.query(
        `INSERT INTO inscricoes (
           evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status, seed
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CONFIRMADA', $9)`,
        [eventoId, catId, eqId, faixaId(faixaNome), nome, idade, peso, sexo, seed]
      );
    }

    // -----------------------------------------------------------------------
    // Inscrição dos Atletas Reais (IBJJF)
    // -----------------------------------------------------------------------

    // 1. Preta Médio (8 atletas, chave cheia de 8)
    await inscrever(categoriasMap.pretaMedio, 'Art of Jiu Jitsu (AOJ)', 'Preta', 'Tainan Dalpra', 24, 81.5, 'MASCULINO', 1);
    await inscrever(categoriasMap.pretaMedio, 'Melqui Galvão Jiu-Jitsu', 'Preta', 'Mica Galvão', 21, 82.0, 'MASCULINO', 2);
    await inscrever(categoriasMap.pretaMedio, 'Gracie Barra', 'Preta', 'Gabriel Arges', 31, 80.5, 'MASCULINO', 3);
    await inscrever(categoriasMap.pretaMedio, 'Dream Art', 'Preta', 'Isaque Bahiense', 29, 81.8, 'MASCULINO', 4);
    await inscrever(categoriasMap.pretaMedio, 'Alliance Jiu-Jitsu', 'Preta', 'Roberto Jimenez', 25, 81.0, 'MASCULINO', null);
    await inscrever(categoriasMap.pretaMedio, 'Atos Jiu-Jitsu', 'Preta', 'Andy Murasaki', 26, 80.0, 'MASCULINO', null);
    await inscrever(categoriasMap.pretaMedio, 'Fratres Brazilian Jiu-Jitsu', 'Preta', 'Tarik Hopstock', 28, 81.2, 'MASCULINO', null);
    await inscrever(categoriasMap.pretaMedio, 'Checkmat', 'Preta', 'Jansen Gomes', 24, 82.1, 'MASCULINO', null);

    // 2. Preta Pesadíssimo (4 atletas)
    await inscrever(categoriasMap.pretaPesadissimo, 'Ribeiro Jiu-Jitsu', 'Preta', 'Victor Hugo', 28, 115.0, 'MASCULINO', 1);
    await inscrever(categoriasMap.pretaPesadissimo, 'Fratres Brazilian Jiu-Jitsu', 'Preta', 'Gutemberg Pereira', 30, 108.5, 'MASCULINO', 2);
    await inscrever(categoriasMap.pretaPesadissimo, 'Alliance Jiu-Jitsu', 'Preta', 'Fellipe Andrew', 29, 105.0, 'MASCULINO', 3);
    await inscrever(categoriasMap.pretaPesadissimo, 'Fight Sports', 'Preta', 'Roosevelt Sousa', 32, 112.0, 'MASCULINO', 4);

    // 3. Preta Pena (4 atletas)
    await inscrever(categoriasMap.pretaPena, 'Art of Jiu Jitsu (AOJ)', 'Preta', 'Diego Pato Oliveira', 27, 69.5, 'MASCULINO', 1);
    await inscrever(categoriasMap.pretaPena, 'Fratres Brazilian Jiu-Jitsu', 'Preta', 'Meyram Maquiné', 24, 69.0, 'MASCULINO', 2);
    await inscrever(categoriasMap.pretaPena, 'Melqui Galvão Jiu-Jitsu', 'Preta', 'Fabricio Andrey', 25, 69.8, 'MASCULINO', 3);
    await inscrever(categoriasMap.pretaPena, 'Alliance Jiu-Jitsu', 'Preta', 'Isaac Doederlein', 31, 69.2, 'MASCULINO', 4);

    // 4. Feminino Preta Médio (4 atletas)
    await inscrever(categoriasMap.pretaFemMedio, 'Atos Jiu-Jitsu', 'Preta', 'Luiza Monteiro', 34, 67.5, 'FEMININO', 1);
    await inscrever(categoriasMap.pretaFemMedio, 'Checkmat', 'Preta', 'Amy Campo', 26, 68.0, 'FEMININO', 2);
    await inscrever(categoriasMap.pretaFemMedio, 'Fratres Brazilian Jiu-Jitsu', 'Preta', 'Thamara Ferreira', 29, 68.5, 'FEMININO', 3);
    await inscrever(categoriasMap.pretaFemMedio, 'Gracie Barra', 'Preta', 'Andressa Cintra', 29, 67.0, 'FEMININO', 4);

    // 5. Marrom Meio-Pesado (4 atletas)
    await inscrever(categoriasMap.marromMeioPesado, 'Gracie Barra', 'Marrom', 'Rayron Gracie', 23, 87.5, 'MASCULINO', 1);
    await inscrever(categoriasMap.marromMeioPesado, 'Alliance Jiu-Jitsu', 'Marrom', 'Steffen Banta', 24, 86.8, 'MASCULINO', 2);
    await inscrever(categoriasMap.marromMeioPesado, 'Atos Jiu-Jitsu', 'Marrom', 'Cassio Costa', 25, 87.0, 'MASCULINO', 3);
    await inscrever(categoriasMap.marromMeioPesado, 'Dream Art', 'Marrom', 'Kauã Gabriel', 22, 88.0, 'MASCULINO', 4);

    // 6. Feminino Marrom Leve (4 atletas - Chave NÃO gerada para usuário testar "Gerar Chave")
    await inscrever(categoriasMap.marromFemLeve, 'Melqui Galvão Jiu-Jitsu', 'Marrom', 'Sarah Galvão', 19, 63.0, 'FEMININO');
    await inscrever(categoriasMap.marromFemLeve, 'Alliance Jiu-Jitsu', 'Marrom', 'Heloisa Ferreira', 23, 62.5, 'FEMININO');
    await inscrever(categoriasMap.marromFemLeve, 'Dream Art', 'Marrom', 'Maria Luiza Delahaye', 22, 63.5, 'FEMININO');
    await inscrever(categoriasMap.marromFemLeve, 'Checkmat', 'Marrom', 'Julia Alves', 24, 63.2, 'FEMININO');

    // 7. Roxa Leve (8 atletas, chave cheia de 8)
    await inscrever(categoriasMap.roxaLeve, 'Melqui Galvão Jiu-Jitsu', 'Roxa', 'Kauã Henrique', 20, 75.0, 'MASCULINO', 1);
    await inscrever(categoriasMap.roxaLeve, 'Gracie Barra', 'Roxa', 'Achilles Rocha', 22, 75.5, 'MASCULINO', 2);
    await inscrever(categoriasMap.roxaLeve, 'Araújo JJ Team', 'Roxa', 'Carlos Henrique Araújo', 24, 74.8, 'MASCULINO', 3);
    await inscrever(categoriasMap.roxaLeve, 'Art of Jiu Jitsu (AOJ)', 'Roxa', 'Mateus Rodrigues', 21, 75.2, 'MASCULINO', 4);
    await inscrever(categoriasMap.roxaLeve, 'Dream Art', 'Roxa', 'Arthur Aguiar', 23, 74.5, 'MASCULINO', null);
    await inscrever(categoriasMap.roxaLeve, 'Nova União', 'Roxa', 'Thiago Nunes', 25, 75.8, 'MASCULINO', null);
    await inscrever(categoriasMap.roxaLeve, 'Checkmat', 'Roxa', 'Pedro Lucas', 22, 75.0, 'MASCULINO', null);
    await inscrever(categoriasMap.roxaLeve, 'GFTeam', 'Roxa', 'Enzo Guimarães', 21, 74.0, 'MASCULINO', null);

    // 8. Roxa Pesado (3 atletas com BYE - Chave NÃO gerada para usuário testar)
    await inscrever(categoriasMap.roxaPesado, 'Cicero Costha', 'Roxa', 'Gabriel Ramos', 24, 92.5, 'MASCULINO');
    await inscrever(categoriasMap.roxaPesado, 'Atos Jiu-Jitsu', 'Roxa', 'Lucas Gabriel', 23, 93.0, 'MASCULINO');
    await inscrever(categoriasMap.roxaPesado, 'Fratres Brazilian Jiu-Jitsu', 'Roxa', 'Rodrigo Falcão', 26, 91.5, 'MASCULINO');

    // 9. Azul Leve (4 atletas)
    await inscrever(categoriasMap.azulLeve, 'Araújo JJ Team', 'Azul', 'Bruno Oliveira', 22, 74.5, 'MASCULINO', 1);
    await inscrever(categoriasMap.azulLeve, 'Checkmat', 'Azul', 'Gustavo Ramos', 24, 75.2, 'MASCULINO', 2);
    await inscrever(categoriasMap.azulLeve, 'Atos Jiu-Jitsu', 'Azul', 'Felipe Moreira', 21, 75.0, 'MASCULINO', 3);
    await inscrever(categoriasMap.azulLeve, 'Dream Art', 'Azul', 'Matheus Carvalho', 23, 74.8, 'MASCULINO', 4);

    // 10. Master 1 Azul Médio (4 atletas - Chave NÃO gerada para usuário testar)
    await inscrever(categoriasMap.azulMasterMedio, 'Alliance Jiu-Jitsu', 'Azul', 'Leonardo Barbosa', 33, 81.0, 'MASCULINO');
    await inscrever(categoriasMap.azulMasterMedio, 'Checkmat', 'Azul', 'Marcelo Tavares', 35, 80.5, 'MASCULINO');
    await inscrever(categoriasMap.azulMasterMedio, 'Nova União', 'Azul', 'Vinicius Paiva', 32, 81.5, 'MASCULINO');
    await inscrever(categoriasMap.azulMasterMedio, 'Araújo JJ Team', 'Azul', 'Diego Ferreira', 36, 82.0, 'MASCULINO');

    // 11. Branca Médio (4 atletas)
    await inscrever(categoriasMap.brancaMedio, 'Araújo JJ Team', 'Branca', 'Pedro Henrique Lima', 20, 80.5, 'MASCULINO', 1);
    await inscrever(categoriasMap.brancaMedio, 'GFTeam', 'Branca', 'Vinícius Prado', 23, 81.0, 'MASCULINO', 2);
    await inscrever(categoriasMap.brancaMedio, 'Gracie Barra', 'Branca', 'João Pedro Silva', 22, 79.5, 'MASCULINO', 3);
    await inscrever(categoriasMap.brancaMedio, 'Nova União', 'Branca', 'Lucas Andrade', 25, 80.2, 'MASCULINO', 4);

    // 12. Branca Pesado (3 atletas com BYE - Chave NÃO gerada para usuário testar)
    await inscrever(categoriasMap.brancaPesado, 'Alliance Jiu-Jitsu', 'Branca', 'Carlos Eduardo Silva', 24, 91.0, 'MASCULINO');
    await inscrever(categoriasMap.brancaPesado, 'Checkmat', 'Branca', 'Henrique Almeida', 26, 92.5, 'MASCULINO');
    await inscrever(categoriasMap.brancaPesado, 'Araújo JJ Team', 'Branca', 'Davi Lucca Ferreira', 21, 90.0, 'MASCULINO');

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // ---------------------------------------------------------------------------
  // 6. Geração de Chaves Eliminatórias (Status: NÃO_INICIADA)
  // ---------------------------------------------------------------------------
  console.log('[6/6] ⚡ Gerando chaves oficiais (status: NÃO_INICIADA, sem lutas iniciadas)...');

  // Gerar chaves para 8 categorias
  const categoriasParaGerar = [
    categoriasMap.pretaMedio,
    categoriasMap.pretaPesadissimo,
    categoriasMap.pretaPena,
    categoriasMap.pretaFemMedio,
    categoriasMap.marromMeioPesado,
    categoriasMap.roxaLeve,
    categoriasMap.azulLeve,
    categoriasMap.brancaMedio,
  ];

  for (const catId of categoriasParaGerar) {
    await chaveService.gerarChave(eventoId, catId, adminId);
  }

  // Criar e Gerar Chave Rápida (GP Desafio Superluta)
  console.log('   ⭐ Criando Chave Rápida: GP Desafio Superluta - Absoluto Black Belt...');
  const chaveRapida = await chaveRapidaService.criar(
    eventoId,
    { nome: 'GP Desafio Superluta - Absoluto Black Belt' },
    adminId
  );

  const atletasRapidos = [
    { nome: 'Nicholas Meregali', equipe: 'Nova União' },
    { nome: 'Kaynan Duarte', equipe: 'Atos Jiu-Jitsu' },
    { nome: 'Victor Hugo', equipe: 'Ribeiro Jiu-Jitsu' },
    { nome: 'Fellipe Andrew', equipe: 'Alliance Jiu-Jitsu' },
  ];

  for (const ar of atletasRapidos) {
    await chaveRapidaService.adicionarCompetidor(
      eventoId,
      chaveRapida.id,
      { nome: ar.nome, equipe_id: equipesMap[ar.equipe] },
      adminId
    );
  }

  await chaveRapidaService.gerarChave(eventoId, chaveRapida.id, adminId);

  // Marca lutas da primeira rodada com 2 competidores como PRONTA (satisfazendo diagnósticos de integridade)
  // mantendo a chave com status NAO_INICIADA
  await pool.query(`
    UPDATE lutas
    SET status = 'PRONTA', updated_at = NOW()
    WHERE competidor_1_id IS NOT NULL
      AND competidor_2_id IS NOT NULL
      AND status = 'AGUARDANDO'
  `);

  // ---------------------------------------------------------------------------
  // Resumo Final
  // ---------------------------------------------------------------------------
  const tempoTotal = ((Date.now() - inicioTempo) / 1000).toFixed(2);

  console.log('\n\x1b[32m%s\x1b[0m', '============================================================');
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', '  ✅ SIMULAÇÃO CRIADA COM SUCESSO! (' + tempoTotal + 's)');
  console.log('\x1b[32m%s\x1b[0m', '============================================================');
  console.log(`🏆 Campeonato: Copa Internacional de Jiu-Jitsu IBJJF Pro 2026 (ID: ${eventoId})`);
  console.log(`🏢 Academias Reais: ${EQUIPES_REAIS.length} equipes cadastradas`);
  console.log(`📂 Categorias: 12 categorias cobrindo as 5 faixas (Branca, Azul, Roxa, Marrom e Preta)`);
  console.log(`🥋 Atletas Reais: 55 atletas em categorias + 4 atletas na Superluta`);
  console.log(`⚡ Chaves Geradas: 8 de categorias + 1 chave rápida (Todas com status "NAO_INICIADA")`);
  console.log(`🎯 Categorias Prontas sem Chave: 4 categorias (para testar geração no painel)`);
  console.log(`🔒 Login Administrador: ${process.env.ADMIN_EMAIL || 'araujo@araujo.com'} / ${process.env.ADMIN_PASSWORD || 'araujo'}`);
  console.log(`🌐 Acessar Sistema: http://localhost:3000/eventos/${eventoId}`);
  console.log('\x1b[32m%s\x1b[0m\n', '============================================================');
}

// ---------------------------------------------------------------------------
// Ponto de Entrada
// ---------------------------------------------------------------------------
if (require.main === module) {
  simular()
    .catch((err) => {
      console.error('\n\x1b[31m%s\x1b[0m', '❌ Erro durante a execução da simulação:');
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = { simular };
