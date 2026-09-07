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

const chaveRoutes = require('./chaveRoutes');

// Rotas aninhadas de chaves e sorteios (Fase 11)
router.use('/:eventoId', chaveRoutes);

const rankingRoutes = require('./rankingRoutes');

// Rotas aninhadas de ranking (Fase 17)
router.use('/:eventoId/ranking', rankingRoutes);

const pontuacaoRoutes = require('./pontuacaoRoutes');

// Rotas aninhadas de pontuação (Fase 10)
router.use('/:eventoId/pontuacao', pontuacaoRoutes);

router.get('/:id', eventoController.visualizar);

module.exports = router;
