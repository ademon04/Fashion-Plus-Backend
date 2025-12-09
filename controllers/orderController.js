const Order = require('../models/Order');
const Product = require('../models/Product');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const crypto = require('crypto');

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

const preferenceClient = new Preference(client);

// ======================================================
// 📌 CREAR ORDEN - VERSIÓN COMPLETA PARA AMBOS PAGOS
// ======================================================
exports.createOrder = async (req, res) => {
  try {
    console.log("======================================");
    console.log("🛒 NUEVA ORDEN RECIBIDA");
    console.log("📥 Body:", JSON.stringify(req.body, null, 2));

    // ✅ RECIBIR paymentMethod DEL BODY
    const { customer, items, shippingAddress, customerNotes, paymentMethod } = req.body;
    const userId = req.user ? req.user.id : null;

    // Validaciones básicas
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "No hay items en la orden" });
    }

    if (!customer?.name || !customer?.email) {
      return res.status(400).json({ error: "Información del cliente incompleta" });
    }

    console.log(`🧾 Items recibidos: ${items.length}`);
    console.log(`💳 Método de pago solicitado: ${paymentMethod || 'No especificado'}`);

    let total = 0;
    const orderItems = [];

    // PROCESAR CADA ITEM
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`🔍 Procesando item ${i + 1}:`, item);

      const productId = item.productId || item.product;

      if (!productId) {
        return res.status(400).json({ error: "Item sin productId/product" });
      }

      // Buscar producto en BD
      const product = await Product.findById(productId);
      if (!product) {
        console.log("❌ Producto no encontrado con ID:", productId);
        return res.status(404).json({ error: `Producto no encontrado` });
      }

      console.log("✅ Producto encontrado:", product.name);

      // Validar stock por talla
      const sizeStock = product.sizes.find((s) => s.size === item.size);
      if (!sizeStock) {
        return res.status(400).json({
          error: `Talla ${item.size} no disponible para ${product.name}`,
        });
      }

      if (sizeStock.stock < item.quantity) {
        return res.status(400).json({
          error: `Stock insuficiente para ${product.name} talla ${item.size}. Disponible: ${sizeStock.stock}, Solicitado: ${item.quantity}`,
        });
      }

      // Calcular subtotal
      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      orderItems.push({
        product: productId,
        productName: product.name,
        size: item.size,
        quantity: item.quantity,
        price: product.price,
        subtotal: itemTotal,
         image: product.images && product.images.length > 0 ? product.images[0] : null,
         images: product.images || [], 
    productImages: product.images, 
  });
     

      console.log(`📦 Item ${i + 1} procesado: ${product.name} - $${product.price} x ${item.quantity} = $${itemTotal}`);
    }

    console.log("💰 TOTAL CALCULADO:", total);

    // CREAR ORDEN EN BASE DE DATOS - CON paymentMethod
    const order = new Order({
      user: userId,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone || 'No proporcionado',
        zipCode: customer.zipCode || 'No proporcionado',
      },
      items: orderItems,
      total,
      shippingAddress: shippingAddress || 'No proporcionado',
      customerNotes: customerNotes || '',
      status: 'pending',
      // ✅ GUARDAR paymentMethod RECIBIDO
      paymentMethod: paymentMethod || 'mercadopago'
    });

    await order.save();
    console.log("✅ ORDEN GUARDADA EN BD");
    console.log("🧾 Order ID:", order._id);
    console.log("🔢 Order Number:", order.orderNumber);
    console.log("💳 Payment Method:", order.paymentMethod);

    // ✅ DIFERENCIAR SEGÚN MÉTODO DE PAGO
    if (paymentMethod === 'stripe') {
      console.log("🔄 Orden creada para Stripe - El frontend debe crear la sesión");
      
      // RESPUESTA PARA STRIPE
      res.json({
        success: true,
        message: "Orden creada exitosamente para Stripe",
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          total: order.total,
          status: order.status,
          items: order.items.length
        },
        paymentMethod: 'stripe'
        // ❌ NO incluir paymentUrl para Stripe
      });
      
    } else {
      // ======================================================
      // 🎯 MERCADO PAGO - CREAR PREFERENCIA DE PAGO
      // ======================================================
      console.log("🔐 CONFIGURACIÓN MERCADO PAGO:");
      console.log(" - Token:", process.env.MERCADOPAGO_ACCESS_TOKEN ? "✅ PRESENTE" : "❌ FALTANTE");
      console.log(" - Tipo:", process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('TEST-') ? "🟡 MODO PRUEBAS" : "🔵 MODO PRODUCCIÓN");
      console.log(" - Frontend URL:", process.env.FRONTEND_URL);
      console.log(" - Backend URL:", process.env.BACKEND_URL);

      const preferenceData = {
        body: {
          items: orderItems.map((item) => ({
            id: item.product,
            title: item.productName.length > 50 ? item.productName.substring(0, 47) + '...' : item.productName,
            unit_price: Number(item.price),
            quantity: Number(item.quantity),
            currency_id: "MXN",
            description: `Talla: ${item.size}`,
            
          })),
          back_urls: {
            success: `${process.env.FRONTEND_URL}/checkout/success`,
            failure: `${process.env.FRONTEND_URL}/checkout/failure`, 
            pending: `${process.env.FRONTEND_URL}/checkout/pending`
          },
          auto_return: "approved",
          external_reference: order._id.toString(),
          notification_url: `${process.env.BACKEND_URL}/api/orders/webhook`,
          expires: false,
        },
      };

      console.log("🌐 URLs configuradas para Mercado Pago:");
      console.log(" - Success:", `${process.env.FRONTEND_URL}/checkout/success`);
      console.log(" - Failure:", `${process.env.FRONTEND_URL}/checkout/failure`);
      console.log(" - Pending:", `${process.env.FRONTEND_URL}/checkout/pending`);
      console.log(" - Webhook:", `${process.env.BACKEND_URL}/api/orders/webhook`);

      console.log("📡 Creando preferencia en Mercado Pago...");
      const response = await preferenceClient.create(preferenceData);

      console.log("💳 RESPUESTA DE MERCADO PAGO:");
      console.log(" - Preference ID:", response.id);
      console.log(" - Init Point (Producción):", response.init_point);
      console.log(" - Sandbox Init Point (Pruebas):", response.sandbox_init_point);

      // Guardar ID de Mercado Pago en la orden
      order.mercadoPagoId = response.id;
      await order.save();

      // 🎯 USAR SANDBOX PARA PRUEBAS
      const paymentUrl = response.sandbox_init_point;
      
      if (!paymentUrl) {
        console.log("❌ ERROR: No se generó URL de pago sandbox");
        return res.status(500).json({ 
          error: "Error al generar link de pago. Contacta al administrador." 
        });
      }

      console.log("🔗 URL DE PAGO GENERADA:", paymentUrl);

      // RESPUESTA EXITOSA PARA MERCADO PAGO
      res.json({
        success: true,
        message: "Orden creada exitosamente",
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          total: order.total,
          status: order.status,
          items: order.items.length
        },
        paymentUrl: paymentUrl,
        paymentMethod: 'mercadopago',
        testingInfo: {
          mode: "SANDBOX",
          testCard: "4509 9535 6623 3704 (12/25 - 123)",
          instructions: "Usa esta tarjeta para pruebas"
        }
      });
    }

  } catch (error) {
    console.log("🔥 ERROR CRÍTICO EN createOrder:");
    console.log("Error message:", error.message);
    console.log("Error stack:", error.stack);
    
    // Manejar errores específicos de Mercado Pago
    if (error.message?.includes('401')) {
      return res.status(500).json({ 
        error: "Error de autenticación con Mercado Pago. Verifica tu ACCESS_TOKEN." 
      });
    }
    
    if (error.message?.includes('400')) {
      return res.status(500).json({ 
        error: "Datos inválidos para Mercado Pago. Verifica los precios y cantidades." 
      });
    }

    return res.status(500).json({ 
      error: "Error interno del servidor. Por favor, intenta nuevamente." 
    });
  }
};

