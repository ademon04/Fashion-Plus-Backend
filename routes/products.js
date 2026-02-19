// backend/routes/products.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../config/multer');
const { auth, adminAuth } = require('../middleware/auth'); // ✅ IMPORTAR

// ✅ RUTAS PÚBLICAS (sin autenticación)
router.get('/featured', productController.getFeaturedProducts);
router.get('/category/:category', productController.getProductsByCategory);
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// ✅ RUTAS PROTEGIDAS DE ADMINISTRADOR
router.post("/create", auth, adminAuth, upload.array("images", 5), productController.createProduct);
router.put("/update/:id", auth, adminAuth, upload.array("images", 5), productController.updateProduct);
router.delete('/:id', auth, adminAuth, productController.deleteProduct);

module.exports = router;