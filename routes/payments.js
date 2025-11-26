// routes/payments.js
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Crear sesión de Checkout de Stripe
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { items, customer, successUrl, cancelUrl } = req.body;

    console.log('🛒 Creando sesión de Stripe para:', customer.email);

    // 1. Calcular total y preparar line_items para Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'mxn',
        product_data: {
          name: `Producto ${item.product}`,
          description: `Talla: ${item.size}`,
          // Aquí podrías agregar imágenes si las tienes
        },
        unit_amount: Math.round(parseFloat(item.price) * 100), // Convertir a centavos
      },
      quantity: item.quantity,
    }));

    // 2. Crear sesión de Checkout en Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customer.email,
      metadata: {
        customer_name: customer.name,
        customer_phone: customer.phone,
        shipping_address: `${customer.address}, ${customer.city}, ${customer.zipCode}`,
        // Guardar info de los items para el webhook
        items: JSON.stringify(items)
      },
      shipping_address_collection: {
        allowed_countries: ['MX'], // Solo México por ahora
      },
    });

    console.log('✅ Sesión de Stripe creada:', session.id);

    res.json({
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('❌ Error creando sesión de Stripe:', error);
    res.status(500).json({ 
      error: 'Error creando sesión de pago',
      message: error.message 
    });
  }
});

// Verificar estado de sesión
router.get('/session-status', async (req, res) => {
  try {
    const { session_id } = req.query;
    const session = await stripe.checkout.sessions.retrieve(session_id);

    res.json({
      status: session.status,
      customer_email: session.customer_details?.email,
      payment_status: session.payment_status,
    });
  } catch (error) {
    console.error('Error verificando sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;