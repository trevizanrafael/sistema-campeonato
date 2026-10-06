const express = require('express');
const pontuacaoController = require('../controllers/pontuacaoController');
const { exigirAutenticacao, exigirPermissao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

// mergeParams: true permite acessar :eventoId do roteador pai
const router = express.Router({ mergeParams: true });

router.use(exigirAutenticacao, exigirPermissao('pontuacao.gerenciar'));

router.get('/', pontuacaoController.mostrar);
router.post('/', csrfProtection, pontuacaoController.atualizar);

module.exports = router;
