const eventoService = require('./eventoService');
const rankingRepository = require('../repositories/rankingRepository');
const { NotFoundError } = require('../utils/errors');

/**
 * Serviço responsável pelo cálculo e formatação do ranking de equipes.
 */

function formatarTipoPonto(tipo) {
  const nomes = {
    VITORIA: 'Vitória',
    PRIMEIRO_LUGAR: 'Primeiro lugar',
    SEGUNDO_LUGAR: 'Segundo lugar',
    TERCEIRO_LUGAR: 'Terceiro lugar',
  };

  return nomes[tipo] || tipo;
}

function formatarPontos(valor) {
  const numero = Number(valor);
  return numero > 0 ? `+${numero}` : String(numero);
}

function calcularSituacao(dados = {}) {
  const total = Number(dados.total_chaves) || 0;
  const finalizadas = Number(dados.finalizadas) || 0;

  if (total === 0) {
    return 'NAO_INICIADO';
  }

  if (total === finalizadas) {
    return 'FINAL';
  }

  return 'PARCIAL';
}

function atribuirPosicoes(equipes = []) {
  let anterior = null;
  let posicaoAnterior = 0;

  return equipes.map((equipe, index) => {
    const empatou =
      anterior !== null &&
      Number(equipe.total_pontos) === Number(anterior.total_pontos) &&
      Number(equipe.ouros) === Number(anterior.ouros) &&
      Number(equipe.pratas) === Number(anterior.pratas) &&
      Number(equipe.bronzes) === Number(anterior.bronzes) &&
      Number(equipe.vitorias) === Number(anterior.vitorias);

    const posicao = empatou ? posicaoAnterior : index + 1;

    anterior = equipe;
    posicaoAnterior = posicao;

    return {
      ...equipe,
      posicao,
    };
  });
}

async function buscarRanking(eventoId) {
  const evento = await eventoService.buscarEvento(eventoId);
  const equipesBrutas = await rankingRepository.buscarRanking(evento.id);
  const situacaoDados = await rankingRepository.buscarSituacao(evento.id);

  const situacao = calcularSituacao(situacaoDados);
  const equipes = atribuirPosicoes(equipesBrutas);

  return {
    evento,
    situacao,
    equipes,
  };
}

async function buscarDetalhesEquipe(eventoId, equipeId) {
  const evento = await eventoService.buscarEvento(eventoId);
  const equipeExiste = await rankingRepository.buscarEquipeNoEvento(evento.id, equipeId);

  if (!equipeExiste) {
    throw new NotFoundError('Equipe não encontrada neste evento.');
  }

  const { equipes } = await buscarRanking(evento.id);
  const equipeResumo = equipes.find(
    (eq) => String(eq.equipe_id) === String(equipeId)
  ) || {
    equipe_id: equipeExiste.id,
    equipe_nome: equipeExiste.nome,
    posicao: null,
    total_pontos: 0,
    pontos_vitorias: 0,
    pontos_colocacoes: 0,
    ouros: 0,
    pratas: 0,
    bronzes: 0,
    vitorias: 0,
    byes: 0,
  };

  const extratoBruto = await rankingRepository.buscarExtratoEquipe(evento.id, equipeId);
  const extrato = extratoBruto.map((item) => ({
    ...item,
    tipo_formatado: formatarTipoPonto(item.tipo),
    pontos_formatado: formatarPontos(item.pontos),
  }));

  return {
    evento,
    equipe: equipeResumo,
    extrato,
  };
}

module.exports = {
  formatarTipoPonto,
  formatarPontos,
  calcularSituacao,
  atribuirPosicoes,
  buscarRanking,
  buscarDetalhesEquipe,
};
