/**
 * Structured Logger Service - Enhanced logging with correlation IDs
 * Provides structured logging for the Dyad CLI Gateway with correlation tracking
 */

const winston = require('winston');
const crypto = require('crypto');

class StructuredLoggerService {
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            service: 'dyad-cli-gateway',
            ...meta,
          });
        })
      ),
      defaultMeta: {
        service: 'dyad-cli-gateway',
        version: process.env.npm_package_version || '1.0.0',
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });

    // Add file transport for production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(new winston.transports.File({
        filename: 'logs/gateway-error.log',
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }));

      this.logger.add(new winston.transports.File({
        filename: 'logs/gateway-combined.log',
        maxsize: 10485760, // 10MB
        maxFiles: 10,
      }));
    }
  }

  // Generate correlation ID
  generateCorrelationId() {
    return `corr_${crypto.randomBytes(8).toString('hex')}`;
  }

  // Create child logger with correlation context
  createChildLogger(correlationId, context = {}) {
    return {
      correlationId,
      context,
      
      info: (message, meta = {}) => {
        this.logger.info(message, {
          correlationId,
          ...context,
          ...meta,
        });
      },

      warn: (message, meta = {}) => {
        this.logger.warn(message, {
          correlationId,
          ...context,
          ...meta,
        });
      },

      error: (message, error = null, meta = {}) => {
        const errorMeta = error ? {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
        } : {};

        this.logger.error(message, {
          correlationId,
          ...context,
          ...errorMeta,
          ...meta,
        });
      },

      debug: (message, meta = {}) => {
        this.logger.debug(message, {
          correlationId,
          ...context,
          ...meta,
        });
      },
    };
  }

  // Log HTTP request
  logHttpRequest(req, res, duration, correlationId) {
    const requestLog = {
      correlationId,
      type: 'http_request',
      method: req.method,
      url: req.url,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      apiKeyId: req.apiKeyId || 'anonymous',
      requestSize: req.get('Content-Length') || 0,
      responseSize: res.get('Content-Length') || 0,
    };

    // Add provider and model info if available
    if (req.provider) {
      requestLog.provider = req.provider;
    }
    if (req.model) {
      requestLog.model = req.model;
    }

    this.logger.info('HTTP request completed', requestLog);
  }

  // Log adapter execution
  logAdapterExecution(adapterType, provider, model, status, duration, correlationId, meta = {}) {
    this.logger.info('Adapter execution completed', {
      correlationId,
      type: 'adapter_execution',
      adapterType,
      provider,
      model,
      status,
      duration,
      ...meta,
    });
  }

  // Log circuit breaker events
  logCircuitBreakerEvent(provider, adapterType, event, correlationId, meta = {}) {
    this.logger.warn('Circuit breaker event', {
      correlationId,
      type: 'circuit_breaker_event',
      provider,
      adapterType,
      event, // opened, closed, half_open, failure
      ...meta,
    });
  }

  // Log provider health check
  logProviderHealthCheck(provider, adapterType, isHealthy, duration, correlationId, error = null) {
    const level = isHealthy ? 'info' : 'warn';
    const message = `Provider health check ${isHealthy ? 'passed' : 'failed'}`;
    
    const logData = {
      correlationId,
      type: 'provider_health_check',
      provider,
      adapterType,
      isHealthy,
      duration,
    };

    if (error) {
      logData.error = {
        message: error.message,
        stack: error.stack,
      };
    }

    this.logger[level](message, logData);
  }

  // Log authentication events
  logAuthEvent(event, apiKeyId, correlationId, meta = {}) {
    this.logger.info('Authentication event', {
      correlationId,
      type: 'auth_event',
      event, // success, failure, rate_limit
      apiKeyId,
      ...meta,
    });
  }

  // Log rate limiting events
  logRateLimitEvent(apiKeyId, limitType, correlationId, meta = {}) {
    this.logger.warn('Rate limit exceeded', {
      correlationId,
      type: 'rate_limit_event',
      apiKeyId,
      limitType, // requests, tokens
      ...meta,
    });
  }

  // Log streaming events
  logStreamingEvent(event, provider, model, correlationId, meta = {}) {
    this.logger.info('Streaming event', {
      correlationId,
      type: 'streaming_event',
      event, // started, chunk_sent, completed, error, cancelled
      provider,
      model,
      ...meta,
    });
  }

  // Log sandbox execution
  logSandboxExecution(provider, command, status, duration, correlationId, meta = {}) {
    // Sanitize command for logging (remove sensitive data)
    const sanitizedCommand = this.sanitizeCommand(command);
    
    this.logger.info('Sandbox execution completed', {
      correlationId,
      type: 'sandbox_execution',
      provider,
      command: sanitizedCommand,
      status, // success, timeout, error, cancelled
      duration,
      ...meta,
    });
  }

  // Log admin actions
  logAdminAction(action, userId, resource, correlationId, meta = {}) {
    this.logger.info('Admin action performed', {
      correlationId,
      type: 'admin_action',
      action, // create, update, delete, test
      userId,
      resource, // provider, api_key
      ...meta,
    });
  }

  // Log security events
  logSecurityEvent(event, correlationId, meta = {}) {
    this.logger.warn('Security event', {
      correlationId,
      type: 'security_event',
      event, // invalid_api_key, suspicious_activity, injection_attempt
      ...meta,
    });
  }

  // Sanitize sensitive data from logs
  sanitizeCommand(command) {
    if (typeof command === 'string') {
      // Remove potential API keys, tokens, passwords
      return command
        .replace(/((?:api[_-]?key|token|password|secret)[=:])\s*[^\s]+/gi, '$1***')
        .replace(/(Bearer\s+)[^\s"]+/gi, '$1***')
        .replace(/[a-zA-Z0-9]{32,}/g, '***'); // Replace long alphanumeric strings
    }
    return command;
  }

  // Get base logger for direct use
  getLogger() {
    return this.logger;
  }
}

// Create singleton instance
const structuredLogger = new StructuredLoggerService();

module.exports = structuredLogger;