/**
 * Secrets Service Unit Tests
 */

const {
  BaseSecretsManager,
  AWSSecretsManager,
  AzureSecretsManager,
  HashiCorpVaultManager,
  EnvironmentSecretsManager,
  createSecretsManager,
} = require('../../../src/services/secrets.service');

describe('Secrets Service', () => {
  describe('BaseSecretsManager', () => {
    let baseManager;

    beforeEach(() => {
      baseManager = new BaseSecretsManager({});
    });

    test('should throw error for unimplemented methods', async () => {
      await expect(baseManager.getSecret('test')).rejects.toThrow('getSecret method must be implemented');
      await expect(baseManager.setSecret('test', 'value')).rejects.toThrow('setSecret method must be implemented');
      await expect(baseManager.deleteSecret('test')).rejects.toThrow('deleteSecret method must be implemented');
      await expect(baseManager.getEncryptionKey('test')).rejects.toThrow('getEncryptionKey method must be implemented');
      await expect(baseManager.rotateEncryptionKey('test')).rejects.toThrow('rotateEncryptionKey method must be implemented');
      await expect(baseManager.encrypt('test', 'key')).rejects.toThrow('encrypt method must be implemented');
      await expect(baseManager.decrypt('test', 'key')).rejects.toThrow('decrypt method must be implemented');
    });
  });

  describe('EnvironmentSecretsManager', () => {
    let envManager;
    const originalEnv = process.env;

    beforeEach(() => {
      envManager = new EnvironmentSecretsManager({});
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should get secret from environment variable', async () => {
      process.env.SECRET_TEST_SECRET = 'test-value';
      const value = await envManager.getSecret('test-secret');
      expect(value).toBe('test-value');
    });

    test('should set secret in environment variable', async () => {
      await envManager.setSecret('test-secret', 'new-value');
      expect(process.env.SECRET_TEST_SECRET).toBe('new-value');
    });

    test('should delete secret from environment variable', async () => {
      process.env.SECRET_TEST_SECRET = 'test-value';
      await envManager.deleteSecret('test-secret');
      expect(process.env.SECRET_TEST_SECRET).toBeUndefined();
    });

    test('should throw error for missing secret', async () => {
      await expect(envManager.getSecret('nonexistent')).rejects.toThrow('Secret nonexistent not found in environment variables');
    });

    test('should encrypt and decrypt data', async () => {
      const plaintext = 'sensitive data';
      const encrypted = await envManager.encrypt(plaintext, 'test-key');
      const decrypted = await envManager.decrypt(encrypted, 'test-key');
      
      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    test('should rotate encryption key', async () => {
      const originalKey = envManager.encryptionKey;
      const newKeyVersion = await envManager.rotateEncryptionKey('test-key');
      
      expect(newKeyVersion).toMatch(/^rotated-\d+$/);
      expect(envManager.encryptionKey).not.toEqual(originalKey);
    });
  });

  describe('AWSSecretsManager', () => {
    let awsManager;

    beforeEach(() => {
      awsManager = new AWSSecretsManager({
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      });
    });

    test('should initialize with proper configuration', () => {
      expect(awsManager.config.region).toBe('us-east-1');
      expect(awsManager.config.accessKeyId).toBe('test-key');
      expect(awsManager.config.secretAccessKey).toBe('test-secret');
    });

    test('should handle missing AWS SDK gracefully', () => {
      // This test verifies that the manager handles missing AWS SDK dependencies
      expect(awsManager.kmsClient).toBeNull();
      expect(awsManager.secretsClient).toBeNull();
    });
  });

  describe('AzureSecretsManager', () => {
    let azureManager;

    beforeEach(() => {
      azureManager = new AzureSecretsManager({
        vaultUrl: 'https://test-vault.vault.azure.net/',
      });
    });

    test('should initialize with proper configuration', () => {
      expect(azureManager.config.vaultUrl).toBe('https://test-vault.vault.azure.net/');
    });

    test('should handle missing Azure SDK gracefully', () => {
      // This test verifies that the manager handles missing Azure SDK dependencies
      expect(azureManager.secretClient).toBeNull();
      expect(azureManager.keyClient).toBeNull();
    });
  });

  describe('HashiCorpVaultManager', () => {
    let vaultManager;

    beforeEach(() => {
      vaultManager = new HashiCorpVaultManager({
        url: 'https://vault.example.com',
        token: 'test-token',
        mountPath: 'secret',
      });
    });

    test('should initialize with proper configuration', () => {
      expect(vaultManager.baseUrl).toBe('https://vault.example.com');
      expect(vaultManager.token).toBe('test-token');
      expect(vaultManager.mountPath).toBe('secret');
    });

    test('should handle missing configuration gracefully', () => {
      const unconfiguredManager = new HashiCorpVaultManager({});
      expect(unconfiguredManager.baseUrl).toBeUndefined();
      expect(unconfiguredManager.token).toBeUndefined();
    });
  });

  describe('createSecretsManager factory', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should create EnvironmentSecretsManager by default', () => {
      const manager = createSecretsManager();
      expect(manager).toBeInstanceOf(EnvironmentSecretsManager);
    });

    test('should create AWSSecretsManager when provider is aws', () => {
      const manager = createSecretsManager({ provider: 'aws' });
      expect(manager).toBeInstanceOf(AWSSecretsManager);
    });

    test('should create AzureSecretsManager when provider is azure', () => {
      const manager = createSecretsManager({ provider: 'azure' });
      expect(manager).toBeInstanceOf(AzureSecretsManager);
    });

    test('should create HashiCorpVaultManager when provider is vault', () => {
      const manager = createSecretsManager({ provider: 'vault' });
      expect(manager).toBeInstanceOf(HashiCorpVaultManager);
    });

    test('should create HashiCorpVaultManager when provider is hashicorp', () => {
      const manager = createSecretsManager({ provider: 'hashicorp' });
      expect(manager).toBeInstanceOf(HashiCorpVaultManager);
    });

    test('should respect SECRETS_PROVIDER environment variable', () => {
      process.env.SECRETS_PROVIDER = 'aws';
      const manager = createSecretsManager();
      expect(manager).toBeInstanceOf(AWSSecretsManager);
    });

    test('should pass configuration to specific managers', () => {
      const config = {
        provider: 'aws',
        aws: {
          region: 'eu-west-1',
          accessKeyId: 'test-key',
        },
      };
      
      const manager = createSecretsManager(config);
      expect(manager).toBeInstanceOf(AWSSecretsManager);
      expect(manager.config.region).toBe('eu-west-1');
      expect(manager.config.accessKeyId).toBe('test-key');
    });
  });
});