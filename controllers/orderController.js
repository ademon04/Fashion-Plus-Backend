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