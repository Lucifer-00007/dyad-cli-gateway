/**
 * Adapter Factory
 * Creates adapter instances based on provider configuration
 */

const SpawnCliAdapter = require('./spawn-cli.adapter');
const HttpSdkAdapter = require('./http-sdk.adapter');
const logger = require('../../config/logger');

class AdapterFactory {
  constructor() {
    // Registry of available adapter types
    this.adapterTypes = {
      'spawn-cli': SpawnCliAdapter,
      'http-sdk': HttpSdkAdapter
      // Future adapters will be added here:
      // 'proxy': ProxyAdapter,
      // 'local': LocalAdapter
    };
  }

  /**
   * Create an adapter instance
   * @param {Object} provider - Provider configuration
   * @param {string} provider.type - Adapter type
   * @param {Object} provider.adapterConfig - Adapter-specific configuration
   * @param {Object} credentials - Provider credentials
   * @returns {BaseAdapter} - Adapter instance
   */
  createAdapter(provider, credentials = {}) {
    const { type, adapterConfig } = provider;
    
    if (!type) {
      throw new Error('Provider type is required');
    }
    
    const AdapterClass = this.adapterTypes[type];
    
    if (!AdapterClass) {
      throw new Error(`Unknown adapter type: ${type}. Available types: ${Object.keys(this.adapterTypes).join(', ')}`);
    }
    
    logger.info('Creating adapter instance', {
      type,
      providerId: provider._id || provider.id,
      providerName: provider.name
    });
    
    try {
      const adapter = new AdapterClass(adapterConfig, credentials);
      
      // Validate the adapter configuration
      const validation = adapter.validateConfig();
      if (!validation.valid) {
        throw new Error(`Invalid adapter configuration: ${validation.errors.join(', ')}`);
      }
      
      return adapter;
    } catch (error) {
      logger.error('Failed to create adapter instance', {
        type,
        providerId: provider._id || provider.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get list of available adapter types
   * @returns {Array<string>} - Array of adapter type names
   */
  getAvailableTypes() {
    return Object.keys(this.adapterTypes);
  }

  /**
   * Register a new adapter type
   * @param {string} type - Adapter type name
   * @param {Class} AdapterClass - Adapter class constructor
   */
  registerAdapter(type, AdapterClass) {
    if (this.adapterTypes[type]) {
      logger.warn('Overriding existing adapter type', { type });
    }
    
    this.adapterTypes[type] = AdapterClass;
    logger.info('Registered new adapter type', { type });
  }

  /**
   * Check if an adapter type is supported
   * @param {string} type - Adapter type to check
   * @returns {boolean} - True if supported
   */
  isSupported(type) {
    return type in this.adapterTypes;
  }
}

// Export singleton instance
module.exports = new AdapterFactory();