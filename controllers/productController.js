// 📁 backend/controllers/productController.js
const Product = require('../models/Product');

// =========================================================
// 🟩 1. CREATE PRODUCT - Cloudinary + Validaciones
// =========================================================
exports.createProduct = async (req, res) => {
  try {
    console.log("🎯 CREATE PRODUCT - Iniciando");
    
    // 🛡️ VALIDACIÓN: Imágenes obligatorias
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No se recibieron imágenes. Por favor sube al menos una imagen."
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

    // 🛡️ VALIDACIONES DE CAMPOS OBLIGATORIOS
   if (!name || name.trim().length === 0) {
  return res.status(400).json({ 
    success: false, 
    error: "El nombre del producto es obligatorio y no puede contener solo espacios" 
  });
}

    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: "El precio debe ser un número válido mayor a 0" 
      });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: "La categoría es obligatoria" 
      });
    }

    // 🛡️ CLOUDINARY: URLs completas
    const imageUrls = req.files.map(file => {
      console.log(`🖼️ Imagen subida: ${file.path}`);
      return file.path;
    });

    // 🛡️ CONSTRUCCIÓN SEGURA DEL PRODUCTO
    const productData = {
  name: name,                    // SIN .trim() - permite espacios normales
  description: description,      // SIN .trim() - permite espacios normales
  price: parseFloat(price),
  originalPrice: 0,
  category: category ? category.trim() : '',
  subcategory: subcategory ? subcategory.trim() : '',
  onSale: onSale === "true",
  featured: featured === "true",
  images: imageUrls,
  sku: `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
};

    // 🛡️ PARSEO SEGURO DE TALLAS
    try {
      productData.sizes = JSON.parse(sizes || "[]");
    } catch (error) {
      productData.sizes = [];
    }

    console.log("📦 Producto a guardar:", productData);

    // 🛡️ GUARDADO EN BASE DE DATOS
    const product = new Product(productData);
    await product.save();

    console.log("✅ PRODUCTO CREADO EXITOSAMENTE - ID:", product._id);

    res.status(201).json({
      success: true,
      message: "Producto creado correctamente",
      product: product
    });

  } catch (error) {
    console.error("❌ ERROR EN CREATE PRODUCT:", error);
    
    // 🛡️ MANEJO ESPECÍFICO DE ERRORES
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
        error: "El SKU ya existe. Intenta crear el producto nuevamente."
      });
    }

    res.status(500).json({
      success: false,
      error: "Error interno del servidor al crear producto"
    });
  }
};

// =========================================================
// 🟩 2. GET ALL PRODUCTS - Con manejo de errores
// =========================================================
exports.getAllProducts = async (req, res) => {
  try {
    console.log("📦 GET ALL PRODUCTS - Solicitando todos los productos");
    
    const products = await Product.find({}).sort({ createdAt: -1 });
    
    console.log(`✅ Encontrados ${products.length} productos`);
    
    res.json({
      success: true,
      count: products.length,
      products: products
    });

  } catch (error) {
    console.error("❌ ERROR EN GET ALL PRODUCTS:", error);
    
    res.status(500).json({
      success: false,
      error: "Error al obtener los productos"
    });
  }
};

// =========================================================
// 🟩 3. GET FEATURED PRODUCTS - Productos destacados
// =========================================================
exports.getFeaturedProducts = async (req, res) => {
  try {
    console.log("⭐ GET FEATURED PRODUCTS - Solicitando productos destacados");
    
    const products = await Product.find({ 
      featured: true,
      active: true 
    }).limit(10).sort({ createdAt: -1 });
    
    console.log(`✅ Encontrados ${products.length} productos destacados`);
    
    res.json({
      success: true,
      count: products.length,
      products: products
    });

  } catch (error) {
    console.error("❌ ERROR EN GET FEATURED PRODUCTS:", error);
    
    res.status(500).json({
      success: false,
      error: "Error al obtener productos destacados"
    });
  }
};

// =========================================================
// 🟩 4. GET PRODUCT BY ID - Con validación de ID
// =========================================================
exports.getProductById = async (req, res) => {
  try {
    const productId = req.params.id;
    console.log(`🔍 GET PRODUCT BY ID - Buscando producto: ${productId}`);
    
    // 🛡️ VALIDACIÓN: ID válido de MongoDB
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "ID de producto inválido"
      });
    }

    const product = await Product.findById(productId);
    
    if (!product) {
      console.log("❌ Producto no encontrado:", productId);
      return res.status(404).json({
        success: false,
        error: "Producto no encontrado"
      });
    }

    // 🛡️ VERIFICAR SI EL PRODUCTO ESTÁ ACTIVO
    if (!product.active) {
      console.log("⚠️ Producto inactivo:", productId);
      return res.status(404).json({
        success: false,
        error: "Producto no disponible"
      });
    }

    console.log("✅ Producto encontrado:", product.name);
    
    res.json({
      success: true,
      product: product
    });

  } catch (error) {
    console.error("❌ ERROR EN GET PRODUCT BY ID:", error);
    
    res.status(500).json({
      success: false,
      error: "Error al obtener el producto"
    });
  }
};

// =========================================================
// 🟩 5. UPDATE PRODUCT - Con manejo seguro de actualizaciones
// =========================================================
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    console.log(`🔄 UPDATE PRODUCT - Actualizando producto: ${productId}`);
    
    // 🛡️ VALIDACIÓN: ID válido
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "ID de producto inválido"
      });
    }

    const updates = { ...req.body };
    
    // 🛡️ ACTUALIZACIÓN DE IMÁGENES (si se suben nuevas)
    if (req.files && req.files.length > 0) {
  updates.images = req.files.map(file => file.path);
  console.log("📸 Nuevas imágenes:", updates.images);
}

    // 🛡️ PARSEO SEGURO DE TALLAS
    if (updates.sizes && typeof updates.sizes === "string") {
      try {
        updates.sizes = JSON.parse(updates.sizes);
      } catch (error) {
        console.log("⚠️ Error parseando sizes, manteniendo valor actual");
        delete updates.sizes; // No actualizar sizes si hay error
      }
    }

    // 🛡️ CONVERSIÓN SEGURA DE TIPOS
    if (updates.price) updates.price = parseFloat(updates.price);
    if (updates.originalPrice) updates.originalPrice = parseFloat(updates.originalPrice);
    if (updates.onSale) updates.onSale = updates.onSale === "true";
    if (updates.featured) updates.featured = updates.featured === "true";

    console.log("📝 Actualizaciones a aplicar:", updates);

    const product = await Product.findByIdAndUpdate(
      productId, 
      updates, 
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Producto no encontrado"
      });
    }

    console.log("✅ PRODUCTO ACTUALIZADO:", product.name);
    
    res.json({
      success: true,
      message: "Producto actualizado correctamente",
      product: product
    });

  } catch (error) {
    console.error("❌ ERROR EN UPDATE PRODUCT:", error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: "Error de validación: " + errors.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      error: "Error al actualizar el producto"
    });
  }
};

// =========================================================
// 🟩 6. DELETE PRODUCT - Eliminación segura
// =========================================================
exports.deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    console.log(`🗑️ DELETE PRODUCT - Eliminando producto: ${productId}`);
    
    // 🛡️ VALIDACIÓN: ID válido
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "ID de producto inválido"
      });
    }

    const product = await Product.findByIdAndDelete(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Producto no encontrado"
      });
    }

    console.log("✅ PRODUCTO ELIMINADO:", product.name);
    
    res.json({
      success: true,
      message: "Producto eliminado correctamente",
      deletedProduct: {
        id: product._id,
        name: product.name
      }
    });

  } catch (error) {
    console.error("❌ ERROR EN DELETE PRODUCT:", error);
    
    res.status(500).json({
      success: false,
      error: "Error al eliminar el producto"
    });
  }
};

// =========================================================
// 🟩 7. GET PRODUCTS BY CATEGORY - Extra útil
// =========================================================
exports.getProductsByCategory = async (req, res) => {
  try {
    const category = req.params.category;
    console.log(`🏷️ GET PRODUCTS BY CATEGORY - Categoría: ${category}`);
    
    const products = await Product.find({ 
      category: category,
      active: true 
    }).sort({ createdAt: -1 });
    
    console.log(`✅ Encontrados ${products.length} productos en categoría ${category}`);
    
    res.json({
      success: true,
      category: category,
      count: products.length,
      products: products
    });

  } catch (error) {
    console.error("❌ ERROR EN GET PRODUCTS BY CATEGORY:", error);
    
    res.status(500).json({
      success: false,
      error: "Error al obtener productos por categoría"
    });
  }
};