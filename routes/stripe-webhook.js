const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const router = express.Router();

// ✅ SOLO raw body - nada de JSON parsing
router.post('/', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    console.log('🎯 STRIPE WEBHOOK DEDICADO - INICIANDO');
    console.log('📦 Body type:', typeof req.body);
    console.log('📦 Is Buffer:', Buffer.isBuffer(req.body));
    console.log('📦 Body length:', req.body?.length);
    console.log('🔐 Signature:', req.headers['stripe-signature'] ? 'PRESENTE' : 'FALTANTE');

    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      throw new Error('No Stripe signature found');
    }

    // ✅ VERIFICACIÓN DIRECTA CON EL BODY RAW
    const event = stripe.webhooks.constructEvent(
      req.body, // Este YA DEBE ser Buffer por express.raw
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log('✅ EVENTO STRIPE VERIFICADO:', event.type);

    // ✅ PROCESAR CHECKOUT COMPLETADO
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('💰 Checkout session completada:', session.id);
      console.log('📦 Metadata:', session.metadata);
      
      if (session.metadata?.order_id) {
        const order = await Order.findById(session.metadata.order_id);
        if (order) {
          order.status = 'confirmed';
          order.paymentStatus = 'paid';
          order.paymentProvider = 'stripe';
          order.paymentProviderId = session.id;
          await order.save();
          console.log(`✅ Orden ${order._id} actualizada via webhook`);
        } else {
          console.log('⚠️ Orden no encontrada:', session.metadata.order_id);
        }
      } else {
        console.log('⚠️ No order_id en metadata');
      }
    }

    res.json({ received: true, status: 'processed' });

  } catch (error) {
    console.error('❌ ERROR en stripe-webhook:', error.message);
    
    // ✅ IMPORTANTE: Responder 200 para que Stripe no reintente
    res.status(200).json({ 
      received: true, 
      error: error.message 
    });
  }
});

module.exports = router;