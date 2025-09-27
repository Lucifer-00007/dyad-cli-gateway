/**
 * API Key Service
 * Business logic for API key management
 */

const httpStatus = require('http-status');
const ApiKey = require('../../models/apiKey.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');

class ApiKeyService {
  /**
   * Get API keys with filtering and pagination
   * @param {Object} filter - Filter criteria
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} - Paginated API keys
   */
  async getApiKeys(filter = {}, options = {}) {
    try {
      const apiKeys = await ApiKey.paginate(filter, options);
      return apiKeys;
    } catch (error) {
      logger.error('Failed to get API keys', { error: error.message });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve API keys');
    }
  }

  /**
   * Get API key by ID
   * @param {string} apiKeyId - API key ID
   * @returns {Promise<ApiKey|null>} - API key document
   */
  async getApiKeyById(apiKeyId) {
    try {
      const apiKey = await ApiKey.findById(apiKeyId);
      return apiKey;
    } catch (error) {
      logger.error('Failed to get API key by ID', { apiKeyId, error: error.message });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve API key');
    }
  }

  /**
   * Create new API key
   * @param {Object} apiKeyData - API key data
   * @returns {Promise<Object>} - Created API key with raw key
   */
  async createApiKey(apiKeyData) {
    try {
      // Generate new API key
      const rawKey = ApiKey.generateKey();
      const keyHash = await ApiKey.hashKey(rawKey);
      const keyPrefix = ApiKey.getKeyPrefix(rawKey);

      // Create API key document
      const apiKeyDoc = await ApiKey.create({
        ...apiKeyData,
        keyHash,
        keyPrefix
      });

      logger.info('API key created successfully', {
        apiKeyId: apiKeyDoc.id,
        apiKeyName: apiKeyDoc.name,
        userId: apiKeyDoc.userId,
        permissions: apiKeyDoc.permissions
      });

      // Return the document with the raw key (only time it's exposed)
      return {
        apiKey: apiKeyDoc,
        rawKey // This should be shown to user only once
      };

    } catch (error) {
      logger.error('Failed to create API key', { 
        apiKeyData: { ...apiKeyData, keyHash: '[REDACTED]' }, 
        error: error.message 
      });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create API key');
    }
  }

