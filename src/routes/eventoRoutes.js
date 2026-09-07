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
const inscricaoRoutes = require('./inscricaoRoutes');

// Rotas aninhadas de categorias (Fase 8)
router.use('/:eventoId/categorias', categoriaRoutes);

// Rotas aninhadas de inscrições (Fase 9)
router.use('/:eventoId/inscricoes', inscricaoRoutes);

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

const pontuacaoRoutes = require('./pontuacaoRoutes');

// Rotas aninhadas de pontuação (Fase 10)
router.use('/:eventoId/pontuacao', pontuacaoRoutes);

router.get('/:id', eventoController.visualizar);

module.exports = router;
