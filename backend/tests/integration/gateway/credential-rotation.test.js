/**
 * Integration tests for credential rotation and API key revocation
 */

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/gateway/app');
const setupTestDB = require('../../utils/setupTestDB');
const { userOne, admin, insertUsers } = require('../../fixtures/user.fixture');
const { userOneAccessToken, adminAccessToken } = require('../../fixtures/token.fixture');
const Provider = require('../../../src/models/provider.model');
const ApiKey = require('../../../src/models/apiKey.model');

setupTestDB();

describe('Credential Rotation and API Key Revocation', () => {
  let testProvider;
  let testApiKey;

  beforeEach(async () => {
    await insertUsers([userOne, admin]);

    // Create a test provider
    testProvider = await Provider.create({
      name: 'Test Provider',
      slug: 'test-provider',
      type: 'spawn-cli',
      description: 'Test provider for credential rotation',
      enabled: true,
      models: [
        {
          dyadModelId: 'test-model',
          adapterModelId: 'test-adapter-model',
          maxTokens: 4096,
          contextWindow: 4096,
          supportsStreaming: false,
          supportsEmbeddings: false,
        },
      ],
      adapterConfig: {
        command: '/bin/echo',
        args: ['test'],
        dockerSandbox: false,
        timeoutSeconds: 30,
      },
      credentials: new Map([
        ['apiKey', 'old-api-key'],
        ['secret', 'old-secret'],
      ]),
      rateLimits: {
        requestsPerMinute: 60,
        tokensPerMinute: 10000,
      },
    });

    // Create a test API key
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
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerDay: 1000,
        tokensPerMinute: 10000,
        tokensPerDay: 100000,
      },
    });
  });

  describe('POST /admin/providers/:providerId/rotate-credentials', () => {
    test('should rotate provider credentials successfully', async () => {
      const newCredentials = {
        apiKey: 'new-api-key',
        secret: 'new-secret',
      };

      const res = await request(app)
        .post(`/admin/providers/${testProvider._id}/rotate-credentials`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          credentials: newCredentials,
          reason: 'Security rotation',
        })
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'success',
        message: 'Credentials rotated successfully',
        providerId: testProvider._id.toString(),
        providerName: testProvider.name,
        testResult: {
          status: expect.any(String),
        },
      });

      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('duration');

      // Verify credentials were updated in database
      const updatedProvider = await Provider.findById(testProvider._id);
      expect(updatedProvider.credentials.get('apiKey')).toBe('new-api-key');
      expect(updatedProvider.credentials.get('secret')).toBe('new-secret');
    });

    test('should return 404 if provider not found', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const newCredentials = {
        apiKey: 'new-api-key',
      };

      await request(app)
        .post(`/admin/providers/${nonExistentId}/rotate-credentials`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          credentials: newCredentials,
        })
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 400 if credentials are invalid', async () => {
      await request(app)
        .post(`/admin/providers/${testProvider._id}/rotate-credentials`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          credentials: {},
        })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if not authenticated', async () => {
      const newCredentials = {
        apiKey: 'new-api-key',
      };

      await request(app)
        .post(`/admin/providers/${testProvider._id}/rotate-credentials`)
        .send({
          credentials: newCredentials,
        })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 if not admin', async () => {
      const newCredentials = {
        apiKey: 'new-api-key',
      };

      await request(app)
        .post(`/admin/providers/${testProvider._id}/rotate-credentials`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({
          credentials: newCredentials,
        })
        .expect(httpStatus.FORBIDDEN);
    });

    test('should rollback credentials if test fails', async () => {
      // Create a provider with invalid adapter config that will fail testing
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

      const newCredentials = {
        apiKey: 'new-key-that-will-fail',
      };

      const res = await request(app)
        .post(`/admin/providers/${failingProvider._id}/rotate-credentials`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          credentials: newCredentials,
        })
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error.message).toContain('rotation failed');

      // Verify credentials were rolled back
      const rolledBackProvider = await Provider.findById(failingProvider._id);
      expect(rolledBackProvider.credentials.get('apiKey')).toBe('old-key');
    });
  });

  describe('POST /admin/apikeys/:apiKeyId/revoke', () => {
    test('should revoke API key successfully', async () => {
      const res = await request(app)
        .post(`/admin/apikeys/${testApiKey._id}/revoke`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          reason: 'Security breach',
        })
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'revoked',
        message: 'API key revoked successfully',
        apiKeyId: testApiKey._id.toString(),
        apiKeyName: testApiKey.name,
        reason: 'Security breach',
        revokedBy: admin._id.toString(),
      });

      expect(res.body).toHaveProperty('revokedAt');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('duration');

      // Verify API key was disabled in database
      const revokedApiKey = await ApiKey.findById(testApiKey._id);
      expect(revokedApiKey.enabled).toBe(false);
      expect(revokedApiKey.metadata.get('revokedBy')).toBe(admin._id.toString());
      expect(revokedApiKey.metadata.get('revocationReason')).toBe('Security breach');
      expect(revokedApiKey.metadata.get('revokedAt')).toBeDefined();
    });

    test('should handle already revoked API key', async () => {
      // First revocation
      await request(app)
        .post(`/admin/apikeys/${testApiKey._id}/revoke`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          reason: 'First revocation',
        })
        .expect(httpStatus.OK);

      // Second revocation attempt
      const res = await request(app)
        .post(`/admin/apikeys/${testApiKey._id}/revoke`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          reason: 'Second revocation',
        })
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'already_revoked',
        message: 'API key is already disabled',
        apiKeyId: testApiKey._id.toString(),
      });
    });

    test('should return 404 if API key not found', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await request(app)
        .post(`/admin/apikeys/${nonExistentId}/revoke`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          reason: 'Test revocation',
        })
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 401 if not authenticated', async () => {
      await request(app)
        .post(`/admin/apikeys/${testApiKey._id}/revoke`)
        .send({
          reason: 'Test revocation',
        })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 if not admin', async () => {
      await request(app)
        .post(`/admin/apikeys/${testApiKey._id}/revoke`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({
          reason: 'Test revocation',
        })
        .expect(httpStatus.FORBIDDEN);
    });

    test('should use default reason if not provided', async () => {
      const res = await request(app)
        .post(`/admin/apikeys/${testApiKey._id}/revoke`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({})
        .expect(httpStatus.OK);

      expect(res.body.reason).toBe('Manual revocation');

      // Verify in database
      const revokedApiKey = await ApiKey.findById(testApiKey._id);
      expect(revokedApiKey.metadata.get('revocationReason')).toBe('Manual revocation');
    });
  });

  describe('POST /admin/apikeys/:apiKeyId/regenerate', () => {
    test('should regenerate API key successfully', async () => {
      const originalKeyHash = testApiKey.keyHash;

      const res = await request(app)
        .post(`/admin/apikeys/${testApiKey._id}/regenerate`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          reason: 'Security rotation',
        })
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'regenerated',
        message: 'API key regenerated successfully',
        reason: 'Security rotation',
        regeneratedBy: admin._id.toString(),
      });

      expect(res.body.apiKey).toMatchObject({
        name: testApiKey.name,
        enabled: true,
      });
      expect(res.body.apiKey.id).toBe(testApiKey._id.toString());

      expect(res.body).toHaveProperty('rawKey');
      expect(res.body.rawKey).toMatch(/^dyad_/);
      expect(res.body).toHaveProperty('regeneratedAt');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('duration');

      // Verify API key was updated in database
      const regeneratedApiKey = await ApiKey.findById(testApiKey._id);
      expect(regeneratedApiKey.keyHash).not.toBe(originalKeyHash);
      expect(regeneratedApiKey.enabled).toBe(true);
      expect(regeneratedApiKey.metadata.get('regeneratedBy')).toBe(admin._id.toString());
      expect(regeneratedApiKey.metadata.get('regenerationReason')).toBe('Security rotation');
      expect(regeneratedApiKey.usageStats.requestsToday).toBe(0);
      expect(regeneratedApiKey.usageStats.tokensToday).toBe(0);
    });

    test('should return 404 if API key not found', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await request(app)
        .post(`/admin/apikeys/${nonExistentId}/regenerate`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          reason: 'Test regeneration',
        })
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 401 if not authenticated', async () => {
      await request(app)
        .post(`/admin/apikeys/${testApiKey._id}/regenerate`)
        .send({
          reason: 'Test regeneration',
        })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 if not admin', async () => {
      await request(app)
        .post(`/admin/apikeys/${testApiKey._id}/regenerate`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({
          reason: 'Test regeneration',
        })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('Zero-downtime credential rotation workflow', () => {
    test('should maintain service availability during credential rotation', async () => {
      // This test simulates a zero-downtime rotation by ensuring the provider
      // remains functional throughout the rotation process

      const newCredentials = {
        apiKey: 'new-api-key-for-zero-downtime',
        secret: 'new-secret-for-zero-downtime',
      };

      // Perform credential rotation
      const rotationRes = await request(app)
        .post(`/admin/providers/${testProvider._id}/rotate-credentials`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          credentials: newCredentials,
          reason: 'Zero-downtime rotation test',
        })
        .expect(httpStatus.OK);

      expect(rotationRes.body.status).toBe('success');

      // Verify provider is still functional by testing it
      const testRes = await request(app)
        .post(`/admin/providers/${testProvider._id}/test`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ dryRun: false })
        .expect(httpStatus.OK);

      expect(testRes.body.status).toBe('success');

      // Verify health status is healthy
      const healthRes = await request(app)
        .post(`/admin/providers/${testProvider._id}/health`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({})
        .expect(httpStatus.OK);

      expect(healthRes.body.status).toBe('healthy');
    });

    test('should immediately invalidate revoked API keys', async () => {
      // Create a raw key for testing authentication
      const rawKey = ApiKey.generateKey();
      const keyHash = await ApiKey.hashKey(rawKey);
      const keyPrefix = ApiKey.getKeyPrefix(rawKey);

      const activeApiKey = await ApiKey.create({
        name: 'Active Test Key',
        keyHash,
        keyPrefix,
        userId: userOne._id,
        permissions: ['chat', 'models'],
        enabled: true,
      });

      // Verify the key works before revocation
      const beforeRevocationRes = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(httpStatus.OK);

      expect(beforeRevocationRes.body).toHaveProperty('data');

      // Revoke the API key
      await request(app)
        .post(`/admin/apikeys/${activeApiKey._id}/revoke`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          reason: 'Immediate invalidation test',
        })
        .expect(httpStatus.OK);

      // Verify the key is immediately invalid
      await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });
});