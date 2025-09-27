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
    
    // Map status codes to OpenAI error types and codes
    let type, code;
    switch (statusCode) {
      case httpStatus.NOT_FOUND:
        type = 'invalid_request_error';
        code = 'not_found';
        break;
      case httpStatus.BAD_REQUEST:
        type = 'invalid_request_error';
        code = 'invalid_request';
        break;
      case httpStatus.UNAUTHORIZED:
        type = 'authentication_error';
        code = 'invalid_api_key';
        break;
      case httpStatus.FORBIDDEN:
        type = 'permission_error';
        code = 'forbidden';
        break;
      case httpStatus.TOO_MANY_REQUESTS:
        type = 'rate_limit_error';
        code = 'rate_limit_exceeded';
        break;
      case httpStatus.GATEWAY_TIMEOUT:
        type = 'internal_error';
        code = 'adapter_timeout';
        break;
      default:
        type = 'internal_error';
        code = 'internal_server_error';
    }
    
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
  const requestId = req.requestId || `req_${crypto.randomBytes(8).toString('hex')}`;

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