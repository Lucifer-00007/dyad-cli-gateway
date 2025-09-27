/**
 * Unit tests for HttpSdkAdapter
 */

const HttpSdkAdapter = require('../../../../src/gateway/adapters/http-sdk.adapter');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('HttpSdkAdapter', () => {
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
      baseUrl: 'https://api.example.com',
      chatEndpoint: '/v1/chat/completions',
      embeddingsEndpoint: '/v1/embeddings',
      timeoutMs: 30000,
      retryAttempts: 3,
      headers: {
        'X-Custom-Header': 'test-value'
      },
      models: [
        {
          dyadModelId: 'test-model',
          adapterModelId: 'vendor-model',
          maxTokens: 4000
        }
      ]
    };

    credentials = {
      authType: 'bearer',
      bearerToken: 'test-token-123'
    };

    adapter = new HttpSdkAdapter(providerConfig, credentials);
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(adapter.providerConfig).toBe(providerConfig);
      expect(adapter.credentials).toBe(credentials);
      expect(adapter.supportsStreaming).toBe(false);
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Dyad-CLI-Gateway/1.0',
          'X-Custom-Header': 'test-value'
        }
      });
    });

    it('should throw error if baseUrl is missing', () => {
      expect(() => {
        new HttpSdkAdapter({}, {});
      }).toThrow('HttpSdkAdapter requires baseUrl in providerConfig');
    });

    it('should use default values for optional config', () => {
      const minimalConfig = { baseUrl: 'https://api.example.com' };
      const minimalAdapter = new HttpSdkAdapter(minimalConfig, {});
      
      expect(minimalAdapter.retryConfig.maxAttempts).toBe(3);
      expect(minimalAdapter.retryConfig.baseDelay).toBe(1000);
    });

    it('should set supportsStreaming from config', () => {
      const streamingConfig = { 
        baseUrl: 'https://api.example.com',
        supportsStreaming: true 
      };
      const streamingAdapter = new HttpSdkAdapter(streamingConfig, {});
      
      expect(streamingAdapter.supportsStreaming).toBe(true);
    });
  });

  describe('handleChat', () => {
    const messages = [
      { role: 'user', content: 'Hello, world!' }
    ];
    const options = { max_tokens: 100 };
    const requestMeta = { requestId: 'test-123' };

    it('should make HTTP request and return normalized response', async () => {
      const mockResponse = {
        data: {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'test-model',
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
          messages,
          max_tokens: 100
        },
        signal: undefined
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should handle custom chat endpoint', async () => {
      adapter.providerConfig.chatEndpoint = '/custom/chat';
      
      const mockResponse = {
        data: {
          choices: [{ message: { role: 'assistant', content: 'test' } }]
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      await adapter.handleChat({ messages, options, requestMeta });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/custom/chat'
        })
      );
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

    it('should retry on retryable errors', async () => {
      const retryableError = new Error('Network error');
      retryableError.isNetworkError = true;
      
      const mockResponse = { 
        data: { 
          id: 'test-response',
          object: 'chat.completion',
          created: 1234567890,
          model: 'test-model',
          choices: [],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          }
        } 
      };

      mockAxiosInstance.request
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue(mockResponse);

      const result = await adapter.handleChat({ messages, options, requestMeta });

      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
      expect(result).toMatchObject({
        id: expect.any(String),
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'test-model',
        choices: [],
        usage: expect.any(Object)
      });
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new Error('Bad request');
      nonRetryableError.status = 400;
      
      mockAxiosInstance.request.mockRejectedValue(nonRetryableError);

      await expect(adapter.handleChat({ messages, options, requestMeta }))
        .rejects.toThrow('Bad request');

      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retry attempts', async () => {
      const retryableError = new Error('Server error');
      retryableError.status = 500;
      
      mockAxiosInstance.request.mockRejectedValue(retryableError);

      await expect(adapter.handleChat({ messages, options, requestMeta }))
        .rejects.toThrow('Server error');

      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
    });
  });

  describe('handleEmbeddings', () => {
    const input = 'Hello, world!';
    const options = { model: 'text-embedding-ada-002' };

    it('should make HTTP request and return normalized response', async () => {
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
          input,
          model: 'text-embedding-ada-002'
        }
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error if embeddings endpoint not configured', async () => {
      adapter.providerConfig.embeddingsEndpoint = undefined;

      await expect(adapter.handleEmbeddings({ input, options }))
        .rejects.toThrow('Embeddings not supported by this provider configuration');
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
    it('should return success when test chat works', async () => {
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Test response'
              }
            }
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
          hasContent: true,
          baseUrl: 'https://api.example.com'
        }
      });
    });

    it('should return failure when test chat fails', async () => {
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
          baseUrl: 'https://api.example.com',
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
      const adapterWithoutModels = new HttpSdkAdapter({ baseUrl: 'https://api.example.com' }, {});
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
      const invalidAdapter = Object.create(HttpSdkAdapter.prototype);
      invalidAdapter.providerConfig = {};
      
      const result = invalidAdapter.validateConfig();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('baseUrl is required');
    });

    it('should return invalid if timeout is too low', () => {
      const invalidAdapter = Object.create(HttpSdkAdapter.prototype);
      invalidAdapter.providerConfig = {
        baseUrl: 'https://api.example.com',
        timeoutMs: 500
      };
      
      const result = invalidAdapter.validateConfig();
      expect(result).toEqual({
        valid: false,
        errors: ['timeoutMs must be at least 1000']
      });
    });

    it('should return invalid if retryAttempts is negative', () => {
      const invalidAdapter = Object.create(HttpSdkAdapter.prototype);
      invalidAdapter.providerConfig = {
        baseUrl: 'https://api.example.com',
        retryAttempts: -1
      };
      
      const result = invalidAdapter.validateConfig();
      expect(result).toEqual({
        valid: false,
        errors: ['retryAttempts must be non-negative']
      });
    });

    it('should return invalid if baseUrl is not a valid URL', () => {
      const invalidAdapter = Object.create(HttpSdkAdapter.prototype);
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

  describe('addAuthentication', () => {
    it('should add bearer token authentication', () => {
      const config = { headers: {} };
      const result = adapter.addAuthentication(config);
      
      expect(result.headers.Authorization).toBe('Bearer test-token-123');
    });

    it('should add API key authentication', () => {
      adapter.credentials = {
        authType: 'api-key',
        apiKey: 'test-api-key'
      };
      
      const config = { headers: {} };
      const result = adapter.addAuthentication(config);
      
      expect(result.headers['X-API-Key']).toBe('test-api-key');
    });

    it('should use custom API key header', () => {
      adapter.providerConfig.apiKeyHeader = 'Authorization';
      adapter.credentials = {
        authType: 'api-key',
        apiKey: 'test-api-key'
      };
      
      const config = { headers: {} };
      const result = adapter.addAuthentication(config);
      
      expect(result.headers.Authorization).toBe('test-api-key');
    });

    it('should add custom headers', () => {
      adapter.credentials = {
        customHeaders: {
          'X-Custom-Auth': 'custom-value',
          'X-Another-Header': 'another-value'
        }
      };
      
      const config = { headers: {} };
      const result = adapter.addAuthentication(config);
      
      expect(result.headers['X-Custom-Auth']).toBe('custom-value');
      expect(result.headers['X-Another-Header']).toBe('another-value');
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
          vendorError: error.response.data
        });
    });

    it('should handle network errors', async () => {
      const error = {
        request: {},
        message: 'Network Error'
      };

      await expect(adapter.handleHttpError(error))
        .rejects.toMatchObject({
          message: 'Network error: No response from server',
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

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const error = { isNetworkError: true };
      expect(adapter.isRetryableError(error)).toBe(true);
    });

    it('should identify retryable status codes', () => {
      const error = { status: 429 };
      expect(adapter.isRetryableError(error)).toBe(true);
      
      const error500 = { status: 500 };
      expect(adapter.isRetryableError(error500)).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      const error = { code: 'ECONNABORTED' };
      expect(adapter.isRetryableError(error)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const error = { status: 400 };
      expect(adapter.isRetryableError(error)).toBe(false);
      
      const error401 = { status: 401 };
      expect(adapter.isRetryableError(error401)).toBe(false);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff with jitter', () => {
      const delay1 = adapter.calculateRetryDelay(1);
      const delay2 = adapter.calculateRetryDelay(2);
      const delay3 = adapter.calculateRetryDelay(3);
      
      expect(delay1).toBeGreaterThanOrEqual(500); // 1000 * 0.5
      expect(delay1).toBeLessThanOrEqual(1000);   // 1000 * 1.0
      
      expect(delay2).toBeGreaterThanOrEqual(1000); // 2000 * 0.5
      expect(delay2).toBeLessThanOrEqual(2000);    // 2000 * 1.0
      
      expect(delay3).toBeGreaterThanOrEqual(2000); // 4000 * 0.5
      expect(delay3).toBeLessThanOrEqual(4000);    // 4000 * 1.0
    });

    it('should respect max delay', () => {
      adapter.retryConfig.maxDelay = 5000;
      const delay = adapter.calculateRetryDelay(10); // Would be very large without max
      
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  describe('transformChatRequest', () => {
    it('should pass through OpenAI format by default', () => {
      const messages = [{ role: 'user', content: 'test' }];
      const options = { max_tokens: 100 };
      
      const result = adapter.transformChatRequest(messages, options);
      
      expect(result).toEqual({
        messages,
        max_tokens: 100
      });
    });

    it('should apply custom request transform', () => {
      adapter.providerConfig.requestTransform = (request) => ({
        ...request,
        custom_field: 'custom_value'
      });
      
      const messages = [{ role: 'user', content: 'test' }];
      const options = { max_tokens: 100 };
      
      const result = adapter.transformChatRequest(messages, options);
      
      expect(result).toEqual({
        messages,
        max_tokens: 100,
        custom_field: 'custom_value'
      });
    });
  });

  describe('transformChatResponse', () => {
    it('should ensure required OpenAI fields', () => {
      const vendorResponse = {
        choices: [
          {
            message: { role: 'assistant', content: 'test' }
          }
        ]
      };
      
      const result = adapter.transformChatResponse(vendorResponse, 'test-123');
      
      expect(result).toMatchObject({
        id: 'test-123',
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'test-model',
        choices: vendorResponse.choices,
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      });
    });

    it('should preserve existing fields', () => {
      const vendorResponse = {
        id: 'existing-id',
        object: 'chat.completion',
        created: 1234567890,
        model: 'existing-model',
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };
      
      const result = adapter.transformChatResponse(vendorResponse, 'test-123');
      
      expect(result).toEqual(vendorResponse);
    });

    it('should apply custom response transform', () => {
      adapter.providerConfig.responseTransform = (response) => ({
        ...response,
        transformed: true
      });
      
      const vendorResponse = { choices: [] };
      const result = adapter.transformChatResponse(vendorResponse, 'test-123');
      
      expect(result.transformed).toBe(true);
    });
  });

  describe('transformEmbeddingsRequest', () => {
    it('should pass through OpenAI format by default', () => {
      const input = 'test text';
      const options = { model: 'text-embedding-ada-002' };
      
      const result = adapter.transformEmbeddingsRequest(input, options);
      
      expect(result).toEqual({
        input,
        model: 'text-embedding-ada-002'
      });
    });

    it('should apply custom embeddings request transform', () => {
      adapter.providerConfig.embeddingsRequestTransform = (request) => ({
        ...request,
        custom_embeddings_field: 'custom_value'
      });
      
      const input = 'test text';
      const options = { model: 'text-embedding-ada-002' };
      
      const result = adapter.transformEmbeddingsRequest(input, options);
      
      expect(result).toEqual({
        input,
        model: 'text-embedding-ada-002',
        custom_embeddings_field: 'custom_value'
      });
    });
  });

  describe('transformEmbeddingsResponse', () => {
    it('should ensure required OpenAI fields', () => {
      const vendorResponse = {
        data: [
          {
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3],
            index: 0
          }
        ]
      };
      
      const result = adapter.transformEmbeddingsResponse(vendorResponse, 'test-123');
      
      expect(result).toMatchObject({
        object: 'list',
        data: vendorResponse.data,
        model: 'test-model',
        usage: {
          prompt_tokens: 0,
          total_tokens: 0
        }
      });
    });

    it('should apply custom embeddings response transform', () => {
      adapter.providerConfig.embeddingsResponseTransform = (response) => ({
        ...response,
        embeddings_transformed: true
      });
      
      const vendorResponse = { data: [] };
      const result = adapter.transformEmbeddingsResponse(vendorResponse, 'test-123');
      
      expect(result.embeddings_transformed).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should complete without error', async () => {
      await expect(adapter.cleanup()).resolves.toBeUndefined();
    });
  });
});