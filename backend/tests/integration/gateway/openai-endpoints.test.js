/**
 * Integration tests for OpenAI-compatible endpoints
 * Tests /v1/chat/completions, /v1/models, and /v1/embeddings
 */

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/app');
const setupTestDB = require('../../utils/setupTestDB');
const { ApiKey, Provider } = require('../../../src/models');
const { userOne, insertUsers } = require('../../fixtures/user.fixture');

setupTestDB();

describe('OpenAI Endpoints', () => {
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
          supportsEmbeddings: false, // SpawnCliAdapter doesn't support embeddings
        },
        {
          dyadModelId: 'test-model-2',
          adapterModelId: 'echo-v2',
          maxTokens: 2048,
          contextWindow: 4096,
          supportsStreaming: true,
          supportsEmbeddings: false,
        }
      ],
      adapterConfig: {
        command: 'echo',
        args: ['test response'],
        dockerSandbox: false, // Disable for tests
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

  describe('GET /v1/models', () => {
    test('should return 200 and list of available models', async () => {
      const res = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        object: 'list',
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'test-model-1',
            object: 'model',
            owned_by: 'test-echo',
            max_tokens: 4096,
            context_window: 8192,
            supports_streaming: false,
            supports_embeddings: false, // Updated to match the provider config
          }),
          expect.objectContaining({
            id: 'test-model-2',
            object: 'model',
            owned_by: 'test-echo',
            max_tokens: 2048,
            context_window: 4096,
            supports_streaming: true,
            supports_embeddings: false,
          })
        ])
      });
    });

    test('should return 401 when no API key provided', async () => {
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

    test('should return 401 when invalid API key provided', async () => {
      const res = await request(app)
        .get('/v1/models')
        .set('Authorization', 'Bearer invalid-key')
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
  });

  describe('POST /v1/chat/completions', () => {
    const validChatRequest = {
      model: 'test-model-1',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, how are you?' }
      ],
      max_tokens: 100,
      temperature: 0.7,
    };

    test('should return 200 and OpenAI-compatible response', async () => {
      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(validChatRequest)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: expect.any(String),
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'test-model-1',
        choices: expect.arrayContaining([
          expect.objectContaining({
            index: expect.any(Number),
            message: expect.objectContaining({
              role: 'assistant',
              content: expect.any(String),
            }),
            finish_reason: expect.any(String),
          })
        ]),
        usage: expect.objectContaining({
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number),
        })
      });
    });

    test('should return 400 when model is missing', async () => {
      const invalidRequest = { ...validChatRequest };
      delete invalidRequest.model;

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(invalidRequest)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        error: {
          message: 'Missing required fields: model and messages',
          type: 'invalid_request_error',
          code: 'invalid_request',
          request_id: expect.any(String),
        }
      });
    });

    test('should return 400 when messages is missing', async () => {
      const invalidRequest = { ...validChatRequest };
      delete invalidRequest.messages;

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(invalidRequest)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        error: {
          message: 'Missing required fields: model and messages',
          type: 'invalid_request_error',
          code: 'invalid_request',
          request_id: expect.any(String),
        }
      });
    });

    test('should return 400 when messages is empty array', async () => {
      const invalidRequest = { ...validChatRequest, messages: [] };

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(invalidRequest)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        error: {
          message: 'Messages array cannot be empty',
          type: 'invalid_request_error',
          code: 'invalid_request',
          request_id: expect.any(String),
        }
      });
    });

    test('should return 400 when message format is invalid', async () => {
      const invalidRequest = {
        ...validChatRequest,
        messages: [{ role: 'user' }] // Missing content
      };

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(invalidRequest)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        error: {
          message: 'Each message must have role and content',
          type: 'invalid_request_error',
          code: 'invalid_request',
          request_id: expect.any(String),
        }
      });
    });

    test('should return 400 when message role is invalid', async () => {
      const invalidRequest = {
        ...validChatRequest,
        messages: [{ role: 'invalid', content: 'test' }]
      };

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(invalidRequest)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        error: {
          message: 'Message role must be system, user, or assistant',
          type: 'invalid_request_error',
          code: 'invalid_request',
          request_id: expect.any(String),
        }
      });
    });

    test('should return 200 and stream when streaming is requested', async () => {
      const streamingRequest = { ...validChatRequest, stream: true };

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(streamingRequest)
        .expect(httpStatus.OK)
        .expect('Content-Type', 'text/event-stream');

      // Basic check that we get streaming response
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['connection']).toBe('keep-alive');
    });

    test('should return 401 when no API key provided', async () => {
      const res = await request(app)
        .post('/v1/chat/completions')
        .send(validChatRequest)
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

    test('should return 404 when model not found', async () => {
      const invalidModelRequest = { ...validChatRequest, model: 'non-existent-model' };

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(invalidModelRequest)
        .expect(httpStatus.NOT_FOUND);

      expect(res.body).toEqual({
        error: {
          message: expect.stringContaining('No provider found for model'),
          type: 'invalid_request_error',
          code: 'model_not_found',
          request_id: expect.any(String),
        }
      });
    });
  });

  describe('POST /v1/embeddings', () => {
    const validEmbeddingsRequest = {
      model: 'test-model-1', // This model doesn't support embeddings (SpawnCliAdapter)
      input: 'The quick brown fox jumps over the lazy dog',
    };

    test('should return 400 when adapter does not support embeddings', async () => {
      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(validEmbeddingsRequest)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        error: {
          message: 'Model test-model-1 does not support embeddings',
          type: 'invalid_request_error',
          code: 'model_not_supported',
          request_id: expect.any(String),
        }
      });
    });

    test('should return 400 when adapter does not support embeddings (array input)', async () => {
      const arrayRequest = {
        ...validEmbeddingsRequest,
        input: ['First text', 'Second text', 'Third text']
      };

      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(arrayRequest)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        error: {
          message: 'Model test-model-1 does not support embeddings',
          type: 'invalid_request_error',
          code: 'model_not_supported',
          request_id: expect.any(String),
        }
      });
    });

    test('should return 400 when model is missing', async () => {
      const invalidRequest = { ...validEmbeddingsRequest };
      delete invalidRequest.model;

      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(invalidRequest)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        error: {
          message: 'Missing required fields: model and input',
          type: 'invalid_request_error',
          code: 'invalid_request',
          request_id: expect.any(String),
        }
      });
    });

    test('should return 400 when input is missing', async () => {
      const invalidRequest = { ...validEmbeddingsRequest };
      delete invalidRequest.input;

      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(invalidRequest)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        error: {
          message: 'Missing required fields: model and input',
          type: 'invalid_request_error',
          code: 'invalid_request',
          request_id: expect.any(String),
        }
      });
    });

    test('should return 400 when input format is invalid', async () => {
      const invalidRequest = { ...validEmbeddingsRequest, input: 123 };

      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(invalidRequest)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        error: {
          message: 'Input must be a string or array of strings',
          type: 'invalid_request_error',
          code: 'invalid_request',
          request_id: expect.any(String),
        }
      });
    });

    test('should return 400 when model does not support embeddings', async () => {
      const unsupportedModelRequest = {
        ...validEmbeddingsRequest,
        model: 'test-model-2' // This model doesn't support embeddings
      };

      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(unsupportedModelRequest)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        error: {
          message: expect.stringContaining('does not support embeddings'),
          type: 'invalid_request_error',
          code: 'model_not_supported',
          request_id: expect.any(String),
        }
      });
    });

    test('should return 401 when no API key provided', async () => {
      const res = await request(app)
        .post('/v1/embeddings')
        .send(validEmbeddingsRequest)
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
  });
});