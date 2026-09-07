const express = require('express');
const inscricaoController = require('../controllers/inscricaoController');
const { exigirAutenticacao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

// mergeParams: true permite acessar :eventoId do roteador pai (eventoRoutes)
const router = express.Router({ mergeParams: true });

router.use(exigirAutenticacao);

router.get('/', inscricaoController.listar);
router.get('/nova', inscricaoController.mostrarCadastro);
router.post('/', csrfProtection, inscricaoController.cadastrar);

router.get('/:id/editar', inscricaoController.mostrarEdicao);
router.post('/:id', csrfProtection, inscricaoController.editar);
router.post('/:id/cancelar', csrfProtection, inscricaoController.cancelar);
router.post('/:id/reativar', csrfProtection, inscricaoController.reativar);
router.post('/:id/excluir', csrfProtection, inscricaoController.excluir);

module.exports = router;
