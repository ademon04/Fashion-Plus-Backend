// 📁 backend/routes/products.js - VERSIÓN DEFINITIVA
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../config/multer');

// ✅ RUTA CREATE - CORREGIDA
router.post("/create", upload.single("image"), async (req, res) => {
  try {
    await productController.createProduct(req, res);
  } catch (error) {
    console.error("❌ Error en ruta create:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ✅ RUTA UPDATE - CORREGIDA  
router.put("/update/:id", upload.single("image"), async (req, res) => {
  try {
    await productController.updateProduct(req, res);
  } catch (error) {
    console.error("❌ Error en ruta update:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ✅ RUTA GET FEATURED
router.get('/featured', async (req, res) => {
  try {
    await productController.getFeaturedProducts(req, res);
  } catch (error) {
    console.error("❌ Error en ruta featured:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ✅ RUTA DELETE
router.delete('/:id', async (req, res) => {
  try {
    await productController.deleteProduct(req, res);
  } catch (error) {
    console.error("❌ Error en ruta delete:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ✅ RUTA GET ALL PRODUCTS
router.get('/', async (req, res) => {
  try {
    await productController.getAllProducts(req, res);
  } catch (error) {
    console.error("❌ Error en ruta get all:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ✅ RUTA GET BY ID
router.get('/:id', async (req, res) => {
  try {
    await productController.getProductById(req, res);
  } catch (error) {
    console.error("❌ Error en ruta get by id:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;