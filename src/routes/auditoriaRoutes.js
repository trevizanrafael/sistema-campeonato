const express = require('express');
const router = express.Router({ mergeParams: true });
const auditoriaController = require('../controllers/auditoriaController');
const { exigirAutenticacao } = require('../middlewares/authMiddleware');

// Todas as rotas de auditoria exigem autenticação
router.use(exigirAutenticacao);

// Listar histórico de auditoria do evento
router.get('/', auditoriaController.listar);

// Ver detalhes de um log específico
router.get('/:logId', auditoriaController.detalhar);

module.exports = router;
