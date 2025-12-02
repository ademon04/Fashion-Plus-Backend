const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../../models/Order'); // ✅ AGREGAR ESTA LÍNEA

class StripeProvider {
  constructor() {
    this.stripe = stripe;
  }

  async createCheckout(orderData) {
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: orderData.items.map(item => ({
          price_data: {
            currency: 'mxn',
            product_data: {
              name: item.productName,
              description: `Talla: ${item.size}`,
              images: [item.imageUrl || 'https://via.placeholder.com/150'],
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        })),
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderData.orderId}&provider=stripe`,
        cancel_url: `${process.env.FRONTEND_URL}/checkout/failure`,
        customer_email: orderData.customer.email,
        metadata: {
          order_id: orderData.orderId,
          order_number: orderData.orderNumber,
          customer_name: orderData.customer.name,
          customer_email: orderData.customer.email,
          customer_phone: orderData.customer.phone || '',
          shipping_address: `${orderData.customer.address || ''}, ${orderData.customer.city || ''}, ${orderData.customer.zipCode || ''}`,
          items: JSON.stringify(orderData.items.map(item => ({
            productName: item.productName,
            size: item.size,
            quantity: item.quantity,
            price: item.price
          })))
        }
      });

      return {
        success: true,
        paymentUrl: session.url,
        paymentId: session.id,
        provider: 'stripe'
      };
    } catch (error) {
      console.error('Error StripeProvider:', error);
      throw error;
    }
  }

  async handleWebhook(payload, signature) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      console.log(`🔄 Evento Stripe recibido: ${event.type}`);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        console.log('✅ Checkout completado:', session.id);
        console.log('📦 Metadata:', session.metadata);

        // ✅ BUSCAR LA ORDEN EN MONGODB
        const orderId = session.metadata.order_id;
        const order = await Order.findById(orderId);
        
        if (!order) {
          console.error(`❌ Orden no encontrada: ${orderId}`);
          throw new Error(`Orden ${orderId} no encontrada`);
        }

        // ✅ ACTUALIZAR ESTADOS DE PAGO
        order.paymentStatus = 'approved';
        order.status = 'confirmed';
        order.paidAt = new Date();
        order.stripePaymentIntentId = session.payment_intent;

        // ✅ ACTUALIZAR DATOS DEL CLIENTE DESDE METADATA
        if (session.metadata.customer_name) {
          order.customer.name = session.metadata.customer_name;
        }
        if (session.metadata.customer_email) {
          order.customer.email = session.metadata.customer_email;
        }
        if (session.metadata.customer_phone) {
          order.customer.phone = session.metadata.customer_phone;
        }

        // ✅ ACTUALIZAR DIRECCIÓN DE ENVÍO
        if (session.metadata.shipping_address) {
          const addressParts = session.metadata.shipping_address.split(',').map(p => p.trim());
          
          order.shippingAddress = {
            street: addressParts[0] || '',
            city: addressParts[1] || '',
            zipCode: addressParts[2] || '',
            country: 'México'
          };
        }

        // ✅ ACTUALIZAR ITEMS CON NOMBRE Y TALLA (por si acaso)
        try {
          const itemsMetadata = JSON.parse(session.metadata.items || '[]');
          if (itemsMetadata.length > 0) {
            order.items.forEach((item, index) => {
              if (itemsMetadata[index]) {
                item.productName = itemsMetadata[index].productName || item.productName;
                item.size = itemsMetadata[index].size || item.size;
              }
            });
          }
        } catch (parseError) {
          console.warn('⚠️ No se pudo parsear items metadata:', parseError.message);
        }

        await order.save();
        console.log(`✅ Orden ${orderId} actualizada exitosamente`);

        return {
          paymentId: session.id,
          provider: 'stripe',
          type: 'payment.completed',
          orderId: orderId,
          updated: true
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error Stripe webhook:', error.message);
      throw error;
    }
  }
}

module.exports = StripeProvider;