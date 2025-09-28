/**
 * Performance Service
 * Coordinates performance optimization components and monitoring
 */

const logger = require('../../config/logger');
const ConnectionPoolService = require('./connection-pool.service');
const RequestQueueService = require('./request-queue.service');
const EnhancedCacheService = require('./enhanced-cache.service');
const monitoringService = require('./monitoring.service');

class PerformanceService {
  constructor(options = {}) {
    this.options = {
      connectionPool: {
        maxSockets: options.maxSockets || 50,
        maxFreeSockets: options.maxFreeSockets || 10,
        timeout: options.timeout || 30000,
        keepAlive: true,
        ...options.connectionPool
      },
      requestQueue: {
        maxConcurrent: options.maxConcurrent || 10,
        maxQueueSize: options.maxQueueSize || 100,
        timeout: options.requestTimeout || 30000,
        priorityLevels: 3,
        ...options.requestQueue
      },
      cache: {
        models: {
          maxSize: 100,
          defaultTTL: 300000, // 5 minutes
          ...options.cache?.models
        },
        providers: {
          maxSize: 50,
          defaultTTL: 60000, // 1 minute
          ...options.cache?.providers
        },
        health: {
          maxSize: 100,
          defaultTTL: 30000, // 30 seconds
          ...options.cache?.health
        },
        responses: {
          maxSize: 500,
          defaultTTL: 60000, // 1 minute
          ...options.cache?.responses
        }
      },
      monitoring: {
        metricsInterval: options.metricsInterval || 10000, // 10 seconds
        healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
        ...options.monitoring
      },
      ...options
    };

    this.initialized = false;
    this.metrics = {
      startTime: Date.now(),
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      },
      performance: {
        cacheHitRate: 0,
        queueUtilization: 0,
        connectionPoolEfficiency: 0,
        throughput: 0
      }
    };

