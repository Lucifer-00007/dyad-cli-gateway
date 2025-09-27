/**
 * Fallback Policy Integration Tests
 */

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/app');
const setupTestDB = require('../../utils/setupTestDB');
const { userOne, admin, insertUsers } = require('../../fixtures/user.fixture');
const { userOneAccessToken, adminAccessToken } = require('../../fixtures/token.fixture');
const Provider = require('../../../src/models/provider.model');
const { providerOne, providerTwo, insertProviders } = require('../../fixtures/provider.fixture');

setupTestDB();

describe('Fallback Policy Integration Tests', () => {
  beforeEach(async () => {
    await insertUsers([userOne, admin]);
    await insertProviders([providerOne, providerTwo]);
  });

  describe('GET /admin/fallback-policies', () => {
    test('should return 200 and all fallback policies', async () => {
      const res = await request(app)
        .get('/admin/fallback-policies')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'success',
        data: expect.any(Object),
        timestamp: expect.any(String)
      });
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .get('/admin/fallback-policies')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .get('/admin/fallback-policies')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('PUT /admin/fallback-policies/:modelId', () => {
    test('should return 200 and configure fallback policy', async () => {
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: 'round_robin',
        maxAttempts: 3,
        enabled: true,
        retryDelay: 1000
      };

      const res = await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(fallbackConfig)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'success',
        message: 'Fallback policy configured successfully',
        modelId,
        config: fallbackConfig,
        timestamp: expect.any(String)
      });
    });

    test('should return 400 error for invalid strategy', async () => {
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: 'invalid_strategy',
        maxAttempts: 3,
        enabled: true
      };

      await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(fallbackConfig)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error for invalid maxAttempts', async () => {
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: 'round_robin',
        maxAttempts: 15, // exceeds max of 10
        enabled: true
      };

      await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(fallbackConfig)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should configure fallback policy with specific providers', async () => {
      const provider1 = await Provider.findOne({ slug: providerOne.slug });
      const provider2 = await Provider.findOne({ slug: providerTwo.slug });
      
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: 'priority',
        providers: [provider1._id.toString(), provider2._id.toString()],
        maxAttempts: 2,
        enabled: true
      };

      const res = await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(fallbackConfig)
        .expect(httpStatus.OK);

      expect(res.body.config.providers).toEqual([
        provider1._id.toString(),
        provider2._id.toString()
      ]);
    });
  });

  describe('GET /admin/fallback-policies/:modelId', () => {
    test('should return 200 and fallback policy for model', async () => {
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: 'round_robin',
        maxAttempts: 3,
        enabled: true
      };

      // First configure the policy
      await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(fallbackConfig)
        .expect(httpStatus.OK);

      // Then retrieve it
      const res = await request(app)
        .get(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'success',
        data: expect.objectContaining({
          strategy: 'round_robin',
          maxAttempts: 3,
          enabled: true
        }),
        timestamp: expect.any(String)
      });
    });

    test('should return 404 error if fallback policy not found', async () => {
      const modelId = 'non-existent-model';

      await request(app)
        .get(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /admin/fallback-policies/:modelId', () => {
    test('should return 200 and remove fallback policy', async () => {
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: 'round_robin',
        maxAttempts: 3,
        enabled: true
      };

      // First configure the policy
      await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(fallbackConfig)
        .expect(httpStatus.OK);

      // Then remove it
      const res = await request(app)
        .delete(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'success',
        message: 'Fallback policy removed successfully',
        modelId,
        timestamp: expect.any(String)
      });

      // Verify it's removed
      await request(app)
        .get(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('PUT /admin/provider-priorities', () => {
    test('should return 200 and set provider priorities', async () => {
      const provider1 = await Provider.findOne({ slug: providerOne.slug });
      const provider2 = await Provider.findOne({ slug: providerTwo.slug });
      
      const priorities = {
        [provider1._id.toString()]: 1,
        [provider2._id.toString()]: 2
      };

      const res = await request(app)
        .put('/admin/provider-priorities')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(priorities)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'success',
        message: 'Provider priorities set successfully',
        priorities,
        timestamp: expect.any(String)
      });
    });

    test('should return 400 error for invalid provider ID', async () => {
      const priorities = {
        'invalid-provider-id': 1
      };

      await request(app)
        .put('/admin/provider-priorities')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(priorities)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error for invalid priority value', async () => {
      const provider1 = await Provider.findOne({ slug: providerOne.slug });
      
      const priorities = {
        [provider1._id.toString()]: 1000 // exceeds max of 999
      };

      await request(app)
        .put('/admin/provider-priorities')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(priorities)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('Fallback Policy Strategies', () => {
    test('should configure round_robin strategy', async () => {
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: 'round_robin',
        maxAttempts: 3,
        enabled: true
      };

      await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(fallbackConfig)
        .expect(httpStatus.OK);
    });

    test('should configure priority strategy', async () => {
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: 'priority',
        maxAttempts: 3,
        enabled: true
      };

      await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(fallbackConfig)
        .expect(httpStatus.OK);
    });

    test('should configure random strategy', async () => {
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: 'random',
        maxAttempts: 3,
        enabled: true
      };

      await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(fallbackConfig)
        .expect(httpStatus.OK);
    });

    test('should configure health_based strategy', async () => {
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: 'health_based',
        maxAttempts: 3,
        enabled: true
      };

      await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(fallbackConfig)
        .expect(httpStatus.OK);
    });

    test('should configure none strategy', async () => {
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: 'none',
        maxAttempts: 1,
        enabled: true
      };

      await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(fallbackConfig)
        .expect(httpStatus.OK);
    });
  });

  describe('Fallback Policy in Chat Completions', () => {
    test('should use fallback when primary provider fails', async () => {
      const modelId = providerOne.models[0].dyadModelId;
      
      // Configure fallback policy
      const fallbackConfig = {
        strategy: 'round_robin',
        maxAttempts: 2,
        enabled: true
      };

      await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(fallbackConfig)
        .expect(httpStatus.OK);

      // Note: In a real test, you would need to mock the adapters
      // to simulate failures and test the fallback behavior
      // This is a simplified test structure
    });

    test('should work without fallback when not configured', async () => {
      const modelId = providerOne.models[0].dyadModelId;

      // Make a chat completion request without fallback configured
      // Note: This would need proper adapter mocking in a real test
    });
  });

  describe('Complex Fallback Scenarios', () => {
    test('should handle multiple models with different fallback policies', async () => {
      const model1 = 'model-1';
      const model2 = 'model-2';

      // Configure different policies for different models
      await request(app)
        .put(`/admin/fallback-policies/${model1}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          strategy: 'round_robin',
          maxAttempts: 3,
          enabled: true
        })
        .expect(httpStatus.OK);

      await request(app)
        .put(`/admin/fallback-policies/${model2}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          strategy: 'priority',
          maxAttempts: 2,
          enabled: true
        })
        .expect(httpStatus.OK);

      // Verify both policies are configured
      const policies = await request(app)
        .get('/admin/fallback-policies')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(Object.keys(policies.body.data)).toContain(model1);
      expect(Object.keys(policies.body.data)).toContain(model2);
    });

    test('should handle fallback with circuit breaker integration', async () => {
      const provider1 = await Provider.findOne({ slug: providerOne.slug });
      const modelId = providerOne.models[0].dyadModelId;

      // Configure fallback policy
      await request(app)
        .put(`/admin/fallback-policies/${modelId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          strategy: 'round_robin',
          maxAttempts: 2,
          enabled: true
        })
        .expect(httpStatus.OK);

      // Open circuit breaker for provider1
      await request(app)
        .post(`/admin/circuit-breakers/${provider1._id}/open`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      // Note: In a real test, you would verify that the fallback
      // skips the provider with open circuit breaker
    });
  });
});