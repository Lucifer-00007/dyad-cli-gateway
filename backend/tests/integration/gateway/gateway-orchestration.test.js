/**
 * Gateway Orchestration Integration Tests
 * Tests the complete flow from request to normalized response
 */

const { GatewayService } = require('../../../src/gateway/services');
const Provider = require('../../../src/models/provider.model');
const setupTestDB = require('../../utils/setupTestDB');

// Setup test database
setupTestDB();

describe('Gateway Orchestration Integration', () => {
  let gatewayService;
  let testProvider;

  beforeAll(async () => {
    gatewayService = new GatewayService();
    await gatewayService.initialize();
  });

  beforeEach(async () => {
    // Create a test provider
    testProvider = await Provider.create({
      name: 'Test Echo Provider',
      slug: 'test-echo-provider',
      type: 'spawn-cli',
      description: 'Test provider for integration testing',
      enabled: true,
      models: [{
        dyadModelId: 'echo-model',
        adapterModelId: 'echo',
        maxTokens: 1000,
        contextWindow: 2000,
        supportsStreaming: false,
        supportsEmbeddings: false
      }],
      adapterConfig: {
        command: 'echo',
        args: ['test response'],
        dockerSandbox: false, // Disable Docker for test simplicity
        timeoutSeconds: 30
      },
      credentials: new Map([['test', 'value']]),
      healthStatus: {
        status: 'healthy',
        lastChecked: new Date()
      }
    });
  });

  afterEach(async () => {
    await Provider.deleteMany({});
    gatewayService.clearCaches();
  });

  describe('chat completion orchestration', () => {
    it('should orchestrate complete chat completion flow', async () => {
      const request = {
        model: 'echo-model',
        messages: [
          { role: 'user', content: 'Hello, world!' }
        ],
        options: {
          max_tokens: 100,
          temperature: 0.7
        },
        requestMeta: {
          requestId: 'test-request-123',
          apiKeyId: 'test-api-key'
        }
      };

      const response = await gatewayService.handleChatCompletion(request);

      // Verify OpenAI-compatible response structure
      expect(response).toMatchObject({
        id: 'test-request-123',
        object: 'chat.completion',
        model: 'echo-model',
        choices: expect.arrayContaining([
          expect.objectContaining({
            index: 0,
            message: expect.objectContaining({
              role: 'assistant',
              content: expect.any(String)
            }),
            finish_reason: expect.any(String)
          })
        ]),
        usage: expect.objectContaining({
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number)
        })
      });

      expect(response.created).toBeGreaterThan(0);
      expect(response.choices).toHaveLength(1);
    });

    it('should handle model not found error', async () => {
      const request = {
        model: 'non-existent-model',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      await expect(gatewayService.handleChatCompletion(request))
        .rejects.toMatchObject({
          message: expect.stringContaining('No provider found for model'),
          type: 'invalid_request_error',
          code: 'model_not_found',
          status: 404
        });
    });

    it('should handle disabled provider', async () => {
      // Disable the provider
      testProvider.enabled = false;
      await testProvider.save();

      const request = {
        model: 'echo-model',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      await expect(gatewayService.handleChatCompletion(request))
        .rejects.toMatchObject({
          message: expect.stringContaining('No provider found for model'),
          type: 'invalid_request_error',
          code: 'model_not_found'
        });
    });
  });

  describe('model discovery', () => {
    it('should return available models', async () => {
      const response = await gatewayService.getAvailableModels();

      expect(response).toMatchObject({
        object: 'list',
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'echo-model',
            object: 'model',
            owned_by: 'test-echo-provider',
            max_tokens: 1000,
            context_window: 2000,
            supports_streaming: false,
            supports_embeddings: false
          })
        ])
      });
    });

    it('should cache model results', async () => {
      // First call
      const response1 = await gatewayService.getAvailableModels();
      
      // Add another provider
      await Provider.create({
        name: 'Another Provider',
        slug: 'another-provider',
        type: 'spawn-cli',
        enabled: true,
        models: [{
          dyadModelId: 'another-model',
          adapterModelId: 'another',
          maxTokens: 2000
        }],
        adapterConfig: { command: 'echo' }
      });

      // Second call should return cached result (same count)
      const response2 = await gatewayService.getAvailableModels();
      
      expect(response1.data.length).toBe(response2.data.length);
      
      // Clear cache and try again
      gatewayService.clearCaches();
      const response3 = await gatewayService.getAvailableModels();
      
      expect(response3.data.length).toBe(response1.data.length + 1);
    });
  });

  describe('provider routing', () => {
    it('should find correct provider for model', async () => {
      const provider = await gatewayService.findProviderForModel('echo-model');
      
      expect(provider).toBeTruthy();
      expect(provider.slug).toBe('test-echo-provider');
      expect(provider.models[0].dyadModelId).toBe('echo-model');
    });

    it('should prefer healthy providers', async () => {
      // Create an unhealthy provider with the same model
      await Provider.create({
        name: 'Unhealthy Provider',
        slug: 'unhealthy-provider',
        type: 'spawn-cli',
        enabled: true,
        models: [{
          dyadModelId: 'echo-model',
          adapterModelId: 'echo',
          maxTokens: 1000
        }],
        adapterConfig: { command: 'echo' },
        healthStatus: {
          status: 'unhealthy',
          lastChecked: new Date(),
          errorMessage: 'Test error'
        }
      });

      const provider = await gatewayService.findProviderForModel('echo-model');
      
      // Should return the healthy provider
      expect(provider.slug).toBe('test-echo-provider');
      expect(provider.healthStatus.status).toBe('healthy');
    });
  });
});