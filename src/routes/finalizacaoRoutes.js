const express = require('express');
const finalizacaoController = require('../controllers/finalizacaoController');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

const router = express.Router({ mergeParams: true });

// Mostrar prévia da finalização
router.get('/finalizar', csrfProtection, finalizacaoController.mostrarPreview);

// Confirmar finalização da categoria
router.post('/finalizar', csrfProtection, finalizacaoController.finalizar);

// Reabrir categoria finalizada
router.post('/reabrir', csrfProtection, finalizacaoController.reabrir);

module.exports = router;
