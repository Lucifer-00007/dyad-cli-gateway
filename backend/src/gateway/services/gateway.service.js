/**
 * Gateway Service
 * Core orchestration service for the CLI Gateway
 */

const logger = require('../../config/logger');
const { gatewayConfig } = require('../config');
const { AdapterFactory } = require('../adapters');
const Provider = require('../../models/provider.model');
const OpenAINormalizer = require('./openai.normalizer');
const { CircuitBreakerService } = require('./circuit-breaker.service');
const { FallbackPolicyService } = require('./fallback-policy.service');
const HealthMonitorService = require('./health-monitor.service');
const monitoringService = require('./monitoring.service');
const structuredLogger = require('./structured-logger.service');
const PerformanceService = require('./performance.service');
const crypto = require('crypto');

class GatewayService {
  constructor() {
    this.config = gatewayConfig;
    this.initialized = false;
    this.adapterFactory = AdapterFactory;
    this.normalizer = new OpenAINormalizer();
    
    // Performance service with integrated caching and connection pooling
    this.performanceService = new PerformanceService({
      maxConcurrent: this.config.performance?.maxConcurrent || 10,
      maxSockets: this.config.performance?.maxSockets || 50,
      cache: {
        models: { maxSize: 100, defaultTTL: 300000 }, // 5 minutes
        providers: { maxSize: 50, defaultTTL: 60000 }, // 1 minute
        health: { maxSize: 100, defaultTTL: 30000 }, // 30 seconds
      }
    });
    
    // Legacy cache support (will be migrated to performance service)
    this.providerCache = new Map();
    this.modelCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Circuit breaker and fallback services
    this.circuitBreakerService = new CircuitBreakerService();
    this.fallbackPolicyService = new FallbackPolicyService(this.circuitBreakerService);
    this.healthMonitorService = new HealthMonitorService(this.circuitBreakerService);
  }

  /**
   * Initialize the gateway service
   */
  async initialize() {
    try {
      logger.info('Initializing Gateway Service...');
      
      // Validate configuration
      this.validateConfig();
      
      // Initialize components
      await this.initializeComponents();
      
      this.initialized = true;
      logger.info('Gateway Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Gateway Service:', error);
      throw error;
    }
  }

  /**
   * Handle chat completion request
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model ID
   * @param {Array} params.messages - Chat messages
   * @param {Object} params.options - Chat options
   * @param {Object} params.requestMeta - Request metadata
   * @param {AbortSignal} params.signal - Cancellation signal
   * @param {boolean} params.stream - Whether to stream the response
   * @returns {Promise<Object|AsyncGenerator>} - OpenAI-compatible response or stream
   */
  async handleChatCompletion({ model, messages, options = {}, requestMeta = {}, signal, stream = false }) {
    const requestId = requestMeta.requestId || crypto.randomBytes(8).toString('hex');
    
    logger.info('Processing chat completion request', {
      requestId,
      model,
      messageCount: messages.length,
      apiKeyId: requestMeta.apiKeyId,
      stream
    });

    // Generate cache key for non-streaming requests
    const cacheKey = !stream ? this.generateCacheKey('chat', model, messages, options) : null;

    try {
      // Use performance service to execute request with optimizations
      return await this.performanceService.executeRequest(
        async () => {
          // Use fallback policy to execute request
          const requestFn = async (providerId) => {
            const provider = await this.findProviderForModel(model);
            if (!provider) {
              throw new Error(`No provider found for model: ${model}`);
            }

            // Get model mapping
            const modelMapping = provider.getModelMapping(model);
            if (!modelMapping) {
              throw new Error(`Model mapping not found for: ${model}`);
            }

            // Create adapter instance
            const adapter = this.adapterFactory.createAdapter(provider, provider.credentials);

            // Check if streaming is supported
            if (stream && !adapter.supportsStreaming) {
              logger.warn('Streaming requested but not supported by adapter, falling back to non-streaming', {
                requestId,
                model,
                providerId: provider._id
              });
              stream = false;
            }

            // Prepare adapter request
            const adapterRequest = {
              messages,
              options: {
                ...options,
                max_tokens: options.max_tokens || modelMapping.maxTokens,
                model: modelMapping.adapterModelId
              },
              requestMeta: {
                ...requestMeta,
                requestId,
                providerId: provider._id,
                providerName: provider.name
              },
              signal,
              stream
            };

            if (stream) {
              // Return streaming generator
              return this.handleChatCompletionStream(adapter, adapterRequest, model, provider);
            }

            // Execute adapter request
            const adapterResponse = await adapter.handleChat(adapterRequest);

            // Normalize response to OpenAI format
            const normalizedResponse = this.normalizer.normalizeChatResponse(
              adapterResponse,
              model,
              requestId,
              provider
            );

            logger.info('Chat completion request completed', {
              requestId,
              model,
              providerId: provider._id,
              tokensUsed: normalizedResponse.usage?.total_tokens || 0
            });

            return normalizedResponse;
          };

          // Execute with fallback policy
          return await this.fallbackPolicyService.executeWithFallback(model, requestFn);
        },
        {
          priority: stream ? 0 : 1, // Higher priority for streaming
          cacheKey,
          cacheTTL: 60000, // 1 minute cache for chat responses
          metadata: { requestId, model, stream }
        }
      );

    } catch (error) {
      logger.error('Chat completion request failed', {
        requestId,
        model,
        error: error.message,
        stack: error.stack
      });

      // Normalize error response
      throw this.normalizer.normalizeError(error, requestId);
    }
  }

