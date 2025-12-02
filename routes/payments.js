const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order'); // ✅ IMPORTAR MODELO

// Crear sesión de Checkout de Stripe
router.post('/create-checkout-session', async (req, res) => {
  try {
    console.log('🔵 Body recibido en /create-checkout-session:', JSON.stringify(req.body, null, 2));

    // ✅ RECIBIR orderId DEL FRONTEND (NUEVO)
    const { orderId, items, customer, successUrl, cancelUrl } = req.body;

    // ✅ VALIDAR QUE orderId EXISTA (NUEVO)
    if (!orderId) {
      return res.status(400).json({ 
        error: 'orderId es requerido. Crea la orden primero en /api/orders' 
      });
    }

    // ✅ BUSCAR LA ORDEN EN MONGODB (NUEVO)
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        error: 'Orden no encontrada. Verifica que la orden exista en la base de datos' 
      });
    }

    console.log('✅ Orden encontrada:', order._id, 'PaymentMethod:', order.paymentMethod);

    // Validaciones (EXISTENTES)
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

    // Preparar line_items (EXISTENTE con mejoras)
    const lineItems = items.map(item => {
      if (!item.price) {
        throw new Error(`El item ${item.product} no tiene precio`);
      }

      return {
        price_data: {
          currency: 'mxn',
          product_data: {
            name: item.name || `Producto ${item.product}`, // ✅ Usar nombre si existe
            description: `Talla: ${item.size}`,
            images: ['https://via.placeholder.com/150']
          },
          unit_amount: Math.round(parseFloat(item.price) * 100),
        },
        quantity: item.quantity,
      };
    });

    // ✅ CREAR SESIÓN CON METADATA QUE INCLUYA orderId (MODIFICADO)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl || `${process.env.FRONTEND_URL}/checkout/success`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/checkout/failure`,
      customer_email: customer.email,
      
      // ✅ METADATA MEJORADA PARA EL WEBHOOK (COMBINADO)
      metadata: {
        order_id: orderId.toString(), // ✅ CRÍTICO para webhook
        order_number: order.orderNumber,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone || '',
        shipping_address: `${customer.address || ''}, ${customer.city || ''}, ${customer.zipCode || ''}`,
        items: JSON.stringify(items)
      },
      
      shipping_address_collection: { allowed_countries: ['MX'] },
    });

    console.log('✅ Sesión de Stripe creada:', session.id);

    // ✅ ACTUALIZAR ORDEN CON stripeSessionId (NUEVO)
    order.stripeSessionId = session.id;
    order.stripePaymentIntentId = session.payment_intent;
    await order.save();

    console.log('✅ Orden actualizada con stripeSessionId:', order.stripeSessionId);

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      orderId: orderId // ✅ Incluir para debugging
    });

  } catch (error) {
    console.error('❌ Error creando sesión de Stripe:', error);
    res.status(500).json({ 
      error: 'Error creando sesión de pago',
      message: error.message 
    });
  }
});

// Consultar estado de sesión (EXISTENTE)
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