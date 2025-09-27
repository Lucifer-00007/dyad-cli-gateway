const crypto = require('crypto');
const logger = require('../config/logger');

/**
 * Abstract base class for secrets managers
 */
class BaseSecretsManager {
  constructor(config) {
    this.config = config;
  }

  /**
   * Get a secret value
   * @param {string} secretName - Name/ID of the secret
   * @returns {Promise<string>} - The secret value
   */
  async getSecret(secretName) {
    throw new Error('getSecret method must be implemented');
  }

  /**
   * Set a secret value
   * @param {string} secretName - Name/ID of the secret
   * @param {string} secretValue - The secret value
   * @returns {Promise<void>}
   */
  async setSecret(secretName, secretValue) {
    throw new Error('setSecret method must be implemented');
  }

  /**
   * Delete a secret
   * @param {string} secretName - Name/ID of the secret
   * @returns {Promise<void>}
   */
  async deleteSecret(secretName) {
    throw new Error('deleteSecret method must be implemented');
  }

  /**
   * Get encryption key for field-level encryption
   * @param {string} keyId - Key identifier
   * @returns {Promise<Buffer>} - The encryption key
   */
  async getEncryptionKey(keyId) {
    throw new Error('getEncryptionKey method must be implemented');
  }

  /**
   * Rotate encryption key
   * @param {string} keyId - Key identifier
   * @returns {Promise<string>} - New key version/ID
   */
  async rotateEncryptionKey(keyId) {
    throw new Error('rotateEncryptionKey method must be implemented');
  }

  /**
   * Encrypt data using KMS
   * @param {string} plaintext - Data to encrypt
   * @param {string} keyId - Key identifier
   * @returns {Promise<string>} - Encrypted data (base64)
   */
  async encrypt(plaintext, keyId) {
    throw new Error('encrypt method must be implemented');
  }

  /**
   * Decrypt data using KMS
   * @param {string} ciphertext - Encrypted data (base64)
   * @param {string} keyId - Key identifier
   * @returns {Promise<string>} - Decrypted data
   */
  async decrypt(ciphertext, keyId) {
    throw new Error('decrypt method must be implemented');
  }
}

/**
 * AWS KMS and Secrets Manager implementation
 */
class AWSSecretsManager extends BaseSecretsManager {
  constructor(config) {
    super(config);
    this.initializeClients();
  }

  initializeClients() {
    try {
      const { KMSClient } = require('@aws-sdk/client-kms');
      const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');

      const clientConfig = {
        region: this.config.region || process.env.AWS_REGION || 'us-east-1',
      };

      if (this.config.accessKeyId && this.config.secretAccessKey) {
        clientConfig.credentials = {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        };
      }

      this.kmsClient = new KMSClient(clientConfig);
      this.secretsClient = new SecretsManagerClient(clientConfig);
    } catch (error) {
      logger.warn('AWS SDK not available, AWS secrets manager disabled', { error: error.message });
      this.kmsClient = null;
      this.secretsClient = null;
    }
  }

