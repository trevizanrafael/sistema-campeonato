const pool = require('../config/database');
const eventoRepository = require('../repositories/eventoRepository');
const regraPontuacaoRepository = require('../repositories/regraPontuacaoRepository');
const categoriaService = require('./categoriaService');
const {
  normalizarEvento,
  validarEvento,
  validarId,
} = require('../validators/eventoValidator');
const {
  NotFoundError,
  ValidationError,
  BusinessRuleError,
} = require('../utils/errors');

async function listarEventos({ busca = '', pagina = 1, limite = 10 } = {}) {
  const buscaLimpa = typeof busca === 'string' ? busca.trim() : '';
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const limiteNum = Math.max(1, parseInt(limite, 10) || 10);
  const offset = (paginaNum - 1) * limiteNum;

  const total = await eventoRepository.contar({ busca: buscaLimpa });
  const eventos = await eventoRepository.listar({
    busca: buscaLimpa,
    limite: limiteNum,
    offset,
  });

  const totalPaginas = Math.ceil(total / limiteNum) || 1;

  return {
    eventos,
    busca: buscaLimpa,
    paginaAtual: paginaNum,
    totalPaginas,
    totalRegistros: total,
    limite: limiteNum,
  };
}

async function buscarEvento(id) {
  const validId = validarId(id);
  const evento = await eventoRepository.buscarPorId(validId);
  if (!evento) {
    throw new NotFoundError('Campeonato não encontrado.');
  }
  return evento;
}

async function buscarEventoComResumo(id) {
  const validId = validarId(id);
  const evento = await eventoRepository.buscarComResumo(validId);
  if (!evento) {
    throw new NotFoundError('Campeonato não encontrado.');
  }
  return evento;
}

function plural(n, singular, pluralTexto) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/**
 * Monta o painel do campeonato: etapas, cartão "próximo passo" e pendências.
 * @param {number|string} id - id do evento
 * @param {(permissao: string) => boolean} pode - checagem de permissão do usuário logado
 */
