const marcas = {
  base: require('./brands/base'),
  'araujo-jj-team': require('./brands/araujo-jj-team'),
};

const temaSelecionado = process.env.APP_THEME || 'base';

module.exports = marcas[temaSelecionado] || marcas.base;