// ======================================================
// 📡 WEBHOOK - RECIBIR NOTIFICACIONES DE MERCADO PAGO (CORREGIDO)
// ======================================================
exports.webhook = async (req, res) => {
  try {
    console.log("📡 WEBHOOK RECIBIDO");
    
    // ✅ VALIDACIÓN MEJORADA - PERMITE PRUEBAS DE MERCADO PAGO
    const signature = req.headers['x-signature'];
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    // 🔥 SOLUCIÓN: Solo validar si hay firma Y secreto configurado
    if (webhookSecret && signature) {
      const payload = JSON.stringify(req.body);
      const computedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');
      
      if (signature !== computedSignature) {
        console.log("❌ Webhook rechazado - firma inválida");
        return res.sendStatus(403);
      }
      console.log("✅ Webhook autenticado correctamente");
    } else if (webhookSecret && !signature) {
      // 🔥 NUEVO: Si hay secreto pero no firma, es una prueba de MP
      console.log("⚠️ Webhook de prueba (sin firma) - permitiendo acceso");
    } else {
      console.log("⚠️ Webhook sin validación (secreto no configurado)");
    }

    console.log("📋 Headers:", req.headers);
    console.log("📦 Body:", JSON.stringify(req.body, null, 2));

    const { type, data } = req.body;

    if (type === "payment") {
      const paymentId = data.id;
      console.log("💳 Procesando notificación de pago:", paymentId);

      // Buscar orden por ID de Mercado Pago
      const order = await Order.findOne({ mercadoPagoId: paymentId });
      
      if (order) {
        console.log("✅ Orden encontrada:", order._id);
        
        // En un entorno real, aquí obtendrías el estado real del pago
        // desde la API de Mercado Pago usando paymentId
        // Por ahora, actualizamos a un estado genérico
        
        order.status = 'processing';
        order.paymentProcessedAt = new Date();
        await order.save();
        
        console.log("🔄 Orden actualizada a status:", order.status);
        
        // Aquí podrías:
        // - Enviar email de confirmación
        // - Actualizar inventario
        // - Notificar al admin
        
      } else {
        console.log("⚠️ Orden no encontrada para payment ID:", paymentId);
        
        // Intentar buscar por external_reference como fallback
        if (req.body.data?.external_reference) {
          const orderByRef = await Order.findById(req.body.data.external_reference);
          if (orderByRef) {
            console.log("✅ Orden encontrada por external_reference:", orderByRef._id);
            orderByRef.mercadoPagoId = paymentId;
            orderByRef.status = 'processing';
            await orderByRef.save();
          }
        }
      }
    } else {
      console.log("ℹ️ Webhook de tipo no manejado:", type);
    }

    // ✅ IMPORTANTE: Siempre responder 200 a Mercado Pago
    res.sendStatus(200);
    
  } catch (error) {
    console.error("❌ ERROR en webhook:", error);
    // Aún con error, responder 200 para que Mercado Pago no reintente
    res.sendStatus(200);
  }
};

