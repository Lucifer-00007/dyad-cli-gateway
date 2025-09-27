const { createSecretsManager } = require('./secrets.service');
const secretsConfig = require('../config/secrets.config');
const logger = require('../config/logger');

/**
 * Service for managing provider credentials using external secrets manager
 */
class CredentialService {
  constructor() {
    this.secretsManager = createSecretsManager(secretsConfig);
    this.cache = new Map();
    this.cacheEnabled = secretsConfig.cache.enabled;
    this.cacheTTL = secretsConfig.cache.ttlSeconds * 1000; // Convert to milliseconds
    this.maxCacheSize = secretsConfig.cache.maxSize;
  }

  /**
   * Generate secret name for provider credentials
   * @param {string} providerId - Provider ID
   * @param {string} credentialKey - Credential key name
   * @returns {string} - Secret name
   */
  generateSecretName(providerId, credentialKey) {
    return `dyad-gateway/providers/${providerId}/credentials/${credentialKey}`;
  }

  /**
   * Get cache key
   * @param {string} secretName - Secret name
   * @returns {string} - Cache key
   */
  getCacheKey(secretName) {
    return `secret:${secretName}`;
  }

  /**
   * Check if cache entry is valid
   * @param {Object} entry - Cache entry
   * @returns {boolean} - True if valid
   */
  isCacheValid(entry) {
    return entry && (Date.now() - entry.timestamp) < this.cacheTTL;
  }

