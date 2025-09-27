/**
 * Proxy Adapter
 * Forwards requests to OpenAI-compatible services with header rewriting and streaming support
 */

const BaseAdapter = require('./base.adapter');
const axios = require('axios');
const logger = require('../../config/logger');
const crypto = require('crypto');

class ProxyAdapter extends BaseAdapter {
  constructor(providerConfig, credentials) {
    super(providerConfig, credentials);
    
    this.supportsStreaming = providerConfig.supportsStreaming !== false; // Default to true
    
    // Validate required config
    if (!providerConfig.baseUrl) {
      throw new Error('ProxyAdapter requires baseUrl in providerConfig');
    }
    
    // Initialize axios instance with default config
    this.httpClient = axios.create({
      baseURL: providerConfig.baseUrl,
      timeout: (providerConfig.timeoutMs || 30000),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dyad-CLI-Gateway/1.0',
        ...providerConfig.headers
      }
    });
    
    // Add request interceptor for authentication and header rewriting
    this.httpClient.interceptors.request.use(
      (config) => this.rewriteHeaders(config),
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
      intervalMs: providerConfig.healthCheckIntervalMs || 60000,
      timeoutMs: providerConfig.healthCheckTimeoutMs || 5000
    };
    
    this.lastHealthCheck = null;
    this.isHealthy = true;
  }

  /**
   * Handle chat completion request
   */
  async handleChat({ messages, options, requestMeta, signal }) {
    const requestId = requestMeta?.requestId || crypto.randomBytes(8).toString('hex');
    
    logger.info('ProxyAdapter handling chat request', {
      requestId,
      messageCount: messages.length,
      baseUrl: this.providerConfig.baseUrl,
      streaming: options?.stream
    });

    try {
      // Check health before processing request
      if (!await this.isServiceHealthy()) {
        throw new Error('Proxy service is not healthy');
      }
      
      // Prepare request data
      const requestData = {
        model: options?.model || this.providerConfig.defaultModel,
        messages,
        ...options
      };
      
      // Handle streaming vs non-streaming
      if (options?.stream && this.supportsStreaming) {
        return await this.handleStreamingChat(requestData, requestId, signal);
      } else {
        return await this.handleNonStreamingChat(requestData, requestId, signal);
      }
      
    } catch (error) {
      logger.error('ProxyAdapter chat request failed', {
        requestId,
        error: error.message,
        baseUrl: this.providerConfig.baseUrl
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
      url: this.providerConfig.chatEndpoint || '/v1/chat/completions',
      data: requestData,
      signal
    });
    
    // Proxy responses are already in OpenAI format, just pass through
    const result = response.data;
    
    // Ensure request ID is set
    if (!result.id) {
      result.id = requestId;
    }
    
    return result;
  }

  /**
   * Handle streaming chat completion
   */
  async handleStreamingChat(requestData, requestId, signal) {
    // For streaming, we need to return a readable stream
    // This is a simplified implementation - in practice, you'd want to handle SSE properly
    const response = await this.httpClient.request({
      method: 'POST',
      url: this.providerConfig.chatEndpoint || '/v1/chat/completions',
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
    
    logger.info('ProxyAdapter handling embeddings request', {
      requestId,
      inputType: Array.isArray(input) ? 'array' : 'string',
      inputLength: Array.isArray(input) ? input.length : input.length,
      baseUrl: this.providerConfig.baseUrl
    });

    try {
      // Check health before processing request
      if (!await this.isServiceHealthy()) {
        throw new Error('Proxy service is not healthy');
      }
      
      const requestData = {
        model: options?.model || this.providerConfig.defaultEmbeddingModel,
        input,
        ...options
      };
      
      const response = await this.httpClient.request({
        method: 'POST',
        url: this.providerConfig.embeddingsEndpoint || '/v1/embeddings',
        data: requestData
      });
      
      // Proxy responses are already in OpenAI format, just pass through
      return response.data;
      
    } catch (error) {
      logger.error('ProxyAdapter embeddings request failed', {
        requestId,
        error: error.message,
        baseUrl: this.providerConfig.baseUrl
      });
      throw error;
    }
  }

  /**
   * Test adapter connectivity
   */
  async testConnection() {
    try {
      // Test with a simple models request
      const response = await this.httpClient.request({
        method: 'GET',
        url: this.providerConfig.modelsEndpoint || '/v1/models',
        timeout: 10000
      });

      const hasModels = response.data && response.data.data && Array.isArray(response.data.data);

      return {
        success: true,
        message: 'Connection test successful',
        details: {
          responseReceived: !!response.data,
          hasModels,
          modelCount: hasModels ? response.data.data.length : 0,
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
          statusCode: error.response?.status,
          statusText: error.response?.statusText
        }
      };
    }
  }

  /**
   * Get adapter models
   */
  getModels() {
    return this.providerConfig.models || [];
  }

  /**
   * Validate adapter configuration
   */
  validateConfig() {
    const errors = [];
    
    if (!this.providerConfig.baseUrl) {
      errors.push('baseUrl is required');
    }
    
    if (this.providerConfig.timeoutMs !== undefined && this.providerConfig.timeoutMs < 1000) {
      errors.push('timeoutMs must be at least 1000');
    }
    
    // Validate URL format
    try {
      new URL(this.providerConfig.baseUrl);
    } catch (error) {
      errors.push('baseUrl must be a valid URL');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Rewrite headers for proxy request
   * @param {Object} config - Axios request config
   * @returns {Object} - Modified config with rewritten headers
   */
  rewriteHeaders(config) {
    // Add authentication headers
    const { authType, apiKey, bearerToken, customHeaders } = this.credentials;
    
    if (authType === 'bearer' && bearerToken) {
      config.headers.Authorization = `Bearer ${bearerToken}`;
    } else if (authType === 'api-key' && apiKey) {
      // For OpenAI-compatible services, typically use Authorization header
      config.headers.Authorization = `Bearer ${apiKey}`;
    } else if (customHeaders) {
      // Allow custom authentication headers
      Object.assign(config.headers, customHeaders);
    }
    
    // Apply header rewrites from config
    if (this.providerConfig.headerRewrites) {
      Object.entries(this.providerConfig.headerRewrites).forEach(([from, to]) => {
        if (config.headers[from]) {
          config.headers[to] = config.headers[from];
          delete config.headers[from];
        }
      });
    }
    
    // Remove headers that should not be forwarded
    const headersToRemove = this.providerConfig.removeHeaders || [];
    headersToRemove.forEach(header => {
      delete config.headers[header];
    });
    
    return config;
  }

  /**
   * Handle HTTP errors and transform them
   * @param {Error} error - Axios error
   * @returns {Promise} - Rejected promise with transformed error
   */
  handleHttpError(error) {
    if (error.response) {
      // Server responded with error status
      const { status, statusText, data } = error.response;
      
      logger.warn('Proxy HTTP request failed with response', {
        status,
        statusText,
        baseUrl: this.providerConfig.baseUrl,
        errorData: data
      });
      
      // For proxy adapters, pass through the error as-is since it's already in OpenAI format
      const proxyError = new Error(
        data?.error?.message || 
        data?.message || 
        `HTTP ${status}: ${statusText}`
      );
      proxyError.status = status;
      proxyError.proxyError = data;
      
      return Promise.reject(proxyError);
    } else if (error.request) {
      // Request was made but no response received
      logger.error('Proxy HTTP request failed - no response', {
        baseUrl: this.providerConfig.baseUrl,
        error: error.message
      });
      
      const networkError = new Error('Network error: No response from proxy service');
      networkError.isNetworkError = true;
      return Promise.reject(networkError);
    } else {
      // Something else happened
      logger.error('Proxy HTTP request setup failed', {
        baseUrl: this.providerConfig.baseUrl,
        error: error.message
      });
      
      return Promise.reject(error);
    }
  }

  /**
   * Check if the proxy service is healthy
   * @returns {Promise<boolean>} - True if healthy
   */
  async isServiceHealthy() {
    const now = Date.now();
    
    // Use cached health status if recent
    if (this.lastHealthCheck && 
        (now - this.lastHealthCheck.timestamp) < this.healthCheckConfig.intervalMs) {
      return this.lastHealthCheck.healthy;
    }
    
    try {
      logger.debug('Performing health check', {
        baseUrl: this.providerConfig.baseUrl,
        endpoint: this.healthCheckConfig.endpoint
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
        status: response.status
      };
      
      this.isHealthy = healthy;
      
      logger.debug('Health check completed', {
        baseUrl: this.providerConfig.baseUrl,
        healthy,
        status: response.status
      });
      
      return healthy;
      
    } catch (error) {
      logger.warn('Health check failed', {
        baseUrl: this.providerConfig.baseUrl,
        error: error.message
      });
      
      this.lastHealthCheck = {
        timestamp: now,
        healthy: false,
        error: error.message
      };
      
      this.isHealthy = false;
      return false;
    }
  }

  /**
   * Get health status
   * @returns {Object} - Health status information
   */
  getHealthStatus() {
    return {
      healthy: this.isHealthy,
      lastCheck: this.lastHealthCheck,
      baseUrl: this.providerConfig.baseUrl
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // No specific cleanup needed for HTTP client
  }
}

module.exports = ProxyAdapter;