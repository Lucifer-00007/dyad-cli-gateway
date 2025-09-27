/**
 * Unit tests for ProxyAdapter
 */

const ProxyAdapter = require('../../../../src/gateway/adapters/proxy.adapter');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('ProxyAdapter', () => {
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
      baseUrl: 'https://proxy.example.com',
      chatEndpoint: '/v1/chat/completions',
      embeddingsEndpoint: '/v1/embeddings',
      modelsEndpoint: '/v1/models',
      timeoutMs: 30000,
      supportsStreaming: true,
      defaultModel: 'gpt-3.5-turbo',
      models: [
        {
          dyadModelId: 'gpt-3.5-turbo',
          adapterModelId: 'gpt-3.5-turbo',
          maxTokens: 4000
        }
      ]
    };

    credentials = {
      authType: 'api-key',
      apiKey: 'test-api-key-123'
    };

    adapter = new ProxyAdapter(providerConfig, credentials);
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(adapter.providerConfig).toBe(providerConfig);
      expect(adapter.credentials).toBe(credentials);
      expect(adapter.supportsStreaming).toBe(true);
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://proxy.example.com',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Dyad-CLI-Gateway/1.0'
        }
      });
    });

    it('should throw error if baseUrl is missing', () => {
      expect(() => {
        new ProxyAdapter({}, {});
      }).toThrow('ProxyAdapter requires baseUrl in providerConfig');
    });

    it('should default supportsStreaming to true', () => {
      const config = { baseUrl: 'https://proxy.example.com' };
      const proxyAdapter = new ProxyAdapter(config, {});
      
      expect(proxyAdapter.supportsStreaming).toBe(true);
    });

    it('should respect supportsStreaming config', () => {
      const config = { 
        baseUrl: 'https://proxy.example.com',
        supportsStreaming: false 
      };
      const proxyAdapter = new ProxyAdapter(config, {});
      
      expect(proxyAdapter.supportsStreaming).toBe(false);
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

    it('should make HTTP request and return response', async () => {
      const mockResponse = {
        data: {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-3.5-turbo',
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
          model: 'gpt-3.5-turbo',
          messages,
          max_tokens: 100
        },
        signal: undefined
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should use default model if not specified', async () => {
      const mockResponse = { data: { id: 'test', choices: [] } };
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      await adapter.handleChat({ messages, options: {}, requestMeta });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            model: 'gpt-3.5-turbo'
          })
        })
      );
    });

    it('should set request ID if not present in response', async () => {
      const mockResponse = {
        data: {
          object: 'chat.completion',
          choices: []
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await adapter.handleChat({ messages, options, requestMeta });

      expect(result.id).toBe('test-123');
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
        .rejects.toThrow('Proxy service is not healthy');
    });

    it('should pass cancellation signal', async () => {
      const signal = { aborted: false };
      const mockResponse = { data: { choices: [] } };
      
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      await adapter.handleChat({ messages, options, requestMeta, signal });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ signal })
      );
    });
  });

  describe('handleEmbeddings', () => {
    const input = 'Hello, world!';
    const options = { model: 'text-embedding-ada-002' };

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
          model: 'text-embedding-ada-002',
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
          model: 'text-embedding-ada-002',
          input
        }
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error if service is unhealthy', async () => {
      adapter.isServiceHealthy = jest.fn().mockResolvedValue(false);

      await expect(adapter.handleEmbeddings({ input, options }))
        .rejects.toThrow('Proxy service is not healthy');
    });

    it('should handle array input', async () => {
      const arrayInput = ['Hello', 'World'];
      const mockResponse = { data: { data: [], usage: {} } };
      
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      await adapter.handleEmbeddings({ input: arrayInput, options });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            input: arrayInput
          })
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should return success when models request works', async () => {
      const mockResponse = {
        data: {
          object: 'list',
          data: [
            { id: 'gpt-3.5-turbo', object: 'model' },
            { id: 'gpt-4', object: 'model' }
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
          baseUrl: 'https://proxy.example.com'
        }
      });
    });

    it('should return failure when models request fails', async () => {
      const error = new Error('Connection failed');
      error.response = {
        status: 401,
        statusText: 'Unauthorized'
      };

      mockAxiosInstance.request.mockRejectedValue(error);

      const result = await adapter.testConnection();

      expect(result).toEqual({
        success: false,
        message: 'Connection test failed',
        error: 'Connection failed',
        details: {
          baseUrl: 'https://proxy.example.com',
          statusCode: 401,
          statusText: 'Unauthorized'
        }
      });
    });
  });

  describe('getModels', () => {
    it('should return models from provider config', () => {
      const models = adapter.getModels();
      expect(models).toEqual(providerConfig.models);
    });

    it('should return empty array if no models configured', () => {
      const adapterWithoutModels = new ProxyAdapter({ baseUrl: 'https://proxy.example.com' }, {});
      const models = adapterWithoutModels.getModels();
      expect(models).toEqual([]);
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
      const invalidAdapter = Object.create(ProxyAdapter.prototype);
      invalidAdapter.providerConfig = {};
      
      const result = invalidAdapter.validateConfig();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('baseUrl is required');
    });

    it('should return invalid if timeout is too low', () => {
      const invalidAdapter = Object.create(ProxyAdapter.prototype);
      invalidAdapter.providerConfig = {
        baseUrl: 'https://proxy.example.com',
        timeoutMs: 500
      };
      
      const result = invalidAdapter.validateConfig();
      expect(result).toEqual({
        valid: false,
        errors: ['timeoutMs must be at least 1000']
      });
    });

    it('should return invalid if baseUrl is not a valid URL', () => {
      const invalidAdapter = Object.create(ProxyAdapter.prototype);
      invalidAdapter.providerConfig = {
        baseUrl: 'not-a-url'
      };
      
      const result = invalidAdapter.validateConfig();
      expect(result).toEqual({
        valid: false,
        errors: ['baseUrl must be a valid URL']
      });
    });
  });

  describe('rewriteHeaders', () => {
    it('should add API key as Bearer token', () => {
      const config = { headers: {} };
      const result = adapter.rewriteHeaders(config);
      
      expect(result.headers.Authorization).toBe('Bearer test-api-key-123');
    });

    it('should add bearer token authentication', () => {
      adapter.credentials = {
        authType: 'bearer',
        bearerToken: 'test-bearer-token'
      };
      
      const config = { headers: {} };
      const result = adapter.rewriteHeaders(config);
      
      expect(result.headers.Authorization).toBe('Bearer test-bearer-token');
    });

    it('should add custom headers', () => {
      adapter.credentials = {
        customHeaders: {
          'X-Custom-Auth': 'custom-value',
          'X-Another-Header': 'another-value'
        }
      };
      
      const config = { headers: {} };
      const result = adapter.rewriteHeaders(config);
      
      expect(result.headers['X-Custom-Auth']).toBe('custom-value');
      expect(result.headers['X-Another-Header']).toBe('another-value');
    });

    it('should apply header rewrites from config', () => {
      adapter.providerConfig.headerRewrites = {
        'Authorization': 'X-API-Key'
      };
      adapter.credentials = {}; // No auth to avoid interference
      
      const config = { 
        headers: { 
          'Authorization': 'Bearer test-token' 
        } 
      };
      const result = adapter.rewriteHeaders(config);
      
      expect(result.headers['X-API-Key']).toBe('Bearer test-token');
      expect(result.headers['Authorization']).toBeUndefined();
    });

    it('should remove headers specified in config', () => {
      adapter.providerConfig.removeHeaders = ['User-Agent', 'X-Remove-Me'];
      
      const config = { 
        headers: { 
          'User-Agent': 'test-agent',
          'X-Remove-Me': 'remove-this',
          'Keep-Me': 'keep-this'
        } 
      };
      const result = adapter.rewriteHeaders(config);
      
      expect(result.headers['User-Agent']).toBeUndefined();
      expect(result.headers['X-Remove-Me']).toBeUndefined();
      expect(result.headers['Keep-Me']).toBe('keep-this');
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
        timestamp: Date.now() - 30000, // 30 seconds ago
        healthy: true
      };
      adapter.lastHealthCheck = recentCheck;

      const result = await adapter.isServiceHealthy();

      expect(result).toBe(true);
      expect(mockAxiosInstance.request).not.toHaveBeenCalled();
    });

    it('should perform health check if cache is stale', async () => {
      const staleCheck = {
        timestamp: Date.now() - 120000, // 2 minutes ago
        healthy: true
      };
      adapter.lastHealthCheck = staleCheck;

      const mockResponse = { status: 200 };
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await adapter.isServiceHealthy();

      expect(result).toBe(true);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/models',
        timeout: 5000
      });
    });

    it('should return false and cache result on health check failure', async () => {
      adapter.lastHealthCheck = null;

      const error = new Error('Service unavailable');
      mockAxiosInstance.request.mockRejectedValue(error);

      const result = await adapter.isServiceHealthy();

      expect(result).toBe(false);
      expect(adapter.isHealthy).toBe(false);
      expect(adapter.lastHealthCheck.healthy).toBe(false);
      expect(adapter.lastHealthCheck.error).toBe('Service unavailable');
    });
  });

  describe('getHealthStatus', () => {
    it('should return current health status', () => {
      const mockHealthCheck = {
        timestamp: Date.now(),
        healthy: true,
        status: 200
      };
      adapter.lastHealthCheck = mockHealthCheck;
      adapter.isHealthy = true;

      const result = adapter.getHealthStatus();

      expect(result).toEqual({
        healthy: true,
        lastCheck: mockHealthCheck,
        baseUrl: 'https://proxy.example.com'
      });
    });
  });

  describe('handleHttpError', () => {
    it('should transform response errors', async () => {
      const error = {
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: {
            error: {
              message: 'Invalid request format'
            }
          }
        }
      };

      await expect(adapter.handleHttpError(error))
        .rejects.toMatchObject({
          message: 'Invalid request format',
          status: 400,
          proxyError: error.response.data
        });
    });

    it('should handle network errors', async () => {
      const error = {
        request: {},
        message: 'Network Error'
      };

      await expect(adapter.handleHttpError(error))
        .rejects.toMatchObject({
          message: 'Network error: No response from proxy service',
          isNetworkError: true
        });
    });

    it('should handle setup errors', async () => {
      const error = {
        message: 'Request setup failed'
      };

      await expect(adapter.handleHttpError(error))
        .rejects.toBe(error);
    });
  });

  describe('cleanup', () => {
    it('should complete without error', async () => {
      await expect(adapter.cleanup()).resolves.toBeUndefined();
    });
  });
});