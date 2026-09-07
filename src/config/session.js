const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./database');

const sessionMiddleware = session({
  store: new pgSession({
    pool,
    tableName: 'user_sessions',
  }),
  name: 'lutas.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Number(process.env.SESSION_MAX_AGE) || 28800000,
  },
});

module.exports = sessionMiddleware;
