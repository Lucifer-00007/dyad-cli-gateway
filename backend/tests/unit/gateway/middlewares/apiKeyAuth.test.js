const httpStatus = require('http-status');
const httpMocks = require('node-mocks-http');

// Mock dependencies first
jest.mock('../../../../src/config/logger');

// Mock the ApiKey model
const mockFindByKey = jest.fn();
jest.mock('../../../../src/models', () => ({
  ApiKey: {
    findByKey: mockFindByKey
  }
}));

// Import after mocking
const apiKeyAuth = require('../../../../src/gateway/middlewares/apiKeyAuth');
const logger = require('../../../../src/config/logger');

describe('API Key Authentication Middleware', () => {
  let req, res, next;
  let mockApiKeyDoc;

  beforeEach(() => {
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn();

    // Mock API key document
    mockApiKeyDoc = {
      id: 'apikey123',
      name: 'Test API Key',
      userId: 'user123',
      enabled: true,
      permissions: ['chat', 'models'],
      expiresAt: null,
      rateLimits: {
        requestsPerDay: 1000,
        tokensPerDay: 100000
      },
      usageStats: {
        requestsToday: 10,
        tokensToday: 1000
      },
      hasPermission: jest.fn(),
      canAccessModel: jest.fn(),
      canAccessProvider: jest.fn(),
      checkRateLimit: jest.fn(),
      isExpired: jest.fn(),
      updateUsage: jest.fn()
    };

    // Reset mocks
    jest.clearAllMocks();
    mockFindByKey.mockReset();
    logger.warn = jest.fn();
    logger.info = jest.fn();
    logger.error = jest.fn();
  });

  describe('Authorization Header Validation', () => {
    it('should reject requests without Authorization header', async () => {
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.UNAUTHORIZED,
          message: 'Authorization header with Bearer token required'
        })
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'API key authentication failed: Missing or invalid Authorization header',
        expect.any(Object)
      );
    });

    it('should reject requests with invalid Authorization header format', async () => {
      req.headers.authorization = 'Basic invalid';
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.UNAUTHORIZED,
          message: 'Authorization header with Bearer token required'
        })
      );
    });

    it('should reject requests with empty Bearer token', async () => {
      req.headers.authorization = 'Bearer ';
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.UNAUTHORIZED,
          message: 'API key required'
        })
      );
    });
  });

  describe('API Key Validation', () => {
    beforeEach(() => {
      req.headers.authorization = 'Bearer dyad_validkey123';
    });

    it('should reject invalid API keys', async () => {
      mockFindByKey.mockResolvedValue(null);
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(mockFindByKey).toHaveBeenCalledWith('dyad_validkey123');
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.UNAUTHORIZED,
          message: 'Invalid API key'
        })
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'API key authentication failed: Invalid API key',
        expect.objectContaining({
          keyPrefix: 'dyad_val'
        })
      );
    });

    it('should reject disabled API keys', async () => {
      const disabledApiKey = { ...mockApiKeyDoc, enabled: false };
      mockFindByKey.mockResolvedValue(disabledApiKey);
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.UNAUTHORIZED,
          message: 'API key is disabled'
        })
      );
    });

    it('should reject expired API keys', async () => {
      const expiredApiKey = { 
        ...mockApiKeyDoc, 
        expiresAt: new Date('2023-01-01'),
        isExpired: jest.fn().mockReturnValue(true)
      };
      mockFindByKey.mockResolvedValue(expiredApiKey);
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.UNAUTHORIZED,
          message: 'API key has expired'
        })
      );
    });
  });

  describe('Permission Validation', () => {
    beforeEach(() => {
      req.headers.authorization = 'Bearer dyad_validkey123';
      mockFindByKey.mockResolvedValue(mockApiKeyDoc);
      mockApiKeyDoc.isExpired.mockReturnValue(false);
      mockApiKeyDoc.checkRateLimit.mockReturnValue({ allowed: true });
    });

    it('should allow requests when no permissions required', async () => {
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(req.apiKey).toBe(mockApiKeyDoc);
      expect(req.user).toEqual({ id: 'user123' });
      expect(next).toHaveBeenCalledWith();
      expect(logger.info).toHaveBeenCalledWith(
        'API key authenticated successfully',
        expect.any(Object)
      );
    });

    it('should allow requests when API key has required permissions', async () => {
      mockApiKeyDoc.hasPermission.mockReturnValue(true);
      const middleware = apiKeyAuth(['chat']);
      
      await middleware(req, res, next);
      
      expect(mockApiKeyDoc.hasPermission).toHaveBeenCalledWith('chat');
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject requests when API key lacks required permissions', async () => {
      mockApiKeyDoc.hasPermission.mockReturnValue(false);
      const middleware = apiKeyAuth(['admin']);
      
      await middleware(req, res, next);
      
      expect(mockApiKeyDoc.hasPermission).toHaveBeenCalledWith('admin');
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.FORBIDDEN,
          message: 'Insufficient permissions'
        })
      );
    });

    it('should check all required permissions', async () => {
      mockApiKeyDoc.hasPermission.mockImplementation((perm) => perm === 'chat');
      const middleware = apiKeyAuth(['chat', 'embeddings']);
      
      await middleware(req, res, next);
      
      expect(mockApiKeyDoc.hasPermission).toHaveBeenCalledWith('chat');
      expect(mockApiKeyDoc.hasPermission).toHaveBeenCalledWith('embeddings');
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.FORBIDDEN,
          message: 'Insufficient permissions'
        })
      );
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      req.headers.authorization = 'Bearer dyad_validkey123';
      mockFindByKey.mockResolvedValue(mockApiKeyDoc);
      mockApiKeyDoc.isExpired.mockReturnValue(false);
    });

    it('should allow requests within rate limits', async () => {
      mockApiKeyDoc.checkRateLimit.mockReturnValue({ allowed: true });
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(mockApiKeyDoc.checkRateLimit).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject requests exceeding rate limits', async () => {
      const resetTime = new Date(Date.now() + 3600000);
      mockApiKeyDoc.checkRateLimit.mockReturnValue({
        allowed: false,
        reason: 'Daily request limit exceeded',
        resetTime
      });
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.TOO_MANY_REQUESTS,
          message: 'Daily request limit exceeded'
        })
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'API key rate limit exceeded',
        expect.objectContaining({
          reason: 'Daily request limit exceeded'
        })
      );
    });

    it('should set rate limit headers when rate limited', async () => {
      const resetTime = new Date(Date.now() + 3600000);
      mockApiKeyDoc.checkRateLimit.mockReturnValue({
        allowed: false,
        reason: 'Daily request limit exceeded',
        resetTime
      });
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(res.get('X-RateLimit-Reset')).toBe(Math.ceil(resetTime.getTime() / 1000).toString());
      expect(res.get('X-RateLimit-Limit-Requests')).toBe('1000');
      expect(res.get('X-RateLimit-Remaining-Requests')).toBe('990');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      req.headers.authorization = 'Bearer dyad_validkey123';
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockFindByKey.mockRejectedValue(dbError);
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith(
        'API key authentication error',
        expect.objectContaining({
          error: 'Database connection failed'
        })
      );
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.INTERNAL_SERVER_ERROR,
          message: 'Authentication service error'
        })
      );
    });

    it('should handle API key method errors', async () => {
      const errorApiKey = { 
        ...mockApiKeyDoc, 
        isExpired: jest.fn().mockReturnValue(false),
        checkRateLimit: jest.fn().mockImplementation(() => {
          throw new Error('Rate limit check failed');
        })
      };
      mockFindByKey.mockResolvedValue(errorApiKey);
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.INTERNAL_SERVER_ERROR,
          message: 'Authentication service error'
        })
      );
    });
  });

  describe('Request Context', () => {
    beforeEach(() => {
      req.headers.authorization = 'Bearer dyad_validkey123';
      req.ip = '192.168.1.1';
      req.path = '/v1/chat/completions';
      req.method = 'POST';
      req.headers['user-agent'] = 'TestClient/1.0';
      req.headers['x-request-id'] = 'req-123';
      
      mockFindByKey.mockResolvedValue(mockApiKeyDoc);
      mockApiKeyDoc.isExpired.mockReturnValue(false);
      mockApiKeyDoc.checkRateLimit.mockReturnValue({ allowed: true });
    });

    it('should attach API key to request object', async () => {
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(req.apiKey).toBe(mockApiKeyDoc);
      expect(req.user).toEqual({ id: 'user123' });
    });

    it('should log request context information', async () => {
      const middleware = apiKeyAuth();
      
      await middleware(req, res, next);
      
      expect(logger.info).toHaveBeenCalledWith(
        'API key authenticated successfully',
        expect.objectContaining({
          keyId: 'apikey123',
          keyName: 'Test API Key',
          userId: 'user123',
          permissions: ['chat', 'models'],
          ip: '192.168.1.1',
          userAgent: 'TestClient/1.0',
          path: '/v1/chat/completions',
          method: 'POST',
          requestId: 'req-123'
        })
      );
    });
  });
});