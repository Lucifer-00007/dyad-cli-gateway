/**
 * Credential Service Unit Tests
 */

const credentialService = require('../../../src/services/credential.service');
const { createSecretsManager } = require('../../../src/services/secrets.service');

// Mock the secrets service
jest.mock('../../../src/services/secrets.service');

describe('Credential Service', () => {
  let mockSecretsManager;

  beforeEach(() => {
    mockSecretsManager = {
      getSecret: jest.fn(),
      setSecret: jest.fn(),
      deleteSecret: jest.fn(),
    };
    
    createSecretsManager.mockReturnValue(mockSecretsManager);
    
    // Clear cache before each test
    credentialService.clearCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSecretName', () => {
    test('should generate correct secret name format', () => {
      const secretName = credentialService.generateSecretName('provider123', 'api_key');
      expect(secretName).toBe('dyad-gateway/providers/provider123/credentials/api_key');
    });
  });

  describe('storeCredential', () => {
    test('should store credential in secrets manager', async () => {
      mockSecretsManager.setSecret.mockResolvedValue();
      
      await credentialService.storeCredential('provider123', 'api_key', 'secret-value');
      
      expect(mockSecretsManager.setSecret).toHaveBeenCalledWith(
        'dyad-gateway/providers/provider123/credentials/api_key',
        'secret-value'
      );
    });

    test('should cache credential after storing', async () => {
      mockSecretsManager.setSecret.mockResolvedValue();
      
      await credentialService.storeCredential('provider123', 'api_key', 'secret-value');
      
      // Verify it's cached by checking if subsequent get doesn't call secrets manager
      mockSecretsManager.getSecret.mockResolvedValue('secret-value');
      const value = await credentialService.getCredential('provider123', 'api_key');
      
      expect(value).toBe('secret-value');
      expect(mockSecretsManager.getSecret).not.toHaveBeenCalled();
    });

    test('should throw error if secrets manager fails', async () => {
      const error = new Error('Secrets manager error');
      mockSecretsManager.setSecret.mockRejectedValue(error);
      
      await expect(credentialService.storeCredential('provider123', 'api_key', 'secret-value'))
        .rejects.toThrow('Secrets manager error');
    });
  });

  describe('getCredential', () => {
    test('should retrieve credential from secrets manager', async () => {
      mockSecretsManager.getSecret.mockResolvedValue('secret-value');
      
      const value = await credentialService.getCredential('provider123', 'api_key');
      
      expect(value).toBe('secret-value');
      expect(mockSecretsManager.getSecret).toHaveBeenCalledWith(
        'dyad-gateway/providers/provider123/credentials/api_key'
      );
    });

    test('should return cached value if available', async () => {
      // First call to populate cache
      mockSecretsManager.getSecret.mockResolvedValue('secret-value');
      await credentialService.getCredential('provider123', 'api_key');
      
      // Second call should use cache
      const value = await credentialService.getCredential('provider123', 'api_key');
      
      expect(value).toBe('secret-value');
      expect(mockSecretsManager.getSecret).toHaveBeenCalledTimes(1);
    });

    test('should fall back to environment variable if enabled', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, PROVIDER_PROVIDER123_API_KEY: 'fallback-value' };
      
      mockSecretsManager.getSecret.mockRejectedValue(new Error('Secret not found'));
      
      const value = await credentialService.getCredential('provider123', 'api_key');
      
      expect(value).toBe('fallback-value');
      
      process.env = originalEnv;
    });

    test('should throw error if credential not found and no fallback', async () => {
      mockSecretsManager.getSecret.mockRejectedValue(new Error('Secret not found'));
      
      await expect(credentialService.getCredential('provider123', 'api_key'))
        .rejects.toThrow('Secret not found');
    });
  });

  describe('deleteCredential', () => {
    test('should delete credential from secrets manager', async () => {
      mockSecretsManager.deleteSecret.mockResolvedValue();
      
      await credentialService.deleteCredential('provider123', 'api_key');
      
      expect(mockSecretsManager.deleteSecret).toHaveBeenCalledWith(
        'dyad-gateway/providers/provider123/credentials/api_key'
      );
    });

    test('should remove credential from cache', async () => {
      // First store and cache a credential
      mockSecretsManager.setSecret.mockResolvedValue();
      await credentialService.storeCredential('provider123', 'api_key', 'secret-value');
      
      // Delete the credential
      mockSecretsManager.deleteSecret.mockResolvedValue();
      await credentialService.deleteCredential('provider123', 'api_key');
      
      // Verify it's no longer cached
      mockSecretsManager.getSecret.mockResolvedValue('secret-value');
      await credentialService.getCredential('provider123', 'api_key');
      
      expect(mockSecretsManager.getSecret).toHaveBeenCalled();
    });
  });

  describe('storeProviderCredentials', () => {
    test('should store multiple credentials', async () => {
      mockSecretsManager.setSecret.mockResolvedValue();
      
      const credentials = {
        api_key: 'key-value',
        secret_key: 'secret-value',
      };
      
      await credentialService.storeProviderCredentials('provider123', credentials);
      
      expect(mockSecretsManager.setSecret).toHaveBeenCalledTimes(2);
      expect(mockSecretsManager.setSecret).toHaveBeenCalledWith(
        'dyad-gateway/providers/provider123/credentials/api_key',
        'key-value'
      );
      expect(mockSecretsManager.setSecret).toHaveBeenCalledWith(
        'dyad-gateway/providers/provider123/credentials/secret_key',
        'secret-value'
      );
    });

    test('should handle Map input', async () => {
      mockSecretsManager.setSecret.mockResolvedValue();
      
      const credentials = new Map([
        ['api_key', 'key-value'],
        ['secret_key', 'secret-value'],
      ]);
      
      await credentialService.storeProviderCredentials('provider123', credentials);
      
      expect(mockSecretsManager.setSecret).toHaveBeenCalledTimes(2);
    });

    test('should skip empty or non-string values', async () => {
      mockSecretsManager.setSecret.mockResolvedValue();
      
      const credentials = {
        api_key: 'key-value',
        empty_key: '',
        null_key: null,
        undefined_key: undefined,
        number_key: 123,
      };
      
      await credentialService.storeProviderCredentials('provider123', credentials);
      
      expect(mockSecretsManager.setSecret).toHaveBeenCalledTimes(1);
      expect(mockSecretsManager.setSecret).toHaveBeenCalledWith(
        'dyad-gateway/providers/provider123/credentials/api_key',
        'key-value'
      );
    });
  });

  describe('getProviderCredentials', () => {
    test('should retrieve multiple credentials', async () => {
      mockSecretsManager.getSecret
        .mockResolvedValueOnce('key-value')
        .mockResolvedValueOnce('secret-value');
      
      const credentials = await credentialService.getProviderCredentials(
        'provider123',
        ['api_key', 'secret_key']
      );
      
      expect(credentials).toBeInstanceOf(Map);
      expect(credentials.get('api_key')).toBe('key-value');
      expect(credentials.get('secret_key')).toBe('secret-value');
    });

    test('should handle partial failures gracefully', async () => {
      mockSecretsManager.getSecret
        .mockResolvedValueOnce('key-value')
        .mockRejectedValueOnce(new Error('Secret not found'));
      
      const credentials = await credentialService.getProviderCredentials(
        'provider123',
        ['api_key', 'missing_key']
      );
      
      expect(credentials).toBeInstanceOf(Map);
      expect(credentials.get('api_key')).toBe('key-value');
      expect(credentials.has('missing_key')).toBe(false);
    });
  });

  describe('testConnection', () => {
    test('should return true for successful connection test', async () => {
      mockSecretsManager.setSecret.mockResolvedValue();
      mockSecretsManager.getSecret.mockResolvedValue('test-123');
      mockSecretsManager.deleteSecret.mockResolvedValue();
      
      const result = await credentialService.testConnection();
      
      expect(result).toBe(true);
      expect(mockSecretsManager.setSecret).toHaveBeenCalled();
      expect(mockSecretsManager.getSecret).toHaveBeenCalled();
      expect(mockSecretsManager.deleteSecret).toHaveBeenCalled();
    });

    test('should return false for failed connection test', async () => {
      mockSecretsManager.setSecret.mockRejectedValue(new Error('Connection failed'));
      
      const result = await credentialService.testConnection();
      
      expect(result).toBe(false);
    });

    test('should return false if retrieved value does not match', async () => {
      mockSecretsManager.setSecret.mockResolvedValue();
      mockSecretsManager.getSecret.mockResolvedValue('wrong-value');
      mockSecretsManager.deleteSecret.mockResolvedValue();
      
      const result = await credentialService.testConnection();
      
      expect(result).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    test('should return healthy status for successful connection', async () => {
      mockSecretsManager.setSecret.mockResolvedValue();
      mockSecretsManager.getSecret.mockResolvedValue('test-123');
      mockSecretsManager.deleteSecret.mockResolvedValue();
      
      const status = await credentialService.getHealthStatus();
      
      expect(status.status).toBe('healthy');
      expect(status.provider).toBe('environment');
      expect(status.cacheEnabled).toBe(true);
      expect(status.lastChecked).toBeDefined();
    });

    test('should return unhealthy status for failed connection', async () => {
      mockSecretsManager.setSecret.mockRejectedValue(new Error('Connection failed'));
      
      const status = await credentialService.getHealthStatus();
      
      expect(status.status).toBe('unhealthy');
      expect(status.error).toBe('Connection failed');
    });
  });

  describe('cache management', () => {
    test('should respect cache TTL', async () => {
      // Mock a short TTL for testing
      credentialService.cacheTTL = 100; // 100ms
      
      mockSecretsManager.getSecret.mockResolvedValue('secret-value');
      
      // First call
      await credentialService.getCredential('provider123', 'api_key');
      expect(mockSecretsManager.getSecret).toHaveBeenCalledTimes(1);
      
      // Second call within TTL
      await credentialService.getCredential('provider123', 'api_key');
      expect(mockSecretsManager.getSecret).toHaveBeenCalledTimes(1);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Third call after TTL expiry
      await credentialService.getCredential('provider123', 'api_key');
      expect(mockSecretsManager.getSecret).toHaveBeenCalledTimes(2);
      
      // Reset TTL
      credentialService.cacheTTL = 300000; // 5 minutes
    });

    test('should implement LRU eviction when cache is full', async () => {
      // Mock a small cache size for testing
      credentialService.maxCacheSize = 2;
      
      mockSecretsManager.getSecret.mockResolvedValue('value');
      
      // Fill cache
      await credentialService.getCredential('provider1', 'key1');
      await credentialService.getCredential('provider2', 'key2');
      
      // Add third item (should evict first)
      await credentialService.getCredential('provider3', 'key3');
      
      // First item should be evicted and require new fetch
      mockSecretsManager.getSecret.mockClear();
      await credentialService.getCredential('provider1', 'key1');
      expect(mockSecretsManager.getSecret).toHaveBeenCalled();
      
      // Reset cache size
      credentialService.maxCacheSize = 100;
    });
  });
});