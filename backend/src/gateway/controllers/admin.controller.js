/**
 * Admin API Controllers
 * Handles /admin/* endpoints for provider management
 */

const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { ProviderService } = require('../services');
const logger = require('../../config/logger');
const crypto = require('crypto');

// Initialize provider service
const providerService = new ProviderService();

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

module.exports = {
  getProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  checkProviderHealth,
};