# Dyad CLI Gateway Monitoring

This directory contains comprehensive monitoring and alerting configuration for the Dyad CLI Gateway using Prometheus, Grafana, and Alertmanager.

## Overview

The monitoring stack provides:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization dashboards
- **Alertmanager**: Alert routing and notifications
- **Node Exporter**: System metrics
- **cAdvisor**: Container metrics

## Quick Start

### 1. Start the Monitoring Stack

```bash
cd backend/monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

### 2. Access the Services

- **Grafana**: http://localhost:3000 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

### 3. Configure Gateway Metrics

Ensure your gateway is running and exposing metrics on `/metrics` endpoint.

## Metrics Collected

### HTTP Request Metrics
- `dyad_gateway_http_requests_total` - Total HTTP requests by method, route, status, provider, model
- `dyad_gateway_http_request_duration_seconds` - Request duration histogram

### Adapter Metrics
- `dyad_gateway_adapter_requests_total` - Total adapter requests by type, provider, model, status
- `dyad_gateway_adapter_request_duration_seconds` - Adapter execution duration

### Token Usage Metrics
- `dyad_gateway_tokens_processed_total` - Total tokens processed by provider, model, type

### Circuit Breaker Metrics
- `dyad_gateway_circuit_breaker_state` - Circuit breaker state (0=closed, 1=open, 2=half-open)
- `dyad_gateway_circuit_breaker_failures_total` - Circuit breaker failures

### Provider Health Metrics
- `dyad_gateway_provider_health_status` - Provider health status (1=healthy, 0=unhealthy)
- `dyad_gateway_provider_health_check_duration_seconds` - Health check duration

### Streaming Metrics
- `dyad_gateway_streaming_connections_active` - Active streaming connections
- `dyad_gateway_streaming_chunks_total` - Total streaming chunks sent

### Security Metrics
- `dyad_gateway_api_key_requests_total` - API key usage
- `dyad_gateway_rate_limit_hits_total` - Rate limit violations
- `dyad_gateway_errors_total` - Error counts by type

### Sandbox Metrics
- `dyad_gateway_sandbox_executions_total` - Sandbox execution counts
- `dyad_gateway_sandbox_execution_duration_seconds` - Sandbox execution duration

## Dashboards

### Main Dashboard
The main Grafana dashboard (`dyad-gateway-dashboard.json`) includes:

1. **Overview Panels**:
   - Request Rate
   - Error Rate
   - Response Time P95
   - Active Streaming Connections

2. **Performance Panels**:
   - Request Rate by Provider
   - Response Time Distribution
   - Adapter Execution Time
   - Token Usage by Provider

3. **Health Panels**:
   - Circuit Breaker Status
   - Provider Health Status
   - Rate Limit Hits
   - Sandbox Execution Status

## Alerting Rules

### Critical Alerts
- **High Error Rate**: >5% error rate for 2 minutes
- **Circuit Breaker Open**: Circuit breaker open for 1 minute
- **Service Down**: Service unavailable for 1 minute
- **Adapter Queue Buildup**: P95 adapter time >30s for 3 minutes

### Warning Alerts
- **High Latency**: P95 response time >5s for 3 minutes
- **Provider Unhealthy**: Provider unhealthy for 2 minutes
- **High Rate Limit Hits**: >10 hits/sec for 2 minutes
- **Sandbox Failures**: >20% failure rate for 3 minutes
- **High Memory/CPU Usage**: Resource usage above thresholds

### Info Alerts
- **Low Request Volume**: Unusually low traffic
- **Token Usage Spike**: High token processing rate
- **New Provider Added**: Provider configuration changes

## Alert Routing

Alerts are routed based on severity:

- **Critical**: Immediate notification via email + Slack
- **Warning**: Email to dev team + Slack warning channel
- **Info**: Email to monitoring team

## Configuration

### Prometheus Configuration
Edit `prometheus/prometheus.yml` to:
- Add new scrape targets
- Adjust scrape intervals
- Configure service discovery

### Grafana Configuration
- Dashboards are auto-provisioned from `grafana/dashboards/`
- Data sources configured in `grafana/provisioning/datasources/`

### Alertmanager Configuration
Edit `alertmanager/alertmanager.yml` to:
- Configure notification channels (email, Slack, webhooks)
- Set up routing rules
- Configure inhibition rules

## Structured Logging

The gateway uses structured logging with correlation IDs:

```javascript
// Example usage in code
const logger = structuredLogger.createChildLogger(req.correlationId, {
  provider: 'openai',
  model: 'gpt-4'
});

