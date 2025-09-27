/**
 * HTTP-SDK Adapter
 * Makes HTTP requests to vendor APIs with retry logic and response transformation
 */

const BaseAdapter = require('./base.adapter');
const axios = require('axios');
const logger = require('../../config/logger');
const crypto = require('crypto');

class HttpSdkAdapter extends BaseAdapter {
  constructor(providerConfig, credentials) {
    super(providerConfig, credentials);
    
    this.supportsStreaming = providerConfig.supportsStreaming || false;
    
    // Validate required config
    if (!providerConfig.baseUrl) {
      throw new Error('HttpSdkAdapter requires baseUrl in providerConfig');
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
    
    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use(
      (config) => this.addAuthentication(config),
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => this.handleHttpError(error)
    );
    
    // Retry configuration
    this.retryConfig = {
      maxAttempts: providerConfig.retryAttempts || 3,
      baseDelay: providerConfig.retryBaseDelay || 1000,
      maxDelay: providerConfig.retryMaxDelay || 10000,
      retryableStatusCodes: providerConfig.retryableStatusCodes || [429, 500, 502, 503, 504]
    };
  }

  /**
   * Handle chat completion request
   */
  async handleChat({ messages, options, requestMeta, signal }) {
    const requestId = requestMeta?.requestId || crypto.randomBytes(8).toString('hex');
    
    logger.info('HttpSdkAdapter handling chat request', {
      requestId,
      messageCount: messages.length,
      baseUrl: this.providerConfig.baseUrl,
      endpoint: this.providerConfig.chatEndpoint || '/chat/completions'
    });

    try {
      // Transform request to vendor format
      const vendorRequest = this.transformChatRequest(messages, options);
      
      // Make HTTP request with retry logic
      const response = await this.makeRequestWithRetry({
        method: 'POST',
        url: this.providerConfig.chatEndpoint || '/chat/completions',
        data: vendorRequest,
        signal
      }, requestId);
      
      // Transform response to OpenAI format
      return this.transformChatResponse(response.data, requestId);
      
    } catch (error) {
      logger.error('HttpSdkAdapter chat request failed', {
        requestId,
        error: error.message,
        baseUrl: this.providerConfig.baseUrl
      });
      throw error;
    }
  }

  /**
   * Handle embeddings request
   */
  async handleEmbeddings({ input, options }) {
    if (!this.providerConfig.embeddingsEndpoint) {
      throw new Error('Embeddings not supported by this provider configuration');
    }
    
    const requestId = crypto.randomBytes(8).toString('hex');
    
    logger.info('HttpSdkAdapter handling embeddings request', {
      requestId,
      inputType: Array.isArray(input) ? 'array' : 'string',
      inputLength: Array.isArray(input) ? input.length : input.length,
      baseUrl: this.providerConfig.baseUrl
    });

    try {
      // Transform request to vendor format
      const vendorRequest = this.transformEmbeddingsRequest(input, options);
      
      // Make HTTP request with retry logic
      const response = await this.makeRequestWithRetry({
        method: 'POST',
        url: this.providerConfig.embeddingsEndpoint,
        data: vendorRequest
      }, requestId);
      
      // Transform response to OpenAI format
      return this.transformEmbeddingsResponse(response.data, requestId);
      
    } catch (error) {
      logger.error('HttpSdkAdapter embeddings request failed', {
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
      // Test with a simple chat request
      const testMessages = [
        { role: 'user', content: 'test connection' }
      ];
      
      const result = await this.handleChat({
        messages: testMessages,
        options: { max_tokens: 10 },
        requestMeta: { requestId: 'test-connection' }
      });

      return {
        success: true,
        message: 'Connection test successful',
        details: {
          responseReceived: !!result,
          hasContent: !!(result.choices && result.choices[0] && result.choices[0].message),
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
    
    if (this.providerConfig.retryAttempts !== undefined && this.providerConfig.retryAttempts < 0) {
      errors.push('retryAttempts must be non-negative');
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
   * Add authentication to request
   * @param {Object} config - Axios request config
   * @returns {Object} - Modified config with authentication
   */
  addAuthentication(config) {
    const { authType, apiKey, bearerToken, customHeaders } = this.credentials;
    
    if (authType === 'bearer' && bearerToken) {
      config.headers.Authorization = `Bearer ${bearerToken}`;
    } else if (authType === 'api-key' && apiKey) {
      // Different vendors use different header names for API keys
      const apiKeyHeader = this.providerConfig.apiKeyHeader || 'X-API-Key';
      config.headers[apiKeyHeader] = apiKey;
    } else if (customHeaders) {
      // Allow custom authentication headers
      Object.assign(config.headers, customHeaders);
    }
    
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
      
      logger.warn('HTTP request failed with response', {
        status,
        statusText,
        baseUrl: this.providerConfig.baseUrl,
        errorData: data
      });
      
      // Transform vendor-specific errors to standard format
      const transformedError = new Error(
        data?.error?.message || 
        data?.message || 
        `HTTP ${status}: ${statusText}`
      );
      transformedError.status = status;
      transformedError.vendorError = data;
      
      return Promise.reject(transformedError);
    } else if (error.request) {
      // Request was made but no response received
      logger.error('HTTP request failed - no response', {
        baseUrl: this.providerConfig.baseUrl,
        error: error.message
      });
      
      const networkError = new Error('Network error: No response from server');
      networkError.isNetworkError = true;
      return Promise.reject(networkError);
    } else {
      // Something else happened
      logger.error('HTTP request setup failed', {
        baseUrl: this.providerConfig.baseUrl,
        error: error.message
      });
      
      return Promise.reject(error);
    }
  }

  /**
   * Make HTTP request with retry logic
   * @param {Object} requestConfig - Axios request configuration
   * @param {string} requestId - Request ID for logging
   * @returns {Promise<Object>} - Response data
   */
  async makeRequestWithRetry(requestConfig, requestId) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        logger.debug('Making HTTP request', {
          requestId,
          attempt,
          maxAttempts: this.retryConfig.maxAttempts,
          url: requestConfig.url,
          method: requestConfig.method
        });
        
        const response = await this.httpClient.request(requestConfig);
        
        logger.info('HTTP request successful', {
          requestId,
          attempt,
          status: response.status,
          url: requestConfig.url
        });
        
        return response;
        
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === this.retryConfig.maxAttempts;
        
        logger.warn('HTTP request failed', {
          requestId,
          attempt,
          maxAttempts: this.retryConfig.maxAttempts,
          error: error.message,
          status: error.status,
          isRetryable,
          isLastAttempt
        });
        
        if (!isRetryable || isLastAttempt) {
          throw error;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateRetryDelay(attempt);
        logger.debug('Retrying HTTP request after delay', {
          requestId,
          attempt,
          delayMs: delay
        });
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Check if error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} - True if retryable
   */
  isRetryableError(error) {
    // Network errors are retryable
    if (error.isNetworkError) {
      return true;
    }
    
    // Check status codes
    if (error.status && this.retryConfig.retryableStatusCodes.includes(error.status)) {
      return true;
    }
    
    // Timeout errors are retryable
    if (error.code === 'ECONNABORTED') {
      return true;
    }
    
    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   * @param {number} attempt - Current attempt number
   * @returns {number} - Delay in milliseconds
   */
  calculateRetryDelay(attempt) {
    const exponentialDelay = this.retryConfig.baseDelay * Math.pow(2, attempt - 1);
    const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add jitter
    return Math.min(jitteredDelay, this.retryConfig.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} - Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Transform OpenAI chat request to vendor format
   * @param {Array} messages - Chat messages
   * @param {Object} options - Chat options
   * @returns {Object} - Vendor-formatted request
   */
  transformChatRequest(messages, options) {
    // Default implementation - pass through OpenAI format
    // Override in subclasses for vendor-specific transformations
    const request = {
      messages,
      ...options
    };
    
    // Apply any request transformations from config
    if (this.providerConfig.requestTransform) {
      return this.providerConfig.requestTransform(request);
    }
    
    return request;
  }

  /**
   * Transform vendor chat response to OpenAI format
   * @param {Object} vendorResponse - Vendor response
   * @param {string} requestId - Request ID
   * @returns {Object} - OpenAI-formatted response
   */
  transformChatResponse(vendorResponse, requestId) {
    // Default implementation - assume OpenAI format
    // Override in subclasses for vendor-specific transformations
    
    // Apply any response transformations from config
    let response = vendorResponse;
    if (this.providerConfig.responseTransform) {
      response = this.providerConfig.responseTransform(vendorResponse);
    }
    
    // Ensure required OpenAI fields are present
    const normalizedResponse = {
      id: response.id || requestId,
      object: response.object || 'chat.completion',
      created: response.created || Math.floor(Date.now() / 1000),
      model: response.model || this.providerConfig.models?.[0]?.dyadModelId || 'unknown',
      choices: response.choices || [],
      usage: response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
    
    // Preserve any additional fields from the transformed response
    return { ...normalizedResponse, ...response };
  }

  /**
   * Transform OpenAI embeddings request to vendor format
   * @param {string|Array} input - Input text(s)
   * @param {Object} options - Embeddings options
   * @returns {Object} - Vendor-formatted request
   */
  transformEmbeddingsRequest(input, options) {
    // Default implementation - pass through OpenAI format
    const request = {
      input,
      ...options
    };
    
    // Apply any request transformations from config
    if (this.providerConfig.embeddingsRequestTransform) {
      return this.providerConfig.embeddingsRequestTransform(request);
    }
    
    return request;
  }

  /**
   * Transform vendor embeddings response to OpenAI format
   * @param {Object} vendorResponse - Vendor response
   * @param {string} requestId - Request ID
   * @returns {Object} - OpenAI-formatted response
   */
  transformEmbeddingsResponse(vendorResponse, requestId) {
    // Default implementation - assume OpenAI format
    let response = vendorResponse;
    if (this.providerConfig.embeddingsResponseTransform) {
      response = this.providerConfig.embeddingsResponseTransform(vendorResponse);
    }
    
    // Ensure required OpenAI fields are present
    const normalizedResponse = {
      object: response.object || 'list',
      data: response.data || [],
      model: response.model || this.providerConfig.models?.[0]?.dyadModelId || 'unknown',
      usage: response.usage || {
        prompt_tokens: 0,
        total_tokens: 0
      }
    };
    
    // Preserve any additional fields from the transformed response
    return { ...normalizedResponse, ...response };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // No specific cleanup needed for HTTP client
  }
}

module.exports = HttpSdkAdapter;