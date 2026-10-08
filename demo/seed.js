// Dados de demonstração usados pelo vídeo (demo/gravar.js).
// Apaga e recria SOMENTE o campeonato de demo, então pode rodar quantas vezes quiser.
// Uso isolado: node demo/seed.js
require('dotenv').config({ quiet: true });
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const pool = require('../src/config/database');
const chaveService = require('../src/services/chaveService');

const NOME_EVENTO = 'Copa Araújo de Jiu-Jitsu 2026';
const PASTA_PLANILHAS = path.join(__dirname, 'planilhas');

const ACADEMIAS = [
  'Araújo JJ Team',
  'Gracie Barra Dracena',
  'Alliance Presidente Prudente',
  'Checkmat Tupã',
  'Nova União Adamantina',
  'Atos Jiu-Jitsu Panorama',
  'GFTeam Junqueirópolis',
  'Ribeiro JJ Osvaldo Cruz',
];

async function apagarEventoDemo(client) {
  const { rows } = await client.query('SELECT id FROM eventos WHERE nome = $1', [NOME_EVENTO]);
  for (const { id } of rows) {
    const chaves = `SELECT ch.id FROM chaves ch JOIN categorias c ON c.id = ch.categoria_id WHERE c.evento_id = $1`;
    await client.query(`DELETE FROM pontos_equipes WHERE evento_id = $1`, [id]);
    await client.query(`UPDATE lutas SET proxima_luta_id = NULL WHERE chave_id IN (${chaves})`, [id]);
    await client.query(`DELETE FROM lutas WHERE chave_id IN (${chaves})`, [id]);
    await client.query(`DELETE FROM chaves WHERE id IN (${chaves})`, [id]);
    await client.query(`DELETE FROM logs_auditoria WHERE evento_id = $1`, [id]);
    await client.query(`DELETE FROM inscricoes WHERE evento_id = $1`, [id]);
    await client.query(`DELETE FROM categorias WHERE evento_id = $1`, [id]);
    await client.query(`DELETE FROM eventos WHERE id = $1`, [id]);
  }
}

async function criarPlanilha(arquivo, linhas) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Inscrições');
  ws.addRow(['Nome', 'Peso', 'Faixa', 'Idade', 'Sexo']);
  linhas.forEach((linha) => ws.addRow(linha));
  ws.columns.forEach((col) => { col.width = 24; });
  const destino = path.join(PASTA_PLANILHAS, arquivo);
  await wb.xlsx.writeFile(destino);
  return destino;
}

