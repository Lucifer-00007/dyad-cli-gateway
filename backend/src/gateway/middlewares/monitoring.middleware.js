/**
 * Monitoring Middleware - Request tracking and metrics collection
 * Integrates Prometheus metrics and structured logging for all requests
 */

const monitoringService = require('../services/monitoring.service');
const structuredLogger = require('../services/structured-logger.service');

/**
 * Middleware to track HTTP requests with metrics and structured logging
 */
const requestTracking = (req, res, next) => {
  const startTime = Date.now();
  
  // Generate correlation ID if not already present
  if (!req.correlationId) {
    req.correlationId = structuredLogger.generateCorrelationId();
  }

  // Create child logger for this request
  req.logger = structuredLogger.createChildLogger(req.correlationId, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  // Log request start
  req.logger.info('HTTP request started', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
  });

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    
    // Extract provider and model from request context
    const provider = req.provider || 'unknown';
    const model = req.model || 'unknown';
    
    // Determine route pattern for metrics
    const route = getRoutePattern(req.path);
    
    // Record metrics
    monitoringService.recordHttpRequest(
      req.method,
      route,
      res.statusCode,
      duration,
      provider,
      model
    );

    // Log request completion
    structuredLogger.logHttpRequest(req, res, duration, req.correlationId);

    // Record API key usage if available
    if (req.apiKeyId) {
      const status = res.statusCode >= 400 ? 'error' : 'success';
      monitoringService.recordApiKeyRequest(req.apiKeyId, status);
    }

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Middleware to track adapter executions
 */
const adapterTracking = (adapterType) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Store adapter start time for later use
    req.adapterStartTime = startTime;
    req.adapterType = adapterType;

    // Override adapter completion tracking
    req.recordAdapterCompletion = (provider, model, status, meta = {}) => {
      const duration = (Date.now() - startTime) / 1000;
      
      // Record metrics
      monitoringService.recordAdapterRequest(adapterType, provider, model, status, duration);
      
      // Log adapter execution
      structuredLogger.logAdapterExecution(
        adapterType,
        provider,
        model,
        status,
        duration,
        req.correlationId,
        meta
      );
    };

    next();
  };
};

/**
 * Middleware to track streaming connections
 */
const streamingTracking = (req, res, next) => {
  if (req.body && req.body.stream) {
    const provider = req.provider || 'unknown';
    const model = req.body.model || 'unknown';
    
    // Track streaming connection start
    monitoringService.recordStreamingConnection(provider, model, 1);
    
    req.logger.info('Streaming connection started', { provider, model });
    
    // Track when connection ends
    req.on('close', () => {
      monitoringService.recordStreamingConnection(provider, model, -1);
      req.logger.info('Streaming connection ended', { provider, model });
    });

    // Helper function to track streaming chunks
    req.recordStreamingChunk = () => {
      monitoringService.recordStreamingChunk(provider, model);
    };
  }
  
  next();
};

/**
 * Middleware to track errors
 */
const errorTracking = (err, req, res, next) => {
  // Record error metrics
  const errorType = err.name || 'UnknownError';
  const errorCode = err.code || 'unknown';
  const provider = req.provider || 'unknown';
  const adapterType = req.adapterType || 'unknown';
  
  monitoringService.recordError(errorType, errorCode, provider, adapterType);
  
  // Log error with correlation ID
  if (req.logger) {
    req.logger.error('Request error occurred', err, {
      errorType,
      errorCode,
      provider,
      adapterType,
    });
  }
  
  next(err);
};

/**
 * Middleware to track rate limiting
 */
const rateLimitTracking = (limitType) => {
  return (req, res, next) => {
    // This middleware should be used after rate limiting middleware
    // to track when rate limits are hit
    
    const originalStatus = res.status;
    res.status = function(code) {
      if (code === 429 && req.apiKeyId) {
        // Rate limit hit
        monitoringService.recordRateLimitHit(req.apiKeyId, limitType);
        structuredLogger.logRateLimitEvent(req.apiKeyId, limitType, req.correlationId);
      }
      return originalStatus.call(this, code);
    };
    
    next();
  };
};

/**
 * Helper function to extract route pattern from path
 */
function getRoutePattern(path) {
  // Convert dynamic routes to patterns for better metric grouping
  return path
    .replace(/\/[0-9a-f]{24}/g, '/:id') // MongoDB ObjectIds
    .replace(/\/[0-9]+/g, '/:id') // Numeric IDs
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // UUIDs
    .replace(/\/[a-zA-Z0-9_-]{8,}/g, '/:param'); // Other parameters
}

/**
 * Middleware to add correlation ID to all requests
 */
const correlationId = (req, res, next) => {
  // Use existing request ID or generate new correlation ID
  req.correlationId = req.requestId || structuredLogger.generateCorrelationId();
  
  // Add correlation ID to response headers for client tracking
  res.set('X-Correlation-ID', req.correlationId);
  
  next();
};

module.exports = {
  requestTracking,
  adapterTracking,
  streamingTracking,
  errorTracking,
  rateLimitTracking,
  correlationId,
};