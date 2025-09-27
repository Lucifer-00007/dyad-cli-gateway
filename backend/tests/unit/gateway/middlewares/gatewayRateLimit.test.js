const httpMocks = require('node-mocks-http');
const { apiKeyRateLimit } = require('../../../../src/gateway/middlewares/gatewayRateLimit');
const logger = require('../../../../src/config/logger');

// Mock dependencies
jest.mock('../../../../src/config/logger');

describe('Gateway Rate Limit Middleware', () => {
  let req, res, next;
  let mockApiKey;

  beforeEach(() => {
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn();

    mockApiKey = {
      id: 'apikey123',
      name: 'Test API Key',
      rateLimits: {
        requestsPerDay: 1000,
        tokensPerDay: 100000
      },
      usageStats: {
        requestsToday: 10,
        tokensToday: 1000
      },
      checkRateLimit: jest.fn()
    };

    // Reset mocks
    jest.clearAllMocks();
    logger.warn = jest.fn();
    logger.error = jest.fn();
  });

  describe('apiKeyRateLimit middleware', () => {
    it('should skip rate limiting for unauthenticated requests', async () => {
      await apiKeyRateLimit(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
      expect(mockApiKey.checkRateLimit).not.toHaveBeenCalled();
    });

    it('should allow requests within rate limits', async () => {
      req.apiKey = mockApiKey;
      mockApiKey.checkRateLimit.mockReturnValue({ allowed: true });
      
      await apiKeyRateLimit(req, res, next);
      
      expect(mockApiKey.checkRateLimit).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
      expect(res.get('X-RateLimit-Limit-Requests')).toBe('1000');
      expect(res.get('X-RateLimit-Remaining-Requests')).toBe('990');
      expect(res.get('X-RateLimit-Limit-Tokens')).toBe('100000');
      expect(res.get('X-RateLimit-Remaining-Tokens')).toBe('99000');
    });

    it('should reject requests exceeding rate limits', async () => {
      req.apiKey = mockApiKey;
      req.ip = '192.168.1.1';
      req.path = '/v1/chat/completions';
      req.method = 'POST';
      
      const resetTime = new Date(Date.now() + 3600000);
      mockApiKey.checkRateLimit.mockReturnValue({
        allowed: false,
        reason: 'Daily request limit exceeded',
        resetTime
      });
      
      await apiKeyRateLimit(req, res, next);
      
      expect(res.statusCode).toBe(429);
      expect(res._getJSONData()).toEqual({
        error: {
          message: 'Daily request limit exceeded',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded'
        }
      });
      
      expect(res.get('X-RateLimit-Reset')).toBe(Math.ceil(resetTime.getTime() / 1000).toString());
      expect(res.get('X-RateLimit-Limit-Requests')).toBe('1000');
      expect(res.get('X-RateLimit-Remaining-Requests')).toBe('990');
      
      expect(logger.warn).toHaveBeenCalledWith(
        'API key rate limit exceeded',
        expect.objectContaining({
          keyId: 'apikey123',
          keyName: 'Test API Key',
          reason: 'Daily request limit exceeded',
          resetTime,
          ip: '192.168.1.1',
          path: '/v1/chat/completions',
          method: 'POST'
        })
      );
      
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle token limit exceeded', async () => {
      req.apiKey = mockApiKey;
      mockApiKey.checkRateLimit.mockReturnValue({
        allowed: false,
        reason: 'Daily token limit exceeded',
        resetTime: new Date(Date.now() + 3600000)
      });
      
      await apiKeyRateLimit(req, res, next);
      
      expect(res.statusCode).toBe(429);
      expect(res._getJSONData().error.message).toBe('Daily token limit exceeded');
    });

    it('should set rate limit headers even when rate limited', async () => {
      req.apiKey = mockApiKey;
      mockApiKey.checkRateLimit.mockReturnValue({
        allowed: false,
        reason: 'Daily request limit exceeded',
        resetTime: new Date(Date.now() + 3600000)
      });
      
      await apiKeyRateLimit(req, res, next);
      
      expect(res.get('X-RateLimit-Limit-Requests')).toBe('1000');
      expect(res.get('X-RateLimit-Remaining-Requests')).toBe('990');
      expect(res.get('X-RateLimit-Limit-Tokens')).toBe('100000');
      expect(res.get('X-RateLimit-Remaining-Tokens')).toBe('99000');
    });

    it('should handle rate limit check errors gracefully', async () => {
      req.apiKey = mockApiKey;
      req.path = '/v1/chat/completions';
      req.method = 'POST';
      
      const error = new Error('Rate limit check failed');
      mockApiKey.checkRateLimit.mockImplementation(() => {
        throw error;
      });
      
      await apiKeyRateLimit(req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith(
        'API key rate limit check error',
        expect.objectContaining({
          error: 'Rate limit check failed',
          keyId: 'apikey123',
          path: '/v1/chat/completions',
          method: 'POST'
        })
      );
      
      // Should continue on error to avoid blocking requests
      expect(next).toHaveBeenCalledWith();
    });

    it('should calculate remaining requests correctly', async () => {
      req.apiKey = mockApiKey;
      mockApiKey.usageStats.requestsToday = 950; // Close to limit
      mockApiKey.checkRateLimit.mockReturnValue({ allowed: true });
      
      await apiKeyRateLimit(req, res, next);
      
      expect(res.get('X-RateLimit-Remaining-Requests')).toBe('50');
    });

    it('should handle zero remaining requests', async () => {
      req.apiKey = mockApiKey;
      mockApiKey.usageStats.requestsToday = 1000; // At limit
      mockApiKey.checkRateLimit.mockReturnValue({ allowed: true });
      
      await apiKeyRateLimit(req, res, next);
      
      expect(res.get('X-RateLimit-Remaining-Requests')).toBe('0');
    });

    it('should handle requests exceeding limit (negative remaining)', async () => {
      req.apiKey = mockApiKey;
      mockApiKey.usageStats.requestsToday = 1100; // Over limit
      mockApiKey.checkRateLimit.mockReturnValue({ allowed: true });
      
      await apiKeyRateLimit(req, res, next);
      
      expect(res.get('X-RateLimit-Remaining-Requests')).toBe('0');
    });

    it('should calculate remaining tokens correctly', async () => {
      req.apiKey = mockApiKey;
      mockApiKey.usageStats.tokensToday = 95000; // Close to limit
      mockApiKey.checkRateLimit.mockReturnValue({ allowed: true });
      
      await apiKeyRateLimit(req, res, next);
      
      expect(res.get('X-RateLimit-Remaining-Tokens')).toBe('5000');
    });

    it('should handle rate limit without reset time', async () => {
      req.apiKey = mockApiKey;
      mockApiKey.checkRateLimit.mockReturnValue({
        allowed: false,
        reason: 'Rate limit exceeded',
        resetTime: null
      });
      
      await apiKeyRateLimit(req, res, next);
      
      expect(res.get('X-RateLimit-Reset')).toBeUndefined();
      expect(res.statusCode).toBe(429);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing API key properties gracefully', async () => {
      req.apiKey = {
        id: 'apikey123',
        checkRateLimit: jest.fn().mockReturnValue({ allowed: true })
      };
      
      await apiKeyRateLimit(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
      // Should not crash even with missing properties
    });

    it('should handle API key without rate limits', async () => {
      req.apiKey = {
        id: 'apikey123',
        rateLimits: {},
        usageStats: {},
        checkRateLimit: jest.fn().mockReturnValue({ allowed: true })
      };
      
      await apiKeyRateLimit(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
    });
  });
});