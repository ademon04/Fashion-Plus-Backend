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
  console.log('🔍 DEBUG WEBHOOK - INICIANDO');
  console.log('📦 Body type:', typeof req.body);
  console.log('📦 Body keys:', Object.keys(req.body));
  console.log('📦 Body sample:', JSON.stringify(req.body).substring(0, 200));
  console.log('🔐 Signature:', req.headers['stripe-signature']);
  console.log('🔑 Secret configured:', !!process.env.STRIPE_WEBHOOK_SECRET);
  
  // Solo para debugging - mostrar el secret (oculto)
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    console.log('🔑 Secret starts with:', process.env.STRIPE_WEBHOOK_SECRET.substring(0, 10) + '...');
  }
  
  res.json({ testing: true, bodyType: typeof req.body });
};
module.exports = router;