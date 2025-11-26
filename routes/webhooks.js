const express = require('express');
const paymentController = require('../controllers/paymentController');
const router = express.Router();

// ✅ WEBHOOK STRIPE - SOLO RAW BODY
router.post('/stripe', 
  express.raw({type: 'application/json'}), 
  (req, res) => {
    console.log('🔵 WEBHOOK STRIPE - Body type:', typeof req.body);
    console.log('🔵 WEBHOOK STRIPE - Is Buffer:', Buffer.isBuffer(req.body));
    req.params = { provider: 'stripe' };
    return paymentController.handlePaymentWebhook(req, res);
  }
);

module.exports = router;