/**
 * OpenAI-compatible error handler for gateway routes
 */

const httpStatus = require('http-status');
const config = require('../../config/config');
const logger = require('../../config/logger');
const ApiError = require('../../utils/ApiError');
const crypto = require('crypto');

/**
 * Convert errors to OpenAI-compatible format
 */
const errorConverter = (err, req, res, next) => {
  let error = err;
  
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || httpStatus[statusCode];
    
    // Default error type and code for non-ApiError instances
    const type = 'internal_error';
    const code = 'internal_server_error';
    
    error = new ApiError(statusCode, message, false, err.stack, type, code);
  }
  
  next(error);
};

/**
 * Handle errors with OpenAI-compatible response format
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode, message, type, code } = err;
  
  // In production, don't expose internal error details
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = 'Internal server error';
    type = 'internal_error';
    code = 'internal_server_error';
  }

  // Generate request ID if not available
  const requestId = req.requestId || crypto.randomBytes(8).toString('hex');

  // OpenAI-compatible error response format
  const response = {
    error: {
      message,
      type: type || 'internal_error',
      code: code || 'internal_server_error',
      ...(requestId && { request_id: requestId })
    }
  };

  // Add stack trace in development
  if (config.env === 'development') {
    response.error.stack = err.stack;
  }

  // Log error
  logger.error('Gateway error', {
    requestId,
    statusCode,
    message,
    type,
    code,
    path: req.path,
    method: req.method,
    apiKeyId: req.apiKey?._id,
    userAgent: req.get('User-Agent'),
    ...(config.env === 'development' && { stack: err.stack })
  });

  res.status(statusCode).json(response);
};

module.exports = {
  errorConverter,
  errorHandler,
};