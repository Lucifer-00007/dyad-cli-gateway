/**
 * Performance Controller
 * Handles performance monitoring and optimization endpoints
 */

const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const GatewayService = require('../services/gateway.service');

const gatewayService = new GatewayService();

/**
 * Get performance statistics
 */
const getPerformanceStats = catchAsync(async (req, res) => {
  const stats = gatewayService.getPerformanceStats();
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: stats,
    timestamp: new Date().toISOString()
  });
});

/**
 * Get performance health status
 */
const getPerformanceHealth = catchAsync(async (req, res) => {
  const health = gatewayService.getPerformanceHealth();
  
  const statusCode = health.status === 'healthy' ? httpStatus.OK :
                    health.status === 'degraded' ? httpStatus.OK :
                    httpStatus.SERVICE_UNAVAILABLE;
  
  res.status(statusCode).json({
    status: health.status,
    data: health,
    timestamp: new Date().toISOString()
  });
});

/**
 * Clear all caches
 */
const clearCaches = catchAsync(async (req, res) => {
  gatewayService.clearCaches();
  
  res.status(httpStatus.OK).json({
    status: 'success',
    message: 'All caches cleared successfully',
    timestamp: new Date().toISOString()
  });
});

/**
 * Clear specific cache
 */
const clearCache = catchAsync(async (req, res) => {
  const { cacheName } = req.params;
  
  const validCaches = ['models', 'providers', 'health', 'responses'];
  if (!validCaches.includes(cacheName)) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: 'error',
      message: `Invalid cache name. Valid options: ${validCaches.join(', ')}`,
      timestamp: new Date().toISOString()
    });
  }
  
  gatewayService.performanceService.clearCache(cacheName);
  
  res.status(httpStatus.OK).json({
    status: 'success',
    message: `Cache '${cacheName}' cleared successfully`,
    timestamp: new Date().toISOString()
  });
});

/**
 * Get connection pool statistics
 */
const getConnectionPoolStats = catchAsync(async (req, res) => {
  const stats = gatewayService.getPerformanceStats();
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: stats.connectionPool || {},
    timestamp: new Date().toISOString()
  });
});

/**
 * Get request queue statistics
 */
const getRequestQueueStats = catchAsync(async (req, res) => {
  const stats = gatewayService.getPerformanceStats();
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: stats.requestQueue || {},
    timestamp: new Date().toISOString()
  });
});

/**
 * Get cache statistics
 */
const getCacheStats = catchAsync(async (req, res) => {
  const stats = gatewayService.getPerformanceStats();
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: stats.caches || {},
    timestamp: new Date().toISOString()
  });
});

/**
 * Reset performance statistics
 */
const resetStats = catchAsync(async (req, res) => {
  if (gatewayService.performanceService) {
    gatewayService.performanceService.resetStats();
  }
  
  res.status(httpStatus.OK).json({
    status: 'success',
    message: 'Performance statistics reset successfully',
    timestamp: new Date().toISOString()
  });
});

/**
 * Get performance optimization suggestions
 */
const getOptimizationSuggestions = catchAsync(async (req, res) => {
  const suggestions = gatewayService.performanceService?.optimize() || [];
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: {
      suggestions,
      count: suggestions.length,
      hasOptimizations: suggestions.length > 0
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  getPerformanceStats,
  getPerformanceHealth,
  clearCaches,
  clearCache,
  getConnectionPoolStats,
  getRequestQueueStats,
  getCacheStats,
  resetStats,
  getOptimizationSuggestions
};