async function montarPainel(id, pode = () => true) {
  const validId = validarId(id);
  const evento = await eventoRepository.buscarPorId(validId);
  if (!evento) {
    throw new NotFoundError('Campeonato não encontrado.');
  }

  const p = await eventoRepository.buscarProgresso(validId);
  const { categorias: categoriasComSobreposicao } = await categoriaService.listarCategorias(validId);
  const sobreposicoes = categoriasComSobreposicao.filter((c) => c.temSobreposicao).length;

  const chavesPossiveis = p.chaves_total + p.categorias_prontas_sem_chave;
  const pontuacaoZerada = p.pontuacao_soma === 0;

  // ---------- Etapas ----------
  const etapas = [
    {
      titulo: 'Configuração',
      subtitulo: p.categorias === 0
        ? 'Nenhuma categoria'
        : plural(p.categorias, 'categoria', 'categorias'),
      feito: p.categorias > 0,
    },
    {
      titulo: 'Inscrições',
      subtitulo: p.inscricoes_sem_categoria > 0
        ? `${plural(p.inscricoes_total, 'atleta', 'atletas')} · ${p.inscricoes_sem_categoria} sem categoria`
        : plural(p.inscricoes_total, 'atleta', 'atletas'),
      feito: p.inscricoes_confirmadas > 0 && p.inscricoes_sem_categoria === 0,
    },
    {
      titulo: 'Chaves',
      subtitulo: chavesPossiveis === 0
        ? 'Nenhuma pronta'
        : `${p.chaves_total} de ${chavesPossiveis} geradas`,
      feito: p.chaves_total > 0 && p.categorias_prontas_sem_chave === 0,
    },
    {
      titulo: 'Lutas',
      subtitulo: p.lutas_total === 0
        ? 'Nenhuma iniciada'
        : `${p.lutas_finalizadas} de ${p.lutas_total} lutas`,
      feito: p.chaves_total > 0
        && p.chaves_nao_iniciadas === 0
        && p.lutas_total > 0
        && p.lutas_finalizadas === p.lutas_total,
    },
    {
      titulo: 'Pódio e Ranking',
      subtitulo: p.chaves_total === 0
        ? 'Aguardando chaves'
        : `${p.chaves_finalizadas} de ${chavesPossiveis} finalizadas`,
      feito: p.chaves_total > 0
        && p.categorias_prontas_sem_chave === 0
        && p.chaves_finalizadas === p.chaves_total,
    },
  ];

  let achouAtual = false;
  etapas.forEach((etapa, i) => {
    etapa.numero = i + 1;
    if (etapa.feito) {
      etapa.status = 'feito';
    } else if (!achouAtual) {
      etapa.status = 'atual';
      achouAtual = true;
    } else {
      etapa.status = 'proximo';
    }
  });

  // ---------- Próximo passo (primeira regra que se aplica e que o usuário pode executar) ----------
  const regras = [
    {
      quando: p.categorias === 0,
      permissao: 'categorias.gerenciar',
      titulo: 'Cadastre as categorias',
      texto: 'Defina faixa, idade e peso de cada categoria antes de receber inscrições.',
      acao: 'Nova categoria',
      path: '/categorias/nova',
    },
    {
      quando: p.inscricoes_total === 0,
      permissao: 'inscricoes.gerenciar',
      titulo: 'Cadastre as inscrições',
      texto: 'Adicione os atletas do campeonato. Eles serão encaixados nas categorias.',
      acao: 'Nova inscrição',
      path: '/inscricoes/nova',
    },
    {
      quando: p.inscricoes_sem_categoria > 0,
      permissao: 'inscricoes.gerenciar',
      titulo: `${plural(p.inscricoes_sem_categoria, 'atleta está', 'atletas estão')} sem categoria`,
      texto: 'Atletas sem categoria não entram em nenhuma chave. Resolva antes de gerar as chaves.',
      acao: 'Resolver agora',
      path: '/inscricoes?categoria_id=sem_categoria',
    },
    {
      quando: p.categorias_prontas_sem_chave > 0,
      permissao: 'chaves.gerar',
      titulo: `Gerar chaves de ${plural(p.categorias_prontas_sem_chave, 'categoria', 'categorias')}`,
      texto: 'Essas categorias já têm atletas confirmados suficientes para montar a chave.',
      acao: 'Ir para as chaves',
      path: '/chaves',
    },
    {
      quando: p.chaves_nao_iniciadas > 0,
      permissao: 'lutas.operar',
      titulo: `Iniciar ${plural(p.chaves_nao_iniciadas, 'chave', 'chaves')}`,
      texto: 'As chaves foram geradas, mas as lutas ainda não começaram.',
      acao: 'Ir para as chaves',
      path: '/chaves',
    },
    {
      quando: p.lutas_prontas > 0,
      permissao: 'lutas.operar',
      titulo: `${plural(p.lutas_prontas, 'luta pronta', 'lutas prontas')} para começar`,
      texto: 'Chame os atletas e lance o resultado assim que a luta terminar.',
      acao: 'Ir para as lutas',
      path: '/chaves',
    },
    {
      quando: p.chaves_prontas_finalizar > 0,
      permissao: 'lutas.operar',
      titulo: `Finalizar ${plural(p.chaves_prontas_finalizar, 'categoria', 'categorias')}`,
      texto: 'Todas as lutas terminaram. Confira o pódio e finalize para lançar os pontos no ranking.',
      acao: 'Ir para as chaves',
      path: '/chaves',
    },
    {
      quando: p.chaves_total > 0 && p.chaves_finalizadas === p.chaves_total && p.categorias_prontas_sem_chave === 0,
      permissao: 'ranking.visualizar',
      titulo: 'Campeonato concluído',
      texto: 'Todas as categorias foram finalizadas. Confira o ranking final das academias.',
      acao: 'Ver ranking',
      path: '/ranking',
    },
  ];

  const regra = regras.find((r) => r.quando && pode(r.permissao));
  const proximoPasso = regra
    ? { titulo: regra.titulo, texto: regra.texto, acao: regra.acao, path: regra.path }
    : {
      titulo: 'Nada para fazer agora',
      texto: 'Não há nenhuma ação pendente para o seu cargo neste momento.',
      acao: null,
      path: null,
    };

  // ---------- Pendências ----------
  const pendencias = [];
  if (p.inscricoes_sem_categoria > 0 && pode('inscricoes.gerenciar')) {
    pendencias.push({
      texto: `${plural(p.inscricoes_sem_categoria, 'atleta', 'atletas')} sem categoria`,
      path: '/inscricoes?categoria_id=sem_categoria',
    });
  }
  if (sobreposicoes > 0 && pode('categorias.gerenciar')) {
    pendencias.push({
      texto: `${plural(sobreposicoes, 'categoria se sobrepõe', 'categorias se sobrepõem')} a outra`,
      path: '/categorias',
    });
  }
  if (pontuacaoZerada && p.pontos_lancados === 0 && pode('pontuacao.gerenciar')) {
    pendencias.push({
      texto: 'Pontuação do ranking não configurada',
      path: '/pontuacao',
    });
  }
  if (p.categorias_um_atleta > 0 && pode('categorias.gerenciar')) {
    pendencias.push({
      texto: `${plural(p.categorias_um_atleta, 'categoria tem', 'categorias têm')} só 1 atleta (não gera chave)`,
      path: '/categorias',
    });
  }
  if (p.inscricoes_pendentes > 0 && pode('inscricoes.gerenciar')) {
    pendencias.push({
      texto: `${plural(p.inscricoes_pendentes, 'inscrição aguardando', 'inscrições aguardando')} confirmação`,
      path: '/inscricoes?status=PENDENTE',
    });
  }

  // ---------- Números ----------
  const numeros = [
    { label: 'Categorias', valor: p.categorias },
    { label: 'Atletas', valor: p.inscricoes_total },
    { label: 'Chaves', valor: p.chaves_total },
    { label: 'Lutas finalizadas', valor: `${p.lutas_finalizadas}/${p.lutas_total}` },
  ];

  // ---------- Atalhos (todas as áreas do campeonato, filtradas por cargo) ----------
  const atalhos = [
    {
      permissao: 'categorias.gerenciar',
      icone: 'categorias',
      titulo: 'Categorias',
      resumo: plural(p.categorias, 'categoria', 'categorias'),
      path: '/categorias',
    },
    {
      permissao: 'inscricoes.gerenciar',
      icone: 'inscricoes',
      titulo: 'Inscrições',
      resumo: plural(p.inscricoes_total, 'atleta', 'atletas'),
      path: '/inscricoes',
    },
    {
      permissao: 'chaves.visualizar',
      icone: 'chaves',
      titulo: 'Chaves',
      resumo: p.lutas_total > 0
        ? `${plural(p.chaves_total, 'chave', 'chaves')} · ${p.lutas_finalizadas}/${p.lutas_total} lutas`
        : plural(p.chaves_total, 'chave', 'chaves'),
      path: '/chaves',
    },
    {
      permissao: 'ranking.visualizar',
      icone: 'ranking',
      titulo: 'Ranking',
      resumo: `${p.chaves_finalizadas} de ${chavesPossiveis} categorias finalizadas`,
      path: '/ranking',
    },
    {
      permissao: 'pontuacao.gerenciar',
      icone: 'pontuacao',
      titulo: 'Pontuação',
      resumo: pontuacaoZerada ? 'Não configurada' : 'Configurada',
      path: '/pontuacao',
    },
    {
      permissao: 'auditoria.visualizar',
      icone: 'auditoria',
      titulo: 'Auditoria',
      resumo: 'Histórico de alterações',
      path: '/auditoria',
    },
  ].filter((a) => pode(a.permissao));

  return {
    evento,
    etapas,
    proximoPasso,
    pendencias,
    numeros,
    atalhos,
    progresso: p,
  };
}

