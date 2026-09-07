const express = require('express');
const categoriaController = require('../controllers/categoriaController');
const { exigirAutenticacao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

// mergeParams: true permite acessar :eventoId definido no roteador pai (eventoRoutes)
const router = express.Router({ mergeParams: true });

router.use(exigirAutenticacao);

router.get('/', categoriaController.listar);
router.get('/nova', categoriaController.mostrarCadastro);
router.post('/', csrfProtection, categoriaController.cadastrar);

router.get('/:id/editar', categoriaController.mostrarEdicao);
router.post('/:id', csrfProtection, categoriaController.editar);
router.post('/:id/excluir', csrfProtection, categoriaController.excluir);

module.exports = router;
