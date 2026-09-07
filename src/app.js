const express = require('express');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const sessionMiddleware = require('./config/session');
const flashMiddleware = require('./middlewares/flashMiddleware');
const { carregarDadosDasViews } = require('./middlewares/viewMiddleware');
const { csrfTokenMiddleware } = require('./middlewares/csrfMiddleware');
const authRoutes = require('./routes/authRoutes');
const homeRoutes = require('./routes/homeRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const eventoRoutes = require('./routes/eventoRoutes');
const faixaRoutes = require('./routes/faixaRoutes');
const equipeRoutes = require('./routes/equipeRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy em produção (necessário para cookies seguros atrás de proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Segurança
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Leitura de formulários
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Sessão
app.use(sessionMiddleware);

// Mensagens temporárias (flash)
app.use(flashMiddleware);

// Dados globais das views
app.use(carregarDadosDasViews);

// Token CSRF disponível em todos os templates
app.use(csrfTokenMiddleware);

// --- Rotas ---

// Auth (login/logout)
app.use(authRoutes);

// Página inicial e rotas de navegação protegidas
app.use(homeRoutes);

// Eventos — protegidas
app.use('/eventos', eventoRoutes);

// Faixas — protegidas
app.use('/faixas', faixaRoutes);

// Equipes — protegidas
app.use('/equipes', equipeRoutes);

// Usuários — protegidas
app.use('/usuarios', usuarioRoutes);

// --- Erros ---

// 403 — CSRF inválido
app.use((err, req, res, next) => {
  if (err.code === 'CSRF_INVALID' || err.message === 'invalid csrf token') {
    return res.status(403).render('errors/403', {
      titulo: 'Acesso não permitido',
    });
  }
  next(err);
});

// 404
app.use((req, res) => {
  res.status(404).render('errors/404', {
    titulo: 'Página não encontrada',
  });
});

// 500
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Erro:', err);
  }

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).render('errors/500', {
    titulo: 'Erro interno',
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});

module.exports = app;
