const express = require('express');
const homeController = require('../controllers/homeController');
const { exigirAutenticacao } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', exigirAutenticacao, homeController.index);

// Rotas provisórias para navegação da sidebar sem erro 404
router.get('/eventos', exigirAutenticacao, (req, res) => {
  res.render('components/emConstrucao', {
    titulo: 'Eventos',
    subtitulo: 'Gerencie os campeonatos cadastrados.',
  });
});

router.get('/equipes', exigirAutenticacao, (req, res) => {
  res.render('components/emConstrucao', {
    titulo: 'Equipes',
    subtitulo: 'Gerencie as equipes participantes.',
  });
});

module.exports = router;