  /**
   * Handle streaming chat completion request
   * @param {Object} adapter - Adapter instance
   * @param {Object} adapterRequest - Adapter request parameters
   * @param {string} model - Model ID
   * @param {Object} provider - Provider document
   * @returns {AsyncGenerator} - Stream of chat completion chunks
   */
  async *handleChatCompletionStream(adapter, adapterRequest, model, provider) {
    const requestId = adapterRequest.requestMeta.requestId;
    
    try {
      logger.info('Processing streaming chat completion request', {
        requestId,
        model,
        providerId: provider._id
      });

      // Get streaming response from adapter
      const streamGenerator = adapter.handleChatStream(adapterRequest);

      let totalTokens = 0;
      let chunkCount = 0;

      for await (const chunk of streamGenerator) {
        // Normalize chunk to OpenAI format
        const normalizedChunk = this.normalizer.normalizeStreamChunk(
          chunk,
          model,
          requestId,
          provider
        );

        // Track tokens if available
        if (chunk.usage) {
          totalTokens += chunk.usage.total_tokens || 0;
        }

        chunkCount++;
        yield normalizedChunk;
      }

      logger.info('Streaming chat completion request completed', {
        requestId,
        model,
        providerId: provider._id,
        chunkCount,
        totalTokens
      });

    } catch (error) {
      logger.error('Streaming chat completion request failed', {
        requestId,
        model,
        providerId: provider._id,
        error: error.message,
        stack: error.stack
      });

      // Send error chunk
      const errorChunk = this.normalizer.normalizeStreamError(error, requestId, model);
      yield errorChunk;
    }
  }

  /**
   * Handle embeddings request
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model ID
   * @param {string|Array} params.input - Input text(s)
   * @param {Object} params.options - Embeddings options
   * @param {Object} params.requestMeta - Request metadata
   * @returns {Promise<Object>} - OpenAI-compatible embeddings response
   */
  async handleEmbeddings({ model, input, options = {}, requestMeta = {} }) {
    const requestId = requestMeta.requestId || crypto.randomBytes(8).toString('hex');
    
    logger.info('Processing embeddings request', {
      requestId,
      model,
      inputType: Array.isArray(input) ? 'array' : 'string',
      inputCount: Array.isArray(input) ? input.length : 1
    });

    try {
      // Find provider for the requested model
      const provider = await this.findProviderForModel(model);
      if (!provider) {
        throw new Error(`No provider found for model: ${model}`);
      }

      // Check if model supports embeddings
      const modelMapping = provider.getModelMapping(model);
      if (!modelMapping || !modelMapping.supportsEmbeddings) {
        throw new Error(`Model ${model} does not support embeddings`);
      }

      // Create adapter instance
      const adapter = this.adapterFactory.createAdapter(provider, provider.credentials);

      // Execute adapter request
      const adapterResponse = await adapter.handleEmbeddings({
        input,
        options: {
          ...options,
          model: modelMapping.adapterModelId
        }
      });

      // Normalize response to OpenAI format
      const normalizedResponse = this.normalizer.normalizeEmbeddingsResponse(
        adapterResponse,
        model,
        requestId,
        provider
      );

      logger.info('Embeddings request completed', {
        requestId,
        model,
        providerId: provider._id
      });

      return normalizedResponse;

    } catch (error) {
      logger.error('Embeddings request failed', {
        requestId,
        model,
        error: error.message
      });

      throw this.normalizer.normalizeError(error, requestId);
    }
  }

