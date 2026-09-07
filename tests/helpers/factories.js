const pool = require('../../src/config/database');
const eventoRepository = require('../../src/repositories/eventoRepository');
const regraPontuacaoRepository = require('../../src/repositories/regraPontuacaoRepository');
const categoriaRepository = require('../../src/repositories/categoriaRepository');
const inscricaoRepository = require('../../src/repositories/inscricaoRepository');
const faixaRepository = require('../../src/repositories/faixaRepository');

async function obterUsuarioAdmin() {
  const res = await pool.query('SELECT id FROM usuarios ORDER BY id ASC LIMIT 1');
  return res.rows[0]?.id || null;
}

async function criarEvento(dados = {}) {
  const nome = dados.nome || `TEST_Evento_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const descricao = dados.descricao || 'Descrição do Evento de Teste';
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const evento = await eventoRepository.criar({ nome, descricao }, client);
    await regraPontuacaoRepository.criarPadrao(evento.id, client);
    if (dados.regras) {
      await regraPontuacaoRepository.atualizar(
        evento.id,
        {
          pontos_vitoria: dados.regras.pontos_vitoria ?? 0,
          pontos_primeiro: dados.regras.pontos_primeiro ?? 9,
          pontos_segundo: dados.regras.pontos_segundo ?? 3,
          pontos_terceiro: dados.regras.pontos_terceiro ?? 1,
          bye_pontua: dados.regras.bye_pontua ?? false,
        },
        client
      );
    }
    await client.query('COMMIT');
    return evento;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function criarEquipe(dados = {}) {
  const nome = dados.nome || `TEST_Equipe_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const res = await pool.query(
    'INSERT INTO equipes (nome) VALUES ($1) RETURNING *',
    [nome]
  );
  return res.rows[0];
}

async function obterFaixa(nome = 'Branca') {
  const faixas = await faixaRepository.listarTodas();
  const faixa = faixas.find(f => f.nome.toLowerCase() === nome.toLowerCase());
  return faixa || faixas[0];
}

async function criarCategoria(eventoId, dados = {}) {
  const faixas = await faixaRepository.listarTodas();
  const faixaMin = dados.faixa_min_id || faixas[0].id;
  const faixaMax = dados.faixa_max_id || faixas[faixas.length - 1].id;

  const categoria = await categoriaRepository.criar({
    evento_id: eventoId,
    nome: dados.nome || `TEST_Categoria_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    sexo: dados.sexo || 'MASCULINO',
    peso_minimo: dados.peso_minimo !== undefined ? dados.peso_minimo : null,
    peso_maximo: dados.peso_maximo !== undefined ? dados.peso_maximo : 80.0,
    idade_minima: dados.idade_minima !== undefined ? dados.idade_minima : 18,
    idade_maxima: dados.idade_maxima !== undefined ? dados.idade_maxima : 35,
    faixa_min_id: faixaMin,
    faixa_max_id: faixaMax,
  });

  return categoria;
}

async function criarInscricao(eventoId, categoriaId, equipeId, faixaId, dados = {}) {
  const inscricao = await inscricaoRepository.criar({
    evento_id: eventoId,
    categoria_id: categoriaId,
    equipe_id: equipeId,
    faixa_id: faixaId,
    nome: dados.nome || `TEST_Atleta_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    idade: dados.idade || 25,
    peso: dados.peso || 75.0,
    sexo: dados.sexo || 'MASCULINO',
    status: dados.status || 'CONFIRMADA',
    seed: dados.seed || null,
  });

  return inscricao;
}

module.exports = {
  obterUsuarioAdmin,
  criarEvento,
  criarEquipe,
  obterFaixa,
  criarCategoria,
  criarInscricao,
};
