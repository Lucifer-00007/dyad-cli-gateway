/**
 * End-to-End Integration Tests
 * Tests the complete workflow from provider registration to chat completion
 */

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/gateway/app');
const setupTestDB = require('../../utils/setupTestDB');
const { ApiKey, Provider, User } = require('../../../src/models');
const { userOne, admin, insertUsers } = require('../../fixtures/user.fixture');
const { adminAccessToken } = require('../../fixtures/token.fixture');

setupTestDB();

describe('End-to-End Workflow Integration', () => {
  let apiKey;
  let providerId;

  beforeEach(async () => {
    await insertUsers([userOne, admin]);
    
    // Create test API key for gateway access
    const rawKey = ApiKey.generateKey();
    const keyHash = await ApiKey.hashKey(rawKey);
    const keyPrefix = ApiKey.getKeyPrefix(rawKey);
    
    apiKey = await ApiKey.create({
      name: 'E2E Test Gateway Key',
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
  });

  describe('Complete Provider Registration → Chat Completion Flow', () => {
    test('should complete full workflow: register provider → test provider → get models → chat completion', async () => {
      // Step 1: Register a new provider via admin API
      const newProvider = {
        name: 'E2E Test Echo Provider',
        slug: 'e2e-test-echo',
        type: 'spawn-cli',
        description: 'End-to-end test provider using echo command',
        enabled: true,
        models: [
          {
            dyadModelId: 'e2e-echo-model',
            adapterModelId: 'echo-v1',
            maxTokens: 2048,
            contextWindow: 4096,
            supportsStreaming: false,
            supportsEmbeddings: false,
          },
        ],
        adapterConfig: {
          command: 'echo',
          args: ['E2E Test Response'],
          dockerSandbox: false, // Disable Docker for test simplicity
          timeoutSeconds: 30,
          memoryLimit: '512m',
          cpuLimit: '0.5',
        },
        credentials: {
          testKey: 'test-value-123',
        },
        rateLimits: {
          requestsPerMinute: 60,
          tokensPerMinute: 30000,
        },
      };

      const createRes = await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newProvider)
        .expect(httpStatus.CREATED);

      expect(createRes.body).toMatchObject({
        name: newProvider.name,
        slug: newProvider.slug,
        type: newProvider.type,
        enabled: true,
        models: expect.arrayContaining([
          expect.objectContaining({
            dyadModelId: 'e2e-echo-model',
            adapterModelId: 'echo-v1',
            maxTokens: 2048,
          }),
        ]),
      });

      providerId = createRes.body.id;

      // Step 2: Test the provider connectivity
      const testRes = await request(app)
        .post(`/admin/providers/${providerId}/test`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ dryRun: false })
        .expect(httpStatus.OK);

      expect(testRes.body).toMatchObject({
        status: 'success',
        providerId,
        providerName: newProvider.name,
        providerType: newProvider.type,
      });

      // Step 3: Verify the model appears in the models list
      const modelsRes = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .expect(httpStatus.OK);

      expect(modelsRes.body).toEqual({
        object: 'list',
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'e2e-echo-model',
            object: 'model',
            owned_by: 'e2e-test-echo',
            max_tokens: 2048,
            context_window: 4096,
            supports_streaming: false,
            supports_embeddings: false,
          }),
        ]),
      });

      // Step 4: Execute a chat completion using the registered provider
      const chatRequest = {
        model: 'e2e-echo-model',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello from E2E test!' },
        ],
        max_tokens: 100,
        temperature: 0.7,
      };

      const chatRes = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(chatRequest)
        .expect(httpStatus.OK);

      expect(chatRes.body).toEqual({
        id: expect.any(String),
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'e2e-echo-model',
        choices: expect.arrayContaining([
          expect.objectContaining({
            index: 0,
            message: expect.objectContaining({
              role: 'assistant',
              content: expect.any(String),
            }),
            finish_reason: expect.any(String),
          }),
        ]),
        usage: expect.objectContaining({
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number),
        }),
      });

      // Verify the response contains expected content from echo adapter
      expect(chatRes.body.choices[0].message.content).toContain('Echo:');

      // Step 5: Verify provider health check
      const healthRes = await request(app)
        .post(`/admin/providers/${providerId}/health`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(healthRes.body).toMatchObject({
        status: expect.any(String),
        providerId,
        providerName: newProvider.name,
        providerType: newProvider.type,
      });
    });

    test('should handle provider registration with invalid configuration', async () => {
      // Try to register provider with invalid adapter config
      const invalidProvider = {
        name: 'Invalid Provider',
        slug: 'invalid-provider',
        type: 'spawn-cli',
        enabled: true,
        models: [
          {
            dyadModelId: 'invalid-model',
            adapterModelId: 'invalid',
            maxTokens: 1000,
          },
        ],
        adapterConfig: {
          // Missing required 'command' field
          args: ['test'],
          timeoutSeconds: 30,
        },
      };

      await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(invalidProvider)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should handle disabled provider in chat completion', async () => {
      // Register provider
      const provider = {
        name: 'Disabled Test Provider',
        slug: 'disabled-test-provider',
        type: 'spawn-cli',
        enabled: false, // Disabled from start
        models: [
          {
            dyadModelId: 'disabled-model',
            adapterModelId: 'disabled',
            maxTokens: 1000,
          },
        ],
        adapterConfig: {
          command: 'echo',
          args: ['test'],
          dockerSandbox: false,
        },
      };

      const createRes = await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(provider)
        .expect(httpStatus.CREATED);

      // Try to use disabled provider in chat completion
      const chatRequest = {
        model: 'disabled-model',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(chatRequest)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should handle provider update and immediate usage', async () => {
      // Register initial provider
      const initialProvider = {
        name: 'Updatable Provider',
        slug: 'updatable-provider',
        type: 'spawn-cli',
        enabled: true,
        models: [
          {
            dyadModelId: 'updatable-model',
            adapterModelId: 'initial',
            maxTokens: 1000,
          },
        ],
        adapterConfig: {
          command: 'echo',
          args: ['initial response'],
          dockerSandbox: false,
        },
      };

      const createRes = await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(initialProvider)
        .expect(httpStatus.CREATED);

      const providerId = createRes.body.id;

      // Update provider configuration
      const updateData = {
        description: 'Updated provider description',
        adapterConfig: {
          command: 'echo',
          args: ['updated response'],
          dockerSandbox: false,
          timeoutSeconds: 45,
        },
      };

      await request(app)
        .patch(`/admin/providers/${providerId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(httpStatus.OK);

      // Use updated provider immediately
      const chatRequest = {
        model: 'updatable-model',
        messages: [{ role: 'user', content: 'Test updated provider' }],
      };

      const chatRes = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(chatRequest)
        .expect(httpStatus.OK);

      expect(chatRes.body.choices[0].message.content).toContain('Echo:');
    });
  });

  describe('Multiple Provider Workflow', () => {
    test('should handle multiple providers with same model name preference', async () => {
      // Register first provider
      const provider1 = {
        name: 'Primary Echo Provider',
        slug: 'primary-echo',
        type: 'spawn-cli',
        enabled: true,
        models: [
          {
            dyadModelId: 'shared-model',
            adapterModelId: 'primary',
            maxTokens: 2000,
          },
        ],
        adapterConfig: {
          command: 'echo',
          args: ['Primary response'],
          dockerSandbox: false,
        },

      };

      // Register second provider (unhealthy)
      const provider2 = {
        name: 'Secondary Echo Provider',
        slug: 'secondary-echo',
        type: 'spawn-cli',
        enabled: true,
        models: [
          {
            dyadModelId: 'shared-model',
            adapterModelId: 'secondary',
            maxTokens: 1000,
          },
        ],
        adapterConfig: {
          command: 'echo',
          args: ['Secondary response'],
          dockerSandbox: false,
        },

      };

      await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(provider1)
        .expect(httpStatus.CREATED);

      await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(provider2)
        .expect(httpStatus.CREATED);

      // Chat completion should prefer healthy provider
      const chatRequest = {
        model: 'shared-model',
        messages: [{ role: 'user', content: 'Which provider will handle this?' }],
      };

      const chatRes = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(chatRequest)
        .expect(httpStatus.OK);

      // Should get response from primary (healthy) provider
      expect(chatRes.body.choices[0].message.content).toContain('Echo:');
    });
  });

  describe('Error Recovery Workflow', () => {
    test('should handle adapter timeout gracefully', async () => {
      // Register provider with very short timeout
      const timeoutProvider = {
        name: 'Timeout Test Provider',
        slug: 'timeout-test',
        type: 'spawn-cli',
        enabled: true,
        models: [
          {
            dyadModelId: 'timeout-model',
            adapterModelId: 'timeout',
            maxTokens: 1000,
          },
        ],
        adapterConfig: {
          command: 'sleep', // This will timeout
          args: ['10'], // Sleep for 10 seconds
          dockerSandbox: false,
          timeoutSeconds: 1, // Very short timeout
        },
      };

      const createRes = await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(timeoutProvider)
        .expect(httpStatus.CREATED);

      // Chat completion should timeout and return appropriate error
      const chatRequest = {
        model: 'timeout-model',
        messages: [{ role: 'user', content: 'This should timeout' }],
      };

      const chatRes = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${apiKey.key}`)
        .send(chatRequest)
        .expect(httpStatus.INTERNAL_SERVER_ERROR);

      expect(chatRes.body).toEqual({
        error: {
          message: expect.stringContaining('timeout'),
          type: 'internal_error',
          code: expect.any(String),
          request_id: expect.any(String),
        },
      });
    });
  });

  afterEach(async () => {
    // Clean up created providers
    if (providerId) {
      await Provider.findByIdAndDelete(providerId);
    }
  });
});