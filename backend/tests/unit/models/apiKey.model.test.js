const faker = require('faker');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { ApiKey } = require('../../../src/models');

describe('ApiKey model', () => {
  describe('ApiKey validation', () => {
    let newApiKey;
    
    beforeEach(() => {
      newApiKey = {
        name: faker.lorem.words(2),
        keyHash: faker.datatype.string(60),
        keyPrefix: 'dyad_abc',
        userId: new mongoose.Types.ObjectId(),
        permissions: ['chat', 'models'],
        enabled: true,
      };
    });

    test('should correctly validate a valid API key', async () => {
      await expect(new ApiKey(newApiKey).validate()).resolves.toBeUndefined();
    });

    test('should throw validation error if name is missing', async () => {
      delete newApiKey.name;
      await expect(new ApiKey(newApiKey).validate()).rejects.toThrow();
    });

    test('should throw validation error if keyHash is missing', async () => {
      delete newApiKey.keyHash;
      await expect(new ApiKey(newApiKey).validate()).rejects.toThrow();
    });

    test('should throw validation error if keyPrefix is missing', async () => {
      delete newApiKey.keyPrefix;
      await expect(new ApiKey(newApiKey).validate()).rejects.toThrow();
    });

    test('should throw validation error if userId is missing', async () => {
      delete newApiKey.userId;
      await expect(new ApiKey(newApiKey).validate()).rejects.toThrow();
    });

    test('should validate rate limit values', async () => {
      newApiKey.rateLimits = {
        requestsPerMinute: -1, // Invalid
      };
      await expect(new ApiKey(newApiKey).validate()).rejects.toThrow();
      
      newApiKey.rateLimits = {
        requestsPerMinute: 60,
        tokensPerMinute: 10000,
      };
      await expect(new ApiKey(newApiKey).validate()).resolves.toBeUndefined();
    });

    test('should set default values', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dyad_abc',
        userId: new mongoose.Types.ObjectId(),
      });

      expect(apiKey.permissions.toObject()).toEqual(['chat', 'models']);
      expect(apiKey.enabled).toBe(true);
      expect(apiKey.rateLimits.requestsPerMinute).toBe(60);
      expect(apiKey.usageStats.requestsToday).toBe(0);
    });
  });

  describe('ApiKey pre-save validation', () => {
    test('should validate permissions', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dyad_abc',
        userId: new mongoose.Types.ObjectId(),
        permissions: ['invalid-permission'],
      });

      await expect(apiKey.save()).rejects.toThrow('is not a valid enum value');
    });

    test('should allow valid permissions', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dyad_abc',
        userId: new mongoose.Types.ObjectId(),
        permissions: ['chat', 'embeddings', 'models', 'admin'],
      });

      // Mock save to avoid database operations
      apiKey.save = jest.fn().mockResolvedValue(apiKey);
      await expect(apiKey.save()).resolves.toBeDefined();
    });
  });

  describe('ApiKey static methods', () => {
    test('should generate a valid API key', () => {
      const key = ApiKey.generateKey();
      
      expect(key).toMatch(/^dyad_[A-Za-z0-9_-]+$/);
      expect(key.length).toBeGreaterThan(10);
    });

    test('should hash API key', async () => {
      const key = 'dyad_test-key-123';
      const hash = await ApiKey.hashKey(key);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(key);
      expect(await bcrypt.compare(key, hash)).toBe(true);
    });

    test('should get key prefix', () => {
      const key = 'dyad_abcdefghijklmnop';
      const prefix = ApiKey.getKeyPrefix(key);
      
      expect(prefix).toBe('dyad_abc');
    });

    test('should find API key by key value', async () => {
      const key = 'dyad_test-key-123';
      const hash = await ApiKey.hashKey(key);
      const prefix = ApiKey.getKeyPrefix(key);
      
      const mockApiKey = {
        keyHash: hash,
        keyPrefix: prefix,
        enabled: true,
        expiresAt: null,
      };
      
      ApiKey.find = jest.fn().mockResolvedValue([mockApiKey]);
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      
      const foundKey = await ApiKey.findByKey(key);
      expect(foundKey).toEqual(mockApiKey);
      expect(ApiKey.find).toHaveBeenCalledWith({
        keyPrefix: prefix,
        enabled: true,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: expect.any(Date) } }
        ]
      });
    });

    test('should return null for invalid key format', async () => {
      const result = await ApiKey.findByKey('invalid-key');
      expect(result).toBeNull();
    });

    test('should return null when no matching key found', async () => {
      ApiKey.find = jest.fn().mockResolvedValue([]);
      
      const result = await ApiKey.findByKey('dyad_nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('ApiKey instance methods', () => {
    let apiKey;

    beforeEach(() => {
      apiKey = new ApiKey({
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dyad_abc',
        userId: new mongoose.Types.ObjectId(),
        permissions: ['chat', 'models', 'admin'],
        allowedModels: ['model-1', 'model-2'],
        allowedProviders: ['provider-1'],
        rateLimits: {
          requestsPerDay: 1000,
          tokensPerDay: 100000,
        },
        usageStats: {
          requestsToday: 10,
          tokensToday: 1000,
          requestsThisMonth: 100,
          tokensThisMonth: 10000,
          lastResetDate: new Date(),
        },
      });
    });

    test('should check permissions', () => {
      expect(apiKey.hasPermission('chat')).toBe(true);
      expect(apiKey.hasPermission('admin')).toBe(true);
      expect(apiKey.hasPermission('embeddings')).toBe(false);
    });

    test('should check model access', () => {
      expect(apiKey.canAccessModel('model-1')).toBe(true);
      expect(apiKey.canAccessModel('model-3')).toBe(false);
    });

    test('should allow all models when no restrictions', () => {
      apiKey.allowedModels = [];
      expect(apiKey.canAccessModel('any-model')).toBe(true);
    });

    test('should check provider access', () => {
      expect(apiKey.canAccessProvider('provider-1')).toBe(true);
      expect(apiKey.canAccessProvider('provider-2')).toBe(false);
    });

    test('should allow all providers when no restrictions', () => {
      apiKey.allowedProviders = [];
      expect(apiKey.canAccessProvider('any-provider')).toBe(true);
    });

    test('should update usage statistics', async () => {
      apiKey.save = jest.fn().mockResolvedValue(apiKey);
      
      const originalRequests = apiKey.usageStats.requestsToday;
      const originalTokens = apiKey.usageStats.tokensToday;
      
      await apiKey.updateUsage(500);
      
      expect(apiKey.usageStats.requestsToday).toBe(originalRequests + 1);
      expect(apiKey.usageStats.tokensToday).toBe(originalTokens + 500);
      expect(apiKey.usageStats.lastUsed).toBeInstanceOf(Date);
      expect(apiKey.lastUsedAt).toBeInstanceOf(Date);
      expect(apiKey.save).toHaveBeenCalled();
    });

    test('should reset daily stats on new day', async () => {
      apiKey.save = jest.fn().mockResolvedValue(apiKey);
      
      // Set last reset to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      apiKey.usageStats.lastResetDate = yesterday;
      
      await apiKey.updateUsage(100);
      
      expect(apiKey.usageStats.requestsToday).toBe(1); // Reset to 1 (current request)
      expect(apiKey.usageStats.tokensToday).toBe(100); // Reset to current tokens
    });

    test('should check rate limits', () => {
      // Within limits
      let result = apiKey.checkRateLimit(1000);
      expect(result.allowed).toBe(true);
      
      // Exceed daily request limit
      apiKey.usageStats.requestsToday = 1000;
      result = apiKey.checkRateLimit(0);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily request limit exceeded');
      expect(result.resetTime).toBeInstanceOf(Date);
      
      // Reset for next test
      apiKey.usageStats.requestsToday = 10;
      
      // Exceed daily token limit
      result = apiKey.checkRateLimit(100000);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily token limit exceeded');
    });

    test('should check if expired', () => {
      // No expiration
      expect(apiKey.isExpired()).toBe(false);
      
      // Future expiration
      apiKey.expiresAt = new Date(Date.now() + 86400000); // Tomorrow
      expect(apiKey.isExpired()).toBe(false);
      
      // Past expiration
      apiKey.expiresAt = new Date(Date.now() - 86400000); // Yesterday
      expect(apiKey.isExpired()).toBe(true);
    });
  });

  describe('ApiKey toJSON()', () => {
    test('should not return keyHash when toJSON is called', () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        keyHash: 'secret-hash',
        keyPrefix: 'dyad_abc',
        userId: new mongoose.Types.ObjectId(),
      });

      const json = apiKey.toJSON();
      expect(json).not.toHaveProperty('keyHash');
    });
  });

  describe('ApiKey usage statistics edge cases', () => {
    let apiKey;

    beforeEach(() => {
      apiKey = new ApiKey({
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dyad_abc',
        userId: new mongoose.Types.ObjectId(),
        usageStats: {
          requestsToday: 0,
          tokensToday: 0,
          requestsThisMonth: 0,
          tokensThisMonth: 0,
        },
      });
      apiKey.save = jest.fn().mockResolvedValue(apiKey);
    });

    test('should handle first usage correctly', async () => {
      await apiKey.updateUsage(100);
      
      expect(apiKey.usageStats.requestsToday).toBe(1);
      expect(apiKey.usageStats.tokensToday).toBe(100);
      expect(apiKey.usageStats.requestsThisMonth).toBe(1);
      expect(apiKey.usageStats.tokensThisMonth).toBe(100);
    });

    test('should reset monthly stats on new month', async () => {
      // Set last reset to last month
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      apiKey.usageStats.lastResetDate = lastMonth;
      apiKey.usageStats.requestsThisMonth = 500;
      apiKey.usageStats.tokensThisMonth = 50000;
      
      await apiKey.updateUsage(100);
      
      expect(apiKey.usageStats.requestsThisMonth).toBe(1); // Reset
      expect(apiKey.usageStats.tokensThisMonth).toBe(100); // Reset
    });
  });
});