const express = require('express');
const helmet = require('helmet');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

const sessionMiddleware = require('./config/session');
const flashMiddleware = require('./middlewares/flashMiddleware');
const { csrfTokenMiddleware } = require('./middlewares/csrfMiddleware');
const { exigirAutenticacao } = require('./middlewares/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy em produção (necessário para cookies seguros atrás de proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/layout');

// Segurança
app.use(helmet());

// Leitura de formulários
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Sessão
app.use(sessionMiddleware);

// Mensagens temporárias (flash)
app.use(flashMiddleware);

// Token CSRF disponível em todos os templates
app.use(csrfTokenMiddleware);

// --- Rotas ---

// Auth (login/logout)
app.use(authRoutes);

// Página inicial — protegida
app.get('/', exigirAutenticacao, (req, res) => {
  res.render('home', {
    titulo: 'Início',
  });
});

// Usuários — protegidas
app.use('/usuarios', usuarioRoutes);

// --- Erros ---

// 403 — CSRF inválido
app.use((err, req, res, next) => {
  if (err.code === 'CSRF_INVALID' || err.message === 'invalid csrf token') {
    return res.status(403).render('errors/403', {
      titulo: 'Acesso Negado',
    });
  }
  next(err);
});

// 404
app.use((req, res) => {
  res.status(404).render('errors/404', {
    titulo: 'Não Encontrado',
  });
});

// 500
app.use((err, req, res, _next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Erro:', err);
  }

  res.status(500).render('errors/500', {
    titulo: 'Erro Interno',
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});

module.exports = app;