  /**
   * Get secret from cache
   * @param {string} secretName - Secret name
   * @returns {string|null} - Cached secret value or null
   */
  getFromCache(secretName) {
    if (!this.cacheEnabled) return null;
    
    const cacheKey = this.getCacheKey(secretName);
    const entry = this.cache.get(cacheKey);
    
    if (this.isCacheValid(entry)) {
      return entry.value;
    }
    
    // Remove expired entry
    if (entry) {
      this.cache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * Set secret in cache
   * @param {string} secretName - Secret name
   * @param {string} value - Secret value
   */
  setInCache(secretName, value) {
    if (!this.cacheEnabled) return;
    
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    const cacheKey = this.getCacheKey(secretName);
    this.cache.set(cacheKey, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Remove secret from cache
   * @param {string} secretName - Secret name
   */
  removeFromCache(secretName) {
    const cacheKey = this.getCacheKey(secretName);
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cache entries
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Store provider credential in secrets manager
   * @param {string} providerId - Provider ID
   * @param {string} credentialKey - Credential key name
   * @param {string} credentialValue - Credential value
   * @returns {Promise<void>}
   */
  async storeCredential(providerId, credentialKey, credentialValue) {
    const secretName = this.generateSecretName(providerId, credentialKey);
    
    try {
      await this.secretsManager.setSecret(secretName, credentialValue);
      this.setInCache(secretName, credentialValue);
      
      logger.info('Provider credential stored successfully', {
        providerId,
        credentialKey,
        secretName,
      });
    } catch (error) {
      logger.error('Failed to store provider credential', {
        providerId,
        credentialKey,
        secretName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Retrieve provider credential from secrets manager
   * @param {string} providerId - Provider ID
   * @param {string} credentialKey - Credential key name
   * @returns {Promise<string>} - Credential value
   */
  async getCredential(providerId, credentialKey) {
    const secretName = this.generateSecretName(providerId, credentialKey);
    
    // Try cache first
    const cachedValue = this.getFromCache(secretName);
    if (cachedValue) {
      return cachedValue;
    }
    
    try {
      const value = await this.secretsManager.getSecret(secretName);
      this.setInCache(secretName, value);
      return value;
    } catch (error) {
      logger.error('Failed to retrieve provider credential', {
        providerId,
        credentialKey,
        secretName,
        error: error.message,
      });
      
      // Try fallback to environment variables if enabled
      if (secretsConfig.fallback.enabled && secretsConfig.fallback.toEnvironment) {
        const envVar = `PROVIDER_${providerId.toUpperCase()}_${credentialKey.toUpperCase()}`;
        const envValue = process.env[envVar];
        if (envValue) {
          logger.warn('Using fallback environment variable for credential', {
            providerId,
            credentialKey,
            envVar,
          });
          return envValue;
        }
      }
      
      throw error;
    }
  }

  /**
   * Delete provider credential from secrets manager
   * @param {string} providerId - Provider ID
   * @param {string} credentialKey - Credential key name
   * @returns {Promise<void>}
   */
  async deleteCredential(providerId, credentialKey) {
    const secretName = this.generateSecretName(providerId, credentialKey);
    
    try {
      await this.secretsManager.deleteSecret(secretName);
      this.removeFromCache(secretName);
      
      logger.info('Provider credential deleted successfully', {
        providerId,
        credentialKey,
        secretName,
      });
    } catch (error) {
      logger.error('Failed to delete provider credential', {
        providerId,
        credentialKey,
        secretName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Store all provider credentials
   * @param {string} providerId - Provider ID
   * @param {Map|Object} credentials - Credentials map or object
   * @returns {Promise<void>}
   */
  async storeProviderCredentials(providerId, credentials) {
    const credentialsMap = credentials instanceof Map ? credentials : new Map(Object.entries(credentials));
    
    const promises = [];
    for (const [key, value] of credentialsMap) {
      if (value && typeof value === 'string') {
        promises.push(this.storeCredential(providerId, key, value));
      }
    }
    
    await Promise.all(promises);
  }

  /**
   * Retrieve all provider credentials
   * @param {string} providerId - Provider ID
   * @param {string[]} credentialKeys - Array of credential keys to retrieve
   * @returns {Promise<Map>} - Map of credential key to value
   */
  async getProviderCredentials(providerId, credentialKeys) {
    const credentials = new Map();
    
    const promises = credentialKeys.map(async (key) => {
      try {
        const value = await this.getCredential(providerId, key);
        credentials.set(key, value);
      } catch (error) {
        logger.warn('Failed to retrieve credential, skipping', {
          providerId,
          credentialKey: key,
          error: error.message,
        });
      }
    });
    
    await Promise.all(promises);
    return credentials;
  }

  /**
   * Delete all provider credentials
   * @param {string} providerId - Provider ID
   * @param {string[]} credentialKeys - Array of credential keys to delete
   * @returns {Promise<void>}
   */
  async deleteProviderCredentials(providerId, credentialKeys) {
    const promises = credentialKeys.map(key => 
      this.deleteCredential(providerId, key).catch(error => {
        logger.warn('Failed to delete credential, continuing', {
          providerId,
          credentialKey: key,
          error: error.message,
        });
      })
    );
    
    await Promise.all(promises);
  }

  /**
   * Rotate provider credentials
   * @param {string} providerId - Provider ID
   * @param {Map|Object} newCredentials - New credentials
   * @returns {Promise<void>}
   */
  async rotateProviderCredentials(providerId, newCredentials) {
    const credentialsMap = newCredentials instanceof Map ? newCredentials : new Map(Object.entries(newCredentials));
    
    // Store new credentials
    await this.storeProviderCredentials(providerId, credentialsMap);
    
    // Clear cache for this provider to force refresh
    for (const key of credentialsMap.keys()) {
      const secretName = this.generateSecretName(providerId, key);
      this.removeFromCache(secretName);
    }
    
    logger.info('Provider credentials rotated successfully', {
      providerId,
      credentialCount: credentialsMap.size,
    });
  }

  /**
   * Test secrets manager connectivity
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection() {
    try {
      const testSecretName = 'dyad-gateway/test/connection';
      const testValue = `test-${Date.now()}`;
      
      // Test write
      await this.secretsManager.setSecret(testSecretName, testValue);
      
      // Test read
      const retrievedValue = await this.secretsManager.getSecret(testSecretName);
      
      // Test delete
      await this.secretsManager.deleteSecret(testSecretName);
      
      const success = retrievedValue === testValue;
      
      logger.info('Secrets manager connection test completed', { success });
      return success;
    } catch (error) {
      logger.error('Secrets manager connection test failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get secrets manager health status
   * @returns {Promise<Object>} - Health status object
   */
  async getHealthStatus() {
    try {
      const isConnected = await this.testConnection();
      
      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        provider: secretsConfig.provider,
        cacheEnabled: this.cacheEnabled,
        cacheSize: this.cache.size,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: secretsConfig.provider,
        error: error.message,
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
module.exports = new CredentialService();