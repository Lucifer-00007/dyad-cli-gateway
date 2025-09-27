/**
 * Monitoring Middleware Tests
 * Tests for request tracking and metrics collection middleware
 */

const {
  requestTracking,
  adapterTracking,
  streamingTracking,
  errorTracking,
  rateLimitTracking,
  correlationId,
} = require('../../../../src/gateway/middlewares/monitoring.middleware');

// Mock the monitoring service
jest.mock('../../../../src/gateway/services/monitoring.service', () => ({
  recordHttpRequest: jest.fn(),
  recordAdapterRequest: jest.fn(),
  recordApiKeyRequest: jest.fn(),
  recordStreamingConnection: jest.fn(),
  recordStreamingChunk: jest.fn(),
  recordError: jest.fn(),
  recordRateLimitHit: jest.fn(),
}));

// Mock the structured logger service
jest.mock('../../../../src/gateway/services/structured-logger.service', () => ({
  generateCorrelationId: jest.fn(() => 'corr_test123'),
  createChildLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  logHttpRequest: jest.fn(),
  logAdapterExecution: jest.fn(),
  logRateLimitEvent: jest.fn(),
}));

const monitoringService = require('../../../../src/gateway/services/monitoring.service');
const structuredLogger = require('../../../../src/gateway/services/structured-logger.service');

