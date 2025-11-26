const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Crear sesión de Checkout de Stripe
router.post('/create-checkout-session', async (req, res) => {
  try {
    console.log('🔵 Body recibido en /create-checkout-session:', JSON.stringify(req.body, null, 2));

    const { items, customer, successUrl, cancelUrl } = req.body;

    // Validaciones
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items son requeridos y deben ser un array no vacío' });
    }

    if (!customer) {
      return res.status(400).json({ error: 'Datos del cliente son requeridos' });
    }

    if (!customer.email) {
      return res.status(400).json({ error: 'El email del cliente es requerido' });
    }

    console.log('🛒 Creando sesión de Stripe para:', customer.email);

    // Preparar line_items
    const lineItems = items.map(item => {
      if (!item.price) {
        throw new Error(`El item ${item.product} no tiene precio`);
      }

      return {
        price_data: {
          currency: 'mxn',
          product_data: {
            name: `Producto ${item.product}`,
            description: `Talla: ${item.size}`,
          },
          unit_amount: Math.round(parseFloat(item.price) * 100),
        },
        quantity: item.quantity,
      };
    });

    // Crear sesión
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
        items: JSON.stringify(items)
      },
      shipping_address_collection: { allowed_countries: ['MX'] },
    });

    console.log('✅ Sesión creada:', session.id);

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

// Consultar estado de sesión
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