async function seed() {
  const client = await pool.connect();
  let eventoId;
  let categorias;
  try {
    await client.query('BEGIN');
    await apagarEventoDemo(client);

    const { rows: faixas } = await client.query('SELECT id, nome FROM faixas');
    const faixa = (nome) => {
      const f = faixas.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
      if (!f) throw new Error(`Faixa "${nome}" não cadastrada. Rode "npm run migrate".`);
      return f.id;
    };

    ({ rows: [{ id: eventoId }] } = await client.query(
      'INSERT INTO eventos (nome, descricao) VALUES ($1, $2) RETURNING id',
      [NOME_EVENTO, 'Campeonato aberto de Jiu-Jitsu – Dracena/SP']
    ));

    const equipes = {};
    for (const nome of ACADEMIAS) {
      await client.query('INSERT INTO equipes (nome) VALUES ($1) ON CONFLICT DO NOTHING', [nome]);
      const { rows: [e] } = await client.query('SELECT id FROM equipes WHERE LOWER(nome) = LOWER($1)', [nome]);
      equipes[nome] = e.id;
    }

    const categoria = async (nome, idMin, idMax, pMin, pMax, fMin, fMax, sexo) => {
      const { rows: [c] } = await client.query(
        `INSERT INTO categorias (evento_id, nome, idade_minima, idade_maxima, peso_minimo, peso_maximo, faixa_minima_id, faixa_maxima_id, sexo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [eventoId, nome, idMin, idMax, pMin, pMax, faixa(fMin), faixa(fMax), sexo]
      );
      return c.id;
    };
    categorias = {
      brancaM: await categoria('Masculino Adulto Branca -76kg', 18, 29, null, 76, 'Branca', 'Branca', 'MASCULINO'),
      azulM: await categoria('Masculino Adulto Azul -82,3kg', 18, 29, 76, 82.3, 'Azul', 'Azul', 'MASCULINO'),
      brancaF: await categoria('Feminino Adulto Branca -64kg', 18, 29, null, 64, 'Branca', 'Branca', 'FEMININO'),
      masterRoxa: await categoria('Masculino Master Roxa/Preta -88,3kg', 30, 45, 76, 88.3, 'Roxa', 'Preta', 'MASCULINO'),
      infantil: await categoria('Infantil Misto Branca', 8, 12, null, null, 'Branca', 'Branca', 'MISTO'),
    };

    const inscrever = (cat, academia, nomeFaixa, nome, idade, peso, sexo) => client.query(
      `INSERT INTO inscricoes (evento_id, categoria_id, equipe_id, faixa_id, nome, idade, peso, sexo, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'CONFIRMADA')`,
      [eventoId, cat, equipes[academia], faixa(nomeFaixa), nome, idade, peso, sexo]
    );
    const c = categorias;
    // Master Roxa/Preta: a chave vai ser iniciada
    await inscrever(c.masterRoxa, 'Araújo JJ Team', 'Roxa', 'Carlos Henrique Araújo', 34, 85, 'MASCULINO');
    await inscrever(c.masterRoxa, 'Alliance Presidente Prudente', 'Marrom', 'Diego Ferreira', 38, 87, 'MASCULINO');
    await inscrever(c.masterRoxa, 'Checkmat Tupã', 'Preta', 'Marcelo Tavares', 41, 84.5, 'MASCULINO');
    await inscrever(c.masterRoxa, 'Nova União Adamantina', 'Roxa', 'Thiago Nunes', 31, 86, 'MASCULINO');
    // Masculino Azul: chave gerada, mas não iniciada
    await inscrever(c.azulM, 'Araújo JJ Team', 'Azul', 'Bruno Oliveira', 24, 81, 'MASCULINO');
    await inscrever(c.azulM, 'Checkmat Tupã', 'Azul', 'Gustavo Ramos', 26, 79.5, 'MASCULINO');
    await inscrever(c.azulM, 'Atos Jiu-Jitsu Panorama', 'Azul', 'Felipe Moreira', 22, 80.2, 'MASCULINO');
    // Demais categorias, sem chave
    await inscrever(c.brancaM, 'Araújo JJ Team', 'Branca', 'Pedro Henrique Lima', 20, 73, 'MASCULINO');
    await inscrever(c.brancaM, 'GFTeam Junqueirópolis', 'Branca', 'Vinícius Prado', 23, 75, 'MASCULINO');
    await inscrever(c.brancaF, 'Alliance Presidente Prudente', 'Branca', 'Ana Beatriz Rocha', 21, 58, 'FEMININO');
    await inscrever(c.infantil, 'Ribeiro JJ Osvaldo Cruz', 'Branca', 'Miguel Ribeiro', 9, 32, 'MASCULINO');

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Chaves (o serviço abre a própria transação)
  const { rows: [admin] } = await pool.query('SELECT id FROM usuarios ORDER BY id LIMIT 1');
  const usuarioId = admin ? admin.id : null;
  await chaveService.gerarChave(eventoId, categorias.masterRoxa, usuarioId);
  const { rows: [chave] } = await pool.query('SELECT id FROM chaves WHERE categoria_id = $1', [categorias.masterRoxa]);
  await chaveService.iniciarChave(eventoId, chave.id, usuarioId);
  await chaveService.gerarChave(eventoId, categorias.azulM, usuarioId);

  // Planilhas mostradas no vídeo
  fs.mkdirSync(PASTA_PLANILHAS, { recursive: true });
  const planilhaComErros = await criarPlanilha('atletas-com-erros.xlsx', [
    ['João Pedro Silva', 74, 'branca', 22, 'M'],
    ['Lucas Andrade', 80, 'Verde', 25, 'M'],
    ['Mariana Costa', 60, 'Branca', 24, 'X'],
    ['Rafael Souza', 'abc', 'Roxa', 33, 'M'],
  ]);
  const planilhaCorrigida = await criarPlanilha('atletas-corrigida.xlsx', [
    ['João Pedro Silva', 74, 'branca', 22, 'M'],
    ['Lucas Andrade', 80, 'AZUL', 25, 'M'],
    ['Mariana Costa', 60, 'Branca', 24, 'F'],
    ['Rafael Souza', 85, 'Roxa', 33, 'M'],
    ['Enzo Lima', 35, 'Branca', 10, 'M'],
  ]);

  return { eventoId, planilhaComErros, planilhaCorrigida };
}

module.exports = { seed, NOME_EVENTO };

if (require.main === module) {
  seed()
    .then((r) => console.log('Demo pronta:', r))
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => pool.end());
}
