const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { adminController } = require('../controllers');
const { providerValidation, apikeyValidation, circuitBreakerValidation, fallbackPolicyValidation } = require('../validations');
const { requestLogger, errorConverter, errorHandler } = require('../middlewares');

const router = express.Router();

// Apply middleware stack to all admin routes
router.use(requestLogger);

// Add request start time for duration tracking
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// All admin routes require JWT authentication with admin role
router.use(auth('manageUsers')); // Using existing admin permission

// Provider management routes
router
  .route('/providers')
  .get(validate(providerValidation.getProviders), adminController.getProviders)
  .post(validate(providerValidation.createProvider), adminController.createProvider);

router
  .route('/providers/:providerId')
  .get(validate(providerValidation.getProvider), adminController.getProvider)
  .patch(validate(providerValidation.updateProvider), adminController.updateProvider)
  .delete(validate(providerValidation.deleteProvider), adminController.deleteProvider);

// Provider testing endpoint
router.post('/providers/:providerId/test', validate(providerValidation.testProvider), adminController.testProvider);

// Provider health check endpoint
router.post('/providers/:providerId/health', validate(providerValidation.checkProviderHealth), adminController.checkProviderHealth);

// Provider credential rotation endpoint
router.post('/providers/:providerId/rotate-credentials', validate(providerValidation.rotateProviderCredentials), adminController.rotateProviderCredentials);

// API Key management routes
router
  .route('/apikeys')
  .get(validate(apikeyValidation.getApiKeys), adminController.getApiKeys)
  .post(validate(apikeyValidation.createApiKey), adminController.createApiKey);

router
  .route('/apikeys/:apiKeyId')
  .get(validate(apikeyValidation.getApiKey), adminController.getApiKey)
  .patch(validate(apikeyValidation.updateApiKey), adminController.updateApiKey)
  .delete(validate(apikeyValidation.deleteApiKey), adminController.deleteApiKey);

// API Key revocation endpoint
router.post('/apikeys/:apiKeyId/revoke', validate(apikeyValidation.revokeApiKey), adminController.revokeApiKey);

// API Key regeneration endpoint
router.post('/apikeys/:apiKeyId/regenerate', validate(apikeyValidation.regenerateApiKey), adminController.regenerateApiKey);

// Circuit breaker management routes
router.get('/circuit-breakers', adminController.getCircuitBreakerStatus);
router.get('/circuit-breakers/:providerId', validate(circuitBreakerValidation.getProviderCircuitBreakerStatus), adminController.getProviderCircuitBreakerStatus);
router.post('/circuit-breakers/:providerId/reset', validate(circuitBreakerValidation.resetCircuitBreaker), adminController.resetCircuitBreaker);
router.post('/circuit-breakers/:providerId/open', validate(circuitBreakerValidation.openCircuitBreaker), adminController.openCircuitBreaker);

// Fallback policy management routes
router.get('/fallback-policies', adminController.getFallbackPolicies);
router.get('/fallback-policies/:modelId', validate(fallbackPolicyValidation.getFallbackPolicy), adminController.getFallbackPolicy);
router.put('/fallback-policies/:modelId', validate(fallbackPolicyValidation.configureFallbackPolicy), adminController.configureFallbackPolicy);
router.delete('/fallback-policies/:modelId', validate(fallbackPolicyValidation.removeFallbackPolicy), adminController.removeFallbackPolicy);

// Provider priority management
router.put('/provider-priorities', validate(fallbackPolicyValidation.setProviderPriorities), adminController.setProviderPriorities);

// Health monitoring routes
router.get('/health-monitor', adminController.getHealthMonitorStatus);
router.post('/health-check', adminController.triggerHealthCheck);

// Reliability statistics
router.get('/reliability-stats', adminController.getReliabilityStatistics);

// Secrets management routes
router.use('/secrets', require('./secrets.route'));

// Security management routes
router.use('/security', require('./security.route'));

// Performance monitoring routes
router.use('/performance', require('./performance.routes'));

// Dashboard routes
router.use('/dashboard', require('./dashboard.routes'));

// Error handling middleware
router.use(errorConverter);
router.use(errorHandler);

module.exports = router;