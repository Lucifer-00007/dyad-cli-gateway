/**
 * Advanced Security Middleware
 * Comprehensive security hardening for the gateway
 */

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const validator = require('validator');
const Joi = require('joi');
const logger = require('../../config/logger');
const gatewayConfig = require('../config/gateway.config');

/**
 * Enhanced input sanitization middleware
 * Validates and sanitizes all incoming request data
 */
const inputSanitization = (req, res, next) => {
  try {
    // Sanitize query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          // Remove potentially dangerous characters
          req.query[key] = validator.escape(value);
          
          // Check for SQL injection patterns
          if (containsSqlInjection(value)) {
            logger.warn('Potential SQL injection attempt detected', {
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              query: key,
              value: value.substring(0, 100), // Log first 100 chars only
              requestId: req.requestId
            });
            return res.status(400).json({
              error: {
                message: 'Invalid input detected',
                type: 'invalid_request_error',
                code: 'invalid_input'
              }
            });
          }
        }
      }
    }

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body, req);
    }

    // Validate content length
    const contentLength = parseInt(req.get('content-length') || '0', 10);
    if (contentLength > 50 * 1024 * 1024) { // 50MB limit
      logger.warn('Request exceeds maximum content length', {
        ip: req.ip,
        contentLength,
        requestId: req.requestId
      });
      return res.status(413).json({
        error: {
          message: 'Request entity too large',
          type: 'invalid_request_error',
          code: 'request_too_large'
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Input sanitization error', {
      error: error.message,
      requestId: req.requestId,
      ip: req.ip
    });
    return res.status(400).json({
      error: {
        message: 'Invalid input format',
        type: 'invalid_request_error',
        code: 'invalid_input'
      }
    });
  }
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj, req, depth = 0) {
  if (depth > 10) { // Prevent deep recursion attacks
    throw new Error('Object nesting too deep');
  }

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Sanitize string values
      obj[key] = validator.escape(value);
      
      // Check for injection attempts
      if (containsSqlInjection(value) || containsXssAttempt(value)) {
        logger.warn('Potential injection attempt detected', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          field: key,
          value: value.substring(0, 100),
          requestId: req.requestId
        });
        throw new Error('Invalid input detected');
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitizeObject(value, req, depth + 1);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string') {
          value[index] = validator.escape(item);
        } else if (typeof item === 'object' && item !== null) {
          sanitizeObject(item, req, depth + 1);
        }
      });
    }
  }
}

/**
 * Check for SQL injection patterns
 */
