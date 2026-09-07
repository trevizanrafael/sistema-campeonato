const auditoriaRepository = require('../repositories/auditoriaRepository');
const eventoRepository = require('../repositories/eventoRepository');
const { NotFoundError } = require('../utils/errors');

/**
 * Serviço responsável pelo gerenciamento de auditoria e histórico de ações críticas.
 */

const ACOES_INFO = {
  EVENTO_CRIADO: { label: 'Evento criado', badge: 'badge-neutral' },
  EVENTO_EDITADO: { label: 'Evento editado', badge: 'badge-neutral' },
  INSCRICAO_CRIADA: { label: 'Inscrição criada', badge: 'badge-neutral' },
  INSCRICAO_EDITADA: { label: 'Inscrição editada', badge: 'badge-neutral' },
  INSCRICAO_CANCELADA: { label: 'Inscrição cancelada', badge: 'badge-danger' },
  INSCRICAO_REATIVADA: { label: 'Inscrição reativada', badge: 'badge-success' },
  INSCRICAO_EXCLUIDA: { label: 'Inscrição excluída', badge: 'badge-danger' },
  CHAVE_GERADA: { label: 'Chave gerada', badge: 'badge-neutral' },
  CHAVE_SORTEADA_NOVAMENTE: { label: 'Chave sorteada novamente', badge: 'badge-warning' },
  CHAVE_INICIADA: { label: 'Chave iniciada', badge: 'badge-primary' },
  CHAVE_EXCLUIDA: { label: 'Chave excluída', badge: 'badge-danger' },
  RESULTADO_LANCADO: { label: 'Resultado lançado', badge: 'badge-primary' },
  RESULTADO_CORRIGIDO: { label: 'Resultado corrigido', badge: 'badge-warning' },
  RESULTADO_ANULADO: { label: 'Resultado anulado', badge: 'badge-danger' },
  CATEGORIA_FINALIZADA: { label: 'Categoria finalizada', badge: 'badge-success' },
  CATEGORIA_REABERTA: { label: 'Categoria reaberta', badge: 'badge-warning' },
};

const CAMPOS_SENSIVEIS = new Set([
  'senha',
  'senha_hash',
  'token',
  'token_csrf',
  '_csrf',
  'cookie',
  'sessao_id',
  'session_id',
  'secret',
]);

function sanitizarObjeto(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizarObjeto);
  }

  const limpo = {};
  for (const [chave, valor] of Object.entries(obj)) {
    const chaveLower = chave.toLowerCase();
    if (CAMPOS_SENSIVEIS.has(chaveLower)) {
      continue;
    }
    if (valor && typeof valor === 'object') {
      limpo[chave] = sanitizarObjeto(valor);
    } else {
      limpo[chave] = valor;
    }
  }
  return limpo;
}

async function registrar({
  usuarioId = null,
  eventoId = null,
  acao,
  entidade,
  entidadeId = null,
  descricao,
  dadosAnteriores = null,
  dadosNovos = null,
  client = null,
}) {
  if (!acao || !entidade || !descricao) {
    throw new Error('Ação, entidade e descrição são obrigatórios para auditoria.');
  }

  const dadosLimposAnteriores = sanitizarObjeto(dadosAnteriores);
  const dadosLimposNovos = sanitizarObjeto(dadosNovos);

  return await auditoriaRepository.registrar(
    {
      usuario_id: usuarioId,
      evento_id: eventoId,
      acao,
      entidade,
      entidade_id: entidadeId,
      descricao,
      dados_anteriores: dadosLimposAnteriores,
      dados_novos: dadosLimposNovos,
    },
    client
  );
}

async function listarAuditoria(eventoId, { acao = '', usuarioId = null, pagina = 1, limite = 25 } = {}) {
  const evento = await eventoRepository.buscarPorId(eventoId);
  if (!evento) {
    throw new NotFoundError('Evento não encontrado.');
  }

  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const limiteNum = Math.max(1, Math.min(100, parseInt(limite, 10) || 25));
  const offset = (paginaNum - 1) * limiteNum;

  const filtros = {
    acao: typeof acao === 'string' ? acao.trim() : '',
    usuario_id: usuarioId,
    limite: limiteNum,
    offset,
  };

  const [logs, total] = await Promise.all([
    auditoriaRepository.listarPorEvento(eventoId, filtros),
    auditoriaRepository.contarPorEvento(eventoId, filtros),
  ]);

  const totalPaginas = Math.ceil(total / limiteNum) || 1;

  const logsFormatados = logs.map((log) => {
    const infoAcao = ACOES_INFO[log.acao] || {
      label: log.acao,
      badge: 'badge-neutral',
    };
    return {
      ...log,
      acao_label: infoAcao.label,
      acao_badge: infoAcao.badge,
    };
  });

  return {
    evento,
    logs: logsFormatados,
    acoesDisponiveis: ACOES_INFO,
    filtros: {
      acao: filtros.acao,
    },
    paginacao: {
      paginaAtual: paginaNum,
      totalPaginas,
      totalRegistros: total,
      limite: limiteNum,
    },
  };
}

async function buscarDetalhes(eventoId, logId) {
  const evento = await eventoRepository.buscarPorId(eventoId);
  if (!evento) {
    throw new NotFoundError('Evento não encontrado.');
  }

  const log = await auditoriaRepository.buscarPorIdNoEvento(logId, eventoId);
  if (!log) {
    throw new NotFoundError('Registro de auditoria não encontrado neste evento.');
  }

  const infoAcao = ACOES_INFO[log.acao] || {
    label: log.acao,
    badge: 'badge-neutral',
  };

  return {
    evento,
    log: {
      ...log,
      acao_label: infoAcao.label,
      acao_badge: infoAcao.badge,
    },
  };
}

module.exports = {
  ACOES_INFO,
  sanitizarObjeto,
  registrar,
  listarAuditoria,
  buscarDetalhes,
};
