// 📁 backend/routes/products.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../config/multer');

// 🚨 CRÍTICO: Usar upload.single('image')
router.post("/create", upload.single("images"), productController.createProduct);
router.put("/update/:id", upload.single("images"), productController.updateProduct);
router.get('/featured', productController.getFeaturedProducts);
router.delete('/:id', productController.deleteProduct);
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

module.exports = router;