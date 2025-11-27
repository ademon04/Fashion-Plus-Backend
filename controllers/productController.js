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
exports.createProduct = async (req, res) => {
  try {
    console.log("🛒 CREANDO PRODUCTO - DEBUG COMPLETO:");
    console.log("📁 Archivo completo:", JSON.stringify(req.file, null, 2));
    
    if (!req.file) {
      return res.status(400).json({ error: "No se recibió imagen" });
    }

    // 🚨 VER QUÉ ESTÁ DEVOLVIENDO CLOUDINARY
    console.log("🔍 CLOUDINARY DEBUG:");
    console.log("   - filename:", req.file.filename);
    console.log("   - path:", req.file.path);
    console.log("   - originalname:", req.file.originalname);
    console.log("   - fieldname:", req.file.fieldname);
    console.log("   - size:", req.file.size);
    console.log("   - mimetype:", req.file.mimetype);

    const { name, price, description, category, subcategory, sizes, onSale, featured } = req.body;

    // 🚨 PRUEBA DIFERENTES FORMATOS
    const image = [];
    
    // Opción 1: Usar solo el filename (public_id)
    image.push(`/uploads/${req.file.filename}`);
    
    // Opción 2: Si path es URL de Cloudinary, usarla
    if (req.file.path && req.file.path.includes('cloudinary.com')) {
      image.push(req.file.path);
    }
    
    // Opción 3: Construir URL manualmente
    image.push(`https://res.cloudinary.com/dzxrcak6k/image/upload/${req.file.filename}`);

    console.log("🎯 URLs a guardar:", image);

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
      image: image, // 🚨 GUARDAR TODAS LAS OPCIONES
      sku: `SKU-${Date.now()}`
    };

    const product = new Product(productData);
    await product.save();

    console.log("✅ PRODUCTO CREADO - URLs guardadas:", product.image);
    res.status(201).json({ success: true, product });

  } catch (error) {
    console.error("❌ ERROR:", error);
    res.status(500).json({ error: "Error interno del servidor" });
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