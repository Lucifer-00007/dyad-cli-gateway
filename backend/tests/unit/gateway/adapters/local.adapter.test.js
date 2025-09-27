/**
 * Unit tests for LocalAdapter
 */

const LocalAdapter = require('../../../../src/gateway/adapters/local.adapter');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('LocalAdapter', () => {
  let adapter;
  let providerConfig;
  let credentials;
  let mockAxiosInstance;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock axios instance
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
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    providerConfig = {
      baseUrl: 'http://localhost:11434',
      type: 'ollama',
      chatEndpoint: '/v1/chat/completions',
      embeddingsEndpoint: '/v1/embeddings',
      modelsEndpoint: '/v1/models',
      timeoutMs: 60000,
      supportsStreaming: true,
      defaultModel: 'llama2',
      models: [
        {
          dyadModelId: 'llama2',
          adapterModelId: 'llama2:latest',
          maxTokens: 4000
        }
      ]
    };

    credentials = {};

    adapter = new LocalAdapter(providerConfig, credentials);
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(adapter.providerConfig).toBe(providerConfig);
      expect(adapter.credentials).toBe(credentials);
      expect(adapter.supportsStreaming).toBe(true);
      expect(adapter.serviceType).toBe('ollama');
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:11434',
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Dyad-CLI-Gateway/1.0'
        }
      });
    });

    it('should throw error if baseUrl is missing', () => {
      expect(() => {
        new LocalAdapter({}, {});
      }).toThrow('LocalAdapter requires baseUrl in providerConfig');
    });

    it('should detect service types correctly', () => {
      const ollamaAdapter = new LocalAdapter({ baseUrl: 'http://localhost:11434' }, {});
      expect(ollamaAdapter.serviceType).toBe('ollama');

      const tgiAdapter = new LocalAdapter({ baseUrl: 'http://localhost:8080', serviceType: 'tgi' }, {});
      expect(tgiAdapter.serviceType).toBe('text-generation-inference');

      const localaiAdapter = new LocalAdapter({ baseUrl: 'http://localhost:8080/localai' }, {});
      expect(localaiAdapter.serviceType).toBe('localai');

      const genericAdapter = new LocalAdapter({ baseUrl: 'http://localhost:8080' }, {});
      expect(genericAdapter.serviceType).toBe('generic');
    });

    it('should default supportsStreaming to true', () => {
      const config = { baseUrl: 'http://localhost:11434' };
      const localAdapter = new LocalAdapter(config, {});
      
      expect(localAdapter.supportsStreaming).toBe(true);
    });

    it('should use longer default timeout for local services', () => {
      const config = { baseUrl: 'http://localhost:11434' };
      const localAdapter = new LocalAdapter(config, {});
      
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 60000
        })
      );
    });
  });

  describe('handleChat', () => {
    const messages = [
      { role: 'user', content: 'Hello, world!' }
    ];
    const options = { max_tokens: 100 };
    const requestMeta = { requestId: 'test-123' };

    beforeEach(() => {
      // Mock health check to return healthy
      adapter.isServiceHealthy = jest.fn().mockResolvedValue(true);
    });

    it('should make HTTP request and return transformed response', async () => {
      const mockResponse = {
        data: {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'llama2:latest',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello! How can I help you?'
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 15,
            total_tokens: 25
          }
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await adapter.handleChat({ messages, options, requestMeta });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/v1/chat/completions',
        data: {
          model: 'llama2:latest',
          messages,
          max_tokens: 100
        },
        signal: undefined
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should transform Ollama model names', async () => {
      const mockResponse = { data: { id: 'test', choices: [] } };
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      await adapter.handleChat({ 
        messages, 
        options: { model: 'llama2' }, 
        requestMeta 
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            model: 'llama2:latest'
          })
        })
      );
    });

    it('should use default model if not specified', async () => {
      const mockResponse = { data: { id: 'test', choices: [] } };
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      await adapter.handleChat({ messages, options: {}, requestMeta });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            model: 'llama2:latest'
          })
        })
      );
    });

    it('should handle streaming requests', async () => {
      const streamOptions = { ...options, stream: true };
      const mockStream = { pipe: jest.fn() };
      const mockResponse = { data: mockStream };
      
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await adapter.handleChat({ 
        messages, 
        options: streamOptions, 
        requestMeta 
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          responseType: 'stream'
        })
      );

      expect(result).toBe(mockStream);
    });

    it('should throw error if service is unhealthy', async () => {
      adapter.isServiceHealthy = jest.fn().mockResolvedValue(false);

      await expect(adapter.handleChat({ messages, options, requestMeta }))
        .rejects.toThrow('Local service (ollama) is not healthy');
    });

    it('should transform Ollama response format', async () => {
      // Mock Ollama-style response
      const ollamaResponse = {
        data: {
          message: {
            role: 'assistant',
            content: 'Hello from Ollama!'
          },
          done: true
        }
      };

      mockAxiosInstance.request.mockResolvedValue(ollamaResponse);

      const result = await adapter.handleChat({ messages, options, requestMeta });

      expect(result.choices).toEqual([{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Hello from Ollama!'
        },
        finish_reason: 'stop'
      }]);
    });
  });

  describe('handleEmbeddings', () => {
    const input = 'Hello, world!';
    const options = { model: 'nomic-embed-text' };

    beforeEach(() => {
      // Mock health check to return healthy
      adapter.isServiceHealthy = jest.fn().mockResolvedValue(true);
    });

    it('should make HTTP request and return response', async () => {
      const mockResponse = {
        data: {
          object: 'list',
          data: [
            {
              object: 'embedding',
              embedding: [0.1, 0.2, 0.3],
              index: 0
            }
          ],
          model: 'nomic-embed-text',
          usage: {
            prompt_tokens: 5,
            total_tokens: 5
          }
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await adapter.handleEmbeddings({ input, options });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/v1/embeddings',
        data: {
          model: 'nomic-embed-text',
          input
        }
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error for TGI service type', async () => {
      adapter.serviceType = 'text-generation-inference';

      await expect(adapter.handleEmbeddings({ input, options }))
        .rejects.toThrow('Embeddings not supported by text-generation-inference');
    });

    it('should throw error if service is unhealthy', async () => {
      adapter.isServiceHealthy = jest.fn().mockResolvedValue(false);

      await expect(adapter.handleEmbeddings({ input, options }))
        .rejects.toThrow('Local service (ollama) is not healthy');
    });
  });

  describe('testConnection', () => {
    it('should return success and discover models', async () => {
      const mockResponse = {
        data: {
          object: 'list',
          data: [
            { id: 'llama2:latest', object: 'model', context_length: 4096 },
            { id: 'codellama:latest', object: 'model', context_length: 16384 }
          ]
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await adapter.testConnection();

      expect(result).toEqual({
        success: true,
        message: 'Connection test successful',
        details: {
          responseReceived: true,
          hasModels: true,
          modelCount: 2,
          models: ['llama2:latest', 'codellama:latest'],
          serviceType: 'ollama',
          baseUrl: 'http://localhost:11434'
        }
      });

      expect(adapter.availableModels).toEqual(mockResponse.data.data);
    });

    it('should return failure when connection fails', async () => {
      const error = new Error('Connection refused');
      error.response = {
        status: 500,
        statusText: 'Internal Server Error'
      };

      mockAxiosInstance.request.mockRejectedValue(error);

      const result = await adapter.testConnection();

      expect(result).toEqual({
        success: false,
        message: 'Connection test failed',
        error: 'Connection refused',
        details: {
          baseUrl: 'http://localhost:11434',
          serviceType: 'ollama',
          statusCode: 500,
          statusText: 'Internal Server Error'
        }
      });
    });
  });

  describe('getModels', () => {
    it('should return configured models when no models discovered', () => {
      const models = adapter.getModels();
      expect(models).toEqual(providerConfig.models);
    });

    it('should merge discovered models with configured models', () => {
      adapter.availableModels = [
        { id: 'llama2:latest', context_length: 4096 },
        { id: 'codellama:latest', context_length: 16384 }
      ];

      const models = adapter.getModels();

      // Should have discovered models plus configured models (configured overrides discovered)
      expect(models.length).toBeGreaterThanOrEqual(2);
      expect(models).toContainEqual({
        dyadModelId: 'llama2',
        adapterModelId: 'llama2:latest',
        maxTokens: 4000 // From configured model, not discovered
      });
      expect(models).toContainEqual({
        dyadModelId: 'codellama:latest',
        adapterModelId: 'codellama:latest',
        maxTokens: 16384,
        owned_by: 'ollama'
      });
    });

    it('should prefer configured models over discovered models', () => {
      adapter.availableModels = [
        { id: 'llama2:latest', context_length: 2048 }
      ];

      const models = adapter.getModels();

      // Should use configured model settings, not discovered ones
      expect(models).toContainEqual({
        dyadModelId: 'llama2',
        adapterModelId: 'llama2:latest',
        maxTokens: 4000 // From config, not discovered 2048
      });
    });
  });

  describe('validateConfig', () => {
    it('should return valid for correct config', () => {
      const result = adapter.validateConfig();
      expect(result).toEqual({
        valid: true,
        errors: []
      });
    });

    it('should return invalid if baseUrl is missing', () => {
      const invalidAdapter = Object.create(LocalAdapter.prototype);
      invalidAdapter.providerConfig = {};
      
      const result = invalidAdapter.validateConfig();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('baseUrl is required');
    });

    it('should return invalid if timeout is too low', () => {
      const invalidAdapter = Object.create(LocalAdapter.prototype);
      invalidAdapter.providerConfig = {
        baseUrl: 'http://localhost:11434',
        timeoutMs: 500
      };
      
      const result = invalidAdapter.validateConfig();
      expect(result).toEqual({
        valid: false,
        errors: ['timeoutMs must be at least 1000']
      });
    });

    it('should return invalid if baseUrl is not a valid URL', () => {
      const invalidAdapter = Object.create(LocalAdapter.prototype);
      invalidAdapter.providerConfig = {
        baseUrl: 'not-a-url'
      };
      
      const result = invalidAdapter.validateConfig();
      expect(result).toEqual({
        valid: false,
        errors: ['baseUrl must be a valid URL']
      });
    });

    it('should warn about non-local URLs', () => {
      const remoteAdapter = Object.create(LocalAdapter.prototype);
      remoteAdapter.providerConfig = {
        baseUrl: 'https://remote-server.com'
      };
      
      const result = remoteAdapter.validateConfig();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('baseUrl should be a local address, or set allowRemote: true');
    });

    it('should allow remote URLs with allowRemote flag', () => {
      const remoteAdapter = Object.create(LocalAdapter.prototype);
      remoteAdapter.providerConfig = {
        baseUrl: 'https://remote-server.com',
        allowRemote: true
      };
      
      const result = remoteAdapter.validateConfig();
      expect(result.valid).toBe(true);
    });
  });

  describe('getEndpoint', () => {
    it('should return correct endpoints for different types', () => {
      expect(adapter.getEndpoint('chat')).toBe('/v1/chat/completions');
      expect(adapter.getEndpoint('embeddings')).toBe('/v1/embeddings');
      expect(adapter.getEndpoint('models')).toBe('/v1/models');
    });

    it('should use custom endpoints from config', () => {
      adapter.providerConfig.chatEndpoint = '/custom/chat';
      adapter.providerConfig.embeddingsEndpoint = '/custom/embeddings';
      adapter.providerConfig.modelsEndpoint = '/custom/models';

      expect(adapter.getEndpoint('chat')).toBe('/custom/chat');
      expect(adapter.getEndpoint('embeddings')).toBe('/custom/embeddings');
      expect(adapter.getEndpoint('models')).toBe('/custom/models');
    });
  });

  describe('supportsEmbeddings', () => {
    it('should return true for ollama', () => {
      adapter.serviceType = 'ollama';
      expect(adapter.supportsEmbeddings()).toBe(true);
    });

    it('should return true for localai', () => {
      adapter.serviceType = 'localai';
      expect(adapter.supportsEmbeddings()).toBe(true);
    });

    it('should return false for text-generation-inference', () => {
      adapter.serviceType = 'text-generation-inference';
      expect(adapter.supportsEmbeddings()).toBe(false);
    });

    it('should return true for generic services', () => {
      adapter.serviceType = 'generic';
      expect(adapter.supportsEmbeddings()).toBe(true);
    });
  });

  describe('isServiceHealthy', () => {
    beforeEach(() => {
      // Reset health check state
      adapter.lastHealthCheck = null;
      adapter.isHealthy = true;
    });

    it('should return cached health status if recent', async () => {
      const recentCheck = {
        timestamp: Date.now() - 15000, // 15 seconds ago
        healthy: true
      };
      adapter.lastHealthCheck = recentCheck;

      const result = await adapter.isServiceHealthy();

      expect(result).toBe(true);
      expect(mockAxiosInstance.request).not.toHaveBeenCalled();
    });

    it('should perform health check with retries', async () => {
      adapter.lastHealthCheck = null;

      const mockResponse = { status: 200 };
      mockAxiosInstance.request
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValue(mockResponse);

      const result = await adapter.isServiceHealthy();

      expect(result).toBe(true);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
    });

    it('should return false after all retry attempts fail', async () => {
      adapter.lastHealthCheck = null;

      const error = new Error('Service unavailable');
      mockAxiosInstance.request.mockRejectedValue(error);

      const result = await adapter.isServiceHealthy();

      expect(result).toBe(false);
      expect(adapter.isHealthy).toBe(false);
      expect(adapter.lastHealthCheck.healthy).toBe(false);
      expect(adapter.lastHealthCheck.attempts).toBe(3);
    });
  });

  describe('getHealthStatus', () => {
    it('should return current health status with service info', () => {
      const mockHealthCheck = {
        timestamp: Date.now(),
        healthy: true,
        status: 200
      };
      adapter.lastHealthCheck = mockHealthCheck;
      adapter.isHealthy = true;
      adapter.availableModels = [{ id: 'llama2' }, { id: 'codellama' }];

      const result = adapter.getHealthStatus();

      expect(result).toEqual({
        healthy: true,
        lastCheck: mockHealthCheck,
        serviceType: 'ollama',
        baseUrl: 'http://localhost:11434',
        availableModels: 2
      });
    });
  });

  describe('transformChatRequest', () => {
    it('should add :latest to Ollama model names', () => {
      const messages = [{ role: 'user', content: 'test' }];
      const options = { model: 'llama2' };
      
      const result = adapter.transformChatRequest(messages, options);
      
      expect(result.model).toBe('llama2:latest');
    });

    it('should not modify model names that already have tags', () => {
      const messages = [{ role: 'user', content: 'test' }];
      const options = { model: 'llama2:13b' };
      
      const result = adapter.transformChatRequest(messages, options);
      
      expect(result.model).toBe('llama2:13b');
    });

    it('should use default model if not specified', () => {
      const messages = [{ role: 'user', content: 'test' }];
      const options = {};
      
      const result = adapter.transformChatRequest(messages, options);
      
      expect(result.model).toBe('llama2:latest');
    });
  });

  describe('transformChatResponse', () => {
    it('should ensure required OpenAI fields', () => {
      const response = {
        choices: [
          {
            message: { role: 'assistant', content: 'test' }
          }
        ]
      };
      
      const result = adapter.transformChatResponse(response, 'test-123');
      
      expect(result).toMatchObject({
        id: 'test-123',
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'unknown',
        choices: response.choices,
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      });
    });

    it('should transform Ollama message format', () => {
      const ollamaResponse = {
        message: {
          role: 'assistant',
          content: 'Hello from Ollama!'
        },
        done: true
      };
      
      const result = adapter.transformChatResponse(ollamaResponse, 'test-123');
      
      expect(result.choices).toEqual([{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Hello from Ollama!'
        },
        finish_reason: 'stop'
      }]);
    });
  });

  describe('cleanup', () => {
    it('should complete without error', async () => {
      await expect(adapter.cleanup()).resolves.toBeUndefined();
    });
  });
});