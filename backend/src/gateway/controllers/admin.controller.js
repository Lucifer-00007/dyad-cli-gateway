/**
 * Admin API Controllers
 * Handles /admin/* endpoints for provider management
 */

const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { ProviderService, ApiKeyService, GatewayService } = require('../services');
const logger = require('../../config/logger');
const crypto = require('crypto');

// Initialize services
const providerService = new ProviderService();
const apiKeyService = new ApiKeyService();

// Initialize gateway service (singleton pattern would be better in production)
let gatewayService;
const getGatewayService = async () => {
  if (!gatewayService) {
    gatewayService = new GatewayService();
    await gatewayService.initialize();
  }
  return gatewayService;
};

/**
 * Get all providers
 * GET /admin/providers
 */
const getProviders = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { page = 1, limit = 10, enabled, type } = req.query;

  try {
    const filter = {};
    if (enabled !== undefined) {
      filter.enabled = enabled === 'true';
    }
    if (type) {
      filter.type = type;
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy: 'createdAt:desc',
    };

    const result = await providerService.getProviders(filter, options);

    logger.info('Providers list retrieved', {
      requestId,
      userId: req.user.id,
      count: result.results.length,
      totalResults: result.totalResults,
      duration: Date.now() - req.startTime
    });

    res.json(result);

  } catch (error) {
    logger.error('Failed to get providers', {
      requestId,
      userId: req.user.id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
});

/**
 * Get provider by ID
 * GET /admin/providers/:providerId
 */
const getProvider = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { providerId } = req.params;

  try {
    const provider = await providerService.getProviderById(providerId);
    
    if (!provider) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Provider not found');
    }

    logger.info('Provider retrieved', {
      requestId,
      userId: req.user.id,
      providerId,
      providerName: provider.name,
      duration: Date.now() - req.startTime
    });

    res.json(provider);

  } catch (error) {
    logger.error('Failed to get provider', {
      requestId,
      userId: req.user.id,
      providerId,
      error: error.message
    });
    throw error;
  }
});

/**
 * Create new provider
 * POST /admin/providers
 */
const createProvider = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const providerData = req.body;

  try {
    const provider = await providerService.createProvider(providerData);

    logger.info('Provider created', {
      requestId,
      userId: req.user.id,
      providerId: provider.id,
      providerName: provider.name,
      providerType: provider.type,
      duration: Date.now() - req.startTime
    });

    res.status(httpStatus.CREATED).json(provider);

  } catch (error) {
    logger.error('Failed to create provider', {
      requestId,
      userId: req.user.id,
      providerData: { ...providerData, credentials: '[REDACTED]' },
      error: error.message
    });
    throw error;
  }
});

/**
 * Update provider
 * PATCH /admin/providers/:providerId
 */
const updateProvider = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { providerId } = req.params;
  const updateData = req.body;

  try {
    const provider = await providerService.updateProvider(providerId, updateData);

    logger.info('Provider updated', {
      requestId,
      userId: req.user.id,
      providerId,
      providerName: provider.name,
      updatedFields: Object.keys(updateData),
      duration: Date.now() - req.startTime
    });

    res.json(provider);

  } catch (error) {
    logger.error('Failed to update provider', {
      requestId,
      userId: req.user.id,
      providerId,
      updateData: { ...updateData, credentials: '[REDACTED]' },
      error: error.message
    });
    throw error;
  }
});

/**
 * Delete provider
 * DELETE /admin/providers/:providerId
 */
const deleteProvider = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { providerId } = req.params;

  try {
    await providerService.deleteProvider(providerId);

    logger.info('Provider deleted', {
      requestId,
      userId: req.user.id,
      providerId,
      duration: Date.now() - req.startTime
    });

    res.status(httpStatus.NO_CONTENT).send();

  } catch (error) {
    logger.error('Failed to delete provider', {
      requestId,
      userId: req.user.id,
      providerId,
      error: error.message
    });
    throw error;
  }
});

