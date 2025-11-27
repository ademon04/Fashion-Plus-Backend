// 📁 backend/routes/products.js (AGREGA ESTO)
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../config/multer');
const Product = require('../models/Product');

// Endpoint de diagnóstico de imágenes
router.get('/diagnostic/images', async (req, res) => {
  try {
    const products = await Product.find().limit(5);
    
    const analysis = await Promise.all(products.map(async (product) => {
      const imageChecks = await Promise.all(
        (product.images || []).map(async (imgUrl) => {
          try {
            // Verificar si la imagen existe
            const response = await fetch(imgUrl, { method: 'HEAD' });
            return {
              url: imgUrl,
              exists: response.status === 200,
              status: response.status
            };
          } catch (error) {
            return {
              url: imgUrl,
              exists: false,
              error: error.message
            };
          }
        })
      );

      return {
        id: product._id,
        name: product.name,
        imageCount: product.images ? product.images.length : 0,
        imageAnalysis: imageChecks
      };
    }));

    res.json({
      success: true,
      cloudinaryConfig: {
        hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'Configurado' : 'No configurado'
      },
      analysis: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Tus rutas existentes...
router.get('/featured', productController.getFeaturedProducts);
router.post("/create", upload.single("image"), productController.createProduct);
router.put("/update/:id", upload.single("image"), productController.updateProduct);
router.delete('/:id', productController.deleteProduct);
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

module.exports = router;