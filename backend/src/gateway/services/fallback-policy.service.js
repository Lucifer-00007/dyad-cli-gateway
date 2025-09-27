/**
 * Fallback Policy Service
 * Implements fallback policies for provider failures
 */

const logger = require('../../config/logger');
const Provider = require('../../models/provider.model');

/**
 * Fallback strategies
 */
const FALLBACK_STRATEGIES = {
  NONE: 'none',                    // No fallback
  ROUND_ROBIN: 'round_robin',      // Try providers in round-robin order
  PRIORITY: 'priority',            // Try providers by priority order
  RANDOM: 'random',                // Try random provider
  HEALTH_BASED: 'health_based'     // Try healthiest providers first
};

/**
 * Fallback Policy Service
 */
class FallbackPolicyService {
  constructor(circuitBreakerService) {
    this.circuitBreakerService = circuitBreakerService;
    this.fallbackConfigs = new Map(); // Model -> fallback config
    this.providerPriorities = new Map(); // Provider -> priority
    this.roundRobinCounters = new Map(); // Model -> counter
  }

  /**
   * Configure fallback policy for a model
   * @param {string} modelId - Model ID
   * @param {Object} config - Fallback configuration
   * @param {string} config.strategy - Fallback strategy
   * @param {string[]} config.providers - List of provider IDs in order
   * @param {number} config.maxAttempts - Maximum fallback attempts
   * @param {boolean} config.enabled - Whether fallback is enabled
   */
  configureFallback(modelId, config) {
    const fallbackConfig = {
      strategy: config.strategy || FALLBACK_STRATEGIES.HEALTH_BASED,
      providers: config.providers || [],
      maxAttempts: config.maxAttempts || 3,
      enabled: config.enabled !== false,
      ...config
    };

    this.fallbackConfigs.set(modelId, fallbackConfig);
    
    logger.info('Configured fallback policy', {
      modelId,
      strategy: fallbackConfig.strategy,
      providers: fallbackConfig.providers,
      maxAttempts: fallbackConfig.maxAttempts,
      enabled: fallbackConfig.enabled
    });
  }

  /**
   * Set provider priorities
   * @param {Object} priorities - Map of provider ID to priority (lower = higher priority)
   */
  setProviderPriorities(priorities) {
    this.providerPriorities.clear();
    for (const [providerId, priority] of Object.entries(priorities)) {
      this.providerPriorities.set(providerId, priority);
    }
    
    logger.info('Updated provider priorities', { priorities });
  }

