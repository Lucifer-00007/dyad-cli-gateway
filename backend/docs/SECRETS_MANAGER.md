# Secrets Manager Integration

The Dyad CLI Gateway integrates with external secrets management systems to securely store and manage provider credentials and encryption keys. This document describes the configuration, usage, and best practices for the secrets manager integration.

## Overview

The secrets manager integration provides:

- **External Secret Storage**: Store provider credentials in AWS Secrets Manager, Azure Key Vault, HashiCorp Vault, or environment variables
- **KMS Integration**: Use cloud KMS services for encryption key management and rotation
- **Automatic Key Rotation**: Schedule automatic encryption key rotation with zero-downtime re-encryption
- **Credential Caching**: In-memory caching with TTL for improved performance
- **Fallback Support**: Graceful fallback to environment variables when external systems are unavailable

## Supported Providers

### 1. AWS Secrets Manager + KMS

**Configuration:**
```bash
SECRETS_PROVIDER=aws
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
ENCRYPTION_KEY_ID=your-kms-key-id
```

**Features:**
- Secrets stored in AWS Secrets Manager
- Encryption keys managed by AWS KMS
- Automatic key rotation support
- Cross-region replication available

**IAM Permissions Required:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:CreateSecret",
        "secretsmanager:UpdateSecret",
        "secretsmanager:DeleteSecret"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:dyad-gateway/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:RotateKeyOnDemand"
      ],
      "Resource": "arn:aws:kms:*:*:key/your-kms-key-id"
    }
  ]
}
```

### 2. Azure Key Vault

**Configuration:**
```bash
SECRETS_PROVIDER=azure
AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
ENCRYPTION_KEY_ID=your-key-name
```

**Features:**
- Secrets stored in Azure Key Vault
- Keys managed by Azure Key Vault
- Managed identity support
- RBAC integration

**Required Permissions:**
- Key Vault Secrets Officer (for secrets)
- Key Vault Crypto Officer (for keys)

### 3. HashiCorp Vault

**Configuration:**
```bash
SECRETS_PROVIDER=vault
VAULT_ADDR=https://vault.example.com
VAULT_TOKEN=your-vault-token
VAULT_MOUNT_PATH=secret
VAULT_NAMESPACE=your-namespace
ENCRYPTION_KEY_ID=your-transit-key
```

**Features:**
- Secrets stored in KV v2 engine
- Encryption via Transit engine
- Dynamic secrets support
- Policy-based access control

**Required Policies:**
```hcl
# Secrets access
path "secret/data/dyad-gateway/*" {
  capabilities = ["create", "read", "update", "delete"]
}

# Transit encryption
path "transit/encrypt/dyad-gateway-*" {
  capabilities = ["update"]
}

path "transit/decrypt/dyad-gateway-*" {
  capabilities = ["update"]
}

path "transit/keys/dyad-gateway-*" {
  capabilities = ["read", "update"]
}
```

### 4. Environment Variables (Development/Fallback)

**Configuration:**
```bash
SECRETS_PROVIDER=environment
ENCRYPTION_KEY=your-32-byte-hex-key
```

**Features:**
- Simple environment variable storage
- Local encryption with provided key
- Development and testing friendly
- Automatic fallback option

## Configuration Options

### Core Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRETS_PROVIDER` | Provider type: aws, azure, vault, environment | `environment` |
| `ENCRYPTION_KEY_ID` | Key identifier for encryption | `dyad-gateway-encryption-key` |
| `ENCRYPTION_KEY` | Fallback encryption key (hex) | Required for environment provider |

### Key Rotation

| Variable | Description | Default |
|----------|-------------|---------|
| `KEY_ROTATION_ENABLED` | Enable automatic key rotation | `false` |
| `KEY_ROTATION_INTERVAL_HOURS` | Rotation interval in hours | `168` (1 week) |
| `KEY_ROTATION_SCHEDULE` | Custom cron schedule | Auto-generated |

### Caching

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRETS_CACHE_ENABLED` | Enable in-memory caching | `true` |
| `SECRETS_CACHE_TTL_SECONDS` | Cache TTL in seconds | `300` (5 minutes) |
| `SECRETS_CACHE_MAX_SIZE` | Maximum cache entries | `100` |

### Fallback

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRETS_FALLBACK_ENABLED` | Enable fallback mechanisms | `true` |
| `SECRETS_FALLBACK_TO_ENV` | Fallback to environment variables | `true` |

## Usage

### Provider Credential Management

When creating or updating providers, credentials are automatically stored in the configured secrets manager:

```javascript
// Create provider with credentials
const provider = await providerService.createProvider({
  name: 'OpenAI Provider',
  slug: 'openai-provider',
  type: 'http-sdk',
  credentials: {
    api_key: 'sk-...',
    organization: 'org-...'
  },
  // ... other config
});

// Credentials are stored externally, provider document contains placeholders
console.log(provider.credentials); // Map { 'api_key' => '[STORED_EXTERNALLY]' }
```

### Credential Rotation

Rotate provider credentials with zero downtime:

```javascript
// Rotate credentials
await providerService.rotateProviderCredentials('provider-id', {
  api_key: 'sk-new-key...',
  organization: 'org-...'
});
```

### Key Rotation

Perform encryption key rotation:

```javascript
// Manual rotation
const result = await keyRotationService.performRotation();

// Scheduled rotation (configured via environment)
// Runs automatically based on KEY_ROTATION_SCHEDULE
```

