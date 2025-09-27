/**
 * Gateway Service Unit Tests
 */

const GatewayService = require('../../../../src/gateway/services/gateway.service');
const { AdapterFactory } = require('../../../../src/gateway/adapters');
const Provider = require('../../../../src/models/provider.model');
const OpenAINormalizer = require('../../../../src/gateway/services/openai.normalizer');

// Mock dependencies
jest.mock('../../../../src/gateway/adapters');
jest.mock('../../../../src/models/provider.model');
jest.mock('../../../../src/gateway/services/openai.normalizer');
jest.mock('../../../../src/config/logger');

describe('GatewayService', () => {
  let gatewayService;
  let mockAdapter;
  let mockProvider;
  let mockNormalizer;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock adapter
    mockAdapter = {
      handleChat: jest.fn(),
      handleEmbeddings: jest.fn(),
      validateConfig: jest.fn().mockReturnValue({ valid: true, errors: [] })
    };

    // Mock provider
    mockProvider = {
      _id: 'provider-123',
      name: 'Test Provider',
      slug: 'test-provider',
      type: 'spawn-cli',
      enabled: true,
      models: [{
        dyadModelId: 'test-model',
        adapterModelId: 'adapter-model',
        maxTokens: 4096,
        supportsEmbeddings: false
      }],
      healthStatus: {
        status: 'healthy',
        lastChecked: new Date(),
        errorMessage: null
      },
      getModelMapping: jest.fn().mockReturnValue({
        dyadModelId: 'test-model',
        adapterModelId: 'adapter-model',
        maxTokens: 4096,
        supportsEmbeddings: false
      }),
      credentials: { apiKey: 'test-key' }
    };

    // Mock normalizer
    mockNormalizer = {
      initialize: jest.fn(),
      normalizeChatResponse: jest.fn(),
      normalizeEmbeddingsResponse: jest.fn(),
      normalizeModels: jest.fn(),
      normalizeError: jest.fn()
    };

    // Mock factory
    AdapterFactory.createAdapter = jest.fn().mockReturnValue(mockAdapter);

    // Mock Provider model
    Provider.getProvidersByModel = jest.fn();
    Provider.getAllModels = jest.fn();

    // Mock OpenAINormalizer
    OpenAINormalizer.mockImplementation(() => mockNormalizer);

    // Create service instance
    gatewayService = new GatewayService();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await gatewayService.initialize();
      
      expect(gatewayService.isInitialized()).toBe(true);
      expect(mockNormalizer.initialize).toHaveBeenCalled();
    });

    it('should throw error if configuration is missing', async () => {
      gatewayService.config = null;
      
      await expect(gatewayService.initialize()).rejects.toThrow('Gateway configuration is missing');
    });
  });

  describe('handleChatCompletion', () => {
    beforeEach(async () => {
      await gatewayService.initialize();
    });

    it('should handle chat completion successfully', async () => {
      // Setup mocks
      Provider.getProvidersByModel.mockResolvedValue([mockProvider]);
      mockAdapter.handleChat.mockResolvedValue({
        choices: [{ message: { role: 'assistant', content: 'Test response' } }]
      });
      mockNormalizer.normalizeChatResponse.mockReturnValue({
        id: 'test-request',
        object: 'chat.completion',
        model: 'test-model',
        choices: [{ message: { role: 'assistant', content: 'Test response' } }]
      });

      const result = await gatewayService.handleChatCompletion({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        options: { max_tokens: 100 },
        requestMeta: { requestId: 'test-request' }
      });

      expect(Provider.getProvidersByModel).toHaveBeenCalledWith('test-model');
      expect(AdapterFactory.createAdapter).toHaveBeenCalledWith(mockProvider, mockProvider.credentials);
      expect(mockAdapter.handleChat).toHaveBeenCalled();
      expect(mockNormalizer.normalizeChatResponse).toHaveBeenCalled();
      expect(result.model).toBe('test-model');
    });

    it('should throw error when no provider found for model', async () => {
      Provider.getProvidersByModel.mockResolvedValue([]);
      mockNormalizer.normalizeError.mockImplementation((error) => error);

      await expect(gatewayService.handleChatCompletion({
        model: 'unknown-model',
        messages: [{ role: 'user', content: 'Hello' }]
      })).rejects.toThrow('No provider found for model: unknown-model');
    });

    it('should throw error when model mapping not found', async () => {
      mockProvider.getModelMapping.mockReturnValue(null);
      Provider.getProvidersByModel.mockResolvedValue([mockProvider]);
      mockNormalizer.normalizeError.mockImplementation((error) => error);

      await expect(gatewayService.handleChatCompletion({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }]
      })).rejects.toThrow('Model mapping not found for: test-model');
    });

    it('should handle adapter errors and normalize them', async () => {
      Provider.getProvidersByModel.mockResolvedValue([mockProvider]);
      mockAdapter.handleChat.mockRejectedValue(new Error('Adapter failed'));
      mockNormalizer.normalizeError.mockReturnValue(new Error('Normalized error'));

      await expect(gatewayService.handleChatCompletion({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }]
      })).rejects.toThrow('Normalized error');

      expect(mockNormalizer.normalizeError).toHaveBeenCalled();
    });

    it('should pass signal to adapter for cancellation', async () => {
      Provider.getProvidersByModel.mockResolvedValue([mockProvider]);
      mockAdapter.handleChat.mockResolvedValue({ choices: [] });
      mockNormalizer.normalizeChatResponse.mockReturnValue({ id: 'test' });

      // Mock AbortController for Node.js environments that don't have it
      const mockSignal = { aborted: false };
      const signal = mockSignal;
      
      await gatewayService.handleChatCompletion({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        signal
      });

      expect(mockAdapter.handleChat).toHaveBeenCalledWith(
        expect.objectContaining({ signal })
      );
    });
  });

  describe('handleEmbeddings', () => {
    beforeEach(async () => {
      await gatewayService.initialize();
    });

    it('should handle embeddings successfully', async () => {
      // Setup provider with embeddings support
      const embeddingsProvider = {
        ...mockProvider,
        getModelMapping: jest.fn().mockReturnValue({
          dyadModelId: 'embedding-model',
          adapterModelId: 'adapter-embedding',
          supportsEmbeddings: true
        })
      };

      Provider.getProvidersByModel.mockResolvedValue([embeddingsProvider]);
      mockAdapter.handleEmbeddings.mockResolvedValue([[0.1, 0.2, 0.3]]);
      mockNormalizer.normalizeEmbeddingsResponse.mockReturnValue({
        object: 'list',
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      });

      const result = await gatewayService.handleEmbeddings({
        model: 'embedding-model',
        input: 'test text',
        requestMeta: { requestId: 'test-request' }
      });

      expect(mockAdapter.handleEmbeddings).toHaveBeenCalled();
      expect(mockNormalizer.normalizeEmbeddingsResponse).toHaveBeenCalled();
      expect(result.object).toBe('list');
    });

    it('should throw error when model does not support embeddings', async () => {
      Provider.getProvidersByModel.mockResolvedValue([mockProvider]);
      mockNormalizer.normalizeError.mockImplementation((error) => error);

      await expect(gatewayService.handleEmbeddings({
        model: 'test-model',
        input: 'test text'
      })).rejects.toThrow('does not support embeddings');
    });
  });

  describe('getAvailableModels', () => {
    beforeEach(async () => {
      await gatewayService.initialize();
    });

    it('should return available models', async () => {
      const mockModels = [
        { id: 'model-1', provider: 'provider-1' },
        { id: 'model-2', provider: 'provider-2' }
      ];

      Provider.getAllModels.mockResolvedValue(mockModels);
      mockNormalizer.normalizeModels.mockReturnValue({
        object: 'list',
        data: mockModels
      });

      const result = await gatewayService.getAvailableModels();

      expect(Provider.getAllModels).toHaveBeenCalled();
      expect(mockNormalizer.normalizeModels).toHaveBeenCalledWith(mockModels);
      expect(result.object).toBe('list');
    });

    it('should use cached models when available', async () => {
      const mockModels = [{ id: 'model-1' }];
      Provider.getAllModels.mockResolvedValue(mockModels);
      mockNormalizer.normalizeModels.mockReturnValue({ object: 'list', data: mockModels });

      // First call
      await gatewayService.getAvailableModels();
      
      // Second call should use cache
      await gatewayService.getAvailableModels();

      expect(Provider.getAllModels).toHaveBeenCalledTimes(1);
    });
  });

  describe('findProviderForModel', () => {
    beforeEach(async () => {
      await gatewayService.initialize();
    });

    it('should find provider for model', async () => {
      Provider.getProvidersByModel.mockResolvedValue([mockProvider]);

      const result = await gatewayService.findProviderForModel('test-model');

      expect(result).toBe(mockProvider);
      expect(Provider.getProvidersByModel).toHaveBeenCalledWith('test-model');
    });

    it('should return null when no provider found', async () => {
      Provider.getProvidersByModel.mockResolvedValue([]);

      const result = await gatewayService.findProviderForModel('unknown-model');

      expect(result).toBeNull();
    });

    it('should prefer healthy providers', async () => {
      const unhealthyProvider = {
        ...mockProvider,
        _id: 'unhealthy-provider',
        healthStatus: { status: 'unhealthy', lastChecked: new Date(), errorMessage: 'Test error' }
      };
      const healthyProvider = {
        ...mockProvider,
        _id: 'healthy-provider',
        healthStatus: { status: 'healthy', lastChecked: new Date(), errorMessage: null }
      };

      Provider.getProvidersByModel.mockResolvedValue([unhealthyProvider, healthyProvider]);

      const result = await gatewayService.findProviderForModel('test-model');

      expect(result).toBe(healthyProvider);
    });

    it('should use cached provider when available', async () => {
      Provider.getProvidersByModel.mockResolvedValue([mockProvider]);

      // First call
      await gatewayService.findProviderForModel('test-model');
      
      // Second call should use cache
      await gatewayService.findProviderForModel('test-model');

      expect(Provider.getProvidersByModel).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCaches', () => {
    it('should clear all caches', () => {
      gatewayService.providerCache.set('test', { data: 'test' });
      gatewayService.modelCache.set('test', { data: 'test' });

      gatewayService.clearCaches();

      expect(gatewayService.providerCache.size).toBe(0);
      expect(gatewayService.modelCache.size).toBe(0);
    });
  });
});