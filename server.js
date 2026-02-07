const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();
const upload = require('./config/multer');
const multer = require('multer');
const crypto = require('crypto');

const app = express();

// =============================================
// 1. MIDDLEWARES CRÍTICOS
// =============================================

// CORS configurado primero
app.use(cors({
  origin: [
    'https://fashion-plus-frontend.vercel.app',
    'http://localhost:3000',
    'https://fashionpluspremium.com/'
    
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// =============================================
// 2. WEBHOOK ESPECIAL - DEBE ESTAR ANTES DE express.json()
// =============================================

// 🔥 WEBHOOK DE STRIPE - ACTUALIZA ÓRDENES EXISTENTES (NO CREA NUEVAS)
app.post('/api/payments/webhook/stripe', 
  express.raw({type: 'application/json'}), 
  async (req, res) => {
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const Order = require('./models/Order'); // 
      const Product = require('./models/Product'); 
      
      const sig = req.headers['stripe-signature'];

      console.log(' Webhook Stripe recibido');
      console.log(' Signature presente:', !!sig);

      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body, 
          sig, 
          process.env.STRIPE_WEBHOOK_SECRET
        );
        console.log(' Evento verificado:', event.type);
      } catch (err) {
        console.error(' Error de verificación:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      //  MANEJAR CHECKOUT COMPLETADO
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log('💰 Checkout completado:', session.id);
        
        // OBTENER order_id DEL METADATA
        const orderId = session.metadata?.order_id;
        if (!orderId) {
          console.error('❌ No se encontró order_id en metadata');
          return res.json({received: true, error: 'No order_id in metadata'});
        }
        
        //  BUSCAR LA ORDEN EXISTENTE (NO CREAR NUEVA)
        const order = await Order.findById(orderId);
        if (!order) {
          console.error(`❌ Orden no encontrada: ${orderId}`);
          return res.json({received: true, error: 'Order not found'});
        }
        
        console.log(`Orden encontrada: ${order.orderNumber}`);
        
        //  ACTUALIZAR LA ORDEN EXISTENTE
        order.paymentStatus = 'approved';
        order.status = 'confirmed';
        order.paidAt = new Date();
        order.stripePaymentIntentId = session.payment_intent;
        
        // ACTUALIZAR DIRECCIÓN DE ENVÍO
        if (session.shipping_details?.address) {
          // Si Stripe proporciona dirección estructurada
          const addr = session.shipping_details.address;
          order.shippingAddress = {
            street: addr.line1 || '',
            city: addr.city || '',
            state: addr.state || '',
            zipCode: addr.postal_code || '',
            country: addr.country || 'México'
          };
          console.log(' Dirección de Stripe:', order.shippingAddress);
        } else if (session.metadata?.shipping_address) {
          // Parsear desde metadata
          const addressParts = session.metadata.shipping_address.split(',').map(p => p.trim());
          order.shippingAddress = {
            street: addressParts[0] || '',
            city: addressParts[1] || '',
            zipCode: addressParts[2] || '',
            country: 'México'
          };
          console.log(' Dirección de metadata:', order.shippingAddress);
        }
        
        //  ACTUALIZAR DATOS DEL CLIENTE
        if (session.metadata?.customer_name) {
          order.customer.name = session.metadata.customer_name;
        }
        if (session.metadata?.customer_email) {
          order.customer.email = session.metadata.customer_email;
        }
        if (session.metadata?.customer_phone) {
          order.customer.phone = session.metadata.customer_phone;
        }
        
        await order.save();
        console.log(` Orden ${orderId} actualizada exitosamente`);
        
        //  ACTUALIZAR INVENTARIO
        console.log(' Actualizando inventario...');
        for (const item of order.items) {
          const product = await Product.findById(item.product);
          if (product) {
            const sizeIndex = product.sizes.findIndex(s => s.size === item.size);
            if (sizeIndex !== -1) {
              const oldStock = product.sizes[sizeIndex].stock;
              product.sizes[sizeIndex].stock -= item.quantity;
              await product.save();
              /*console.log(`   - ${product.name} (${item.size}): ${oldStock} → ${product.sizes[sizeIndex].stock}`);*/
            }
          }
        }
        
      }
      
      //  SIEMPRE RESPONDER 200 A STRIPE
      res.json({received: true, processed: true});
      
    } catch (error) {
      console.error(' Error procesando webhook:', error.message);
      // Aún con error, responder 200 para que Stripe no reintente
      res.json({received: true, error: error.message});
    }
  }
);

// =============================================
// 3. MIDDLEWARES GENERALES
// =============================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Middleware de sesión personalizado
app.use((req, res, next) => {
  if (!req.cookies.client_session) {
    const sessionId = crypto.randomBytes(16).toString('hex');
    res.cookie('client_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    req.clientSession = sessionId;
  } else {
    req.clientSession = req.cookies.client_session;
  }
  next();
});

// =============================================
// 4. ARCHIVOS ESTÁTICOS
// =============================================

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/image', express.static(path.join(__dirname, 'uploads')));

// =============================================
// 5. CONEXIÓN A LA BASE DE DATOS
// =============================================

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => {
    console.log('❌ Error de conexión a MongoDB:', err);
    process.exit(1);
  });

// =============================================
// 6. RUTA DE UPLOAD (MANEJA MULTER ERRORS)
// =============================================

app.post('/api/upload', 
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'El archivo es demasiado grande (máximo 5MB)' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Demasiados archivos' });
        }
        return res.status(400).json({ error: `Error de Multer: ${err.message}` });
      } else if (err) {
        return next(err);
      }
      next();
    });
  },
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se subió ninguna imagen' });
      }
      
      const imageUrl = req.file.path;
      /*console.log('Imagen subida a Cloudinary:', imageUrl);*/
      
      res.json({ 
        success: true, 
        imageUrl: imageUrl,
        message: 'Imagen subida exitosamente a Cloudinary'
      });
    } catch (error) {
      console.error('❌ Error subiendo imagen:', error);
      res.status(500).json({ error: 'Error al subir imagen' });
    }
  }
);