/**
 * Test provider connectivity
 * POST /admin/providers/:providerId/test
 */
const testProvider = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { providerId } = req.params;
  const { dryRun = false } = req.body;

  try {
    const testResult = await providerService.testProvider(providerId, { dryRun });

    logger.info('Provider test completed', {
      requestId,
      userId: req.user.id,
      providerId,
      testResult: testResult.status,
      dryRun,
      duration: Date.now() - req.startTime
    });

    res.json(testResult);

  } catch (error) {
    logger.error('Provider test failed', {
      requestId,
      userId: req.user.id,
      providerId,
      dryRun,
      error: error.message
    });
    throw error;
  }
});

/**
 * Check provider health
 * POST /admin/providers/:providerId/health
 */
const checkProviderHealth = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { providerId } = req.params;

  try {
    const healthResult = await providerService.checkProviderHealth(providerId);

    logger.info('Provider health check completed', {
      requestId,
      userId: req.user.id,
      providerId,
      healthStatus: healthResult.status,
      duration: Date.now() - req.startTime
    });

    res.json(healthResult);

  } catch (error) {
    logger.error('Provider health check failed', {
      requestId,
      userId: req.user.id,
      providerId,
      error: error.message
    });
    throw error;
  }
});

/**
 * Rotate provider credentials
 * POST /admin/providers/:providerId/rotate-credentials
 */
const rotateProviderCredentials = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { providerId } = req.params;
  const { credentials, reason = 'Manual rotation' } = req.body;

  try {
    const rotationResult = await providerService.rotateProviderCredentials(providerId, credentials);

    logger.info('Provider credentials rotated', {
      requestId,
      userId: req.user.id,
      providerId,
      providerName: rotationResult.providerName,
      reason,
      testStatus: rotationResult.testResult.status,
      duration: Date.now() - req.startTime
    });

    res.json(rotationResult);

  } catch (error) {
    logger.error('Failed to rotate provider credentials', {
      requestId,
      userId: req.user.id,
      providerId,
      reason,
      error: error.message
    });
    throw error;
  }
});

/**
 * Get all API keys
 * GET /admin/apikeys
 */
const getApiKeys = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { page = 1, limit = 10, enabled, userId } = req.query;

  try {
    const filter = {};
    if (enabled !== undefined) {
      filter.enabled = enabled === 'true';
    }
    if (userId) {
      filter.userId = userId;
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy: 'createdAt:desc',
      populate: 'userId:name,email',
    };

    const result = await apiKeyService.getApiKeys(filter, options);

    logger.info('API keys list retrieved', {
      requestId,
      userId: req.user.id,
      count: result.results.length,
      totalResults: result.totalResults,
      duration: Date.now() - req.startTime
    });

    res.json(result);

  } catch (error) {
    logger.error('Failed to get API keys', {
      requestId,
      userId: req.user.id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
});

/**
 * Get API key by ID
 * GET /admin/apikeys/:apiKeyId
 */
const getApiKey = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { apiKeyId } = req.params;

  try {
    const apiKey = await apiKeyService.getApiKeyById(apiKeyId);
    
    if (!apiKey) {
      throw new ApiError(httpStatus.NOT_FOUND, 'API key not found');
    }

    logger.info('API key retrieved', {
      requestId,
      userId: req.user.id,
      apiKeyId,
      apiKeyName: apiKey.name,
      duration: Date.now() - req.startTime
    });

    res.json(apiKey);

  } catch (error) {
    logger.error('Failed to get API key', {
      requestId,
      userId: req.user.id,
      apiKeyId,
      error: error.message
    });
    throw error;
  }
});

/**
 * Create new API key
 * POST /admin/apikeys
 */