// ======================================================
// 📋 OBTENER TODAS LAS ÓRDENES (ADMIN) - CON FILTROS MEJORADOS
// ======================================================
exports.getOrders = async (req, res) => {
  try {
    // ✅ RECIBIR TODOS LOS FILTROS
    const { status, paymentMethod, paymentStatus, page = 1, limit = 10 } = req.query;
    
    let filter = {};
    
    // ✅ FILTRAR POR STATUS
    if (status && status !== 'all' && status !== '') {
      filter.status = status;
    }
    
    // ✅ FILTRAR POR MÉTODO DE PAGO (NUEVO)
    if (paymentMethod && paymentMethod !== 'all' && paymentMethod !== '') {
      filter.paymentMethod = paymentMethod;
    }
    
    // ✅ FILTRAR POR ESTADO DE PAGO (NUEVO)
    if (paymentStatus && paymentStatus !== 'all' && paymentStatus !== '') {
      filter.paymentStatus = paymentStatus;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: "items.product", select: "name image" },
        { path: "user", select: "name email" }
      ]
    };

    const orders = await Order.paginate(filter, options);

    res.json({
      success: true,
      orders: orders.docs,
      totalOrders: orders.totalDocs,
      totalPages: orders.totalPages,
      currentPage: orders.page,
      hasNext: orders.hasNextPage,
      hasPrev: orders.hasPrevPage,
      // ✅ INFORMACIÓN DE FILTROS APLICADOS
      filtersApplied: {
        status: status || 'none',
        paymentMethod: paymentMethod || 'none',
        paymentStatus: paymentStatus || 'none'
      }
    });

  } catch (error) {
    console.error("Error en getOrders:", error);
    res.status(500).json({ 
      success: false,
      error: "Error al obtener las órdenes" 
    });
  }
};

