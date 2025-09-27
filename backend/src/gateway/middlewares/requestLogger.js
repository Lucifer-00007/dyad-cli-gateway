const logger = require('../../config/logger');

// Use crypto.randomUUID if available (Node 14.17+), otherwise use a simple fallback
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Simple fallback for older Node versions
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Request logging middleware for gateway endpoints
 * Logs request details with authenticated user context
 */
const requestLogger = (req, res, next) => {
  // Generate unique request ID if not present
  const requestId = req.get('X-Request-ID') || generateUUID();
  req.id = requestId;
  res.set('X-Request-ID', requestId);

  const startTime = Date.now();
  
  // Log incoming request
  const requestLog = {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    timestamp: new Date().toISOString(),
  };

  // Add authentication context if available
  if (req.apiKey) {
    requestLog.auth = {
      keyId: req.apiKey.id,
      keyName: req.apiKey.name,
      userId: req.apiKey.userId,
      permissions: req.apiKey.permissions,
    };
  }

  // Log request body for specific endpoints (excluding sensitive data)
  if (req.path.includes('/chat/completions') || req.path.includes('/embeddings')) {
    requestLog.requestBody = {
      model: req.body?.model,
      messagesCount: req.body?.messages?.length,
      maxTokens: req.body?.max_tokens,
      temperature: req.body?.temperature,
      stream: req.body?.stream,
      // Don't log actual message content for privacy
    };
  }

  logger.info('Gateway request received', requestLog);

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    const responseLog = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      timestamp: new Date().toISOString(),
    };

    // Add authentication context if available
    if (req.apiKey) {
      responseLog.auth = {
        keyId: req.apiKey.id,
        keyName: req.apiKey.name,
        userId: req.apiKey.userId,
      };
    }

    // Log different levels based on status code
    if (res.statusCode >= 500) {
      logger.error('Gateway request completed with server error', responseLog);
    } else if (res.statusCode >= 400) {
      logger.warn('Gateway request completed with client error', responseLog);
    } else {
      logger.info('Gateway request completed successfully', responseLog);
    }

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = requestLogger;