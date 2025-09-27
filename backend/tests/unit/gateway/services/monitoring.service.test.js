/**
 * Monitoring Service Tests
 * Tests for Prometheus metrics collection
 */

const monitoringService = require('../../../../src/gateway/services/monitoring.service');

describe('MonitoringService', () => {
  beforeEach(() => {
    // Reset metrics before each test
    monitoringService.resetMetrics();
  });

  describe('HTTP Request Metrics', () => {
    it('should record HTTP request metrics', async () => {
      // Record a request
      monitoringService.recordHttpRequest('POST', '/v1/chat/completions', 200, 1.5, 'openai', 'gpt-4');

      // Get metrics
      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('dyad_gateway_http_requests_total');
      expect(metrics).toContain('dyad_gateway_http_request_duration_seconds');
      expect(metrics).toContain('method="POST"');
      expect(metrics).toContain('route="/v1/chat/completions"');
      expect(metrics).toContain('status_code="200"');
      expect(metrics).toContain('provider="openai"');
      expect(metrics).toContain('model="gpt-4"');
    });

    it('should handle multiple requests with different parameters', async () => {
      // Record multiple requests
      monitoringService.recordHttpRequest('POST', '/v1/chat/completions', 200, 1.0, 'openai', 'gpt-4');
      monitoringService.recordHttpRequest('POST', '/v1/chat/completions', 500, 2.0, 'anthropic', 'claude-3');
      monitoringService.recordHttpRequest('GET', '/v1/models', 200, 0.1, 'unknown', 'unknown');

      const metrics = await monitoringService.getMetrics();
      
      // Should contain all different combinations
      expect(metrics).toContain('provider="openai"');
      expect(metrics).toContain('provider="anthropic"');
      expect(metrics).toContain('model="gpt-4"');
      expect(metrics).toContain('model="claude-3"');
      expect(metrics).toContain('status_code="200"');
      expect(metrics).toContain('status_code="500"');
    });
  });

  describe('Adapter Request Metrics', () => {
    it('should record adapter execution metrics', async () => {
      monitoringService.recordAdapterRequest('spawn-cli', 'my-provider', 'my-model', 'success', 2.5);

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('dyad_gateway_adapter_requests_total');
      expect(metrics).toContain('dyad_gateway_adapter_request_duration_seconds');
      expect(metrics).toContain('adapter_type="spawn-cli"');
      expect(metrics).toContain('provider="my-provider"');
      expect(metrics).toContain('model="my-model"');
      expect(metrics).toContain('status="success"');
    });

    it('should record adapter failures', async () => {
      monitoringService.recordAdapterRequest('http-sdk', 'openai', 'gpt-4', 'error', 1.0);

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('adapter_type="http-sdk"');
      expect(metrics).toContain('status="error"');
    });
  });

  describe('Token Usage Metrics', () => {
    it('should record token usage', async () => {
      monitoringService.recordTokenUsage('openai', 'gpt-4', 100, 50);

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('dyad_gateway_tokens_processed_total');
      expect(metrics).toContain('provider="openai"');
      expect(metrics).toContain('model="gpt-4"');
      expect(metrics).toContain('type="prompt"');
      expect(metrics).toContain('type="completion"');
    });

    it('should handle zero token counts', async () => {
      monitoringService.recordTokenUsage('openai', 'gpt-4', 0, 100);

      const metrics = await monitoringService.getMetrics();
      
      // Should only record completion tokens
      expect(metrics).toContain('type="completion"');
      // Prompt tokens should not be recorded when zero
      const promptMatches = metrics.match(/type="prompt"/g);
      expect(promptMatches).toBeNull();
    });
  });

  describe('Circuit Breaker Metrics', () => {
    it('should record circuit breaker state', async () => {
      monitoringService.recordCircuitBreakerState('openai', 'http-sdk', 1); // open

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('dyad_gateway_circuit_breaker_state');
      expect(metrics).toContain('provider="openai"');
      expect(metrics).toContain('adapter_type="http-sdk"');
      expect(metrics).toContain(' 1'); // state value
    });

    it('should record circuit breaker failures', async () => {
      monitoringService.recordCircuitBreakerFailure('openai', 'http-sdk', 'timeout');

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('dyad_gateway_circuit_breaker_failures_total');
      expect(metrics).toContain('failure_type="timeout"');
    });
  });

  describe('Provider Health Metrics', () => {
    it('should record provider health status', async () => {
      monitoringService.recordProviderHealth('openai', 'http-sdk', true, 0.5);

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('dyad_gateway_provider_health_status');
      expect(metrics).toContain('dyad_gateway_provider_health_check_duration_seconds');
      expect(metrics).toContain(' 1'); // healthy status
    });

    it('should record unhealthy provider', async () => {
      monitoringService.recordProviderHealth('failing-provider', 'spawn-cli', false, 2.0);

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('provider="failing-provider"');
      expect(metrics).toContain(' 0'); // unhealthy status
    });
  });

  describe('Streaming Metrics', () => {
    it('should track streaming connections', async () => {
      // Start connection
      monitoringService.recordStreamingConnection('openai', 'gpt-4', 1);
      
      let metrics = await monitoringService.getMetrics();
      expect(metrics).toContain('dyad_gateway_streaming_connections_active');
      expect(metrics).toContain(' 1');

      // End connection
      monitoringService.recordStreamingConnection('openai', 'gpt-4', -1);
      
      metrics = await monitoringService.getMetrics();
      expect(metrics).toContain(' 0');
    });

    it('should record streaming chunks', async () => {
      monitoringService.recordStreamingChunk('openai', 'gpt-4');
      monitoringService.recordStreamingChunk('openai', 'gpt-4');

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('dyad_gateway_streaming_chunks_total');
      expect(metrics).toContain(' 2');
    });
  });

  describe('Error Metrics', () => {
    it('should record errors', async () => {
      monitoringService.recordError('ValidationError', 'invalid_request', 'openai', 'http-sdk');

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('dyad_gateway_errors_total');
      expect(metrics).toContain('error_type="ValidationError"');
      expect(metrics).toContain('error_code="invalid_request"');
    });
  });

  describe('Sandbox Metrics', () => {
    it('should record sandbox executions', async () => {
      monitoringService.recordSandboxExecution('my-cli', 'success', 3.0);

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('dyad_gateway_sandbox_executions_total');
      expect(metrics).toContain('dyad_gateway_sandbox_execution_duration_seconds');
      expect(metrics).toContain('provider="my-cli"');
      expect(metrics).toContain('status="success"');
    });

    it('should record sandbox timeouts', async () => {
      monitoringService.recordSandboxExecution('slow-cli', 'timeout', 60.0);

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('status="timeout"');
    });
  });

  describe('API Key Metrics', () => {
    it('should record API key usage', async () => {
      monitoringService.recordApiKeyRequest('key123', 'success');

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('dyad_gateway_api_key_requests_total');
      expect(metrics).toContain('api_key_id="key123"');
      expect(metrics).toContain('status="success"');
    });
  });

  describe('Rate Limiting Metrics', () => {
    it('should record rate limit hits', async () => {
      monitoringService.recordRateLimitHit('key123', 'requests');

      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toContain('dyad_gateway_rate_limit_hits_total');
      expect(metrics).toContain('limit_type="requests"');
    });
  });

  describe('Metrics Export', () => {
    it('should export metrics in Prometheus format', async () => {
      monitoringService.recordHttpRequest('GET', '/test', 200, 1.0);

      const metrics = await monitoringService.getMetrics();
      
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
    });

    it('should export metrics as JSON', async () => {
      monitoringService.recordHttpRequest('GET', '/test', 200, 1.0);

      const metricsJson = await monitoringService.getMetricsAsJson();
      
      expect(Array.isArray(metricsJson)).toBe(true);
      expect(metricsJson.length).toBeGreaterThan(0);
      
      const httpMetric = metricsJson.find(m => m.name === 'dyad_gateway_http_requests_total');
      expect(httpMetric).toBeDefined();
      expect(httpMetric.values).toBeDefined();
    });
  });

  describe('Metrics Reset', () => {
    it('should reset all metrics', async () => {
      // Record some metrics
      monitoringService.recordHttpRequest('GET', '/test', 200, 1.0);
      monitoringService.recordAdapterRequest('test', 'provider', 'model', 'success', 1.0);

      let metrics = await monitoringService.getMetrics();
      expect(metrics).toContain('dyad_gateway_http_requests_total');

      // Reset metrics
      monitoringService.resetMetrics();

      metrics = await monitoringService.getMetrics();
      // Should still contain metric definitions but with zero values
      expect(metrics).toContain('dyad_gateway_http_requests_total');
    });
  });
});