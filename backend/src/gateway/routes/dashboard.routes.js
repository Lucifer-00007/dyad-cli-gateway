/**
 * Dashboard Routes
 * Routes for dashboard and monitoring data
 */

const express = require('express');
const auth = require('../../middlewares/auth');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

// All dashboard routes require admin authentication
router.use(auth('admin'));

// Dashboard data endpoints
router.get('/', dashboardController.getDashboardData);
router.get('/metrics/realtime', dashboardController.getRealTimeMetrics);
router.get('/metrics/trends', dashboardController.getPerformanceTrends);
router.get('/alerts', dashboardController.getSystemAlerts);
router.get('/providers/insights', dashboardController.getProviderInsights);

module.exports = router;