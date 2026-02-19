const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Leer token de cookies HTTP-Only
// middleware/auth.js - MEJORAR para aceptar ambos métodos
const auth = async (req, res, next) => {
  try {
    let token = req.cookies.admin_token;
    
    //  FALLBACK: Si no hay cookie, buscar en header
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(404).json({ error: 'Acceso denegado. No hay token.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido.' });
  }
};

// Verificar que sea admin
const adminAuth = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de admin.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const flexibleAuth = (req, res, next) => {
  if (req.cookies.admin_token) {
    // Verificar admin
  } else if (req.cookies.client_session) {
    // Buscar carrito por sessionId
    req.sessionId = req.cookies.client_session;
  }
  next();
};

module.exports = { auth, adminAuth, flexibleAuth };