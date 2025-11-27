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
exports.createProduct = async (req, res) => {
  try {
    console.log("======================================");
    console.log("🛒 NUEVO PRODUCTO RECIBIDO");
    console.log("📥 Body original:", req.body);
    console.log("📸 Archivos recibidos:", req.files);

    // DEBUG: Mostrar información COMPLETA de los archivos
    if (req.files) {
      console.log("🔍 DEBUG - Info completa de archivos:");
      req.files.forEach((file, index) => {
        console.log(`   📁 Archivo ${index + 1}:`);
        console.log(`      - fieldname: ${file.fieldname}`);
        console.log(`      - originalname: ${file.originalname}`);
        console.log(`      - filename: ${file.filename}`);
        console.log(`      - path: ${file.path}`); // ✅ ESTA ES LA URL DE CLOUDINARY
        console.log(`      - size: ${file.size}`);
        console.log(`      - mimetype: ${file.mimetype}`);
      });
    }

    // Extraer y limpiar datos
    let { name, description, price, originalPrice, category, subcategory, sizes, onSale, featured } = req.body;

    // ✅ CORRECCIÓN COMPLETA: Procesamiento robusto de featured
    let featuredValue = false;
    if (featured !== undefined && featured !== null) {
      if (typeof featured === 'string') {
        featuredValue = (featured.toLowerCase() === 'true' || featured === '1');
      } else if (typeof featured === 'boolean') {
        featuredValue = featured;
      } else if (typeof featured === 'number') {
        featuredValue = Boolean(featured);
      }
    }
    
    console.log("🔍 DEBUG - Featured procesado:", {
      original: featured,
      tipoOriginal: typeof featured,
      procesado: featuredValue,
      tipoProcesado: typeof featuredValue
    });

    // Convertir a tipos correctos
    price = Number(price);
    originalPrice = originalPrice ? Number(originalPrice) : 0;
    onSale = onSale === 'true';

    // category y subcategory como string plano
    category = String(category).trim();
    subcategory = String(subcategory).trim();

    // sizes viene como JSON string desde FormData → parse
    let parsedSizes = [];
    if (sizes) {
      try {
        parsedSizes = JSON.parse(sizes);
        console.log("🔍 DEBUG - Sizes parseados:", parsedSizes);
      } catch (e) {
        console.error("❌ ERROR parseando sizes:", e);
        parsedSizes = [];
      }
    }

    // 🚨 CORRECCIÓN CRÍTICA: Usar URLs de Cloudinary en lugar de rutas locales
    const images = req.files?.map(file => {
      // ✅ file.path contiene la URL COMPLETA de Cloudinary
      if (file.path && file.path.includes('cloudinary.com')) {
        console.log(`✅ URL Cloudinary encontrada: ${file.path}`);
        return file.path;
      } else {
        console.log(`❌ Archivo sin URL Cloudinary:`, file);
        // Fallback: construir URL manualmente si es necesario
        return `/uploads/${file.filename}`;
      }
    }) || [];

    console.log("🔍 DEBUG - URLs de imágenes a guardar:", images);

    // 🔥 GENERAR SKU AUTOMÁTICO
    const generateSKU = () => {
      const categoryCode = category ? category.substring(0, 3).toUpperCase() : 'GEN';
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substr(2, 4).toUpperCase();
      return `${categoryCode}-${timestamp}-${random}`;
    };

    const sku = generateSKU();

    // ✅ CREAR PRODUCTO CON IMÁGENES CORREGIDAS
    const productData = {
      name,
      description,
      price,
      originalPrice,
      category,
      subcategory,
      sizes: parsedSizes,
      onSale,
      featured: featuredValue, // ✅ USAR EL VALOR CORREGIDO
      images, // ✅ AHORA CON URLs DE CLOUDINARY
      sku
    };

    console.log("🔍 DEBUG - Datos finales del producto:", productData);

    const product = new Product(productData);
    await product.save();

    console.log("✅ Producto creado correctamente");
    console.log("📦 Producto guardado:", {
      _id: product._id,
      name: product.name,
      featured: product.featured,
      images: product.images, // ✅ DEBERÍAN SER URLs DE CLOUDINARY
      sku: product.sku
    });

    res.status(201).json(product);

  } catch (error) {
    console.error("❌ ERROR CREANDO PRODUCTO:", error);
    res.status(400).json({ error: error.message });
  }
};

// ======================================================
// UPDATE PRODUCT + NUEVAS IMÁGENES + NORMALIZACIÓN + FEATURED
// ======================================================
exports.updateProduct = async (req, res) => {
  try {
    console.log("🔄 ACTUALIZANDO PRODUCTO:", req.params.id);
    console.log("📥 Datos recibidos:", req.body);

    const updateData = { ...req.body };

    // ✅ CORRECCIÓN: Procesar featured igual que en create
    if (updateData.featured !== undefined && updateData.featured !== null) {
      if (typeof updateData.featured === 'string') {
        updateData.featured = (updateData.featured.toLowerCase() === 'true' || updateData.featured === '1');
      } else if (typeof updateData.featured === 'boolean') {
        updateData.featured = updateData.featured;
      } else if (typeof updateData.featured === 'number') {
        updateData.featured = Boolean(updateData.featured);
      }
    }

    // Normalizar categoría y subcategoría si llegan
    if (updateData.category) {
      updateData.category = normalize(updateData.category);
    }

    if (updateData.subcategory) {
      updateData.subcategory = normalize(updateData.subcategory);
    }

    // Convertir onSale a booleano si viene
    if (updateData.onSale !== undefined) {
      updateData.onSale = updateData.onSale === 'true';
    }

    // Nuevas imágenes (si las mandan)
    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(file => `/uploads/${file.filename}`);
    }

    // Asegurar JSON válido para sizes
    if (updateData.sizes) {
      try {
        updateData.sizes = JSON.parse(updateData.sizes);
      } catch (e) {
        console.error("❌ ERROR parseando sizes en update:", e);
      }
    }

    console.log("🔍 DEBUG - Update data procesado:", updateData);

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    console.log("✅ Producto actualizado - Featured:", product.featured);
    return res.json({
      message: "Producto actualizado",
      product
    });

  } catch (error) {
    console.error("Error en updateProduct:", error);
    res.status(400).json({ error: error.message });
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