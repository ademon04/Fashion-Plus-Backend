const Product = require('../models/Product');

// Función para normalizar texto (quitar espacios, poner minúsculas)
const normalize = (value) => {
  if (!value) return value;
  return value.toString().trim().toLowerCase();
};

// ======================================================
// GET ALL PRODUCTS
// ======================================================
exports.getAllProducts = async (req, res) => {
  try {
    const { category, subcategory, onSale, featured } = req.query;
    let filter = { active: true };

    if (category) filter.category = normalize(category);
    if (subcategory) filter.subcategory = normalize(subcategory);
    if (onSale) filter.onSale = onSale === 'true';
    if (featured) filter.featured = featured === 'true';

    const products = await Product.find(filter);
    res.json(products);

  } catch (error) {
    console.error("Error en getAllProducts:", error);
    res.status(500).json({ error: error.message });
  }
};

// ======================================================
// GET PRODUCT BY ID
// ======================================================
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json(product);

  } catch (error) {
    console.error("Error en getProductById:", error);
    res.status(500).json({ error: error.message });
  }
};

// ======================================================
// CREATE PRODUCT CORREGIDO - URLs CLOUDINARY
// ======================================================
// 📁 backend/controllers/productController.js - Agrega esto en createProduct
// 📁 backend/controllers/productController.js - CORREGIDO
exports.createProduct = async (req, res) => {
  try {
    console.log("🎯 CREATE PRODUCT - Iniciando");
    
    if (!req.file) {
      console.log("❌ No hay archivo");
      return res.status(400).json({ error: "No se recibió imagen" });
    }

    console.log("📁 Archivo recibido:", req.file);

    const { name, price, description, category, subcategory, sizes, onSale, featured } = req.body;

    // 🚨 CORRECCIÓN CRÍTICA: Guardar SOLO el public_id, NO URL completa
    const images = [`/uploads/${req.file.filename}`]; // ← Solo el public_id
    
    console.log("📸 Imágenes a guardar:", images);

    const productData = {
      name: name.trim(),
      description: (description || "").trim(),
      price: parseFloat(price),
      originalPrice: 0,
      category: category.trim(),
      subcategory: (subcategory || "").trim(),
      sizes: JSON.parse(sizes || '[]'),
      onSale: onSale === 'true',
      featured: featured === 'true',
      images: images, // ← Esto debería ser: ["/uploads/fashion-plus/product-xxx"]
      sku: `SKU-${Date.now()}`
    };

    const product = new Product(productData);
    await product.save();

    console.log("✅ PRODUCTO CREADO EXITOSAMENTE");
    console.log("📦 URLs guardadas en BD:", product.images);
    
    res.status(201).json({ 
      success: true, 
      product: product 
    });

  } catch (error) {
    console.error("❌ ERROR EN CREATE PRODUCT:", error);
    res.status(500).json({ 
      error: "Error interno del servidor",
      details: error.message 
    });
  }
};
// ======================================================
// DELETE PRODUCT
// ======================================================
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ======================================================
// GET FEATURED PRODUCTS
// ======================================================
exports.getFeaturedProducts = async (req, res) => {
  try {
    console.log("📦 Solicitando productos destacados...");
    const featuredProducts = await Product.find({ featured: true, active: true });
    console.log(`✅ Encontrados ${featuredProducts.length} productos destacados`);
    res.json(featuredProducts);
  } catch (error) {
    console.error("❌ ERROR en getFeaturedProducts:", error);
    res.status(500).json({ message: error.message });
  }
};