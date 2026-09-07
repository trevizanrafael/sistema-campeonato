const express = require('express');
const faixaController = require('../controllers/faixaController');
const { exigirAutenticacao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

const router = express.Router();

router.use(exigirAutenticacao);

router.get('/', faixaController.listar);
router.get('/nova', faixaController.mostrarCadastro);
router.post('/', csrfProtection, faixaController.cadastrar);

router.get('/:id/editar', faixaController.mostrarEdicao);
router.post('/:id', csrfProtection, faixaController.editar);
router.post('/:id/subir', csrfProtection, faixaController.subir);
router.post('/:id/descer', csrfProtection, faixaController.descer);
router.post('/:id/excluir', csrfProtection, faixaController.excluir);

module.exports = router;
