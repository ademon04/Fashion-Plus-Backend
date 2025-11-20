const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, unique: true, required: true },
  cart: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    size: String,
    quantity: Number
  }],
  customerData: {
    name: String,
    email: String,
    phone: String,
    zipCode: String
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas
    index: { expires: '2h' }
  }
});

module.exports = mongoose.model('Session', sessionSchema);