/**
 * Metrics Endpoints Integration Tests
 * Tests for Prometheus metrics endpoints
 */

const request = require('supertest');
const app = require('../../../src/gateway/app');
const monitoringService = require('../../../src/gateway/services/monitoring.service');

describe('Metrics Endpoints', () => {
  beforeEach(() => {
    // Reset metrics before each test
    monitoringService.resetMetrics();
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      // Record some test metrics
      monitoringService.recordHttpRequest('GET', '/test', 200, 1.0, 'test-provider', 'test-model');
      
      const res = await request(app)
        .get('/metrics')
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.text).toContain('# HELP');
      expect(res.text).toContain('# TYPE');
      expect(res.text).toContain('dyad_gateway_http_requests_total');
      expect(res.text).toContain('dyad_gateway_http_request_duration_seconds');
    });

    it('should include recorded metrics in response', async () => {
      // Record specific metrics
      monitoringService.recordHttpRequest('POST', '/v1/chat/completions', 200, 2.5, 'openai', 'gpt-4');
      monitoringService.recordAdapterRequest('http-sdk', 'openai', 'gpt-4', 'success', 2.0);
      
      const res = await request(app)
        .get('/metrics')
        .expect(200);

      expect(res.text).toContain('provider="openai"');
      expect(res.text).toContain('model="gpt-4"');
      expect(res.text).toContain('adapter_type="http-sdk"');
    });
  });

  describe('GET /metrics/json', () => {
    it('should return metrics in JSON format', async () => {
      // Record some test metrics
      monitoringService.recordTokenUsage('openai', 'gpt-4', 100, 50);
      
      const res = await request(app)
        .get('/metrics/json')
        .expect(200);

      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('service', 'dyad-cli-gateway');
      expect(res.body).toHaveProperty('metrics');
      expect(Array.isArray(res.body.metrics)).toBe(true);
      
      // Should contain token metrics
      const tokenMetric = res.body.metrics.find(m => m.name === 'dyad_gateway_tokens_processed_total');
      expect(tokenMetric).toBeDefined();
    });
  });

  describe('POST /metrics/reset', () => {
    it('should reset metrics in non-production environment', async () => {
      // Ensure we're not in production
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      // Record some metrics
      monitoringService.recordHttpRequest('GET', '/test', 200, 1.0);
      
      const res = await request(app)
        .post('/metrics/reset')
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Metrics reset successfully');
      expect(res.body).toHaveProperty('timestamp');

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should reject reset in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .post('/metrics/reset')
        .expect(403);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('message', 'Metrics reset not allowed in production');

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Metrics Collection Integration', () => {
    it('should automatically collect metrics for requests', async () => {
      // Make a request to trigger metrics collection
      await request(app)
        .get('/health')
        .expect(200);

      // Check that metrics were recorded
      const res = await request(app)
        .get('/metrics')
        .expect(200);

      expect(res.text).toContain('dyad_gateway_http_requests_total');
      expect(res.text).toContain('method="GET"');
      expect(res.text).toContain('route="/health"');
    });

    it('should include correlation ID in response headers', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers).toHaveProperty('x-correlation-id');
      expect(res.headers['x-correlation-id']).toMatch(/^corr_[a-f0-9]{16}$/);
    });
  });
});