describe('Monitoring Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'POST',
      path: '/v1/chat/completions',
      url: '/v1/chat/completions',
      ip: '127.0.0.1',
      get: jest.fn((header) => {
        const headers = {
          'User-Agent': 'test-client/1.0',
          'Content-Length': '1024',
        };
        return headers[header];
      }),
      on: jest.fn(),
    };

    res = {
      statusCode: 200,
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
      get: jest.fn(() => '512'),
    };

    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('correlationId middleware', () => {
    it('should generate correlation ID if not present', () => {
      correlationId(req, res, next);

      expect(req.correlationId).toBe('corr_test123');
      expect(res.set).toHaveBeenCalledWith('X-Correlation-ID', 'corr_test123');
      expect(next).toHaveBeenCalled();
    });

    it('should use existing requestId as correlation ID', () => {
      req.requestId = 'req_existing123';

      correlationId(req, res, next);

      expect(req.correlationId).toBe('req_existing123');
      expect(res.set).toHaveBeenCalledWith('X-Correlation-ID', 'req_existing123');
    });
  });

  describe('requestTracking middleware', () => {
    it('should set up request tracking', () => {
      requestTracking(req, res, next);

      expect(req.correlationId).toBe('corr_test123');
      expect(structuredLogger.createChildLogger).toHaveBeenCalledWith('corr_test123', {
        requestId: req.requestId,
        method: 'POST',
        path: '/v1/chat/completions',
        ip: '127.0.0.1',
      });
      expect(req.logger.info).toHaveBeenCalledWith('HTTP request started', {
        method: 'POST',
        url: '/v1/chat/completions',
        userAgent: 'test-client/1.0',
        contentLength: '1024',
      });
      expect(next).toHaveBeenCalled();
    });

    it('should track request completion when response ends', () => {
      req.provider = 'openai';
      req.model = 'gpt-4';
      req.apiKeyId = 'key123';

      requestTracking(req, res, next);

      // Simulate response end
      res.end();

      expect(monitoringService.recordHttpRequest).toHaveBeenCalledWith(
        'POST',
        '/v1/chat/:param',
        200,
        expect.any(Number),
        'openai',
        'gpt-4'
      );

      expect(structuredLogger.logHttpRequest).toHaveBeenCalledWith(
        req,
        res,
        expect.any(Number),
        'corr_test123'
      );

      expect(monitoringService.recordApiKeyRequest).toHaveBeenCalledWith('key123', 'success');
    });

    it('should handle error status codes', () => {
      res.statusCode = 500;
      req.apiKeyId = 'key123';

      requestTracking(req, res, next);

      // Simulate response end
      res.end();

      expect(monitoringService.recordApiKeyRequest).toHaveBeenCalledWith('key123', 'error');
    });
  });

  describe('adapterTracking middleware', () => {
    it('should set up adapter tracking', () => {
      const middleware = adapterTracking('spawn-cli');

      middleware(req, res, next);

      expect(req.adapterStartTime).toBeDefined();
      expect(req.adapterType).toBe('spawn-cli');
      expect(typeof req.recordAdapterCompletion).toBe('function');
      expect(next).toHaveBeenCalled();
    });

    it('should record adapter completion', () => {
      req.correlationId = 'corr_test123';
      const middleware = adapterTracking('http-sdk');
      middleware(req, res, next);

      const meta = { outputTokens: 150 };
      req.recordAdapterCompletion('openai', 'gpt-4', 'success', meta);

      expect(monitoringService.recordAdapterRequest).toHaveBeenCalledWith(
        'http-sdk',
        'openai',
        'gpt-4',
        'success',
        expect.any(Number)
      );

      expect(structuredLogger.logAdapterExecution).toHaveBeenCalledWith(
        'http-sdk',
        'openai',
        'gpt-4',
        'success',
        expect.any(Number),
        'corr_test123',
        meta
      );
    });
  });

  describe('streamingTracking middleware', () => {
    it('should track streaming requests', () => {
      req.body = { stream: true, model: 'gpt-4' };
      req.provider = 'openai';
      req.logger = {
        info: jest.fn(),
      };

      streamingTracking(req, res, next);

      expect(monitoringService.recordStreamingConnection).toHaveBeenCalledWith('openai', 'gpt-4', 1);
      expect(req.logger.info).toHaveBeenCalledWith('Streaming connection started', {
        provider: 'openai',
        model: 'gpt-4',
      });
      expect(typeof req.recordStreamingChunk).toBe('function');
      expect(next).toHaveBeenCalled();
    });

    it('should track streaming connection end', () => {
      req.body = { stream: true, model: 'gpt-4' };
      req.provider = 'openai';
      req.logger = {
        info: jest.fn(),
      };

      streamingTracking(req, res, next);

      // Simulate connection close
      const closeHandler = req.on.mock.calls.find(call => call[0] === 'close')[1];
      closeHandler();

      expect(monitoringService.recordStreamingConnection).toHaveBeenCalledWith('openai', 'gpt-4', -1);
      expect(req.logger.info).toHaveBeenCalledWith('Streaming connection ended', {
        provider: 'openai',
        model: 'gpt-4',
      });
    });

    it('should track streaming chunks', () => {
      req.body = { stream: true, model: 'gpt-4' };
      req.provider = 'openai';
      req.logger = {
        info: jest.fn(),
      };

      streamingTracking(req, res, next);

      req.recordStreamingChunk();

      expect(monitoringService.recordStreamingChunk).toHaveBeenCalledWith('openai', 'gpt-4');
    });

    it('should skip non-streaming requests', () => {
      req.body = { stream: false };

      streamingTracking(req, res, next);

      expect(monitoringService.recordStreamingConnection).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('errorTracking middleware', () => {
    it('should track errors', () => {
      const error = new Error('Test error');
      error.name = 'ValidationError';
      error.code = 'invalid_request';

      req.provider = 'openai';
      req.adapterType = 'http-sdk';
      req.logger = {
        error: jest.fn(),
      };

      errorTracking(error, req, res, next);

      expect(monitoringService.recordError).toHaveBeenCalledWith(
        'ValidationError',
        'invalid_request',
        'openai',
        'http-sdk'
      );

      expect(req.logger.error).toHaveBeenCalledWith('Request error occurred', error, {
        errorType: 'ValidationError',
        errorCode: 'invalid_request',
        provider: 'openai',
        adapterType: 'http-sdk',
      });

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle errors without logger', () => {
      const error = new Error('Test error');

      errorTracking(error, req, res, next);

      expect(monitoringService.recordError).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('rateLimitTracking middleware', () => {
    it('should track rate limit hits', () => {
      const middleware = rateLimitTracking('requests');
      req.apiKeyId = 'key123';
      req.correlationId = 'corr_test123';

      middleware(req, res, next);

      // Simulate rate limit response
      res.status(429);

      expect(monitoringService.recordRateLimitHit).toHaveBeenCalledWith('key123', 'requests');
      expect(structuredLogger.logRateLimitEvent).toHaveBeenCalledWith(
        'key123',
        'requests',
        'corr_test123'
      );
      expect(next).toHaveBeenCalled();
    });

    it('should not track non-rate-limit responses', () => {
      const middleware = rateLimitTracking('requests');
      req.apiKeyId = 'key123';

      middleware(req, res, next);

      res.status(200);

      expect(monitoringService.recordRateLimitHit).not.toHaveBeenCalled();
    });

    it('should handle requests without API key', () => {
      const middleware = rateLimitTracking('requests');

      middleware(req, res, next);

      res.status(429);

      expect(monitoringService.recordRateLimitHit).not.toHaveBeenCalled();
    });
  });
});