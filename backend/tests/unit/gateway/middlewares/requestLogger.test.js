const httpMocks = require('node-mocks-http');
const requestLogger = require('../../../../src/gateway/middlewares/requestLogger');
const logger = require('../../../../src/config/logger');

// Mock dependencies
jest.mock('../../../../src/config/logger');

// Mock crypto.randomUUID
const mockUuid = 'mock-uuid-123';
global.crypto = {
  randomUUID: jest.fn(() => mockUuid)
};

describe('Request Logger Middleware', () => {
  let req, res, next;
  let mockApiKey;

  beforeEach(() => {
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn();

    mockApiKey = {
      id: 'apikey123',
      name: 'Test API Key',
      userId: 'user123',
      permissions: ['chat', 'models']
    };

    // Reset mocks
    jest.clearAllMocks();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
  });

  describe('Request ID Generation', () => {
    it('should generate request ID when not provided', () => {
      requestLogger(req, res, next);
      
      expect(req.id).toBe('mock-uuid-123');
      expect(res.get('X-Request-ID')).toBe('mock-uuid-123');
      expect(next).toHaveBeenCalled();
    });

    it('should use existing request ID from header', () => {
      req.headers['x-request-id'] = 'existing-request-id';
      
      requestLogger(req, res, next);
      
      expect(req.id).toBe('existing-request-id');
      expect(res.get('X-Request-ID')).toBe('existing-request-id');
    });
  });

  describe('Request Logging', () => {
    beforeEach(() => {
      req.method = 'POST';
      req.path = '/v1/chat/completions';
      req.query = { stream: 'true' };
      req.ip = '192.168.1.1';
      req.headers = {
        'user-agent': 'TestClient/1.0',
        'content-type': 'application/json',
        'content-length': '256'
      };
    });

    it('should log basic request information', () => {
      requestLogger(req, res, next);
      
      expect(logger.info).toHaveBeenCalledWith(
        'Gateway request received',
        expect.objectContaining({
          requestId: 'mock-uuid-123',
          method: 'POST',
          path: '/v1/chat/completions',
          query: { stream: 'true' },
          ip: '192.168.1.1',
          userAgent: 'TestClient/1.0',
          contentType: 'application/json',
          contentLength: '256',
          timestamp: expect.any(String)
        })
      );
    });

    it('should log authentication context when API key is present', () => {
      req.apiKey = mockApiKey;
      
      requestLogger(req, res, next);
      
      expect(logger.info).toHaveBeenCalledWith(
        'Gateway request received',
        expect.objectContaining({
          auth: {
            keyId: 'apikey123',
            keyName: 'Test API Key',
            userId: 'user123',
            permissions: ['chat', 'models']
          }
        })
      );
    });

    it('should log request body details for chat completions', () => {
      req.body = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ],
        max_tokens: 100,
        temperature: 0.7,
        stream: true
      };
      
      requestLogger(req, res, next);
      
      expect(logger.info).toHaveBeenCalledWith(
        'Gateway request received',
        expect.objectContaining({
          requestBody: {
            model: 'gpt-3.5-turbo',
            messagesCount: 2,
            maxTokens: 100,
            temperature: 0.7,
            stream: true
          }
        })
      );
    });

    it('should log request body details for embeddings', () => {
      req.path = '/v1/embeddings';
      req.body = {
        model: 'text-embedding-ada-002',
        input: 'Some text to embed'
      };
      
      requestLogger(req, res, next);
      
      expect(logger.info).toHaveBeenCalledWith(
        'Gateway request received',
        expect.objectContaining({
          requestBody: {
            model: 'text-embedding-ada-002'
          }
        })
      );
    });

    it('should not log request body for other endpoints', () => {
      req.path = '/v1/models';
      req.body = { someData: 'value' };
      
      requestLogger(req, res, next);
      
      const logCall = logger.info.mock.calls[0][1];
      expect(logCall.requestBody).toBeUndefined();
    });
  });

  describe('Response Logging', () => {
    beforeEach(() => {
      req.method = 'GET';
      req.path = '/v1/models';
      req.ip = '192.168.1.1';
    });

    it('should log successful response', (done) => {
      requestLogger(req, res, next);
      
      // Simulate response
      res.statusCode = 200;
      res.set('Content-Length', '1024');
      
      // Override the end method to capture the log
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        originalEnd.call(this, chunk, encoding);
        
        expect(logger.info).toHaveBeenCalledWith(
          'Gateway request completed successfully',
          expect.objectContaining({
            requestId: 'mock-uuid-123',
            method: 'GET',
            path: '/v1/models',
            statusCode: 200,
            duration: expect.stringMatching(/^\d+ms$/),
            contentLength: '1024',
            timestamp: expect.any(String)
          })
        );
        done();
      };
      
      res.end();
    });

    it('should log client error response', (done) => {
      requestLogger(req, res, next);
      
      res.statusCode = 400;
      
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        originalEnd.call(this, chunk, encoding);
        
        expect(logger.warn).toHaveBeenCalledWith(
          'Gateway request completed with client error',
          expect.objectContaining({
            statusCode: 400
          })
        );
        done();
      };
      
      res.end();
    });

    it('should log server error response', (done) => {
      requestLogger(req, res, next);
      
      res.statusCode = 500;
      
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        originalEnd.call(this, chunk, encoding);
        
        expect(logger.error).toHaveBeenCalledWith(
          'Gateway request completed with server error',
          expect.objectContaining({
            statusCode: 500
          })
        );
        done();
      };
      
      res.end();
    });

    it('should include authentication context in response log', (done) => {
      req.apiKey = mockApiKey;
      requestLogger(req, res, next);
      
      res.statusCode = 200;
      
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        originalEnd.call(this, chunk, encoding);
        
        expect(logger.info).toHaveBeenCalledWith(
          'Gateway request completed successfully',
          expect.objectContaining({
            auth: {
              keyId: 'apikey123',
              keyName: 'Test API Key',
              userId: 'user123'
            }
          })
        );
        done();
      };
      
      res.end();
    });

    it('should measure request duration accurately', (done) => {
      const startTime = Date.now();
      requestLogger(req, res, next);
      
      // Simulate some processing time
      setTimeout(() => {
        res.statusCode = 200;
        
        const originalEnd = res.end;
        res.end = function(chunk, encoding) {
          originalEnd.call(this, chunk, encoding);
          
          const logCall = logger.info.mock.calls.find(call => 
            call[0] === 'Gateway request completed successfully'
          );
          const duration = parseInt(logCall[1].duration.replace('ms', ''));
          const actualDuration = Date.now() - startTime;
          
          // Allow some tolerance for timing
          expect(duration).toBeGreaterThanOrEqual(50);
          expect(duration).toBeLessThan(actualDuration + 10);
          done();
        };
        
        res.end();
      }, 50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing headers gracefully', () => {
      req.headers = {};
      
      requestLogger(req, res, next);
      
      expect(logger.info).toHaveBeenCalledWith(
        'Gateway request received',
        expect.objectContaining({
          userAgent: undefined,
          contentType: undefined,
          contentLength: undefined
        })
      );
    });

    it('should handle missing request body gracefully', () => {
      req.path = '/v1/chat/completions';
      req.body = undefined;
      
      requestLogger(req, res, next);
      
      const logCall = logger.info.mock.calls[0][1];
      expect(logCall.requestBody).toEqual({
        model: undefined,
        messagesCount: undefined,
        maxTokens: undefined,
        temperature: undefined,
        stream: undefined
      });
    });

    it('should handle response without content-length header', (done) => {
      requestLogger(req, res, next);
      
      res.statusCode = 200;
      
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        originalEnd.call(this, chunk, encoding);
        
        expect(logger.info).toHaveBeenCalledWith(
          'Gateway request completed successfully',
          expect.objectContaining({
            contentLength: undefined
          })
        );
        done();
      };
      
      res.end();
    });
  });
});