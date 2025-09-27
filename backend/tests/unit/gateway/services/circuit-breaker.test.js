/**
 * Circuit Breaker Service Unit Tests
 */

const { CircuitBreakerService, ProviderCircuitBreaker, CIRCUIT_STATES } = require('../../../../src/gateway/services/circuit-breaker.service');

describe('ProviderCircuitBreaker', () => {
  let circuitBreaker;
  const providerId = 'test-provider-123';

  beforeEach(() => {
    circuitBreaker = new ProviderCircuitBreaker(providerId, {
      failureThreshold: 3,
      timeout: 1000,
      resetTimeout: 5000
    });
  });

  describe('constructor', () => {
    test('should initialize with correct default values', () => {
      const cb = new ProviderCircuitBreaker('test-id');
      expect(cb.providerId).toBe('test-id');
      expect(cb.state).toBe(CIRCUIT_STATES.CLOSED);
      expect(cb.failureCount).toBe(0);
      expect(cb.stats.totalRequests).toBe(0);
    });

    test('should initialize with custom options', () => {
      const options = {
        failureThreshold: 5,
        timeout: 2000,
        resetTimeout: 10000
      };
      const cb = new ProviderCircuitBreaker('test-id', options);
      expect(cb.failureThreshold).toBe(5);
      expect(cb.timeout).toBe(2000);
      expect(cb.resetTimeout).toBe(10000);
    });
  });

  describe('execute', () => {
    test('should execute successful request in CLOSED state', async () => {
      const mockRequest = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockRequest);
      
      expect(result).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.state).toBe(CIRCUIT_STATES.CLOSED);
      expect(circuitBreaker.stats.totalRequests).toBe(1);
      expect(circuitBreaker.stats.successfulRequests).toBe(1);
    });

    test('should handle failed request in CLOSED state', async () => {
      const error = new Error('Request failed');
      const mockRequest = jest.fn().mockRejectedValue(error);
      
      await expect(circuitBreaker.execute(mockRequest)).rejects.toThrow('Request failed');
      
      expect(circuitBreaker.failureCount).toBe(1);
      expect(circuitBreaker.state).toBe(CIRCUIT_STATES.CLOSED);
      expect(circuitBreaker.stats.totalRequests).toBe(1);
      expect(circuitBreaker.stats.failedRequests).toBe(1);
    });

    test('should open circuit after reaching failure threshold', async () => {
      const error = new Error('Request failed');
      const mockRequest = jest.fn().mockRejectedValue(error);
      
      // Fail 3 times to reach threshold
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockRequest)).rejects.toThrow('Request failed');
      }
      
      expect(circuitBreaker.state).toBe(CIRCUIT_STATES.OPEN);
      expect(circuitBreaker.failureCount).toBe(3);
      expect(circuitBreaker.stats.circuitOpenCount).toBe(1);
    });

    test('should fail fast when circuit is OPEN', async () => {
      // Force circuit to open
      circuitBreaker.open();
      
      const mockRequest = jest.fn();
      
      await expect(circuitBreaker.execute(mockRequest)).rejects.toThrow('Circuit breaker is OPEN');
      
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should transition to HALF_OPEN after reset timeout', async () => {
      // Force circuit to open
      circuitBreaker.open();
      
      // Mock time to simulate reset timeout passing
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 6000); // 6 seconds later
      
      const mockRequest = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockRequest);
      
      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe(CIRCUIT_STATES.CLOSED);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      
      // Restore original Date.now
      Date.now = originalNow;
    });

    test('should handle timeout', async () => {
      const mockRequest = jest.fn(() => new Promise(resolve => setTimeout(resolve, 2000)));
      
      await expect(circuitBreaker.execute(mockRequest)).rejects.toThrow('Request timeout');
      
      expect(circuitBreaker.failureCount).toBe(1);
    });
  });

  describe('onSuccess', () => {
    test('should reset failure count on success', () => {
      circuitBreaker.failureCount = 2;
      circuitBreaker.onSuccess();
      
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.stats.successfulRequests).toBe(1);
    });

    test('should reset circuit from HALF_OPEN to CLOSED on success', () => {
      circuitBreaker.state = CIRCUIT_STATES.HALF_OPEN;
      circuitBreaker.failureCount = 2;
      
      circuitBreaker.onSuccess();
      
      expect(circuitBreaker.state).toBe(CIRCUIT_STATES.CLOSED);
      expect(circuitBreaker.failureCount).toBe(0);
    });
  });

  describe('onFailure', () => {
    test('should increment failure count', () => {
      const error = new Error('Test error');
      
      circuitBreaker.onFailure(error);
      
      expect(circuitBreaker.failureCount).toBe(1);
      expect(circuitBreaker.stats.failedRequests).toBe(1);
      expect(circuitBreaker.lastFailureTime).toBeInstanceOf(Date);
    });

    test('should open circuit when threshold is reached', () => {
      const error = new Error('Test error');
      
      // Fail 3 times to reach threshold
      for (let i = 0; i < 3; i++) {
        circuitBreaker.onFailure(error);
      }
      
      expect(circuitBreaker.state).toBe(CIRCUIT_STATES.OPEN);
      expect(circuitBreaker.nextAttemptTime).toBeInstanceOf(Date);
    });
  });

  describe('getStatus', () => {
    test('should return complete status information', () => {
      circuitBreaker.failureCount = 2;
      
      const status = circuitBreaker.getStatus();
      
      expect(status).toMatchObject({
        providerId,
        state: CIRCUIT_STATES.CLOSED,
        failureCount: 2,
        failureThreshold: 3,
        stats: expect.objectContaining({
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0
        })
      });
    });
  });

  describe('isHealthy', () => {
    test('should return true when circuit is CLOSED', () => {
      expect(circuitBreaker.isHealthy()).toBe(true);
    });

    test('should return false when circuit is OPEN', () => {
      circuitBreaker.open();
      expect(circuitBreaker.isHealthy()).toBe(false);
    });

    test('should return false when circuit is HALF_OPEN', () => {
      circuitBreaker.state = CIRCUIT_STATES.HALF_OPEN;
      expect(circuitBreaker.isHealthy()).toBe(false);
    });
  });

  describe('forceOpen and forceReset', () => {
    test('should force open circuit', () => {
      circuitBreaker.forceOpen();
      expect(circuitBreaker.state).toBe(CIRCUIT_STATES.OPEN);
    });

    test('should force reset circuit', () => {
      circuitBreaker.open();
      circuitBreaker.forceReset();
      
      expect(circuitBreaker.state).toBe(CIRCUIT_STATES.CLOSED);
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.nextAttemptTime).toBeNull();
    });
  });
});

