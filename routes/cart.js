const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { auth } = require('../middleware/auth');

// Todas protegidas
router.post('/add', auth, cartController.addToCart);
router.get('/', auth, cartController.getCart);
router.delete('/remove/:itemId', auth, cartController.removeFromCart);

module.exports = router;

