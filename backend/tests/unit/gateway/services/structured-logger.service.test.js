/**
 * Structured Logger Service Tests
 * Tests for structured logging with correlation IDs
 */

const structuredLogger = require('../../../../src/gateway/services/structured-logger.service');

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    add: jest.fn(),
  })),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    printf: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    simple: jest.fn(() => ({})),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

describe('StructuredLoggerService', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = structuredLogger.getLogger();
    jest.clearAllMocks();
  });

  describe('Correlation ID Generation', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = structuredLogger.generateCorrelationId();
      const id2 = structuredLogger.generateCorrelationId();

      expect(id1).toMatch(/^corr_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^corr_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Child Logger Creation', () => {
    it('should create child logger with correlation ID', () => {
      const correlationId = 'test-correlation-id';
      const context = { provider: 'openai', model: 'gpt-4' };

      const childLogger = structuredLogger.createChildLogger(correlationId, context);

      expect(childLogger.correlationId).toBe(correlationId);
      expect(childLogger.context).toEqual(context);
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.warn).toBe('function');
      expect(typeof childLogger.error).toBe('function');
      expect(typeof childLogger.debug).toBe('function');
    });

    it('should log with correlation ID and context', () => {
      const correlationId = 'test-correlation-id';
      const context = { provider: 'openai' };
      const childLogger = structuredLogger.createChildLogger(correlationId, context);

      childLogger.info('Test message', { extra: 'data' });

      expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
        correlationId,
        provider: 'openai',
        extra: 'data',
      });
    });

    it('should handle errors with stack traces', () => {
      const correlationId = 'test-correlation-id';
      const childLogger = structuredLogger.createChildLogger(correlationId);
      const error = new Error('Test error');

      childLogger.error('Error occurred', error, { context: 'test' });

      expect(mockLogger.error).toHaveBeenCalledWith('Error occurred', {
        correlationId,
        error: {
          message: 'Test error',
          stack: error.stack,
          name: 'Error',
        },
        context: 'test',
      });
    });
  });

  describe('HTTP Request Logging', () => {
    it('should log HTTP request with all details', () => {
      const req = {
        method: 'POST',
        url: '/v1/chat/completions',
        path: '/v1/chat/completions',
        ip: '127.0.0.1',
        get: jest.fn((header) => {
          const headers = {
            'User-Agent': 'test-client/1.0',
            'Content-Length': '1024',
          };
          return headers[header];
        }),
        apiKeyId: 'key123',
        provider: 'openai',
        model: 'gpt-4',
      };

      const res = {
        statusCode: 200,
        get: jest.fn((header) => {
          const headers = {
            'Content-Length': '512',
          };
          return headers[header];
        }),
      };

      const duration = 1.5;
      const correlationId = 'test-correlation-id';

      structuredLogger.logHttpRequest(req, res, duration, correlationId);

      expect(mockLogger.info).toHaveBeenCalledWith('HTTP request completed', {
        correlationId,
        type: 'http_request',
        method: 'POST',
        url: '/v1/chat/completions',
        path: '/v1/chat/completions',
        statusCode: 200,
        duration: 1.5,
        userAgent: 'test-client/1.0',
        ip: '127.0.0.1',
        apiKeyId: 'key123',
        requestSize: '1024',
        responseSize: '512',
        provider: 'openai',
        model: 'gpt-4',
      });
    });
  });

  describe('Adapter Execution Logging', () => {
    it('should log adapter execution', () => {
      const correlationId = 'test-correlation-id';
      const meta = { outputTokens: 150, executionTime: 2.5 };

      structuredLogger.logAdapterExecution(
        'spawn-cli',
        'my-provider',
        'my-model',
        'success',
        2.5,
        correlationId,
        meta
      );

      expect(mockLogger.info).toHaveBeenCalledWith('Adapter execution completed', {
        correlationId,
        type: 'adapter_execution',
        adapterType: 'spawn-cli',
        provider: 'my-provider',
        model: 'my-model',
        status: 'success',
        duration: 2.5,
        outputTokens: 150,
        executionTime: 2.5,
      });
    });
  });

  describe('Circuit Breaker Event Logging', () => {
    it('should log circuit breaker events', () => {
      const correlationId = 'test-correlation-id';
      const meta = { failureCount: 5, threshold: 3 };

      structuredLogger.logCircuitBreakerEvent(
        'openai',
        'http-sdk',
        'opened',
        correlationId,
        meta
      );

      expect(mockLogger.warn).toHaveBeenCalledWith('Circuit breaker event', {
        correlationId,
        type: 'circuit_breaker_event',
        provider: 'openai',
        adapterType: 'http-sdk',
        event: 'opened',
        failureCount: 5,
        threshold: 3,
      });
    });
  });

  describe('Provider Health Check Logging', () => {
    it('should log successful health check', () => {
      const correlationId = 'test-correlation-id';

      structuredLogger.logProviderHealthCheck(
        'openai',
        'http-sdk',
        true,
        0.5,
        correlationId
      );

      expect(mockLogger.info).toHaveBeenCalledWith('Provider health check passed', {
        correlationId,
        type: 'provider_health_check',
        provider: 'openai',
        adapterType: 'http-sdk',
        isHealthy: true,
        duration: 0.5,
      });
    });

    it('should log failed health check with error', () => {
      const correlationId = 'test-correlation-id';
      const error = new Error('Connection timeout');

      structuredLogger.logProviderHealthCheck(
        'failing-provider',
        'http-sdk',
        false,
        5.0,
        correlationId,
        error
      );

      expect(mockLogger.warn).toHaveBeenCalledWith('Provider health check failed', {
        correlationId,
        type: 'provider_health_check',
        provider: 'failing-provider',
        adapterType: 'http-sdk',
        isHealthy: false,
        duration: 5.0,
        error: {
          message: 'Connection timeout',
          stack: error.stack,
        },
      });
    });
  });

  describe('Authentication Event Logging', () => {
    it('should log authentication events', () => {
      const correlationId = 'test-correlation-id';
      const meta = { ip: '127.0.0.1', userAgent: 'test-client' };

      structuredLogger.logAuthEvent('success', 'key123', correlationId, meta);

      expect(mockLogger.info).toHaveBeenCalledWith('Authentication event', {
        correlationId,
        type: 'auth_event',
        event: 'success',
        apiKeyId: 'key123',
        ip: '127.0.0.1',
        userAgent: 'test-client',
      });
    });
  });

  describe('Rate Limit Event Logging', () => {
    it('should log rate limit events', () => {
      const correlationId = 'test-correlation-id';
      const meta = { currentRate: 100, limit: 50 };

      structuredLogger.logRateLimitEvent('key123', 'requests', correlationId, meta);

      expect(mockLogger.warn).toHaveBeenCalledWith('Rate limit exceeded', {
        correlationId,
        type: 'rate_limit_event',
        apiKeyId: 'key123',
        limitType: 'requests',
        currentRate: 100,
        limit: 50,
      });
    });
  });

  describe('Streaming Event Logging', () => {
    it('should log streaming events', () => {
      const correlationId = 'test-correlation-id';
      const meta = { connectionId: 'conn123', chunkCount: 5 };

      structuredLogger.logStreamingEvent('chunk_sent', 'openai', 'gpt-4', correlationId, meta);

      expect(mockLogger.info).toHaveBeenCalledWith('Streaming event', {
        correlationId,
        type: 'streaming_event',
        event: 'chunk_sent',
        provider: 'openai',
        model: 'gpt-4',
        connectionId: 'conn123',
        chunkCount: 5,
      });
    });
  });

  describe('Sandbox Execution Logging', () => {
    it('should log sandbox execution with sanitized command', () => {
      const correlationId = 'test-correlation-id';
      const command = 'my-cli --api-key=secret123 --token=abc123def456';
      const meta = { exitCode: 0, memoryUsage: '128MB' };

      structuredLogger.logSandboxExecution(
        'my-provider',
        command,
        'success',
        2.5,
        correlationId,
        meta
      );

      expect(mockLogger.info).toHaveBeenCalledWith('Sandbox execution completed', {
        correlationId,
        type: 'sandbox_execution',
        provider: 'my-provider',
        command: 'my-cli --api-key=*** --token=***',
        status: 'success',
        duration: 2.5,
        exitCode: 0,
        memoryUsage: '128MB',
      });
    });
  });

  describe('Admin Action Logging', () => {
    it('should log admin actions', () => {
      const correlationId = 'test-correlation-id';
      const meta = { providerId: 'provider123', changes: { enabled: true } };

      structuredLogger.logAdminAction(
        'update',
        'admin123',
        'provider',
        correlationId,
        meta
      );

      expect(mockLogger.info).toHaveBeenCalledWith('Admin action performed', {
        correlationId,
        type: 'admin_action',
        action: 'update',
        userId: 'admin123',
        resource: 'provider',
        providerId: 'provider123',
        changes: { enabled: true },
      });
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events', () => {
      const correlationId = 'test-correlation-id';
      const meta = { ip: '192.168.1.100', attemptedKey: 'invalid-key' };

      structuredLogger.logSecurityEvent('invalid_api_key', correlationId, meta);

      expect(mockLogger.warn).toHaveBeenCalledWith('Security event', {
        correlationId,
        type: 'security_event',
        event: 'invalid_api_key',
        ip: '192.168.1.100',
        attemptedKey: 'invalid-key',
      });
    });
  });

  describe('Command Sanitization', () => {
    it('should sanitize API keys from commands', () => {
      const command = 'cli --api-key=secret123 --other-param=value';
      const sanitized = structuredLogger.sanitizeCommand(command);

      expect(sanitized).toBe('cli --api-key=*** --other-param=value');
    });

    it('should sanitize tokens from commands', () => {
      const command = 'cli --token=abc123def456 --password=secret';
      const sanitized = structuredLogger.sanitizeCommand(command);

      expect(sanitized).toBe('cli --token=*** --password=***');
    });

    it('should sanitize Bearer tokens', () => {
      const command = 'curl -H "Authorization: Bearer sk-1234567890abcdef"';
      const sanitized = structuredLogger.sanitizeCommand(command);

      expect(sanitized).toBe('curl -H "Authorization: Bearer ***"');
    });

    it('should sanitize long alphanumeric strings', () => {
      const command = 'cli --key=abcdef1234567890abcdef1234567890';
      const sanitized = structuredLogger.sanitizeCommand(command);

      expect(sanitized).toBe('cli --key=***');
    });

    it('should handle non-string commands', () => {
      const command = ['cli', '--api-key=secret'];
      const sanitized = structuredLogger.sanitizeCommand(command);

      expect(sanitized).toEqual(command);
    });
  });
});