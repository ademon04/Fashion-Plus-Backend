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
    console.log('🎯 WEBHOOK STRIPE - PROCESANDO');
    console.log('📦 Body type:', typeof req.body);
    console.log('📦 Body keys:', Object.keys(req.body));

    // Reconstruir el Buffer desde el objeto serializado
    let payload = req.body;
    if (req.body && req.body.type === 'Buffer' && Array.isArray(req.body.data)) {
      console.log('🔧 Reconstruyendo Buffer desde datos serializados...');
      payload = Buffer.from(req.body.data);
      console.log('📦 Buffer reconstruido - length:', payload.length);
      console.log('📦 Is Buffer real:', Buffer.isBuffer(payload));
    } else {
      // Si no es un objeto Buffer serializado, intentar convertirlo de otra forma
      console.log('⚠️  El body no es un objeto Buffer serializado. Intentando convertir...');
      if (typeof req.body === 'string') {
        payload = Buffer.from(req.body);
      } else if (typeof req.body === 'object') {
        payload = Buffer.from(JSON.stringify(req.body));
      } else {
        payload = req.body;
      }
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const signature = req.headers['stripe-signature'];
    
    console.log('🔐 Signature:', signature);
    console.log('🔑 Secret starts with:', process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 15) + '...');

    // Verificación con el payload reconstruido
    const event = stripe.webhooks.constructEvent(
      payload,
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