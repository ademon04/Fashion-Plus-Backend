// services/PaymentService.js
const MercadoPagoProvider = require('./paymentProviders/MercadoPagoProvider');
const StripeProvider = require('./paymentProviders/StripeProvider');

class PaymentService {
  constructor() {
    this.providers = {
      mercadopago: new MercadoPagoProvider(),
      stripe: new StripeProvider()
    };
  }

  async createCheckout(orderData, provider = 'stripe') {
    if (!this.providers[provider]) {
      throw new Error(`Proveedor no soportado: ${provider}`);
    }

    return await this.providers[provider].createCheckout(orderData);
  }

  async handleWebhook(provider, payload, signature = null) {
    if (!this.providers[provider]) {
      throw new Error(`Proveedor no soportado: ${provider}`);
    }

    return await this.providers[provider].handleWebhook(payload, signature);
  }

  getAvailableProviders() {
    return Object.keys(this.providers).map(provider => ({
      name: provider,
      enabled: !!process.env[this.getProviderEnvKey(provider)]
    }));
  }

  getProviderEnvKey(provider) {
    const envKeys = {
      mercadopago: 'MERCADOPAGO_ACCESS_TOKEN',
      stripe: 'STRIPE_SECRET_KEY'
    };
    return envKeys[provider];
  }
}

module.exports = new PaymentService();