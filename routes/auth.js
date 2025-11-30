const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// RUTAS PÚBLICAS
router.post('/register', authController.register);

router.post('/login', authController.login);
router.post('/logout', authController.logout);


// RUTA PROTEGIDA
router.get('/verify', auth, authController.verifyToken);

module.exports = router;