  /**
   * Execute request with fallback policy
   * @param {string} modelId - Model ID
   * @param {Function} requestFn - Function that takes providerId and returns promise
   * @param {Object} options - Execution options
   * @returns {Promise} - Request result
   */
  async executeWithFallback(modelId, requestFn, options = {}) {
    const fallbackConfig = this.fallbackConfigs.get(modelId);
    
    if (!fallbackConfig || !fallbackConfig.enabled) {
      // No fallback configured, execute with primary provider
      const providers = await this.getProvidersForModel(modelId);
      if (providers.length === 0) {
        throw new Error(`No providers available for model: ${modelId}`);
      }
      
      const primaryProvider = providers[0];
      return this.executeWithCircuitBreaker(primaryProvider._id.toString(), requestFn);
    }

    // Get ordered list of providers to try
    const providersToTry = await this.getOrderedProviders(modelId, fallbackConfig);
    
    if (providersToTry.length === 0) {
      throw new Error(`No healthy providers available for model: ${modelId}`);
    }

    let lastError;
    let attemptCount = 0;
    const maxAttempts = Math.min(fallbackConfig.maxAttempts, providersToTry.length);

    logger.info('Starting request with fallback policy', {
      modelId,
      strategy: fallbackConfig.strategy,
      providersToTry: providersToTry.map(p => p._id.toString()),
      maxAttempts
    });

    for (let i = 0; i < maxAttempts; i++) {
      const provider = providersToTry[i];
      const providerId = provider._id.toString();
      attemptCount++;

      try {
        logger.debug('Attempting request with provider', {
          modelId,
          providerId,
          providerName: provider.name,
          attempt: attemptCount,
          maxAttempts
        });

        const result = await this.executeWithCircuitBreaker(providerId, requestFn);
        
        if (attemptCount > 1) {
          logger.info('Request succeeded with fallback provider', {
            modelId,
            providerId,
            providerName: provider.name,
            attempt: attemptCount,
            totalAttempts: attemptCount
          });
        }

        return result;

      } catch (error) {
        lastError = error;
        
        logger.warn('Request failed with provider, trying fallback', {
          modelId,
          providerId,
          providerName: provider.name,
          attempt: attemptCount,
          maxAttempts,
          error: error.message,
          errorCode: error.code
        });

        // If this was the last attempt, don't continue
        if (i === maxAttempts - 1) {
          break;
        }

        // Add delay between attempts if configured
        if (fallbackConfig.retryDelay) {
          await this.delay(fallbackConfig.retryDelay);
        }
      }
    }

    // All attempts failed
    logger.error('All fallback attempts failed', {
      modelId,
      totalAttempts: attemptCount,
      lastError: lastError.message
    });

    const fallbackError = new Error(`All fallback attempts failed for model ${modelId}. Last error: ${lastError.message}`);
    fallbackError.code = 'FALLBACK_EXHAUSTED';
    fallbackError.modelId = modelId;
    fallbackError.attempts = attemptCount;
    fallbackError.lastError = lastError;
    throw fallbackError;
  }

  /**
   * Execute request with circuit breaker
   * @param {string} providerId - Provider ID
   * @param {Function} requestFn - Request function
   * @returns {Promise}
   */
  async executeWithCircuitBreaker(providerId, requestFn) {
    return this.circuitBreakerService.execute(providerId, () => requestFn(providerId));
  }

  /**
   * Get ordered list of providers based on fallback strategy
   * @param {string} modelId - Model ID
   * @param {Object} fallbackConfig - Fallback configuration
   * @returns {Promise<Provider[]>}
   */
  async getOrderedProviders(modelId, fallbackConfig) {
    let providers = await this.getProvidersForModel(modelId);
    
    // Filter out unhealthy providers based on circuit breaker status
    providers = providers.filter(provider => {
      const providerId = provider._id.toString();
      return this.circuitBreakerService.isProviderHealthy(providerId);
    });

    if (providers.length === 0) {
      return [];
    }

    // If specific providers are configured, filter and order by them
    if (fallbackConfig.providers && fallbackConfig.providers.length > 0) {
      const configuredProviderIds = new Set(fallbackConfig.providers);
      providers = providers.filter(p => configuredProviderIds.has(p._id.toString()));
      
      // Order by configured order
      providers.sort((a, b) => {
        const aIndex = fallbackConfig.providers.indexOf(a._id.toString());
        const bIndex = fallbackConfig.providers.indexOf(b._id.toString());
        return aIndex - bIndex;
      });
    } else {
      // Apply strategy-based ordering
      providers = this.orderProvidersByStrategy(providers, fallbackConfig.strategy, modelId);
    }

    return providers;
  }

  /**
   * Order providers by strategy
   * @param {Provider[]} providers - List of providers
   * @param {string} strategy - Fallback strategy
   * @param {string} modelId - Model ID (for round-robin)
   * @returns {Provider[]}
   */
  orderProvidersByStrategy(providers, strategy, modelId) {
    switch (strategy) {
      case FALLBACK_STRATEGIES.PRIORITY:
        return this.orderByPriority(providers);
      
      case FALLBACK_STRATEGIES.ROUND_ROBIN:
        return this.orderByRoundRobin(providers, modelId);
      
      case FALLBACK_STRATEGIES.RANDOM:
        return this.orderByRandom(providers);
      
      case FALLBACK_STRATEGIES.HEALTH_BASED:
        return this.orderByHealth(providers);
      
      case FALLBACK_STRATEGIES.NONE:
      default:
        return providers;
    }
  }

