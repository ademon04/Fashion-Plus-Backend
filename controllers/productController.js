// 📁 backend/controllers/productController.js
const Product = require('../models/Product');

// =========================================================
// 🟩 CREATE PRODUCT (Cloudinary + req.files + estructura ordenada)
// =========================================================
exports.createProduct = async (req, res) => {
  try {
    console.log("🎯 CREATE PRODUCT - Iniciando");
    console.log("📁 Archivos recibidos:", req.files);
    console.log("📝 Body recibido:", req.body);

    // 🚨 VALIDACIÓN: imágenes obligatorias
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No se recibió imagen"
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

    // 🚨 VALIDACIONES DE CAMPOS
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "El nombre del producto es obligatorio" });
    }

    if (!price || isNaN(parseFloat(price))) {
      return res.status(400).json({ success: false, error: "El precio debe ser un número válido" });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, error: "La categoría es obligatoria" });
    }

    // 🟩 Cloudinary devuelve URL completa de imagen en file.path
    const imageUrls = req.files.map(file => file.path);
console.log(" URLs de Cloudinary generadas:", imageUrls);

    // 🟩 Construcción del objeto del producto
    const productData = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      originalPrice: 0,
      category: category.trim(),
      subcategory: subcategory.trim(),
      onSale: onSale === "true",
      featured: featured === "true",
      images: imageUrls, // 🟢 URLs completas de Cloudinary
      sku: `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    };

    // 🟩 Parseo seguro de tallas
    try {
      productData.sizes = JSON.parse(sizes || "[]");
    } catch {
      console.log("⚠️ Error parseando sizes, usando array vacío");
      productData.sizes = [];
    }

    console.log("📦 Producto a guardar:", productData);

    // 🟩 Guardado en BD
    const product = new Product(productData);
    await product.save();

    console.log("✅ PRODUCTO CREADO EXITOSAMENTE");

    res.status(201).json({
      success: true,
      message: "Producto creado correctamente",
      product
    });

  } catch (error) {
    console.error("❌ ERROR CRÍTICO EN CREATE PRODUCT:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, error: errors.join(", ") });
    }

    res.status(500).json({
      success: false,
      error: "Error interno del servidor al crear producto"
    });
  }
};
exports.updateProduct = async (req, res) => {
  try {
    console.log("🔄 UPDATE PRODUCT:", req.params.id);

    const updates = { ...req.body };

    // Si viene nueva imagen → reemplazarla
    if (req.file) {
      updates.images = [req.file.path]; // 🟢 URL completa de Cloudinary
      console.log("📸 Nueva imagen asignada");
    }

    // Parseo de tallas
    if (updates.sizes && typeof updates.sizes === "string") {
      try {
        updates.sizes = JSON.parse(updates.sizes);
      } catch {
        updates.sizes = [];
      }
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });

    if (!product) {
      return res.status(404).json({ success: false, error: "Producto no encontrado" });
    }

    res.json({ success: true, product });

  } catch (error) {
    console.error("❌ Error actualizando producto:", error);
    res.status(500).json({ success: false, error: "Error actualizando producto" });
  }
};