function containsSqlInjection(input) {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(--|\/\*|\*\/|;)/,
    /(\b(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS)\b)/i,
    /(CAST\s*\(|CONVERT\s*\()/i
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Check for XSS attempt patterns
 */
function containsXssAttempt(input) {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /<link\b/i,
    /<meta\b/i
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Advanced rate limiting with progressive delays
 */
const advancedRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Base limit per window
  message: {
    error: {
      message: 'Too many requests, please try again later',
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use API key if available, otherwise IP
    return req.apiKey ? `key:${req.apiKey.id}` : `ip:${req.ip}`;
  },
  skip: (req) => {
    // Skip for health checks and metrics
    return req.path === '/healthz' || req.path === '/ready' || req.path.startsWith('/metrics');
  },
  onLimitReached: (req, res, options) => {
    logger.warn('Advanced rate limit exceeded', {
      ip: req.ip,
      keyId: req.apiKey?.id,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId
    });
  }
});

/**
 * Progressive slowdown middleware
 * Slows down requests as they approach rate limits
 */
const progressiveSlowdown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 500, // Allow 500 requests per window at full speed
  delayMs: 100, // Add 100ms delay per request after delayAfter
  maxDelayMs: 5000, // Maximum delay of 5 seconds
  keyGenerator: (req) => {
    return req.apiKey ? `key:${req.apiKey.id}` : `ip:${req.ip}`;
  },
  skip: (req) => {
    return req.path === '/healthz' || req.path === '/ready' || req.path.startsWith('/metrics');
  },
  onLimitReached: (req, res, options) => {
    logger.info('Progressive slowdown activated', {
      ip: req.ip,
      keyId: req.apiKey?.id,
      delay: options.delay,
      requestId: req.requestId
    });
  }
});

/**
 * DDoS protection middleware
 * Detects and blocks potential DDoS attacks
 */
const ddosProtection = (() => {
  const suspiciousIPs = new Map();
  const blockedIPs = new Set();
  
  return (req, res, next) => {
    const clientIP = req.ip;
    const now = Date.now();
    
    // Check if IP is blocked
    if (blockedIPs.has(clientIP)) {
      logger.warn('Blocked IP attempted access', {
        ip: clientIP,
        path: req.path,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId
      });
      return res.status(429).json({
        error: {
          message: 'Access temporarily blocked due to suspicious activity',
          type: 'rate_limit_error',
          code: 'ip_blocked'
        }
      });
    }
    
    // Track request patterns
    if (!suspiciousIPs.has(clientIP)) {
      suspiciousIPs.set(clientIP, {
        requests: [],
        firstSeen: now,
        patterns: {
          rapidRequests: 0,
          errorRequests: 0,
          uniquePaths: new Set()
        }
      });
    }
    
    const ipData = suspiciousIPs.get(clientIP);
    ipData.requests.push(now);
    ipData.patterns.uniquePaths.add(req.path);
    
    // Clean old requests (older than 1 minute)
    ipData.requests = ipData.requests.filter(time => now - time < 60000);
    
    // Check for suspicious patterns
    const recentRequests = ipData.requests.length;
    const timeSpan = now - ipData.firstSeen;
    
    // Pattern 1: Too many requests in short time
    if (recentRequests > 100) { // More than 100 requests per minute
      ipData.patterns.rapidRequests++;
    }
    
    // Pattern 2: Scanning behavior (many different paths)
    if (ipData.patterns.uniquePaths.size > 50 && recentRequests > 20) {
      logger.warn('Potential scanning behavior detected', {
        ip: clientIP,
        uniquePaths: ipData.patterns.uniquePaths.size,
        requests: recentRequests,
        requestId: req.requestId
      });
      
      // Block IP for 1 hour
      blockedIPs.add(clientIP);
      setTimeout(() => blockedIPs.delete(clientIP), 60 * 60 * 1000);
      
      return res.status(429).json({
        error: {
          message: 'Suspicious activity detected, access blocked',
          type: 'rate_limit_error',
          code: 'suspicious_activity'
        }
      });
    }
    
    // Clean up old entries
    if (suspiciousIPs.size > 10000) {
      const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours
      for (const [ip, data] of suspiciousIPs.entries()) {
        if (data.firstSeen < cutoff) {
          suspiciousIPs.delete(ip);
        }
      }
    }
    
    next();
  };
})();

/**
 * Enhanced security headers configuration
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "no-referrer" },
  xssFilter: true,
});

/**
 * HTTPS enforcement middleware
 */
const httpsEnforcement = (req, res, next) => {
  // Skip in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  // Check if request is secure
  if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
    logger.warn('Insecure HTTP request blocked', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId
    });
    
    return res.status(426).json({
      error: {
        message: 'HTTPS required',
        type: 'invalid_request_error',
        code: 'https_required'
      }
    });
  }
  
  next();
};

/**
 * Request size validation middleware
 */
const requestSizeValidation = (req, res, next) => {
  const contentLength = parseInt(req.get('content-length') || '0', 10);
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > maxSize) {
    logger.warn('Request size limit exceeded', {
      ip: req.ip,
      contentLength,
      maxSize,
      requestId: req.requestId
    });
    
    return res.status(413).json({
      error: {
        message: 'Request entity too large',
        type: 'invalid_request_error',
        code: 'request_too_large'
      }
    });
  }
  
  next();
};

/**
 * Suspicious user agent detection
 */
const userAgentValidation = (req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  
  // Block known malicious user agents
  const maliciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /masscan/i,
    /nmap/i,
    /gobuster/i,
    /dirb/i,
    /dirbuster/i,
    /burpsuite/i,
    /owasp/i
  ];
  
  if (maliciousPatterns.some(pattern => pattern.test(userAgent))) {
    logger.warn('Malicious user agent detected', {
      ip: req.ip,
      userAgent,
      path: req.path,
      requestId: req.requestId
    });
    
    return res.status(403).json({
      error: {
        message: 'Access denied',
        type: 'permission_error',
        code: 'forbidden'
      }
    });
  }
  
  next();
};

module.exports = {
  inputSanitization,
  advancedRateLimit,
  progressiveSlowdown,
  ddosProtection,
  securityHeaders,
  httpsEnforcement,
  requestSizeValidation,
  userAgentValidation
};