const createApiKey = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const apiKeyData = req.body;

  try {
    const result = await apiKeyService.createApiKey(apiKeyData);

    logger.info('API key created', {
      requestId,
      userId: req.user.id,
      apiKeyId: result.apiKey.id,
      apiKeyName: result.apiKey.name,
      targetUserId: result.apiKey.userId,
      permissions: result.apiKey.permissions,
      duration: Date.now() - req.startTime
    });

    res.status(httpStatus.CREATED).json(result);

  } catch (error) {
    logger.error('Failed to create API key', {
      requestId,
      userId: req.user.id,
      apiKeyData: { ...apiKeyData, keyHash: '[REDACTED]' },
      error: error.message
    });
    throw error;
  }
});

/**
 * Update API key
 * PATCH /admin/apikeys/:apiKeyId
 */
const updateApiKey = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { apiKeyId } = req.params;
  const updateData = req.body;

  try {
    const apiKey = await apiKeyService.updateApiKey(apiKeyId, updateData);

    logger.info('API key updated', {
      requestId,
      userId: req.user.id,
      apiKeyId,
      apiKeyName: apiKey.name,
      updatedFields: Object.keys(updateData),
      duration: Date.now() - req.startTime
    });

    res.json(apiKey);

  } catch (error) {
    logger.error('Failed to update API key', {
      requestId,
      userId: req.user.id,
      apiKeyId,
      updateData: { ...updateData, keyHash: '[REDACTED]' },
      error: error.message
    });
    throw error;
  }
});

/**
 * Revoke API key
 * POST /admin/apikeys/:apiKeyId/revoke
 */
const revokeApiKey = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { apiKeyId } = req.params;
  const { reason = 'Manual revocation' } = req.body;

  try {
    const revocationResult = await apiKeyService.revokeApiKey(apiKeyId, {
      reason,
      revokedBy: req.user.id
    });

    logger.info('API key revoked', {
      requestId,
      userId: req.user.id,
      apiKeyId,
      apiKeyName: revocationResult.apiKeyName,
      reason,
      revocationStatus: revocationResult.status,
      duration: Date.now() - req.startTime
    });

    res.json(revocationResult);

  } catch (error) {
    logger.error('Failed to revoke API key', {
      requestId,
      userId: req.user.id,
      apiKeyId,
      reason,
      error: error.message
    });
    throw error;
  }
});

/**
 * Regenerate API key
 * POST /admin/apikeys/:apiKeyId/regenerate
 */
const regenerateApiKey = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { apiKeyId } = req.params;
  const { reason = 'Manual regeneration' } = req.body;

  try {
    const regenerationResult = await apiKeyService.regenerateApiKey(apiKeyId, {
      reason,
      regeneratedBy: req.user.id
    });

    logger.info('API key regenerated', {
      requestId,
      userId: req.user.id,
      apiKeyId,
      apiKeyName: regenerationResult.apiKey.name,
      reason,
      regenerationStatus: regenerationResult.status,
      duration: Date.now() - req.startTime
    });

    res.json(regenerationResult);

  } catch (error) {
    logger.error('Failed to regenerate API key', {
      requestId,
      userId: req.user.id,
      apiKeyId,
      reason,
      error: error.message
    });
    throw error;
  }
});

/**
 * Delete API key permanently
 * DELETE /admin/apikeys/:apiKeyId
 */
const deleteApiKey = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { apiKeyId } = req.params;

  try {
    await apiKeyService.deleteApiKey(apiKeyId);

    logger.info('API key deleted', {
      requestId,
      userId: req.user.id,
      apiKeyId,
      duration: Date.now() - req.startTime
    });

    res.status(httpStatus.NO_CONTENT).send();

  } catch (error) {
    logger.error('Failed to delete API key', {
      requestId,
      userId: req.user.id,
      apiKeyId,
      error: error.message
    });
    throw error;
  }
});

/**
 * Get circuit breaker status for all providers
 * GET /admin/circuit-breakers
 */
