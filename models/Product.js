const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String},
  price: { type: Number, required: true },
  originalPrice: { type: Number },

  // SKU YA NO ES REQUIRED (se genera automáticamente)
  sku: { type: String, unique: true },

  category: { 
    type: String, 
    required: true,
    enum: ['hombre', 'mujer', 'niños', 'unisex']
  },

  subcategory: {
    type: String,
    required: true,
    enum: [
      'camisa', 'playera', 'pantalones', 'chamarra', 'sudadera', 
      'chaleco', 'tenis', 'zapatos', 'conjuntos', 'vestidos', 
      'bolsas', 'ropa-niños'
    ]
  },

  sizes: [{
    size: { type: String, required: true },
    stock: { type: Number, default: 0 },
    available: { type: Boolean, default: true }
  }],

  images: [{ type: String }],
  colors: [{ type: String }],
  featured: { type: Boolean, default: true },
  onSale: { type: Boolean, default: false },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);
