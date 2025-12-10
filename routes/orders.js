const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// ✅ RUTAS PÚBLICAS
router.post('/', orderController.createOrder);
router.post('/webhook', orderController.webhook);

// ✅ RUTAS PARA ADMINISTRADOR
router.get('/', orderController.getOrders);                    // Obtener todas las órdenes (con filtro archived)
router.get('/archived', orderController.getArchivedOrders);    // 🆕 Obtener solo archivadas
router.get('/my-orders', orderController.getMyOrders);         // Órdenes del usuario
router.get('/:id', orderController.getOrderById);              // Obtener orden por ID

// ✅ RUTAS DE ADMINISTRACIÓN
router.put('/:id/status', orderController.updateOrderStatus);  // Actualizar estado
router.put('/:id/archive', orderController.archiveOrder);      // 🆕 Archivar/Desarchivar
router.put('/:id/restore', orderController.restoreOrder);      // 🆕 Restaurar (alternativa)
router.delete('/:id', orderController.deleteOrder);            // Eliminar (soft delete)
router.delete('/:id/permanent', orderController.deletePermanently); // 🆕 Eliminar permanentemente

module.exports = router;