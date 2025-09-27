/**
 * Security Configuration
 * Centralized security settings and policies
 */

const Joi = require('joi');

const envVarsSchema = Joi.object()
  .keys({
    // HTTPS Enforcement
    SECURITY_HTTPS_REQUIRED: Joi.boolean().default(true),
    SECURITY_HSTS_MAX_AGE: Joi.number().default(31536000), // 1 year
    
    // Rate Limiting
    SECURITY_RATE_LIMIT_WINDOW: Joi.number().default(900000), // 15 minutes
    SECURITY_RATE_LIMIT_MAX: Joi.number().default(1000),
    SECURITY_SLOWDOWN_DELAY_AFTER: Joi.number().default(500),
    SECURITY_SLOWDOWN_DELAY_MS: Joi.number().default(100),
    SECURITY_SLOWDOWN_MAX_DELAY: Joi.number().default(5000),
    
    // DDoS Protection
    SECURITY_DDOS_ENABLED: Joi.boolean().default(true),
    SECURITY_DDOS_RAPID_REQUESTS_THRESHOLD: Joi.number().default(100),
    SECURITY_DDOS_UNIQUE_PATHS_THRESHOLD: Joi.number().default(50),
    SECURITY_DDOS_BLOCK_DURATION: Joi.number().default(3600000), // 1 hour
    
    // Input Validation
    SECURITY_MAX_REQUEST_SIZE: Joi.number().default(10485760), // 10MB
    SECURITY_MAX_CONTENT_LENGTH: Joi.number().default(52428800), // 50MB
    SECURITY_MAX_OBJECT_DEPTH: Joi.number().default(10),
    SECURITY_MAX_OBJECT_PROPERTIES: Joi.number().default(100),
    SECURITY_MAX_ARRAY_LENGTH: Joi.number().default(1000),
    
    // Content Security Policy
    SECURITY_CSP_ENABLED: Joi.boolean().default(true),
    SECURITY_CSP_REPORT_URI: Joi.string().optional(),
    
    // Security Headers
    SECURITY_HEADERS_ENABLED: Joi.boolean().default(true),
    SECURITY_FRAME_OPTIONS: Joi.string().valid('DENY', 'SAMEORIGIN').default('DENY'),
    SECURITY_CONTENT_TYPE_OPTIONS: Joi.boolean().default(true),
    SECURITY_XSS_PROTECTION: Joi.boolean().default(true),
    
    // Logging
    SECURITY_LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('warn'),
    SECURITY_LOG_FAILED_ATTEMPTS: Joi.boolean().default(true),
    SECURITY_LOG_SUSPICIOUS_ACTIVITY: Joi.boolean().default(true),
    
    // Monitoring
    SECURITY_MONITORING_ENABLED: Joi.boolean().default(true),
    SECURITY_ALERT_WEBHOOK: Joi.string().uri().optional(),
    SECURITY_ALERT_EMAIL: Joi.string().email().optional(),
    
    // Vulnerability Scanning
    SECURITY_VULN_SCAN_ENABLED: Joi.boolean().default(true),
    SECURITY_VULN_SCAN_SCHEDULE: Joi.string().default('0 2 * * *'), // Daily at 2 AM
    SECURITY_VULN_SCAN_SEVERITY_THRESHOLD: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    
    // Container Security
    SECURITY_CONTAINER_SCAN_ENABLED: Joi.boolean().default(true),
    SECURITY_CONTAINER_READONLY_ROOT: Joi.boolean().default(true),
    SECURITY_CONTAINER_NO_NEW_PRIVILEGES: Joi.boolean().default(true),
    SECURITY_CONTAINER_DROP_CAPABILITIES: Joi.string().default('ALL'),
    SECURITY_CONTAINER_USER_ID: Joi.number().default(1001),
    
    // API Security
    SECURITY_API_KEY_MIN_LENGTH: Joi.number().default(32),
    SECURITY_API_KEY_ROTATION_DAYS: Joi.number().default(90),
    SECURITY_JWT_EXPIRY: Joi.string().default('24h'),
    SECURITY_BCRYPT_ROUNDS: Joi.number().default(12),
    
    // Audit Logging
    SECURITY_AUDIT_ENABLED: Joi.boolean().default(true),
    SECURITY_AUDIT_RETENTION_DAYS: Joi.number().default(365),
    SECURITY_AUDIT_LOG_REQUESTS: Joi.boolean().default(true),
    SECURITY_AUDIT_LOG_RESPONSES: Joi.boolean().default(false),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Security config validation error: ${error.message}`);
}

module.exports = {
  // HTTPS Configuration
  https: {
    required: envVars.SECURITY_HTTPS_REQUIRED,
    hstsMaxAge: envVars.SECURITY_HSTS_MAX_AGE,
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: envVars.SECURITY_RATE_LIMIT_WINDOW,
    max: envVars.SECURITY_RATE_LIMIT_MAX,
    slowdown: {
      delayAfter: envVars.SECURITY_SLOWDOWN_DELAY_AFTER,
      delayMs: envVars.SECURITY_SLOWDOWN_DELAY_MS,
      maxDelayMs: envVars.SECURITY_SLOWDOWN_MAX_DELAY,
    },
  },

  // DDoS Protection Configuration
  ddos: {
    enabled: envVars.SECURITY_DDOS_ENABLED,
    rapidRequestsThreshold: envVars.SECURITY_DDOS_RAPID_REQUESTS_THRESHOLD,
    uniquePathsThreshold: envVars.SECURITY_DDOS_UNIQUE_PATHS_THRESHOLD,
    blockDuration: envVars.SECURITY_DDOS_BLOCK_DURATION,
  },

  // Input Validation Configuration
  validation: {
    maxRequestSize: envVars.SECURITY_MAX_REQUEST_SIZE,
    maxContentLength: envVars.SECURITY_MAX_CONTENT_LENGTH,
    maxObjectDepth: envVars.SECURITY_MAX_OBJECT_DEPTH,
    maxObjectProperties: envVars.SECURITY_MAX_OBJECT_PROPERTIES,
    maxArrayLength: envVars.SECURITY_MAX_ARRAY_LENGTH,
  },

  // Content Security Policy Configuration
  csp: {
    enabled: envVars.SECURITY_CSP_ENABLED,
    reportUri: envVars.SECURITY_CSP_REPORT_URI,
  },

  // Security Headers Configuration
  headers: {
    enabled: envVars.SECURITY_HEADERS_ENABLED,
    frameOptions: envVars.SECURITY_FRAME_OPTIONS,
    contentTypeOptions: envVars.SECURITY_CONTENT_TYPE_OPTIONS,
    xssProtection: envVars.SECURITY_XSS_PROTECTION,
  },

  // Logging Configuration
  logging: {
    level: envVars.SECURITY_LOG_LEVEL,
    logFailedAttempts: envVars.SECURITY_LOG_FAILED_ATTEMPTS,
    logSuspiciousActivity: envVars.SECURITY_LOG_SUSPICIOUS_ACTIVITY,
  },

  // Monitoring Configuration
  monitoring: {
    enabled: envVars.SECURITY_MONITORING_ENABLED,
    alertWebhook: envVars.SECURITY_ALERT_WEBHOOK,
    alertEmail: envVars.SECURITY_ALERT_EMAIL,
  },

  // Vulnerability Scanning Configuration
  vulnerabilityScanning: {
    enabled: envVars.SECURITY_VULN_SCAN_ENABLED,
    schedule: envVars.SECURITY_VULN_SCAN_SCHEDULE,
    severityThreshold: envVars.SECURITY_VULN_SCAN_SEVERITY_THRESHOLD,
  },

  // Container Security Configuration
  container: {
    scanEnabled: envVars.SECURITY_CONTAINER_SCAN_ENABLED,
    readonlyRoot: envVars.SECURITY_CONTAINER_READONLY_ROOT,
    noNewPrivileges: envVars.SECURITY_CONTAINER_NO_NEW_PRIVILEGES,
    dropCapabilities: envVars.SECURITY_CONTAINER_DROP_CAPABILITIES,
    userId: envVars.SECURITY_CONTAINER_USER_ID,
  },

  // API Security Configuration
  api: {
    keyMinLength: envVars.SECURITY_API_KEY_MIN_LENGTH,
    keyRotationDays: envVars.SECURITY_API_KEY_ROTATION_DAYS,
    jwtExpiry: envVars.SECURITY_JWT_EXPIRY,
    bcryptRounds: envVars.SECURITY_BCRYPT_ROUNDS,
  },

  // Audit Logging Configuration
  audit: {
    enabled: envVars.SECURITY_AUDIT_ENABLED,
    retentionDays: envVars.SECURITY_AUDIT_RETENTION_DAYS,
    logRequests: envVars.SECURITY_AUDIT_LOG_REQUESTS,
    logResponses: envVars.SECURITY_AUDIT_LOG_RESPONSES,
  },

  // Security Policies
  policies: {
    // Blocked user agents (security scanners, bots)
    blockedUserAgents: [
      /sqlmap/i,
      /nikto/i,
      /nessus/i,
      /masscan/i,
      /nmap/i,
      /gobuster/i,
      /dirb/i,
      /dirbuster/i,
      /burpsuite/i,
      /owasp/i,
      /acunetix/i,
      /appscan/i,
      /w3af/i,
      /skipfish/i,
      /wpscan/i,
      /nuclei/i,
    ],

    // Blocked file extensions
    blockedExtensions: [
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
      '.sh', '.py', '.pl', '.php', '.asp', '.aspx', '.jsp', '.war'
    ],

    // Suspicious patterns in requests
    suspiciousPatterns: {
      sql: [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
        /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
        /(--|\/\*|\*\/|;)/,
        /(\b(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS)\b)/i,
        /(CAST\s*\(|CONVERT\s*\()/i
      ],
      xss: [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe\b/i,
        /<object\b/i,
        /<embed\b/i,
        /<link\b/i,
        /<meta\b/i
      ],
      lfi: [
        /\.\.[\/\\]/,
        /\/etc\/passwd/i,
        /\/proc\//i,
        /\/var\/log/i,
        /\/windows\/system32/i
      ],
      rce: [
        /[;&|`$(){}[\]\\]/,
        /\$\{/,
        /\$\(/,
        /\|\s*(nc|netcat|telnet|wget|curl)/i
      ]
    },

    // Rate limiting tiers
    rateLimitTiers: {
      free: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
      },
      premium: {
        requestsPerMinute: 300,
        requestsPerHour: 10000,
        requestsPerDay: 100000,
      },
      enterprise: {
        requestsPerMinute: 1000,
        requestsPerHour: 50000,
        requestsPerDay: 1000000,
      }
    }
  }
};