const getCircuitBreakerStatus = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');

  try {
    const gateway = await getGatewayService();
    const status = gateway.getCircuitBreakerStatus();

    logger.info('Circuit breaker status retrieved', {
      requestId,
      userId: req.user.id,
      providerCount: Object.keys(status).length,
      duration: Date.now() - req.startTime
    });

    res.json({
      status: 'success',
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get circuit breaker status', {
      requestId,
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
});

/**
 * Get circuit breaker status for specific provider
 * GET /admin/circuit-breakers/:providerId
 */
const getProviderCircuitBreakerStatus = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { providerId } = req.params;

  try {
    const gateway = await getGatewayService();
    const status = gateway.getProviderCircuitBreakerStatus(providerId);

    if (!status) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Circuit breaker not found for provider');
    }

    logger.info('Provider circuit breaker status retrieved', {
      requestId,
      userId: req.user.id,
      providerId,
      status: status.state,
      duration: Date.now() - req.startTime
    });

    res.json({
      status: 'success',
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get provider circuit breaker status', {
      requestId,
      userId: req.user.id,
      providerId,
      error: error.message
    });
    throw error;
  }
});

/**
 * Reset circuit breaker for provider
 * POST /admin/circuit-breakers/:providerId/reset
 */
const resetCircuitBreaker = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { providerId } = req.params;

  try {
    const gateway = await getGatewayService();
    gateway.resetCircuitBreaker(providerId);

    logger.info('Circuit breaker reset', {
      requestId,
      userId: req.user.id,
      providerId,
      duration: Date.now() - req.startTime
    });

    res.json({
      status: 'success',
      message: 'Circuit breaker reset successfully',
      providerId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to reset circuit breaker', {
      requestId,
      userId: req.user.id,
      providerId,
      error: error.message
    });
    throw error;
  }
});

/**
 * Open circuit breaker for provider
 * POST /admin/circuit-breakers/:providerId/open
 */
const openCircuitBreaker = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { providerId } = req.params;

  try {
    const gateway = await getGatewayService();
    gateway.openCircuitBreaker(providerId);

    logger.info('Circuit breaker opened', {
      requestId,
      userId: req.user.id,
      providerId,
      duration: Date.now() - req.startTime
    });

    res.json({
      status: 'success',
      message: 'Circuit breaker opened successfully',
      providerId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to open circuit breaker', {
      requestId,
      userId: req.user.id,
      providerId,
      error: error.message
    });
    throw error;
  }
});

/**
 * Get fallback configurations
 * GET /admin/fallback-policies
 */
const getFallbackPolicies = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');

  try {
    const gateway = await getGatewayService();
    const configs = gateway.getAllFallbackConfigs();

    logger.info('Fallback policies retrieved', {
      requestId,
      userId: req.user.id,
      configCount: Object.keys(configs).length,
      duration: Date.now() - req.startTime
    });

    res.json({
      status: 'success',
      data: configs,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get fallback policies', {
      requestId,
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
});

/**
 * Configure fallback policy for model
 * PUT /admin/fallback-policies/:modelId
 */
const configureFallbackPolicy = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { modelId } = req.params;
  const config = req.body;

  try {
    const gateway = await getGatewayService();
    gateway.configureFallbackPolicy(modelId, config);

    logger.info('Fallback policy configured', {
      requestId,
      userId: req.user.id,
      modelId,
      strategy: config.strategy,
      enabled: config.enabled,
      duration: Date.now() - req.startTime
    });

    res.json({
      status: 'success',
      message: 'Fallback policy configured successfully',
      modelId,
      config,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to configure fallback policy', {
      requestId,
      userId: req.user.id,
      modelId,
      config,
      error: error.message
    });
    throw error;
  }
});

/**
 * Get fallback policy for model
 * GET /admin/fallback-policies/:modelId
 */
