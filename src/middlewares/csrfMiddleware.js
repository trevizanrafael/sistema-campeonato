const { csrfSync } = require('csrf-sync');

const {
  csrfSynchronisedProtection,
  generateToken,
} = csrfSync({
  getTokenFromRequest: (req) => req.body._csrf || req.headers['x-csrf-token'],
  getTokenFromState: (req) => req.session.csrfToken,
  storeTokenInState: (req, token) => { req.session.csrfToken = token; },
  size: 64,
});

// Middleware que disponibiliza o token para os templates EJS
function csrfTokenMiddleware(req, res, next) {
  const token = generateToken(req);
  res.locals.csrfToken = token;
  next();
}

module.exports = {
  csrfProtection: csrfSynchronisedProtection,
  csrfTokenMiddleware,
};
