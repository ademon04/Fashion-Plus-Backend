const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth, adminAuth } = require('../middleware/auth');

// Públicas
router.post('/', orderController.createOrder);
router.post('/webhook', orderController.webhook);

// Protegidas (solo admin)
router.get('/', auth, adminAuth, orderController.getOrders);
router.put('/:id/status', auth, adminAuth, orderController.updateOrderStatus);

module.exports = router;