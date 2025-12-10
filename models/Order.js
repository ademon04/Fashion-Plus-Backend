const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const orderSchema = new mongoose.Schema({
  // =============================================
  // 👤 INFORMACIÓN DE USUARIO Y CLIENTE
  // =============================================
  user: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },

  customer: {
    name: { 
      type: String, 
      required: [true, 'El nombre del cliente es requerido'],
      trim: true
    },
    email: { 
      type: String, 
      required: [true, 'El email del cliente es requerido'],
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    zipCode: {
      type: String,
      trim: true
    }
  },
   archived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date
  },
  archiveReason: {
    type: String,
    trim: true,
    maxlength: [500, 'La razón no puede exceder 500 caracteres']
  },

  // =============================================
  // 🛒 ITEMS DE LA ORDEN
  // =============================================
  items: [{
    product: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Product', 
      required: true 
    },
    productName: {
      type: String,
      required: true
    },
    size: { 
      type: String, 
      required: true 
    },
    quantity: { 
      type: Number, 
      required: true,
      min: [1, 'La cantidad debe ser al menos 1']
    },
    price: { 
      type: Number, 
      required: true,
      min: [0, 'El precio no puede ser negativo']
    },
    subtotal: {
      type: Number,
      required: true
    },
     image: {
      type: String,
      default: ''
    }
  }],

  // =============================================
  // 💰 INFORMACIÓN DE PAGO
  // =============================================
  total: { 
    type: Number, 
    required: true,
    min: [0, 'El total no puede ser negativo']
  },

  currency: {
    type: String,
    default: 'MXN',
    uppercase: true
  },

  paymentMethod: {
    type: String,
    enum: ['stripe', 'mercadopago', 'cash'],
    default: 'mercadopago'
  },

  // =============================================
  // 🔐 SISTEMAS DE PAGO - STRIPE
  // =============================================
  stripeSessionId: String,
  stripePaymentIntentId: String,
  stripeCustomerId: String,

  // =============================================
  // 🔐 SISTEMAS DE PAGO - MERCADO PAGO
  // =============================================
  mercadoPagoId: String,
  mercadoPagoPaymentId: String,
  mercadoPagoPreferenceId: String,

  // =============================================
  // 📦 ESTADOS Y SEGUIMIENTO
  // =============================================
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'refunded', 'charged_back'],
    default: 'pending'
  },

  // =============================================
  // 📮 INFORMACIÓN DE ENVÍO
  // =============================================
  shippingAddress: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, default: 'México', trim: true }
  },

  shippingMethod: {
    type: String,
    default: 'standard'
  },

  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },

  trackingNumber: String,

  // =============================================
  // 📝 INFORMACIÓN ADICIONAL
  // =============================================
  customerNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Las notas no pueden exceder 500 caracteres']
  },

  internalNotes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Las notas internas no pueden exceder 1000 caracteres']
  },

  // =============================================
  // 🔢 IDENTIFICADORES ÚNICOS
  // =============================================
  orderNumber: { 
    type: String, 
    unique: true, // ✅ SOLO AQUÍ - sin índice duplicado
    sparse: true
  },

  // =============================================
  // ⏰ FECHAS DE SEGUIMIENTO
  // =============================================
  paidAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  statusUpdatedAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// =============================================
// 🎯 PLUGINS Y MÉTODOS
// =============================================

// 🔥 PLUGIN DE PAGINACIÓN (CRÍTICO - SOLUCIONA EL ERROR)
orderSchema.plugin(mongoosePaginate);

// =============================================
// 📊 VIRTUAL FIELDS
// =============================================

// Total de items en la orden
orderSchema.virtual('itemsCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// ¿Es una orden pagada?
orderSchema.virtual('isPaid').get(function() {
  return this.paymentStatus === 'approved';
});

// ¿Es una orden completada?
orderSchema.virtual('isCompleted').get(function() {
  return this.status === 'delivered';
});

// =============================================
// 🎯 MIDDLEWARES
// =============================================

// Generar número de orden antes de guardar
orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    this.orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
  }
  
  // Actualizar fecha de cambio de estado
  if (this.isModified('status')) {
    this.statusUpdatedAt = new Date();
  }
  
  next();
});

// Calcular subtotales antes de validar
orderSchema.pre('save', function(next) {
  if (this.isModified('items')) {
    this.items.forEach(item => {
      item.subtotal = item.price * item.quantity;
    });
    
    this.total = this.items.reduce((sum, item) => sum + item.subtotal, 0) + (this.shippingCost || 0);
  }
  next();
});

// =============================================
// 🔍 ÍNDICES OPTIMIZADOS (SIN DUPLICADOS)
// =============================================

// ❌ ELIMINADO: orderSchema.index({ orderNumber: 1 }, { unique: true });
// ✅ Ya está definido en el campo orderNumber: { unique: true }

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ 'customer.email': 1 });

// Índices compuestos para consultas comunes
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentMethod: 1, createdAt: -1 });

// =============================================
// 📋 MÉTODOS DE INSTANCIA
// =============================================

// Marcar como pagado
orderSchema.methods.markAsPaid = function(paymentId, method = 'mercadopago') {
  this.paymentStatus = 'approved';
  this.paymentMethod = method;
  this.paidAt = new Date();
  
  if (method === 'stripe' && paymentId) {
    this.stripePaymentIntentId = paymentId;
  } else if (method === 'mercadopago' && paymentId) {
    this.mercadoPagoPaymentId = paymentId;
  }
};

// Actualizar estado con registro de fecha
orderSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  this.statusUpdatedAt = new Date();
  
  if (newStatus === 'shipped' && !this.shippedAt) {
    this.shippedAt = new Date();
  } else if (newStatus === 'delivered' && !this.deliveredAt) {
    this.deliveredAt = new Date();
  } else if (newStatus === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }
};

module.exports = mongoose.model('Order', orderSchema);