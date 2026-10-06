/**
 * Cargos e permissões do sistema.
 *
 * Este é o ÚNICO lugar onde se define quem pode fazer o quê.
 * Rotas usam `exigirPermissao('...')` e as views usam `pode('...')`.
 * Para mudar o acesso de um cargo, basta editar a matriz PERMISSOES abaixo.
 */

const CARGOS = Object.freeze({
  ADMINISTRADOR: 'ADMINISTRADOR',
  ORGANIZADOR: 'ORGANIZADOR',
  OPERADOR: 'OPERADOR',
});

const CARGOS_INFO = Object.freeze({
  ADMINISTRADOR: {
    nome: 'Administrador',
    descricao: 'Acesso total ao sistema, incluindo usuários e faixas.',
  },
  ORGANIZADOR: {
    nome: 'Organizador',
    descricao: 'Cria e gerencia campeonatos e academias. Não acessa usuários nem faixas.',
  },
  OPERADOR: {
    nome: 'Operador',
    descricao: 'Mesário: gera e opera as chaves, lança resultados e acompanha o ranking.',
  },
});

const { ADMINISTRADOR, ORGANIZADOR, OPERADOR } = CARGOS;
const TODOS = [ADMINISTRADOR, ORGANIZADOR, OPERADOR];
const GESTAO = [ADMINISTRADOR, ORGANIZADOR];

const PERMISSOES = Object.freeze({
  // Administração geral
  'usuarios.gerenciar': [ADMINISTRADOR],
  'faixas.gerenciar': [ADMINISTRADOR],
  'equipes.gerenciar': GESTAO,

  // Campeonatos
  'eventos.visualizar': TODOS,
  'eventos.gerenciar': GESTAO, // criar, editar e excluir campeonato
  'categorias.gerenciar': GESTAO,
  'inscricoes.gerenciar': GESTAO,
  'pontuacao.gerenciar': GESTAO,
  'auditoria.visualizar': GESTAO,

  // Chaves
  'chaves.visualizar': TODOS,
  'chaves.gerar': TODOS, // gerar e sortear novamente (só antes de iniciar)
  'chaves.gerenciar': GESTAO, // excluir chave e reabrir categoria

  // Operação de mesa (mesário)
  'lutas.operar': TODOS, // iniciar chave, lançar/corrigir/anular resultado, finalizar categoria

  // Ranking
  'ranking.visualizar': TODOS,
});

function cargoValido(cargo) {
  return Object.prototype.hasOwnProperty.call(CARGOS, cargo);
}

function temPermissao(cargo, permissao) {
  const permitidos = PERMISSOES[permissao];
  if (!permitidos) {
    // Permissão desconhecida: nega por segurança e avisa em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[permissoes] Permissão desconhecida: "${permissao}"`);
    }
    return false;
  }
  return permitidos.includes(cargo);
}

function nomeCargo(cargo) {
  return CARGOS_INFO[cargo] ? CARGOS_INFO[cargo].nome : cargo;
}

module.exports = {
  CARGOS,
  CARGOS_INFO,
  PERMISSOES,
  cargoValido,
  temPermissao,
  nomeCargo,
};
