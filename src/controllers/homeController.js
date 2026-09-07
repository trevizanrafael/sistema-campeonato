function index(req, res) {
  return res.render('home/index', {
    titulo: 'Inicio',
    subtitulo: 'Gerencie seus eventos e competicoes.',
  });
}

module.exports = {
  index,
};
