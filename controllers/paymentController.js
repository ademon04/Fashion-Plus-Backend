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

exports.handlePaymentWebhook = async (req, res) => {
  try {
    const { provider } = req.params;
    
    let webhookResult;
    if (provider === 'stripe') {
      const signature = req.headers['stripe-signature'];
      webhookResult = await paymentService.handleWebhook(provider, req.body, signature);
    } else {
      webhookResult = await paymentService.handleWebhook(provider, req.body);
    }

    if (webhookResult && webhookResult.orderId) {
      const order = await Order.findById(webhookResult.orderId);
      if (order) {
        order.status = 'confirmed';
        order.paymentStatus = 'paid';
        await order.save();
        console.log(`✅ Orden ${order._id} actualizada vía ${provider}`);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error(`Error en webhook ${provider}:`, error);
    res.status(400).json({ error: 'Webhook processing failed' });
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