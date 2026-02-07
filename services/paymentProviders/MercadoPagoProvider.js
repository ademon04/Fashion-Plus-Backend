// services/paymentProviders/MercadoPagoProvider.js
const { MercadoPagoConfig, Preference } = require('mercadopago');
const crypto = require('crypto');

class MercadoPagoProvider {
  constructor() {
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    });
    this.preferenceClient = new Preference(this.client);
  }

  async createCheckout(orderData) {
    try {
      console.log(" CONFIGURACIÓN MERCADO PAGO:");
      console.log(" - Token:", process.env.MERCADOPAGO_ACCESS_TOKEN ? "✅ PRESENTE" : "❌ FALTANTE");
      console.log(" - Tipo:", process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('TEST-') ? "🟡 MODO PRUEBAS" : "🔵 MODO PRODUCCIÓN");

      const preferenceData = {
        body: {
          items: orderData.items.map((item) => ({
            id: item.product.toString(),
            title: item.productName.length > 50 ? 
                   item.productName.substring(0, 47) + '...' : item.productName,
            unit_price: Number(item.price),
            quantity: Number(item.quantity),
            currency_id: "MXN",
            description: `Talla: ${item.size}`,
            category_id: "fashion",
            picture_url: item.imageUrl || "https://via.placeholder.com/150",
          })),
          back_urls: {
            success: `${process.env.FRONTEND_URL}/checkout/success`,
            failure: `${process.env.FRONTEND_URL}/checkout/failure`, 
            pending: `${process.env.FRONTEND_URL}/checkout/pending`
          },
          auto_return: "approved",
          external_reference: orderData.orderId,
          notification_url: `${process.env.BACKEND_URL}/api/payments/webhook/mercadopago`,
          expires: false,
        },
      };

      console.log("📡 Creando preferencia en Mercado Pago...");
      const response = await this.preferenceClient.create(preferenceData);

      console.log("💳 RESPUESTA DE MERCADO PAGO:");
      console.log(" - Preference ID:", response.id);

      const isSandbox = process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('TEST-');
      const paymentUrl = isSandbox ? response.sandbox_init_point : response.init_point;

      if (!paymentUrl) {
        throw new Error("No se generó URL de pago");
      }

      return {
        success: true,
        paymentUrl: paymentUrl,
        paymentId: response.id,
        provider: 'mercadopago'
      };

    } catch (error) {
      console.error("🔥 ERROR en MercadoPagoProvider:");
      console.log("Error message:", error.message);
      console.log("Error stack:", error.stack);
      
      throw new Error(`MercadoPago Error: ${error.message}`);
    }
  }

  async handleWebhook(payload, signature = null) {
    try {
      console.log("📡 WEBHOOK MERCADO PAGO RECIBIDO");
      
      // Validación de firma (similar a la que tenías)
      const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

      if (webhookSecret && signature) {
        const computedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(JSON.stringify(payload))
          .digest('hex');
        
        if (signature !== computedSignature) {
          throw new Error("Firma de webhook inválida");
        }
        console.log("✅ Webhook MP autenticado correctamente");
      } else if (webhookSecret && !signature) {
        console.log("⚠️ Webhook MP de prueba (sin firma)");
      } else {
        console.log("⚠️ Webhook MP sin validación (secreto no configurado)");
      }

      const { type, data } = payload;

      if (type === "payment") {
        const paymentId = data.id;
        console.log("💳 Procesando notificación de pago MP:", paymentId);
        
        return {
          paymentId: paymentId,
          provider: 'mercadopago',
          type: 'payment'
        };
      }

      return null;
      
    } catch (error) {
      console.error("❌ ERROR en webhook MP:", error);
      throw error;
    }
  }
}
//modulo

module.exports = MercadoPagoProvider;

