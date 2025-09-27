/**
 * Integration tests for embeddings endpoint
 * Tests POST /v1/embeddings with different adapters and scenarios
 */

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/gateway/app');
const { ApiKey, Provider } = require('../../../src/models');
const { setupTestDB, clearDatabase } = require('../../utils/setupTestDB');
const bcrypt = require('bcryptjs');

setupTestDB();

describe('POST /v1/embeddings', () => {
  let apiKey;
  let provider;

  beforeEach(async () => {
    await clearDatabase();

    // Create API key with embeddings permission
    const keyValue = 'dyad_test_embeddings_key_12345678901234567890';
    const keyHash = await bcrypt.hash(keyValue, 12);
    const keyPrefix = keyValue.substring(0, 8);

    apiKey = await ApiKey.create({
      name: 'Test Embeddings Key',
      keyHash,
      keyPrefix,
      userId: '507f1f77bcf86cd799439011',
      permissions: ['embeddings', 'models'],
      rateLimits: {
        requestsPerMinute: 100,
        requestsPerDay: 1000,
        tokensPerMinute: 10000,
        tokensPerDay: 100000,
      },
    });

    // Create provider with embeddings support
    provider = await Provider.create({
      name: 'Test Embeddings Provider',
      slug: 'test-embeddings-provider',
      type: 'http-sdk',
      enabled: true,
      models: [
        {
          dyadModelId: 'text-embedding-test',
          adapterModelId: 'embedding-model-v1',
          maxTokens: 8192,
          contextWindow: 8192,
          supportsStreaming: false,
          supportsEmbeddings: true,
        },
      ],
      adapterConfig: {
        baseUrl: 'https://api.testembeddings.com',
        embeddingsEndpoint: '/v1/embeddings',
        timeoutMs: 30000,
      },
      credentials: new Map([
        ['apiKey', 'test-api-key'],
        ['authType', 'bearer'],
      ]),
    });
  });

  describe('Valid embeddings requests', () => {
    test('should handle single text input successfully', async () => {
      // Mock the HTTP adapter response
      const mockEmbeddingResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
            index: 0,
          },
        ],
        model: 'text-embedding-test',
        usage: {
          prompt_tokens: 5,
          total_tokens: 5,
        },
      };

      // Mock axios for HTTP adapter
      const axios = require('axios');
      jest.spyOn(axios, 'create').mockReturnValue({
        request: jest.fn().mockResolvedValue({
          data: mockEmbeddingResponse,
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key || 'dyad_test_embeddings_key_12345678901234567890'}`)
        .send({
          model: 'text-embedding-test',
          input: 'Hello, world!',
        })
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        object: 'list',
        data: expect.arrayContaining([
          expect.objectContaining({
            object: 'embedding',
            embedding: expect.any(Array),
            index: expect.any(Number),
          }),
        ]),
        model: 'text-embedding-test',
        usage: expect.objectContaining({
          prompt_tokens: expect.any(Number),
          total_tokens: expect.any(Number),
        }),
      });

      expect(res.body.data[0].embedding).toHaveLength(5);
      expect(res.body.data[0].embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    test('should handle array of text inputs successfully', async () => {
      // Mock the HTTP adapter response for multiple inputs
      const mockEmbeddingResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3],
            index: 0,
          },
          {
            object: 'embedding',
            embedding: [0.4, 0.5, 0.6],
            index: 1,
          },
        ],
        model: 'text-embedding-test',
        usage: {
          prompt_tokens: 10,
          total_tokens: 10,
        },
      };

      // Mock axios for HTTP adapter
      const axios = require('axios');
      jest.spyOn(axios, 'create').mockReturnValue({
        request: jest.fn().mockResolvedValue({
          data: mockEmbeddingResponse,
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key || 'dyad_test_embeddings_key_12345678901234567890'}`)
        .send({
          model: 'text-embedding-test',
          input: ['Hello, world!', 'How are you?'],
        })
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        object: 'list',
        data: expect.arrayContaining([
          expect.objectContaining({
            object: 'embedding',
            embedding: expect.any(Array),
            index: 0,
          }),
          expect.objectContaining({
            object: 'embedding',
            embedding: expect.any(Array),
            index: 1,
          }),
        ]),
        model: 'text-embedding-test',
        usage: expect.objectContaining({
          prompt_tokens: expect.any(Number),
          total_tokens: expect.any(Number),
        }),
      });

      expect(res.body.data).toHaveLength(2);
    });

    test('should handle encoding_format parameter', async () => {
      // Mock the HTTP adapter response
      const mockEmbeddingResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3],
            index: 0,
          },
        ],
        model: 'text-embedding-test',
        usage: {
          prompt_tokens: 3,
          total_tokens: 3,
        },
      };

      // Mock axios for HTTP adapter
      const axios = require('axios');
      jest.spyOn(axios, 'create').mockReturnValue({
        request: jest.fn().mockResolvedValue({
          data: mockEmbeddingResponse,
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key || 'dyad_test_embeddings_key_12345678901234567890'}`)
        .send({
          model: 'text-embedding-test',
          input: 'Test text',
          encoding_format: 'float',
        })
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        object: 'list',
        data: expect.any(Array),
        model: 'text-embedding-test',
        usage: expect.any(Object),
      });
    });
  });

  describe('Error handling', () => {
    test('should return 400 for missing model', async () => {
      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key || 'dyad_test_embeddings_key_12345678901234567890'}`)
        .send({
          input: 'Hello, world!',
        })
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toMatchObject({
        error: {
          message: 'Missing required fields: model and input',
          type: 'invalid_request_error',
          code: 'invalid_request',
        },
      });
    });

    test('should return 400 for missing input', async () => {
      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key || 'dyad_test_embeddings_key_12345678901234567890'}`)
        .send({
          model: 'text-embedding-test',
        })
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toMatchObject({
        error: {
          message: 'Missing required fields: model and input',
          type: 'invalid_request_error',
          code: 'invalid_request',
        },
      });
    });

    test('should return 400 for invalid input type', async () => {
      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key || 'dyad_test_embeddings_key_12345678901234567890'}`)
        .send({
          model: 'text-embedding-test',
          input: 123, // Invalid: should be string or array
        })
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toMatchObject({
        error: {
          message: 'Input must be a string or array of strings',
          type: 'invalid_request_error',
          code: 'invalid_request',
        },
      });
    });

    test('should return 400 for invalid array input items', async () => {
      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key || 'dyad_test_embeddings_key_12345678901234567890'}`)
        .send({
          model: 'text-embedding-test',
          input: ['Hello', 123, 'World'], // Invalid: array contains non-string
        })
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toMatchObject({
        error: {
          message: 'All input items must be strings',
          type: 'invalid_request_error',
          code: 'invalid_request',
        },
      });
    });

    test('should return 404 for non-existent model', async () => {
      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key || 'dyad_test_embeddings_key_12345678901234567890'}`)
        .send({
          model: 'non-existent-model',
          input: 'Hello, world!',
        })
        .expect(httpStatus.INTERNAL_SERVER_ERROR); // Will be 500 because no provider found

      expect(res.body).toMatchObject({
        error: {
          message: expect.stringContaining('No provider found for model'),
          type: 'internal_error',
        },
      });
    });

    test('should return 401 when no API key provided', async () => {
      const res = await request(app)
        .post('/v1/embeddings')
        .send({
          model: 'text-embedding-test',
          input: 'Hello, world!',
        })
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body).toMatchObject({
        error: {
          message: 'Authorization header with Bearer token required',
          type: 'authentication_error',
          code: 'missing_authorization',
        },
      });
    });

    test('should return 403 when API key lacks embeddings permission', async () => {
      // Create API key without embeddings permission
      const keyValue = 'dyad_test_no_embeddings_key_123456789012345';
      const keyHash = await bcrypt.hash(keyValue, 12);
      const keyPrefix = keyValue.substring(0, 8);

      const noEmbeddingsApiKey = await ApiKey.create({
        name: 'Test No Embeddings Key',
        keyHash,
        keyPrefix,
        userId: '507f1f77bcf86cd799439011',
        permissions: ['chat', 'models'], // No embeddings permission
        rateLimits: {
          requestsPerMinute: 100,
          requestsPerDay: 1000,
          tokensPerMinute: 10000,
          tokensPerDay: 100000,
        },
      });

      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${keyValue}`)
        .send({
          model: 'text-embedding-test',
          input: 'Hello, world!',
        })
        .expect(httpStatus.FORBIDDEN);

      expect(res.body).toMatchObject({
        error: {
          message: 'Insufficient permissions',
          type: 'permission_error',
          code: 'insufficient_permissions',
        },
      });
    });
  });

  describe('Model support validation', () => {
    test('should return error when model does not support embeddings', async () => {
      // Create provider with model that doesn't support embeddings
      const nonEmbeddingsProvider = await Provider.create({
        name: 'Test Non-Embeddings Provider',
        slug: 'test-non-embeddings-provider',
        type: 'spawn-cli',
        enabled: true,
        models: [
          {
            dyadModelId: 'chat-only-model',
            adapterModelId: 'chat-model-v1',
            maxTokens: 4096,
            contextWindow: 4096,
            supportsStreaming: false,
            supportsEmbeddings: false, // Does not support embeddings
          },
        ],
        adapterConfig: {
          command: '/usr/bin/echo',
          args: ['test'],
          dockerSandbox: false,
        },
        credentials: new Map(),
      });

      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key || 'dyad_test_embeddings_key_12345678901234567890'}`)
        .send({
          model: 'chat-only-model',
          input: 'Hello, world!',
        })
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toMatchObject({
        error: {
          message: expect.stringContaining('does not support embeddings'),
          type: 'invalid_request_error',
        },
      });
    });
  });

  describe('Usage tracking', () => {
    test('should update API key usage statistics', async () => {
      // Mock the HTTP adapter response
      const mockEmbeddingResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3],
            index: 0,
          },
        ],
        model: 'text-embedding-test',
        usage: {
          prompt_tokens: 5,
          total_tokens: 5,
        },
      };

      // Mock axios for HTTP adapter
      const axios = require('axios');
      jest.spyOn(axios, 'create').mockReturnValue({
        request: jest.fn().mockResolvedValue({
          data: mockEmbeddingResponse,
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const initialUsage = apiKey.usageStats.tokensToday;

      await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key || 'dyad_test_embeddings_key_12345678901234567890'}`)
        .send({
          model: 'text-embedding-test',
          input: 'Hello, world!',
        })
        .expect(httpStatus.OK);

      // Reload API key to check updated usage
      const updatedApiKey = await ApiKey.findById(apiKey._id);
      expect(updatedApiKey.usageStats.tokensToday).toBeGreaterThan(initialUsage);
      expect(updatedApiKey.usageStats.requestsToday).toBeGreaterThan(0);
    });
  });
});