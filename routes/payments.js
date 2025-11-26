const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { auth } = require('../middleware/auth');

router.get('/providers', paymentController.getPaymentProviders);
router.post('/create-checkout', auth, paymentController.createPaymentCheckout);
router.post('/webhook/:provider', paymentController.handlePaymentWebhook);

module.exports = router;