  /**
   * Order providers by priority
   * @param {Provider[]} providers - List of providers
   * @returns {Provider[]}
   */
  orderByPriority(providers) {
    return providers.sort((a, b) => {
      const aPriority = this.providerPriorities.get(a._id.toString()) || 999;
      const bPriority = this.providerPriorities.get(b._id.toString()) || 999;
      return aPriority - bPriority;
    });
  }

  /**
   * Order providers by round-robin
   * @param {Provider[]} providers - List of providers
   * @param {string} modelId - Model ID
   * @returns {Provider[]}
   */
  orderByRoundRobin(providers, modelId) {
    if (providers.length <= 1) {
      return providers;
    }

    const counter = this.roundRobinCounters.get(modelId) || 0;
    const startIndex = counter % providers.length;
    
    // Update counter for next request
    this.roundRobinCounters.set(modelId, counter + 1);
    
    // Rotate array to start from the selected index
    return [...providers.slice(startIndex), ...providers.slice(0, startIndex)];
  }

  /**
   * Order providers randomly
   * @param {Provider[]} providers - List of providers
   * @returns {Provider[]}
   */
  orderByRandom(providers) {
    const shuffled = [...providers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Order providers by health status
   * @param {Provider[]} providers - List of providers
   * @returns {Provider[]}
   */
  orderByHealth(providers) {
    return providers.sort((a, b) => {
      const aHealthy = a.healthStatus.status === 'healthy';
      const bHealthy = b.healthStatus.status === 'healthy';
      
      if (aHealthy && !bHealthy) return -1;
      if (!aHealthy && bHealthy) return 1;
      
      // If both have same health status, sort by last checked (more recent first)
      const aLastChecked = a.healthStatus.lastChecked || new Date(0);
      const bLastChecked = b.healthStatus.lastChecked || new Date(0);
      return bLastChecked.getTime() - aLastChecked.getTime();
    });
  }

  /**
   * Get providers for a model
   * @param {string} modelId - Model ID
   * @returns {Promise<Provider[]>}
   */
  async getProvidersForModel(modelId) {
    return Provider.getProvidersByModel(modelId);
  }

  /**
   * Add delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get fallback configuration for model
   * @param {string} modelId - Model ID
   * @returns {Object|null}
   */
  getFallbackConfig(modelId) {
    return this.fallbackConfigs.get(modelId) || null;
  }

  /**
   * Remove fallback configuration for model
   * @param {string} modelId - Model ID
   */
  removeFallbackConfig(modelId) {
    this.fallbackConfigs.delete(modelId);
    this.roundRobinCounters.delete(modelId);
    
    logger.info('Removed fallback configuration', { modelId });
  }

  /**
   * Get all fallback configurations
   * @returns {Object}
   */
  getAllFallbackConfigs() {
    const configs = {};
    for (const [modelId, config] of this.fallbackConfigs) {
      configs[modelId] = { ...config };
    }
    return configs;
  }

  /**
   * Get fallback statistics
   * @returns {Object}
   */
  getStatistics() {
    return {
      totalFallbackConfigs: this.fallbackConfigs.size,
      configuredModels: Array.from(this.fallbackConfigs.keys()),
      providerPriorities: Object.fromEntries(this.providerPriorities),
      roundRobinCounters: Object.fromEntries(this.roundRobinCounters)
    };
  }

  /**
   * Clear all configurations
   */
  clearAll() {
    this.fallbackConfigs.clear();
    this.providerPriorities.clear();
    this.roundRobinCounters.clear();
    
    logger.info('Cleared all fallback configurations');
  }
}

module.exports = {
  FallbackPolicyService,
  FALLBACK_STRATEGIES
};