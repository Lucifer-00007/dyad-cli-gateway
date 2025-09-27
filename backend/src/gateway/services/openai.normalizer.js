/**
 * OpenAI Response Normalizer
 * Converts adapter responses to OpenAI-compatible format
 */

const logger = require('../../config/logger');
const crypto = require('crypto');

class OpenAINormalizer {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the normalizer
   */
  async initialize() {
    this.initialized = true;
    logger.debug('OpenAI Normalizer initialized');
  }

  /**
   * Normalize chat completion response to OpenAI format
   * @param {Object} adapterResponse - Raw adapter response
   * @param {string} dyadModelId - Dyad model ID
   * @param {string} requestId - Request ID
   * @param {Object} provider - Provider document
   * @returns {Object} - OpenAI-compatible response
   */
  normalizeChatResponse(adapterResponse, dyadModelId, requestId, provider) {
    try {
      // If response is already in OpenAI format, enhance it
      if (this.isOpenAIFormat(adapterResponse)) {
        return {
          ...adapterResponse,
          id: adapterResponse.id || requestId,
          model: dyadModelId,
          created: adapterResponse.created || Math.floor(Date.now() / 1000),
          object: 'chat.completion'
        };
      }

      // Convert raw response to OpenAI format
      const normalized = {
        id: requestId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: dyadModelId,
        choices: this.normalizeChoices(adapterResponse),
        usage: this.normalizeUsage(adapterResponse, dyadModelId)
      };

      // Add system fingerprint if available
      if (adapterResponse.system_fingerprint) {
        normalized.system_fingerprint = adapterResponse.system_fingerprint;
      }

      return normalized;

    } catch (error) {
      logger.error('Failed to normalize chat response', {
        requestId,
        dyadModelId,
        providerId: provider._id,
        error: error.message
      });
      throw new Error(`Response normalization failed: ${error.message}`);
    }
  }

  /**
   * Normalize embeddings response to OpenAI format
   * @param {Object} adapterResponse - Raw adapter response
   * @param {string} dyadModelId - Dyad model ID
   * @param {string} requestId - Request ID
   * @param {Object} provider - Provider document
   * @returns {Object} - OpenAI-compatible embeddings response
   */
  normalizeEmbeddingsResponse(adapterResponse, dyadModelId, requestId, provider) {
    try {
      // If response is already in OpenAI format, enhance it
      if (adapterResponse.object === 'list' && adapterResponse.data) {
        return {
          ...adapterResponse,
          model: dyadModelId,
          usage: adapterResponse.usage || { prompt_tokens: 0, total_tokens: 0 }
        };
      }

      // Convert raw response to OpenAI format
      let embeddings;
      
      // Handle different response formats
      if (Array.isArray(adapterResponse)) {
        // Array of embeddings or single embedding array
        if (adapterResponse.length > 0 && typeof adapterResponse[0] === 'number') {
          // Single embedding as array of numbers
          embeddings = [adapterResponse];
        } else {
          // Array of embeddings
          embeddings = adapterResponse;
        }
      } else {
        // Single embedding object or other format
        embeddings = [adapterResponse];
      }
      
      return {
        object: 'list',
        data: embeddings.map((embedding, index) => ({
          object: 'embedding',
          embedding: Array.isArray(embedding) ? embedding : embedding.embedding || [],
          index
        })),
        model: dyadModelId,
        usage: {
          prompt_tokens: this.estimateTokensFromEmbeddings(embeddings),
          total_tokens: this.estimateTokensFromEmbeddings(embeddings)
        }
      };

    } catch (error) {
      logger.error('Failed to normalize embeddings response', {
        requestId,
        dyadModelId,
        providerId: provider._id,
        error: error.message
      });
      throw new Error(`Embeddings normalization failed: ${error.message}`);
    }
  }

  /**
   * Normalize models list to OpenAI format
   * @param {Array} models - Array of model objects from database
   * @returns {Object} - OpenAI-compatible models response
   */
  normalizeModels(models) {
    return {
      object: 'list',
      data: models.map(model => ({
        id: model.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: model.owned_by || model.provider,
        permission: [],
        root: model.id,
        parent: null,
        // Additional metadata
        max_tokens: model.max_tokens,
        context_window: model.context_window,
        supports_streaming: model.supports_streaming,
        supports_embeddings: model.supports_embeddings
      }))
    };
  }

