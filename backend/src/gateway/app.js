/**
 * Dyad CLI Gateway - Express Application
 * Main Express app configuration for the gateway service
 */

const express = require('express');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const cors = require('cors');
const passport = require('passport');
const httpStatus = require('http-status');
const crypto = require('crypto');

const gatewayConfig = require('./config/gateway.config');
const securityConfig = require('./config/security.config');
const { v1Routes, adminRoutes, metricsRoutes } = require('./routes');
const { errorConverter, errorHandler } = require('./middlewares');
const { correlationId, requestTracking, errorTracking } = require('./middlewares/monitoring.middleware');
const { 
  inputSanitization,
  advancedRateLimit,
  progressiveSlowdown,
  ddosProtection,
  securityHeaders,
  httpsEnforcement,
  requestSizeValidation,
  userAgentValidation
} = require('./middlewares/security');
const { jwtStrategy } = require('../config/passport');
const ApiError = require('../utils/ApiError');

const app = express();

// Trust proxy for accurate client IP in logs
app.set('trust proxy', 1);

// Generate request ID for all requests
app.use((req, res, next) => {
  req.requestId = `req_${crypto.randomBytes(8).toString('hex')}`;
  next();
});

// Add correlation ID and request tracking
app.use(correlationId);
app.use(requestTracking);

// JWT authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// Enhanced security middleware stack
app.use(httpsEnforcement);
app.use(securityHeaders);
app.use(userAgentValidation);
app.use(requestSizeValidation);
app.use(ddosProtection);
app.use(progressiveSlowdown);
app.use(advancedRateLimit);
app.use(inputSanitization);

// CORS configuration
app.use(cors({
  origin: gatewayConfig.security.corsOrigin,
  credentials: true,
}));

// Parse JSON bodies with security limits
app.use(express.json({ 
  limit: securityConfig.validation.maxRequestSize,
  strict: true,
  type: ['application/json', 'application/*+json']
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: securityConfig.validation.maxRequestSize,
  parameterLimit: 100
}));

// Enhanced sanitization
app.use(xss());
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized key: ${key} in request ${req.requestId}`);
  }
}));

// Gzip compression
app.use(compression());

// Health check endpoint (no authentication required)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'dyad-cli-gateway',
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Readiness check endpoint (checks dependencies)
app.get('/ready', async (req, res) => {
  try {
    // TODO: Add database connectivity check when needed
    // For now, just return ready status
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok', // Will be implemented when database is connected
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Mount metrics routes (no authentication required for Prometheus scraping)
app.use('/metrics', metricsRoutes);

// Mount API routes
app.use(gatewayConfig.apiPrefix, v1Routes);

// Mount admin routes
app.use(gatewayConfig.adminPrefix, adminRoutes);

// Handle 404 errors for unknown routes
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Route not found', true, '', 'invalid_request_error', 'not_found'));
});

// Convert errors to ApiError instances
app.use(errorConverter);

// Track errors in monitoring
app.use(errorTracking);

// Handle errors
app.use(errorHandler);

module.exports = app;