const path = require('path');
const multer = require('multer');

const TAMANHO_MAXIMO_MB = 5;

/**
 * Upload de uma única planilha .xlsx, mantida em memória (não grava em disco).
 * Erros de upload não derrubam a requisição: ficam em req.erroUpload para o
 * controller exibir na própria tela.
 *
 * Importante: no formulário, o campo _csrf deve vir ANTES do arquivo, para que
 * o token já esteja em req.body mesmo quando o upload é interrompido.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: TAMANHO_MAXIMO_MB * 1024 * 1024,
    files: 1,
    fields: 10,
  },
  fileFilter(req, file, cb) {
    const extensao = path.extname(file.originalname || '').toLowerCase();
    if (extensao !== '.xlsx') {
      req.erroUpload = 'Formato não suportado. Envie um arquivo .xlsx (Excel).';
      return cb(null, false);
    }
    return cb(null, true);
  },
});

function receberPlanilha(campo) {
  const middleware = upload.single(campo);

  return (req, res, next) => {
    middleware(req, res, (erro) => {
      if (!erro) return next();

      if (erro instanceof multer.MulterError) {
        req.erroUpload =
          erro.code === 'LIMIT_FILE_SIZE'
            ? `O arquivo é muito grande. O limite é ${TAMANHO_MAXIMO_MB} MB.`
            : 'Não foi possível receber o arquivo. Tente novamente.';
        req.body = req.body || {};
        return next();
      }

      return next(erro);
    });
  };
}

module.exports = {
  receberPlanilha,
  TAMANHO_MAXIMO_MB,
};