logger.info('Processing request', { 
  requestSize: req.body.length,
  userId: req.user.id 
});
```

### Log Fields
- `correlationId`: Unique request identifier
- `timestamp`: ISO timestamp
- `level`: Log level (info, warn, error, debug)
- `service`: Always 'dyad-cli-gateway'
- `type`: Event type (http_request, adapter_execution, etc.)
- Context fields: provider, model, userId, etc.

## Integration Examples

### Adding Metrics to New Adapters

```javascript
const monitoringService = require('../services/monitoring.service');

class MyAdapter extends BaseAdapter {
  async handleChat({ messages, options, requestMeta, signal }) {
    const startTime = Date.now();
    
    try {
      // Your adapter logic here
      const result = await this.processRequest(messages);
      
      // Record success metrics
      const duration = (Date.now() - startTime) / 1000;
      monitoringService.recordAdapterRequest(
        'my-adapter',
        this.providerConfig.name,
        options.model,
        'success',
        duration
      );
      
      return result;
    } catch (error) {
      // Record error metrics
      const duration = (Date.now() - startTime) / 1000;
      monitoringService.recordAdapterRequest(
        'my-adapter',
        this.providerConfig.name,
        options.model,
        'error',
        duration
      );
      
      monitoringService.recordError(
        error.name,
        error.code,
        this.providerConfig.name,
        'my-adapter'
      );
      
      throw error;
    }
  }
}
```

### Adding Structured Logging

```javascript
const structuredLogger = require('../services/structured-logger.service');

// In middleware or request handler
const logger = structuredLogger.createChildLogger(req.correlationId, {
  provider: req.provider,
  model: req.body.model,
  userId: req.user?.id
});

logger.info('Request started', {
  method: req.method,
  path: req.path,
  contentLength: req.get('Content-Length')
});

// Log adapter execution
structuredLogger.logAdapterExecution(
  'spawn-cli',
  'my-provider',
  'my-model',
  'success',
  1.23,
  req.correlationId,
  { outputTokens: 150 }
);
```

## Troubleshooting

### Common Issues

1. **Metrics not appearing**:
   - Check gateway `/metrics` endpoint is accessible
   - Verify Prometheus scrape configuration
   - Check network connectivity between containers

2. **Alerts not firing**:
   - Verify alert rules syntax in Prometheus
   - Check Alertmanager configuration
   - Ensure notification channels are configured

3. **Dashboard not loading**:
   - Check Grafana data source configuration
   - Verify dashboard JSON syntax
   - Check Prometheus connectivity

### Debugging Commands

```bash
# Check metrics endpoint
curl http://localhost:3001/metrics

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check Alertmanager status
curl http://localhost:9093/api/v1/status

# View container logs
docker-compose -f docker-compose.monitoring.yml logs -f prometheus
docker-compose -f docker-compose.monitoring.yml logs -f grafana
docker-compose -f docker-compose.monitoring.yml logs -f alertmanager
```

## Production Considerations

### Security
- Change default Grafana admin password
- Configure proper authentication for Prometheus/Alertmanager
- Use TLS for all communications
- Restrict network access to monitoring services

### Scalability
- Configure Prometheus retention based on storage capacity
- Use remote storage for long-term metrics retention
- Consider Prometheus federation for multiple instances
- Set up high availability for critical components

### Backup
- Backup Grafana dashboards and configuration
- Export Prometheus data for disaster recovery
- Version control all configuration files

### Performance
- Tune scrape intervals based on requirements
- Configure appropriate retention policies
- Monitor monitoring stack resource usage
- Use recording rules for expensive queries

## Environment Variables

```bash
# Gateway configuration
GATEWAY_METRICS_ENABLED=true
GATEWAY_METRICS_PORT=3001

# Monitoring stack
PROMETHEUS_RETENTION=30d
GRAFANA_ADMIN_PASSWORD=your-secure-password
ALERTMANAGER_SMTP_HOST=smtp.company.com
ALERTMANAGER_SMTP_USER=alerts@company.com
ALERTMANAGER_SMTP_PASSWORD=your-smtp-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## Next Steps

1. **Custom Dashboards**: Create application-specific dashboards
2. **SLI/SLO Monitoring**: Define and monitor service level objectives
3. **Distributed Tracing**: Add OpenTelemetry for request tracing
4. **Log Aggregation**: Integrate with ELK stack or similar
5. **Anomaly Detection**: Implement ML-based anomaly detection