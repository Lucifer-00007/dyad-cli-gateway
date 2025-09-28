# Performance Optimization Guide

This document describes the performance optimization features implemented in the Dyad CLI Gateway, including connection pooling, request queuing, caching, and load testing capabilities.

## Overview

The performance optimization system consists of several integrated components:

- **Connection Pool Service**: Manages HTTP/HTTPS connection pooling for efficient resource usage
- **Request Queue Service**: Handles request queuing and load balancing with priority support
- **Enhanced Cache Service**: Advanced caching with TTL, LRU eviction, and performance monitoring
- **Performance Service**: Coordinates all performance components and provides unified monitoring
- **Load Testing Suite**: Comprehensive load testing tools and scenarios

## Features

### 1. Connection Pooling

The Connection Pool Service manages HTTP/HTTPS connections to improve performance and reduce overhead.

**Key Features:**
- Keep-alive connections with configurable timeouts
- Separate pools for HTTP and HTTPS
- Connection reuse and automatic cleanup
- Performance statistics and health monitoring

**Configuration:**
```javascript
{
  maxSockets: 50,           // Maximum sockets per host
  maxFreeSockets: 10,       // Maximum free sockets to keep
  timeout: 30000,           // Socket timeout in ms
  keepAlive: true,          // Enable keep-alive
  keepAliveMsecs: 1000     // Keep-alive timeout
}
```

### 2. Request Queuing

The Request Queue Service manages concurrent request processing with priority support.

**Key Features:**
- Priority-based queuing (0 = highest priority)
- Configurable concurrency limits
- Request timeout handling
- Queue size limits and overflow protection
- Comprehensive statistics and monitoring

**Configuration:**
```javascript
{
  maxConcurrent: 10,        // Maximum concurrent requests
  maxQueueSize: 100,        // Maximum queue size
  timeout: 30000,           // Request timeout in ms
  priorityLevels: 3         // Number of priority levels
}
```

### 3. Enhanced Caching

The Enhanced Cache Service provides advanced caching capabilities with multiple cache types.

**Cache Types:**
- **Models Cache**: Caches model listings (5-minute TTL)
- **Providers Cache**: Caches provider data (1-minute TTL)
- **Health Cache**: Caches health check results (30-second TTL)
- **Responses Cache**: Caches API responses (1-minute TTL)

**Key Features:**
- TTL-based expiration
- LRU eviction policy
- Memory usage tracking
- Hit/miss rate monitoring
- Automatic cleanup of expired entries

### 4. Performance Monitoring

Comprehensive performance monitoring with real-time metrics and health checks.

**Metrics Tracked:**
- Request counts and success rates
- Response time percentiles (P50, P90, P95, P99)
- Throughput (requests per minute)
- Cache hit rates
- Queue utilization
- Connection pool efficiency

## API Endpoints

### Performance Statistics

```http
GET /admin/performance/stats
```

Returns comprehensive performance statistics including:
- Request metrics (total, successful, failed)
- Response time statistics
- Throughput metrics
- Component-specific statistics

### Performance Health

```http
GET /admin/performance/health
```

Returns performance health status:
- Overall health status (healthy/degraded/unhealthy)
- Success rate
- Response time metrics
- Component health status

### Cache Management

```http
# Clear all caches
DELETE /admin/performance/cache

# Clear specific cache
DELETE /admin/performance/cache/{cacheName}

# Get cache statistics
GET /admin/performance/cache/stats
```

### Component Statistics

```http
# Connection pool statistics
GET /admin/performance/connection-pool

# Request queue statistics
GET /admin/performance/request-queue

# Optimization suggestions
GET /admin/performance/optimize
```

### Dashboard Data

```http
# Comprehensive dashboard data
GET /admin/dashboard

# Real-time metrics
GET /admin/dashboard/metrics/realtime

# Performance trends
GET /admin/dashboard/metrics/trends

# System alerts
GET /admin/dashboard/alerts

# Provider insights
GET /admin/dashboard/providers/insights
```

## Load Testing

### Running Load Tests

The system includes comprehensive load testing capabilities:

```bash
# Run basic performance test
npm run test:performance

# Run specific load test scenarios
npm run test:load:basic
npm run test:load:chat
npm run test:load:streaming
npm run test:load:mixed
npm run test:load:benchmark
```

### Load Test Scenarios

