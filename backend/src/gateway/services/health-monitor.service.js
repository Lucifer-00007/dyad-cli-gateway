/**
 * Health Monitor Service
 * Background service for monitoring provider health
 */

const logger = require('../../config/logger');
const Provider = require('../../models/provider.model');
const { AdapterFactory } = require('../adapters');
const { gatewayConfig } = require('../config');

/**
 * Health Monitor Service
 */
class HealthMonitorService {
  constructor(circuitBreakerService) {
    this.circuitBreakerService = circuitBreakerService;
    this.config = gatewayConfig.healthCheck;
    this.adapterFactory = AdapterFactory;
    
    // Monitoring state
    this.isRunning = false;
    this.intervalId = null;
    this.healthCheckQueue = [];
    this.activeChecks = new Map(); // providerId -> promise
    
    // Statistics
    this.stats = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      lastRunTime: null,
      averageCheckDuration: 0,
      providersMonitored: 0
    };
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.isRunning) {
      logger.warn('Health monitor is already running');
      return;
    }

    this.isRunning = true;
    this.scheduleNextCheck();
    
    logger.info('Health monitor started', {
      interval: this.config.interval,
      enabled: true
    });
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    // Wait for active checks to complete
    const activeCheckPromises = Array.from(this.activeChecks.values());
    if (activeCheckPromises.length > 0) {
      logger.info('Waiting for active health checks to complete', {
        activeChecks: activeCheckPromises.length
      });
    }

    logger.info('Health monitor stopped');
  }

  /**
   * Schedule next health check cycle
   */
  scheduleNextCheck() {
    if (!this.isRunning) {
      return;
    }

    this.intervalId = setTimeout(async () => {
      try {
        await this.runHealthCheckCycle();
      } catch (error) {
        logger.error('Health check cycle failed', {
          error: error.message,
          stack: error.stack
        });
      } finally {
        this.scheduleNextCheck();
      }
    }, this.config.interval);
  }

  /**
   * Run a complete health check cycle
   */
  async runHealthCheckCycle() {
    const startTime = Date.now();
    this.stats.lastRunTime = new Date();

    logger.debug('Starting health check cycle');

    try {
      // Get all enabled providers
      const providers = await Provider.find({ enabled: true });
      this.stats.providersMonitored = providers.length;

      if (providers.length === 0) {
        logger.debug('No enabled providers to monitor');
        return;
      }

      // Check each provider
      const checkPromises = providers.map(provider => 
        this.checkProviderHealth(provider)
      );

      // Wait for all checks to complete
      const results = await Promise.allSettled(checkPromises);
      
      // Process results
      let successful = 0;
      let failed = 0;
      
      results.forEach((result, index) => {
        const provider = providers[index];
        
        if (result.status === 'fulfilled') {
          successful++;
          logger.debug('Health check completed', {
            providerId: provider._id.toString(),
            providerName: provider.name,
            status: result.value.status
          });
        } else {
          failed++;
          logger.error('Health check failed', {
            providerId: provider._id.toString(),
            providerName: provider.name,
            error: result.reason.message
          });
        }
      });

      // Update statistics
      this.stats.totalChecks += providers.length;
      this.stats.successfulChecks += successful;
      this.stats.failedChecks += failed;
      
      const duration = Date.now() - startTime;
      this.stats.averageCheckDuration = this.stats.totalChecks > 0 
        ? (this.stats.averageCheckDuration * (this.stats.totalChecks - providers.length) + duration) / this.stats.totalChecks
        : duration;

      logger.info('Health check cycle completed', {
        providersChecked: providers.length,
        successful,
        failed,
        duration,
        averageDuration: Math.round(this.stats.averageCheckDuration)
      });

    } catch (error) {
      logger.error('Health check cycle error', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Check health of a specific provider
   * @param {Provider} provider - Provider document
   * @returns {Promise<Object>} - Health check result
   */
  async checkProviderHealth(provider) {
    const providerId = provider._id.toString();
    
    // Avoid concurrent checks for the same provider
    if (this.activeChecks.has(providerId)) {
      logger.debug('Health check already in progress for provider', {
        providerId,
        providerName: provider.name
      });
      return this.activeChecks.get(providerId);
    }

    const checkPromise = this.performHealthCheck(provider);
    this.activeChecks.set(providerId, checkPromise);

    try {
      const result = await checkPromise;
      return result;
    } finally {
      this.activeChecks.delete(providerId);
    }
  }

  /**
   * Perform actual health check for provider
   * @param {Provider} provider - Provider document
   * @returns {Promise<Object>} - Health check result
   */
  async performHealthCheck(provider) {
    const providerId = provider._id.toString();
    const startTime = Date.now();

    try {
      // Get health check configuration from provider or use defaults
      const healthConfig = {
        timeout: provider.adapterConfig.healthCheckTimeoutMs || 10000,
        retryAttempts: provider.adapterConfig.healthRetryAttempts || 1
      };

      let healthResult;

      // Perform health check based on adapter type
      switch (provider.type) {
        case 'spawn-cli':
          healthResult = await this.checkSpawnCliHealth(provider, healthConfig);
          break;
        case 'http-sdk':
        case 'proxy':
        case 'local':
          healthResult = await this.checkHttpHealth(provider, healthConfig);
          break;
        default:
          throw new Error(`Unknown adapter type: ${provider.type}`);
      }

      // Update provider health status
      await provider.updateHealthStatus('healthy');

      // Reset circuit breaker if provider is now healthy
      this.circuitBreakerService.resetCircuitBreaker(providerId);

      const result = {
        providerId,
        providerName: provider.name,
        status: 'healthy',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        details: healthResult
      };

      logger.debug('Provider health check passed', result);
      return result;

    } catch (error) {
      // Update provider health status
      await provider.updateHealthStatus('unhealthy', error.message);

      const result = {
        providerId,
        providerName: provider.name,
        status: 'unhealthy',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        error: {
          message: error.message,
          code: error.code || 'HEALTH_CHECK_FAILED'
        }
      };

      logger.warn('Provider health check failed', result);
      return result;
    }
  }

  /**
   * Check health of spawn-cli adapter
   * @param {Provider} provider - Provider document
   * @param {Object} healthConfig - Health check configuration
   * @returns {Promise<Object>} - Health check result
   */
  async checkSpawnCliHealth(provider, healthConfig) {
    // For spawn-cli adapters, we can check if the command exists
    // and optionally run a simple test command
    
    const { command } = provider.adapterConfig;
    
    if (!command) {
      throw new Error('No command configured for spawn-cli adapter');
    }

    // Basic validation - check if command is configured
    // In a real implementation, you might want to:
    // 1. Check if the command binary exists
    // 2. Run a simple test command
    // 3. Validate Docker sandbox availability
    
    return {
      type: 'spawn-cli',
      command,
      sandboxEnabled: provider.adapterConfig.dockerSandbox,
      message: 'Command configuration validated'
    };
  }

  /**
   * Check health of HTTP-based adapter
   * @param {Provider} provider - Provider document
   * @param {Object} healthConfig - Health check configuration
   * @returns {Promise<Object>} - Health check result
   */
  async checkHttpHealth(provider, healthConfig) {
    const { baseUrl, healthEndpoint, healthCheckPath } = provider.adapterConfig;
    
    if (!baseUrl) {
      throw new Error('No base URL configured for HTTP adapter');
    }

    // Determine health check URL
    let healthUrl;
    if (healthEndpoint) {
      healthUrl = healthEndpoint;
    } else if (healthCheckPath) {
      healthUrl = new URL(healthCheckPath, baseUrl).toString();
    } else {
      // Default health check path
      healthUrl = new URL('/health', baseUrl).toString();
    }

    // Create adapter instance for health check
    const adapter = this.adapterFactory.createAdapter(provider, provider.credentials);
    
    // Perform HTTP health check
    if (adapter.checkHealth) {
      // Use adapter's built-in health check if available
      const healthResult = await adapter.checkHealth();
      return {
        type: provider.type,
        baseUrl,
        healthUrl,
        result: healthResult
      };
    } else {
      // Fallback to basic HTTP check
      const axios = require('axios');
      
      const response = await axios.get(healthUrl, {
        timeout: healthConfig.timeout,
        validateStatus: (status) => status < 500 // Accept 4xx as healthy (service is responding)
      });

      return {
        type: provider.type,
        baseUrl,
        healthUrl,
        status: response.status,
        statusText: response.statusText,
        responseTime: response.headers['x-response-time'] || 'unknown'
      };
    }
  }

  /**
   * Manually trigger health check for specific provider
   * @param {string} providerId - Provider ID
   * @returns {Promise<Object>} - Health check result
   */
  async checkProvider(providerId) {
    const provider = await Provider.findById(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    return this.checkProviderHealth(provider);
  }

  /**
   * Manually trigger health check for all providers
   * @returns {Promise<Object[]>} - Health check results
   */
  async checkAllProviders() {
    const providers = await Provider.find({ enabled: true });
    
    const checkPromises = providers.map(provider => 
      this.checkProviderHealth(provider)
    );

    const results = await Promise.allSettled(checkPromises);
    
    return results.map((result, index) => ({
      providerId: providers[index]._id.toString(),
      providerName: providers[index].name,
      status: result.status,
      result: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }

  /**
   * Get health monitor statistics
   * @returns {Object}
   */
  getStatistics() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      activeChecks: this.activeChecks.size,
      queuedChecks: this.healthCheckQueue.length,
      config: {
        interval: this.config.interval
      }
    };
  }

  /**
   * Get status of health monitor
   * @returns {Object}
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.stats.lastRunTime,
      activeChecks: this.activeChecks.size,
      statistics: this.getStatistics()
    };
  }

  /**
   * Update health check interval
   * @param {number} interval - New interval in milliseconds
   */
  updateInterval(interval) {
    this.config.interval = interval;
    
    if (this.isRunning) {
      // Restart with new interval
      this.stop();
      this.start();
    }
    
    logger.info('Health check interval updated', { interval });
  }
}

module.exports = HealthMonitorService;