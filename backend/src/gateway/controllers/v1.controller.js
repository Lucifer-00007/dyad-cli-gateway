/**
 * OpenAI v1 API Controllers
 * Handles /v1/* endpoints with OpenAI-compatible responses
 */

const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { GatewayService } = require('../services');
const logger = require('../../config/logger');
const crypto = require('crypto');

// Initialize gateway service
const gatewayService = new GatewayService();

/**
 * Handle chat completions
 * POST /v1/chat/completions
 */
const chatCompletions = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { model, messages, max_tokens, temperature, stream, ...otherOptions } = req.body;

  // Basic validation
  if (!model || !messages || !Array.isArray(messages)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Missing required fields: model and messages', true, '', 'invalid_request_error', 'invalid_request');
  }

  if (messages.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Messages array cannot be empty', true, '', 'invalid_request_error', 'invalid_request');
  }

  // Validate message format
  for (const message of messages) {
    if (!message.role || !message.content) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Each message must have role and content', true, '', 'invalid_request_error', 'invalid_request');
    }
    if (!['system', 'user', 'assistant'].includes(message.role)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Message role must be system, user, or assistant', true, '', 'invalid_request_error', 'invalid_request');
    }
  }

  // Check if API key can access this model
  if (!req.apiKey.canAccessModel(model)) {
    throw new ApiError(httpStatus.FORBIDDEN, `Access denied for model: ${model}`, true, '', 'permission_error', 'model_access_denied');
  }

  // TODO: Implement streaming support in future tasks
  if (stream) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Streaming is not yet supported', true, '', 'invalid_request_error', 'streaming_not_supported');
  }

  try {
    // Initialize gateway service if not already done
    if (!gatewayService.isInitialized()) {
      await gatewayService.initialize();
    }

    // Prepare request parameters
    const requestParams = {
      model,
      messages,
      options: {
        max_tokens,
        temperature,
        ...otherOptions
      },
      requestMeta: {
        requestId,
        apiKeyId: req.apiKey._id,
        userAgent: req.get('User-Agent'),
        clientIp: req.ip
      }
    };

    // Handle chat completion
    const response = await gatewayService.handleChatCompletion(requestParams);

    // Update API key usage
    if (response.usage && response.usage.total_tokens) {
      await req.apiKey.updateUsage(response.usage.total_tokens);
    }

    // Log successful request
    logger.info('Chat completion request completed', {
      requestId,
      model,
      apiKeyId: req.apiKey._id,
      tokensUsed: response.usage?.total_tokens || 0,
      duration: Date.now() - req.startTime
    });

    res.json(response);

  } catch (error) {
    // Log error
    logger.error('Chat completion request failed', {
      requestId,
      model,
      apiKeyId: req.apiKey._id,
      error: error.message,
      stack: error.stack
    });

    // Re-throw the error to be handled by error middleware
    throw error;
  }
});

/**
 * Get available models
 * GET /v1/models
 */
const getModels = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');

  try {
    // Initialize gateway service if not already done
    if (!gatewayService.isInitialized()) {
      await gatewayService.initialize();
    }

    // Get available models
    const modelsResponse = await gatewayService.getAvailableModels();

    // Log successful request
    logger.info('Models list request completed', {
      requestId,
      apiKeyId: req.apiKey._id,
      modelCount: modelsResponse.data.length,
      duration: Date.now() - req.startTime
    });

    res.json(modelsResponse);

  } catch (error) {
    // Log error
    logger.error('Models list request failed', {
      requestId,
      apiKeyId: req.apiKey._id,
      error: error.message,
      stack: error.stack
    });

    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve models', 'internal_error', 'internal_server_error');
  }
});

/**
 * Handle embeddings
 * POST /v1/embeddings
 */
const embeddings = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { model, input, encoding_format, ...otherOptions } = req.body;

  // Basic validation
  if (!model || !input) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Missing required fields: model and input', true, '', 'invalid_request_error', 'invalid_request');
  }

  // Validate input format
  if (typeof input !== 'string' && !Array.isArray(input)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Input must be a string or array of strings', true, '', 'invalid_request_error', 'invalid_request');
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item !== 'string') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'All input items must be strings', true, '', 'invalid_request_error', 'invalid_request');
      }
    }
  }

  // Check if API key can access this model
  if (!req.apiKey.canAccessModel(model)) {
    throw new ApiError(httpStatus.FORBIDDEN, `Access denied for model: ${model}`, true, '', 'permission_error', 'model_access_denied');
  }

  try {
    // Initialize gateway service if not already done
    if (!gatewayService.isInitialized()) {
      await gatewayService.initialize();
    }

    // Prepare request parameters
    const requestParams = {
      model,
      input,
      options: {
        encoding_format,
        ...otherOptions
      },
      requestMeta: {
        requestId,
        apiKeyId: req.apiKey._id,
        userAgent: req.get('User-Agent'),
        clientIp: req.ip
      }
    };

    // Handle embeddings
    const response = await gatewayService.handleEmbeddings(requestParams);

    // Update API key usage
    if (response.usage && response.usage.total_tokens) {
      await req.apiKey.updateUsage(response.usage.total_tokens);
    }

    // Log successful request
    logger.info('Embeddings request completed', {
      requestId,
      model,
      apiKeyId: req.apiKey._id,
      inputCount: Array.isArray(input) ? input.length : 1,
      tokensUsed: response.usage?.total_tokens || 0,
      duration: Date.now() - req.startTime
    });

    res.json(response);

  } catch (error) {
    // Log error
    logger.error('Embeddings request failed', {
      requestId,
      model,
      apiKeyId: req.apiKey._id,
      error: error.message,
      stack: error.stack
    });

    // Re-throw the error to be handled by error middleware
    throw error;
  }
});

module.exports = {
  chatCompletions,
  getModels,
  embeddings,
};