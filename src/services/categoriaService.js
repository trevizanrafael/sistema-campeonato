const pool = require('../config/database');
const categoriaRepository = require('../repositories/categoriaRepository');
const eventoRepository = require('../repositories/eventoRepository');
const faixaRepository = require('../repositories/faixaRepository');
const {
  normalizarCategoria,
  validarCategoria,
  validarId,
} = require('../validators/categoriaValidator');
const {
  inscricaoCompativelComCategoria,
  categoriasSeSobrepoem,
} = require('./classificacaoService');
const {
  NotFoundError,
  ValidationError,
  BusinessRuleError,
} = require('../utils/errors');

async function validarEventoExistente(eventoId, client = pool) {
  const validId = validarId(eventoId);
  if (!validId) {
    throw new NotFoundError('Evento não encontrado.');
  }

  const evento = await eventoRepository.buscarPorId(validId, client);
  if (!evento) {
    throw new NotFoundError('Evento não encontrado.');
  }

  return evento;
}

async function listarCategorias(eventoId) {
  const evento = await validarEventoExistente(eventoId);
  const categorias = await categoriaRepository.listarPorEvento(evento.id);

  // Calcular sobreposições entre as categorias listadas para exibição no painel
  for (let i = 0; i < categorias.length; i++) {
    const catA = categorias[i];
    const sobrepostas = [];

    for (let j = 0; j < categorias.length; j++) {
      if (i === j) continue;
      const catB = categorias[j];

      if (categoriasSeSobrepoem(catA, catB)) {
        sobrepostas.push(catB.nome);
      }
    }

    catA.sobreposicoes = sobrepostas;
    catA.temSobreposicao = sobrepostas.length > 0;
  }

  return {
    evento,
    categorias,
  };
}

async function prepararFormulario(eventoId) {
  const evento = await validarEventoExistente(eventoId);
  const faixas = await faixaRepository.listarTodas();

  return {
    evento,
    faixas,
  };
}

async function buscarCategoria(eventoId, categoriaId) {
  const validEventoId = validarId(eventoId);
  const validCatId = validarId(categoriaId);

  if (!validEventoId || !validCatId) {
    throw new NotFoundError('Categoria não encontrada neste evento.');
  }

  await validarEventoExistente(validEventoId);

  const categoria = await categoriaRepository.buscarPorIdNoEvento(
    validCatId,
    validEventoId
  );

  if (!categoria) {
    throw new NotFoundError('Categoria não encontrada neste evento.');
  }

  return categoria;
}

async function detectarSobreposicoes(eventoId, categoria, ignorarId = null) {
  const outras = await categoriaRepository.listarPossiveisConflitos(
    eventoId,
    ignorarId
  );

  const sobrepostas = [];
  for (const outra of outras) {
    if (categoriasSeSobrepoem(categoria, outra)) {
      sobrepostas.push(outra.nome);
    }
  }

  return sobrepostas;
}

async function criarCategoria(eventoId, dados) {
  const evento = await validarEventoExistente(eventoId);

  const faixas = await faixaRepository.listarTodas();
  const faixasMap = new Map(
    faixas.map((f) => [Number(f.id), { ...f, id: Number(f.id), ordem: Number(f.ordem) }])
  );

  const normalizado = normalizarCategoria(dados);
  const erros = validarCategoria(normalizado, faixasMap);

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  const existente = await categoriaRepository.buscarPorNomeNoEvento(
    normalizado.nome,
    evento.id
  );

  if (existente) {
    throw new ValidationError({
      nome: 'Já existe uma categoria com este nome neste evento.',
    });
  }

  const categoria = await categoriaRepository.criar({
    ...normalizado,
    evento_id: evento.id,
  });

  const faixaMin = normalizado.faixa_minima_id
    ? faixasMap.get(Number(normalizado.faixa_minima_id))
    : null;
  const faixaMax = normalizado.faixa_maxima_id
    ? faixasMap.get(Number(normalizado.faixa_maxima_id))
    : null;

  const catComOrdens = {
    ...normalizado,
    faixa_minima_ordem: faixaMin ? faixaMin.ordem : null,
    faixa_maxima_ordem: faixaMax ? faixaMax.ordem : null,
  };

  const sobreposicoes = await detectarSobreposicoes(
    evento.id,
    catComOrdens,
    categoria.id
  );

  const aberta =
    normalizado.idade_minima === null &&
    normalizado.idade_maxima === null &&
    normalizado.peso_minimo === null &&
    normalizado.peso_maximo === null &&
    normalizado.faixa_minima_id === null &&
    normalizado.faixa_maxima_id === null &&
    normalizado.sexo === 'MISTO';

  return {
    categoria,
    sobreposicoes,
    aberta,
  };
}

