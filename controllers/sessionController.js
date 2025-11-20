const Session = require('../models/Session');

exports.createSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = new Session({ sessionId });
    await session.save();
    res.json({ sessionId });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getSession = async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.id })
      .populate('cart.productId', 'name price images sizes');
    
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateSessionCart = async (req, res) => {
  try {
    const session = await Session.findOneAndUpdate(
      { sessionId: req.params.id },
      { cart: req.body.cart },
      { new: true }
    ).populate('cart.productId', 'name price images sizes');
    
    res.json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};