  /**
   * Normalize error to OpenAI format
   * @param {Error} error - Error object
   * @param {string} requestId - Request ID
   * @returns {Error} - OpenAI-compatible error
   */
  normalizeError(error, requestId) {
    const errorMap = {
      // Authentication errors
      'Invalid API key': { type: 'authentication_error', code: 'invalid_api_key', status: 401 },
      'API key required': { type: 'authentication_error', code: 'invalid_api_key', status: 401 },
      
      // Authorization errors
      'Permission denied': { type: 'permission_error', code: 'forbidden', status: 403 },
      'Insufficient permissions': { type: 'permission_error', code: 'forbidden', status: 403 },
      
      // Request errors
      'Invalid request': { type: 'invalid_request_error', code: 'invalid_request', status: 400 },
      'Missing required parameter': { type: 'invalid_request_error', code: 'invalid_request', status: 400 },
      'Invalid parameter': { type: 'invalid_request_error', code: 'invalid_request', status: 400 },
      
      // Model errors
      'No provider found for model': { type: 'invalid_request_error', code: 'model_not_found', status: 404 },
      'Model not found': { type: 'invalid_request_error', code: 'model_not_found', status: 404 },
      'Model mapping not found': { type: 'invalid_request_error', code: 'model_not_found', status: 404 },
      'does not support embeddings': { type: 'invalid_request_error', code: 'model_not_supported', status: 400 },
      'Embeddings not supported': { type: 'invalid_request_error', code: 'model_not_supported', status: 400 },
      
      // Rate limiting
      'Rate limit exceeded': { type: 'rate_limit_error', code: 'rate_limit_exceeded', status: 429 },
      'Too many requests': { type: 'rate_limit_error', code: 'rate_limit_exceeded', status: 429 },
      
      // Timeout errors
      'Request timeout': { type: 'internal_error', code: 'adapter_timeout', status: 504 },
      'Adapter timeout': { type: 'internal_error', code: 'adapter_timeout', status: 504 },
      'Command timeout': { type: 'internal_error', code: 'adapter_timeout', status: 504 },
      
      // Provider errors
      'Provider authentication failed': { type: 'invalid_request_error', code: 'provider_authentication', status: 502 },
      'Provider unavailable': { type: 'internal_error', code: 'provider_unavailable', status: 502 },
      
      // Default internal error
      'default': { type: 'internal_error', code: 'internal_server_error', status: 500 }
    };

    // Find matching error type
    let errorInfo = errorMap.default;
    for (const [pattern, info] of Object.entries(errorMap)) {
      if (pattern !== 'default' && error.message.includes(pattern)) {
        errorInfo = info;
        break;
      }
    }

    // Create OpenAI-compatible ApiError
    const ApiError = require('../../utils/ApiError');
    const openaiError = new ApiError(
      errorInfo.status,
      error.message,
      true,
      error.stack,
      errorInfo.type,
      errorInfo.code
    );
    
    // Add trace ID for debugging
    openaiError.trace_id = crypto.randomBytes(4).toString('hex');

    return openaiError;
  }

  /**
   * Check if response is already in OpenAI format
   * @param {Object} response - Response to check
   * @returns {boolean} - True if already in OpenAI format
   */
  isOpenAIFormat(response) {
    return response && 
           response.object === 'chat.completion' &&
           Array.isArray(response.choices) &&
           response.choices.length > 0;
  }

  /**
   * Normalize choices array
   * @param {Object} adapterResponse - Raw adapter response
   * @returns {Array} - Normalized choices array
   */
  normalizeChoices(adapterResponse) {
    // If already has choices, return as-is
    if (Array.isArray(adapterResponse.choices)) {
      return adapterResponse.choices;
    }

    // If response has a single message/content
    if (adapterResponse.message || adapterResponse.content) {
      return [{
        index: 0,
        message: adapterResponse.message || {
          role: 'assistant',
          content: adapterResponse.content || adapterResponse.text || String(adapterResponse)
        },
        finish_reason: adapterResponse.finish_reason || 'stop'
      }];
    }

    // If response is a string, wrap it
    if (typeof adapterResponse === 'string') {
      return [{
        index: 0,
        message: {
          role: 'assistant',
          content: adapterResponse
        },
        finish_reason: 'stop'
      }];
    }

    // Default fallback
    return [{
      index: 0,
      message: {
        role: 'assistant',
        content: JSON.stringify(adapterResponse)
      },
      finish_reason: 'stop'
    }];
  }

