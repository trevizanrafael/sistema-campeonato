const express = require('express');
const homeController = require('../controllers/homeController');
const { exigirAutenticacao } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', exigirAutenticacao, homeController.index);


module.exports = router;
