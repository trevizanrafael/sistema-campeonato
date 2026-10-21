const express = require('express');
const chaveRapidaController = require('../controllers/chaveRapidaController');
const { exigirAutenticacao, exigirPermissao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

const router = express.Router({ mergeParams: true });

router.use(exigirAutenticacao);

const podeVer = exigirPermissao('chaves.visualizar');
const podeGerar = exigirPermissao('chaves.gerar');
const podeGerenciar = exigirPermissao('chaves.gerenciar');

// Formulário de nova chave rápida
router.get('/nova', podeGerar, chaveRapidaController.mostrarNova);

// Salvar criação da chave rápida
router.post('/', podeGerar, csrfProtection, chaveRapidaController.criar);

// Detalhes da chave rápida e gerenciamento de competidores
router.get('/:chaveRapidaId', podeVer, chaveRapidaController.mostrarDetalhes);

// Adicionar competidor na chave rápida
router.post(
  '/:chaveRapidaId/competidores',
  podeGerar,
  csrfProtection,
  chaveRapidaController.adicionarCompetidor
);

// Remover competidor da chave rápida
router.post(
  '/:chaveRapidaId/competidores/:inscritoId/remover',
  podeGerar,
  csrfProtection,
  chaveRapidaController.removerCompetidor
);

// Gerar chave eliminatória
router.post(
  '/:chaveRapidaId/gerar',
  podeGerar,
  csrfProtection,
  chaveRapidaController.gerarChave
);

// Excluir chave rápida
router.post(
  '/:chaveRapidaId/excluir',
  podeGerenciar,
  csrfProtection,
  chaveRapidaController.excluir
);

module.exports = router;
