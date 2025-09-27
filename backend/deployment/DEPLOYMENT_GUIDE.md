# Dyad CLI Gateway - Production Deployment Guide

This guide covers production deployment options for the Dyad CLI Gateway, including Kubernetes, Docker, and traditional server deployments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Kubernetes Deployment](#kubernetes-deployment)
3. [Docker Deployment](#docker-deployment)
4. [Traditional Server Deployment](#traditional-server-deployment)
5. [Database Setup](#database-setup)
6. [Security Configuration](#security-configuration)
7. [Monitoring Setup](#monitoring-setup)
8. [Backup and Recovery](#backup-and-recovery)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **CPU**: Minimum 2 cores, Recommended 4+ cores
- **Memory**: Minimum 2GB RAM, Recommended 4GB+ RAM
- **Storage**: Minimum 20GB, Recommended 50GB+ SSD
- **Network**: HTTPS/TLS support, stable internet connection

### Software Dependencies
- **Node.js**: Version 18.x or higher
- **MongoDB**: Version 6.0 or higher
- **Redis**: Version 7.x or higher (optional, for caching)
- **Docker**: Version 20.x or higher (for containerized deployment)
- **Kubernetes**: Version 1.25+ (for K8s deployment)

### Security Requirements
- TLS certificates for HTTPS
- Secure secret management (KMS, Vault, or K8s secrets)
- Network security (firewalls, VPCs)
- Container security scanning

## Kubernetes Deployment

### 1. Prepare the Cluster

```bash
# Create namespace
kubectl apply -f deployment/kubernetes/namespace.yaml

# Apply RBAC configuration
kubectl apply -f deployment/kubernetes/rbac.yaml

# Apply security policies
kubectl apply -f deployment/kubernetes/security-policies.yaml
```

### 2. Configure Secrets

```bash
# Create secrets (customize values)
kubectl apply -f deployment/kubernetes/secret.yaml

# Or create secrets from command line
kubectl create secret generic dyad-gateway-secrets \
  --from-literal=MONGODB_URL="mongodb://user:pass@mongo:27017/dyad-gateway" \
  --from-literal=JWT_SECRET="your-jwt-secret-here" \
  --from-literal=ENCRYPTION_KEY="your-32-char-encryption-key-here" \
  -n dyad-gateway
```

### 3. Deploy Dependencies

```bash
# Deploy MongoDB
kubectl apply -f deployment/kubernetes/mongodb.yaml

# Deploy Redis
kubectl apply -f deployment/kubernetes/redis.yaml

# Wait for dependencies to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=database -n dyad-gateway --timeout=300s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=cache -n dyad-gateway --timeout=300s
```

### 4. Deploy Gateway

```bash
# Apply configuration
kubectl apply -f deployment/kubernetes/configmap.yaml

# Deploy the gateway
kubectl apply -f deployment/kubernetes/gateway.yaml

# Wait for deployment
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=gateway -n dyad-gateway --timeout=300s
```

### 5. Configure Ingress (Optional)

```bash
# Update the ingress configuration with your domain
# Edit deployment/kubernetes/gateway.yaml and update the host field

# Apply ingress
kubectl apply -f deployment/kubernetes/gateway.yaml
```

### 6. Enable gVisor (Optional)

```bash
# Install gVisor on cluster nodes first
# Then apply the runtime class
kubectl apply -f deployment/kubernetes/gvisor-runtime.yaml

# Update gateway deployment to use gVisor
kubectl patch deployment dyad-gateway -n dyad-gateway -p '{"spec":{"template":{"spec":{"runtimeClassName":"gvisor"}}}}'
```

### 7. Setup Monitoring

```bash
# Apply monitoring configuration
kubectl apply -f deployment/kubernetes/monitoring.yaml

# If using Prometheus Operator
kubectl apply -f deployment/kubernetes/monitoring.yaml
```

## Docker Deployment

### 1. Prepare Environment

```bash
# Clone the repository
git clone <repository-url>
cd dyad-cli-gateway/backend

# Create environment file
cp .env.example .env
# Edit .env with your configuration
```

### 2. Build Images

```bash
# Build the gateway image
docker build -f Dockerfile.gateway -t dyad/cli-gateway:latest .

# Or use the provided image
docker pull dyad/cli-gateway:latest
```

### 3. Deploy with Docker Compose

```bash
# Start the stack
docker-compose -f docker-compose.gateway.yml up -d

# Check status
docker-compose -f docker-compose.gateway.yml ps

# View logs
docker-compose -f docker-compose.gateway.yml logs -f gateway
```

### 4. Configure Reverse Proxy

```nginx
# Example Nginx configuration
server {
    listen 443 ssl http2;
    server_name gateway.yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support for streaming
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Traditional Server Deployment

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Install Redis
sudo apt-get install -y redis-server

# Install PM2
sudo npm install -g pm2
```

### 2. Application Setup

```bash
# Create application user
sudo useradd -r -s /bin/bash -d /opt/dyad-gateway dyad-gateway

# Create application directory
sudo mkdir -p /opt/dyad-gateway
sudo chown dyad-gateway:dyad-gateway /opt/dyad-gateway

# Deploy application
sudo -u dyad-gateway git clone <repository-url> /opt/dyad-gateway
cd /opt/dyad-gateway/backend

# Install dependencies
sudo -u dyad-gateway npm install --production

# Create environment file
sudo -u dyad-gateway cp .env.example .env
# Edit .env with your configuration
```

### 3. Configure Services

```bash
# Copy systemd service file
sudo cp deployment/systemd/dyad-gateway.service /etc/systemd/system/

# Edit service file with correct paths
sudo nano /etc/systemd/system/dyad-gateway.service

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable dyad-gateway
sudo systemctl start dyad-gateway

# Check status
sudo systemctl status dyad-gateway
```

### 4. Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (if needed)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

## Database Setup

### 1. Run Migrations

```bash
# Run database migrations
node scripts/migrate-database.js migrate

# Check migration status
node scripts/migrate-database.js status
```

### 2. Create Initial Data

```bash
# Create admin user (if needed)
node scripts/create-admin-user.js

# Create initial API keys
node scripts/create-api-key.js
```

### 3. Configure Backup

```bash
# Set up automated backups
crontab -e

# Add backup job (daily at 2 AM)
0 2 * * * /opt/dyad-gateway/backend/scripts/backup-database.sh backup
```

## Security Configuration

### 1. TLS/SSL Setup

```bash
# Using Let's Encrypt with Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d gateway.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 2. Firewall Configuration

```bash
# Configure iptables or use cloud provider security groups
# Allow only necessary ports: 80, 443, 22 (SSH)

# Example iptables rules
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -j DROP
```

### 3. Secret Management

```bash
# Use environment variables or external secret management
export JWT_SECRET="$(openssl rand -base64 32)"
export ENCRYPTION_KEY="$(openssl rand -base64 32)"

# Or use AWS Secrets Manager, HashiCorp Vault, etc.
```

## Monitoring Setup

### 1. Application Monitoring

```bash
# Start monitoring stack
./scripts/start-monitoring.sh

# Access Grafana: http://localhost:3000 (admin/admin123)
# Access Prometheus: http://localhost:9090
```

### 2. Log Management

```bash
# Configure log rotation
sudo nano /etc/logrotate.d/dyad-gateway

# Content:
/opt/dyad-gateway/backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 dyad-gateway dyad-gateway
    postrotate
        systemctl reload dyad-gateway
    endscript
}
```

### 3. Health Checks

```bash
# Set up external health monitoring
# Example with curl and cron
*/5 * * * * curl -f http://localhost:3001/healthz || echo "Gateway health check failed" | mail -s "Alert" admin@yourdomain.com
```

## Backup and Recovery

### 1. Database Backup

```bash
# Manual backup
./scripts/backup-database.sh backup

# Automated backup (add to cron)
0 2 * * * /opt/dyad-gateway/backend/scripts/backup-database.sh backup

# List backups
./scripts/backup-database.sh list
```

### 2. Database Restore

```bash
# Restore from backup
./scripts/backup-database.sh restore /path/to/backup/file

# Restore from cloud backup
aws s3 cp s3://your-bucket/backup.tar.gz.enc ./
./scripts/backup-database.sh restore ./backup.tar.gz.enc
```

### 3. Application Backup

```bash
# Backup configuration and logs
tar -czf gateway-config-$(date +%Y%m%d).tar.gz \
    /opt/dyad-gateway/backend/.env \
    /opt/dyad-gateway/backend/logs/ \
    /etc/systemd/system/dyad-gateway.service
```

## Troubleshooting

### Common Issues

#### Gateway Won't Start
```bash
# Check logs
sudo journalctl -u dyad-gateway -f

# Check configuration
node -e "console.log(require('./src/config/config'))"

# Check dependencies
npm audit
```

#### Database Connection Issues
```bash
# Test MongoDB connection
mongo --eval "db.adminCommand('ping')"

# Check MongoDB logs
sudo journalctl -u mongod -f

# Verify connection string
echo $MONGODB_URL
```

#### Sandbox Execution Failures
```bash
# Check Kubernetes permissions (K8s deployment)
kubectl auth can-i create jobs --as=system:serviceaccount:dyad-gateway:dyad-gateway -n dyad-gateway-sandbox

# Check Docker socket (Docker deployment)
docker ps

# Check sandbox logs
kubectl logs -l dyad.gateway/job-type=cli-execution -n dyad-gateway-sandbox
```

#### Performance Issues
```bash
# Check resource usage
top -p $(pgrep -f "dyad-gateway")

# Check database performance
mongo --eval "db.runCommand({serverStatus: 1}).metrics"

# Check network latency
ping your-database-host
```

### Log Locations

- **Application Logs**: `/opt/dyad-gateway/backend/logs/`
- **System Logs**: `journalctl -u dyad-gateway`
- **MongoDB Logs**: `journalctl -u mongod`
- **Nginx Logs**: `/var/log/nginx/`

### Support

For additional support:
- Check the [GitHub Issues](https://github.com/dyad/cli-gateway/issues)
- Review the [API Documentation](../md-docs/openapi.yaml)
- Contact the development team

---

*This deployment guide should be updated as the system evolves and new deployment patterns are established.*