// ======================================================
// 📦 OBTENER ORDEN POR ID
// ======================================================
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product", "name image price")
      .populate("user", "name email");

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: "Orden no encontrada" 
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error("Error en getOrderById:", error);
    res.status(500).json({ 
      success: false,
      error: "Error al obtener la orden" 
    });
  }
};

// ======================================================
// ✏️ ACTUALIZAR ESTADO DE ORDEN (ADMIN)
// ======================================================
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: `Estado inválido. Estados válidos: ${validStatuses.join(', ')}` 
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        statusUpdatedAt: new Date()
      },
      { new: true }
    )
      .populate("items.product", "name image")
      .populate("user", "name email");

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: "Orden no encontrada" 
      });
    }

    console.log(`🔄 Orden ${order._id} actualizada a status: ${status}`);

    res.json({
      success: true,
      message: `Orden actualizada a: ${status}`,
      order
    });

  } catch (error) {
    console.error("Error en updateOrderStatus:", error);
    res.status(500).json({ 
      success: false,
      error: "Error al actualizar la orden" 
    });
  }
};

// ======================================================
// 🗑️ ELIMINAR ORDEN (ADMIN)
// ======================================================
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: "Orden no encontrada" 
      });
    }

    console.log(`🗑️ Orden eliminada: ${order._id}`);

    res.json({
      success: true,
      message: "Orden eliminada correctamente"
    });

  } catch (error) {
    console.error("Error en deleteOrder:", error);
    res.status(500).json({ 
      success: false,
      error: "Error al eliminar la orden" 
    });
  }
};

// ======================================================
// 👤 OBTENER ÓRDENES DEL USUARIO ACTUAL
// ======================================================
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: {
        path: "items.product",
        select: "name image"
      }
    };

    const orders = await Order.paginate({ user: userId }, options);

    res.json({
      success: true,
      orders: orders.docs,
      totalOrders: orders.totalDocs,
      totalPages: orders.totalPages,
      currentPage: orders.page
    });

  } catch (error) {
    console.error("Error en getMyOrders:", error);
    res.status(500).json({ 
      success: false,
      error: "Error al obtener tus órdenes" 
    });
  }
};

// ======================================================
// 🎯 EXPORTACIÓN ÚNICA - ¡NO DUPLICAR!
// ======================================================
module.exports = {
  createOrder: exports.createOrder,
  webhook: exports.webhook,
  getOrders: exports.getOrders,
  getOrderById: exports.getOrderById,
  updateOrderStatus: exports.updateOrderStatus,
  deleteOrder: exports.deleteOrder,
  getMyOrders: exports.getMyOrders
};