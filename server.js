const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;


const app = express();

// 🔥 CORRECCIÓN CRÍTICA: Orden correcto de middlewares
// 1. CORS primero
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 2. Body parsers
app.use(express.json({ limit: '50mb' })); // Aumentar límite para imágenes
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 3. Cookie parser
app.use(cookieParser());
// Configura Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


// 4. Archivos estáticos ANTES de las rutas
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 5. Middleware de sesión personalizado
app.use((req, res, next) => {
  if (!req.cookies.client_session) {
    const sessionId = require('crypto').randomBytes(16).toString('hex');
    res.cookie('client_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 1 semana
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

// 🛣️ Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/sessions', require('./routes/sessions'));

// 🖼️ Ruta adicional para servir imágenes (backup)
app.use('/images', express.static('uploads'));

// 🚨 Manejo de errores global
app.use((error, req, res, next) => {
  console.error('❌ Error global:', error);
  
  // Manejar errores de Multer
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande' });
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

// ✅ Ruta de salud para verificar que el servidor funciona
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📁 Archivos estáticos: http://localhost:${PORT}/uploads/`);
});

//https://fashion-plus-backend-production.up.railway.app/