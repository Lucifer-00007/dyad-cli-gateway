/**
 * Local Adapter
 * Communicates with local model servers (Ollama, TGI, LocalAI) that use OpenAI-compatible APIs
 */

const BaseAdapter = require('./base.adapter');
const axios = require('axios');
const logger = require('../../config/logger');
const crypto = require('crypto');

class LocalAdapter extends BaseAdapter {
  constructor(providerConfig, credentials) {
    super(providerConfig, credentials);
    
    this.supportsStreaming = providerConfig.supportsStreaming !== false; // Default to true
    
    // Validate required config
    if (!providerConfig.baseUrl) {
      throw new Error('LocalAdapter requires baseUrl in providerConfig');
    }
    
    // Initialize axios instance with default config
    this.httpClient = axios.create({
      baseURL: providerConfig.baseUrl,
      timeout: (providerConfig.timeoutMs || 60000), // Local models may be slower
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dyad-CLI-Gateway/1.0',
        ...providerConfig.headers
      }
    });
    
    // Add request interceptor for authentication (if needed)
    this.httpClient.interceptors.request.use(
      (config) => this.addAuthentication(config),
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => this.handleHttpError(error)
    );
    
    // Health check configuration
    this.healthCheckConfig = {
      endpoint: providerConfig.healthEndpoint || '/v1/models',
      intervalMs: providerConfig.healthCheckIntervalMs || 30000, // More frequent for local services
      timeoutMs: providerConfig.healthCheckTimeoutMs || 5000,
      retryAttempts: providerConfig.healthRetryAttempts || 3
    };
    
    this.lastHealthCheck = null;
    this.isHealthy = true;
    this.availableModels = [];
    
