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
  try {
    console.log('🔍 DEBUG WEBHOOK - INICIANDO');
    console.log('📦 Body type:', typeof req.body);
    console.log('📦 Body keys:', Object.keys(req.body));
    
    // ✅ EL PROBLEMA: req.body es un objeto Buffer, no un Buffer crudo
    // ✅ SOLUCIÓN: Crear un Buffer real desde los datos
    let payload;
    if (req.body.type === 'Buffer' && Array.isArray(req.body.data)) {
      console.log('🔄 Convirtiendo objeto Buffer a Buffer real');
      payload = Buffer.from(req.body.data);
    } else {
      payload = req.body;
    }
    
    console.log('📦 Payload type después:', typeof payload);
    console.log('📦 Es Buffer real?', Buffer.isBuffer(payload));
    console.log('🔐 Signature:', req.headers['stripe-signature']);
    console.log('🔑 Secret configured:', !!process.env.STRIPE_WEBHOOK_SECRET);

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const signature = req.headers['stripe-signature'];
    
    // ✅ VERIFICACIÓN CON EL BUFFER REAL
    const event = stripe.webhooks.constructEvent(
      payload, // Ahora es un Buffer real
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log('✅ EVENTO VERIFICADO:', event.type);
    
    // Llamar al controller
    req.params = { provider: 'stripe' };
    req.body = event;
    
    return paymentController.handlePaymentWebhook(req, res);

  } catch (error) {
    console.error('❌ ERROR en handleWebhookStripe:', error.message);
    return res.status(400).json({ error: error.message });
  }
};
module.exports = router;