const auditoriaService = require('./auditoriaService');

async function criarEvento(dados, usuarioId = null) {
  const normalizado = normalizarEvento(dados);
  const erros = validarEvento(normalizado);

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const evento = await eventoRepository.criar(normalizado, client);
    await regraPontuacaoRepository.criarPadrao(evento.id, client);

    await auditoriaService.registrar({
      usuarioId,
      eventoId: evento.id,
      acao: 'EVENTO_CRIADO',
      entidade: 'EVENTO',
      entidadeId: evento.id,
      descricao: `Campeonato "${evento.nome}" criado.`,
      dadosAnteriores: null,
      dadosNovos: {
        nome: evento.nome,
        descricao: evento.descricao,
      },
      client,
    });

    await client.query('COMMIT');
    return evento;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

async function editarEvento(id, dados, usuarioId = null) {
  const validId = validarId(id);
  const normalizado = normalizarEvento(dados);
  const erros = validarEvento(normalizado);

  if (Object.keys(erros).length > 0) {
    throw new ValidationError(erros);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventoAnterior = await eventoRepository.buscarPorId(validId, client);
    if (!eventoAnterior) {
      throw new NotFoundError('Campeonato não encontrado.');
    }

    const eventoAtualizado = await eventoRepository.atualizar(validId, normalizado, client);

    await auditoriaService.registrar({
      usuarioId,
      eventoId: validId,
      acao: 'EVENTO_EDITADO',
      entidade: 'EVENTO',
      entidadeId: validId,
      descricao: `Campeonato "${eventoAtualizado.nome}" editado.`,
      dadosAnteriores: {
        nome: eventoAnterior.nome,
        descricao: eventoAnterior.descricao,
      },
      dadosNovos: {
        nome: eventoAtualizado.nome,
        descricao: eventoAtualizado.descricao,
      },
      client,
    });

    await client.query('COMMIT');
    return eventoAtualizado;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

async function excluirEvento(id) {
  const validId = validarId(id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const bloqueado = await eventoRepository.bloquearPorId(validId, client);
    if (!bloqueado) {
      throw new NotFoundError('Campeonato não encontrado.');
    }

    const dependencias = await eventoRepository.contarDependencias(validId, client);
    const possuiDependencias =
      dependencias.total_categorias > 0 ||
      dependencias.total_inscricoes > 0 ||
      dependencias.total_pontos > 0;

    if (possuiDependencias) {
      throw new BusinessRuleError(
        'Este campeonato não pode ser excluído porque já possui categorias, inscrições ou resultados.'
      );
    }

    await eventoRepository.excluir(validId, client);
    await client.query('COMMIT');
    return true;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

module.exports = {
  listarEventos,
  buscarEvento,
  buscarEventoComResumo,
  montarPainel,
  criarEvento,
  editarEvento,
  excluirEvento,
};