  /**
   * Update API key
   * @param {string} apiKeyId - API key ID
   * @param {Object} updateData - Update data
   * @returns {Promise<ApiKey>} - Updated API key
   */
  async updateApiKey(apiKeyId, updateData) {
    try {
      const apiKey = await ApiKey.findById(apiKeyId);
      if (!apiKey) {
        throw new ApiError(httpStatus.NOT_FOUND, 'API key not found');
      }

      // Update API key
      Object.assign(apiKey, updateData);
      await apiKey.save();

      logger.info('API key updated successfully', {
        apiKeyId,
        apiKeyName: apiKey.name,
        updatedFields: Object.keys(updateData)
      });

      return apiKey;

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to update API key', { 
        apiKeyId, 
        updateData: { ...updateData, keyHash: '[REDACTED]' }, 
        error: error.message 
      });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update API key');
    }
  }

  /**
   * Revoke API key (disable immediately)
   * @param {string} apiKeyId - API key ID
   * @param {Object} options - Revocation options
   * @param {string} options.reason - Reason for revocation
   * @param {string} options.revokedBy - User ID who revoked the key
   * @returns {Promise<Object>} - Revocation result
   */
  async revokeApiKey(apiKeyId, options = {}) {
    const { reason = 'Manual revocation', revokedBy } = options;
    
    try {
      const apiKey = await ApiKey.findById(apiKeyId);
      if (!apiKey) {
        throw new ApiError(httpStatus.NOT_FOUND, 'API key not found');
      }

      if (!apiKey.enabled) {
        return {
          status: 'already_revoked',
          message: 'API key is already disabled',
          apiKeyId: apiKeyId.toString(),
          apiKeyName: apiKey.name,
          timestamp: new Date().toISOString()
        };
      }

      const startTime = Date.now();

      // Disable the API key immediately
      apiKey.enabled = false;
      
      // Add revocation metadata
      if (!apiKey.metadata) {
        apiKey.metadata = new Map();
      }
      apiKey.metadata.set('revokedAt', new Date().toISOString());
      apiKey.metadata.set('revokedBy', revokedBy || 'system');
      apiKey.metadata.set('revocationReason', reason);

      await apiKey.save();

      logger.info('API key revoked successfully', {
        apiKeyId,
        apiKeyName: apiKey.name,
        userId: apiKey.userId,
        reason,
        revokedBy,
        duration: Date.now() - startTime
      });

      return {
        status: 'revoked',
        message: 'API key revoked successfully',
        apiKeyId: apiKeyId.toString(),
        apiKeyName: apiKey.name,
        reason,
        revokedBy: revokedBy || 'system',
        revokedAt: apiKey.metadata.get('revokedAt'),
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to revoke API key', { 
        apiKeyId, 
        reason,
        revokedBy,
        error: error.message,
        stack: error.stack 
      });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to revoke API key');
    }
  }

  /**
   * Delete API key permanently
   * @param {string} apiKeyId - API key ID
   * @returns {Promise<void>}
   */
  async deleteApiKey(apiKeyId) {
    try {
      const apiKey = await ApiKey.findById(apiKeyId);
      if (!apiKey) {
        throw new ApiError(httpStatus.NOT_FOUND, 'API key not found');
      }

      await ApiKey.findByIdAndDelete(apiKeyId);
      
      logger.info('API key deleted successfully', {
        apiKeyId,
        apiKeyName: apiKey.name,
        userId: apiKey.userId
      });

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to delete API key', { apiKeyId, error: error.message });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete API key');
    }
  }

  /**
   * Regenerate API key (create new key, disable old one)
   * @param {string} apiKeyId - API key ID
   * @param {Object} options - Regeneration options
   * @param {string} options.reason - Reason for regeneration
   * @param {string} options.regeneratedBy - User ID who regenerated the key
   * @returns {Promise<Object>} - Regeneration result with new key
   */
  async regenerateApiKey(apiKeyId, options = {}) {
    const { reason = 'Manual regeneration', regeneratedBy } = options;
    
    try {
      const oldApiKey = await ApiKey.findById(apiKeyId);
      if (!oldApiKey) {
        throw new ApiError(httpStatus.NOT_FOUND, 'API key not found');
      }

      const startTime = Date.now();

      // Generate new API key
      const rawKey = ApiKey.generateKey();
      const keyHash = await ApiKey.hashKey(rawKey);
      const keyPrefix = ApiKey.getKeyPrefix(rawKey);

      // Update the existing document with new key
      oldApiKey.keyHash = keyHash;
      oldApiKey.keyPrefix = keyPrefix;
      oldApiKey.enabled = true; // Ensure it's enabled
      
      // Add regeneration metadata
      if (!oldApiKey.metadata) {
        oldApiKey.metadata = new Map();
      }
      oldApiKey.metadata.set('regeneratedAt', new Date().toISOString());
      oldApiKey.metadata.set('regeneratedBy', regeneratedBy || 'system');
      oldApiKey.metadata.set('regenerationReason', reason);

      // Reset usage stats
      oldApiKey.usageStats = {
        requestsToday: 0,
        requestsThisMonth: 0,
        tokensToday: 0,
        tokensThisMonth: 0,
        lastResetDate: new Date()
      };

      await oldApiKey.save();

      logger.info('API key regenerated successfully', {
        apiKeyId,
        apiKeyName: oldApiKey.name,
        userId: oldApiKey.userId,
        reason,
        regeneratedBy,
        duration: Date.now() - startTime
      });

      return {
        status: 'regenerated',
        message: 'API key regenerated successfully',
        apiKey: oldApiKey,
        rawKey, // New key to show to user
        reason,
        regeneratedBy: regeneratedBy || 'system',
        regeneratedAt: oldApiKey.metadata.get('regeneratedAt'),
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to regenerate API key', { 
        apiKeyId, 
        reason,
        regeneratedBy,
        error: error.message,
        stack: error.stack 
      });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to regenerate API key');
    }
  }
}

module.exports = ApiKeyService;