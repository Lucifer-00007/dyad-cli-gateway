/**
 * Secrets Manager Configuration
 * Loads secrets manager settings from environment variables
 */

const Joi = require('joi');

const envVarsSchema = Joi.object()
  .keys({
    // Secrets Manager Provider
    SECRETS_PROVIDER: Joi.string().valid('aws', 'azure', 'vault', 'hashicorp', 'environment').default('environment'),
    
    // Encryption Key Configuration
    ENCRYPTION_KEY_ID: Joi.string().default('dyad-gateway-encryption-key'),
    ENCRYPTION_KEY: Joi.string().when('NODE_ENV', {
      is: 'test',
      then: Joi.string().default('test-key-for-testing-only'),
      otherwise: Joi.string().when('SECRETS_PROVIDER', {
        is: 'environment',
        then: Joi.string().required(),
        otherwise: Joi.string().optional(),
      }),
    }),
    
    // AWS Configuration
    AWS_REGION: Joi.string().default('us-east-1'),
    AWS_ACCESS_KEY_ID: Joi.string().optional(),
    AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
    AWS_KMS_KEY_ID: Joi.string().optional(),
    AWS_SECRETS_MANAGER_REGION: Joi.string().optional(),
    
    // Azure Configuration
    AZURE_KEY_VAULT_URL: Joi.string().uri().optional(),
    AZURE_CLIENT_ID: Joi.string().optional(),
    AZURE_CLIENT_SECRET: Joi.string().optional(),
    AZURE_TENANT_ID: Joi.string().optional(),
    
    // HashiCorp Vault Configuration
    VAULT_ADDR: Joi.string().uri().optional(),
    VAULT_TOKEN: Joi.string().optional(),
    VAULT_MOUNT_PATH: Joi.string().default('secret'),
    VAULT_NAMESPACE: Joi.string().optional(),
    
    // Key Rotation Configuration
    KEY_ROTATION_ENABLED: Joi.boolean().default(false),
    KEY_ROTATION_INTERVAL_HOURS: Joi.number().min(1).max(8760).default(168), // 1 week
    KEY_ROTATION_SCHEDULE: Joi.string().optional(), // Cron expression
    
    // Secrets Cache Configuration
    SECRETS_CACHE_ENABLED: Joi.boolean().default(true),
    SECRETS_CACHE_TTL_SECONDS: Joi.number().min(60).max(3600).default(300), // 5 minutes
    SECRETS_CACHE_MAX_SIZE: Joi.number().min(10).max(1000).default(100),
    
    // Fallback Configuration
    SECRETS_FALLBACK_ENABLED: Joi.boolean().default(true),
    SECRETS_FALLBACK_TO_ENV: Joi.boolean().default(true),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Secrets config validation error: ${error.message}`);
}

module.exports = {
  // Provider Configuration
  provider: envVars.SECRETS_PROVIDER,
  
  // Encryption Key Configuration
  encryptionKeyId: envVars.ENCRYPTION_KEY_ID,
  encryptionKey: envVars.ENCRYPTION_KEY,
  
  // AWS Configuration
  aws: {
    region: envVars.AWS_REGION,
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
    kmsKeyId: envVars.AWS_KMS_KEY_ID || envVars.ENCRYPTION_KEY_ID,
    secretsManagerRegion: envVars.AWS_SECRETS_MANAGER_REGION || envVars.AWS_REGION,
  },
  
  // Azure Configuration
  azure: {
    vaultUrl: envVars.AZURE_KEY_VAULT_URL,
    clientId: envVars.AZURE_CLIENT_ID,
    clientSecret: envVars.AZURE_CLIENT_SECRET,
    tenantId: envVars.AZURE_TENANT_ID,
  },
  
  // HashiCorp Vault Configuration
  vault: {
    url: envVars.VAULT_ADDR,
    token: envVars.VAULT_TOKEN,
    mountPath: envVars.VAULT_MOUNT_PATH,
    namespace: envVars.VAULT_NAMESPACE,
  },
  
  // Key Rotation Configuration
  keyRotation: {
    enabled: envVars.KEY_ROTATION_ENABLED,
    intervalHours: envVars.KEY_ROTATION_INTERVAL_HOURS,
    schedule: envVars.KEY_ROTATION_SCHEDULE,
  },
  
  // Secrets Cache Configuration
  cache: {
    enabled: envVars.SECRETS_CACHE_ENABLED,
    ttlSeconds: envVars.SECRETS_CACHE_TTL_SECONDS,
    maxSize: envVars.SECRETS_CACHE_MAX_SIZE,
  },
  
  // Fallback Configuration
  fallback: {
    enabled: envVars.SECRETS_FALLBACK_ENABLED,
    toEnvironment: envVars.SECRETS_FALLBACK_TO_ENV,
  },
};