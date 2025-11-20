const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Usuario opcional
  user: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false   // ← permite compras sin iniciar sesión
  },

  // Información mínima del cliente (sin registro)
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    zipCode: String
  },

  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    size: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],

  total: { type: Number, required: true },

  status: {
    type: String,
    enum: ['pending', 'paid', 'shipped', 'delivered', 'archived'],
    default: 'pending'
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  mercadoPagoId: String,
  mercadoPagoPaymentId: String,

  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'México' }
  },

  customerNotes: String,

  // Para tracking interno
  orderNumber: { type: String, unique: true }
}, {
  timestamps: true
});

// Generar número de orden antes de guardar
orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    this.orderNumber = 'ORD-' + Date.now();
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
