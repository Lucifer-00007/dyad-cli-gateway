const request = require('supertest');
const express = require('express');
const httpStatus = require('http-status');
const { ApiKey } = require('../../../src/models');
const { v1Routes } = require('../../../src/gateway/routes');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/v1', v1Routes);
  return app;
};

describe('Gateway Middleware Integration', () => {
  let app;
  let validApiKey;
  let testApiKeyDoc;

  beforeAll(async () => {
    app = createTestApp();
    
    // Generate a test API key
    validApiKey = ApiKey.generateKey();
    
    // Create a mock API key document for testing
    testApiKeyDoc = {
      id: 'test-api-key-id',
      name: 'Test API Key',
      userId: 'test-user-id',
      enabled: true,
      permissions: ['chat', 'models'],
      rateLimits: {
        requestsPerDay: 1000,
        tokensPerDay: 100000
      },
      usageStats: {
        requestsToday: 0,
        tokensToday: 0
      },
      hasPermission: jest.fn((perm) => ['chat', 'models'].includes(perm)),
      canAccessModel: jest.fn(() => true),
      checkRateLimit: jest.fn(() => ({ allowed: true })),
      isExpired: jest.fn(() => false),
      updateUsage: jest.fn().mockResolvedValue(true)
    };
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset test API key document to default state
    testApiKeyDoc.enabled = true;
    testApiKeyDoc.isExpired.mockReturnValue(false);
    testApiKeyDoc.hasPermission.mockImplementation((perm) => ['chat', 'models'].includes(perm));
    testApiKeyDoc.canAccessModel.mockReturnValue(true);
    testApiKeyDoc.checkRateLimit.mockReturnValue({ allowed: true });
    
    // Mock ApiKey.findByKey to return our test document
    ApiKey.findByKey = jest.fn().mockResolvedValue(testApiKeyDoc);
  });

  describe('Authentication Flow', () => {
    it('should reject requests without API key', async () => {
      const response = await request(app)
        .get('/v1/models')
        .expect(httpStatus.UNAUTHORIZED);

      expect(response.body).toMatchObject({
        message: 'Authorization header with Bearer token required'
      });
    });

    it('should reject requests with invalid API key', async () => {
      ApiKey.findByKey.mockResolvedValue(null);

      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', 'Bearer invalid_key')
        .expect(httpStatus.UNAUTHORIZED);

      expect(response.body).toMatchObject({
        message: 'Invalid API key'
      });
    });

    it('should accept requests with valid API key', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${validApiKey}`)
        .expect(httpStatus.OK);

      expect(response.body).toHaveProperty('object', 'list');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Permission Validation', () => {
    it('should reject requests when API key lacks required permissions', async () => {
      testApiKeyDoc.hasPermission.mockImplementation((perm) => perm !== 'chat');

      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${validApiKey}`)
        .expect(httpStatus.FORBIDDEN);

      expect(response.body).toMatchObject({
        message: 'Insufficient permissions'
      });
    });

    it('should allow requests when API key has required permissions', async () => {
      testApiKeyDoc.hasPermission.mockReturnValue(true);

      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${validApiKey}`)
        .expect(httpStatus.OK);

      expect(testApiKeyDoc.hasPermission).toHaveBeenCalledWith('chat');
      expect(testApiKeyDoc.hasPermission).toHaveBeenCalledWith('models');
    });
  });

  describe('Rate Limiting', () => {
    it('should reject requests when rate limit is exceeded', async () => {
      testApiKeyDoc.checkRateLimit.mockReturnValue({
        allowed: false,
        reason: 'Daily request limit exceeded',
        resetTime: new Date(Date.now() + 3600000)
      });

      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${validApiKey}`)
        .expect(httpStatus.TOO_MANY_REQUESTS);

      expect(response.body).toMatchObject({
        message: 'Daily request limit exceeded'
      });
    });

    it('should set rate limit headers', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${validApiKey}`)
        .expect(httpStatus.OK);

      expect(response.headers).toHaveProperty('x-ratelimit-limit-requests');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining-requests');
      expect(response.headers).toHaveProperty('x-ratelimit-limit-tokens');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining-tokens');
    });
  });

  describe('Request Logging', () => {
    it('should add request ID header', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${validApiKey}`)
        .expect(httpStatus.OK);

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    });

    it('should use provided request ID', async () => {
      const requestId = 'custom-request-id-123';
      
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${validApiKey}`)
        .set('X-Request-ID', requestId)
        .expect(httpStatus.OK);

      expect(response.headers['x-request-id']).toBe(requestId);
    });
  });

  describe('Chat Completions Endpoint', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({})
        .expect(httpStatus.BAD_REQUEST);

      expect(response.body.error).toMatchObject({
        message: 'Missing required fields: model and messages',
        type: 'invalid_request_error',
        code: 'invalid_request'
      });
    });

    it('should check model access permissions', async () => {
      testApiKeyDoc.canAccessModel.mockReturnValue(false);

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({
          model: 'restricted-model',
          messages: [{ role: 'user', content: 'Hello' }]
        })
        .expect(httpStatus.FORBIDDEN);

      expect(response.body.error).toMatchObject({
        message: 'Access denied for model: restricted-model',
        type: 'permission_error',
        code: 'model_access_denied'
      });
    });

    it('should return chat completion response', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        })
        .expect(httpStatus.OK);

      expect(response.body).toMatchObject({
        object: 'chat.completion',
        model: 'gpt-3.5-turbo',
        choices: expect.arrayContaining([
          expect.objectContaining({
            index: 0,
            message: expect.objectContaining({
              role: 'assistant',
              content: expect.any(String)
            }),
            finish_reason: 'stop'
          })
        ]),
        usage: expect.objectContaining({
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number)
        })
      });

      // Verify usage was updated
      expect(testApiKeyDoc.updateUsage).toHaveBeenCalledWith(30);
    });
  });

  describe('Error Handling', () => {
    it('should handle API key lookup errors', async () => {
      ApiKey.findByKey.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${validApiKey}`)
        .expect(httpStatus.INTERNAL_SERVER_ERROR);

      expect(response.body).toMatchObject({
        message: 'Authentication service error'
      });
    });

    it('should handle disabled API keys', async () => {
      testApiKeyDoc.enabled = false;

      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${validApiKey}`)
        .expect(httpStatus.UNAUTHORIZED);

      expect(response.body).toMatchObject({
        message: 'API key is disabled'
      });
    });

    it('should handle expired API keys', async () => {
      // Create a fresh expired API key mock
      const expiredApiKey = {
        ...testApiKeyDoc,
        enabled: true, // Make sure it's enabled so we test expiry specifically
        isExpired: jest.fn().mockReturnValue(true)
      };
      ApiKey.findByKey.mockResolvedValue(expiredApiKey);

      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${validApiKey}`)
        .expect(httpStatus.UNAUTHORIZED);

      expect(response.body).toMatchObject({
        message: 'API key has expired'
      });
    });
  });
});