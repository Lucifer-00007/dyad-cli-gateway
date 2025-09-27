const rateLimit = require('express-rate-limit');
const { ApiKey } = require('../../models');
const logger = require('../../config/logger');

/**
 * Custom rate limiting store that uses API key usage tracking
 */
class ApiKeyRateLimitStore {
  constructor() {
    this.name = 'ApiKeyRateLimitStore';
  }

  async increment(key) {
    // Key format: "apikey:{keyId}"
    const keyId = key.replace('apikey:', '');
    
    try {
      const apiKeyDoc = await ApiKey.findById(keyId);
      if (!apiKeyDoc) {
        return { totalHits: 1, resetTime: new Date(Date.now() + 60000) };
      }

      // Use the existing rate limit check
      const rateLimitCheck = apiKeyDoc.checkRateLimit();
      
      return {
        totalHits: apiKeyDoc.usageStats.requestsToday,
        resetTime: rateLimitCheck.resetTime || new Date(Date.now() + 60000)
      };
    } catch (error) {
      logger.error('Rate limit store error', { error: error.message, keyId });
      return { totalHits: 1, resetTime: new Date(Date.now() + 60000) };
    }
  }

  async decrement(key) {
    // Not implemented as we don't need to decrement API key usage
    return;
  }

  async resetKey(key) {
    // Not implemented as API key usage resets are handled by the model
    return;
  }

  async resetAll() {
    // Not implemented as API key usage resets are handled by the model
    return;
  }
}

/**
 * Rate limiting middleware for gateway endpoints
 * Uses per-minute rate limiting as a safety net on top of API key limits
 */
const gatewayRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Default limit per minute per IP
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later',
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use API key ID if authenticated, otherwise fall back to IP
    if (req.apiKey) {
      return `apikey:${req.apiKey.id}`;
    }
    return req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/healthz' || req.path === '/ready';
  },
  onLimitReached: (req, res, options) => {
    logger.warn('Gateway rate limit exceeded', {
      ip: req.ip,
      keyId: req.apiKey?.id,
      keyName: req.apiKey?.name,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      limit: options.max,
      windowMs: options.windowMs
    });
  }
});

/**
 * API key specific rate limiting middleware
 * This enforces the per-API-key rate limits defined in the API key model
 */
const apiKeyRateLimit = async (req, res, next) => {
  // Only apply to authenticated requests
  if (!req.apiKey) {
    return next();
  }

  try {
    const rateLimitCheck = req.apiKey.checkRateLimit();
    
    if (!rateLimitCheck.allowed) {
      // Set rate limit headers
      if (rateLimitCheck.resetTime) {
        res.set('X-RateLimit-Reset', Math.ceil(rateLimitCheck.resetTime.getTime() / 1000));
      }
      res.set('X-RateLimit-Limit-Requests', req.apiKey.rateLimits.requestsPerDay.toString());
      res.set('X-RateLimit-Remaining-Requests', Math.max(0, req.apiKey.rateLimits.requestsPerDay - req.apiKey.usageStats.requestsToday).toString());
      res.set('X-RateLimit-Limit-Tokens', req.apiKey.rateLimits.tokensPerDay.toString());
      res.set('X-RateLimit-Remaining-Tokens', Math.max(0, req.apiKey.rateLimits.tokensPerDay - req.apiKey.usageStats.tokensToday).toString());

      logger.warn('API key rate limit exceeded', {
        keyId: req.apiKey.id,
        keyName: req.apiKey.name,
        reason: rateLimitCheck.reason,
        resetTime: rateLimitCheck.resetTime,
        ip: req.ip,
        path: req.path,
        method: req.method
      });

      return res.status(429).json({
        error: {
          message: rateLimitCheck.reason,
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded'
        }
      });
    }

    // Set current usage headers
    res.set('X-RateLimit-Limit-Requests', req.apiKey.rateLimits.requestsPerDay.toString());
    res.set('X-RateLimit-Remaining-Requests', Math.max(0, req.apiKey.rateLimits.requestsPerDay - req.apiKey.usageStats.requestsToday).toString());
    res.set('X-RateLimit-Limit-Tokens', req.apiKey.rateLimits.tokensPerDay.toString());
    res.set('X-RateLimit-Remaining-Tokens', Math.max(0, req.apiKey.rateLimits.tokensPerDay - req.apiKey.usageStats.tokensToday).toString());

    next();
  } catch (error) {
    logger.error('API key rate limit check error', {
      error: error.message,
      keyId: req.apiKey?.id,
      path: req.path,
      method: req.method
    });
    next(); // Continue on error to avoid blocking requests
  }
};

module.exports = {
  gatewayRateLimit,
  apiKeyRateLimit,
  ApiKeyRateLimitStore
};