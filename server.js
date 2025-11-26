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
// 1. MIDDLEWARES CRÍTICOS - SIN PROCESAMIENTO DE BODY
// =============================================

// CORS configurado primero
app.use(cors({
  origin: [
    'https://fashion-plus-frontend.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// =============================================
// 2. WEBHOOKS - DEBEN ESTAR ANTES DE express.json()
// =============================================

// Webhook principal de Stripe
app.post('/api/payments/webhook/stripe', 
  express.raw({type: 'application/json'}), 
  (req, res) => {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];

    console.log('🔵 Webhook recibido - Tipo:', req.headers['content-type']);
    console.log('🔵 Body es Buffer:', Buffer.isBuffer(req.body));

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body, 
        sig, 
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log('✅ Evento verificado:', event.type);
    } catch (err) {
      console.log('❌ Error de verificación:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Manejar eventos específicos
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('💰 Pago exitoso:', session.id);
        // TODO: Actualizar base de datos
        break;
      case 'payment_intent.succeeded':
        console.log('💳 PaymentIntent succeeded');
        break;
      default:
        console.log(`🤷‍♀️ Evento no manejado: ${event.type}`);
    }

    res.json({received: true});
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
app.use('/images', express.static(path.join(__dirname, 'uploads')));

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
// 6. RUTAS DE LA API
// =============================================

// Ruta de upload (maneja Multer errors específicamente)
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
      console.log('✅ Imagen subida a Cloudinary:', imageUrl);
      
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

// Rutas API organizadas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/webhooks', require('./routes/webhooks'));

// =============================================
// 7. MIDDLEWARE DE TRANSFORMACIÓN (OPCIONAL)
// =============================================

// Middleware para corregir URLs de imágenes en respuestas
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
                if (key === 'images' || key === 'image') {
                  if (Array.isArray(newObj[key])) {
                    newObj[key] = newObj[key].map(img => {
                      if (img && img.startsWith('/uploads')) {
                        return `https://fashion-plus-backend-production.up.railway.app${img}`;
                      }
                      return img;
                    });
                  } else if (typeof newObj[key] === 'string' && newObj[key].startsWith('/uploads')) {
                    newObj[key] = `https://fashion-plus-backend-production.up.railway.app${newObj[key]}`;
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
// 8. RUTAS BÁSICAS
// =============================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? '✅ Configurado' : '❌ No configurado',
    stripe: process.env.STRIPE_SECRET_KEY ? '✅ Configurado' : '❌ No configurado'
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
      stripe_webhook: '/api/stripe-webhook'
    }
  });
});

// =============================================
// 9. MANEJO DE ERRORES GLOBAL
// =============================================

app.use((error, req, res, next) => {
  console.error('❌ Error global:', error);
  
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// =============================================
// 10. INICIO DEL SERVIDOR
// =============================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'https://fashion-plus-frontend.vercel.app'}`);
  console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Configurado' : '❌ No configurado'}`);
  console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅ Configurado' : '❌ No configurado'}`);
  console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
});