/**
 * Metrics Controller - Prometheus metrics endpoint
 * Provides metrics endpoint for Prometheus scraping
 */

const httpStatus = require('http-status');
const monitoringService = require('../services/monitoring.service');
const structuredLogger = require('../services/structured-logger.service');

/**
 * GET /metrics - Prometheus metrics endpoint
 */
const getMetrics = async (req, res) => {
  try {
    const metrics = await monitoringService.getMetrics();
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(httpStatus.OK).send(metrics);
    
    // Log metrics access
    if (req.logger) {
      req.logger.info('Metrics endpoint accessed', {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
    }
  } catch (error) {
    if (req.logger) {
      req.logger.error('Failed to retrieve metrics', error);
    }
    
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        message: 'Failed to retrieve metrics',
        type: 'internal_error',
        code: 'metrics_error',
      },
    });
  }
};

/**
 * GET /metrics/json - Metrics in JSON format (for debugging)
 */
const getMetricsJson = async (req, res) => {
  try {
    const metrics = await monitoringService.getMetricsAsJson();
    
    res.status(httpStatus.OK).json({
      timestamp: new Date().toISOString(),
      service: 'dyad-cli-gateway',
      metrics,
    });
    
    // Log JSON metrics access
    if (req.logger) {
      req.logger.info('JSON metrics endpoint accessed', {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
    }
  } catch (error) {
    if (req.logger) {
      req.logger.error('Failed to retrieve JSON metrics', error);
    }
    
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        message: 'Failed to retrieve metrics',
        type: 'internal_error',
        code: 'metrics_error',
      },
    });
  }
};

/**
 * POST /metrics/reset - Reset metrics (for testing only)
 */
const resetMetrics = async (req, res) => {
  // Only allow in development/test environments
  if (process.env.NODE_ENV === 'production') {
    return res.status(httpStatus.FORBIDDEN).json({
      error: {
        message: 'Metrics reset not allowed in production',
        type: 'permission_error',
        code: 'forbidden',
      },
    });
  }

  try {
    monitoringService.resetMetrics();
    
    res.status(httpStatus.OK).json({
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString(),
    });
    
    // Log metrics reset
    if (req.logger) {
      req.logger.info('Metrics reset performed', {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
    }
  } catch (error) {
    if (req.logger) {
      req.logger.error('Failed to reset metrics', error);
    }
    
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        message: 'Failed to reset metrics',
        type: 'internal_error',
        code: 'metrics_error',
      },
    });
  }
};

module.exports = {
  getMetrics,
  getMetricsJson,
  resetMetrics,
};