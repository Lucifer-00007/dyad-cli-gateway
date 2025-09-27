/**
 * Unit tests for credential rotation and API key revocation services
 */

const httpStatus = require('http-status');
const { ProviderService, ApiKeyService } = require('../../../../src/gateway/services');
const Provider = require('../../../../src/models/provider.model');
const ApiKey = require('../../../../src/models/apiKey.model');
const ApiError = require('../../../../src/utils/ApiError');
const setupTestDB = require('../../../utils/setupTestDB');
const { userOne, insertUsers } = require('../../../fixtures/user.fixture');

setupTestDB();

describe('Credential Rotation and API Key Revocation Services', () => {
  let providerService;
  let apiKeyService;
  let testProvider;
  let testApiKey;

  beforeEach(async () => {
    await insertUsers([userOne]);
    
    providerService = new ProviderService();
    apiKeyService = new ApiKeyService();

    // Create test provider
    testProvider = await Provider.create({
      name: 'Test Provider',
      slug: 'test-provider',
      type: 'spawn-cli',
      enabled: true,
      models: [
        {
          dyadModelId: 'test-model',
          adapterModelId: 'test-adapter-model',
          maxTokens: 4096,
        },
      ],
      adapterConfig: {
        command: '/bin/echo',
        args: ['test'],
        dockerSandbox: false,
      },
      credentials: new Map([
        ['apiKey', 'old-api-key'],
        ['secret', 'old-secret'],
      ]),
    });

    // Create test API key
    const rawKey = ApiKey.generateKey();
    const keyHash = await ApiKey.hashKey(rawKey);
    const keyPrefix = ApiKey.getKeyPrefix(rawKey);

    testApiKey = await ApiKey.create({
      name: 'Test API Key',
      keyHash,
      keyPrefix,
      userId: userOne._id,
      permissions: ['chat', 'models'],
      enabled: true,
    });
  });

  describe('ProviderService.rotateProviderCredentials', () => {
    test('should rotate credentials successfully', async () => {
      const newCredentials = {
        apiKey: 'new-api-key',
        secret: 'new-secret',
      };

      const result = await providerService.rotateProviderCredentials(testProvider._id, newCredentials);

      expect(result).toMatchObject({
        status: 'success',
        message: 'Credentials rotated successfully',
        providerId: testProvider._id.toString(),
        providerName: testProvider.name,
        testResult: {
          status: expect.any(String),
        },
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('duration');

      // Verify credentials were updated
      const updatedProvider = await Provider.findById(testProvider._id);
      expect(updatedProvider.credentials.get('apiKey')).toBe('new-api-key');
      expect(updatedProvider.credentials.get('secret')).toBe('new-secret');
    });

    test('should throw error if provider not found', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const newCredentials = { apiKey: 'new-key' };

      await expect(
        providerService.rotateProviderCredentials(nonExistentId, newCredentials)
      ).rejects.toThrow(ApiError);

      await expect(
        providerService.rotateProviderCredentials(nonExistentId, newCredentials)
      ).rejects.toMatchObject({
        statusCode: httpStatus.NOT_FOUND,
        message: 'Provider not found',
      });
    });

    test('should rollback credentials if test fails', async () => {
      // Create provider with invalid config that will fail testing
      const failingProvider = await Provider.create({
        name: 'Failing Provider',
        slug: 'failing-provider',
        type: 'spawn-cli',
        enabled: true,
        models: [
          {
            dyadModelId: 'failing-model',
            adapterModelId: 'failing-adapter-model',
            maxTokens: 4096,
          },
        ],
        adapterConfig: {
          command: '/nonexistent/command',
          dockerSandbox: false,
        },
        credentials: new Map([['apiKey', 'old-key']]),
      });

      const newCredentials = { apiKey: 'new-key-that-will-fail' };

      await expect(
        providerService.rotateProviderCredentials(failingProvider._id, newCredentials)
      ).rejects.toThrow(ApiError);

      // Verify credentials were rolled back
      const rolledBackProvider = await Provider.findById(failingProvider._id);
      expect(rolledBackProvider.credentials.get('apiKey')).toBe('old-key');
    });

    test('should update health status on successful rotation', async () => {
      const newCredentials = { apiKey: 'new-working-key' };

      await providerService.rotateProviderCredentials(testProvider._id, newCredentials);

      const updatedProvider = await Provider.findById(testProvider._id);
      expect(updatedProvider.healthStatus.status).toBe('healthy');
      expect(updatedProvider.healthStatus.lastChecked).toBeDefined();
    });

    test('should handle rotation with partial credentials', async () => {
      const newCredentials = { apiKey: 'new-api-key-only' };

      const result = await providerService.rotateProviderCredentials(testProvider._id, newCredentials);

      expect(result.status).toBe('success');

      const updatedProvider = await Provider.findById(testProvider._id);
      expect(updatedProvider.credentials.get('apiKey')).toBe('new-api-key-only');
      expect(updatedProvider.credentials.get('secret')).toBeUndefined();
    });
  });

  describe('ApiKeyService.revokeApiKey', () => {
    test('should revoke API key successfully', async () => {
      const options = {
        reason: 'Security breach',
        revokedBy: 'admin-user-id',
      };

      const result = await apiKeyService.revokeApiKey(testApiKey._id, options);

      expect(result).toMatchObject({
        status: 'revoked',
        message: 'API key revoked successfully',
        apiKeyId: testApiKey._id.toString(),
        apiKeyName: testApiKey.name,
        reason: 'Security breach',
        revokedBy: 'admin-user-id',
      });

      expect(result).toHaveProperty('revokedAt');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('duration');

      // Verify API key was disabled
      const revokedApiKey = await ApiKey.findById(testApiKey._id);
      expect(revokedApiKey.enabled).toBe(false);
      expect(revokedApiKey.metadata.get('revokedBy')).toBe('admin-user-id');
      expect(revokedApiKey.metadata.get('revocationReason')).toBe('Security breach');
      expect(revokedApiKey.metadata.get('revokedAt')).toBeDefined();
    });

    test('should handle already revoked API key', async () => {
      // First revocation
      await apiKeyService.revokeApiKey(testApiKey._id, {
        reason: 'First revocation',
        revokedBy: 'admin1',
      });

      // Second revocation attempt
      const result = await apiKeyService.revokeApiKey(testApiKey._id, {
        reason: 'Second revocation',
        revokedBy: 'admin2',
      });

      expect(result).toMatchObject({
        status: 'already_revoked',
        message: 'API key is already disabled',
        apiKeyId: testApiKey._id.toString(),
        apiKeyName: testApiKey.name,
      });
    });

    test('should throw error if API key not found', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(
        apiKeyService.revokeApiKey(nonExistentId, { reason: 'Test' })
      ).rejects.toThrow(ApiError);

      await expect(
        apiKeyService.revokeApiKey(nonExistentId, { reason: 'Test' })
      ).rejects.toMatchObject({
        statusCode: httpStatus.NOT_FOUND,
        message: 'API key not found',
      });
    });

    test('should use default reason if not provided', async () => {
      const result = await apiKeyService.revokeApiKey(testApiKey._id, {});

      expect(result.reason).toBe('Manual revocation');

      const revokedApiKey = await ApiKey.findById(testApiKey._id);
      expect(revokedApiKey.metadata.get('revocationReason')).toBe('Manual revocation');
    });

    test('should set revokedBy to system if not provided', async () => {
      const result = await apiKeyService.revokeApiKey(testApiKey._id, {
        reason: 'Automated revocation',
      });

      expect(result.revokedBy).toBe('system');

      const revokedApiKey = await ApiKey.findById(testApiKey._id);
      expect(revokedApiKey.metadata.get('revokedBy')).toBe('system');
    });
  });

  describe('ApiKeyService.regenerateApiKey', () => {
    test('should regenerate API key successfully', async () => {
      const originalKeyHash = testApiKey.keyHash;
      const originalUsageStats = testApiKey.usageStats;

      // Add some usage stats to verify they get reset
      testApiKey.usageStats.requestsToday = 10;
      testApiKey.usageStats.tokensToday = 1000;
      await testApiKey.save();

      const options = {
        reason: 'Security rotation',
        regeneratedBy: 'admin-user-id',
      };

      const result = await apiKeyService.regenerateApiKey(testApiKey._id, options);

      expect(result).toMatchObject({
        status: 'regenerated',
        message: 'API key regenerated successfully',
        reason: 'Security rotation',
        regeneratedBy: 'admin-user-id',
      });

      expect(result.apiKey).toMatchObject({
        _id: testApiKey._id,
        name: testApiKey.name,
        enabled: true,
      });

      expect(result).toHaveProperty('rawKey');
      expect(result.rawKey).toMatch(/^dyad_/);
      expect(result).toHaveProperty('regeneratedAt');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('duration');

      // Verify API key was updated
      const regeneratedApiKey = await ApiKey.findById(testApiKey._id);
      expect(regeneratedApiKey.keyHash).not.toBe(originalKeyHash);
      expect(regeneratedApiKey.enabled).toBe(true);
      expect(regeneratedApiKey.metadata.get('regeneratedBy')).toBe('admin-user-id');
      expect(regeneratedApiKey.metadata.get('regenerationReason')).toBe('Security rotation');
      
      // Verify usage stats were reset
      expect(regeneratedApiKey.usageStats.requestsToday).toBe(0);
      expect(regeneratedApiKey.usageStats.tokensToday).toBe(0);
      expect(regeneratedApiKey.usageStats.requestsThisMonth).toBe(0);
      expect(regeneratedApiKey.usageStats.tokensThisMonth).toBe(0);
    });

    test('should throw error if API key not found', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(
        apiKeyService.regenerateApiKey(nonExistentId, { reason: 'Test' })
      ).rejects.toThrow(ApiError);

      await expect(
        apiKeyService.regenerateApiKey(nonExistentId, { reason: 'Test' })
      ).rejects.toMatchObject({
        statusCode: httpStatus.NOT_FOUND,
        message: 'API key not found',
      });
    });

    test('should use default reason if not provided', async () => {
      const result = await apiKeyService.regenerateApiKey(testApiKey._id, {});

      expect(result.reason).toBe('Manual regeneration');

      const regeneratedApiKey = await ApiKey.findById(testApiKey._id);
      expect(regeneratedApiKey.metadata.get('regenerationReason')).toBe('Manual regeneration');
    });

    test('should set regeneratedBy to system if not provided', async () => {
      const result = await apiKeyService.regenerateApiKey(testApiKey._id, {
        reason: 'Automated regeneration',
      });

      expect(result.regeneratedBy).toBe('system');

      const regeneratedApiKey = await ApiKey.findById(testApiKey._id);
      expect(regeneratedApiKey.metadata.get('regeneratedBy')).toBe('system');
    });

    test('should enable disabled API key during regeneration', async () => {
      // Disable the API key first
      testApiKey.enabled = false;
      await testApiKey.save();

      const result = await apiKeyService.regenerateApiKey(testApiKey._id, {
        reason: 'Re-enable and regenerate',
      });

      expect(result.status).toBe('regenerated');

      const regeneratedApiKey = await ApiKey.findById(testApiKey._id);
      expect(regeneratedApiKey.enabled).toBe(true);
    });
  });

  describe('Zero-downtime workflow validation', () => {
    test('should maintain provider availability during credential rotation', async () => {
      const newCredentials = { apiKey: 'new-zero-downtime-key' };

      // Verify provider is healthy before rotation
      const healthBefore = await providerService.checkProviderHealth(testProvider._id);
      expect(healthBefore.status).toBe('healthy');

      // Perform rotation
      const rotationResult = await providerService.rotateProviderCredentials(testProvider._id, newCredentials);
      expect(rotationResult.status).toBe('success');

      // Verify provider is still healthy after rotation
      const healthAfter = await providerService.checkProviderHealth(testProvider._id);
      expect(healthAfter.status).toBe('healthy');

      // Verify test still passes
      const testResult = await providerService.testProvider(testProvider._id, { dryRun: false });
      expect(testResult.status).toBe('success');
    });

    test('should immediately invalidate revoked API keys', async () => {
      // Verify API key is enabled before revocation
      expect(testApiKey.enabled).toBe(true);

      // Revoke the API key
      const revocationResult = await apiKeyService.revokeApiKey(testApiKey._id, {
        reason: 'Immediate invalidation test',
      });

      expect(revocationResult.status).toBe('revoked');

      // Verify API key is immediately disabled
      const revokedApiKey = await ApiKey.findById(testApiKey._id);
      expect(revokedApiKey.enabled).toBe(false);

      // Verify findByKey returns null for revoked key
      const rawKey = ApiKey.generateKey();
      const keyHash = await ApiKey.hashKey(rawKey);
      
      // Update the test key with the raw key for testing
      revokedApiKey.keyHash = keyHash;
      revokedApiKey.keyPrefix = ApiKey.getKeyPrefix(rawKey);
      await revokedApiKey.save();

      const foundKey = await ApiKey.findByKey(rawKey);
      expect(foundKey).toBeNull(); // Should not find disabled key
    });
  });
});