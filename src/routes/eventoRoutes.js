const express = require('express');
const eventoController = require('../controllers/eventoController');
const {
  exigirAutenticacao,
  exigirPermissao,
  registrarUltimoEvento,
} = require('../middlewares/authMiddleware');
const { carregarContextoEvento } = require('../middlewares/eventoContextoMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

const router = express.Router();

router.use(exigirAutenticacao);

const podeVer = exigirPermissao('eventos.visualizar');
const podeGerenciar = exigirPermissao('eventos.gerenciar');

router.get('/', podeVer, eventoController.listar);
router.get('/novo', podeGerenciar, eventoController.mostrarCadastro);
router.post('/', podeGerenciar, csrfProtection, eventoController.cadastrar);

// Memoriza o último campeonato aberto e carrega o contexto (menu lateral/trilha)
// para qualquer rota /eventos/:id/...
router.use('/:eventoId', registrarUltimoEvento, carregarContextoEvento);

router.get('/:id/editar', podeGerenciar, eventoController.mostrarEdicao);
router.post('/:id', podeGerenciar, csrfProtection, eventoController.editar);
router.post('/:id/excluir', podeGerenciar, csrfProtection, eventoController.excluir);

const categoriaRoutes = require('./categoriaRoutes');
const inscricaoRoutes = require('./inscricaoRoutes');

// Rotas aninhadas de categorias (Fase 8)
router.use('/:eventoId/categorias', categoriaRoutes);

// Rotas aninhadas de inscrições (Fase 9)
router.use('/:eventoId/inscricoes', inscricaoRoutes);

const chaveRoutes = require('./chaveRoutes');
const chaveRapidaRoutes = require('./chaveRapidaRoutes');

// Rotas aninhadas de chaves e sorteios (Fase 11)
router.use('/:eventoId', chaveRoutes);

// Rotas aninhadas de chaves rápidas
router.use('/:eventoId/chaves-rapidas', chaveRapidaRoutes);

const rankingRoutes = require('./rankingRoutes');

// Rotas aninhadas de ranking (Fase 17)
router.use('/:eventoId/ranking', rankingRoutes);

const pontuacaoRoutes = require('./pontuacaoRoutes');

// Rotas aninhadas de pontuação (Fase 10)
router.use('/:eventoId/pontuacao', pontuacaoRoutes);

const auditoriaRoutes = require('./auditoriaRoutes');

// Rotas aninhadas de auditoria (Fase 18)
router.use('/:eventoId/auditoria', auditoriaRoutes);

router.get('/:id', podeVer, eventoController.visualizar);

module.exports = router;
