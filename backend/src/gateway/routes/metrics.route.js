/**
 * Metrics Routes - Prometheus metrics endpoints
 * Routes for metrics collection and monitoring
 */

const express = require('express');
const metricsController = require('../controllers/metrics.controller');
const { correlationId } = require('../middlewares/monitoring.middleware');

const router = express.Router();

// Apply correlation ID middleware to all metrics routes
router.use(correlationId);

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Get Prometheus metrics
 *     description: Returns metrics in Prometheus format for scraping
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       500:
 *         description: Internal server error
 */
router.get('/', metricsController.getMetrics);

/**
 * @swagger
 * /metrics/json:
 *   get:
 *     summary: Get metrics in JSON format
 *     description: Returns metrics in JSON format for debugging
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Metrics in JSON format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 *                 metrics:
 *                   type: array
 *       500:
 *         description: Internal server error
 */
router.get('/json', metricsController.getMetricsJson);

/**
 * @swagger
 * /metrics/reset:
 *   post:
 *     summary: Reset all metrics
 *     description: Reset all metrics (development/test only)
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Metrics reset successfully
 *       403:
 *         description: Forbidden in production
 *       500:
 *         description: Internal server error
 */
router.post('/reset', metricsController.resetMetrics);

module.exports = router;