  async getSecret(secretName) {
    if (!this.secretsClient) {
      throw new Error('AWS Secrets Manager client not initialized');
    }

    try {
      const { GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.secretsClient.send(command);
      return response.SecretString;
    } catch (error) {
      logger.error('Failed to get secret from AWS Secrets Manager', { secretName, error: error.message });
      throw error;
    }
  }

  async setSecret(secretName, secretValue) {
    if (!this.secretsClient) {
      throw new Error('AWS Secrets Manager client not initialized');
    }

    try {
      const { UpdateSecretCommand, CreateSecretCommand } = require('@aws-sdk/client-secrets-manager');
      
      try {
        // Try to update existing secret
        const updateCommand = new UpdateSecretCommand({
          SecretId: secretName,
          SecretString: secretValue,
        });
        await this.secretsClient.send(updateCommand);
      } catch (updateError) {
        if (updateError.name === 'ResourceNotFoundException') {
          // Create new secret if it doesn't exist
          const createCommand = new CreateSecretCommand({
            Name: secretName,
            SecretString: secretValue,
          });
          await this.secretsClient.send(createCommand);
        } else {
          throw updateError;
        }
      }
    } catch (error) {
      logger.error('Failed to set secret in AWS Secrets Manager', { secretName, error: error.message });
      throw error;
    }
  }

  async deleteSecret(secretName) {
    if (!this.secretsClient) {
      throw new Error('AWS Secrets Manager client not initialized');
    }

    try {
      const { DeleteSecretCommand } = require('@aws-sdk/client-secrets-manager');
      const command = new DeleteSecretCommand({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: true,
      });
      await this.secretsClient.send(command);
    } catch (error) {
      logger.error('Failed to delete secret from AWS Secrets Manager', { secretName, error: error.message });
      throw error;
    }
  }

  async getEncryptionKey(keyId) {
    if (!this.kmsClient) {
      throw new Error('AWS KMS client not initialized');
    }

    try {
      const { GenerateDataKeyCommand } = require('@aws-sdk/client-kms');
      const command = new GenerateDataKeyCommand({
        KeyId: keyId,
        KeySpec: 'AES_256',
      });
      const response = await this.kmsClient.send(command);
      return response.Plaintext;
    } catch (error) {
      logger.error('Failed to get encryption key from AWS KMS', { keyId, error: error.message });
      throw error;
    }
  }

  async rotateEncryptionKey(keyId) {
    if (!this.kmsClient) {
      throw new Error('AWS KMS client not initialized');
    }

    try {
      const { RotateKeyOnDemandCommand } = require('@aws-sdk/client-kms');
      const command = new RotateKeyOnDemandCommand({ KeyId: keyId });
      const response = await this.kmsClient.send(command);
      return response.KeyId;
    } catch (error) {
      logger.error('Failed to rotate encryption key in AWS KMS', { keyId, error: error.message });
      throw error;
    }
  }

  async encrypt(plaintext, keyId) {
    if (!this.kmsClient) {
      throw new Error('AWS KMS client not initialized');
    }

    try {
      const { EncryptCommand } = require('@aws-sdk/client-kms');
      const command = new EncryptCommand({
        KeyId: keyId,
        Plaintext: Buffer.from(plaintext, 'utf8'),
      });
      const response = await this.kmsClient.send(command);
      return Buffer.from(response.CiphertextBlob).toString('base64');
    } catch (error) {
      logger.error('Failed to encrypt data with AWS KMS', { keyId, error: error.message });
      throw error;
    }
  }

  async decrypt(ciphertext, keyId) {
    if (!this.kmsClient) {
      throw new Error('AWS KMS client not initialized');
    }

    try {
      const { DecryptCommand } = require('@aws-sdk/client-kms');
      const command = new DecryptCommand({
        CiphertextBlob: Buffer.from(ciphertext, 'base64'),
      });
      const response = await this.kmsClient.send(command);
      return Buffer.from(response.Plaintext).toString('utf8');
    } catch (error) {
      logger.error('Failed to decrypt data with AWS KMS', { keyId, error: error.message });
      throw error;
    }
  }
}

/**
 * Azure Key Vault implementation
 */
class AzureSecretsManager extends BaseSecretsManager {
  constructor(config) {
    super(config);
    this.initializeClients();
  }

  initializeClients() {
    try {
      const { SecretClient } = require('@azure/keyvault-secrets');
      const { CryptographyClient, KeyClient } = require('@azure/keyvault-keys');
      const { DefaultAzureCredential } = require('@azure/identity');

      const credential = new DefaultAzureCredential();
      const vaultUrl = this.config.vaultUrl || process.env.AZURE_KEY_VAULT_URL;

      if (!vaultUrl) {
        throw new Error('Azure Key Vault URL is required');
      }

      this.secretClient = new SecretClient(vaultUrl, credential);
      this.keyClient = new KeyClient(vaultUrl, credential);
    } catch (error) {
      logger.warn('Azure Key Vault SDK not available, Azure secrets manager disabled', { error: error.message });
      this.secretClient = null;
      this.keyClient = null;
    }
  }

  async getSecret(secretName) {
    if (!this.secretClient) {
      throw new Error('Azure Key Vault client not initialized');
    }

    try {
      const secret = await this.secretClient.getSecret(secretName);
      return secret.value;
    } catch (error) {
      logger.error('Failed to get secret from Azure Key Vault', { secretName, error: error.message });
      throw error;
    }
  }

  async setSecret(secretName, secretValue) {
    if (!this.secretClient) {
      throw new Error('Azure Key Vault client not initialized');
    }

    try {
      await this.secretClient.setSecret(secretName, secretValue);
    } catch (error) {
      logger.error('Failed to set secret in Azure Key Vault', { secretName, error: error.message });
      throw error;
    }
  }