const getFallbackPolicy = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { modelId } = req.params;

  try {
    const gateway = await getGatewayService();
    const config = gateway.getFallbackConfig(modelId);

    if (!config) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Fallback policy not found for model');
    }

    logger.info('Fallback policy retrieved', {
      requestId,
      userId: req.user.id,
      modelId,
      strategy: config.strategy,
      duration: Date.now() - req.startTime
    });

    res.json({
      status: 'success',
      data: config,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get fallback policy', {
      requestId,
      userId: req.user.id,
      modelId,
      error: error.message
    });
    throw error;
  }
});

/**
 * Remove fallback policy for model
 * DELETE /admin/fallback-policies/:modelId
 */
const removeFallbackPolicy = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const { modelId } = req.params;

  try {
    const gateway = await getGatewayService();
    gateway.removeFallbackConfig(modelId);

    logger.info('Fallback policy removed', {
      requestId,
      userId: req.user.id,
      modelId,
      duration: Date.now() - req.startTime
    });

    res.json({
      status: 'success',
      message: 'Fallback policy removed successfully',
      modelId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to remove fallback policy', {
      requestId,
      userId: req.user.id,
      modelId,
      error: error.message
    });
    throw error;
  }
});

/**
 * Set provider priorities
 * PUT /admin/provider-priorities
 */
const setProviderPriorities = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const priorities = req.body;

  try {
    const gateway = await getGatewayService();
    gateway.setProviderPriorities(priorities);

    logger.info('Provider priorities set', {
      requestId,
      userId: req.user.id,
      priorities,
      duration: Date.now() - req.startTime
    });

    res.json({
      status: 'success',
      message: 'Provider priorities set successfully',
      priorities,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to set provider priorities', {
      requestId,
      userId: req.user.id,
      priorities,
      error: error.message
    });
    throw error;
  }
});

/**
 * Get health monitor status
 * GET /admin/health-monitor
 */
const getHealthMonitorStatus = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');

  try {
    const gateway = await getGatewayService();
    const status = gateway.getHealthMonitorStatus();

    logger.info('Health monitor status retrieved', {
      requestId,
      userId: req.user.id,
      isRunning: status.isRunning,
      duration: Date.now() - req.startTime
    });

    res.json({
      status: 'success',
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get health monitor status', {
      requestId,
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
});

/**
 * Trigger manual health check for all providers
 * POST /admin/health-check
 */
const triggerHealthCheck = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');

  try {
    const gateway = await getGatewayService();
    const results = await gateway.checkAllProvidersHealth();

    logger.info('Manual health check completed', {
      requestId,
      userId: req.user.id,
      providersChecked: results.length,
      duration: Date.now() - req.startTime
    });

    res.json({
      status: 'success',
      message: 'Health check completed',
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to trigger health check', {
      requestId,
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
});

/**
 * Get reliability statistics
 * GET /admin/reliability-stats
 */
const getReliabilityStatistics = catchAsync(async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');

  try {
    const gateway = await getGatewayService();
    const stats = gateway.getReliabilityStatistics();

    logger.info('Reliability statistics retrieved', {
      requestId,
      userId: req.user.id,
      duration: Date.now() - req.startTime
    });

    res.json({
      status: 'success',
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get reliability statistics', {
      requestId,
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
});

module.exports = {
  getProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  checkProviderHealth,
  rotateProviderCredentials,
  getApiKeys,
  getApiKey,
  createApiKey,
  updateApiKey,
  revokeApiKey,
  regenerateApiKey,
  deleteApiKey,
  // Circuit breaker endpoints
  getCircuitBreakerStatus,
  getProviderCircuitBreakerStatus,
  resetCircuitBreaker,
  openCircuitBreaker,
  // Fallback policy endpoints
  getFallbackPolicies,
  configureFallbackPolicy,
  getFallbackPolicy,
  removeFallbackPolicy,
  setProviderPriorities,
  // Health monitoring endpoints
  getHealthMonitorStatus,
  triggerHealthCheck,
  getReliabilityStatistics,
};