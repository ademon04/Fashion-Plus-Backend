const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/webhook/:provider', 
  express.raw({type: 'application/json'}), 
  paymentController.handlePaymentWebhook
);

router.get('/providers', paymentController.getPaymentProviders);
router.post('/create-checkout', paymentController.createPaymentCheckout);

router.handleWebhookStripe = (req, res) => {
  req.params = { provider: 'stripe' }; // Set provider manualmente
  paymentController.handlePaymentWebhook(req, res);
};

module.exports = router;