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
const { v1Routes, adminRoutes } = require('./routes');
const { errorConverter, errorHandler } = require('./middlewares');
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

// JWT authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: gatewayConfig.security.corsOrigin,
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize request data
app.use(xss());
app.use(mongoSanitize());

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

// Handle errors
app.use(errorHandler);

module.exports = app;