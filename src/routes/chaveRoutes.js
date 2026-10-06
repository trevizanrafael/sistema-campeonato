const express = require('express');
const chaveController = require('../controllers/chaveController');
const { exigirAutenticacao, exigirPermissao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

const router = express.Router({ mergeParams: true });

router.use(exigirAutenticacao);

const podeVer = exigirPermissao('chaves.visualizar');
const podeGerar = exigirPermissao('chaves.gerar');
const podeGerenciar = exigirPermissao('chaves.gerenciar');
const podeOperar = exigirPermissao('lutas.operar');

// Listar categorias e chaves do evento
router.get('/chaves', podeVer, chaveController.listar);

// Gerar chave para uma categoria
router.post(
  '/categorias/:categoriaId/chave/gerar',
  podeGerar,
  csrfProtection,
  chaveController.gerar
);

// Abrir visualização da chave
router.get('/chaves/:chaveId', podeVer, chaveController.mostrar);

// Sortear novamente (apenas se NAO_INICIADA)
router.post(
  '/chaves/:chaveId/sortear',
  podeGerar,
  csrfProtection,
  chaveController.sortear
);

// Iniciar chave e avançar byes (apenas se NAO_INICIADA)
router.post(
  '/chaves/:chaveId/iniciar',
  podeOperar,
  csrfProtection,
  chaveController.iniciar
);

// Excluir chave (apenas se NAO_INICIADA)
router.post(
  '/chaves/:chaveId/excluir',
  podeGerenciar,
  csrfProtection,
  chaveController.excluir
);

// Lançamento de resultados de lutas (Fase 13 e 14)
const resultadoRoutes = require('./resultadoRoutes');
router.use('/chaves/:chaveId/lutas/:lutaId/resultado', resultadoRoutes);

// Finalização de categoria e pódio (Fase 15)
const finalizacaoRoutes = require('./finalizacaoRoutes');
router.use('/chaves/:chaveId', finalizacaoRoutes);

module.exports = router;
