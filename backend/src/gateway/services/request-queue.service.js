/**
 * Request Queue Service
 * Manages request queuing and load balancing for better performance
 */

const EventEmitter = require('events');
const logger = require('../../config/logger');
const monitoringService = require('./monitoring.service');

class RequestQueueService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxConcurrent: options.maxConcurrent || 10,
      maxQueueSize: options.maxQueueSize || 100,
      timeout: options.timeout || 30000,
      priorityLevels: options.priorityLevels || 3,
      ...options
    };

    // Priority queues (0 = highest priority)
    this.queues = Array.from({ length: this.options.priorityLevels }, () => []);
    this.processing = new Set();
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      queuedRequests: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      peakQueueSize: 0,
      currentQueueSize: 0
    };

    this.waitTimes = [];
    this.processingTimes = [];
    this.maxStatsHistory = 1000;

    logger.info('Request queue service initialized', {
      maxConcurrent: this.options.maxConcurrent,
      maxQueueSize: this.options.maxQueueSize,
      priorityLevels: this.options.priorityLevels
    });
  }

  /**
   * Add request to queue
   * @param {Function} requestFn - Function that returns a promise
   * @param {Object} options - Request options
   * @returns {Promise}
   */
  async enqueue(requestFn, options = {}) {
    const {
      priority = 1,
      timeout = this.options.timeout,
      metadata = {}
    } = options;

    return new Promise((resolve, reject) => {
      const request = {
        id: this.generateRequestId(),
        requestFn,
        resolve,
        reject,
        priority: Math.max(0, Math.min(priority, this.options.priorityLevels - 1)),
        timeout,
        metadata,
        enqueuedAt: Date.now(),
        startedAt: null,
        completedAt: null
      };

      // Check queue size limit
      const totalQueueSize = this.getTotalQueueSize();
      if (totalQueueSize >= this.options.maxQueueSize) {
        this.stats.failedRequests++;
        reject(new Error('Request queue is full'));
        return;
      }

      // Add to appropriate priority queue
      this.queues[request.priority].push(request);
      this.stats.totalRequests++;
      this.stats.queuedRequests++;
      this.updateQueueStats();

      // Set timeout
      const timeoutId = setTimeout(() => {
        this.handleTimeout(request);
      }, timeout);

      request.timeoutId = timeoutId;

      // Try to process immediately
      this.processNext();
    });
  }

  /**
   * Process next request in queue
   */
  async processNext() {
    if (this.processing.size >= this.options.maxConcurrent) {
      return;
    }

    const request = this.getNextRequest();
    if (!request) {
      return;
    }

    // Remove from queue and add to processing
    this.removeFromQueue(request);
    this.processing.add(request);
    this.stats.queuedRequests--;

    // Clear timeout
    if (request.timeoutId) {
      clearTimeout(request.timeoutId);
    }

    // Record wait time
    request.startedAt = Date.now();
    const waitTime = request.startedAt - request.enqueuedAt;
    this.recordWaitTime(waitTime);

    try {
      logger.debug('Processing request', {
        requestId: request.id,
        priority: request.priority,
        waitTime,
        queueSize: this.getTotalQueueSize(),
        processing: this.processing.size
      });

      const result = await request.requestFn();
      
      request.completedAt = Date.now();
      const processingTime = request.completedAt - request.startedAt;
      this.recordProcessingTime(processingTime);

      this.stats.completedRequests++;
      request.resolve(result);

      logger.debug('Request completed', {
        requestId: request.id,
        processingTime,
        totalTime: request.completedAt - request.enqueuedAt
      });

    } catch (error) {
      request.completedAt = Date.now();
      const processingTime = request.completedAt - request.startedAt;
      this.recordProcessingTime(processingTime);

      this.stats.failedRequests++;
      request.reject(error);

      logger.error('Request failed', {
        requestId: request.id,
        error: error.message,
        processingTime
      });
    } finally {
      this.processing.delete(request);
      
      // Process next request
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Get next request from queues (highest priority first)
   * @returns {Object|null}
   */
  getNextRequest() {
    for (let i = 0; i < this.queues.length; i++) {
      if (this.queues[i].length > 0) {
        return this.queues[i][0];
      }
    }
    return null;
  }

  /**
   * Remove request from its queue
   * @param {Object} request
   */
  removeFromQueue(request) {
    const queue = this.queues[request.priority];
    const index = queue.indexOf(request);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  /**
   * Handle request timeout
   * @param {Object} request
   */
  handleTimeout(request) {
    // Check if request is still in queue
    const queue = this.queues[request.priority];
    const index = queue.indexOf(request);
    
    if (index !== -1) {
      // Remove from queue
      queue.splice(index, 1);
      this.stats.queuedRequests--;
      this.stats.timeoutRequests++;
      this.stats.failedRequests++;
      
      request.reject(new Error('Request timeout while queued'));
      
      logger.warn('Request timed out in queue', {
        requestId: request.id,
        priority: request.priority,
        waitTime: Date.now() - request.enqueuedAt
      });
    }
  }

  /**
   * Get total queue size across all priorities
   * @returns {number}
   */
  getTotalQueueSize() {
    return this.queues.reduce((total, queue) => total + queue.length, 0);
  }

  /**
   * Update queue statistics
   */
  updateQueueStats() {
    const currentSize = this.getTotalQueueSize();
    this.stats.currentQueueSize = currentSize;
    this.stats.peakQueueSize = Math.max(this.stats.peakQueueSize, currentSize);
  }

  /**
   * Record wait time
   * @param {number} waitTime
   */
  recordWaitTime(waitTime) {
    this.waitTimes.push(waitTime);
    if (this.waitTimes.length > this.maxStatsHistory) {
      this.waitTimes.shift();
    }
    
    this.stats.averageWaitTime = this.waitTimes.reduce((sum, time) => sum + time, 0) / this.waitTimes.length;
  }

  /**
   * Record processing time
   * @param {number} processingTime
   */
  recordProcessingTime(processingTime) {
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > this.maxStatsHistory) {
      this.processingTimes.shift();
    }
    
    this.stats.averageProcessingTime = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
  }

  /**
   * Generate unique request ID
   * @returns {string}
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue statistics
   * @returns {Object}
   */
  getStats() {
    const queueSizes = this.queues.map(queue => queue.length);
    const successRate = this.stats.totalRequests > 0 
      ? ((this.stats.completedRequests / this.stats.totalRequests) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      queueSizes,
      processing: this.processing.size,
      successRate: `${successRate}%`,
      throughput: this.calculateThroughput()
    };
  }

  /**
   * Calculate throughput (requests per second)
   * @returns {number}
   */
  calculateThroughput() {
    if (this.processingTimes.length === 0) return 0;
    
    const avgProcessingTime = this.stats.averageProcessingTime;
    return avgProcessingTime > 0 ? Math.round(1000 / avgProcessingTime) : 0;
  }

  /**
   * Get queue health status
   * @returns {Object}
   */
  getHealthStatus() {
    const stats = this.getStats();
    const queueUtilization = (stats.currentQueueSize / this.options.maxQueueSize * 100).toFixed(2);
    const processingUtilization = (stats.processing / this.options.maxConcurrent * 100).toFixed(2);
    
    let status = 'healthy';
    if (queueUtilization > 80 || processingUtilization > 90) {
      status = 'degraded';
    }
    if (queueUtilization > 95 || stats.successRate < 90) {
      status = 'unhealthy';
    }

    return {
      status,
      queueUtilization: `${queueUtilization}%`,
      processingUtilization: `${processingUtilization}%`,
      stats
    };
  }

  /**
   * Clear all queues and reset stats
   */
  clear() {
    // Reject all queued requests
    this.queues.forEach(queue => {
      queue.forEach(request => {
        if (request.timeoutId) {
          clearTimeout(request.timeoutId);
        }
        request.reject(new Error('Queue cleared'));
      });
      queue.length = 0;
    });

    this.processing.clear();
    this.resetStats();
    
    logger.info('Request queue cleared');
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      queuedRequests: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      peakQueueSize: 0,
      currentQueueSize: 0
    };
    
    this.waitTimes = [];
    this.processingTimes = [];
  }

  /**
   * Shutdown queue service
   */
  async shutdown() {
    logger.info('Shutting down request queue service...');
    
    // Wait for processing requests to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.processing.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Clear remaining requests
    this.clear();
    
    logger.info('Request queue service shut down', {
      remainingProcessing: this.processing.size
    });
  }
}

module.exports = RequestQueueService;