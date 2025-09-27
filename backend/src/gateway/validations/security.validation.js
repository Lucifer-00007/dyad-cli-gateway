/**
 * Security-focused validation schemas
 * Comprehensive input validation for security hardening
 */

const Joi = require('joi');

/**
 * Common security validation patterns
 */
const securityPatterns = {
  // Safe string pattern (alphanumeric, spaces, basic punctuation)
  safeString: /^[a-zA-Z0-9\s\-_.,!?()[\]{}:;"'@#$%^&*+=|\\/<>~`]*$/,
  
  // Model name pattern (letters, numbers, hyphens, dots)
  modelName: /^[a-zA-Z0-9\-_.]+$/,
  
  // Provider slug pattern (lowercase letters, numbers, hyphens)
  providerSlug: /^[a-z0-9\-]+$/,
  
  // API key pattern (base64-like characters)
  apiKey: /^[a-zA-Z0-9+/=\-_]+$/,
  
  // URL pattern (basic URL validation)
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
  
  // Command pattern (no shell metacharacters)
  command: /^[a-zA-Z0-9\-_./]+$/,
  
  // Docker image pattern
  dockerImage: /^[a-z0-9]+(([._]|__|-+)[a-z0-9]+)*(\/[a-z0-9]+(([._]|__|-+)[a-z0-9]+)*)*(:[\w][\w.-]{0,127})?$/,
};

/**
 * Custom validation functions
 */
const customValidations = {
  /**
   * Validate that string doesn't contain SQL injection patterns
   */
  noSqlInjection: (value, helpers) => {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(--|\/\*|\*\/|;)/,
      /(\b(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS)\b)/i,
      /(CAST\s*\(|CONVERT\s*\()/i
    ];
    
    if (sqlPatterns.some(pattern => pattern.test(value))) {
      return helpers.error('string.sqlInjection');
    }
    
    return value;
  },

  /**
   * Validate that string doesn't contain XSS patterns
   */
  noXss: (value, helpers) => {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe\b/i,
      /<object\b/i,
      /<embed\b/i,
      /<link\b/i,
      /<meta\b/i
    ];
    
    if (xssPatterns.some(pattern => pattern.test(value))) {
      return helpers.error('string.xss');
    }
    
    return value;
  },

  /**
   * Validate that string doesn't contain command injection patterns
   */
  noCommandInjection: (value, helpers) => {
    const commandPatterns = [
      /[;&|`$(){}[\]\\]/,
      /\.\./,
      /\/etc\/passwd/i,
      /\/proc\//i,
      /\$\{/,
      /\$\(/
    ];
    
    if (commandPatterns.some(pattern => pattern.test(value))) {
      return helpers.error('string.commandInjection');
    }
    
    return value;
  },

  /**
   * Validate reasonable string length
   */
  reasonableLength: (maxLength = 1000) => (value, helpers) => {
    if (value.length > maxLength) {
      return helpers.error('string.tooLong', { limit: maxLength });
    }
    return value;
  },

  /**
   * Validate that object doesn't have too many properties (DoS protection)
   */
  limitedProperties: (maxProps = 100) => (value, helpers) => {
    if (typeof value === 'object' && value !== null) {
      const propCount = Object.keys(value).length;
      if (propCount > maxProps) {
        return helpers.error('object.tooManyProperties', { limit: maxProps });
      }
    }
    return value;
  },

  /**
   * Validate array size (DoS protection)
   */
  limitedArray: (maxItems = 100) => (value, helpers) => {
    if (Array.isArray(value) && value.length > maxItems) {
      return helpers.error('array.tooManyItems', { limit: maxItems });
    }
    return value;
  }
};

/**
 * Extend Joi with custom validation messages
 */
const joi = Joi.extend({
  type: 'string',
  base: Joi.string(),
  messages: {
    'string.sqlInjection': 'String contains potential SQL injection patterns',
    'string.xss': 'String contains potential XSS patterns',
    'string.commandInjection': 'String contains potential command injection patterns',
    'string.tooLong': 'String exceeds maximum length of {{#limit}} characters'
  }
}, {
  type: 'object',
  base: Joi.object(),
  messages: {
    'object.tooManyProperties': 'Object has too many properties (limit: {{#limit}})'
  }
}, {
  type: 'array',
  base: Joi.array(),
  messages: {
    'array.tooManyItems': 'Array has too many items (limit: {{#limit}})'
  }
});

/**
 * Base schemas for common data types
 */
const baseSchemas = {
  // Safe text input (user-provided content)
  safeText: joi.string()
    .max(10000)
    .custom(customValidations.noSqlInjection)
    .custom(customValidations.noXss)
    .custom(customValidations.noCommandInjection),

  // Short safe text (names, titles, etc.)
  shortSafeText: joi.string()
    .max(255)
    .custom(customValidations.noSqlInjection)
    .custom(customValidations.noXss)
    .custom(customValidations.noCommandInjection),

  // Model name validation
  modelName: joi.string()
    .pattern(securityPatterns.modelName)
    .max(100)
    .custom(customValidations.noSqlInjection),

  // Provider slug validation
  providerSlug: joi.string()
    .pattern(securityPatterns.providerSlug)
    .max(50)
    .custom(customValidations.noSqlInjection),

  // API key validation
  apiKey: joi.string()
    .pattern(securityPatterns.apiKey)
    .min(20)
    .max(200),

  // URL validation
  url: joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(2000),

  // Command validation
  command: joi.string()
    .pattern(securityPatterns.command)
    .max(500)
    .custom(customValidations.noCommandInjection),

  // Docker image validation
  dockerImage: joi.string()
    .pattern(securityPatterns.dockerImage)
    .max(255),

  // Limited object (DoS protection)
  limitedObject: joi.object()
    .custom(customValidations.limitedProperties(50))
    .max(50),

  // Limited array (DoS protection)
  limitedArray: joi.array()
    .custom(customValidations.limitedArray(100))
    .max(100),

  // Positive integer with reasonable limits
  positiveInt: joi.number()
    .integer()
    .positive()
    .max(2147483647), // Max 32-bit signed integer

  // Memory limit validation
  memoryLimit: joi.string()
    .pattern(/^\d+[kmg]?$/i)
    .max(20),

  // CPU limit validation
  cpuLimit: joi.string()
    .pattern(/^\d*\.?\d+$/)
    .max(10),

  // Timeout validation (reasonable limits)
  timeout: joi.number()
    .integer()
    .min(1000) // Minimum 1 second
    .max(300000) // Maximum 5 minutes
};

/**
 * Chat completion request validation
 */
const chatCompletionRequest = joi.object({
  model: baseSchemas.modelName.required(),
  messages: joi.array()
    .items(
      joi.object({
        role: joi.string().valid('system', 'user', 'assistant').required(),
        content: baseSchemas.safeText.required(),
        name: baseSchemas.shortSafeText.optional()
      })
    )
    .min(1)
    .max(50) // Reasonable conversation length
    .required(),
  max_tokens: joi.number().integer().min(1).max(32000).optional(),
  temperature: joi.number().min(0).max(2).optional(),
  top_p: joi.number().min(0).max(1).optional(),
  n: joi.number().integer().min(1).max(10).optional(),
  stream: joi.boolean().optional(),
  stop: joi.alternatives().try(
    baseSchemas.shortSafeText,
    joi.array().items(baseSchemas.shortSafeText).max(4)
  ).optional(),
  presence_penalty: joi.number().min(-2).max(2).optional(),
  frequency_penalty: joi.number().min(-2).max(2).optional(),
  logit_bias: joi.object().pattern(
    joi.string().pattern(/^\d+$/),
    joi.number().min(-100).max(100)
  ).max(300).optional(), // Limit logit bias entries
  user: baseSchemas.shortSafeText.optional()
}).custom(customValidations.limitedProperties(20));

/**
 * Embeddings request validation
 */
const embeddingsRequest = joi.object({
  model: baseSchemas.modelName.required(),
  input: joi.alternatives().try(
    baseSchemas.safeText,
    joi.array().items(baseSchemas.safeText).max(100)
  ).required(),
  user: baseSchemas.shortSafeText.optional()
}).custom(customValidations.limitedProperties(10));

/**
 * Provider configuration validation
 */
const providerConfig = joi.object({
  name: baseSchemas.shortSafeText.required(),
  slug: baseSchemas.providerSlug.required(),
  type: joi.string().valid('spawn-cli', 'http-sdk', 'proxy', 'local').required(),
  enabled: joi.boolean().default(true),
  models: joi.array()
    .items(
      joi.object({
        dyadModelId: baseSchemas.modelName.required(),
        adapterModelId: baseSchemas.modelName.required(),
        maxTokens: baseSchemas.positiveInt.max(100000).optional(),
        contextWindow: baseSchemas.positiveInt.max(1000000).optional(),
        supportsStreaming: joi.boolean().default(false),
        supportsEmbeddings: joi.boolean().default(false)
      })
    )
    .min(1)
    .max(50)
    .required(),
  adapterConfig: joi.object({
    // Spawn-CLI specific
    command: baseSchemas.command.when('...type', { is: 'spawn-cli', then: joi.required() }),
    args: joi.array().items(baseSchemas.shortSafeText).max(20).optional(),
    dockerSandbox: joi.boolean().default(true),
    sandboxImage: baseSchemas.dockerImage.optional(),
    timeoutSeconds: joi.number().integer().min(1).max(300).optional(),
    memoryLimit: baseSchemas.memoryLimit.optional(),
    cpuLimit: baseSchemas.cpuLimit.optional(),
    
    // HTTP-SDK specific
    baseUrl: baseSchemas.url.when('...type', { is: 'http-sdk', then: joi.required() }),
    headers: baseSchemas.limitedObject.optional(),
    retryAttempts: joi.number().integer().min(0).max(10).optional(),
    timeoutMs: baseSchemas.timeout.optional(),
    
    // Proxy specific
    proxyUrl: baseSchemas.url.when('...type', { is: 'proxy', then: joi.required() }),
    
    // Local specific
    localUrl: baseSchemas.url.when('...type', { is: 'local', then: joi.required() }),
    healthCheckPath: baseSchemas.shortSafeText.optional()
  }).required(),
  credentials: baseSchemas.limitedObject.optional(),
  rateLimits: joi.object({
    requestsPerMinute: baseSchemas.positiveInt.max(10000).optional(),
    tokensPerMinute: baseSchemas.positiveInt.max(1000000).optional()
  }).optional(),
  fallbackProviders: joi.array()
    .items(baseSchemas.providerSlug)
    .max(5)
    .optional()
}).custom(customValidations.limitedProperties(20));

/**
 * API key creation validation
 */
const apiKeyCreate = joi.object({
  name: baseSchemas.shortSafeText.required(),
  description: baseSchemas.safeText.optional(),
  rateLimits: joi.object({
    requestsPerDay: baseSchemas.positiveInt.max(1000000).default(10000),
    tokensPerDay: baseSchemas.positiveInt.max(10000000).default(1000000),
    requestsPerMinute: baseSchemas.positiveInt.max(1000).default(100)
  }).optional(),
  expiresAt: joi.date().greater('now').optional(),
  permissions: joi.array()
    .items(joi.string().valid('chat', 'embeddings', 'models'))
    .max(10)
    .default(['chat', 'embeddings', 'models'])
}).custom(customValidations.limitedProperties(10));

module.exports = {
  securityPatterns,
  customValidations,
  baseSchemas,
  chatCompletionRequest,
  embeddingsRequest,
  providerConfig,
  apiKeyCreate,
  joi
};