// =============================================
// 7. RUTAS DE LA API
// =============================================

// Importar y usar rutas organizadas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/payments', require('./routes/payments'));

// =============================================
// 8. MIDDLEWARE DE TRANSFORMACIÓN DE IMÁGENES
// =============================================

app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    try {
      if (typeof data === 'string') {
        const parsedData = JSON.parse(data);
        if (parsedData && typeof parsedData === 'object') {
          const correctImageUrls = (obj) => {
            if (Array.isArray(obj)) {
              return obj.map(item => correctImageUrls(item));
            } else if (obj && typeof obj === 'object') {
              const newObj = { ...obj };
              for (const key in newObj) {
                if (key === 'image' || key === 'images') {
                  if (Array.isArray(newObj[key])) {
                    newObj[key] = newObj[key].map(img => {
                      if (img && img.startsWith('/uploads')) {
                        return `https://fashion-plus-production.up.railway.app${img}`;
                      }
                      return img;
                    });
                  } else if (typeof newObj[key] === 'string' && newObj[key].startsWith('/uploads')) {
                    newObj[key] = `https://fashion-plus-production.up.railway.app${newObj[key]}`;
                  }
                } else {
                  newObj[key] = correctImageUrls(newObj[key]);
                }
              }
              return newObj;
            }
            return obj;
          };
          
          const correctedData = correctImageUrls(parsedData);
          data = JSON.stringify(correctedData);
        }
      }
    } catch (e) {
      // Si falla el parseo, continuar con data original
    }
    originalSend.call(this, data);
  };
  next();
});

// =============================================
// 9. RUTAS BÁSICAS
// =============================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? '✅ Configurado' : '❌ No configurado',
    stripe: process.env.STRIPE_SECRET_KEY ? '✅ Configurado' : '❌ No configurado',
    mongodb: mongoose.connection.readyState === 1 ? '✅ Conectado' : '❌ Desconectado'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Fashion Plus Backend API',
    version: '1.0.0',
    status: 'Operacional',
    endpoints: {
      health: '/health',
      products: '/api/products',
      upload: '/api/upload',
      orders: '/api/orders',
      payments: '/api/payments',
      stripe_webhook: '/api/payments/webhook/stripe'
    }
  });
});

// =============================================
// 10. MANEJO DE ERRORES GLOBAL
// =============================================

app.use((error, req, res, next) => {
  console.error('❌ Error global:', error);
  
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// =============================================
// 11. INICIO DEL SERVIDOR
// =============================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(` Servidor corriendo en puerto ${PORT}`);
  console.log(`Frontend: ${process.env.FRONTEND_URL || 'https://fashionpluspremium.com'}`);
  console.log(` Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configurado' : ' No configurado'}`);
  console.log(` Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Configurado' : ' No configurado'}`);
  console.log(` Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Webhook Stripe: https://fashion-plus-production.up.railway.app/api/payments/webhook/stripe`);
});