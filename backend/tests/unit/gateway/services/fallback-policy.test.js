/**
 * Fallback Policy Service Unit Tests
 */

const { FallbackPolicyService, FALLBACK_STRATEGIES } = require('../../../../src/gateway/services/fallback-policy.service');
const { CircuitBreakerService } = require('../../../../src/gateway/services/circuit-breaker.service');
const Provider = require('../../../../src/models/provider.model');

// Mock Provider model
jest.mock('../../../../src/models/provider.model');

describe('FallbackPolicyService', () => {
  let fallbackService;
  let circuitBreakerService;
  let mockProviders;

  beforeEach(() => {
    circuitBreakerService = new CircuitBreakerService();
    fallbackService = new FallbackPolicyService(circuitBreakerService);
    
    // Mock providers
    mockProviders = [
      {
        _id: { toString: () => 'provider-1' },
        name: 'Provider 1',
        healthStatus: { status: 'healthy' }
      },
      {
        _id: { toString: () => 'provider-2' },
        name: 'Provider 2',
        healthStatus: { status: 'healthy' }
      },
      {
        _id: { toString: () => 'provider-3' },
        name: 'Provider 3',
        healthStatus: { status: 'unhealthy' }
      }
    ];

    Provider.getProvidersByModel.mockResolvedValue(mockProviders);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('configureFallback', () => {
    test('should configure fallback policy with default values', () => {
      const modelId = 'test-model';
      const config = {
        strategy: FALLBACK_STRATEGIES.ROUND_ROBIN
      };

      fallbackService.configureFallback(modelId, config);

      const storedConfig = fallbackService.getFallbackConfig(modelId);
      expect(storedConfig).toMatchObject({
        strategy: FALLBACK_STRATEGIES.ROUND_ROBIN,
        providers: [],
        maxAttempts: 3,
        enabled: true
      });
    });

    test('should configure fallback policy with custom values', () => {
      const modelId = 'test-model';
      const config = {
        strategy: FALLBACK_STRATEGIES.PRIORITY,
        providers: ['provider-1', 'provider-2'],
        maxAttempts: 5,
        enabled: false,
        retryDelay: 1000
      };

      fallbackService.configureFallback(modelId, config);

      const storedConfig = fallbackService.getFallbackConfig(modelId);
      expect(storedConfig).toMatchObject(config);
    });
  });

  describe('setProviderPriorities', () => {
    test('should set provider priorities', () => {
      const priorities = {
        'provider-1': 1,
        'provider-2': 2,
        'provider-3': 3
      };

      fallbackService.setProviderPriorities(priorities);

      const stats = fallbackService.getStatistics();
      expect(stats.providerPriorities).toEqual(priorities);
    });
  });

  describe('executeWithFallback', () => {
    test('should execute with primary provider when no fallback configured', async () => {
      const modelId = 'test-model';
      const mockRequestFn = jest.fn().mockResolvedValue('success');

      const result = await fallbackService.executeWithFallback(modelId, mockRequestFn);

      expect(result).toBe('success');
      expect(mockRequestFn).toHaveBeenCalledWith('provider-1');
      expect(Provider.getProvidersByModel).toHaveBeenCalledWith(modelId);
    });

    test('should throw error when no providers available', async () => {
      const modelId = 'test-model';
      const mockRequestFn = jest.fn();
      Provider.getProvidersByModel.mockResolvedValue([]);

      await expect(fallbackService.executeWithFallback(modelId, mockRequestFn))
        .rejects.toThrow('No providers available for model: test-model');
    });

    test('should execute with fallback when enabled', async () => {
      const modelId = 'test-model';
      fallbackService.configureFallback(modelId, {
        strategy: FALLBACK_STRATEGIES.ROUND_ROBIN,
        maxAttempts: 2,
        enabled: true
      });

      const mockRequestFn = jest.fn()
        .mockRejectedValueOnce(new Error('First provider failed'))
        .mockResolvedValueOnce('success from second provider');

      const result = await fallbackService.executeWithFallback(modelId, mockRequestFn);

      expect(result).toBe('success from second provider');
      expect(mockRequestFn).toHaveBeenCalledTimes(2);
      expect(mockRequestFn).toHaveBeenNthCalledWith(1, 'provider-1');
      expect(mockRequestFn).toHaveBeenNthCalledWith(2, 'provider-2');
    });

    test('should throw fallback exhausted error when all attempts fail', async () => {
      const modelId = 'test-model';
      fallbackService.configureFallback(modelId, {
        strategy: FALLBACK_STRATEGIES.ROUND_ROBIN,
        maxAttempts: 2,
        enabled: true
      });

      const mockRequestFn = jest.fn()
        .mockRejectedValue(new Error('Provider failed'));

      await expect(fallbackService.executeWithFallback(modelId, mockRequestFn))
        .rejects.toThrow('All fallback attempts failed for model test-model');

      expect(mockRequestFn).toHaveBeenCalledTimes(2);
    });

    test('should respect maxAttempts limit', async () => {
      const modelId = 'test-model';
      fallbackService.configureFallback(modelId, {
        strategy: FALLBACK_STRATEGIES.ROUND_ROBIN,
        maxAttempts: 1,
        enabled: true
      });

      const mockRequestFn = jest.fn().mockRejectedValue(new Error('Provider failed'));

      await expect(fallbackService.executeWithFallback(modelId, mockRequestFn))
        .rejects.toThrow('All fallback attempts failed');

      expect(mockRequestFn).toHaveBeenCalledTimes(1);
    });

    test('should filter out unhealthy providers from circuit breaker', async () => {
      const modelId = 'test-model';
      fallbackService.configureFallback(modelId, {
        strategy: FALLBACK_STRATEGIES.ROUND_ROBIN,
        enabled: true
      });

      // Make provider-1 unhealthy via circuit breaker
      circuitBreakerService.openCircuitBreaker('provider-1');

      const mockRequestFn = jest.fn().mockResolvedValue('success');

      const result = await fallbackService.executeWithFallback(modelId, mockRequestFn);

      expect(result).toBe('success');
      expect(mockRequestFn).toHaveBeenCalledWith('provider-2'); // Should skip provider-1
    });

    test('should throw error when no healthy providers available', async () => {
      const modelId = 'test-model';
      fallbackService.configureFallback(modelId, {
        strategy: FALLBACK_STRATEGIES.ROUND_ROBIN,
        enabled: true
      });

      // Make all providers unhealthy
      circuitBreakerService.openCircuitBreaker('provider-1');
      circuitBreakerService.openCircuitBreaker('provider-2');
      circuitBreakerService.openCircuitBreaker('provider-3');

      const mockRequestFn = jest.fn();

      await expect(fallbackService.executeWithFallback(modelId, mockRequestFn))
        .rejects.toThrow('No healthy providers available for model: test-model');
    });
  });

  describe('getOrderedProviders', () => {
    test('should filter and order providers by configured list', async () => {
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: FALLBACK_STRATEGIES.PRIORITY,
        providers: ['provider-2', 'provider-1'],
        enabled: true
      };

      const orderedProviders = await fallbackService.getOrderedProviders(modelId, fallbackConfig);

      expect(orderedProviders).toHaveLength(2);
      expect(orderedProviders[0]._id.toString()).toBe('provider-2');
      expect(orderedProviders[1]._id.toString()).toBe('provider-1');
    });

    test('should return empty array when no healthy providers', async () => {
      const modelId = 'test-model';
      const fallbackConfig = {
        strategy: FALLBACK_STRATEGIES.PRIORITY,
        enabled: true
      };

      // Make all providers unhealthy
      circuitBreakerService.openCircuitBreaker('provider-1');
      circuitBreakerService.openCircuitBreaker('provider-2');
      circuitBreakerService.openCircuitBreaker('provider-3');

      const orderedProviders = await fallbackService.getOrderedProviders(modelId, fallbackConfig);

      expect(orderedProviders).toHaveLength(0);
    });
  });

  describe('orderProvidersByStrategy', () => {
    test('should order providers by priority strategy', () => {
      fallbackService.setProviderPriorities({
        'provider-1': 3,
        'provider-2': 1,
        'provider-3': 2
      });

      const ordered = fallbackService.orderProvidersByStrategy(
        mockProviders,
        FALLBACK_STRATEGIES.PRIORITY,
        'test-model'
      );

      expect(ordered[0]._id.toString()).toBe('provider-2'); // priority 1
      expect(ordered[1]._id.toString()).toBe('provider-3'); // priority 2
      expect(ordered[2]._id.toString()).toBe('provider-1'); // priority 3
    });

    test('should order providers by round robin strategy', () => {
      const modelId = 'test-model';

      // First call
      const ordered1 = fallbackService.orderProvidersByStrategy(
        mockProviders,
        FALLBACK_STRATEGIES.ROUND_ROBIN,
        modelId
      );

      // Second call should start from next provider
      const ordered2 = fallbackService.orderProvidersByStrategy(
        mockProviders,
        FALLBACK_STRATEGIES.ROUND_ROBIN,
        modelId
      );

      expect(ordered1[0]._id.toString()).toBe('provider-1');
      expect(ordered2[0]._id.toString()).toBe('provider-2');
    });

    test('should order providers by health strategy', () => {
      const providersWithHealth = [
        {
          _id: { toString: () => 'provider-1' },
          healthStatus: { status: 'unhealthy', lastChecked: new Date('2023-01-01') }
        },
        {
          _id: { toString: () => 'provider-2' },
          healthStatus: { status: 'healthy', lastChecked: new Date('2023-01-02') }
        },
        {
          _id: { toString: () => 'provider-3' },
          healthStatus: { status: 'healthy', lastChecked: new Date('2023-01-03') }
        }
      ];

      const ordered = fallbackService.orderProvidersByStrategy(
        providersWithHealth,
        FALLBACK_STRATEGIES.HEALTH_BASED,
        'test-model'
      );

      // Healthy providers should come first, ordered by most recent check
      expect(ordered[0]._id.toString()).toBe('provider-3');
      expect(ordered[1]._id.toString()).toBe('provider-2');
      expect(ordered[2]._id.toString()).toBe('provider-1');
    });

    test('should randomize providers with random strategy', () => {
      // Mock Math.random to control randomization
      const originalRandom = Math.random;
      Math.random = jest.fn()
        .mockReturnValueOnce(0.8) // Will swap last two elements
        .mockReturnValueOnce(0.2); // Will not swap first two elements

      const ordered = fallbackService.orderProvidersByStrategy(
        mockProviders,
        FALLBACK_STRATEGIES.RANDOM,
        'test-model'
      );

      expect(ordered).toHaveLength(3);
      // Order should be different from original due to mocked randomization

      // Restore Math.random
      Math.random = originalRandom;
    });
  });

  describe('getFallbackConfig', () => {
    test('should return fallback configuration for model', () => {
      const modelId = 'test-model';
      const config = {
        strategy: FALLBACK_STRATEGIES.PRIORITY,
        maxAttempts: 5
      };

      fallbackService.configureFallback(modelId, config);

      const retrieved = fallbackService.getFallbackConfig(modelId);
      expect(retrieved.strategy).toBe(FALLBACK_STRATEGIES.PRIORITY);
      expect(retrieved.maxAttempts).toBe(5);
    });

    test('should return null for non-existent model', () => {
      const config = fallbackService.getFallbackConfig('non-existent');
      expect(config).toBeNull();
    });
  });

  describe('getAllFallbackConfigs', () => {
    test('should return all fallback configurations', () => {
      fallbackService.configureFallback('model-1', { strategy: FALLBACK_STRATEGIES.PRIORITY });
      fallbackService.configureFallback('model-2', { strategy: FALLBACK_STRATEGIES.ROUND_ROBIN });

      const allConfigs = fallbackService.getAllFallbackConfigs();

      expect(Object.keys(allConfigs)).toHaveLength(2);
      expect(allConfigs['model-1'].strategy).toBe(FALLBACK_STRATEGIES.PRIORITY);
      expect(allConfigs['model-2'].strategy).toBe(FALLBACK_STRATEGIES.ROUND_ROBIN);
    });
  });

  describe('removeFallbackConfig', () => {
    test('should remove fallback configuration for model', () => {
      const modelId = 'test-model';
      fallbackService.configureFallback(modelId, { strategy: FALLBACK_STRATEGIES.PRIORITY });

      fallbackService.removeFallbackConfig(modelId);

      const config = fallbackService.getFallbackConfig(modelId);
      expect(config).toBeNull();
    });
  });

  describe('getStatistics', () => {
    test('should return comprehensive statistics', () => {
      fallbackService.configureFallback('model-1', { strategy: FALLBACK_STRATEGIES.PRIORITY });
      fallbackService.configureFallback('model-2', { strategy: FALLBACK_STRATEGIES.ROUND_ROBIN });
      fallbackService.setProviderPriorities({ 'provider-1': 1 });

      const stats = fallbackService.getStatistics();

      expect(stats).toMatchObject({
        totalFallbackConfigs: 2,
        configuredModels: ['model-1', 'model-2'],
        providerPriorities: { 'provider-1': 1 },
        roundRobinCounters: expect.any(Object)
      });
    });
  });

  describe('clearAll', () => {
    test('should clear all configurations', () => {
      fallbackService.configureFallback('model-1', { strategy: FALLBACK_STRATEGIES.PRIORITY });
      fallbackService.setProviderPriorities({ 'provider-1': 1 });

      fallbackService.clearAll();

      const stats = fallbackService.getStatistics();
      expect(stats.totalFallbackConfigs).toBe(0);
      expect(Object.keys(stats.providerPriorities)).toHaveLength(0);
    });
  });

  describe('delay', () => {
    test('should delay for specified milliseconds', async () => {
      const startTime = Date.now();
      await fallbackService.delay(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });
});