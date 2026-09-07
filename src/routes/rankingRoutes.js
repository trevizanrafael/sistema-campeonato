const express = require('express');
const rankingController = require('../controllers/rankingController');
const { exigirAutenticacao } = require('../middlewares/authMiddleware');

const router = express.Router({ mergeParams: true });

router.use(exigirAutenticacao);

// Mostrar ranking geral das equipes no evento
router.get('/', rankingController.mostrarRanking);

// Detalhar equipe e visualizar extrato de pontos
router.get('/equipes/:equipeId', rankingController.mostrarEquipe);

module.exports = router;
