/**
 * OpenAI Normalizer Unit Tests
 */

const OpenAINormalizer = require('../../../../src/gateway/services/openai.normalizer');

// Mock logger
jest.mock('../../../../src/config/logger');

describe('OpenAINormalizer', () => {
  let normalizer;
  let mockProvider;

  beforeEach(() => {
    normalizer = new OpenAINormalizer();
    
    mockProvider = {
      _id: 'provider-123',
      name: 'Test Provider',
      slug: 'test-provider'
    };
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await normalizer.initialize();
      expect(normalizer.initialized).toBe(true);
    });
  });

  describe('normalizeChatResponse', () => {
    beforeEach(async () => {
      await normalizer.initialize();
    });

    it('should normalize OpenAI-format response', () => {
      const adapterResponse = {
        id: 'existing-id',
        object: 'chat.completion',
        created: 1234567890,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      };

      const result = normalizer.normalizeChatResponse(
        adapterResponse,
        'test-model',
        'req-123',
        mockProvider
      );

      expect(result.id).toBe('existing-id');
      expect(result.model).toBe('test-model');
      expect(result.object).toBe('chat.completion');
      expect(result.choices).toEqual(adapterResponse.choices);
      expect(result.usage).toEqual(adapterResponse.usage);
    });

    it('should normalize raw text response', () => {
      const adapterResponse = 'Hello, world!';

      const result = normalizer.normalizeChatResponse(
        adapterResponse,
        'test-model',
        'req-123',
        mockProvider
      );

      expect(result.id).toBe('req-123');
      expect(result.model).toBe('test-model');
      expect(result.object).toBe('chat.completion');
      expect(result.choices).toHaveLength(1);
      expect(result.choices[0].message.content).toBe('Hello, world!');
      expect(result.choices[0].finish_reason).toBe('stop');
    });

    it('should normalize response with message object', () => {
      const adapterResponse = {
        message: {
          role: 'assistant',
          content: 'Test response'
        },
        finish_reason: 'length'
      };

      const result = normalizer.normalizeChatResponse(
        adapterResponse,
        'test-model',
        'req-123',
        mockProvider
      );

      expect(result.choices[0].message).toEqual(adapterResponse.message);
      expect(result.choices[0].finish_reason).toBe('length');
    });

    it('should normalize response with content field', () => {
      const adapterResponse = {
        content: 'Direct content',
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
      };

      const result = normalizer.normalizeChatResponse(
        adapterResponse,
        'test-model',
        'req-123',
        mockProvider
      );

      expect(result.choices[0].message.content).toBe('Direct content');
      expect(result.usage).toEqual(adapterResponse.usage);
    });

    it('should handle complex object response', () => {
      const adapterResponse = {
        data: { result: 'complex' },
        metadata: { version: '1.0' }
      };

      const result = normalizer.normalizeChatResponse(
        adapterResponse,
        'test-model',
        'req-123',
        mockProvider
      );

      expect(result.choices[0].message.content).toBe(JSON.stringify(adapterResponse));
    });

    it('should include system fingerprint when available', () => {
      const adapterResponse = {
        choices: [{ message: { role: 'assistant', content: 'Test' } }],
        system_fingerprint: 'fp_123'
      };

      const result = normalizer.normalizeChatResponse(
        adapterResponse,
        'test-model',
        'req-123',
        mockProvider
      );

      expect(result.system_fingerprint).toBe('fp_123');
    });

    it('should throw error on normalization failure', () => {
      // Mock a scenario that would cause normalization to fail
      const invalidResponse = null;

      expect(() => {
        normalizer.normalizeChatResponse(
          invalidResponse,
          'test-model',
          'req-123',
          mockProvider
        );
      }).toThrow('Response normalization failed');
    });
  });

  describe('normalizeEmbeddingsResponse', () => {
    beforeEach(async () => {
      await normalizer.initialize();
    });

    it('should normalize OpenAI-format embeddings response', () => {
      const adapterResponse = {
        object: 'list',
        data: [
          { object: 'embedding', embedding: [0.1, 0.2, 0.3], index: 0 }
        ],
        usage: { prompt_tokens: 5, total_tokens: 5 }
      };

      const result = normalizer.normalizeEmbeddingsResponse(
        adapterResponse,
        'embedding-model',
        'req-123',
        mockProvider
      );

      expect(result.model).toBe('embedding-model');
      expect(result.object).toBe('list');
      expect(result.data).toEqual(adapterResponse.data);
      expect(result.usage).toEqual(adapterResponse.usage);
    });

    it('should normalize array of embeddings', () => {
      const adapterResponse = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6]
      ];

      const result = normalizer.normalizeEmbeddingsResponse(
        adapterResponse,
        'embedding-model',
        'req-123',
        mockProvider
      );

      expect(result.object).toBe('list');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
      expect(result.data[1].embedding).toEqual([0.4, 0.5, 0.6]);
      expect(result.model).toBe('embedding-model');
    });

    it('should normalize single embedding', () => {
      const adapterResponse = { embedding: [0.1, 0.2, 0.3] };

      const result = normalizer.normalizeEmbeddingsResponse(
        adapterResponse,
        'embedding-model',
        'req-123',
        mockProvider
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('should handle embedding objects', () => {
      const adapterResponse = [
        { embedding: [0.1, 0.2, 0.3] },
        { embedding: [0.4, 0.5, 0.6] }
      ];

      const result = normalizer.normalizeEmbeddingsResponse(
        adapterResponse,
        'embedding-model',
        'req-123',
        mockProvider
      );

      expect(result.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
      expect(result.data[1].embedding).toEqual([0.4, 0.5, 0.6]);
    });
  });

  describe('normalizeModels', () => {
    it('should normalize models list', () => {
      const models = [
        {
          id: 'model-1',
          provider: 'provider-1',
          max_tokens: 4096,
          context_window: 8192,
          supports_streaming: true,
          supports_embeddings: false
        },
        {
          id: 'model-2',
          owned_by: 'provider-2',
          max_tokens: 2048,
          context_window: 4096,
          supports_streaming: false,
          supports_embeddings: true
        }
      ];

      const result = normalizer.normalizeModels(models);

      expect(result.object).toBe('list');
      expect(result.data).toHaveLength(2);
      
      expect(result.data[0].id).toBe('model-1');
      expect(result.data[0].owned_by).toBe('provider-1');
      expect(result.data[0].max_tokens).toBe(4096);
      expect(result.data[0].supports_streaming).toBe(true);
      
      expect(result.data[1].id).toBe('model-2');
      expect(result.data[1].owned_by).toBe('provider-2');
      expect(result.data[1].supports_embeddings).toBe(true);
    });

    it('should handle empty models list', () => {
      const result = normalizer.normalizeModels([]);
      
      expect(result.object).toBe('list');
      expect(result.data).toHaveLength(0);
    });
  });

  describe('normalizeError', () => {
    it('should normalize authentication errors', () => {
      const error = new Error('Invalid API key');
      const result = normalizer.normalizeError(error, 'req-123');

      expect(result.type).toBe('authentication_error');
      expect(result.code).toBe('invalid_api_key');
      expect(result.status).toBe(401);
      expect(result.request_id).toBe('req-123');
      expect(result.trace_id).toBeDefined();
    });

    it('should normalize permission errors', () => {
      const error = new Error('Permission denied');
      const result = normalizer.normalizeError(error, 'req-123');

      expect(result.type).toBe('permission_error');
      expect(result.code).toBe('forbidden');
      expect(result.status).toBe(403);
    });

    it('should normalize model not found errors', () => {
      const error = new Error('No provider found for model: test-model');
      const result = normalizer.normalizeError(error, 'req-123');

      expect(result.type).toBe('invalid_request_error');
      expect(result.code).toBe('model_not_found');
      expect(result.status).toBe(404);
    });

    it('should normalize rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      const result = normalizer.normalizeError(error, 'req-123');

      expect(result.type).toBe('rate_limit_error');
      expect(result.code).toBe('rate_limit_exceeded');
      expect(result.status).toBe(429);
    });

    it('should normalize timeout errors', () => {
      const error = new Error('Request timeout occurred');
      const result = normalizer.normalizeError(error, 'req-123');

      expect(result.type).toBe('internal_error');
      expect(result.code).toBe('adapter_timeout');
      expect(result.status).toBe(504);
    });

    it('should normalize provider errors', () => {
      const error = new Error('Provider authentication failed');
      const result = normalizer.normalizeError(error, 'req-123');

      expect(result.type).toBe('invalid_request_error');
      expect(result.code).toBe('provider_authentication');
      expect(result.status).toBe(502);
    });

    it('should default to internal error for unknown errors', () => {
      const error = new Error('Unknown error occurred');
      const result = normalizer.normalizeError(error, 'req-123');

      expect(result.type).toBe('internal_error');
      expect(result.code).toBe('internal_server_error');
      expect(result.status).toBe(500);
    });

    it('should preserve original error message', () => {
      const error = new Error('Custom error message');
      const result = normalizer.normalizeError(error, 'req-123');

      expect(result.message).toBe('Custom error message');
    });
  });

  describe('utility methods', () => {
    describe('isOpenAIFormat', () => {
      it('should identify OpenAI format response', () => {
        const response = {
          object: 'chat.completion',
          choices: [{ message: { content: 'test' } }]
        };

        expect(normalizer.isOpenAIFormat(response)).toBe(true);
      });

      it('should reject non-OpenAI format response', () => {
        const response = { content: 'test' };
        expect(normalizer.isOpenAIFormat(response)).toBe(false);
      });

      it('should reject response without choices', () => {
        const response = { object: 'chat.completion' };
        expect(normalizer.isOpenAIFormat(response)).toBe(false);
      });
    });

    describe('estimateTokens', () => {
      it('should estimate tokens from text', () => {
        const text = 'Hello world test';
        const tokens = normalizer.estimateTokens(text);
        
        expect(tokens).toBe(Math.ceil(text.length / 4));
      });

      it('should return 0 for empty text', () => {
        expect(normalizer.estimateTokens('')).toBe(0);
        expect(normalizer.estimateTokens(null)).toBe(0);
        expect(normalizer.estimateTokens(undefined)).toBe(0);
      });

      it('should handle non-string input', () => {
        expect(normalizer.estimateTokens(123)).toBe(0);
        expect(normalizer.estimateTokens({})).toBe(0);
      });
    });

    describe('estimateTokensFromEmbeddings', () => {
      it('should estimate tokens from embeddings array', () => {
        const embeddings = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]];
        const tokens = normalizer.estimateTokensFromEmbeddings(embeddings);
        
        expect(tokens).toBe(30); // 3 embeddings * 10 tokens each
      });

      it('should handle empty embeddings array', () => {
        expect(normalizer.estimateTokensFromEmbeddings([])).toBe(0);
      });
    });
  });

  describe('normalizeChoices', () => {
    it('should return existing choices array', () => {
      const response = {
        choices: [
          { index: 0, message: { content: 'test' }, finish_reason: 'stop' }
        ]
      };

      const result = normalizer.normalizeChoices(response);
      expect(result).toEqual(response.choices);
    });

    it('should normalize message object', () => {
      const response = {
        message: { role: 'assistant', content: 'test' },
        finish_reason: 'length'
      };

      const result = normalizer.normalizeChoices(response);
      expect(result).toHaveLength(1);
      expect(result[0].message).toEqual(response.message);
      expect(result[0].finish_reason).toBe('length');
    });

    it('should normalize content field', () => {
      const response = { content: 'test content' };

      const result = normalizer.normalizeChoices(response);
      expect(result[0].message.content).toBe('test content');
      expect(result[0].message.role).toBe('assistant');
    });

    it('should normalize string response', () => {
      const response = 'simple string';

      const result = normalizer.normalizeChoices(response);
      expect(result[0].message.content).toBe('simple string');
      expect(result[0].finish_reason).toBe('stop');
    });
  });

  describe('normalizeUsage', () => {
    it('should return existing usage object', () => {
      const response = {
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      };

      const result = normalizer.normalizeUsage(response, 'test-model');
      expect(result).toEqual(response.usage);
    });

    it('should calculate total_tokens when missing', () => {
      const response = {
        usage: { prompt_tokens: 10, completion_tokens: 5 }
      };

      const result = normalizer.normalizeUsage(response, 'test-model');
      expect(result.total_tokens).toBe(15);
    });

    it('should estimate tokens from content', () => {
      const response = {
        choices: [{ message: { content: 'test content here' } }],
        prompt_tokens: 5
      };

      const result = normalizer.normalizeUsage(response, 'test-model');
      expect(result.prompt_tokens).toBe(5);
      expect(result.completion_tokens).toBeGreaterThan(0);
      expect(result.total_tokens).toBe(result.prompt_tokens + result.completion_tokens);
    });
  });
});