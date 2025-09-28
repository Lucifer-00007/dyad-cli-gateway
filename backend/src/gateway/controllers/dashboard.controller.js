/**
 * Dashboard Controller
 * Provides comprehensive dashboard data for monitoring
 */

const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const GatewayService = require('../services/gateway.service');
const monitoringService = require('../services/monitoring.service');

const gatewayService = new GatewayService();

/**
 * Get comprehensive dashboard data
 */
const getDashboardData = catchAsync(async (req, res) => {
  const [
    performanceStats,
    performanceHealth,
    circuitBreakerStatus,
    reliabilityStats,
    healthMonitorStatus
  ] = await Promise.all([
    gatewayService.getPerformanceStats(),
    gatewayService.getPerformanceHealth(),
    gatewayService.getCircuitBreakerStatus(),
    gatewayService.getReliabilityStatistics(),
    gatewayService.getHealthMonitorStatus()
  ]);

  const dashboardData = {
    timestamp: new Date().toISOString(),
    status: performanceHealth.status,
    overview: {
      uptime: performanceStats.uptime,
      totalRequests: performanceStats.requests.total,
      successRate: `${((performanceStats.requests.successful / Math.max(performanceStats.requests.total, 1)) * 100).toFixed(2)}%`,
      averageResponseTime: `${Math.round(performanceStats.requests.averageResponseTime)}ms`,
      throughput: `${performanceStats.performance.throughput} req/min`
    },
    performance: {
      requests: performanceStats.requests,
      cacheHitRate: `${performanceStats.performance.cacheHitRate.toFixed(2)}%`,
      queueUtilization: `${performanceStats.performance.queueUtilization.toFixed(2)}%`,
      connectionPoolEfficiency: `${performanceStats.performance.connectionPoolEfficiency}%`
    },
    components: {
      connectionPool: performanceStats.connectionPool,
      requestQueue: performanceStats.requestQueue,
      caches: performanceStats.caches
    },
    reliability: {
      circuitBreakers: circuitBreakerStatus,
      fallbackPolicies: reliabilityStats.fallbackPolicy,
      healthMonitor: healthMonitorStatus
    },
    health: performanceHealth
  };

  res.status(httpStatus.OK).json({
    status: 'success',
    data: dashboardData
  });
});

/**
 * Get real-time metrics for dashboard
 */
const getRealTimeMetrics = catchAsync(async (req, res) => {
  const performanceStats = gatewayService.getPerformanceStats();
  const currentTime = Date.now();
  
  const metrics = {
    timestamp: currentTime,
    requests: {
      total: performanceStats.requests.total,
      successful: performanceStats.requests.successful,
      failed: performanceStats.requests.failed,
      rate: performanceStats.performance.throughput
    },
    performance: {
      averageResponseTime: performanceStats.requests.averageResponseTime,
      p95ResponseTime: performanceStats.requests.p95ResponseTime,
      p99ResponseTime: performanceStats.requests.p99ResponseTime
    },
    resources: {
      queueSize: performanceStats.requestQueue?.currentQueueSize || 0,
      activeConnections: performanceStats.connectionPool?.http?.active + performanceStats.connectionPool?.https?.active || 0,
      cacheHitRate: performanceStats.performance.cacheHitRate
    }
  };

  res.status(httpStatus.OK).json({
    status: 'success',
    data: metrics
  });
});

/**
 * Get performance trends over time
 */
const getPerformanceTrends = catchAsync(async (req, res) => {
  const { timeRange = '1h' } = req.query;
  
  // This would typically query a time-series database
  // For now, return current stats as a single data point
  const performanceStats = gatewayService.getPerformanceStats();
  const currentTime = Date.now();
  
  const trends = {
    timeRange,
    dataPoints: [{
      timestamp: currentTime,
      requests: performanceStats.requests.total,
      responseTime: performanceStats.requests.averageResponseTime,
      errorRate: performanceStats.requests.total > 0 
        ? (performanceStats.requests.failed / performanceStats.requests.total * 100)
        : 0,
      throughput: performanceStats.performance.throughput
    }],
    summary: {
      averageResponseTime: performanceStats.requests.averageResponseTime,
      peakThroughput: performanceStats.performance.throughput,
      errorRate: performanceStats.requests.total > 0 
        ? (performanceStats.requests.failed / performanceStats.requests.total * 100)
        : 0
    }
  };

  res.status(httpStatus.OK).json({
    status: 'success',
    data: trends
  });
});

/**
 * Get system alerts and warnings
 */
const getSystemAlerts = catchAsync(async (req, res) => {
  const performanceHealth = gatewayService.getPerformanceHealth();
  const circuitBreakerStatus = gatewayService.getCircuitBreakerStatus();
  
  const alerts = [];
  
  // Performance alerts
  if (performanceHealth.status === 'unhealthy') {
    alerts.push({
      level: 'critical',
      type: 'performance',
      message: 'System performance is unhealthy',
      details: performanceHealth.issues,
      timestamp: new Date().toISOString()
    });
  } else if (performanceHealth.status === 'degraded') {
    alerts.push({
      level: 'warning',
      type: 'performance',
      message: 'System performance is degraded',
      details: performanceHealth.issues,
      timestamp: new Date().toISOString()
    });
  }
  
  // Circuit breaker alerts
  Object.entries(circuitBreakerStatus).forEach(([providerId, status]) => {
    if (status.state === 'open') {
      alerts.push({
        level: 'warning',
        type: 'circuit_breaker',
        message: `Circuit breaker open for provider ${providerId}`,
        details: { providerId, failures: status.failures },
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Queue alerts
  const queueHealth = performanceHealth.components?.requestQueue;
  if (queueHealth && queueHealth.status !== 'healthy') {
    alerts.push({
      level: queueHealth.status === 'unhealthy' ? 'critical' : 'warning',
      type: 'queue',
      message: `Request queue is ${queueHealth.status}`,
      details: queueHealth,
      timestamp: new Date().toISOString()
    });
  }
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: {
      alerts,
      count: alerts.length,
      hasAlerts: alerts.length > 0
    }
  });
});

/**
 * Get top performing and problematic providers
 */
const getProviderInsights = catchAsync(async (req, res) => {
  const circuitBreakerStatus = gatewayService.getCircuitBreakerStatus();
  const reliabilityStats = gatewayService.getReliabilityStatistics();
  
  const providers = Object.entries(circuitBreakerStatus).map(([providerId, status]) => ({
    providerId,
    status: status.state,
    successRate: status.successRate || 0,
    failures: status.failures || 0,
    lastFailure: status.lastFailure,
    responseTime: status.averageResponseTime || 0
  }));
  
  // Sort by success rate (best performing first)
  const topPerforming = [...providers]
    .filter(p => p.status === 'closed')
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5);
  
  // Sort by failure count (most problematic first)
  const problematic = [...providers]
    .filter(p => p.failures > 0)
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 5);
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: {
      topPerforming,
      problematic,
      totalProviders: providers.length,
      healthyProviders: providers.filter(p => p.status === 'closed').length
    }
  });
});

module.exports = {
  getDashboardData,
  getRealTimeMetrics,
  getPerformanceTrends,
  getSystemAlerts,
  getProviderInsights
};