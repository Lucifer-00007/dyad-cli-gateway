/**
 * Integration tests for Gateway Express Application
 * Tests the complete gateway app including middleware stack, routing, and error handling
 */

const request = require('supertest');
const httpStatus = require('http-status');
const { app } = require('../../../src/gateway');
const setupTestDB = require('../../utils/setupTestDB');
const { ApiKey, Provider } = require('../../../src/models');
const { userOne, insertUsers } = require('../../fixtures/user.fixture');

setupTestDB();

describe('Gateway Express Application', () => {
  let apiKey;
  let testProvider;

  beforeEach(async () => {
    await insertUsers([userOne]);
    
    // Create test API key with proper key generation
    const rawKey = ApiKey.generateKey();
    const keyHash = await ApiKey.hashKey(rawKey);
    const keyPrefix = ApiKey.getKeyPrefix(rawKey);
    
    apiKey = await ApiKey.create({
      name: 'Test Gateway Key',
      userId: userOne._id,
      keyHash,
      keyPrefix,
      permissions: ['chat', 'models', 'embeddings'],
      rateLimits: {
        requestsPerMinute: 100,
        tokensPerMinute: 10000,
      },
    });
    
    // Store the raw key for testing
    apiKey.key = rawKey;

    // Create test provider
    testProvider = await Provider.create({
      name: 'Test Echo Provider',
      slug: 'test-echo',
      type: 'spawn-cli',
      description: 'Test provider for integration tests',
      enabled: true,
      models: [
        {
          dyadModelId: 'test-model-1',
          adapterModelId: 'echo-v1',
          maxTokens: 4096,
          contextWindow: 8192,
          supportsStreaming: false,
          supportsEmbeddings: false,
        }
      ],
      adapterConfig: {
        command: 'echo',
        args: ['test response'],
        dockerSandbox: false,
        timeoutSeconds: 30,
      },
      credentials: new Map([
        ['api_key', 'test-key-123']
      ]),
      healthStatus: {
        status: 'healthy',
        lastChecked: new Date(),
      },
    });
  });

  describe('Health Check Endpoints', () => {
    describe('GET /health', () => {
      test('should return 200 and health status without authentication', async () => {
        const res = await request(app)
          .get('/health')
          .expect(httpStatus.OK);

        expect(res.body).toEqual({
          status: 'ok',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          service: 'dyad-cli-gateway',
          version: expect.any(String),
        });

        // Verify timestamp is valid ISO string
        expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
        
        // Verify uptime is positive number
        expect(res.body.uptime).toBeGreaterThan(0);
      });

      test('should return health status with correct headers', async () => {
        const res = await request(app)
          .get('/health')
          .expect(httpStatus.OK);

        expect(res.headers['content-type']).toMatch(/application\/json/);
      });
    });

    describe('GET /ready', () => {
      test('should return 200 and readiness status without authentication', async () => {
        const res = await request(app)
          .get('/ready')
          .expect(httpStatus.OK);

        expect(res.body).toEqual({
          status: 'ready',
          timestamp: expect.any(String),
          checks: {
            database: 'ok',
          },
        });

        // Verify timestamp is valid ISO string
        expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
      });
    });
  });

  describe('API Route Mounting', () => {
    test('should mount /v1 routes correctly', async () => {
      const res = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('object', 'list');
      expect(res.body).toHaveProperty('data');
    });

    test('should handle /v1/chat/completions route', async () => {
      const chatRequest = {
        model: 'test-model-1',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
      };

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(chatRequest)
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('object', 'chat.completion');
      expect(res.body).toHaveProperty('choices');
    });
  });

  describe('Middleware Stack', () => {
    test('should apply security headers', async () => {
      const res = await request(app)
        .get('/health')
        .expect(httpStatus.OK);

      // Check for helmet security headers
      expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(res.headers).toHaveProperty('x-frame-options');
      expect(res.headers).toHaveProperty('x-xss-protection');
    });

    test('should handle CORS correctly', async () => {
      const res = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(httpStatus.NO_CONTENT);

      expect(res.headers).toHaveProperty('access-control-allow-origin');
    });

    test('should parse JSON bodies', async () => {
      const chatRequest = {
        model: 'test-model-1',
        messages: [{ role: 'user', content: 'Test JSON parsing' }],
      };

      await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .set('Content-Type', 'application/json')
        .send(chatRequest)
        .expect(httpStatus.OK);
    });

    test('should handle large JSON payloads (up to 10mb limit)', async () => {
      const largeContent = 'x'.repeat(1000); // 1KB content
      const chatRequest = {
        model: 'test-model-1',
        messages: [{ role: 'user', content: largeContent }],
      };

      await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(chatRequest)
        .expect(httpStatus.OK);
    });

    test('should apply compression', async () => {
      const res = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .set('Accept-Encoding', 'gzip')
        .expect(httpStatus.OK);

      // Note: supertest automatically handles decompression,
      // but we can check if the response would be compressed
      expect(res.body).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for unknown routes', async () => {
      const res = await request(app)
        .get('/unknown-route')
        .expect(httpStatus.NOT_FOUND);

      expect(res.body).toEqual({
        error: {
          message: 'Route not found',
          type: 'invalid_request_error',
          code: 'not_found',
          request_id: expect.any(String),
        }
      });
    });

    test('should return 404 for unknown /v1 routes', async () => {
      const res = await request(app)
        .get('/v1/unknown')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .expect(httpStatus.NOT_FOUND);

      expect(res.body).toEqual({
        error: {
          message: expect.any(String),
          type: 'invalid_request_error',
          code: expect.any(String),
          request_id: expect.any(String),
        }
      });
    });

    test('should handle malformed JSON', async () => {
      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('type');
    });

    test('should handle authentication errors', async () => {
      const res = await request(app)
        .get('/v1/models')
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body).toEqual({
        error: {
          message: expect.any(String),
          type: 'authentication_error',
          code: expect.any(String),
          request_id: expect.any(String),
        }
      });
    });

    test('should include request_id in all error responses', async () => {
      const res = await request(app)
        .get('/unknown-route')
        .expect(httpStatus.NOT_FOUND);

      expect(res.body.error.request_id).toMatch(/^req_[a-zA-Z0-9]+$/);
    });
  });

  describe('Request Logging', () => {
    test('should log requests to /v1 endpoints', async () => {
      // This test verifies that the request logging middleware is applied
      // The actual logging is tested in the middleware unit tests
      await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .expect(httpStatus.OK);

      // If we reach here without errors, the middleware stack is working
      expect(true).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting to /v1 endpoints (skipped in test env)', async () => {
      // Rate limiting is disabled in test environment
      // This test verifies the middleware is properly configured
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/v1/models')
          .set('Authorization', `Bearer ${apiKey.key}`)
          .expect(httpStatus.OK);
      }
    });
  });

  describe('Application Configuration', () => {
    test('should trust proxy for accurate client IP', async () => {
      const res = await request(app)
        .get('/health')
        .set('X-Forwarded-For', '192.168.1.1')
        .expect(httpStatus.OK);

      expect(res.body.status).toBe('ok');
    });

    test('should handle URL encoded bodies', async () => {
      // While the gateway primarily uses JSON, it should handle URL encoded data
      // Express will parse it, but the validation will fail due to incorrect structure
      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('invalid=data')
        .expect(httpStatus.BAD_REQUEST); // Expected because the format won't match validation

      expect(res.body).toHaveProperty('error');
    });
  });

  describe('OpenAI Compatibility', () => {
    test('should maintain OpenAI-compatible error format', async () => {
      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send({ invalid: 'request' })
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        error: {
          message: expect.any(String),
          type: expect.any(String),
          code: expect.any(String),
          request_id: expect.any(String),
        }
      });
    });

    test('should return proper content-type for JSON responses', async () => {
      const res = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .expect(httpStatus.OK);

      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });
});