async function editarCategoria(eventoId, categoriaId, dados) {
  const categoriaAtual = await buscarCategoria(eventoId, categoriaId);
  const dependencias = await categoriaRepository.contarDependencias(
    categoriaAtual.id
  );

  // Se já houver chave criada: permite editar SOMENTE o nome
  if (dependencias.total_chaves > 0) {
    const nomeLimpo =
      typeof dados.nome === 'string'
        ? dados.nome.trim().replace(/\s+/g, ' ')
        : '';

    if (!nomeLimpo || nomeLimpo.length < 2 || nomeLimpo.length > 200) {
      throw new ValidationError({
        nome: 'O nome da categoria deve ter entre 2 e 200 caracteres.',
      });
    }

    const existente = await categoriaRepository.buscarPorNomeNoEvento(
      nomeLimpo,
      categoriaAtual.evento_id,
      categoriaAtual.id
    );

    if (existente) {
      throw new ValidationError({
        nome: 'Já existe uma categoria com este nome neste evento.',
      });
    }

    const atualizada = await categoriaRepository.atualizarApenasNome(
      categoriaAtual.id,
      categoriaAtual.evento_id,
      nomeLimpo
    );

    return {
      categoria: atualizada,
      apenasNome: true,
      sobreposicoes: [],
      aberta: false,
    };
  }

  // Sem chave: pode atualizar critérios, desde que respeite inscrições vinculadas
  const faixas = await faixaRepository.listarTodas();
  const faixasMap = new Map(
    faixas.map((f) => [Number(f.id), { ...f, id: Number(f.id), ordem: Number(f.ordem) }])
  );

  const normalizado = normalizarCategoria(dados);
  const erros = validarCategoria(normalizado, faixasMap);

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  const existente = await categoriaRepository.buscarPorNomeNoEvento(
    normalizado.nome,
    categoriaAtual.evento_id,
    categoriaAtual.id
  );

  if (existente) {
    throw new ValidationError({
      nome: 'Já existe uma categoria com este nome neste evento.',
    });
  }

  const faixaMin = normalizado.faixa_minima_id
    ? faixasMap.get(Number(normalizado.faixa_minima_id))
    : null;
  const faixaMax = normalizado.faixa_maxima_id
    ? faixasMap.get(Number(normalizado.faixa_maxima_id))
    : null;

  const novosCriterios = {
    ...normalizado,
    faixa_minima_ordem: faixaMin ? faixaMin.ordem : null,
    faixa_maxima_ordem: faixaMax ? faixaMax.ordem : null,
  };

  if (dependencias.total_inscricoes > 0) {
    const inscricoes = await categoriaRepository.listarInscricoesVinculadas(
      categoriaAtual.id
    );

    const incompativeis = inscricoes.filter(
      (inscricao) => !inscricaoCompativelComCategoria(inscricao, novosCriterios)
    );

    if (incompativeis.length > 0) {
      const nomes = incompativeis.map((i) => i.nome).join(', ');
      throw new BusinessRuleError(
        `Os critérios não podem ser alterados porque ${incompativeis.length} inscrição(ões) deixaria(m) de pertencer à categoria: ${nomes}.`
      );
    }
  }

  const atualizada = await categoriaRepository.atualizar(
    categoriaAtual.id,
    categoriaAtual.evento_id,
    normalizado
  );

  const sobreposicoes = await detectarSobreposicoes(
    categoriaAtual.evento_id,
    novosCriterios,
    categoriaAtual.id
  );

  const aberta =
    normalizado.idade_minima === null &&
    normalizado.idade_maxima === null &&
    normalizado.peso_minimo === null &&
    normalizado.peso_maximo === null &&
    normalizado.faixa_minima_id === null &&
    normalizado.faixa_maxima_id === null &&
    normalizado.sexo === 'MISTO';

  return {
    categoria: atualizada,
    apenasNome: false,
    sobreposicoes,
    aberta,
  };
}

async function excluirCategoria(eventoId, categoriaId) {
  const validEventoId = validarId(eventoId);
  const validCatId = validarId(categoriaId);

  if (!validEventoId || !validCatId) {
    throw new NotFoundError('Categoria não encontrada neste evento.');
  }

  await validarEventoExistente(validEventoId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const categoria = await categoriaRepository.bloquearPorIdNoEvento(
      validCatId,
      validEventoId,
      client
    );

    if (!categoria) {
      throw new NotFoundError('Categoria não encontrada neste evento.');
    }

    const dependencias = await categoriaRepository.contarDependencias(
      validCatId,
      client
    );

    if (dependencias.total_inscricoes > 0 || dependencias.total_chaves > 0) {
      throw new BusinessRuleError(
        'Esta categoria não pode ser excluída porque possui inscrições ou uma chave vinculada.'
      );
    }

    await categoriaRepository.excluir(validCatId, validEventoId, client);
    await client.query('COMMIT');
    return categoria;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

module.exports = {
  listarCategorias,
  prepararFormulario,
  buscarCategoria,
  detectarSobreposicoes,
  criarCategoria,
  editarCategoria,
  excluirCategoria,
};
