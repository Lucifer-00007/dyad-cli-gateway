/**
 * Monitoring Configuration
 * Configuration for metrics collection and monitoring
 */

const config = {
  // Metrics collection settings
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    port: parseInt(process.env.METRICS_PORT, 10) || 3001,
    path: '/metrics',
    collectDefaultMetrics: true,
    defaultMetricsPrefix: 'dyad_gateway_',
    
    // Histogram buckets for response time metrics
    httpDurationBuckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    adapterDurationBuckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
    sandboxDurationBuckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
    healthCheckDurationBuckets: [0.1, 0.5, 1, 2, 5, 10],
  },

  // Structured logging settings
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    correlationIdHeader: 'X-Correlation-ID',
    
    // Log file settings (production only)
    files: {
      error: {
        filename: 'logs/gateway-error.log',
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      },
      combined: {
        filename: 'logs/gateway-combined.log',
        maxsize: 10485760, // 10MB
        maxFiles: 10,
      },
    },

    // Fields to redact from logs
    redactFields: [
      'password',
      'secret',
      'token',
      'api_key',
      'apiKey',
      'authorization',
      'credentials',
    ],
  },

  // Health check settings
  health: {
    endpoint: '/health',
    readinessEndpoint: '/ready',
    
    // Dependencies to check for readiness
    dependencies: {
      database: {
        enabled: true,
        timeout: 5000,
      },
      providers: {
        enabled: true,
        timeout: 10000,
        maxFailures: 3,
      },
    },
  },

  // Circuit breaker monitoring
  circuitBreaker: {
    // States: 0=closed, 1=open, 2=half-open
    states: {
      CLOSED: 0,
      OPEN: 1,
      HALF_OPEN: 2,
    },
    
    // Failure types to track
    failureTypes: [
      'timeout',
      'connection_error',
      'authentication_error',
      'rate_limit',
      'server_error',
      'unknown',
    ],
  },

  // Rate limiting monitoring
  rateLimiting: {
    limitTypes: [
      'requests',
      'tokens',
      'concurrent_requests',
    ],
  },

  // Streaming monitoring
  streaming: {
    // Events to track
    events: [
      'started',
      'chunk_sent',
      'completed',
      'error',
      'cancelled',
    ],
  },

  // Sandbox monitoring
  sandbox: {
    // Execution statuses to track
    statuses: [
      'success',
      'timeout',
      'error',
      'cancelled',
      'memory_limit',
      'cpu_limit',
    ],
  },

  // Error monitoring
  errors: {
    // Error types to track
    types: [
      'ValidationError',
      'AuthenticationError',
      'AuthorizationError',
      'RateLimitError',
      'TimeoutError',
      'ConnectionError',
      'AdapterError',
      'SandboxError',
      'CircuitBreakerError',
      'UnknownError',
    ],

    // Error codes to track
    codes: [
      'invalid_request',
      'invalid_api_key',
      'forbidden',
      'not_found',
      'rate_limit_exceeded',
      'timeout',
      'connection_failed',
      'adapter_timeout',
      'provider_authentication',
      'internal_server_error',
    ],
  },

  // Alert thresholds (for documentation/reference)
  alertThresholds: {
    errorRate: {
      warning: 1, // 1%
      critical: 5, // 5%
    },
    responseTime: {
      warning: 2, // 2 seconds
      critical: 5, // 5 seconds
    },
    adapterResponseTime: {
      warning: 10, // 10 seconds
      critical: 30, // 30 seconds
    },
    memoryUsage: {
      warning: 512, // 512MB
      critical: 1024, // 1GB
    },
    cpuUsage: {
      warning: 70, // 70%
      critical: 90, // 90%
    },
    streamingConnections: {
      warning: 50,
      critical: 100,
    },
    rateLimitHits: {
      warning: 10, // per second
      critical: 50, // per second
    },
    sandboxFailureRate: {
      warning: 10, // 10%
      critical: 20, // 20%
    },
  },
};

module.exports = config;