// Crea routes/sessions.js con este contenido:
const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

// Públicas - para carritos anónimos
router.post('/', sessionController.createSession);
router.get('/:id', sessionController.getSession);
router.put('/:id/cart', sessionController.updateSessionCart);

module.exports = router;