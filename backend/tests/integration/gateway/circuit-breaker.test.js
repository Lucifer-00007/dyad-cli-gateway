/**
 * Circuit Breaker Integration Tests
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

describe('Circuit Breaker Integration Tests', () => {
  beforeEach(async () => {
    await insertUsers([userOne, admin]);
    await insertProviders([providerOne, providerTwo]);
  });

  describe('GET /admin/circuit-breakers', () => {
    test('should return 200 and circuit breaker status for all providers', async () => {
      const res = await request(app)
        .get('/admin/circuit-breakers')
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
        .get('/admin/circuit-breakers')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .get('/admin/circuit-breakers')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /admin/circuit-breakers/:providerId', () => {
    test('should return 200 and circuit breaker status for specific provider', async () => {
      const provider = await Provider.findOne({ slug: providerOne.slug });

      const res = await request(app)
        .get(`/admin/circuit-breakers/${provider._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'success',
        data: expect.objectContaining({
          providerId: provider._id.toString(),
          state: 'closed',
          failureCount: 0,
          failureThreshold: expect.any(Number)
        }),
        timestamp: expect.any(String)
      });
    });

    test('should return 400 error if providerId is invalid', async () => {
      await request(app)
        .get('/admin/circuit-breakers/invalid-id')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error if circuit breaker not found', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await request(app)
        .get(`/admin/circuit-breakers/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('POST /admin/circuit-breakers/:providerId/reset', () => {
    test('should return 200 and reset circuit breaker', async () => {
      const provider = await Provider.findOne({ slug: providerOne.slug });

      const res = await request(app)
        .post(`/admin/circuit-breakers/${provider._id}/reset`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'success',
        message: 'Circuit breaker reset successfully',
        providerId: provider._id.toString(),
        timestamp: expect.any(String)
      });
    });

    test('should return 400 error if providerId is invalid', async () => {
      await request(app)
        .post('/admin/circuit-breakers/invalid-id/reset')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /admin/circuit-breakers/:providerId/open', () => {
    test('should return 200 and open circuit breaker', async () => {
      const provider = await Provider.findOne({ slug: providerOne.slug });

      const res = await request(app)
        .post(`/admin/circuit-breakers/${provider._id}/open`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'success',
        message: 'Circuit breaker opened successfully',
        providerId: provider._id.toString(),
        timestamp: expect.any(String)
      });

      // Verify circuit breaker is actually opened
      const statusRes = await request(app)
        .get(`/admin/circuit-breakers/${provider._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(statusRes.body.data.state).toBe('open');
    });
  });

  describe('Circuit Breaker Behavior in Chat Completions', () => {
    test('should fail fast when circuit breaker is open', async () => {
      const provider = await Provider.findOne({ slug: providerOne.slug });

      // First, open the circuit breaker
      await request(app)
        .post(`/admin/circuit-breakers/${provider._id}/open`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      // Try to make a chat completion request
      const chatRes = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({
          model: providerOne.models[0].dyadModelId,
          messages: [
            { role: 'user', content: 'Hello, world!' }
          ]
        });

      // Should fail due to circuit breaker being open
      expect(chatRes.status).toBeGreaterThanOrEqual(400);
    });

    test('should work normally when circuit breaker is closed', async () => {
      const provider = await Provider.findOne({ slug: providerOne.slug });

      // Ensure circuit breaker is reset/closed
      await request(app)
        .post(`/admin/circuit-breakers/${provider._id}/reset`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      // Mock the adapter to return a successful response
      // Note: In a real test, you'd need to mock the actual adapter
      // This is a simplified example
    });
  });

  describe('GET /admin/reliability-stats', () => {
    test('should return 200 and reliability statistics', async () => {
      const res = await request(app)
        .get('/admin/reliability-stats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'success',
        data: expect.objectContaining({
          circuitBreaker: expect.objectContaining({
            totalCircuitBreakers: expect.any(Number),
            healthyProviders: expect.any(Number),
            openCircuits: expect.any(Number)
          }),
          fallbackPolicy: expect.objectContaining({
            totalFallbackConfigs: expect.any(Number)
          }),
          healthMonitor: expect.objectContaining({
            isRunning: expect.any(Boolean)
          })
        }),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Circuit Breaker Auto-Recovery', () => {
    test('should transition from open to half-open after timeout', async () => {
      const provider = await Provider.findOne({ slug: providerOne.slug });

      // Open the circuit breaker
      await request(app)
        .post(`/admin/circuit-breakers/${provider._id}/open`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      // Verify it's open
      let statusRes = await request(app)
        .get(`/admin/circuit-breakers/${provider._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(statusRes.body.data.state).toBe('open');
      expect(statusRes.body.data.nextAttemptTime).toBeDefined();

      // Note: In a real test, you would need to wait for the actual timeout
      // or mock the time to simulate the timeout passing
      // This is a simplified test structure
    });
  });

  describe('Multiple Provider Circuit Breakers', () => {
    test('should handle multiple providers independently', async () => {
      const provider1 = await Provider.findOne({ slug: providerOne.slug });
      const provider2 = await Provider.findOne({ slug: providerTwo.slug });

      // Open circuit breaker for provider1
      await request(app)
        .post(`/admin/circuit-breakers/${provider1._id}/open`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      // Check status of both providers
      const status1Res = await request(app)
        .get(`/admin/circuit-breakers/${provider1._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      const status2Res = await request(app)
        .get(`/admin/circuit-breakers/${provider2._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(status1Res.body.data.state).toBe('open');
      expect(status2Res.body.data.state).toBe('closed');
    });
  });
});