  async deleteSecret(secretName) {
    if (!this.secretClient) {
      throw new Error('Azure Key Vault client not initialized');
    }

    try {
      const deletePoller = await this.secretClient.beginDeleteSecret(secretName);
      await deletePoller.pollUntilDone();
    } catch (error) {
      logger.error('Failed to delete secret from Azure Key Vault', { secretName, error: error.message });
      throw error;
    }
  }

  async getEncryptionKey(keyId) {
    if (!this.keyClient) {
      throw new Error('Azure Key Vault client not initialized');
    }

    try {
      const key = await this.keyClient.getKey(keyId);
      // For Azure, we'll use the key ID and let Azure handle the actual key material
      return Buffer.from(key.id, 'utf8');
    } catch (error) {
      logger.error('Failed to get encryption key from Azure Key Vault', { keyId, error: error.message });
      throw error;
    }
  }

  async rotateEncryptionKey(keyId) {
    if (!this.keyClient) {
      throw new Error('Azure Key Vault client not initialized');
    }

    try {
      const key = await this.keyClient.getKey(keyId);
      const newVersion = await this.keyClient.rotateKey(keyId);
      return newVersion.id;
    } catch (error) {
      logger.error('Failed to rotate encryption key in Azure Key Vault', { keyId, error: error.message });
      throw error;
    }
  }

  async encrypt(plaintext, keyId) {
    if (!this.keyClient) {
      throw new Error('Azure Key Vault client not initialized');
    }

    try {
      const { CryptographyClient } = require('@azure/keyvault-keys');
      const key = await this.keyClient.getKey(keyId);
      const cryptoClient = new CryptographyClient(key, new (require('@azure/identity')).DefaultAzureCredential());
      
      const result = await cryptoClient.encrypt('RSA-OAEP', Buffer.from(plaintext, 'utf8'));
      return Buffer.from(result.result).toString('base64');
    } catch (error) {
      logger.error('Failed to encrypt data with Azure Key Vault', { keyId, error: error.message });
      throw error;
    }
  }

  async decrypt(ciphertext, keyId) {
    if (!this.keyClient) {
      throw new Error('Azure Key Vault client not initialized');
    }

    try {
      const { CryptographyClient } = require('@azure/keyvault-keys');
      const key = await this.keyClient.getKey(keyId);
      const cryptoClient = new CryptographyClient(key, new (require('@azure/identity')).DefaultAzureCredential());
      
      const result = await cryptoClient.decrypt('RSA-OAEP', Buffer.from(ciphertext, 'base64'));
      return Buffer.from(result.result).toString('utf8');
    } catch (error) {
      logger.error('Failed to decrypt data with Azure Key Vault', { keyId, error: error.message });
      throw error;
    }
  }
}

/**
 * HashiCorp Vault implementation
 */
class HashiCorpVaultManager extends BaseSecretsManager {
  constructor(config) {
    super(config);
    this.baseUrl = config.url || process.env.VAULT_ADDR;
    this.token = config.token || process.env.VAULT_TOKEN;
    this.mountPath = config.mountPath || 'secret';
    
    if (!this.baseUrl || !this.token) {
      logger.warn('HashiCorp Vault URL or token not configured, Vault secrets manager disabled');
    }
  }