    // Service type detection
    this.serviceType = this.detectServiceType();
  }

  /**
   * Detect the type of local service based on configuration
   */
  detectServiceType() {
    // Check explicit serviceType first
    if (this.providerConfig.serviceType === 'ollama') {
      return 'ollama';
    } else if (this.providerConfig.serviceType === 'tgi') {
      return 'text-generation-inference';
    } else if (this.providerConfig.serviceType === 'localai') {
      return 'localai';
    }
    
    // Fallback to URL-based detection
    const baseUrl = this.providerConfig.baseUrl.toLowerCase();
    
    if (baseUrl.includes('ollama') || baseUrl.includes(':11434')) {
      return 'ollama';
    } else if (baseUrl.includes('tgi')) {
      return 'text-generation-inference';
    } else if (baseUrl.includes('localai')) {
      return 'localai';
    } else {
      return 'generic'; // Generic OpenAI-compatible service
    }
  }

  /**
   * Handle chat completion request
   */
  async handleChat({ messages, options, requestMeta, signal }) {
    const requestId = requestMeta?.requestId || crypto.randomBytes(8).toString('hex');
    
    logger.info('LocalAdapter handling chat request', {
      requestId,
      messageCount: messages.length,
      baseUrl: this.providerConfig.baseUrl,
      serviceType: this.serviceType,
      streaming: options?.stream
    });

    try {
      // Check health before processing request
      if (!await this.isServiceHealthy()) {
        throw new Error(`Local service (${this.serviceType}) is not healthy`);
      }
      
      // Transform request based on service type
      const requestData = this.transformChatRequest(messages, options);
      
      // Handle streaming vs non-streaming
      if (options?.stream && this.supportsStreaming) {
        return await this.handleStreamingChat(requestData, requestId, signal);
      } else {
        return await this.handleNonStreamingChat(requestData, requestId, signal);
      }
      
    } catch (error) {
      logger.error('LocalAdapter chat request failed', {
        requestId,
        error: error.message,
        baseUrl: this.providerConfig.baseUrl,
        serviceType: this.serviceType
      });
      throw error;
    }
  }

  /**
   * Handle non-streaming chat completion
   */
  async handleNonStreamingChat(requestData, requestId, signal) {
    const response = await this.httpClient.request({
      method: 'POST',
      url: this.getEndpoint('chat'),
      data: requestData,
      signal
    });
    
    // Transform response based on service type
    return this.transformChatResponse(response.data, requestId);
  }

  /**
   * Handle streaming chat completion
   */
  async handleStreamingChat(requestData, requestId, signal) {
    // For streaming, we need to return a readable stream
    const response = await this.httpClient.request({
      method: 'POST',
      url: this.getEndpoint('chat'),
      data: requestData,
      responseType: 'stream',
      signal
    });
    
    // Return the stream directly - the gateway service will handle SSE formatting
    return response.data;
  }

  /**
   * Handle embeddings request
   */
  async handleEmbeddings({ input, options }) {
    const requestId = crypto.randomBytes(8).toString('hex');
    
    logger.info('LocalAdapter handling embeddings request', {
      requestId,
      inputType: Array.isArray(input) ? 'array' : 'string',
      inputLength: Array.isArray(input) ? input.length : input.length,
      baseUrl: this.providerConfig.baseUrl,
      serviceType: this.serviceType
    });

    try {
      // Check if embeddings are supported
      if (!this.supportsEmbeddings()) {
        throw new Error(`Embeddings not supported by ${this.serviceType}`);
      }
      
      // Check health before processing request
      if (!await this.isServiceHealthy()) {
        throw new Error(`Local service (${this.serviceType}) is not healthy`);
      }
      
      const requestData = this.transformEmbeddingsRequest(input, options);
      
      const response = await this.httpClient.request({
        method: 'POST',
        url: this.getEndpoint('embeddings'),
        data: requestData
      });
      
      return this.transformEmbeddingsResponse(response.data, requestId);
      
    } catch (error) {
      logger.error('LocalAdapter embeddings request failed', {
        requestId,
        error: error.message,
        baseUrl: this.providerConfig.baseUrl,
        serviceType: this.serviceType
      });
      throw error;
    }
  }

  /**
   * Test adapter connectivity and discover models
   */
  async testConnection() {
    try {
      // Test with a models request to check connectivity and discover models
      const response = await this.httpClient.request({
        method: 'GET',
        url: this.getEndpoint('models'),
        timeout: 10000
      });

      const hasModels = response.data && response.data.data && Array.isArray(response.data.data);
      const models = hasModels ? response.data.data : [];
      
      // Cache discovered models
      this.availableModels = models;

      return {
        success: true,
        message: 'Connection test successful',
        details: {
          responseReceived: !!response.data,
          hasModels,
          modelCount: models.length,
          models: models.map(m => m.id || m.name),
          serviceType: this.serviceType,
          baseUrl: this.providerConfig.baseUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Connection test failed',
        error: error.message,
        details: {
          baseUrl: this.providerConfig.baseUrl,
          serviceType: this.serviceType,
          statusCode: error.response?.status,
          statusText: error.response?.statusText
        }
      };
    }
  }

  /**
   * Get adapter models (combines configured models with discovered models)
   */
  getModels() {
    const configuredModels = this.providerConfig.models || [];
    
    // If we have discovered models, merge them with configured models
    if (this.availableModels.length > 0) {
      const discoveredModels = this.availableModels.map(model => ({
        dyadModelId: model.id || model.name,
        adapterModelId: model.id || model.name,
        maxTokens: model.context_length || 4096,
        owned_by: model.owned_by || this.serviceType
      }));
      
      // Merge, preferring configured models for duplicates
      const modelMap = new Map();
      
      // Add discovered models first
      discoveredModels.forEach(model => {
        modelMap.set(model.dyadModelId, model);
      });
      
      // Override with configured models
      configuredModels.forEach(model => {
        modelMap.set(model.dyadModelId, model);
      });
      
      return Array.from(modelMap.values());
    }
    
    return configuredModels;
  }

  /**
   * Validate adapter configuration
   */
  validateConfig() {
    const errors = [];
    
    if (!this.providerConfig.baseUrl) {
      errors.push('baseUrl is required');
      return {
        valid: false,
        errors
      };
    }
    
    if (this.providerConfig.timeoutMs !== undefined && this.providerConfig.timeoutMs < 1000) {
      errors.push('timeoutMs must be at least 1000');
    }
    
    // Validate URL format
    try {
      const url = new URL(this.providerConfig.baseUrl);
      
      // Check if URL looks like a local address
      const isLocal = url.hostname === 'localhost' || 
                     url.hostname === '127.0.0.1' || 
                     url.hostname.startsWith('192.168.') ||
                     url.hostname.startsWith('10.') ||
                     url.hostname.startsWith('172.');
      
      if (!isLocal && !this.providerConfig.allowRemote) {
        errors.push('baseUrl should be a local address, or set allowRemote: true');
      }
    } catch (error) {
      errors.push('baseUrl must be a valid URL');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get the appropriate endpoint for the service type
   */
  getEndpoint(type) {
    const endpoints = {
      chat: this.providerConfig.chatEndpoint || '/v1/chat/completions',
      embeddings: this.providerConfig.embeddingsEndpoint || '/v1/embeddings',
      models: this.providerConfig.modelsEndpoint || '/v1/models'
    };
    
    // Service-specific endpoint overrides
    if (this.serviceType === 'ollama') {
      if (type === 'chat') {
        return endpoints.chat; // Ollama uses standard OpenAI endpoints
      }
    } else if (this.serviceType === 'text-generation-inference') {
      if (type === 'chat') {
        return endpoints.chat; // TGI uses standard OpenAI endpoints
      }
    }
    
    return endpoints[type];
  }

  /**
   * Check if embeddings are supported by this service type
   */
  supportsEmbeddings() {
    // Most local services support embeddings, but TGI typically doesn't
    return this.serviceType !== 'text-generation-inference';
  }

  /**
   * Transform chat request based on service type
   */
  transformChatRequest(messages, options) {
    const baseRequest = {
      model: options?.model || this.providerConfig.defaultModel || 'default',
      messages,
      ...options
    };
    
    // Service-specific transformations
    if (this.serviceType === 'ollama') {
      // Ollama may need specific model format
      if (baseRequest.model && !baseRequest.model.includes(':')) {
        baseRequest.model = `${baseRequest.model}:latest`;
      }
    }
    
    return baseRequest;
  }

  /**
   * Transform chat response based on service type
   */
  transformChatResponse(response, requestId) {
    // Most local services return OpenAI-compatible responses
    const result = {
      id: response.id || requestId,
      object: response.object || 'chat.completion',
      created: response.created || Math.floor(Date.now() / 1000),
      model: response.model || 'unknown',
      choices: response.choices || [],
      usage: response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
    
    // Service-specific response transformations
    if (this.serviceType === 'ollama') {
      // Ollama might have different response format
      if (response.message && !response.choices) {
        result.choices = [{
          index: 0,
          message: response.message,
          finish_reason: response.done ? 'stop' : 'length'
        }];
      }
    }
    
    return result;
  }

  /**
   * Transform embeddings request based on service type
   */
  transformEmbeddingsRequest(input, options) {
    return {
      model: options?.model || this.providerConfig.defaultEmbeddingModel || 'default',
      input,
      ...options
    };
  }

  /**
   * Transform embeddings response based on service type
   */
  transformEmbeddingsResponse(response, requestId) {
    return {
      object: response.object || 'list',
      data: response.data || [],
      model: response.model || 'unknown',
      usage: response.usage || {
        prompt_tokens: 0,
        total_tokens: 0
      }
    };
  }

  /**
   * Add authentication to request (if needed)
   */
  addAuthentication(config) {
    // Most local services don't require authentication, but some might
    const { authType, apiKey, bearerToken, customHeaders } = this.credentials;
    
    if (authType === 'bearer' && bearerToken) {
      config.headers.Authorization = `Bearer ${bearerToken}`;
    } else if (authType === 'api-key' && apiKey) {
      config.headers.Authorization = `Bearer ${apiKey}`;
    } else if (customHeaders) {
      Object.assign(config.headers, customHeaders);
    }
    
    return config;
  }

  /**
   * Handle HTTP errors and transform them
   */
  handleHttpError(error) {
    if (error.response) {
      const { status, statusText, data } = error.response;
      
      logger.warn('Local service HTTP request failed', {
        status,
        statusText,
        baseUrl: this.providerConfig.baseUrl,
        serviceType: this.serviceType,
        errorData: data
      });
      
      const localError = new Error(
        data?.error?.message || 
        data?.message || 
        `HTTP ${status}: ${statusText}`
      );
      localError.status = status;
      localError.serviceError = data;
      
      return Promise.reject(localError);
    } else if (error.request) {
      logger.error('Local service HTTP request failed - no response', {
        baseUrl: this.providerConfig.baseUrl,
        serviceType: this.serviceType,
        error: error.message
      });
      
      const networkError = new Error(`Network error: No response from local service (${this.serviceType})`);
      networkError.isNetworkError = true;
      return Promise.reject(networkError);
    } else {
      logger.error('Local service HTTP request setup failed', {
        baseUrl: this.providerConfig.baseUrl,
        serviceType: this.serviceType,
        error: error.message
      });
      
      return Promise.reject(error);
    }
  }

  /**
   * Check if the local service is healthy
   */
  async isServiceHealthy() {
    const now = Date.now();
    
    // Use cached health status if recent
    if (this.lastHealthCheck && 
        (now - this.lastHealthCheck.timestamp) < this.healthCheckConfig.intervalMs) {
      return this.lastHealthCheck.healthy;
    }
    
    let attempts = 0;
    let lastError;
    
    while (attempts < this.healthCheckConfig.retryAttempts) {
      try {
        logger.debug('Performing health check', {
          baseUrl: this.providerConfig.baseUrl,
          serviceType: this.serviceType,
          endpoint: this.healthCheckConfig.endpoint,
          attempt: attempts + 1
        });
        
        const response = await this.httpClient.request({
          method: 'GET',
          url: this.healthCheckConfig.endpoint,
          timeout: this.healthCheckConfig.timeoutMs
        });
        
        const healthy = response.status >= 200 && response.status < 300;
        
        this.lastHealthCheck = {
          timestamp: now,
          healthy,
          status: response.status,
          attempts: attempts + 1
        };
        
        this.isHealthy = healthy;
        
        logger.debug('Health check completed', {
          baseUrl: this.providerConfig.baseUrl,
          serviceType: this.serviceType,
          healthy,
          status: response.status,
          attempts: attempts + 1
        });
        
        return healthy;
        
      } catch (error) {
        lastError = error;
        attempts++;
        
        if (attempts < this.healthCheckConfig.retryAttempts) {
          logger.debug('Health check failed, retrying', {
            baseUrl: this.providerConfig.baseUrl,
            serviceType: this.serviceType,
            attempt: attempts,
            error: error.message
          });
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    logger.warn('Health check failed after all attempts', {
      baseUrl: this.providerConfig.baseUrl,
      serviceType: this.serviceType,
      attempts,
      error: lastError?.message
    });
    
    this.lastHealthCheck = {
      timestamp: now,
      healthy: false,
      error: lastError?.message,
      attempts
    };
    
    this.isHealthy = false;
    return false;
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      healthy: this.isHealthy,
      lastCheck: this.lastHealthCheck,
      serviceType: this.serviceType,
      baseUrl: this.providerConfig.baseUrl,
      availableModels: this.availableModels.length
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // No specific cleanup needed for HTTP client
  }
}

module.exports = LocalAdapter;