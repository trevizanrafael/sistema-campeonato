const express = require('express');
const eventoController = require('../controllers/eventoController');
const { exigirAutenticacao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

const router = express.Router();

router.use(exigirAutenticacao);

router.get('/', eventoController.listar);
router.get('/novo', eventoController.mostrarCadastro);
router.post('/', csrfProtection, eventoController.cadastrar);

router.get('/:id/editar', eventoController.mostrarEdicao);
router.post('/:id', csrfProtection, eventoController.editar);
router.post('/:id/excluir', csrfProtection, eventoController.excluir);

const categoriaRoutes = require('./categoriaRoutes');

// Rotas aninhadas de categorias (Fase 8)
router.use('/:eventoId/categorias', categoriaRoutes);

router.get('/:id/inscricoes', (req, res) => {
  res.render('components/emConstrucao', {
    titulo: 'Inscricoes',
    subtitulo: 'Cadastre e importe os competidores.',
  });
});

router.get('/:id/chaves', (req, res) => {
  res.render('components/emConstrucao', {
    titulo: 'Chaves',
    subtitulo: 'Gere e acompanhe as lutas.',
  });
});

router.get('/:id/ranking', (req, res) => {
  res.render('components/emConstrucao', {
    titulo: 'Ranking',
    subtitulo: 'Acompanhe os pontos das equipes.',
  });
});

router.get('/:id/pontuacao', (req, res) => {
  res.render('components/emConstrucao', {
    titulo: 'Pontuacao',
    subtitulo: 'Configure os pontos do evento.',
  });
});

router.get('/:id', eventoController.visualizar);

module.exports = router;
