/**
 * Unit tests for DockerSandbox
 */

const DockerSandbox = require('../../../../src/gateway/utils/docker-sandbox');

// Mock logger
jest.mock('../../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('DockerSandbox', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = new DockerSandbox({
      image: 'test:latest',
      timeout: 5000,
      memoryLimit: '256m',
      cpuLimit: '0.25'
    });
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultSandbox = new DockerSandbox();
      
      expect(defaultSandbox.defaultImage).toBe('alpine:latest');
      expect(defaultSandbox.defaultTimeout).toBe(30000);
      expect(defaultSandbox.defaultMemoryLimit).toBe('128m');
      expect(defaultSandbox.defaultCpuLimit).toBe('0.5');
    });

    it('should initialize with custom options', () => {
      expect(sandbox.defaultImage).toBe('test:latest');
      expect(sandbox.defaultTimeout).toBe(5000);
      expect(sandbox.defaultMemoryLimit).toBe('256m');
      expect(sandbox.defaultCpuLimit).toBe('0.25');
    });
  });

  describe('sanitizeForLogging', () => {
    it('should sanitize API keys', () => {
      const result = sandbox.sanitizeForLogging('--api-key=secret123');
      expect(result).toBe('--api-key=***');
    });

    it('should sanitize tokens', () => {
      const result = sandbox.sanitizeForLogging('--token secret456');
      expect(result).toBe('--token=***');
    });

    it('should sanitize passwords', () => {
      const result = sandbox.sanitizeForLogging('--password=mypass');
      expect(result).toBe('--password=***');
    });

    it('should sanitize secrets', () => {
      const result = sandbox.sanitizeForLogging('--secret mysecret');
      expect(result).toBe('--secret=***');
    });

    it('should handle non-string input', () => {
      expect(sandbox.sanitizeForLogging(123)).toBe(123);
      expect(sandbox.sanitizeForLogging(null)).toBe(null);
      expect(sandbox.sanitizeForLogging(undefined)).toBe(undefined);
    });

    it('should not modify non-sensitive text', () => {
      const text = 'echo hello world';
      expect(sandbox.sanitizeForLogging(text)).toBe(text);
    });
  });

  describe('execute method signature', () => {
    it('should be a function', () => {
      expect(typeof sandbox.execute).toBe('function');
    });

    it('should return a promise', () => {
      // Mock spawn to avoid actual execution
      jest.doMock('child_process', () => ({
        spawn: jest.fn().mockReturnValue({
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          stdin: { write: jest.fn(), end: jest.fn() },
          on: jest.fn()
        })
      }));

      const result = sandbox.execute('echo', ['test']);
      expect(result).toBeInstanceOf(Promise);
      
      // Clean up the promise to avoid hanging
      result.catch(() => {});
    });
  });

  describe('killContainer method signature', () => {
    it('should be a function', () => {
      expect(typeof sandbox.killContainer).toBe('function');
    });

    it('should return a promise', () => {
      // Mock spawn to avoid actual execution
      jest.doMock('child_process', () => ({
        spawn: jest.fn().mockReturnValue({
          on: jest.fn()
        })
      }));

      const result = sandbox.killContainer('test-container');
      expect(result).toBeInstanceOf(Promise);
      
      // Clean up the promise to avoid hanging
      result.catch(() => {});
    });
  });

  describe('executeStream method signature', () => {
    it('should be a function', () => {
      expect(typeof sandbox.executeStream).toBe('function');
    });

    it('should return an async generator', () => {
      // Mock spawn to avoid actual execution
      const mockProcess = {
        stdout: {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from('test chunk');
          }
        },
        stderr: { on: jest.fn() },
        stdin: { write: jest.fn(), end: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      jest.doMock('child_process', () => ({
        spawn: jest.fn().mockReturnValue(mockProcess)
      }));

      const result = sandbox.executeStream('echo', ['test']);
      expect(result).toBeDefined();
      expect(typeof result[Symbol.asyncIterator]).toBe('function');
    });
  });

  describe('streaming chunk formatting', () => {
    it('should format stream chunks correctly', () => {
      const chunk = { delta: { content: 'Hello' } };
      const requestId = 'test-123';
      const index = 0;

      const result = sandbox.formatStreamChunk(chunk, requestId, index);

      expect(result).toMatchObject({
        id: requestId,
        object: 'chat.completion.chunk',
        created: expect.any(Number),
        model: 'docker-cli',
        choices: [{
          index: 0,
          delta: { content: 'Hello' },
          finish_reason: null
        }]
      });
    });

    it('should format text chunks correctly', () => {
      const text = 'Hello world';
      const requestId = 'test-123';
      const index = 0;

      const result = sandbox.formatTextChunk(text, requestId, index);

      expect(result).toMatchObject({
        id: requestId,
        object: 'chat.completion.chunk',
        created: expect.any(Number),
        model: 'docker-cli',
        choices: [{
          index: 0,
          delta: { content: text },
          finish_reason: null
        }]
      });
    });

    it('should format final chunk correctly', () => {
      const requestId = 'test-123';

      const result = sandbox.formatFinalChunk(requestId);

      expect(result).toMatchObject({
        id: requestId,
        object: 'chat.completion.chunk',
        created: expect.any(Number),
        model: 'docker-cli',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      });
    });
  });
});