  /**
   * Normalize usage information
   * @param {Object} adapterResponse - Raw adapter response
   * @param {string} modelId - Model ID for token estimation
   * @returns {Object} - Usage object
   */
  normalizeUsage(adapterResponse, modelId) {
    // If usage is already provided, use it
    if (adapterResponse.usage) {
      return {
        prompt_tokens: adapterResponse.usage.prompt_tokens || 0,
        completion_tokens: adapterResponse.usage.completion_tokens || 0,
        total_tokens: adapterResponse.usage.total_tokens || 
                     (adapterResponse.usage.prompt_tokens || 0) + 
                     (adapterResponse.usage.completion_tokens || 0)
      };
    }

    // Estimate tokens from content
    const choices = this.normalizeChoices(adapterResponse);
    const completionText = choices.map(choice => choice.message.content).join('');
    const completionTokens = this.estimateTokens(completionText);

    return {
      prompt_tokens: adapterResponse.prompt_tokens || 0,
      completion_tokens: completionTokens,
      total_tokens: (adapterResponse.prompt_tokens || 0) + completionTokens
    };
  }

  /**
   * Estimate token count from text
   * @param {string} text - Text to estimate tokens for
   * @returns {number} - Estimated token count
   */
  estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    
    // Rough approximation: 1 token per 4 characters
    // This is a simplified estimation - real tokenizers are more complex
    return Math.ceil(text.length / 4);
  }

  /**
   * Normalize streaming chunk to OpenAI format
   * @param {Object} chunk - Raw chunk from adapter
   * @param {string} dyadModelId - Dyad model ID
   * @param {string} requestId - Request ID
   * @param {Object} provider - Provider document
   * @returns {Object} - OpenAI-compatible chunk
   */
  normalizeStreamChunk(chunk, dyadModelId, requestId, provider) {
    try {
      // If chunk is already in OpenAI format, enhance it
      if (chunk.object === 'chat.completion.chunk') {
        return {
          ...chunk,
          id: chunk.id || requestId,
          model: dyadModelId,
          created: chunk.created || Math.floor(Date.now() / 1000)
        };
      }

      // Convert raw chunk to OpenAI format
      const normalized = {
        id: requestId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: dyadModelId,
        choices: [{
          index: 0,
          delta: chunk.delta || { content: chunk.content || '' },
          finish_reason: chunk.finish_reason || null
        }]
      };

      // Add usage if available
      if (chunk.usage) {
        normalized.usage = chunk.usage;
      }

      return normalized;

    } catch (error) {
      logger.error('Failed to normalize stream chunk', {
        requestId,
        dyadModelId,
        providerId: provider._id,
        error: error.message
      });
      
      // Return error chunk
      return {
        id: requestId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: dyadModelId,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'error'
        }],
        error: {
          message: 'Chunk normalization failed',
          type: 'internal_error'
        }
      };
    }
  }

  /**
   * Normalize streaming error to OpenAI format
   * @param {Error} error - Error object
   * @param {string} requestId - Request ID
   * @param {string} dyadModelId - Dyad model ID
   * @returns {Object} - OpenAI-compatible error chunk
   */
  normalizeStreamError(error, requestId, dyadModelId) {
    const normalizedError = this.normalizeError(error, requestId);
    
    return {
      id: requestId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: dyadModelId,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'error'
      }],
      error: {
        message: normalizedError.message,
        type: normalizedError.openaiType || 'internal_error',
        code: normalizedError.openaiCode || 'internal_server_error'
      }
    };
  }

  /**
   * Estimate tokens from embeddings
   * @param {Array} embeddings - Array of embeddings
   * @returns {number} - Estimated token count
   */
  estimateTokensFromEmbeddings(embeddings) {
    // Rough estimation based on embedding count
    return embeddings.length * 10; // Assume ~10 tokens per embedding on average
  }
}

module.exports = OpenAINormalizer;