/**
 * Integration test for Echo Adapter functionality
 * This test demonstrates the complete flow from adapter creation to execution
 */

const { AdapterFactory } = require('../../../src/gateway/adapters');

// Mock logger to avoid console output during tests
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock child_process for Docker sandbox
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

describe('Echo Adapter Integration', () => {
  let adapter;
  let mockProcess;

  beforeEach(() => {
    const { spawn } = require('child_process');
    const EventEmitter = require('events');
    
    // Create mock process
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.stdin = {
      write: jest.fn(),
      end: jest.fn()
    };
    
    spawn.mockReturnValue(mockProcess);

    // Create echo adapter configuration
    const providerConfig = {
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

    const provider = {
      id: 'echo-provider',
      name: 'Echo Provider',
      type: 'spawn-cli',
      adapterConfig: providerConfig
    };

    // Create adapter using factory
    adapter = AdapterFactory.createAdapter(provider);
  });

  it('should create echo adapter and handle chat request', async () => {
    const messages = [
      { role: 'user', content: 'Hello, echo!' }
    ];
    const options = { max_tokens: 100 };
    const requestMeta = { requestId: 'echo-test-123' };

    // Start the chat request
    const chatPromise = adapter.handleChat({ messages, options, requestMeta });

    // Simulate echo command returning the input
    setImmediate(() => {
      const expectedInput = JSON.stringify({ messages, options }, null, 2);
      mockProcess.stdout.emit('data', expectedInput);
      mockProcess.emit('close', 0);
    });

    const result = await chatPromise;

    // Verify the response structure
    expect(result).toMatchObject({
      id: 'echo-test-123',
      object: 'chat.completion',
      model: 'echo-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: expect.stringContaining('Echo:')
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

    // Verify Docker command was called correctly
    const { spawn } = require('child_process');
    expect(spawn).toHaveBeenCalledWith('docker', [
      'run',
      '--rm',
      '--name', expect.stringMatching(/^gateway-[a-f0-9]{8}$/),
      '--memory', '512m',
      '--cpus', '0.5',
      '--network', 'none',
      '--user', 'nobody',
      '--workdir', '/tmp',
      '-i',
      'alpine:latest',
      'echo'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
  });

  it('should test adapter connection', async () => {
    // Start the connection test
    const testPromise = adapter.testConnection();

    // Simulate successful echo response
    setImmediate(() => {
      mockProcess.stdout.emit('data', 'test response');
      mockProcess.emit('close', 0);
    });

    const result = await testPromise;

    expect(result).toEqual({
      success: true,
      message: 'Connection test successful',
      details: {
        responseReceived: true,
        hasContent: true
      }
    });
  });

  it('should get available models', () => {
    const models = adapter.getModels();
    
    expect(models).toEqual([
      {
        dyadModelId: 'echo-model',
        adapterModelId: 'echo',
        maxTokens: 1000
      }
    ]);
  });

  it('should validate configuration', () => {
    const validation = adapter.validateConfig();
    
    expect(validation).toEqual({
      valid: true,
      errors: []
    });
  });
});