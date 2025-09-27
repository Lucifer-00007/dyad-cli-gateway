# Dyad CLI Gateway - Production Deployment

This directory contains all the necessary files and configurations for deploying the Dyad CLI Gateway in production environments.

## 🚀 Quick Start

### Kubernetes Deployment (Recommended)

```bash
# Deploy to Kubernetes with default settings
./scripts/deploy-kubernetes.sh deploy

# Deploy with custom configuration
NAMESPACE=my-gateway IMAGE_TAG=v1.0.0 ./scripts/deploy-kubernetes.sh deploy

# Enable gVisor for enhanced security
ENABLE_GVISOR=true ./scripts/deploy-kubernetes.sh deploy
```

### Docker Deployment

```bash
# Start with Docker Compose
docker-compose -f docker-compose.gateway.yml up -d

# Check status
docker-compose -f docker-compose.gateway.yml ps
```

### Traditional Server Deployment

```bash
# Start the gateway
./scripts/start-production.sh

# Stop the gateway
./scripts/stop-production.sh
```

## 📁 Directory Structure

```
deployment/
├── kubernetes/              # Kubernetes manifests
│   ├── namespace.yaml       # Namespace definition
│   ├── configmap.yaml       # Configuration
│   ├── secret.yaml          # Secrets template
│   ├── rbac.yaml           # RBAC configuration
│   ├── mongodb.yaml        # MongoDB deployment
│   ├── redis.yaml          # Redis deployment
│   ├── gateway.yaml        # Gateway deployment
│   ├── security-policies.yaml # Network policies
│   ├── monitoring.yaml     # Monitoring configuration
│   └── gvisor-runtime.yaml # gVisor runtime class
├── systemd/                # Systemd service files
│   └── dyad-gateway.service # Service definition
├── DEPLOYMENT_GUIDE.md     # Comprehensive deployment guide
├── security-review.md      # Security review document
└── README.md              # This file
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `production` | Yes |
| `GATEWAY_PORT` | Gateway port | `3001` | No |
| `MONGODB_URL` | MongoDB connection string | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `ENCRYPTION_KEY` | Data encryption key | - | Yes |
| `GATEWAY_SANDBOX_TYPE` | Sandbox type (`docker`/`kubernetes`) | `docker` | No |
| `K8S_SANDBOX_NAMESPACE` | Kubernetes sandbox namespace | `dyad-gateway-sandbox` | No |
| `GVISOR_ENABLED` | Enable gVisor runtime | `false` | No |

### Kubernetes Configuration

The Kubernetes deployment uses the following resources:

- **Namespace**: `dyad-gateway` (isolated environment)
- **RBAC**: Service account with minimal permissions for sandbox management
- **Network Policies**: Strict network segmentation
- **Security Contexts**: Non-root execution, read-only filesystems
- **Resource Limits**: CPU and memory constraints
- **Health Checks**: Liveness and readiness probes

### Security Features

- **Container Security**: Non-root execution, capability dropping, read-only filesystems
- **Network Security**: Network policies, TLS encryption, ingress controls
- **Sandbox Security**: Kubernetes Jobs instead of Docker socket, optional gVisor
- **Secret Management**: Kubernetes secrets, external KMS integration
- **Monitoring**: Prometheus metrics, structured logging, audit trails

## 🛡️ Security Considerations

### Sandbox Execution

The production deployment eliminates the Docker socket security risk by using:

1. **Kubernetes Jobs**: Isolated job execution in separate namespace
2. **gVisor Runtime** (optional): User-space kernel for enhanced isolation
3. **Network Policies**: Restricted network access for sandbox pods
4. **Resource Limits**: CPU, memory, and storage constraints

### Network Security

- All external communication uses HTTPS/TLS
- Internal communication is secured with network policies
- Ingress is controlled through Kubernetes ingress controllers
- Database and cache access is restricted to gateway pods only

### Secret Management

- Secrets are stored in Kubernetes secrets or external KMS
- No hardcoded credentials in container images
- Automatic secret rotation capabilities
- Encryption at rest and in transit

## 📊 Monitoring and Observability

### Health Checks

- **Liveness Probe**: `/healthz` endpoint
- **Readiness Probe**: `/ready` endpoint (includes dependency checks)
- **Startup Probe**: Configurable startup time allowance

### Metrics

- **Prometheus Metrics**: Request rates, latency, error rates
- **Custom Metrics**: Sandbox job metrics, provider health
- **Grafana Dashboards**: Pre-configured dashboards for monitoring

### Logging

- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: Configurable log levels for different environments
- **Audit Logging**: All admin actions and security events
- **Log Rotation**: Automatic log rotation and cleanup

## 🔄 Database Management

### Migrations

```bash
# Run pending migrations
node scripts/migrate-database.js migrate

# Check migration status
node scripts/migrate-database.js status

# Create new migration
node scripts/migrate-database.js create "migration name"
```

### Backups

```bash
# Create backup
./scripts/backup-database.sh backup

# List backups
./scripts/backup-database.sh list

# Restore from backup
./scripts/backup-database.sh restore /path/to/backup
```

### Backup Features

- **Automated Backups**: Scheduled via cron jobs
- **Compression**: Gzip compression for space efficiency
- **Encryption**: Optional backup encryption
- **Cloud Storage**: S3 integration for offsite backups
- **Retention**: Configurable backup retention policies

## 🚨 Troubleshooting

### Common Issues

#### Gateway Won't Start
```bash
# Check logs
kubectl logs -n dyad-gateway -l app.kubernetes.io/component=gateway

# Check configuration
kubectl describe configmap dyad-gateway-config -n dyad-gateway
```

#### Sandbox Jobs Failing
```bash
# Check sandbox namespace
kubectl get pods -n dyad-gateway-sandbox

# Check RBAC permissions
kubectl auth can-i create jobs --as=system:serviceaccount:dyad-gateway:dyad-gateway -n dyad-gateway-sandbox
```

#### Database Connection Issues
```bash
# Test MongoDB connectivity
kubectl exec -it deployment/dyad-gateway-mongo -n dyad-gateway -- mongo --eval "db.adminCommand('ping')"

# Check MongoDB logs
kubectl logs deployment/dyad-gateway-mongo -n dyad-gateway
```

### Performance Tuning

#### Resource Optimization
- Adjust CPU and memory limits based on workload
- Configure horizontal pod autoscaling
- Optimize database queries and indexes
- Implement connection pooling

#### Scaling Considerations
- Gateway pods are stateless and can be scaled horizontally
- Database scaling may require sharding or read replicas
- Consider using a service mesh for advanced traffic management

## 📚 Additional Resources

- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Comprehensive deployment instructions
- [Security Review](security-review.md) - Security architecture and considerations
- [API Documentation](../md-docs/openapi.yaml) - OpenAPI specification
- [Monitoring Guide](../monitoring/README.md) - Monitoring and alerting setup

## 🆘 Support

For deployment issues or questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review the [deployment guide](DEPLOYMENT_GUIDE.md)
3. Check the [GitHub issues](https://github.com/dyad/cli-gateway/issues)
4. Contact the development team

---

*This deployment configuration is designed for production use with security, scalability, and maintainability in mind.*