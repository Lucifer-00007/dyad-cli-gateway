const httpStatus = require('http-status');
const ApiError = require('../../utils/ApiError');
const { ApiKey } = require('../../models');
const logger = require('../../config/logger');

/**
 * API Key Authentication Middleware for Gateway /v1 endpoints
 * Validates Bearer token format and checks against API key database
 */
const apiKeyAuth = (requiredPermissions = []) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.get('Authorization');
      
      // Check if Authorization header exists and has Bearer format
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('API key authentication failed: Missing or invalid Authorization header', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method
        });
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authorization header with Bearer token required', true, '', 'authentication_error', 'missing_authorization'));
      }

      // Extract the API key from Bearer token
      const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      if (!apiKey) {
        logger.warn('API key authentication failed: Empty API key', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method
        });
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'API key required', true, '', 'authentication_error', 'missing_api_key'));
      }

      // Find and validate the API key
      const apiKeyDoc = await ApiKey.findByKey(apiKey);
      
      if (!apiKeyDoc) {
        logger.warn('API key authentication failed: Invalid API key', {
          keyPrefix: apiKey.substring(0, 8),
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method
        });
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'Invalid API key', true, '', 'authentication_error', 'invalid_api_key'));
      }

      // Check if API key is enabled
      if (!apiKeyDoc.enabled) {
        logger.warn('API key authentication failed: Disabled API key', {
          keyId: apiKeyDoc.id,
          keyName: apiKeyDoc.name,
          ip: req.ip,
          path: req.path,
          method: req.method
        });
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'API key is disabled', true, '', 'authentication_error', 'disabled_api_key'));
      }

      // Check if API key is expired
      if (apiKeyDoc.isExpired()) {
        logger.warn('API key authentication failed: Expired API key', {
          keyId: apiKeyDoc.id,
          keyName: apiKeyDoc.name,
          expiresAt: apiKeyDoc.expiresAt,
          ip: req.ip,
          path: req.path,
          method: req.method
        });
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'API key has expired', true, '', 'authentication_error', 'expired_api_key'));
      }

      // Check required permissions
      if (requiredPermissions.length > 0) {
        const hasAllPermissions = requiredPermissions.every(permission => 
          apiKeyDoc.hasPermission(permission)
        );
        
        if (!hasAllPermissions) {
          logger.warn('API key authentication failed: Insufficient permissions', {
            keyId: apiKeyDoc.id,
            keyName: apiKeyDoc.name,
            requiredPermissions,
            keyPermissions: apiKeyDoc.permissions,
            ip: req.ip,
            path: req.path,
            method: req.method
          });
          return next(new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions', true, '', 'permission_error', 'insufficient_permissions'));
        }
      }

      // Check rate limits
      const rateLimitCheck = apiKeyDoc.checkRateLimit();
      if (!rateLimitCheck.allowed) {
        logger.warn('API key rate limit exceeded', {
          keyId: apiKeyDoc.id,
          keyName: apiKeyDoc.name,
          reason: rateLimitCheck.reason,
          resetTime: rateLimitCheck.resetTime,
          ip: req.ip,
          path: req.path,
          method: req.method
        });
        
        // Set rate limit headers
        if (rateLimitCheck.resetTime) {
          res.set('X-RateLimit-Reset', Math.ceil(rateLimitCheck.resetTime.getTime() / 1000));
        }
        res.set('X-RateLimit-Limit-Requests', apiKeyDoc.rateLimits.requestsPerDay.toString());
        res.set('X-RateLimit-Remaining-Requests', Math.max(0, apiKeyDoc.rateLimits.requestsPerDay - apiKeyDoc.usageStats.requestsToday).toString());
        
        return next(new ApiError(httpStatus.TOO_MANY_REQUESTS, rateLimitCheck.reason, true, '', 'rate_limit_error', 'rate_limit_exceeded'));
      }

      // Attach API key to request for use in controllers
      req.apiKey = apiKeyDoc;
      req.user = { id: apiKeyDoc.userId }; // For compatibility with existing middleware

      // Log successful authentication
      logger.info('API key authenticated successfully', {
        keyId: apiKeyDoc.id,
        keyName: apiKeyDoc.name,
        userId: apiKeyDoc.userId,
        permissions: apiKeyDoc.permissions,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        requestId: req.id || req.get('X-Request-ID')
      });

      next();
    } catch (error) {
      logger.error('API key authentication error', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Authentication service error', true, '', 'internal_error', 'authentication_service_error'));
    }
  };
};

module.exports = apiKeyAuth;