    this.responseTimes = [];
    this.maxResponseTimeHistory = 1000;
  }

  /**
   * Initialize performance service
   */
  async initialize() {
    try {
      logger.info('Initializing performance service...');

      // Initialize connection pool
      this.connectionPool = new ConnectionPoolService(this.options.connectionPool);

      // Initialize request queue
      this.requestQueue = new RequestQueueService(this.options.requestQueue);

      // Initialize caches
      this.caches = {
        models: new EnhancedCacheService(this.options.cache.models),
        providers: new EnhancedCacheService(this.options.cache.providers),
        health: new EnhancedCacheService(this.options.cache.health),
        responses: new EnhancedCacheService(this.options.cache.responses)
      };

      // Start monitoring intervals
      this.startMonitoring();

      this.initialized = true;
      logger.info('Performance service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize performance service:', error);
      throw error;
    }
  }

  /**
   * Execute request with performance optimizations
   * @param {Function} requestFn - Request function
   * @param {Object} options - Request options
   * @returns {Promise}
   */
  async executeRequest(requestFn, options = {}) {
    const startTime = Date.now();
    const {
      priority = 1,
      timeout = this.options.requestQueue.timeout,
      cacheKey = null,
      cacheTTL = null,
      useQueue = true,
      metadata = {}
    } = options;

    try {
      // Check cache first if cache key provided
      if (cacheKey) {
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
          this.recordRequest(startTime, true, 'cache_hit');
          return cached;
        }
      }

      // Execute request through queue or directly
      let result;
      if (useQueue) {
        result = await this.requestQueue.enqueue(requestFn, {
          priority,
          timeout,
          metadata
        });
      } else {
        result = await requestFn();
      }

      // Cache result if cache key provided
      if (cacheKey && result) {
        this.setCachedResponse(cacheKey, result, cacheTTL);
      }

      this.recordRequest(startTime, true, 'success');
      return result;

    } catch (error) {
      this.recordRequest(startTime, false, 'error');
      throw error;
    }
  }

  /**
   * Get HTTP agent for requests
   * @param {boolean} isHttps
   * @returns {http.Agent|https.Agent}
   */
  getHttpAgent(isHttps = false) {
    if (!this.connectionPool) {
      throw new Error('Performance service not initialized');
    }
    return this.connectionPool.getAgent(isHttps);
  }

  /**
   * Cache models list
   * @param {Array} models
   * @param {number} [ttl]
   */
  cacheModels(models, ttl) {
    this.caches.models.set('all-models', models, ttl);
  }

  /**
   * Get cached models list
   * @returns {Array|undefined}
   */
  getCachedModels() {
    return this.caches.models.get('all-models');
  }

  /**
   * Cache provider data
   * @param {string} providerId
   * @param {Object} provider
   * @param {number} [ttl]
   */
  cacheProvider(providerId, provider, ttl) {
    this.caches.providers.set(`provider:${providerId}`, provider, ttl);
  }

  /**
   * Get cached provider data
   * @param {string} providerId
   * @returns {Object|undefined}
   */
  getCachedProvider(providerId) {
    return this.caches.providers.get(`provider:${providerId}`);
  }

  /**
   * Cache provider health status
   * @param {string} providerId
   * @param {Object} health
   * @param {number} [ttl]
   */
  cacheProviderHealth(providerId, health, ttl) {
    this.caches.health.set(`health:${providerId}`, health, ttl);
  }

  /**
   * Get cached provider health status
   * @param {string} providerId
   * @returns {Object|undefined}
   */
  getCachedProviderHealth(providerId) {
    return this.caches.health.get(`health:${providerId}`);
  }

  /**
   * Cache response
   * @param {string} key
   * @param {*} response
   * @param {number} [ttl]
   */
  setCachedResponse(key, response, ttl) {
    this.caches.responses.set(key, response, ttl);
  }

  /**
   * Get cached response
   * @param {string} key
   * @returns {*}
   */
  getCachedResponse(key) {
    return this.caches.responses.get(key);
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    Object.values(this.caches).forEach(cache => cache.clear());
    logger.info('All caches cleared');
  }

  /**
   * Clear specific cache
   * @param {string} cacheName
   */
  clearCache(cacheName) {
    if (this.caches[cacheName]) {
      this.caches[cacheName].clear();
      logger.info(`Cache cleared: ${cacheName}`);
    }
  }

  /**
   * Record request metrics
   * @param {number} startTime
   * @param {boolean} success
   * @param {string} type
   */
  recordRequest(startTime, success, type) {
    const responseTime = Date.now() - startTime;
    
    this.metrics.requests.total++;
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    // Track response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }

    // Update average response time
    this.metrics.requests.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;

    // Update percentiles
    if (this.responseTimes.length > 0) {
      const sorted = [...this.responseTimes].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p99Index = Math.floor(sorted.length * 0.99);
      
      this.metrics.requests.p95ResponseTime = sorted[p95Index] || 0;
      this.metrics.requests.p99ResponseTime = sorted[p99Index] || 0;
    }

    // Record in monitoring service
    monitoringService.recordHttpRequest('POST', '/v1/chat/completions', success ? 200 : 500, responseTime / 1000);
  }

  /**
   * Get performance statistics
   * @returns {Object}
   */
  getStats() {
    const uptime = Date.now() - this.metrics.startTime;
    const throughput = this.metrics.requests.total > 0 
      ? Math.round((this.metrics.requests.total / (uptime / 1000)) * 60) // requests per minute
      : 0;

    return {
      uptime: Math.round(uptime / 1000), // seconds
      requests: this.metrics.requests,
      performance: {
        ...this.metrics.performance,
        throughput
      },
      connectionPool: this.connectionPool?.getStats(),
      requestQueue: this.requestQueue?.getStats(),
      caches: {
        models: this.caches.models?.getStats(),
        providers: this.caches.providers?.getStats(),
        health: this.caches.health?.getStats(),
        responses: this.caches.responses?.getStats()
      }
    };
  }

  /**
   * Get performance health status
   * @returns {Object}
   */
  getHealthStatus() {
    const stats = this.getStats();
    const successRate = stats.requests.total > 0 
      ? (stats.requests.successful / stats.requests.total * 100)
      : 100;

    let status = 'healthy';
    let issues = [];

    // Check success rate
    if (successRate < 95) {
      status = 'degraded';
      issues.push(`Low success rate: ${successRate.toFixed(2)}%`);
    }
    if (successRate < 90) {
      status = 'unhealthy';
    }

    // Check response times
    if (stats.requests.p95ResponseTime > 5000) { // 5 seconds
      status = status === 'healthy' ? 'degraded' : status;
      issues.push(`High P95 response time: ${stats.requests.p95ResponseTime}ms`);
    }
    if (stats.requests.p95ResponseTime > 10000) { // 10 seconds
      status = 'unhealthy';
    }

    // Check queue health
    const queueHealth = this.requestQueue?.getHealthStatus();
    if (queueHealth && queueHealth.status !== 'healthy') {
      status = queueHealth.status === 'unhealthy' ? 'unhealthy' : 
               (status === 'healthy' ? 'degraded' : status);
      issues.push(`Queue ${queueHealth.status}`);
    }

    // Check connection pool health
    const poolHealth = this.connectionPool?.getHealthStatus();
    if (poolHealth && poolHealth.status !== 'healthy') {
      status = poolHealth.status === 'unhealthy' ? 'unhealthy' : 
               (status === 'healthy' ? 'degraded' : status);
      issues.push(`Connection pool ${poolHealth.status}`);
    }

    return {
      status,
      successRate: `${successRate.toFixed(2)}%`,
      averageResponseTime: `${Math.round(stats.requests.averageResponseTime)}ms`,
      p95ResponseTime: `${Math.round(stats.requests.p95ResponseTime)}ms`,
      throughput: `${stats.performance.throughput} req/min`,
      issues: issues.length > 0 ? issues : undefined,
      components: {
        connectionPool: poolHealth,
        requestQueue: queueHealth,
        caches: Object.entries(this.caches).reduce((acc, [name, cache]) => {
          acc[name] = cache.getHealthStatus();
          return acc;
        }, {})
      }
    };
  }

  /**
   * Start monitoring intervals
   */
  startMonitoring() {
    // Update performance metrics periodically
    this.metricsInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, this.options.monitoring.metricsInterval);

    // Health check interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.options.monitoring.healthCheckInterval);

    logger.info('Performance monitoring started');
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics() {
    try {
      // Update cache hit rates
      const cacheStats = Object.values(this.caches).map(cache => cache.getStats());
      const totalHits = cacheStats.reduce((sum, stats) => sum + stats.hits, 0);
      const totalRequests = cacheStats.reduce((sum, stats) => sum + stats.hits + stats.misses, 0);
      
      this.metrics.performance.cacheHitRate = totalRequests > 0 
        ? (totalHits / totalRequests * 100)
        : 0;

      // Update queue utilization
      const queueStats = this.requestQueue?.getStats();
      if (queueStats) {
        this.metrics.performance.queueUtilization = 
          (queueStats.processing / this.options.requestQueue.maxConcurrent * 100);
      }

      // Update connection pool efficiency
      const poolStats = this.connectionPool?.getStats();
      if (poolStats) {
        this.metrics.performance.connectionPoolEfficiency = parseFloat(poolStats.poolEfficiency) || 0;
      }

      // Update throughput
      const uptime = Date.now() - this.metrics.startTime;
      this.metrics.performance.throughput = this.metrics.requests.total > 0 
        ? Math.round((this.metrics.requests.total / (uptime / 1000)) * 60)
        : 0;

    } catch (error) {
      logger.error('Failed to update performance metrics:', error);
    }
  }

  /**
   * Perform health check
   */
  performHealthCheck() {
    try {
      const health = this.getHealthStatus();
      
      if (health.status !== 'healthy') {
        logger.warn('Performance health check failed', {
          status: health.status,
          issues: health.issues
        });
      }

      // Emit health status for monitoring
      this.emit?.('health', health);

    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  /**
   * Optimize performance based on current metrics
   */
  optimize() {
    const stats = this.getStats();
    const optimizations = [];

    // Check cache hit rates
    Object.entries(stats.caches).forEach(([name, cacheStats]) => {
      const hitRate = parseFloat(cacheStats.hitRate);
      if (hitRate < 50) {
        optimizations.push(`Increase ${name} cache TTL or size`);
      }
    });

    // Check queue utilization
    if (stats.requestQueue && parseFloat(stats.requestQueue.processingUtilization) > 80) {
      optimizations.push('Increase max concurrent requests');
    }

    // Check response times
    if (stats.requests.p95ResponseTime > 3000) {
      optimizations.push('Consider increasing connection pool size or timeout values');
    }

    if (optimizations.length > 0) {
      logger.info('Performance optimization suggestions', { optimizations });
    }

    return optimizations;
  }

  /**
   * Reset all statistics
   */
  resetStats() {
    this.metrics = {
      startTime: Date.now(),
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      },
      performance: {
        cacheHitRate: 0,
        queueUtilization: 0,
        connectionPoolEfficiency: 0,
        throughput: 0
      }
    };

    this.responseTimes = [];

    // Reset component stats
    this.connectionPool?.resetStats();
    this.requestQueue?.resetStats();
    Object.values(this.caches).forEach(cache => cache.resetStats());

    logger.info('Performance statistics reset');
  }

  /**
   * Shutdown performance service
   */
  async shutdown() {
    logger.info('Shutting down performance service...');

    // Clear intervals
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Shutdown components
    if (this.requestQueue) {
      await this.requestQueue.shutdown();
    }

    if (this.connectionPool) {
      this.connectionPool.destroy();
    }

    Object.values(this.caches).forEach(cache => cache.shutdown());

    this.initialized = false;
    logger.info('Performance service shut down');
  }

  /**
   * Check if service is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.initialized;
  }
}

module.exports = PerformanceService;