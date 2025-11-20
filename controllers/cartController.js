const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Obtener carrito del usuario
const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'name price image stock');
    
    if (!cart) {
      return res.status(200).json({ items: [] });
    }

    res.json({ items: cart.items });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el carrito' });
  }
};

// Agregar item al carrito
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // Verificar que el producto existe
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Verificar stock
    if (product.stock < quantity) {
      return res.status(400).json({ error: 'Stock insuficiente' });
    }

    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      // Crear nuevo carrito
      cart = new Cart({
        user: req.user.id,
        items: [{ product: productId, quantity }]
      });
    } else {
      // Verificar si el producto ya está en el carrito
      const existingItem = cart.items.find(item => 
        item.product.toString() === productId
      );

      if (existingItem) {
        // Actualizar cantidad
        existingItem.quantity += quantity;
        
        // Verificar stock después de actualizar
        if (product.stock < existingItem.quantity) {
          return res.status(400).json({ error: 'Stock insuficiente' });
        }
      } else {
        // Agregar nuevo item
        cart.items.push({ product: productId, quantity });
      }
    }

    await cart.save();
    await cart.populate('items.product', 'name price image stock');

    res.json({ items: cart.items });
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar al carrito' });
  }
};

// Actualizar cantidad de un item
const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ error: 'La cantidad debe ser al menos 1' });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ error: 'Carrito no encontrado' });
    }

    const item = cart.items.find(item => 
      item.product.toString() === productId
    );

    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado en el carrito' });
    }

    // Verificar stock
    const product = await Product.findById(productId);
    if (product.stock < quantity) {
      return res.status(400).json({ error: 'Stock insuficiente' });
    }

    item.quantity = quantity;
    await cart.save();
    await cart.populate('items.product', 'name price image stock');

    res.json({ items: cart.items });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el carrito' });
  }
};

// Eliminar item del carrito
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ error: 'Carrito no encontrado' });
    }

    cart.items = cart.items.filter(item => 
      item.product.toString() !== productId
    );

    await cart.save();
    await cart.populate('items.product', 'name price image stock');

    res.json({ items: cart.items });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar del carrito' });
  }
};

// Limpiar carrito
const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ error: 'Carrito no encontrado' });
    }

    cart.items = [];
    await cart.save();

    res.json({ message: 'Carrito limpiado exitosamente', items: [] });
  } catch (error) {
    res.status(500).json({ error: 'Error al limpiar el carrito' });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
};