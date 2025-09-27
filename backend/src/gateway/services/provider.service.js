/**
 * Provider Service
 * Business logic for provider management
 */

const httpStatus = require('http-status');
const Provider = require('../../models/provider.model');
const ApiError = require('../../utils/ApiError');
const { AdapterFactory } = require('../adapters');
const logger = require('../../config/logger');

class ProviderService {
  constructor() {
    this.adapterFactory = AdapterFactory;
  }

  /**
   * Get providers with filtering and pagination
   * @param {Object} filter - Filter criteria
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} - Paginated providers
   */
  async getProviders(filter = {}, options = {}) {
    try {
      const providers = await Provider.paginate(filter, options);
      return providers;
    } catch (error) {
      logger.error('Failed to get providers', { error: error.message });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve providers');
    }
  }

  /**
   * Get provider by ID
   * @param {string} providerId - Provider ID
   * @returns {Promise<Provider|null>} - Provider document
   */
  async getProviderById(providerId) {
    try {
      const provider = await Provider.findById(providerId);
      return provider;
    } catch (error) {
      logger.error('Failed to get provider by ID', { providerId, error: error.message });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve provider');
    }
  }

  /**
   * Create new provider
   * @param {Object} providerData - Provider data
   * @returns {Promise<Provider>} - Created provider
   */
  async createProvider(providerData) {
    try {
      // Check if slug is already taken
      if (await Provider.isSlugTaken(providerData.slug)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Provider slug already exists');
      }

      // Validate adapter configuration
      await this.validateAdapterConfig(providerData.type, providerData.adapterConfig);

      // Create provider
      const provider = await Provider.create(providerData);

      // Perform initial health check
      try {
        await this.checkProviderHealth(provider.id);
      } catch (healthError) {
        logger.warn('Initial health check failed for new provider', {
          providerId: provider.id,
          error: healthError.message
        });
      }

      return provider;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to create provider', { providerData: { ...providerData, credentials: '[REDACTED]' }, error: error.message });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create provider');
    }
  }

  /**
   * Update provider
   * @param {string} providerId - Provider ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Provider>} - Updated provider
   */
  async updateProvider(providerId, updateData) {
    try {
      const provider = await Provider.findById(providerId);
      if (!provider) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Provider not found');
      }

      // Check if slug is being updated and is available
      if (updateData.slug && updateData.slug !== provider.slug) {
        if (await Provider.isSlugTaken(updateData.slug, providerId)) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Provider slug already exists');
        }
      }

      // Validate adapter configuration if being updated
      if (updateData.adapterConfig || updateData.type) {
        const type = updateData.type || provider.type;
        const adapterConfig = updateData.adapterConfig || provider.adapterConfig;
        await this.validateAdapterConfig(type, adapterConfig);
      }

      // Update provider
      Object.assign(provider, updateData);
      await provider.save();

      // Perform health check if configuration changed
      if (updateData.adapterConfig || updateData.credentials || updateData.enabled !== undefined) {
        try {
          await this.checkProviderHealth(provider.id);
        } catch (healthError) {
          logger.warn('Health check failed after provider update', {
            providerId: provider.id,
            error: healthError.message
          });
        }
      }

      return provider;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to update provider', { providerId, updateData: { ...updateData, credentials: '[REDACTED]' }, error: error.message });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update provider');
    }
  }

  /**
   * Delete provider
   * @param {string} providerId - Provider ID
   * @returns {Promise<void>}
   */
  async deleteProvider(providerId) {
    try {
      const provider = await Provider.findById(providerId);
      if (!provider) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Provider not found');
      }

      await Provider.findByIdAndDelete(providerId);
      
      logger.info('Provider deleted successfully', {
        providerId,
        providerName: provider.name,
        providerSlug: provider.slug
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to delete provider', { providerId, error: error.message });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete provider');
    }
  }

  /**
   * Test provider connectivity
   * @param {string} providerId - Provider ID
   * @param {Object} options - Test options
   * @param {boolean} options.dryRun - Whether to perform dry run
   * @returns {Promise<Object>} - Test result
   */
  async testProvider(providerId, options = {}) {
    const { dryRun = false } = options;
    
    try {
      const provider = await Provider.findById(providerId);
      if (!provider) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Provider not found');
      }

      if (!provider.enabled) {
        return {
          status: 'skipped',
          message: 'Provider is disabled',
          timestamp: new Date().toISOString(),
          providerId,
          providerName: provider.name
        };
      }

      const startTime = Date.now();
      let testResult;

      try {
        if (dryRun) {
          // Dry run: just validate configuration without executing
          await this.validateAdapterConfig(provider.type, provider.adapterConfig);
          testResult = {
            status: 'success',
            message: 'Configuration validation passed (dry run)',
            dryRun: true
          };
        } else {
          // Real test: create adapter and perform test request
          const adapter = this.adapterFactory.createAdapter(provider, provider.credentials);
          
          // Perform test based on adapter capabilities
          if (provider.models.length > 0) {
            const testModel = provider.models[0];
            const testMessages = [
              { role: 'user', content: 'Hello, this is a connectivity test.' }
            ];

            const testRequest = {
              messages: testMessages,
              options: {
                max_tokens: 10,
                model: testModel.adapterModelId
              },
              requestMeta: {
                requestId: `test_${Date.now()}`,
                providerId: provider.id,
                test: true
              }
            };

            const response = await adapter.handleChat(testRequest);
            
            testResult = {
              status: 'success',
              message: 'Provider connectivity test passed',
              response: {
                hasContent: !!(response && response.content),
                responseTime: Date.now() - startTime
              }
            };
          } else {
            testResult = {
              status: 'warning',
              message: 'No models configured for testing'
            };
          }
        }

        // Update provider health status
        await provider.updateHealthStatus('healthy');

      } catch (testError) {
        logger.error('Provider test failed', {
          providerId,
          providerName: provider.name,
          error: testError.message
        });

        // Update provider health status
        await provider.updateHealthStatus('unhealthy', testError.message);

        testResult = {
          status: 'failed',
          message: testError.message,
          error: {
            type: testError.constructor.name,
            message: testError.message
          }
        };
      }

      return {
        ...testResult,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        providerId,
        providerName: provider.name,
        providerType: provider.type
      };

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to test provider', { providerId, error: error.message });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to test provider');
    }
  }

  /**
   * Check provider health
   * @param {string} providerId - Provider ID
   * @returns {Promise<Object>} - Health check result
   */
  async checkProviderHealth(providerId) {
    try {
      const provider = await Provider.findById(providerId);
      if (!provider) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Provider not found');
      }

      const startTime = Date.now();
      let healthResult;

      try {
        // Basic configuration validation
        await this.validateAdapterConfig(provider.type, provider.adapterConfig);

        if (!provider.enabled) {
          healthResult = {
            status: 'disabled',
            message: 'Provider is disabled'
          };
        } else {
          // For now, just validate configuration
          // In future, could perform lightweight connectivity checks
          healthResult = {
            status: 'healthy',
            message: 'Provider configuration is valid'
          };
        }

        // Update provider health status
        await provider.updateHealthStatus(healthResult.status === 'healthy' ? 'healthy' : 'unhealthy', 
          healthResult.status !== 'healthy' ? healthResult.message : null);

      } catch (healthError) {
        logger.error('Provider health check failed', {
          providerId,
          providerName: provider.name,
          error: healthError.message
        });

        // Update provider health status
        await provider.updateHealthStatus('unhealthy', healthError.message);

        healthResult = {
          status: 'unhealthy',
          message: healthError.message,
          error: {
            type: healthError.constructor.name,
            message: healthError.message
          }
        };
      }

      return {
        ...healthResult,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        providerId,
        providerName: provider.name,
        providerType: provider.type,
        lastChecked: provider.healthStatus.lastChecked
      };

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to check provider health', { providerId, error: error.message });
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to check provider health');
    }
  }

  /**
   * Validate adapter configuration
   * @param {string} type - Adapter type
   * @param {Object} adapterConfig - Adapter configuration
   * @returns {Promise<void>}
   */
  async validateAdapterConfig(type, adapterConfig) {
    if (!adapterConfig) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Adapter configuration is required');
    }

    switch (type) {
      case 'spawn-cli':
        if (!adapterConfig.command) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Command is required for spawn-cli adapter');
        }
        break;
      case 'http-sdk':
        if (!adapterConfig.baseUrl) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Base URL is required for http-sdk adapter');
        }
        break;
      case 'proxy':
        if (!adapterConfig.proxyUrl) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Proxy URL is required for proxy adapter');
        }
        break;
      case 'local':
        if (!adapterConfig.localUrl) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Local URL is required for local adapter');
        }
        break;
      default:
        throw new ApiError(httpStatus.BAD_REQUEST, `Unknown adapter type: ${type}`);
    }
  }
}

module.exports = ProviderService;