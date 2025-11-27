// 📁 backend/routes/products.js - VERSIÓN CORREGIDA
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../config/multer');

// 🚨 RUTAS CORREGIDAS - Todas con funciones válidas
router.post("/create", upload.single("images"), productController.createProduct);
router.put("/update/:id", upload.single("images"), productController.updateProduct);
router.get('/featured', productController.getFeaturedProducts);
router.delete('/:id', productController.deleteProduct);
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

module.exports = router;