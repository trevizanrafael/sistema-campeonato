const express = require('express');
const categoriaController = require('../controllers/categoriaController');
const { exigirAutenticacao, exigirPermissao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

// mergeParams: true permite acessar :eventoId definido no roteador pai (eventoRoutes)
const router = express.Router({ mergeParams: true });

router.use(exigirAutenticacao);

// Permissão aplicada POR ROTA (e não em router.use) de propósito:
// /eventos/:id/categorias/:categoriaId/chave/gerar pertence ao chaveRoutes e
// precisa "passar direto" por este roteador sem ser bloqueado aqui.
const podeGerenciar = exigirPermissao('categorias.gerenciar');

router.get('/', podeGerenciar, categoriaController.listar);
router.get('/nova', podeGerenciar, categoriaController.mostrarCadastro);
router.post('/', podeGerenciar, csrfProtection, categoriaController.cadastrar);

router.get('/:id/editar', podeGerenciar, categoriaController.mostrarEdicao);
router.post('/:id', podeGerenciar, csrfProtection, categoriaController.editar);
router.post('/:id/excluir', podeGerenciar, csrfProtection, categoriaController.excluir);

module.exports = router;
