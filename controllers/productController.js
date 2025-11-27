// 📁 backend/controllers/productController.js
const Product = require('../models/Product');

exports.createProduct = async (req, res) => {
  try {
    console.log("🎯 CREATE PRODUCT - Iniciando");
    console.log("📁 Archivo recibido:", req.file);
    console.log("📝 Body recibido:", req.body);

    // 🚨 VALIDACIÓN MEJORADA
    if (!req.file) {
      console.log("❌ No se recibió archivo de imagen");
      return res.status(400).json({ 
        success: false,
        error: "No se recibió imagen. Por favor selecciona una imagen." 
      });
    }

    const { 
      name, 
      price, 
      description = "", 
      category, 
      subcategory = "", 
      sizes = "[]", 
      onSale = "false", 
      featured = "false" 
    } = req.body;

    // 🚨 VALIDACIÓN DE CAMPOS OBLIGATORIOS
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        success: false,
        error: "El nombre del producto es obligatorio" 
      });
    }

    if (!price || isNaN(parseFloat(price))) {
      return res.status(400).json({ 
        success: false,
        error: "El precio debe ser un número válido" 
      });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({ 
        success: false,
        error: "La categoría es obligatoria" 
      });
    }

    // 🚨 PROCESAMIENTO SEGURO DE DATOS
    const productData = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      originalPrice: 0,
      category: category.trim(),
      subcategory: subcategory.trim(),
      onSale: onSale === 'true',
      featured: featured === 'true',
      images: [`/uploads/${req.file.filename}`], // Solo public_id
      sku: `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    };

    // 🚨 PROCESAMIENTO SEGURO DE TALLAS
    try {
      productData.sizes = JSON.parse(sizes || '[]');
    } catch (parseError) {
      console.log("⚠️ Error parseando sizes, usando array vacío");
      productData.sizes = [];
    }

    console.log("📦 Datos del producto a guardar:", productData);

    // 🚨 CREACIÓN DEL PRODUCTO
    const product = new Product(productData);
    await product.save();

    console.log("✅ PRODUCTO CREADO EXITOSAMENTE");
    console.log("🆔 ID:", product._id);
    console.log("📸 Imágenes guardadas:", product.images);

    res.status(201).json({
      success: true,
      message: "Producto creado correctamente",
      product: product
    });

  } catch (error) {
    console.error("❌ ERROR CRÍTICO EN CREATE PRODUCT:", error);
    
    // 🚨 ERRORES ESPECÍFICOS DE MONGOOSE
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: "Error de validación: " + errors.join(', ')
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "El SKU ya existe"
      });
    }

    res.status(500).json({
      success: false,
      error: "Error interno del servidor al crear producto",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({});
    console.log(`📦 Obteniendo ${products.length} productos`);
    res.json(products);
  } catch (error) {
    console.error("❌ Error obteniendo productos:", error);
    res.status(500).json({ 
      success: false,
      error: "Error obteniendo productos" 
    });
  }
};

exports.getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ featured: true });
    console.log(`⭐ Obteniendo ${products.length} productos destacados`);
    res.json(products);
  } catch (error) {
    console.error("❌ Error obteniendo productos destacados:", error);
    res.status(500).json({ 
      success: false,
      error: "Error obteniendo productos destacados" 
    });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.log("❌ Producto no encontrado:", req.params.id);
      return res.status(404).json({ 
        success: false,
        error: "Producto no encontrado" 
      });
    }
    console.log("🔍 Producto encontrado:", product.name);
    res.json(product);
  } catch (error) {
    console.error("❌ Error obteniendo producto:", error);
    res.status(500).json({ 
      success: false,
      error: "Error obteniendo producto" 
    });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    console.log("🔄 UPDATE PRODUCT - ID:", req.params.id);
    
    const updates = { ...req.body };
    
    if (req.file) {
      updates.images = [`/uploads/${req.file.filename}`];
      console.log("📸 Nueva imagen:", updates.images);
    }
    
    if (updates.sizes && typeof updates.sizes === 'string') {
      updates.sizes = JSON.parse(updates.sizes);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        error: "Producto no encontrado" 
      });
    }

    console.log("✅ PRODUCTO ACTUALIZADO:", product.name);
    res.json({
      success: true,
      product: product
    });

  } catch (error) {
    console.error("❌ Error actualizando producto:", error);
    res.status(500).json({ 
      success: false,
      error: "Error actualizando producto" 
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        error: "Producto no encontrado" 
      });
    }

    console.log("🗑️ PRODUCTO ELIMINADO:", product.name);
    res.json({ 
      success: true, 
      message: "Producto eliminado correctamente" 
    });

  } catch (error) {
    console.error("❌ Error eliminando producto:", error);
    res.status(500).json({ 
      success: false,
      error: "Error eliminando producto" 
    });
  }
};