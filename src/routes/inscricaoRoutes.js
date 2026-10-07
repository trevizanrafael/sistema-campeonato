const express = require('express');
const inscricaoController = require('../controllers/inscricaoController');
const inscricaoDocumentoController = require('../controllers/inscricaoDocumentoController');
const { exigirAutenticacao, exigirPermissao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');
const { receberPlanilha } = require('../middlewares/uploadMiddleware');

// mergeParams: true permite acessar :eventoId do roteador pai (eventoRoutes)
const router = express.Router({ mergeParams: true });

router.use(exigirAutenticacao, exigirPermissao('inscricoes.gerenciar'));

router.get('/', inscricaoController.listar);
router.get('/nova', inscricaoController.mostrarCadastro);
router.post('/', csrfProtection, inscricaoController.cadastrar);

// Inscrição por documento (planilha .xlsx) — antes de '/:id' para não colidir
router.get('/documento', inscricaoDocumentoController.mostrar);
router.get('/documento/modelo.xlsx', inscricaoDocumentoController.baixarModelo);
router.post(
  '/documento',
  receberPlanilha('arquivo'),
  csrfProtection,
  inscricaoDocumentoController.importar
);

router.get('/:id/editar', inscricaoController.mostrarEdicao);
router.post('/:id', csrfProtection, inscricaoController.editar);
router.post('/:id/cancelar', csrfProtection, inscricaoController.cancelar);
router.post('/:id/reativar', csrfProtection, inscricaoController.reativar);
router.post('/:id/excluir', csrfProtection, inscricaoController.excluir);

module.exports = router;
