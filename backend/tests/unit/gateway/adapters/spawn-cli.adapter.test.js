/**
 * Unit tests for SpawnCliAdapter
 */

const SpawnCliAdapter = require('../../../../src/gateway/adapters/spawn-cli.adapter');
const DockerSandbox = require('../../../../src/gateway/utils/docker-sandbox');

// Mock DockerSandbox
jest.mock('../../../../src/gateway/utils/docker-sandbox');

describe('SpawnCliAdapter', () => {
  let mockSandbox;
  let adapter;
  let providerConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock DockerSandbox
    mockSandbox = {
      execute: jest.fn()
    };
    DockerSandbox.mockImplementation(() => mockSandbox);

    providerConfig = {
      command: 'echo',
      args: [],
      timeoutSeconds: 30,
      sandboxImage: 'alpine:latest',
      models: [
        {
          dyadModelId: 'echo-model',
          adapterModelId: 'echo',
          maxTokens: 1000
        }
      ]
    };

    adapter = new SpawnCliAdapter(providerConfig, {});
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(adapter.providerConfig).toBe(providerConfig);
      expect(adapter.supportsStreaming).toBe(false);
      expect(DockerSandbox).toHaveBeenCalledWith({
        image: 'alpine:latest',
        timeout: 30000,
        memoryLimit: '512m',
        cpuLimit: '0.5'
      });
    });

    it('should throw error if command is missing', () => {
      expect(() => {
        new SpawnCliAdapter({}, {});
      }).toThrow('SpawnCliAdapter requires command in providerConfig');
    });

    it('should use default values for optional config', () => {
      const minimalConfig = { command: 'echo' };
      const minimalAdapter = new SpawnCliAdapter(minimalConfig, {});
      
      expect(DockerSandbox).toHaveBeenCalledWith({
        image: 'alpine:latest',
        timeout: 60000,
        memoryLimit: '512m',
        cpuLimit: '0.5'
      });
    });
  });

  describe('handleChat', () => {
    const messages = [
      { role: 'user', content: 'Hello, world!' }
    ];
    const options = { max_tokens: 100 };
    const requestMeta = { requestId: 'test-123' };

    it('should execute command and return normalized response', async () => {
      const mockOutput = 'Hello, world!';
      mockSandbox.execute.mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: mockOutput,
        stderr: ''
      });

      const result = await adapter.handleChat({ messages, options, requestMeta });

      expect(mockSandbox.execute).toHaveBeenCalledWith(
        'echo',
        [],
        {
          input: JSON.stringify({ messages, options }, null, 2),
          signal: undefined,
          timeout: 30000,
          image: 'alpine:latest'
        }
      );

      expect(result).toMatchObject({
        id: 'test-123',
        object: 'chat.completion',
        model: 'echo-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Echo: Hello, world!'
            },
            finish_reason: 'stop'
          }
        ],
        usage: expect.objectContaining({
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number)
        })
      });
    });

    it('should handle JSON output from CLI', async () => {
      const jsonOutput = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'JSON response'
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

      mockSandbox.execute.mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: JSON.stringify(jsonOutput),
        stderr: ''
      });

      const result = await adapter.handleChat({ messages, options, requestMeta });

      expect(result).toMatchObject({
        id: 'test-123',
        object: 'chat.completion',
        model: 'echo-model',
        choices: jsonOutput.choices,
        usage: jsonOutput.usage
      });
    });

    it('should throw error when command fails', async () => {
      mockSandbox.execute.mockResolvedValue({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Command failed'
      });

      await expect(adapter.handleChat({ messages, options, requestMeta }))
        .rejects.toThrow('CLI command failed with exit code 1: Command failed');
    });

    it('should pass cancellation signal to sandbox', async () => {
      // Mock AbortController for older Node versions
      const signal = { aborted: false };
      mockSandbox.execute.mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'test',
        stderr: ''
      });

      await adapter.handleChat({ messages, options, requestMeta, signal });

      expect(mockSandbox.execute).toHaveBeenCalledWith(
        'echo',
        [],
        expect.objectContaining({ signal })
      );
    });
  });

  describe('handleEmbeddings', () => {
    it('should throw error as embeddings are not supported', async () => {
      await expect(adapter.handleEmbeddings({ input: 'test' }))
        .rejects.toThrow('Embeddings not supported by SpawnCliAdapter');
    });
  });

  describe('testConnection', () => {
    it('should return success when test chat works', async () => {
      mockSandbox.execute.mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'test response',
        stderr: ''
      });

      const result = await adapter.testConnection();

      expect(result).toEqual({
        success: true,
        message: 'Connection test successful',
        details: {
          responseReceived: true,
          hasContent: true
        }
      });
    });

    it('should return failure when test chat fails', async () => {
      mockSandbox.execute.mockRejectedValue(new Error('Connection failed'));

      const result = await adapter.testConnection();

      expect(result).toEqual({
        success: false,
        message: 'Connection test failed',
        error: 'Connection failed'
      });
    });
  });

  describe('getModels', () => {
    it('should return models from provider config', () => {
      const models = adapter.getModels();
      expect(models).toEqual(providerConfig.models);
    });

    it('should return empty array if no models configured', () => {
      const adapterWithoutModels = new SpawnCliAdapter({ command: 'echo' }, {});
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

    it('should return invalid if command is missing', () => {
      const invalidAdapter = Object.create(SpawnCliAdapter.prototype);
      invalidAdapter.providerConfig = {};
      
      const result = invalidAdapter.validateConfig();
      expect(result).toEqual({
        valid: false,
        errors: ['command is required']
      });
    });

    it('should return invalid if timeout is too low', () => {
      const invalidAdapter = Object.create(SpawnCliAdapter.prototype);
      invalidAdapter.providerConfig = {
        command: 'echo',
        timeoutSeconds: 0
      };
      
      const result = invalidAdapter.validateConfig();
      expect(result).toEqual({
        valid: false,
        errors: ['timeoutSeconds must be at least 1']
      });
    });
  });

  describe('prepareInput', () => {
    it('should format messages and options as JSON', () => {
      const messages = [{ role: 'user', content: 'test' }];
      const options = { max_tokens: 100 };
      
      const input = adapter.prepareInput(messages, options);
      const parsed = JSON.parse(input);
      
      expect(parsed).toEqual({
        messages,
        options
      });
    });
  });

  describe('parseOutput', () => {
    it('should parse plain text output', () => {
      const output = 'Hello, world!';
      const requestId = 'test-123';
      
      const result = adapter.parseOutput(output, requestId);
      
      expect(result).toMatchObject({
        id: requestId,
        object: 'chat.completion',
        model: 'echo-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Echo: Hello, world!'
            },
            finish_reason: 'stop'
          }
        ]
      });
    });

    it('should parse JSON output', () => {
      const jsonOutput = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'JSON response'
            }
          }
        ]
      };
      const output = JSON.stringify(jsonOutput);
      const requestId = 'test-123';
      
      const result = adapter.parseOutput(output, requestId);
      
      expect(result).toMatchObject({
        id: requestId,
        object: 'chat.completion',
        model: 'echo-model',
        choices: jsonOutput.choices
      });
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      expect(adapter.estimateTokens('hello')).toBe(2); // 5 chars / 4 = 1.25 -> 2
      expect(adapter.estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 -> 3
      expect(adapter.estimateTokens('')).toBe(0);
      expect(adapter.estimateTokens(null)).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should complete without error', async () => {
      await expect(adapter.cleanup()).resolves.toBeUndefined();
    });
  });
});