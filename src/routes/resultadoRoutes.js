const express = require('express');
const resultadoController = require('../controllers/resultadoController');
const { exigirAutenticacao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

const router = express.Router({ mergeParams: true });

router.use(exigirAutenticacao);

// Formulário de lançamento de resultado
router.get('/', resultadoController.mostrarFormulario);

// Salvar resultado
router.post('/', csrfProtection, resultadoController.salvar);

// Formulário de edição/correção de resultado
router.get('/editar', resultadoController.mostrarEdicao);

// Salvar correção de resultado
router.post('/editar', csrfProtection, resultadoController.corrigir);

// Anular resultado
router.post('/anular', csrfProtection, resultadoController.anular);

module.exports = router;
