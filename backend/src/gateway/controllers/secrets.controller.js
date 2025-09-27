/**
 * Secrets Management Controller
 * Handles admin endpoints for secrets manager and key rotation
 */

const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const credentialService = require('../../services/credential.service');
const keyRotationService = require('../../services/key-rotation.service');
const logger = require('../../config/logger');

/**
 * Get secrets manager health status
 */
const getSecretsHealth = catchAsync(async (req, res) => {
  const healthStatus = await credentialService.getHealthStatus();
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: healthStatus,
  });
});

/**
 * Test secrets manager connectivity
 */
const testSecretsConnection = catchAsync(async (req, res) => {
  const isConnected = await credentialService.testConnection();
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: {
      connected: isConnected,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Clear secrets cache
 */
const clearSecretsCache = catchAsync(async (req, res) => {
  credentialService.clearCache();
  
  logger.info('Secrets cache cleared by admin', {
    userId: req.user?.id,
    userEmail: req.user?.email,
  });
  
  res.status(httpStatus.OK).json({
    status: 'success',
    message: 'Secrets cache cleared successfully',
  });
});

/**
 * Get key rotation status
 */
const getKeyRotationStatus = catchAsync(async (req, res) => {
  const rotationStatus = keyRotationService.getRotationStatus();
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: rotationStatus,
  });
});

/**
 * Perform manual key rotation
 */
const performKeyRotation = catchAsync(async (req, res) => {
  const { force = false } = req.body;
  
  logger.info('Manual key rotation initiated', {
    userId: req.user?.id,
    userEmail: req.user?.email,
    force,
  });
  
  const rotationResult = await keyRotationService.performRotation(force);
  
  const statusCode = rotationResult.success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR;
  
  res.status(statusCode).json({
    status: rotationResult.success ? 'success' : 'error',
    data: rotationResult,
  });
});

/**
 * Test key rotation (dry run)
 */
const testKeyRotation = catchAsync(async (req, res) => {
  const testResult = await keyRotationService.testRotation();
  
  const statusCode = testResult.success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR;
  
  res.status(statusCode).json({
    status: testResult.success ? 'success' : 'error',
    data: testResult,
  });
});

/**
 * Get key rotation history
 */
const getKeyRotationHistory = catchAsync(async (req, res) => {
  const history = await keyRotationService.getRotationHistory();
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: {
      history,
      count: history.length,
    },
  });
});

/**
 * Start/stop automatic key rotation
 */
const toggleKeyRotation = catchAsync(async (req, res) => {
  const { enabled } = req.body;
  
  if (enabled === undefined) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: 'error',
      message: 'enabled field is required',
    });
  }
  
  logger.info('Key rotation schedule toggled', {
    userId: req.user?.id,
    userEmail: req.user?.email,
    enabled,
  });
  
  if (enabled) {
    keyRotationService.scheduleRotation();
  } else {
    keyRotationService.stopRotation();
  }
  
  const rotationStatus = keyRotationService.getRotationStatus();
  
  res.status(httpStatus.OK).json({
    status: 'success',
    message: `Key rotation ${enabled ? 'enabled' : 'disabled'} successfully`,
    data: rotationStatus,
  });
});

/**
 * Get provider credential metadata (without actual values)
 */
const getProviderCredentialMetadata = catchAsync(async (req, res) => {
  const { providerId } = req.params;
  
  // This endpoint returns metadata about stored credentials without exposing values
  const Provider = require('../../models/provider.model');
  const provider = await Provider.findById(providerId);
  
  if (!provider) {
    return res.status(httpStatus.NOT_FOUND).json({
      status: 'error',
      message: 'Provider not found',
    });
  }
  
  const credentialKeys = provider.credentials ? Array.from(provider.credentials.keys()) : [];
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: {
      providerId,
      providerName: provider.name,
      credentialKeys,
      credentialCount: credentialKeys.length,
      hasCredentials: credentialKeys.length > 0,
    },
  });
});

/**
 * Validate provider credentials in secrets manager
 */
const validateProviderCredentials = catchAsync(async (req, res) => {
  const { providerId } = req.params;
  
  const Provider = require('../../models/provider.model');
  const provider = await Provider.findById(providerId);
  
  if (!provider) {
    return res.status(httpStatus.NOT_FOUND).json({
      status: 'error',
      message: 'Provider not found',
    });
  }
  
  const credentialKeys = provider.credentials ? Array.from(provider.credentials.keys()) : [];
  const validationResults = [];
  
  for (const key of credentialKeys) {
    try {
      await credentialService.getCredential(providerId, key);
      validationResults.push({
        key,
        status: 'valid',
        message: 'Credential found and accessible',
      });
    } catch (error) {
      validationResults.push({
        key,
        status: 'invalid',
        message: error.message,
      });
    }
  }
  
  const validCount = validationResults.filter(r => r.status === 'valid').length;
  const invalidCount = validationResults.filter(r => r.status === 'invalid').length;
  
  res.status(httpStatus.OK).json({
    status: 'success',
    data: {
      providerId,
      providerName: provider.name,
      totalCredentials: credentialKeys.length,
      validCredentials: validCount,
      invalidCredentials: invalidCount,
      allValid: invalidCount === 0,
      results: validationResults,
    },
  });
});

module.exports = {
  getSecretsHealth,
  testSecretsConnection,
  clearSecretsCache,
  getKeyRotationStatus,
  performKeyRotation,
  testKeyRotation,
  getKeyRotationHistory,
  toggleKeyRotation,
  getProviderCredentialMetadata,
  validateProviderCredentials,
};