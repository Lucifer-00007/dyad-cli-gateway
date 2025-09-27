/**
 * Key Rotation Service Unit Tests
 */

const keyRotationService = require('../../../src/services/key-rotation.service');
const { createSecretsManager } = require('../../../src/services/secrets.service');
const credentialService = require('../../../src/services/credential.service');
const Provider = require('../../../src/models/provider.model');

// Mock dependencies
jest.mock('../../../src/services/secrets.service');
jest.mock('../../../src/services/credential.service');
jest.mock('../../../src/models/provider.model');
jest.mock('node-cron');

describe('Key Rotation Service', () => {
  let mockSecretsManager;

  beforeEach(() => {
    mockSecretsManager = {
      rotateEncryptionKey: jest.fn(),
    };
    
    createSecretsManager.mockReturnValue(mockSecretsManager);
    
    // Mock credential service methods
    credentialService.getProviderCredentials = jest.fn();
    credentialService.storeProviderCredentials = jest.fn();
    credentialService.testConnection = jest.fn();
    
    // Mock Provider model
    Provider.find = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRotationStatus', () => {
    test('should return current rotation status', () => {
      const status = keyRotationService.getRotationStatus();
      
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('isRotating');
      expect(status).toHaveProperty('lastRotation');
      expect(status).toHaveProperty('nextRotation');
      expect(status).toHaveProperty('intervalHours');
      expect(status).toHaveProperty('schedule');
      expect(status).toHaveProperty('jobActive');
    });
  });

  describe('performRotation', () => {
    test('should perform successful key rotation', async () => {
      // Mock successful rotation
      mockSecretsManager.rotateEncryptionKey.mockResolvedValue('new-key-version-123');
      
      // Mock empty provider list for simplicity
      Provider.find.mockResolvedValue([]);
      
      const result = await keyRotationService.performRotation();
      
      expect(result.success).toBe(true);
      expect(result.newKeyVersion).toBe('new-key-version-123');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.lastRotation).toBeInstanceOf(Date);
      expect(result.nextRotation).toBeInstanceOf(Date);
    });

    test('should handle rotation failure', async () => {
      // Mock rotation failure
      mockSecretsManager.rotateEncryptionKey.mockRejectedValue(new Error('KMS error'));
      
      const result = await keyRotationService.performRotation();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('KMS error');
      expect(result.duration).toBeGreaterThan(0);
    });

    test('should prevent concurrent rotations', async () => {
      // Mock long-running rotation
      mockSecretsManager.rotateEncryptionKey.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('new-version'), 100))
      );
      Provider.find.mockResolvedValue([]);
      
      // Start first rotation
      const rotation1Promise = keyRotationService.performRotation();
      
      // Try to start second rotation immediately
      await expect(keyRotationService.performRotation()).rejects.toThrow('Key rotation is already in progress');
      
      // Wait for first rotation to complete
      const result = await rotation1Promise;
      expect(result.success).toBe(true);
    });

    test('should allow forced rotation even when one is in progress', async () => {
      // Mock long-running rotation
      mockSecretsManager.rotateEncryptionKey.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('new-version'), 100))
      );
      Provider.find.mockResolvedValue([]);
      
      // Start first rotation
      const rotation1Promise = keyRotationService.performRotation();
      
      // Force second rotation
      const rotation2Promise = keyRotationService.performRotation(true);
      
      // Both should complete successfully
      const [result1, result2] = await Promise.all([rotation1Promise, rotation2Promise]);
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('reencryptProviderCredentials', () => {
    test('should re-encrypt all provider credentials', async () => {
      // Mock providers with credentials
      const mockProviders = [
        {
          _id: 'provider1',
          slug: 'test-provider-1',
          credentials: new Map([['api_key', '[STORED_EXTERNALLY]']]),
        },
        {
          _id: 'provider2',
          slug: 'test-provider-2',
          credentials: new Map([['secret_key', '[STORED_EXTERNALLY]']]),
        },
      ];
      
      Provider.find.mockResolvedValue(mockProviders);
      
      // Mock credential service calls
      credentialService.getProviderCredentials
        .mockResolvedValueOnce(new Map([['api_key', 'decrypted-value-1']]))
        .mockResolvedValueOnce(new Map([['secret_key', 'decrypted-value-2']]));
      
      credentialService.storeProviderCredentials.mockResolvedValue();
      
      await keyRotationService.reencryptProviderCredentials();
      
      expect(credentialService.getProviderCredentials).toHaveBeenCalledTimes(2);
      expect(credentialService.storeProviderCredentials).toHaveBeenCalledTimes(2);
      expect(credentialService.storeProviderCredentials).toHaveBeenCalledWith(
        'provider1',
        new Map([['api_key', 'decrypted-value-1']])
      );
      expect(credentialService.storeProviderCredentials).toHaveBeenCalledWith(
        'provider2',
        new Map([['secret_key', 'decrypted-value-2']])
      );
    });

    test('should handle providers without credentials', async () => {
      const mockProviders = [
        {
          _id: 'provider1',
          slug: 'test-provider-1',
          credentials: new Map(),
        },
        {
          _id: 'provider2',
          slug: 'test-provider-2',
          credentials: null,
        },
      ];
      
      Provider.find.mockResolvedValue(mockProviders);
      
      await keyRotationService.reencryptProviderCredentials();
      
      expect(credentialService.getProviderCredentials).not.toHaveBeenCalled();
      expect(credentialService.storeProviderCredentials).not.toHaveBeenCalled();
    });

    test('should handle individual provider failures', async () => {
      const mockProviders = [
        {
          _id: 'provider1',
          slug: 'test-provider-1',
          credentials: new Map([['api_key', '[STORED_EXTERNALLY]']]),
        },
        {
          _id: 'provider2',
          slug: 'test-provider-2',
          credentials: new Map([['secret_key', '[STORED_EXTERNALLY]']]),
        },
      ];
      
      Provider.find.mockResolvedValue(mockProviders);
      
      // Mock first provider success, second provider failure
      credentialService.getProviderCredentials
        .mockResolvedValueOnce(new Map([['api_key', 'decrypted-value-1']]))
        .mockRejectedValueOnce(new Error('Credential retrieval failed'));
      
      credentialService.storeProviderCredentials.mockResolvedValue();
      
      await expect(keyRotationService.reencryptProviderCredentials()).rejects.toThrow('Failed to re-encrypt 1 provider credentials');
      
      expect(credentialService.storeProviderCredentials).toHaveBeenCalledTimes(1);
    });
  });

  describe('rotateProviderCredentials', () => {
    test('should rotate credentials for specific provider', async () => {
      const mockProvider = {
        _id: 'provider123',
        slug: 'test-provider',
        credentials: new Map(),
        save: jest.fn().mockResolvedValue(),
      };
      
      Provider.findById = jest.fn().mockResolvedValue(mockProvider);
      credentialService.rotateProviderCredentials = jest.fn().mockResolvedValue();
      
      const newCredentials = {
        api_key: 'new-api-key',
        secret_key: 'new-secret-key',
      };
      
      await keyRotationService.rotateProviderCredentials('provider123', newCredentials);
      
      expect(credentialService.rotateProviderCredentials).toHaveBeenCalledWith('provider123', newCredentials);
      expect(mockProvider.credentials).toEqual(new Map(Object.entries(newCredentials)));
      expect(mockProvider.save).toHaveBeenCalled();
    });

    test('should throw error for non-existent provider', async () => {
      Provider.findById = jest.fn().mockResolvedValue(null);
      
      await expect(keyRotationService.rotateProviderCredentials('nonexistent', {}))
        .rejects.toThrow('Provider nonexistent not found');
    });
  });

  describe('testRotation', () => {
    test('should return success for valid configuration', async () => {
      credentialService.testConnection.mockResolvedValue(true);
      mockSecretsManager.rotateEncryptionKey.mockRejectedValue(new Error('Test key not found'));
      
      const result = await keyRotationService.testRotation();
      
      expect(result.success).toBe(true);
      expect(result.secretsManagerConnected).toBe(true);
    });

    test('should return failure for invalid configuration', async () => {
      credentialService.testConnection.mockResolvedValue(false);
      
      const result = await keyRotationService.testRotation();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Secrets manager connection test failed');
    });
  });

  describe('getRotationHistory', () => {
    test('should return rotation history', async () => {
      const history = await keyRotationService.getRotationHistory();
      
      expect(Array.isArray(history)).toBe(true);
    });

    test('should include last rotation if available', async () => {
      // Perform a rotation to set lastRotation
      mockSecretsManager.rotateEncryptionKey.mockResolvedValue('new-version');
      Provider.find.mockResolvedValue([]);
      
      await keyRotationService.performRotation();
      
      const history = await keyRotationService.getRotationHistory();
      
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('status');
      expect(history[0]).toHaveProperty('keyVersion');
    });
  });
});