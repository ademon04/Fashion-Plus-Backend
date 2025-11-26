const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();
const upload = require('./config/multer');
const multer = require('multer');

const app = express();

// Middlewares
app.use(cors({
  origin: [
    'https://fashion-plus-frontend.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Archivos estáticos (para compatibilidad con imágenes antiguas)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/images', express.static(path.join(__dirname, 'uploads')));

// Middleware de sesión personalizado
app.use((req, res, next) => {
  if (!req.cookies.client_session) {
    const sessionId = require('crypto').randomBytes(16).toString('hex');
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

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.log('❌ Error de conexión:', err));

// Ruta para subir imágenes a Cloudinary
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ninguna imagen' });
    }
    
    // Cloudinary devuelve la URL automáticamente en req.file.path
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
});
app.use('/api/payments/webhook/stripe', 
  express.raw({type: 'application/json'}),
  require('./routes/payments').handleWebhookStripe // Ruta específica
);
// Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/sessions', require('./routes/sessions'));


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

// Manejo de errores global
app.use((error, req, res, next) => {
  console.error('❌ Error global:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande (máximo 5MB)' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Demasiados archivos' });
    }
  }
  
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? '✅ Configurado' : '❌ No configurado'
  });
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Fashion Plus Backend API',
    version: '1.0.0',
    status: 'Operacional',
    endpoints: {
      health: '/health',
      products: '/api/products',
      upload: '/api/upload',
      docs: 'Por implementar'
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'https://fashion-plus-frontend.vercel.app'}`);
  console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Configurado' : '❌ No configurado'}`);
  console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
});