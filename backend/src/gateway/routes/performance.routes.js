/**
 * Performance Routes
 * Routes for performance monitoring and optimization
 */

const express = require('express');
const auth = require('../../middlewares/auth');
const performanceController = require('../controllers/performance.controller');

const router = express.Router();

// All performance routes require admin authentication
router.use(auth('admin'));

// Performance statistics and health
router.get('/stats', performanceController.getPerformanceStats);
router.get('/health', performanceController.getPerformanceHealth);

// Cache management
router.delete('/cache', performanceController.clearCaches);
router.delete('/cache/:cacheName', performanceController.clearCache);
router.get('/cache/stats', performanceController.getCacheStats);

// Component-specific statistics
router.get('/connection-pool', performanceController.getConnectionPoolStats);
router.get('/request-queue', performanceController.getRequestQueueStats);

// Performance optimization
router.get('/optimize', performanceController.getOptimizationSuggestions);
router.post('/reset-stats', performanceController.resetStats);

module.exports = router;