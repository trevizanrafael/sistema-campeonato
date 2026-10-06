const eventoService = require('../services/eventoService');
const eventoRepository = require('../repositories/eventoRepository');
const { NotFoundError } = require('../utils/errors');

async function buscarUltimoEvento(usuario) {
  if (!usuario || !usuario.ultimo_evento_id) {
    return null;
  }
  try {
    return await eventoService.buscarEventoComResumo(usuario.ultimo_evento_id);
  } catch (erro) {
    // Evento removido entre um acesso e outro: apenas não mostra o atalho
    if (erro instanceof NotFoundError) {
      return null;
    }
    throw erro;
  }
}

async function index(req, res, next) {
  try {
    const usuario = res.locals.usuarioLogado;
    const ultimoEvento = await buscarUltimoEvento(usuario);

    // Sem último evento: oferece os campeonatos mais recentes para escolher rápido
    const eventosRecentes = ultimoEvento
      ? []
      : await eventoRepository.listar({ limite: 5, offset: 0 });

    return res.render('home/index', {
      titulo: 'Início',
      subtitulo: 'Gerencie seus campeonatos e competições.',
      ultimoEvento,
      eventosRecentes,
    });
  } catch (erro) {
    next(erro);
  }
}

module.exports = {
  index,
};
