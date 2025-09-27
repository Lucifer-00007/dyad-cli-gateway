/**
 * Integration tests for HTTP-SDK Adapter
 * Tests the adapter with mocked HTTP responses to simulate real vendor APIs
 */

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/gateway/app');
const { Provider, ApiKey } = require('../../../src/models');
const { userOne, admin, insertUsers } = require('../../fixtures/user.fixture');
const { adminAccessToken } = require('../../fixtures/token.fixture');
const setupTestDB = require('../../utils/setupTestDB');
const axios = require('axios');

// Mock axios for HTTP requests
jest.mock('axios');

// Setup test database
setupTestDB();

describe('HTTP-SDK Adapter Integration', () => {
  let mockAxiosInstance;
  let apiKey;

  beforeEach(async () => {
    await insertUsers([userOne, admin]);
    
    // Create test API key for gateway access
    const rawKey = ApiKey.generateKey();
    const keyHash = await ApiKey.hashKey(rawKey);
    const keyPrefix = ApiKey.getKeyPrefix(rawKey);
    
    apiKey = await ApiKey.create({
      name: 'HTTP-SDK Test Gateway Key',
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
    
    // Reset axios mocks
    jest.clearAllMocks();
    
    // Mock axios.create to return a mock instance
    mockAxiosInstance = {
      request: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn()
        },
        response: {
          use: jest.fn()
        }
      }
    };
    
    axios.create.mockReturnValue(mockAxiosInstance);
  });

  describe('Provider Management with HTTP-SDK', () => {
    const httpSdkProvider = {
      name: 'Test HTTP Provider',
      slug: 'test-http-provider',
      type: 'http-sdk',
      enabled: true,
      models: [
        {
          dyadModelId: 'test-model',
          adapterModelId: 'vendor-model',
          maxTokens: 4000,
          contextWindow: 4000
        }
      ],
      adapterConfig: {
        baseUrl: 'https://api.testvendor.com',
        chatEndpoint: '/v1/chat/completions',
        embeddingsEndpoint: '/v1/embeddings',
        timeoutMs: 30000,
        retryAttempts: 2,
        headers: {
          'X-Custom-Header': 'test-value'
        }
      },
      credentials: {
        authType: 'bearer',
        bearerToken: 'test-bearer-token'
      }
    };

    it('should create HTTP-SDK provider successfully', async () => {
      const res = await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(httpSdkProvider)
        .expect(httpStatus.CREATED);

      expect(res.body).toMatchObject({
        name: httpSdkProvider.name,
        slug: httpSdkProvider.slug,
        type: httpSdkProvider.type,
        enabled: httpSdkProvider.enabled,
        models: httpSdkProvider.models,
        adapterConfig: expect.objectContaining({
          baseUrl: httpSdkProvider.adapterConfig.baseUrl,
          headers: httpSdkProvider.adapterConfig.headers,
          retryAttempts: httpSdkProvider.adapterConfig.retryAttempts
        })
      });

      // Credentials should be encrypted and not returned
      expect(res.body.credentials).toBeUndefined();
    });

    it('should test HTTP-SDK provider connectivity', async () => {
      // Create provider first
      const provider = await Provider.create(httpSdkProvider);

      // Mock the vendor API response
      const mockChatResponse = {
        id: 'chatcmpl-test123',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'vendor-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Test connection successful!'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };

      mockAxiosInstance.request.mockResolvedValue({
        data: mockChatResponse
      });

      const res = await request(app)
        .post(`/admin/providers/${provider._id}/test`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'success',
        message: 'Provider connectivity test passed',
        providerId: provider._id.toString(),
        providerName: 'Test HTTP Provider',
        providerType: 'http-sdk'
      });
    });

    it('should handle HTTP-SDK provider test failure', async () => {
      // Create provider first
      const provider = await Provider.create(httpSdkProvider);

      // Mock the vendor API to return an error
      const error = new Error('Invalid API key');
      error.response = {
        status: 401,
        statusText: 'Unauthorized',
        data: {
          error: {
            message: 'Invalid API key',
            type: 'authentication_error'
          }
        }
      };
      mockAxiosInstance.request.mockRejectedValue(error);

      const res = await request(app)
        .post(`/admin/providers/${provider._id}/test`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'failed',
        message: 'Invalid API key',
        providerId: provider._id.toString(),
        providerName: 'Test HTTP Provider',
        providerType: 'http-sdk'
      });
    });
  });

  describe('Chat Completions with HTTP-SDK', () => {
    let provider;

    beforeEach(async () => {
      // Create HTTP-SDK provider
      provider = await Provider.create({
        name: 'Test HTTP Provider',
        slug: 'test-http-provider',
        type: 'http-sdk',
        enabled: true,
        models: [
          {
            dyadModelId: 'test-model',
            adapterModelId: 'vendor-model',
            maxTokens: 4000,
            contextWindow: 4000
          }
        ],
        adapterConfig: {
          baseUrl: 'https://api.testvendor.com',
          chatEndpoint: '/v1/chat/completions',
          timeoutMs: 30000,
          retryAttempts: 2
        },
        credentials: {
          authType: 'bearer',
          bearerToken: 'test-bearer-token'
        }
      });
    });

    it('should handle chat completion request successfully', async () => {
      const chatRequest = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?'
          }
        ],
        max_tokens: 100
      };

      const mockResponse = {
        id: 'chatcmpl-test123',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'vendor-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! I am doing well, thank you for asking. How can I help you today?'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 20,
          total_tokens: 32
        }
      };

      mockAxiosInstance.request.mockResolvedValue({
        data: mockResponse
      });

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(chatRequest)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'test-model', // Should be mapped to dyadModelId
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! I am doing well, thank you for asking. How can I help you today?'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 20,
          total_tokens: 32
        }
      });
    });

    it('should handle vendor API errors gracefully', async () => {
      const chatRequest = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ]
      };

      const error = new Error('Rate limit exceeded');
      error.response = {
        status: 429,
        statusText: 'Too Many Requests',
        data: {
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error'
          }
        }
      };
      mockAxiosInstance.request.mockRejectedValue(error);

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(chatRequest)
        .expect(httpStatus.TOO_MANY_REQUESTS);

      expect(res.body).toMatchObject({
        error: {
          message: expect.stringContaining('Rate limit exceeded'),
          type: 'rate_limit_error'
        }
      });
    });

    // Note: Retry logic is thoroughly tested in unit tests
    // Integration test focuses on end-to-end functionality
  });

  // Note: Embeddings functionality is thoroughly tested in unit tests
  // Integration test focuses on core chat completion functionality
});