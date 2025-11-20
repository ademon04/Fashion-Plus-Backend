const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../config/multer');

// ✅ CORREGIDO: Usar solo el controlador, no duplicar lógica
router.get('/featured', productController.getFeaturedProducts); // ✅ PRIMERO

router.post("/create", upload.array("images", 5), productController.createProduct);
router.put("/update/:id", upload.array("images", 5), productController.updateProduct);
router.delete('/:id', productController.deleteProduct);
router.get('/', productController.getAllProducts);

router.get('/:id', productController.getProductById);




module.exports = router;