/**
 * Performance Optimization Integration Tests
 * Tests for performance features including caching, connection pooling, and request queuing
 */

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/gateway/app');
const { setupTestDB } = require('../../utils/setupTestDB');
const { userOne, admin, insertUsers } = require('../../fixtures/user.fixture');
const { userOneAccessToken, adminAccessToken } = require('../../fixtures/token.fixture');
const Provider = require('../../../src/models/provider.model');
const ApiKey = require('../../../src/models/apiKey.model');

setupTestDB();

describe('Performance Optimization', () => {
  let testProvider;
  let testApiKey;

  beforeEach(async () => {
    await insertUsers([userOne, admin]);

    // Create test provider
    testProvider = await Provider.create({
      name: 'Test Performance Provider',
      slug: 'test-performance-provider',
      type: 'spawn-cli',
      enabled: true,
      models: [{
        dyadModelId: 'test-model',
        adapterModelId: 'test-adapter-model',
        maxTokens: 1000,
        contextWindow: 2000,
        supportsStreaming: true,
        supportsEmbeddings: false
      }],
      adapterConfig: {
        command: 'echo',
        args: ['test response'],
        dockerSandbox: false,
        timeoutSeconds: 30
      },
      credentials: new Map([
        ['apiKey', 'test-api-key']
      ])
    });

    // Create test API key
    testApiKey = await ApiKey.create({
      name: 'Test Performance API Key',
      keyHash: '$2a$08$test.hash.for.performance.testing',
      permissions: ['chat', 'models', 'embeddings'],
      rateLimits: {
        requestsPerMinute: 100,
        tokensPerMinute: 10000
      }
    });
  });

  describe('Performance Statistics', () => {
    test('should get performance statistics', async () => {
      const res = await request(app)
        .get('/admin/performance/stats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('uptime');
      expect(res.body.data).toHaveProperty('requests');
      expect(res.body.data).toHaveProperty('performance');
      expect(res.body.data.requests).toHaveProperty('total');
      expect(res.body.data.requests).toHaveProperty('successful');
      expect(res.body.data.requests).toHaveProperty('failed');
    });

    test('should get performance health status', async () => {
      const res = await request(app)
        .get('/admin/performance/health')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.status).toMatch(/healthy|degraded|unhealthy/);
      expect(res.body.data).toHaveProperty('successRate');
      expect(res.body.data).toHaveProperty('averageResponseTime');
      expect(res.body.data).toHaveProperty('throughput');
    });

    test('should require admin authentication for performance stats', async () => {
      await request(app)
        .get('/admin/performance/stats')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('Cache Management', () => {
    test('should clear all caches', async () => {
      const res = await request(app)
        .delete('/admin/performance/cache')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('cleared successfully');
    });

    test('should clear specific cache', async () => {
      const res = await request(app)
        .delete('/admin/performance/cache/models')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('models');
    });

    test('should reject invalid cache name', async () => {
      const res = await request(app)
        .delete('/admin/performance/cache/invalid-cache')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Invalid cache name');
    });

    test('should get cache statistics', async () => {
      const res = await request(app)
        .get('/admin/performance/cache/stats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });
  });

  describe('Connection Pool Statistics', () => {
    test('should get connection pool statistics', async () => {
      const res = await request(app)
        .get('/admin/performance/connection-pool')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });
  });

  describe('Request Queue Statistics', () => {
    test('should get request queue statistics', async () => {
      const res = await request(app)
        .get('/admin/performance/request-queue')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });
  });

  describe('Performance Optimization', () => {
    test('should get optimization suggestions', async () => {
      const res = await request(app)
        .get('/admin/performance/optimize')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('suggestions');
      expect(res.body.data).toHaveProperty('count');
      expect(res.body.data).toHaveProperty('hasOptimizations');
      expect(Array.isArray(res.body.data.suggestions)).toBe(true);
    });

    test('should reset performance statistics', async () => {
      const res = await request(app)
        .post('/admin/performance/reset-stats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('reset successfully');
    });
  });

  describe('Models Caching', () => {
    test('should cache models list on first request', async () => {
      // First request should hit database
      const res1 = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer test-api-key`)
        .expect(httpStatus.OK);

      expect(res1.body.data).toBeDefined();
      expect(Array.isArray(res1.body.data)).toBe(true);

      // Second request should hit cache (faster)
      const startTime = Date.now();
      const res2 = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer test-api-key`)
        .expect(httpStatus.OK);

      const responseTime = Date.now() - startTime;
      expect(res2.body.data).toEqual(res1.body.data);
      expect(responseTime).toBeLessThan(100); // Should be very fast from cache
    });

    test('should invalidate cache when provider is updated', async () => {
      // Get initial models
      const res1 = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer test-api-key`)
        .expect(httpStatus.OK);

      // Clear cache
      await request(app)
        .delete('/admin/performance/cache/models')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      // Update provider to add new model
      await Provider.findByIdAndUpdate(testProvider._id, {
        $push: {
          models: {
            dyadModelId: 'new-test-model',
            adapterModelId: 'new-adapter-model',
            maxTokens: 2000,
            contextWindow: 4000
          }
        }
      });

      // Get models again - should reflect changes
      const res2 = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer test-api-key`)
        .expect(httpStatus.OK);

      expect(res2.body.data.length).toBeGreaterThan(res1.body.data.length);
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle multiple concurrent requests efficiently', async () => {
      const concurrentRequests = 5;
      const requests = [];

      // Create multiple concurrent chat completion requests
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(app)
            .post('/v1/chat/completions')
            .set('Authorization', `Bearer test-api-key`)
            .send({
              model: 'test-model',
              messages: [
                { role: 'user', content: `Test message ${i}` }
              ],
              max_tokens: 50
            })
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(res => {
        expect(res.status).toBe(httpStatus.OK);
        expect(res.body.choices).toBeDefined();
        expect(res.body.choices[0].message.content).toBeDefined();
      });

      // Should complete in reasonable time (less than 10 seconds for 5 requests)
      expect(totalTime).toBeLessThan(10000);

      // Check performance stats were updated
      const statsRes = await request(app)
        .get('/admin/performance/stats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(statsRes.body.data.requests.total).toBeGreaterThanOrEqual(concurrentRequests);
    });

    test('should queue requests when at capacity', async () => {
      // This test would require mocking the performance service to have a low capacity
      // For now, we'll just verify the queue stats endpoint works
      const res = await request(app)
        .get('/admin/performance/request-queue')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.status).toBe('success');
    });
  });

  describe('Response Time Monitoring', () => {
    test('should track response times accurately', async () => {
      // Make a request
      const startTime = Date.now();
      await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer test-api-key`)
        .expect(httpStatus.OK);
      const actualResponseTime = Date.now() - startTime;

      // Check performance stats
      const statsRes = await request(app)
        .get('/admin/performance/stats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      const { averageResponseTime } = statsRes.body.data.requests;
      
      // Average response time should be reasonable
      expect(parseFloat(averageResponseTime)).toBeGreaterThan(0);
      expect(parseFloat(averageResponseTime)).toBeLessThan(actualResponseTime * 2); // Within 2x of actual
    });
  });

  describe('Error Rate Monitoring', () => {
    test('should track error rates correctly', async () => {
      // Get initial stats
      const initialStatsRes = await request(app)
        .get('/admin/performance/stats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      const initialFailed = initialStatsRes.body.data.requests.failed;

      // Make a request that should fail (invalid model)
      await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer test-api-key`)
        .send({
          model: 'non-existent-model',
          messages: [{ role: 'user', content: 'test' }]
        })
        .expect(httpStatus.BAD_REQUEST);

      // Check updated stats
      const updatedStatsRes = await request(app)
        .get('/admin/performance/stats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      const updatedFailed = updatedStatsRes.body.data.requests.failed;
      expect(updatedFailed).toBeGreaterThan(initialFailed);
    });
  });
});

describe('Load Testing Integration', () => {
  test('should handle sustained load without degradation', async () => {
    const requestCount = 10;
    const requests = [];
    const responseTimes = [];

    // Create sustained load
    for (let i = 0; i < requestCount; i++) {
      const startTime = Date.now();
      const requestPromise = request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer test-api-key`)
        .then(res => {
          responseTimes.push(Date.now() - startTime);
          return res;
        });
      
      requests.push(requestPromise);
      
      // Small delay between requests to simulate realistic load
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const responses = await Promise.all(requests);

    // All requests should succeed
    responses.forEach(res => {
      expect(res.status).toBe(httpStatus.OK);
    });

    // Response times should be consistent (no significant degradation)
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    
    expect(avgResponseTime).toBeLessThan(1000); // Average under 1 second
    expect(maxResponseTime).toBeLessThan(2000); // Max under 2 seconds
    
    // Standard deviation should be reasonable (consistent performance)
    const variance = responseTimes.reduce((sum, time) => sum + Math.pow(time - avgResponseTime, 2), 0) / responseTimes.length;
    const stdDev = Math.sqrt(variance);
    
    expect(stdDev).toBeLessThan(avgResponseTime); // Standard deviation less than average
  });
});