/**
 * Gateway Service
 * Core orchestration service for the CLI Gateway
 */

const logger = require('../../config/logger');
const { gatewayConfig } = require('../config');
const { AdapterFactory } = require('../adapters');
const Provider = require('../../models/provider.model');
const OpenAINormalizer = require('./openai.normalizer');
const crypto = require('crypto');

class GatewayService {
  constructor() {
    this.config = gatewayConfig;
    this.initialized = false;
    this.adapterFactory = AdapterFactory;
    this.normalizer = new OpenAINormalizer();
    this.providerCache = new Map(); // Cache for provider lookups
    this.modelCache = new Map(); // Cache for model listings
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
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
   * @returns {Promise<Object>} - OpenAI-compatible response
   */
  async handleChatCompletion({ model, messages, options = {}, requestMeta = {}, signal }) {
    const requestId = requestMeta.requestId || crypto.randomBytes(8).toString('hex');
    
    logger.info('Processing chat completion request', {
      requestId,
      model,
      messageCount: messages.length,
      apiKeyId: requestMeta.apiKeyId
    });

    try {
      // Find provider for the requested model
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
        signal
      };

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
      // Check cache first
      const cacheKey = 'all-models';
      const cached = this.modelCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Fetch models from database
      const models = await Provider.getAllModels();
      
      // Normalize to OpenAI format
      const normalizedModels = this.normalizer.normalizeModels(models);

      // Cache the result
      this.modelCache.set(cacheKey, {
        data: normalizedModels,
        timestamp: Date.now()
      });

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
      // Check cache first
      const cached = this.providerCache.get(modelId);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.provider;
      }

      // Find providers that support this model
      const providers = await Provider.getProvidersByModel(modelId);
      
      if (providers.length === 0) {
        return null;
      }

      // For now, return the first healthy provider
      // TODO: Implement load balancing and circuit breaker logic
      const provider = providers.find(p => p.healthStatus.status === 'healthy') || providers[0];

      // Cache the result
      this.providerCache.set(modelId, {
        provider,
        timestamp: Date.now()
      });

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
    logger.debug('Gateway service caches cleared');
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
    // Initialize normalizer
    await this.normalizer.initialize();
    
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
}

module.exports = GatewayService;