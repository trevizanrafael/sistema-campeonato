const pool = require('../config/database');
const inscricaoRepository = require('../repositories/inscricaoRepository');
const eventoRepository = require('../repositories/eventoRepository');
const categoriaRepository = require('../repositories/categoriaRepository');
const faixaRepository = require('../repositories/faixaRepository');
const equipeRepository = require('../repositories/equipeRepository');
const {
  normalizarInscricao,
  validarInscricao,
  validarId,
} = require('../validators/inscricaoValidator');
const {
  inscricaoCompativelComCategoria,
  buscarCategoriasCompativeis,
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

async function listarInscricoes(eventoId, filtros = {}) {
  const evento = await validarEventoExistente(eventoId);

  const [inscricoes, resumo, categorias, equipes] = await Promise.all([
    inscricaoRepository.listarPorEvento(evento.id, filtros),
    inscricaoRepository.buscarResumoStatus(evento.id),
    categoriaRepository.listarPorEvento(evento.id),
    equipeRepository.listarTodas(),
  ]);

  return {
    evento,
    inscricoes,
    resumo,
    categorias,
    equipes,
    filtros,
  };
}

async function prepararFormulario(eventoId) {
  const evento = await validarEventoExistente(eventoId);

  const [equipes, faixas] = await Promise.all([
    equipeRepository.listarTodas(),
    faixaRepository.listarTodas(),
  ]);

  return {
    evento,
    equipes,
    faixas,
  };
}

async function buscarInscricao(eventoId, inscricaoId) {
  const validEventoId = validarId(eventoId);
  const validInscricaoId = validarId(inscricaoId);

  if (!validEventoId || !validInscricaoId) {
    throw new NotFoundError('Inscrição não encontrada neste evento.');
  }

  await validarEventoExistente(validEventoId);

  const inscricao = await inscricaoRepository.buscarComRelacionamentos(
    validInscricaoId,
    validEventoId
  );

  if (!inscricao) {
    throw new NotFoundError('Inscrição não encontrada neste evento.');
  }

  return inscricao;
}

async function processarCadastro(eventoId, dados) {
  const evento = await validarEventoExistente(eventoId);

  const [faixas, equipes, categorias] = await Promise.all([
    faixaRepository.listarTodas(),
    equipeRepository.listarTodas(),
    categoriaRepository.listarPorEvento(evento.id),
  ]);

  const faixasMap = new Map(
    faixas.map((f) => [
      Number(f.id),
      { ...f, id: Number(f.id), ordem: Number(f.ordem) },
    ])
  );
  const equipesMap = new Map(
    equipes.map((e) => [Number(e.id), { ...e, id: Number(e.id) }])
  );

  const normalizado = normalizarInscricao(dados);
  const erros = validarInscricao(normalizado, { faixasMap, equipesMap });

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  const faixaAtleta = faixasMap.get(Number(normalizado.faixa_id));
  const atletaClassificacao = {
    ...normalizado,
    faixa_ordem: faixaAtleta.ordem,
  };

  // Se a categoria foi confirmada pelo usuário após a tela de escolha
  if (dados.categoria_confirmada === '1' && dados.categoria_id) {
    const chosenId = Number(dados.categoria_id);
    const categoriaEscolhida = categorias.find((c) => Number(c.id) === chosenId);

    if (!categoriaEscolhida) {
      throw new ValidationError({
        categoria_id: 'Categoria selecionada não foi encontrada neste evento.',
      });
    }

    if (
      !inscricaoCompativelComCategoria(atletaClassificacao, categoriaEscolhida)
    ) {
      throw new ValidationError({
        categoria_id:
          'A categoria selecionada não é compatível com os dados do competidor.',
      });
    }

    const inscricao = await inscricaoRepository.criar({
      ...normalizado,
      evento_id: evento.id,
      categoria_id: categoriaEscolhida.id,
      status: 'CONFIRMADA',
    });

    return {
      tipo: 'CRIADA',
      inscricao,
      categoria: categoriaEscolhida,
      mensagem: `Inscrição cadastrada e classificada em "${categoriaEscolhida.nome}".`,
    };
  }

  // Classificação automática padrão
  const compativeis = buscarCategoriasCompativeis(
    atletaClassificacao,
    categorias
  );

  if (compativeis.length === 0) {
    const inscricao = await inscricaoRepository.criar({
      ...normalizado,
      evento_id: evento.id,
      categoria_id: null,
      status: 'PENDENTE',
    });

    return {
      tipo: 'CRIADA',
      inscricao,
      categoria: null,
      mensagem:
        'Inscrição cadastrada, mas nenhuma categoria compatível foi encontrada. Status definido como Pendente.',
    };
  }

  if (compativeis.length === 1) {
    const categoriaEncontrada = compativeis[0];
    const inscricao = await inscricaoRepository.criar({
      ...normalizado,
      evento_id: evento.id,
      categoria_id: categoriaEncontrada.id,
      status: 'CONFIRMADA',
    });

    return {
      tipo: 'CRIADA',
      inscricao,
      categoria: categoriaEncontrada,
      mensagem: `Inscrição cadastrada e classificada em "${categoriaEncontrada.nome}".`,
    };
  }

  // Múltiplas categorias compatíveis: solicita escolha do usuário
  return {
    tipo: 'ESCOLHER_CATEGORIA',
    evento,
    dados: normalizado,
    categoriasCompativeis: compativeis,
  };
}

async function processarEdicao(eventoId, inscricaoId, dados) {
  const inscricaoAtual = await buscarInscricao(eventoId, inscricaoId);

  const emLuta = await inscricaoRepository.verificarParticipacaoEmLutas(
    inscricaoAtual.id
  );

  // Se já participa de lutas: permite alterar exclusivamente o nome
  if (emLuta) {
    const nomeLimpo =
      typeof dados.nome === 'string'
        ? dados.nome.trim().replace(/\s+/g, ' ')
        : '';

    if (!nomeLimpo || nomeLimpo.length < 2 || nomeLimpo.length > 200) {
      throw new ValidationError({
        nome: 'O nome do competidor deve ter entre 2 e 200 caracteres.',
      });
    }

    const atualizada = await inscricaoRepository.atualizarApenasNome(
      inscricaoAtual.id,
      inscricaoAtual.evento_id,
      nomeLimpo
    );

    return {
      tipo: 'CRIADA',
      inscricao: atualizada,
      apenasNome: true,
      mensagem:
        'Nome do competidor atualizado com sucesso. Os dados competitivos foram mantidos pois a inscrição já participa de uma chave/luta.',
    };
  }

  // Sem participação em luta: edição completa com reclassificação
  const evento = await validarEventoExistente(eventoId);

  const [faixas, equipes, categorias] = await Promise.all([
    faixaRepository.listarTodas(),
    equipeRepository.listarTodas(),
    categoriaRepository.listarPorEvento(evento.id),
  ]);

  const faixasMap = new Map(
    faixas.map((f) => [
      Number(f.id),
      { ...f, id: Number(f.id), ordem: Number(f.ordem) },
    ])
  );
  const equipesMap = new Map(
    equipes.map((e) => [Number(e.id), { ...e, id: Number(e.id) }])
  );

  const normalizado = normalizarInscricao(dados);
  const erros = validarInscricao(normalizado, { faixasMap, equipesMap });

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  const faixaAtleta = faixasMap.get(Number(normalizado.faixa_id));
  const atletaClassificacao = {
    ...normalizado,
    faixa_ordem: faixaAtleta.ordem,
  };

  // Se o usuário confirmou a categoria após a tela de escolha na edição
  if (dados.categoria_confirmada === '1' && dados.categoria_id) {
    const chosenId = Number(dados.categoria_id);
    const categoriaEscolhida = categorias.find((c) => Number(c.id) === chosenId);

    if (!categoriaEscolhida) {
      throw new ValidationError({
        categoria_id: 'Categoria selecionada não foi encontrada neste evento.',
      });
    }

    if (
      !inscricaoCompativelComCategoria(atletaClassificacao, categoriaEscolhida)
    ) {
      throw new ValidationError({
        categoria_id:
          'A categoria selecionada não é compatível com os dados do competidor.',
      });
    }

    const atualizada = await inscricaoRepository.atualizar(
      inscricaoAtual.id,
      evento.id,
      {
        ...normalizado,
        categoria_id: categoriaEscolhida.id,
        status: 'CONFIRMADA',
      }
    );

    return {
      tipo: 'CRIADA',
      inscricao: atualizada,
      categoria: categoriaEscolhida,
      mensagem: `Inscrição atualizada e classificada em "${categoriaEscolhida.nome}".`,
    };
  }

  // Reclassificação automática
  const compativeis = buscarCategoriasCompativeis(
    atletaClassificacao,
    categorias
  );

  if (compativeis.length === 0) {
    const atualizada = await inscricaoRepository.atualizar(
      inscricaoAtual.id,
      evento.id,
      {
        ...normalizado,
        categoria_id: null,
        status: 'PENDENTE',
      }
    );

    return {
      tipo: 'CRIADA',
      inscricao: atualizada,
      categoria: null,
      mensagem:
        'Inscrição atualizada, mas não há categoria compatível com os novos dados. Status definido como Pendente.',
    };
  }

  if (compativeis.length === 1) {
    const categoriaEncontrada = compativeis[0];
    const atualizada = await inscricaoRepository.atualizar(
      inscricaoAtual.id,
      evento.id,
      {
        ...normalizado,
        categoria_id: categoriaEncontrada.id,
        status: 'CONFIRMADA',
      }
    );

    return {
      tipo: 'CRIADA',
      inscricao: atualizada,
      categoria: categoriaEncontrada,
      mensagem: `Inscrição atualizada e classificada em "${categoriaEncontrada.nome}".`,
    };
  }

  // Múltiplas categorias compatíveis:
  // Se a categoria atual continuar entre as compatíveis, preserva-a automaticamente!
  const atualAindaCompativel = compativeis.find(
    (c) => Number(c.id) === Number(inscricaoAtual.categoria_id)
  );

  if (atualAindaCompativel) {
    const atualizada = await inscricaoRepository.atualizar(
      inscricaoAtual.id,
      evento.id,
      {
        ...normalizado,
        categoria_id: atualAindaCompativel.id,
        status: 'CONFIRMADA',
      }
    );

    return {
      tipo: 'CRIADA',
      inscricao: atualizada,
      categoria: atualAindaCompativel,
      mensagem: `Inscrição atualizada e mantida na categoria "${atualAindaCompativel.nome}".`,
    };
  }

  // Caso contrário, solicita escolha
  return {
    tipo: 'ESCOLHER_CATEGORIA',
    evento,
    inscricaoId: inscricaoAtual.id,
    dados: normalizado,
    categoriasCompativeis: compativeis,
  };
}

async function cancelarInscricao(eventoId, inscricaoId) {
  const inscricao = await buscarInscricao(eventoId, inscricaoId);

  const emLuta = await inscricaoRepository.verificarParticipacaoEmLutas(
    inscricao.id
  );
  if (emLuta) {
    throw new BusinessRuleError(
      'Esta inscrição não pode ser cancelada porque já participa de uma chave/luta.'
    );
  }

  await inscricaoRepository.alterarStatus(
    inscricao.id,
    inscricao.evento_id,
    'CANCELADA'
  );

  return inscricao;
}

async function reativarInscricao(eventoId, inscricaoId) {
  const inscricao = await buscarInscricao(eventoId, inscricaoId);

  const [faixas, categorias] = await Promise.all([
    faixaRepository.listarTodas(),
    categoriaRepository.listarPorEvento(eventoId),
  ]);

  const faixa = faixas.find((f) => Number(f.id) === Number(inscricao.faixa_id));
  const faixaOrdem = faixa ? faixa.ordem : 1;

  const atletaClassificacao = {
    ...inscricao,
    faixa_ordem: faixaOrdem,
  };

  const compativeis = buscarCategoriasCompativeis(
    atletaClassificacao,
    categorias
  );

  let novaCategoriaId = null;
  let novoStatus = 'PENDENTE';
  let mensagem = 'Inscrição reativada, mas nenhuma categoria compatível foi encontrada. Status definido como Pendente.';

  if (compativeis.length === 1) {
    novaCategoriaId = compativeis[0].id;
    novoStatus = 'CONFIRMADA';
    mensagem = `Inscrição reativada e classificada em "${compativeis[0].nome}".`;
  } else if (compativeis.length > 1) {
    // Se a categoria anterior ainda for compatível, mantém ela; senão pega a primeira
    const anterior = compativeis.find(
      (c) => Number(c.id) === Number(inscricao.categoria_id)
    );
    const escolhida = anterior || compativeis[0];
    novaCategoriaId = escolhida.id;
    novoStatus = 'CONFIRMADA';
    mensagem = `Inscrição reativada e classificada em "${escolhida.nome}".`;
  }

  await inscricaoRepository.alterarStatus(
    inscricao.id,
    inscricao.evento_id,
    novoStatus,
    novaCategoriaId
  );

  return {
    inscricao,
    mensagem,
  };
}

async function excluirInscricao(eventoId, inscricaoId) {
  const validEventoId = validarId(eventoId);
  const validInscricaoId = validarId(inscricaoId);

  if (!validEventoId || !validInscricaoId) {
    throw new NotFoundError('Inscrição não encontrada neste evento.');
  }

  await validarEventoExistente(validEventoId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inscricao = await inscricaoRepository.bloquearPorIdNoEvento(
      validInscricaoId,
      validEventoId,
      client
    );

    if (!inscricao) {
      throw new NotFoundError('Inscrição não encontrada neste evento.');
    }

    const emLuta = await inscricaoRepository.verificarParticipacaoEmLutas(
      validInscricaoId,
      client
    );
    if (emLuta) {
      throw new BusinessRuleError(
        'Esta inscrição não pode ser excluída porque já participa de lutas.'
      );
    }

    const possuiPontos = await inscricaoRepository.verificarPontosGerados(
      validInscricaoId,
      client
    );
    if (possuiPontos) {
      throw new BusinessRuleError(
        'Esta inscrição não pode ser excluída porque já possui pontuação de equipe gerada.'
      );
    }

    await inscricaoRepository.excluir(validInscricaoId, validEventoId, client);
    await client.query('COMMIT');
    return inscricao;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

module.exports = {
  listarInscricoes,
  prepararFormulario,
  buscarInscricao,
  processarCadastro,
  processarEdicao,
  cancelarInscricao,
  reativarInscricao,
  excluirInscricao,
};
