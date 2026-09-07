const express = require('express');
const chaveController = require('../controllers/chaveController');
const { exigirAutenticacao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

const router = express.Router({ mergeParams: true });

router.use(exigirAutenticacao);

// Listar categorias e chaves do evento
router.get('/chaves', chaveController.listar);

// Gerar chave para uma categoria
router.post(
  '/categorias/:categoriaId/chave/gerar',
  csrfProtection,
  chaveController.gerar
);

// Abrir visualização da chave
router.get('/chaves/:chaveId', chaveController.mostrar);

// Sortear novamente (apenas se NAO_INICIADA)
router.post(
  '/chaves/:chaveId/sortear',
  csrfProtection,
  chaveController.sortear
);

// Iniciar chave e avançar byes (apenas se NAO_INICIADA)
router.post(
  '/chaves/:chaveId/iniciar',
  csrfProtection,
  chaveController.iniciar
);

// Excluir chave (apenas se NAO_INICIADA)
router.post(
  '/chaves/:chaveId/excluir',
  csrfProtection,
  chaveController.excluir
);

module.exports = router;