  /**
   * Get available models
   * @returns {Promise<Object>} - OpenAI-compatible models response
   */
  async getAvailableModels() {
    try {
      // Check performance service cache first
      const cached = this.performanceService.getCachedModels();
      if (cached) {
        logger.debug('Models retrieved from cache');
        return cached;
      }

      // Fetch models from database
      const models = await Provider.getAllModels();
      
      // Normalize to OpenAI format
      const normalizedModels = this.normalizer.normalizeModels(models);

      // Cache the result in performance service
      this.performanceService.cacheModels(normalizedModels, 300000); // 5 minutes

      logger.info('Retrieved available models', {
        modelCount: models.length
      });

      return normalizedModels;

    } catch (error) {
      logger.error('Failed to get available models', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find provider for a specific model
   * @param {string} modelId - Model ID to find provider for
   * @returns {Promise<Provider|null>} - Provider document or null
   */
  async findProviderForModel(modelId) {
    try {
      // Check performance service cache first
      const cached = this.performanceService.getCachedProvider(modelId);
      if (cached) {
        // Filter out providers with open circuit breakers
        if (this.circuitBreakerService.isProviderHealthy(cached._id.toString())) {
          return cached;
        }
      }

      // Find providers that support this model
      const providers = await Provider.getProvidersByModel(modelId);
      
      if (providers.length === 0) {
        return null;
      }

      // Filter providers by circuit breaker status and health
      const healthyProviders = providers.filter(p => {
        const providerId = p._id.toString();
        const circuitHealthy = this.circuitBreakerService.isProviderHealthy(providerId);
        const providerHealthy = p.healthStatus.status === 'healthy';
        return circuitHealthy && providerHealthy;
      });

      // Return first healthy provider, or first available if none are healthy
      const provider = healthyProviders.length > 0 ? healthyProviders[0] : providers[0];

      // Cache the result in performance service
      this.performanceService.cacheProvider(modelId, provider, 60000); // 1 minute

      return provider;

    } catch (error) {
      logger.error('Failed to find provider for model', {
        modelId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.providerCache.clear();
    this.modelCache.clear();
    this.performanceService.clearCaches();
    logger.debug('Gateway service caches cleared');
  }

  /**
   * Generate cache key for requests
   * @param {string} type - Request type
   * @param {string} model - Model ID
   * @param {Array} messages - Messages array
   * @param {Object} options - Request options
   * @returns {string} - Cache key
   */
  generateCacheKey(type, model, messages, options) {
    const crypto = require('crypto');
    const content = JSON.stringify({
      type,
      model,
      messages: messages.slice(-3), // Only last 3 messages for cache key
      temperature: options.temperature,
      max_tokens: options.max_tokens
    });
    return `${type}:${crypto.createHash('md5').update(content).digest('hex')}`;
  }

  /**
   * Validate gateway configuration
   */
  validateConfig() {
    if (!this.config) {
      throw new Error('Gateway configuration is missing');
    }
    
    logger.info('Gateway configuration validated', {
      enabled: this.config.enabled,
      port: this.config.port,
      apiPrefix: this.config.apiPrefix,
      sandboxEnabled: this.config.sandbox.enabled,
    });
  }

  /**
   * Initialize gateway components
   */
  async initializeComponents() {
    // Initialize performance service
    await this.performanceService.initialize();
    
    // Initialize normalizer
    await this.normalizer.initialize();
    
    // Start health monitoring
    this.healthMonitorService.start();
    
    logger.debug('Gateway components initialized');
  }

  /**
   * Check if gateway is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get gateway configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Configure fallback policy for a model
   * @param {string} modelId - Model ID
   * @param {Object} config - Fallback configuration
   */
  configureFallbackPolicy(modelId, config) {
    this.fallbackPolicyService.configureFallback(modelId, config);
  }

  /**
   * Set provider priorities for fallback
   * @param {Object} priorities - Map of provider ID to priority
   */
  setProviderPriorities(priorities) {
    this.fallbackPolicyService.setProviderPriorities(priorities);
  }

  /**
   * Get circuit breaker status for all providers
   * @returns {Object}
   */
  getCircuitBreakerStatus() {
    return this.circuitBreakerService.getAllStatus();
  }

  /**
   * Get circuit breaker status for specific provider
   * @param {string} providerId - Provider ID
   * @returns {Object|null}
   */
  getProviderCircuitBreakerStatus(providerId) {
    return this.circuitBreakerService.getStatus(providerId);
  }

  /**
   * Reset circuit breaker for provider
   * @param {string} providerId - Provider ID
   */
  resetCircuitBreaker(providerId) {
    this.circuitBreakerService.resetCircuitBreaker(providerId);
  }

  /**
   * Open circuit breaker for provider
   * @param {string} providerId - Provider ID
   */
  openCircuitBreaker(providerId) {
    this.circuitBreakerService.openCircuitBreaker(providerId);
  }

  /**
   * Get fallback configuration for model
   * @param {string} modelId - Model ID
   * @returns {Object|null}
   */
  getFallbackConfig(modelId) {
    return this.fallbackPolicyService.getFallbackConfig(modelId);
  }

  /**
   * Get all fallback configurations
   * @returns {Object}
   */
  getAllFallbackConfigs() {
    return this.fallbackPolicyService.getAllFallbackConfigs();
  }

  /**
   * Remove fallback configuration for model
   * @param {string} modelId - Model ID
   */
  removeFallbackConfig(modelId) {
    this.fallbackPolicyService.removeFallbackConfig(modelId);
  }

  /**
   * Get health monitor status
   * @returns {Object}
   */
  getHealthMonitorStatus() {
    return this.healthMonitorService.getStatus();
  }

  /**
   * Manually trigger health check for provider
   * @param {string} providerId - Provider ID
   * @returns {Promise<Object>}
   */
  async checkProviderHealth(providerId) {
    return this.healthMonitorService.checkProvider(providerId);
  }

  /**
   * Manually trigger health check for all providers
   * @returns {Promise<Object[]>}
   */
  async checkAllProvidersHealth() {
    return this.healthMonitorService.checkAllProviders();
  }

  /**
   * Get circuit breaker and fallback statistics
   * @returns {Object}
   */
  getReliabilityStatistics() {
    return {
      circuitBreaker: this.circuitBreakerService.getStatistics(),
      fallbackPolicy: this.fallbackPolicyService.getStatistics(),
      healthMonitor: this.healthMonitorService.getStatistics()
    };
  }

  /**
   * Shutdown gateway services
   */
  async shutdown() {
    logger.info('Shutting down gateway services...');
    
    // Shutdown performance service
    if (this.performanceService) {
      await this.performanceService.shutdown();
    }
    
    // Stop health monitoring
    this.healthMonitorService.stop();
    
    // Clear caches
    this.clearCaches();
    
    // Clear circuit breakers
    this.circuitBreakerService.clearAll();
    
    // Clear fallback policies
    this.fallbackPolicyService.clearAll();
    
    this.initialized = false;
    logger.info('Gateway services shut down');
  }

  /**
   * Get performance statistics
   * @returns {Object}
   */
  getPerformanceStats() {
    return this.performanceService.getStats();
  }

  /**
   * Get performance health status
   * @returns {Object}
   */
  getPerformanceHealth() {
    return this.performanceService.getHealthStatus();
  }
}

module.exports = GatewayService;