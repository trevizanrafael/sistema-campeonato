const express = require('express');
const equipeController = require('../controllers/equipeController');
const { exigirAutenticacao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

const router = express.Router();

router.use(exigirAutenticacao);

router.get('/', equipeController.listar);
router.get('/nova', equipeController.mostrarCadastro);
router.post('/', csrfProtection, equipeController.cadastrar);

router.get('/:id/editar', equipeController.mostrarEdicao);
router.post('/:id', csrfProtection, equipeController.editar);
router.post('/:id/excluir', csrfProtection, equipeController.excluir);

module.exports = router;
