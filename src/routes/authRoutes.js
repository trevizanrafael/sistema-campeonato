const express = require('express');
const authController = require('../controllers/authController');
const { exigirVisitante, exigirAutenticacao } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');
const rateLimit = require('express-rate-limit');

// Limitação de tentativas de login: 10 em 15 minutos em produção (1000 em dev/testes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  handler: (req, res) => {
    return res.status(429).render('auth/login', {
      layout: false,
      titulo: 'Entrar',
      email: req.body.email || '',
      erros: ['Muitas tentativas. Aguarde alguns minutos e tente novamente.'],
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

router.get('/login', exigirVisitante, authController.mostrarLogin);
router.post('/login', exigirVisitante, loginLimiter, csrfProtection, authController.entrar);
router.post('/logout', exigirAutenticacao, csrfProtection, authController.sair);

module.exports = router;
