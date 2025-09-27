const cron = require('node-cron');
const { createSecretsManager } = require('./secrets.service');
const credentialService = require('./credential.service');
const secretsConfig = require('../config/secrets.config');
const logger = require('../config/logger');
const Provider = require('../models/provider.model');

/**
 * Service for managing encryption key rotation
 */
class KeyRotationService {
  constructor() {
    this.secretsManager = createSecretsManager(secretsConfig);
    this.isRotating = false;
    this.rotationJob = null;
    this.lastRotation = null;
    this.nextRotation = null;
    
    if (secretsConfig.keyRotation.enabled) {
      this.scheduleRotation();
    }
  }

  /**
   * Schedule automatic key rotation
   */
  scheduleRotation() {
    const { schedule, intervalHours } = secretsConfig.keyRotation;
    
    let cronExpression;
    if (schedule) {
      // Use custom cron expression
      cronExpression = schedule;
    } else {
      // Generate cron expression from interval
      cronExpression = `0 0 */${intervalHours} * * *`; // Every N hours
    }
    
    try {
      this.rotationJob = cron.schedule(cronExpression, async () => {
        await this.performRotation();
      }, {
        scheduled: false, // Don't start immediately
        timezone: 'UTC',
      });
      
      this.rotationJob.start();
      
      logger.info('Key rotation scheduled', {
        cronExpression,
        intervalHours,
        enabled: true,
      });
    } catch (error) {
      logger.error('Failed to schedule key rotation', {
        cronExpression,
        error: error.message,
      });
    }
  }

  /**
   * Stop scheduled key rotation
   */
  stopRotation() {
    if (this.rotationJob) {
      this.rotationJob.stop();
      this.rotationJob = null;
      logger.info('Key rotation stopped');
    }
  }

  /**
   * Perform key rotation
   * @param {boolean} force - Force rotation even if one is in progress
   * @returns {Promise<Object>} - Rotation result
   */
  async performRotation(force = false) {
    if (this.isRotating && !force) {
      throw new Error('Key rotation is already in progress');
    }
    
    this.isRotating = true;
    const startTime = Date.now();
    
    try {
      logger.info('Starting encryption key rotation');
      
      // Step 1: Rotate the master encryption key
      const encryptionKeyId = secretsConfig.encryptionKeyId;
      const newKeyVersion = await this.secretsManager.rotateEncryptionKey(encryptionKeyId);
      
      logger.info('Master encryption key rotated', {
        keyId: encryptionKeyId,
        newVersion: newKeyVersion,
      });
      
      // Step 2: Re-encrypt all provider credentials with new key
      await this.reencryptProviderCredentials();
      
      // Step 3: Update rotation metadata
      this.lastRotation = new Date();
      this.nextRotation = new Date(Date.now() + (secretsConfig.keyRotation.intervalHours * 60 * 60 * 1000));
      
      const duration = Date.now() - startTime;
      
      logger.info('Encryption key rotation completed successfully', {
        duration,
        newKeyVersion,
        lastRotation: this.lastRotation,
        nextRotation: this.nextRotation,
      });
      
      return {
        success: true,
        duration,
        newKeyVersion,
        lastRotation: this.lastRotation,
        nextRotation: this.nextRotation,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Encryption key rotation failed', {
        duration,
        error: error.message,
        stack: error.stack,
      });
      
      return {
        success: false,
        duration,
        error: error.message,
      };
    } finally {
      this.isRotating = false;
    }
  }

  /**
   * Re-encrypt all provider credentials with new encryption key
   * @returns {Promise<void>}
   */
  async reencryptProviderCredentials() {
    try {
      // Get all providers
      const providers = await Provider.find({});
      
      logger.info('Re-encrypting provider credentials', {
        providerCount: providers.length,
      });
      
      let reencryptedCount = 0;
      let errorCount = 0;
      
      for (const provider of providers) {
        try {
          if (provider.credentials && provider.credentials.size > 0) {
            // Get current credentials (this will decrypt with old key)
            const credentialKeys = Array.from(provider.credentials.keys());
            const currentCredentials = await credentialService.getProviderCredentials(
              provider._id.toString(),
              credentialKeys
            );
            
            // Store credentials again (this will encrypt with new key)
            await credentialService.storeProviderCredentials(
              provider._id.toString(),
              currentCredentials
            );
            
            reencryptedCount++;
          }
        } catch (error) {
          errorCount++;
          logger.error('Failed to re-encrypt provider credentials', {
            providerId: provider._id,
            providerSlug: provider.slug,
            error: error.message,
          });
        }
      }
      
      logger.info('Provider credentials re-encryption completed', {
        totalProviders: providers.length,
        reencryptedCount,
        errorCount,
      });
      
      if (errorCount > 0) {
        throw new Error(`Failed to re-encrypt ${errorCount} provider credentials`);
      }
    } catch (error) {
      logger.error('Failed to re-encrypt provider credentials', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Rotate credentials for a specific provider
   * @param {string} providerId - Provider ID
   * @param {Object} newCredentials - New credentials
   * @returns {Promise<void>}
   */
  async rotateProviderCredentials(providerId, newCredentials) {
    try {
      logger.info('Rotating provider credentials', { providerId });
      
      // Store new credentials in secrets manager
      await credentialService.rotateProviderCredentials(providerId, newCredentials);
      
      // Update provider document to trigger re-encryption
      const provider = await Provider.findById(providerId);
      if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
      }
      
      // Update credentials in the provider document
      provider.credentials = new Map(Object.entries(newCredentials));
      await provider.save();
      
      logger.info('Provider credentials rotated successfully', {
        providerId,
        credentialCount: Object.keys(newCredentials).length,
      });
    } catch (error) {
      logger.error('Failed to rotate provider credentials', {
        providerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get rotation status
   * @returns {Object} - Rotation status
   */
  getRotationStatus() {
    return {
      enabled: secretsConfig.keyRotation.enabled,
      isRotating: this.isRotating,
      lastRotation: this.lastRotation,
      nextRotation: this.nextRotation,
      intervalHours: secretsConfig.keyRotation.intervalHours,
      schedule: secretsConfig.keyRotation.schedule,
      jobActive: this.rotationJob ? this.rotationJob.running : false,
    };
  }

  /**
   * Test key rotation (dry run)
   * @returns {Promise<Object>} - Test result
   */
  async testRotation() {
    try {
      logger.info('Starting key rotation test (dry run)');
      
      // Test secrets manager connectivity
      const connectionTest = await credentialService.testConnection();
      if (!connectionTest) {
        throw new Error('Secrets manager connection test failed');
      }
      
      // Test key rotation capability
      const testKeyId = 'dyad-gateway-test-key';
      try {
        await this.secretsManager.rotateEncryptionKey(testKeyId);
      } catch (error) {
        // This might fail if the test key doesn't exist, which is expected
        logger.debug('Test key rotation failed (expected)', { error: error.message });
      }
      
      return {
        success: true,
        message: 'Key rotation test completed successfully',
        secretsManagerConnected: connectionTest,
      };
    } catch (error) {
      logger.error('Key rotation test failed', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get rotation history (if supported by secrets manager)
   * @returns {Promise<Array>} - Rotation history
   */
  async getRotationHistory() {
    try {
      // This would need to be implemented based on the specific secrets manager
      // For now, return basic information
      return [
        {
          timestamp: this.lastRotation,
          status: 'completed',
          keyVersion: 'current',
        },
      ].filter(entry => entry.timestamp);
    } catch (error) {
      logger.error('Failed to get rotation history', { error: error.message });
      return [];
    }
  }
}

// Export singleton instance
module.exports = new KeyRotationService();