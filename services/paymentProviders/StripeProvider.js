// services/paymentProviders/StripeProvider.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
            unit_amount: Math.round(item.price * 100), // Centavos
          },
          quantity: item.quantity,
        })),
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderData.orderId}&provider=stripe`,
        cancel_url: `${process.env.FRONTEND_URL}/checkout/failure`,
        customer_email: orderData.customer.email,
        metadata: {
          order_id: orderData.orderId,
          order_number: orderData.orderNumber
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

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        return {
          paymentId: session.id,
          provider: 'stripe',
          type: 'payment.completed',
          orderId: session.metadata.order_id
        };
      }

      return null;
    } catch (error) {
      console.error('Error Stripe webhook:', error);
      throw error;
    }
  }
}

module.exports = StripeProvider;