describe('CircuitBreakerService', () => {
  let service;

  beforeEach(() => {
    service = new CircuitBreakerService();
  });

  describe('getCircuitBreaker', () => {
    test('should create new circuit breaker for provider', () => {
      const providerId = 'test-provider';
      
      const cb = service.getCircuitBreaker(providerId);
      
      expect(cb).toBeInstanceOf(ProviderCircuitBreaker);
      expect(cb.providerId).toBe(providerId);
    });

    test('should return existing circuit breaker for provider', () => {
      const providerId = 'test-provider';
      
      const cb1 = service.getCircuitBreaker(providerId);
      const cb2 = service.getCircuitBreaker(providerId);
      
      expect(cb1).toBe(cb2);
    });

    test('should create circuit breaker with custom options', () => {
      const providerId = 'test-provider';
      const options = { failureThreshold: 5 };
      
      const cb = service.getCircuitBreaker(providerId, options);
      
      expect(cb.failureThreshold).toBe(5);
    });
  });

  describe('execute', () => {
    test('should execute request through circuit breaker', async () => {
      const providerId = 'test-provider';
      const mockRequest = jest.fn().mockResolvedValue('success');
      
      const result = await service.execute(providerId, mockRequest);
      
      expect(result).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    test('should handle request failure', async () => {
      const providerId = 'test-provider';
      const error = new Error('Request failed');
      const mockRequest = jest.fn().mockRejectedValue(error);
      
      await expect(service.execute(providerId, mockRequest)).rejects.toThrow('Request failed');
    });
  });

  describe('getAllStatus', () => {
    test('should return status of all circuit breakers', () => {
      const provider1 = 'provider-1';
      const provider2 = 'provider-2';
      
      service.getCircuitBreaker(provider1);
      service.getCircuitBreaker(provider2);
      
      const status = service.getAllStatus();
      
      expect(Object.keys(status)).toHaveLength(2);
      expect(status[provider1]).toBeDefined();
      expect(status[provider2]).toBeDefined();
    });

    test('should return empty object when no circuit breakers exist', () => {
      const status = service.getAllStatus();
      expect(status).toEqual({});
    });
  });

  describe('isProviderHealthy', () => {
    test('should return true for healthy provider', () => {
      const providerId = 'test-provider';
      service.getCircuitBreaker(providerId);
      
      expect(service.isProviderHealthy(providerId)).toBe(true);
    });

    test('should return false for unhealthy provider', () => {
      const providerId = 'test-provider';
      const cb = service.getCircuitBreaker(providerId);
      cb.open();
      
      expect(service.isProviderHealthy(providerId)).toBe(false);
    });

    test('should return true for non-existent provider', () => {
      expect(service.isProviderHealthy('non-existent')).toBe(true);
    });
  });

  describe('getHealthyProviders', () => {
    test('should filter healthy providers', () => {
      const provider1 = 'provider-1';
      const provider2 = 'provider-2';
      const provider3 = 'provider-3';
      
      service.getCircuitBreaker(provider1); // healthy
      const cb2 = service.getCircuitBreaker(provider2);
      cb2.open(); // unhealthy
      service.getCircuitBreaker(provider3); // healthy
      
      const healthyProviders = service.getHealthyProviders([provider1, provider2, provider3]);
      
      expect(healthyProviders).toEqual([provider1, provider3]);
    });
  });

  describe('resetCircuitBreaker', () => {
    test('should reset existing circuit breaker', () => {
      const providerId = 'test-provider';
      const cb = service.getCircuitBreaker(providerId);
      cb.open();
      
      service.resetCircuitBreaker(providerId);
      
      expect(cb.state).toBe(CIRCUIT_STATES.CLOSED);
    });

    test('should handle non-existent circuit breaker', () => {
      expect(() => service.resetCircuitBreaker('non-existent')).not.toThrow();
    });
  });

  describe('openCircuitBreaker', () => {
    test('should open circuit breaker for provider', () => {
      const providerId = 'test-provider';
      
      service.openCircuitBreaker(providerId);
      
      const cb = service.getCircuitBreaker(providerId);
      expect(cb.state).toBe(CIRCUIT_STATES.OPEN);
    });
  });

  describe('getStatistics', () => {
    test('should return comprehensive statistics', () => {
      const provider1 = 'provider-1';
      const provider2 = 'provider-2';
      
      service.getCircuitBreaker(provider1);
      const cb2 = service.getCircuitBreaker(provider2);
      cb2.open();
      
      const stats = service.getStatistics();
      
      expect(stats).toMatchObject({
        totalCircuitBreakers: 2,
        healthyProviders: 1,
        openCircuits: 1,
        halfOpenCircuits: 0,
        totalRequests: 0,
        totalSuccesses: 0,
        totalFailures: 0
      });
    });
  });

  describe('clearAll', () => {
    test('should clear all circuit breakers', () => {
      service.getCircuitBreaker('provider-1');
      service.getCircuitBreaker('provider-2');
      
      service.clearAll();
      
      const status = service.getAllStatus();
      expect(Object.keys(status)).toHaveLength(0);
    });
  });
});