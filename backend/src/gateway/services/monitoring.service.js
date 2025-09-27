/**
 * Monitoring Service - Prometheus Metrics Collection
 * Provides comprehensive metrics for the Dyad CLI Gateway
 */

const promClient = require('prom-client');
const logger = require('../../config/logger');
const monitoringConfig = require('../config/monitoring.config');

class MonitoringService {
  constructor() {
    // Create a Registry to register the metrics
    this.register = new promClient.Registry();
    
    // Add default metrics (CPU, memory, etc.) if enabled
    if (monitoringConfig.metrics.collectDefaultMetrics) {
      promClient.collectDefaultMetrics({
        register: this.register,
        prefix: monitoringConfig.metrics.defaultMetricsPrefix,
      });
    }

    this.initializeMetrics();
  }

  initializeMetrics() {
    // HTTP Request metrics
    this.httpRequestsTotal = new promClient.Counter({
      name: 'dyad_gateway_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'provider', 'model'],
      registers: [this.register],
    });

    this.httpRequestDuration = new promClient.Histogram({
      name: 'dyad_gateway_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'provider', 'model'],
      buckets: monitoringConfig.metrics.httpDurationBuckets,
      registers: [this.register],
    });

    // Adapter-specific metrics
    this.adapterRequestsTotal = new promClient.Counter({
      name: 'dyad_gateway_adapter_requests_total',
      help: 'Total number of adapter requests',
      labelNames: ['adapter_type', 'provider', 'model', 'status'],
      registers: [this.register],
    });

    this.adapterRequestDuration = new promClient.Histogram({
      name: 'dyad_gateway_adapter_request_duration_seconds',
      help: 'Duration of adapter requests in seconds',
      labelNames: ['adapter_type', 'provider', 'model', 'status'],
      buckets: monitoringConfig.metrics.adapterDurationBuckets,
      registers: [this.register],
    });

    // Token usage metrics
    this.tokensProcessed = new promClient.Counter({
      name: 'dyad_gateway_tokens_processed_total',
      help: 'Total number of tokens processed',
      labelNames: ['provider', 'model', 'type'], // type: prompt, completion
      registers: [this.register],
    });

    // Circuit breaker metrics
    this.circuitBreakerState = new promClient.Gauge({
      name: 'dyad_gateway_circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
      labelNames: ['provider', 'adapter_type'],
      registers: [this.register],
    });

    this.circuitBreakerFailures = new promClient.Counter({
      name: 'dyad_gateway_circuit_breaker_failures_total',
      help: 'Total number of circuit breaker failures',
      labelNames: ['provider', 'adapter_type', 'failure_type'],
      registers: [this.register],
    });

    // Provider health metrics
    this.providerHealthStatus = new promClient.Gauge({
      name: 'dyad_gateway_provider_health_status',
      help: 'Provider health status (1=healthy, 0=unhealthy)',
      labelNames: ['provider', 'adapter_type'],
      registers: [this.register],
    });

    this.providerHealthCheckDuration = new promClient.Histogram({
      name: 'dyad_gateway_provider_health_check_duration_seconds',
      help: 'Duration of provider health checks in seconds',
      labelNames: ['provider', 'adapter_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    // API Key usage metrics
    this.apiKeyRequests = new promClient.Counter({
      name: 'dyad_gateway_api_key_requests_total',
      help: 'Total number of requests per API key',
      labelNames: ['api_key_id', 'status'],
      registers: [this.register],
    });

    // Rate limiting metrics
    this.rateLimitHits = new promClient.Counter({
      name: 'dyad_gateway_rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['api_key_id', 'limit_type'], // limit_type: requests, tokens
      registers: [this.register],
    });

    // Streaming metrics
    this.streamingConnections = new promClient.Gauge({
      name: 'dyad_gateway_streaming_connections_active',
      help: 'Number of active streaming connections',
      labelNames: ['provider', 'model'],
      registers: [this.register],
    });

    this.streamingChunks = new promClient.Counter({
      name: 'dyad_gateway_streaming_chunks_total',
      help: 'Total number of streaming chunks sent',
      labelNames: ['provider', 'model'],
      registers: [this.register],
    });

    // Error metrics
    this.errorsTotal = new promClient.Counter({
      name: 'dyad_gateway_errors_total',
      help: 'Total number of errors',
      labelNames: ['error_type', 'error_code', 'provider', 'adapter_type'],
      registers: [this.register],
    });

    // Sandbox metrics
    this.sandboxExecutions = new promClient.Counter({
      name: 'dyad_gateway_sandbox_executions_total',
      help: 'Total number of sandbox executions',
      labelNames: ['provider', 'status'], // status: success, timeout, error, cancelled
      registers: [this.register],
    });

    this.sandboxExecutionDuration = new promClient.Histogram({
      name: 'dyad_gateway_sandbox_execution_duration_seconds',
      help: 'Duration of sandbox executions in seconds',
      labelNames: ['provider', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
      registers: [this.register],
    });

    logger.info('Monitoring service initialized with Prometheus metrics');
  }

  // HTTP Request tracking
  recordHttpRequest(method, route, statusCode, duration, provider = 'unknown', model = 'unknown') {
    const labels = { method, route, status_code: statusCode, provider, model };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, duration);
  }

  // Adapter request tracking
  recordAdapterRequest(adapterType, provider, model, status, duration) {
    const labels = { adapter_type: adapterType, provider, model, status };
    this.adapterRequestsTotal.inc(labels);
    this.adapterRequestDuration.observe(labels, duration);
  }

  // Token usage tracking
  recordTokenUsage(provider, model, promptTokens, completionTokens) {
    if (promptTokens > 0) {
      this.tokensProcessed.inc({ provider, model, type: 'prompt' }, promptTokens);
    }
    if (completionTokens > 0) {
      this.tokensProcessed.inc({ provider, model, type: 'completion' }, completionTokens);
    }
  }

  // Circuit breaker state tracking
  recordCircuitBreakerState(provider, adapterType, state) {
    // state: 0=closed, 1=open, 2=half-open
    this.circuitBreakerState.set({ provider, adapter_type: adapterType }, state);
  }

  recordCircuitBreakerFailure(provider, adapterType, failureType) {
    this.circuitBreakerFailures.inc({ provider, adapter_type: adapterType, failure_type: failureType });
  }

  // Provider health tracking
  recordProviderHealth(provider, adapterType, isHealthy, checkDuration) {
    this.providerHealthStatus.set({ provider, adapter_type: adapterType }, isHealthy ? 1 : 0);
    this.providerHealthCheckDuration.observe({ provider, adapter_type: adapterType }, checkDuration);
  }

  // API Key usage tracking
  recordApiKeyRequest(apiKeyId, status) {
    this.apiKeyRequests.inc({ api_key_id: apiKeyId, status });
  }

  // Rate limiting tracking
  recordRateLimitHit(apiKeyId, limitType) {
    this.rateLimitHits.inc({ api_key_id: apiKeyId, limit_type: limitType });
  }

  // Streaming connection tracking
  recordStreamingConnection(provider, model, delta = 1) {
    this.streamingConnections.inc({ provider, model }, delta);
  }

  recordStreamingChunk(provider, model) {
    this.streamingChunks.inc({ provider, model });
  }

  // Error tracking
  recordError(errorType, errorCode, provider = 'unknown', adapterType = 'unknown') {
    this.errorsTotal.inc({ error_type: errorType, error_code: errorCode, provider, adapter_type: adapterType });
  }

  // Sandbox execution tracking
  recordSandboxExecution(provider, status, duration) {
    this.sandboxExecutions.inc({ provider, status });
    this.sandboxExecutionDuration.observe({ provider, status }, duration);
  }

  // Get metrics for Prometheus scraping
  getMetrics() {
    return this.register.metrics();
  }

  // Get metrics in JSON format for debugging
  getMetricsAsJson() {
    return this.register.getMetricsAsJSON();
  }

  // Reset all metrics (useful for testing)
  resetMetrics() {
    this.register.resetMetrics();
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;