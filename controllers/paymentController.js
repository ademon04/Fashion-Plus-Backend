const paymentService = require('../services/PaymentService');
const Order = require('../models/Order');

exports.createPaymentCheckout = async (req, res) => {
  try {
    const { provider = 'stripe', orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const orderData = {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      customer: order.customer,
      items: order.items.map(item => ({
        product: item.product,
        productName: item.productName || `Producto ${item.product}`,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        imageUrl: 'https://via.placeholder.com/150'
      })),
      total: order.total
    };

    const checkoutResult = await paymentService.createCheckout(orderData, provider);

    order.paymentProvider = provider;
    order.paymentProviderId = checkoutResult.paymentId;
    await order.save();

    res.json({
      success: true,
      message: `Checkout creado con ${provider}`,
      checkout: checkoutResult
    });

  } catch (error) {
    console.error('Error en createPaymentCheckout:', error);
    res.status(500).json({ 
      error: "Error al crear checkout de pago",
      details: error.message 
    });
  }
};

// En controllers/paymentController.js - MODIFICA el catch:

exports.handlePaymentWebhook = async (req, res) => {
  let provider; // ← DEFINIR provider aquí para el catch
  
  try {
    provider = req.params.provider; // ← Ahora está definida
    
    console.log(`📡 WEBHOOK ${provider?.toUpperCase()} RECIBIDO`);
    console.log('🔐 Signature:', req.headers['stripe-signature'] ? 'PRESENTE' : 'FALTANTE');
    console.log('📦 Body type:', typeof req.body);
    console.log('📦 Body length:', req.body?.length);

    let webhookResult;
    if (provider === 'stripe') {
      const signature = req.headers['stripe-signature'];
      
      // ✅ VERIFICAR que el body sea Buffer/String
      if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        throw new Error('Body debe ser Buffer para Stripe');
      }
      
      webhookResult = await paymentService.handleWebhook(provider, req.body, signature);
    } else {
      // Para Mercado Pago, convertir si es necesario
      const jsonPayload = Buffer.isBuffer(req.body) ? 
        JSON.parse(req.body.toString()) : req.body;
      webhookResult = await paymentService.handleWebhook(provider, jsonPayload);
    }

    // ... resto del código igual

  } catch (error) {
    console.error(`❌ ERROR en webhook ${provider}:`, error.message);
    
    // ✅ SIEMPRE responder 200 a Stripe (evita reintentos)
    res.status(200).json({ 
      received: true, 
      error: error.message 
    });
  }
};

exports.getPaymentProviders = async (req, res) => {
  try {
    const providers = paymentService.getAvailableProviders();
    res.json({
      success: true,
      providers: providers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};