## Admin API Endpoints

### Secrets Manager Health

```http
GET /admin/secrets/health
Authorization: Bearer <admin-token>
```

Response:
```json
{
  "status": "success",
  "data": {
    "status": "healthy",
    "provider": "aws",
    "cacheEnabled": true,
    "cacheSize": 15,
    "lastChecked": "2024-01-15T10:30:00Z"
  }
}
```

### Test Connection

```http
POST /admin/secrets/test-connection
Authorization: Bearer <admin-token>
```

### Clear Cache

```http
POST /admin/secrets/clear-cache
Authorization: Bearer <admin-token>
```

### Key Rotation Status

```http
GET /admin/secrets/key-rotation/status
Authorization: Bearer <admin-token>
```

### Perform Key Rotation

```http
POST /admin/secrets/key-rotation/perform
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "force": false
}
```

### Toggle Automatic Rotation

```http
POST /admin/secrets/key-rotation/toggle
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "enabled": true
}
```

### Provider Credential Validation

```http
POST /admin/secrets/providers/{providerId}/credentials/validate
Authorization: Bearer <admin-token>
```

## Security Best Practices

### 1. Key Management

- **Use dedicated KMS keys**: Create separate keys for different environments
- **Enable key rotation**: Set up automatic key rotation policies
- **Monitor key usage**: Enable CloudTrail/audit logging for key operations
- **Backup keys**: Ensure key backup and recovery procedures

### 2. Access Control

- **Principle of least privilege**: Grant minimal required permissions
- **Use service accounts**: Avoid using personal credentials
- **Rotate access tokens**: Regularly rotate service account credentials
- **Network restrictions**: Limit access to secrets manager endpoints

### 3. Monitoring and Alerting

- **Monitor access patterns**: Alert on unusual secret access
- **Track rotation events**: Monitor key rotation success/failure
- **Cache metrics**: Monitor cache hit rates and performance
- **Error alerting**: Alert on secrets manager connectivity issues

### 4. Environment Separation

- **Separate secrets stores**: Use different vaults/accounts per environment
- **Environment-specific keys**: Use separate encryption keys per environment
- **Network isolation**: Isolate secrets manager access per environment

## Troubleshooting

### Common Issues

#### 1. Secrets Manager Connection Failed

**Symptoms:**
- Health check returns "unhealthy"
- Provider creation fails with credential storage errors

**Solutions:**
- Verify network connectivity to secrets manager
- Check authentication credentials
- Validate IAM/RBAC permissions
- Review firewall/security group rules

#### 2. Key Rotation Failures

**Symptoms:**
- Rotation status shows failed attempts
- Providers become unhealthy after rotation

**Solutions:**
- Check KMS key permissions
- Verify key rotation policies
- Review provider credential formats
- Check for concurrent rotation attempts

#### 3. Cache Performance Issues

**Symptoms:**
- High latency on credential retrieval
- Frequent cache misses

**Solutions:**
- Adjust cache TTL settings
- Increase cache size limits
- Monitor cache hit rates
- Consider cache warming strategies

### Debugging

Enable debug logging:
```bash
GATEWAY_LOG_LEVEL=debug
```

Check service health:
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3001/admin/secrets/health
```

Test connectivity:
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3001/admin/secrets/test-connection
```

## Migration Guide

### From Environment Variables

1. **Set up secrets manager**: Configure your chosen provider
2. **Migrate existing credentials**: Use the admin API to update providers
3. **Update configuration**: Change `SECRETS_PROVIDER` setting
4. **Test connectivity**: Verify all providers work correctly
5. **Remove environment credentials**: Clean up old environment variables

### Between Providers

1. **Set up new provider**: Configure the target secrets manager
2. **Export credentials**: Use admin API to validate current credentials
3. **Update configuration**: Change provider settings
4. **Restart service**: Allow new provider to initialize
5. **Verify migration**: Test all provider functionality

## Performance Considerations

### Caching Strategy

- **Cache TTL**: Balance security vs performance (default: 5 minutes)
- **Cache size**: Size based on number of providers (default: 100 entries)
- **Cache warming**: Pre-load frequently accessed credentials

### Network Optimization

- **Regional deployment**: Deploy close to secrets manager regions
- **Connection pooling**: Reuse connections to secrets managers
- **Retry policies**: Implement exponential backoff for failures

### Monitoring Metrics

- **Cache hit rate**: Target >90% for optimal performance
- **Retrieval latency**: Monitor p95/p99 latencies
- **Error rates**: Track secrets manager error rates
- **Rotation duration**: Monitor key rotation performance

## Compliance and Auditing

### Audit Logging

All secrets operations are logged with:
- User identity (for admin operations)
- Operation type (get, set, delete, rotate)
- Resource identifiers (provider ID, credential key)
- Timestamps and duration
- Success/failure status

### Compliance Features

- **Encryption at rest**: All secrets encrypted in external systems
- **Encryption in transit**: TLS for all communications
- **Access logging**: Complete audit trail of access
- **Key rotation**: Regular encryption key rotation
- **Separation of duties**: Admin-only access to secrets management

### Data Residency

- **Regional storage**: Secrets stored in specified regions
- **Cross-border controls**: Prevent data from crossing boundaries
- **Backup locations**: Control backup storage locations