  async makeRequest(method, path, data = null) {
    if (!this.baseUrl || !this.token) {
      throw new Error('HashiCorp Vault not properly configured');
    }

    try {
      const axios = require('axios');
      const config = {
        method,
        url: `${this.baseUrl}/v1/${path}`,
        headers: {
          'X-Vault-Token': this.token,
          'Content-Type': 'application/json',
        },
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      logger.error('HashiCorp Vault request failed', { method, path, error: error.message });
      throw error;
    }
  }

  async getSecret(secretName) {
    try {
      const response = await this.makeRequest('GET', `${this.mountPath}/data/${secretName}`);
      return response.data.data.value;
    } catch (error) {
      logger.error('Failed to get secret from HashiCorp Vault', { secretName, error: error.message });
      throw error;
    }
  }

  async setSecret(secretName, secretValue) {
    try {
      await this.makeRequest('POST', `${this.mountPath}/data/${secretName}`, {
        data: { value: secretValue },
      });
    } catch (error) {
      logger.error('Failed to set secret in HashiCorp Vault', { secretName, error: error.message });
      throw error;
    }
  }

  async deleteSecret(secretName) {
    try {
      await this.makeRequest('DELETE', `${this.mountPath}/data/${secretName}`);
    } catch (error) {
      logger.error('Failed to delete secret from HashiCorp Vault', { secretName, error: error.message });
      throw error;
    }
  }

  async getEncryptionKey(keyId) {
    try {
      const response = await this.makeRequest('POST', `transit/datakey/plaintext/${keyId}`);
      return Buffer.from(response.data.plaintext, 'base64');
    } catch (error) {
      logger.error('Failed to get encryption key from HashiCorp Vault', { keyId, error: error.message });
      throw error;
    }
  }

  async rotateEncryptionKey(keyId) {
    try {
      await this.makeRequest('POST', `transit/keys/${keyId}/rotate`);
      const response = await this.makeRequest('GET', `transit/keys/${keyId}`);
      return response.data.latest_version.toString();
    } catch (error) {
      logger.error('Failed to rotate encryption key in HashiCorp Vault', { keyId, error: error.message });
      throw error;
    }
  }

  async encrypt(plaintext, keyId) {
    try {
      const response = await this.makeRequest('POST', `transit/encrypt/${keyId}`, {
        plaintext: Buffer.from(plaintext, 'utf8').toString('base64'),
      });
      return response.data.ciphertext;
    } catch (error) {
      logger.error('Failed to encrypt data with HashiCorp Vault', { keyId, error: error.message });
      throw error;
    }
  }

  async decrypt(ciphertext, keyId) {
    try {
      const response = await this.makeRequest('POST', `transit/decrypt/${keyId}`, {
        ciphertext,
      });
      return Buffer.from(response.data.plaintext, 'base64').toString('utf8');
    } catch (error) {
      logger.error('Failed to decrypt data with HashiCorp Vault', { keyId, error: error.message });
      throw error;
    }
  }
}

/**
 * Environment-based secrets manager (fallback for development)
 */
class EnvironmentSecretsManager extends BaseSecretsManager {
  constructor(config) {
    super(config);
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  getOrCreateEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (key) {
      return key.length === 64 ? Buffer.from(key, 'hex') : crypto.scryptSync(key, 'salt', 32);
    }
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    
    // Generate a random key for development
    return crypto.randomBytes(32);
  }

  async getSecret(secretName) {
    const envVar = `SECRET_${secretName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    const value = process.env[envVar];
    if (!value) {
      throw new Error(`Secret ${secretName} not found in environment variables`);
    }
    return value;
  }

  async setSecret(secretName, secretValue) {
    const envVar = `SECRET_${secretName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    process.env[envVar] = secretValue;
    logger.warn('Setting secret in environment variables - not persistent across restarts', { secretName });
  }

  async deleteSecret(secretName) {
    const envVar = `SECRET_${secretName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    delete process.env[envVar];
  }

  async getEncryptionKey(keyId) {
    return this.encryptionKey;
  }

  async rotateEncryptionKey(keyId) {
    this.encryptionKey = crypto.randomBytes(32);
    logger.warn('Encryption key rotated in memory - not persistent across restarts');
    return 'rotated-' + Date.now();
  }

  async encrypt(plaintext, keyId) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + encrypted;
  }

  async decrypt(ciphertext, keyId) {
    const iv = Buffer.from(ciphertext.slice(0, 32), 'hex');
    const encrypted = ciphertext.slice(32);
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

/**
 * Factory function to create the appropriate secrets manager
 */
function createSecretsManager(config = {}) {
  const provider = config.provider || process.env.SECRETS_PROVIDER || 'environment';
  
  switch (provider.toLowerCase()) {
    case 'aws':
      return new AWSSecretsManager(config.aws || {});
    case 'azure':
      return new AzureSecretsManager(config.azure || {});
    case 'vault':
    case 'hashicorp':
      return new HashiCorpVaultManager(config.vault || {});
    case 'environment':
    default:
      return new EnvironmentSecretsManager(config.environment || {});
  }
}

module.exports = {
  BaseSecretsManager,
  AWSSecretsManager,
  AzureSecretsManager,
  HashiCorpVaultManager,
  EnvironmentSecretsManager,
  createSecretsManager,
};