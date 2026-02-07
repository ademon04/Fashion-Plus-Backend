const express = require ('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth, adminAuth } = require('../middleware/auth'); // ✅ IMPORTAR

// ✅ RUTAS PÚBLICAS (para clientes)
router.post('/', orderController.createOrder);               // Crear orden (pública)
router.post('/webhook', orderController.webhook);           // Webhook (pública)


// ✅ RUTAS PARA ADMINISTRADOR (PROTEGIDAS)
router.get('/', auth, adminAuth, orderController.getOrders);                    // Solo admin
router.get('/archived', auth, adminAuth, orderController.getArchivedOrders);    // Solo admin  
router.get('/:id', auth, adminAuth, orderController.getOrderById);              // Solo admin
router.put('/:id/status', auth, adminAuth, orderController.updateOrderStatus);  // Solo admin
router.put('/:id/archive', auth, adminAuth, orderController.archiveOrder);      // Solo admin
router.put('/:id/restore', auth, adminAuth, orderController.restoreOrder);      // Solo admin
router.delete('/:id', auth, adminAuth, orderController.deleteOrder);            // Solo admin
router.delete('/:id/permanent', auth, adminAuth, orderController.deletePermanently); // Solo admin

module.exports = router;