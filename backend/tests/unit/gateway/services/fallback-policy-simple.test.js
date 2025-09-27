/**
 * Simple Fallback Policy Service Unit Tests (without gateway config)
 */

// Mock the gateway config to avoid Joi issues
jest.mock('../../../../src/gateway/config', () => ({
  gatewayConfig: {
    circuitBreaker: {
      failureThreshold: 5,
      timeout: 60000,
      resetTimeout: 300000
    }
  }
}));

const { FallbackPolicyService, FALLBACK_STRATEGIES } = require('../../../../src/gateway/services/fallback-policy.service');
const { CircuitBreakerService } = require('../../../../src/gateway/services/circuit-breaker.service');

describe('FallbackPolicyService (Simple)', () => {
  let fallbackService;
  let circuitBreakerService;

  beforeEach(() => {
    circuitBreakerService = new CircuitBreakerService();
    fallbackService = new FallbackPolicyService(circuitBreakerService);
  });

  test('should configure fallback policy', () => {
    const modelId = 'test-model';
    const config = {
      strategy: FALLBACK_STRATEGIES.ROUND_ROBIN,
      maxAttempts: 3,
      enabled: true
    };

    fallbackService.configureFallback(modelId, config);

    const storedConfig = fallbackService.getFallbackConfig(modelId);
    expect(storedConfig).toMatchObject(config);
  });

  test('should set provider priorities', () => {
    const priorities = {
      'provider-1': 1,
      'provider-2': 2
    };

    fallbackService.setProviderPriorities(priorities);

    const stats = fallbackService.getStatistics();
    expect(stats.providerPriorities).toEqual(priorities);
  });

  test('should get all fallback strategies', () => {
    expect(FALLBACK_STRATEGIES.ROUND_ROBIN).toBe('round_robin');
    expect(FALLBACK_STRATEGIES.PRIORITY).toBe('priority');
    expect(FALLBACK_STRATEGIES.RANDOM).toBe('random');
    expect(FALLBACK_STRATEGIES.HEALTH_BASED).toBe('health_based');
    expect(FALLBACK_STRATEGIES.NONE).toBe('none');
  });
});