1. **Basic Load Test**: Tests basic endpoints with configurable concurrency
2. **Chat Completion Test**: Tests chat completion endpoints with various scenarios
3. **Streaming Test**: Tests streaming chat completion performance
4. **Mixed Workload Test**: Tests mixed API usage patterns
5. **Benchmark Suite**: Comprehensive performance benchmark

### Load Test Configuration

```javascript
const loadTester = new LoadTester({
  baseUrl: 'http://localhost:3001',
  apiKey: 'test-api-key',
  maxConcurrent: 10,
  duration: 60000,        // 1 minute
  rampUpTime: 10000,      // 10 seconds
  scenarios: ['chat-completion', 'models-list']
});
```

## Configuration

### Environment Variables

```bash
# Performance Configuration
GATEWAY_PERFORMANCE_MAX_CONCURRENT=10
GATEWAY_PERFORMANCE_MAX_QUEUE_SIZE=100
GATEWAY_PERFORMANCE_REQUEST_TIMEOUT=30000
GATEWAY_PERFORMANCE_MAX_SOCKETS=50
GATEWAY_PERFORMANCE_MAX_FREE_SOCKETS=10
GATEWAY_PERFORMANCE_KEEP_ALIVE=true

# Cache Configuration
GATEWAY_PERFORMANCE_CACHE_MODELS_TTL=300000      # 5 minutes
GATEWAY_PERFORMANCE_CACHE_PROVIDERS_TTL=60000    # 1 minute
GATEWAY_PERFORMANCE_CACHE_HEALTH_TTL=30000       # 30 seconds
```

### Gateway Configuration

```javascript
// In gateway.config.js
performance: {
  maxConcurrent: 10,
  maxQueueSize: 100,
  requestTimeout: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  keepAlive: true,
  cache: {
    models: { defaultTTL: 300000 },
    providers: { defaultTTL: 60000 },
    health: { defaultTTL: 30000 }
  }
}
```

## Performance Optimization Best Practices

### 1. Connection Pool Optimization

- Set `maxSockets` based on expected concurrent load
- Use `keepAlive` for better connection reuse
- Monitor pool efficiency and adjust settings accordingly

### 2. Request Queue Tuning

- Set `maxConcurrent` based on system capacity
- Use priority levels for critical requests
- Monitor queue utilization and adjust limits

### 3. Cache Strategy

- Use appropriate TTL values for different data types
- Monitor cache hit rates and adjust cache sizes
- Clear caches when underlying data changes

### 4. Load Testing

- Run regular load tests to identify performance bottlenecks
- Test with realistic workload patterns
- Monitor performance metrics during tests

## Monitoring and Alerting

### Health Checks

The system provides multiple health check levels:

- **Healthy**: All components operating normally
- **Degraded**: Some performance issues detected
- **Unhealthy**: Critical performance problems

### Performance Alerts

Automatic alerts are generated for:
- High error rates (>5%)
- Slow response times (>2 seconds P95)
- High queue utilization (>80%)
- Low cache hit rates (<50%)
- Circuit breaker activations

### Metrics Collection

Performance metrics are collected and can be exported to:
- Prometheus (via `/metrics` endpoint)
- Custom monitoring systems
- Dashboard APIs

## Troubleshooting

### Common Performance Issues

1. **High Response Times**
   - Check queue utilization
   - Verify connection pool settings
   - Review cache hit rates

2. **Low Throughput**
   - Increase `maxConcurrent` setting
   - Optimize connection pool size
   - Check for bottlenecks in adapters

3. **Memory Usage**
   - Monitor cache sizes
   - Adjust TTL values
   - Check for memory leaks

### Performance Tuning

1. **Identify Bottlenecks**
   ```bash
   # Get performance statistics
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        http://localhost:3001/admin/performance/stats
   ```

2. **Optimize Settings**
   ```bash
   # Get optimization suggestions
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        http://localhost:3001/admin/performance/optimize
   ```

3. **Monitor Results**
   ```bash
   # Check health status
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        http://localhost:3001/admin/performance/health
   ```

## Integration Tests

The performance optimization features include comprehensive integration tests:

```bash
# Run performance optimization tests
npm test -- --testPathPattern=performance-optimization.test.js
```

Tests cover:
- Performance statistics collection
- Cache management
- Connection pool behavior
- Request queue functionality
- Load testing scenarios

## Future Enhancements

Planned improvements include:
- Redis-based distributed caching
- Advanced load balancing algorithms
- Machine learning-based performance optimization
- Real-time performance anomaly detection
- Integration with APM tools (New Relic, DataDog, etc.)