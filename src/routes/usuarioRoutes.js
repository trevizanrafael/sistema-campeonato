const express = require('express');
const usuarioController = require('../controllers/usuarioController');
const { exigirAutenticacao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

const router = express.Router();

// Todas as rotas exigem autenticação
router.use(exigirAutenticacao);

// Listagem
router.get('/', usuarioController.listar);

// Cadastro — /novo ANTES de /:id
router.get('/novo', usuarioController.mostrarCadastro);
router.post('/', csrfProtection, usuarioController.cadastrar);

// Edição
router.get('/:id/editar', usuarioController.mostrarEdicao);
router.post('/:id', csrfProtection, usuarioController.editar);

// Senha
router.get('/:id/senha', usuarioController.mostrarAlteracaoSenha);
router.post('/:id/senha', csrfProtection, usuarioController.alterarSenha);

// Ativar / Desativar
router.post('/:id/ativar', csrfProtection, usuarioController.ativar);
router.post('/:id/desativar', csrfProtection, usuarioController.desativar);

module.exports = router;
