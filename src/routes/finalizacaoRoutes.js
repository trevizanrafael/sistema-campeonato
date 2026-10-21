const express = require('express');
const finalizacaoController = require('../controllers/finalizacaoController');
const { exigirPermissao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

const router = express.Router({ mergeParams: true });

const podeOperar = exigirPermissao('lutas.operar');
const podeGerenciar = exigirPermissao('chaves.gerenciar');

// Mostrar prévia da finalização
router.get('/finalizar', podeOperar, csrfProtection, finalizacaoController.mostrarPreview);

// Confirmar finalização da categoria
router.post('/finalizar', podeOperar, csrfProtection, finalizacaoController.finalizar);

// Reabrir categoria finalizada
router.post('/reabrir', podeGerenciar, csrfProtection, finalizacaoController.reabrir);

module.exports = router;
