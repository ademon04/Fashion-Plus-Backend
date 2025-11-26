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
    console.log('🟢 HANDLE WEBHOOK STRIPE - Body type:', typeof req.body);
    console.log('🟢 HANDLE WEBHOOK STRIPE - Is Buffer:', Buffer.isBuffer(req.body));
    
    // ✅ Asegurar que el body sea Buffer
    let payload = req.body;
    if (!Buffer.isBuffer(payload)) {
      console.log('⚠️  Convertiendo body a Buffer');
      payload = Buffer.from(JSON.stringify(payload));
    }
    
    console.log('🟢 PAYLOAD length:', payload.length);
    
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const signature = req.headers['stripe-signature'];
    
    console.log('🟢 SIGNATURE:', signature ? 'PRESENTE' : 'FALTANTE');
    console.log('🟢 WEBHOOK SECRET:', process.env.STRIPE_WEBHOOK_SECRET ? 'CONFIGURADO' : 'FALTANTE');
    
    // ✅ Verificar webhook con el payload correcto
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    console.log('✅ EVENTO VERIFICADO:', event.type);
    
    // ✅ Llamar al controller con el evento verificado
    req.params = { provider: 'stripe' };
    req.body = event;
    
    return paymentController.handlePaymentWebhook(req, res);
    
  } catch (error) {
    console.error('❌ ERROR en handleWebhookStripe:', error.message);
    return res.status(400).json({ error: error.message });
  }
};

module.exports = router;