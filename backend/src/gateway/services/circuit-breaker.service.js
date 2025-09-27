/**
 * Circuit Breaker Service
 * Implements circuit breaker pattern for provider failure handling
 */

const logger = require('../../config/logger');
const { gatewayConfig } = require('../config');

/**
 * Circuit breaker states
 */
const CIRCUIT_STATES = {
  CLOSED: 'closed',     // Normal operation
  OPEN: 'open',         // Circuit is open, requests fail fast
  HALF_OPEN: 'half_open' // Testing if service has recovered
};

/**
 * Circuit breaker for individual providers
 */
class ProviderCircuitBreaker {
  constructor(providerId, options = {}) {
    this.providerId = providerId;
    this.failureThreshold = options.failureThreshold || gatewayConfig.circuitBreaker.failureThreshold;
    this.timeout = options.timeout || gatewayConfig.circuitBreaker.timeout;
    this.resetTimeout = options.resetTimeout || gatewayConfig.circuitBreaker.resetTimeout;
    
    // Circuit state
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitOpenCount: 0,
      lastStateChange: new Date()
    };
  }

  /**
   * Execute a request through the circuit breaker
   * @param {Function} request - Function that returns a promise
   * @returns {Promise} - Request result or circuit breaker error
   */
  async execute(request) {
    this.stats.totalRequests++;

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === CIRCUIT_STATES.OPEN && this.shouldAttemptReset()) {
      this.state = CIRCUIT_STATES.HALF_OPEN;
      this.stats.lastStateChange = new Date();
      logger.info('Circuit breaker transitioning to HALF_OPEN', {
        providerId: this.providerId,
        failureCount: this.failureCount
      });
    }

    // Fail fast if circuit is open
    if (this.state === CIRCUIT_STATES.OPEN) {
      const error = new Error(`Circuit breaker is OPEN for provider ${this.providerId}`);
      error.code = 'CIRCUIT_BREAKER_OPEN';
      error.providerId = this.providerId;
      error.nextAttemptTime = this.nextAttemptTime;
      throw error;
    }

    try {
      // Execute the request with timeout
      const result = await this.executeWithTimeout(request);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute request with timeout
   * @param {Function} request - Request function
   * @returns {Promise} - Request result
   */
  async executeWithTimeout(request) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Request timeout after ${this.timeout}ms`);
        error.code = 'REQUEST_TIMEOUT';
        error.providerId = this.providerId;
        reject(error);
      }, this.timeout);

      request()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Handle successful request
   */
  onSuccess() {
    this.stats.successfulRequests++;
    
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      // Reset circuit breaker on successful request in HALF_OPEN state
      this.reset();
      logger.info('Circuit breaker reset to CLOSED after successful request', {
        providerId: this.providerId
      });
    }
    
    // Reset failure count on success
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Handle failed request
   * @param {Error} error - The error that occurred
   */
  onFailure(error) {
    this.stats.failedRequests++;
    this.failureCount++;
    this.lastFailureTime = new Date();

    logger.warn('Circuit breaker recorded failure', {
      providerId: this.providerId,
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      error: error.message
    });

    // Open circuit if failure threshold is reached
    if (this.failureCount >= this.failureThreshold) {
      this.open();
    }
  }

  /**
   * Open the circuit breaker
   */
  open() {
    if (this.state !== CIRCUIT_STATES.OPEN) {
      this.state = CIRCUIT_STATES.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.resetTimeout);
      this.stats.circuitOpenCount++;
      this.stats.lastStateChange = new Date();

      logger.error('Circuit breaker opened', {
        providerId: this.providerId,
        failureCount: this.failureCount,
        nextAttemptTime: this.nextAttemptTime
      });
    }
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset() {
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.stats.lastStateChange = new Date();
  }

  /**
   * Check if circuit should attempt reset
   * @returns {boolean}
   */
  shouldAttemptReset() {
    return this.nextAttemptTime && Date.now() >= this.nextAttemptTime.getTime();
  }

  /**
   * Get circuit breaker status
   * @returns {Object}
   */
  getStatus() {
    return {
      providerId: this.providerId,
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      stats: { ...this.stats }
    };
  }

  /**
   * Check if circuit is healthy (closed)
   * @returns {boolean}
   */
  isHealthy() {
    return this.state === CIRCUIT_STATES.CLOSED;
  }

  /**
   * Force open the circuit (for testing or manual intervention)
   */
  forceOpen() {
    this.open();
    logger.warn('Circuit breaker manually opened', {
      providerId: this.providerId
    });
  }

  /**
   * Force reset the circuit (for testing or manual intervention)
   */
  forceReset() {
    this.reset();
    logger.info('Circuit breaker manually reset', {
      providerId: this.providerId
    });
  }
}

/**
 * Circuit Breaker Manager
 * Manages circuit breakers for all providers
 */
class CircuitBreakerService {
  constructor() {
    this.circuitBreakers = new Map();
    this.config = gatewayConfig.circuitBreaker;
  }

  /**
   * Get or create circuit breaker for provider
   * @param {string} providerId - Provider ID
   * @param {Object} options - Circuit breaker options
   * @returns {ProviderCircuitBreaker}
   */
  getCircuitBreaker(providerId, options = {}) {
    if (!this.circuitBreakers.has(providerId)) {
      const circuitBreaker = new ProviderCircuitBreaker(providerId, {
        ...this.config,
        ...options
      });
      this.circuitBreakers.set(providerId, circuitBreaker);
      
      logger.debug('Created circuit breaker for provider', {
        providerId,
        failureThreshold: circuitBreaker.failureThreshold,
        timeout: circuitBreaker.timeout,
        resetTimeout: circuitBreaker.resetTimeout
      });
    }
    
    return this.circuitBreakers.get(providerId);
  }

  /**
   * Execute request through circuit breaker
   * @param {string} providerId - Provider ID
   * @param {Function} request - Request function
   * @param {Object} options - Circuit breaker options
   * @returns {Promise}
   */
  async execute(providerId, request, options = {}) {
    const circuitBreaker = this.getCircuitBreaker(providerId, options);
    return circuitBreaker.execute(request);
  }

  /**
   * Get status of all circuit breakers
   * @returns {Object}
   */
  getAllStatus() {
    const status = {};
    for (const [providerId, circuitBreaker] of this.circuitBreakers) {
      status[providerId] = circuitBreaker.getStatus();
    }
    return status;
  }

  /**
   * Get status of specific circuit breaker
   * @param {string} providerId - Provider ID
   * @returns {Object|null}
   */
  getStatus(providerId) {
    const circuitBreaker = this.circuitBreakers.get(providerId);
    return circuitBreaker ? circuitBreaker.getStatus() : null;
  }

  /**
   * Check if provider is healthy (circuit closed)
   * @param {string} providerId - Provider ID
   * @returns {boolean}
   */
  isProviderHealthy(providerId) {
    const circuitBreaker = this.circuitBreakers.get(providerId);
    return circuitBreaker ? circuitBreaker.isHealthy() : true; // Default to healthy if no circuit breaker
  }

  /**
   * Get healthy providers from a list
   * @param {string[]} providerIds - List of provider IDs
   * @returns {string[]} - List of healthy provider IDs
   */
  getHealthyProviders(providerIds) {
    return providerIds.filter(providerId => this.isProviderHealthy(providerId));
  }

  /**
   * Reset circuit breaker for provider
   * @param {string} providerId - Provider ID
   */
  resetCircuitBreaker(providerId) {
    const circuitBreaker = this.circuitBreakers.get(providerId);
    if (circuitBreaker) {
      circuitBreaker.forceReset();
    }
  }

  /**
   * Open circuit breaker for provider
   * @param {string} providerId - Provider ID
   */
  openCircuitBreaker(providerId) {
    const circuitBreaker = this.getCircuitBreaker(providerId);
    circuitBreaker.forceOpen();
  }

  /**
   * Remove circuit breaker for provider
   * @param {string} providerId - Provider ID
   */
  removeCircuitBreaker(providerId) {
    if (this.circuitBreakers.has(providerId)) {
      this.circuitBreakers.delete(providerId);
      logger.debug('Removed circuit breaker for provider', { providerId });
    }
  }

  /**
   * Clear all circuit breakers
   */
  clearAll() {
    this.circuitBreakers.clear();
    logger.debug('Cleared all circuit breakers');
  }

  /**
   * Get circuit breaker statistics
   * @returns {Object}
   */
  getStatistics() {
    const stats = {
      totalCircuitBreakers: this.circuitBreakers.size,
      healthyProviders: 0,
      openCircuits: 0,
      halfOpenCircuits: 0,
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0
    };

    for (const circuitBreaker of this.circuitBreakers.values()) {
      const status = circuitBreaker.getStatus();
      
      if (status.state === CIRCUIT_STATES.CLOSED) {
        stats.healthyProviders++;
      } else if (status.state === CIRCUIT_STATES.OPEN) {
        stats.openCircuits++;
      } else if (status.state === CIRCUIT_STATES.HALF_OPEN) {
        stats.halfOpenCircuits++;
      }

      stats.totalRequests += status.stats.totalRequests;
      stats.totalSuccesses += status.stats.successfulRequests;
      stats.totalFailures += status.stats.failedRequests;
    }

    return stats;
  }
}

module.exports = {
  CircuitBreakerService,
  ProviderCircuitBreaker,
  CIRCUIT_STATES
};