/**
 * Gateway Configuration
 * Loads gateway-specific settings from environment variables
 */

const Joi = require('joi');

const envVarsSchema = Joi.object()
  .keys({
    // Gateway Core Settings
    GATEWAY_ENABLED: Joi.boolean().default(true),
    GATEWAY_PORT: Joi.number().default(3001),
    GATEWAY_API_PREFIX: Joi.string().default('/v1'),
    GATEWAY_ADMIN_PREFIX: Joi.string().default('/admin'),

    // Sandbox Configuration
    GATEWAY_SANDBOX_ENABLED: Joi.boolean().default(true),
    GATEWAY_SANDBOX_IMAGE: Joi.string().default('node:18-alpine'),
    GATEWAY_SANDBOX_TIMEOUT: Joi.number().default(60000), // 60 seconds
    GATEWAY_SANDBOX_MEMORY_LIMIT: Joi.string().default('512m'),
    GATEWAY_SANDBOX_CPU_LIMIT: Joi.string().default('0.5'),

    // Rate Limiting
    GATEWAY_RATE_LIMIT_WINDOW: Joi.number().default(900000), // 15 minutes
    GATEWAY_RATE_LIMIT_MAX: Joi.number().default(100),

    // Security
    GATEWAY_API_KEY_HEADER: Joi.string().default('Authorization'),
    GATEWAY_CORS_ORIGIN: Joi.string().default('*'),

    // Adapter Configuration
    GATEWAY_ADAPTER_TIMEOUT: Joi.number().default(30000), // 30 seconds
    GATEWAY_ADAPTER_RETRY_ATTEMPTS: Joi.number().default(3),
    GATEWAY_ADAPTER_RETRY_DELAY: Joi.number().default(1000), // 1 second

    // Circuit Breaker
    GATEWAY_CIRCUIT_BREAKER_FAILURE_THRESHOLD: Joi.number().default(5),
    GATEWAY_CIRCUIT_BREAKER_TIMEOUT: Joi.number().default(60000), // 1 minute
    GATEWAY_CIRCUIT_BREAKER_RESET_TIMEOUT: Joi.number().default(300000), // 5 minutes

    // Health Check
    GATEWAY_HEALTH_CHECK_INTERVAL: Joi.number().default(30000), // 30 seconds

    // Logging
    GATEWAY_LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    GATEWAY_LOG_REDACT_SENSITIVE: Joi.boolean().default(true),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Gateway config validation error: ${error.message}`);
}

module.exports = {
  // Core Settings
  enabled: envVars.GATEWAY_ENABLED,
  port: envVars.GATEWAY_PORT,
  apiPrefix: envVars.GATEWAY_API_PREFIX,
  adminPrefix: envVars.GATEWAY_ADMIN_PREFIX,

  // Sandbox Configuration
  sandbox: {
    enabled: envVars.GATEWAY_SANDBOX_ENABLED,
    image: envVars.GATEWAY_SANDBOX_IMAGE,
    timeout: envVars.GATEWAY_SANDBOX_TIMEOUT,
    memoryLimit: envVars.GATEWAY_SANDBOX_MEMORY_LIMIT,
    cpuLimit: envVars.GATEWAY_SANDBOX_CPU_LIMIT,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: envVars.GATEWAY_RATE_LIMIT_WINDOW,
    max: envVars.GATEWAY_RATE_LIMIT_MAX,
  },

  // Security
  security: {
    apiKeyHeader: envVars.GATEWAY_API_KEY_HEADER,
    corsOrigin: envVars.GATEWAY_CORS_ORIGIN,
  },

  // Adapter Configuration
  adapter: {
    timeout: envVars.GATEWAY_ADAPTER_TIMEOUT,
    retryAttempts: envVars.GATEWAY_ADAPTER_RETRY_ATTEMPTS,
    retryDelay: envVars.GATEWAY_ADAPTER_RETRY_DELAY,
  },

  // Circuit Breaker
  circuitBreaker: {
    failureThreshold: envVars.GATEWAY_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    timeout: envVars.GATEWAY_CIRCUIT_BREAKER_TIMEOUT,
    resetTimeout: envVars.GATEWAY_CIRCUIT_BREAKER_RESET_TIMEOUT,
  },

  // Health Check
  healthCheck: {
    interval: envVars.GATEWAY_HEALTH_CHECK_INTERVAL,
  },

  // Logging
  logging: {
    level: envVars.GATEWAY_LOG_LEVEL,
    redactSensitive: envVars.GATEWAY_LOG_REDACT_SENSITIVE,
  },
};