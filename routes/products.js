// 📁 backend/routes/products.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../config/multer');

// ✅ TODAS LAS RUTAS CON SUS CONTROLADORES
router.get('/featured', productController.getFeaturedProducts);
router.get('/category/:category', productController.getProductsByCategory);
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.post("/create", upload.array("images", 5), productController.createProduct);
router.put("/update/:id", upload.array("images", 5), productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;