const User = require('../models/User');
const jwt = require('jsonwebtoken');

// LOGIN ADMIN con cookies HTTP-Only
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verificar si el usuario existe y es admin
    const user = await User.findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }
    // Verificar password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    // Generar token
    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Configurar cookie HTTP-Only
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    });

    res.json({
      message: 'Login exitoso',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
        token: token  
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// LOGOUT ADMIN
exports.logout = (req, res) => {
  res.clearCookie('admin_token',{
     httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ message: 'Logout exitoso' });
};

// VERIFICAR TOKEN (para frontend admin)
exports.verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Registro rápido (solo email, sin password obligatorio)
exports.quickRegister = async (req, res) => {
  try {
    const { email, name } = req.body;
    const sessionId = req.clientSession; // De la cookie

    // Crear usuario "guest" 
    const user = new User({
      email,
      name,
      guest: true,
      sessionId,
      tempEmail: email
    });

    await user.save();
    
    // Opcional: migrar carrito de session a usuario
    res.json({ 
      success: true, 
      user: { id: user._id, guest: true },
      message: 'Registro rápido exitoso' 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    // const User = require('../models/User');  // <- Eliminar esta línea
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const user = new User({ name, email, password, role });
    await user.save();

    res.status(201).json({ 
      message: 'Usuario registrado exitosamente',
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};