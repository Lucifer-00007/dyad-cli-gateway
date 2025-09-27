const Joi = require('joi');

const modelMappingSchema = Joi.object({
  dyadModelId: Joi.string().required().trim(),
  adapterModelId: Joi.string().required().trim(),
  maxTokens: Joi.number().integer().min(1).max(1000000),
  contextWindow: Joi.number().integer().min(1).max(1000000),
  supportsStreaming: Joi.boolean().default(false),
  supportsEmbeddings: Joi.boolean().default(false),
});

const adapterConfigSchema = Joi.object({
  // Common fields
  timeoutSeconds: Joi.number().integer().min(1).max(3600).default(60),
  retryAttempts: Joi.number().integer().min(0).max(10).default(3),
  
  // Spawn-CLI specific
  command: Joi.string().trim(),
  args: Joi.array().items(Joi.string().trim()),
  dockerSandbox: Joi.boolean().default(true),
  sandboxImage: Joi.string().trim(),
  memoryLimit: Joi.string().pattern(/^\d+[kmg]?$/i).default('512m'),
  cpuLimit: Joi.string().pattern(/^\d*\.?\d+$/).default('0.5'),
  
  // HTTP-SDK, Proxy, and Local adapter specific
  baseUrl: Joi.string().uri(),
  chatEndpoint: Joi.string().trim().default('/v1/chat/completions'),
  embeddingsEndpoint: Joi.string().trim(),
  modelsEndpoint: Joi.string().trim(),
  timeoutMs: Joi.number().integer().min(1000).max(300000).default(30000),
  retryBaseDelay: Joi.number().integer().min(100).max(10000).default(1000),
  retryMaxDelay: Joi.number().integer().min(1000).max(60000).default(10000),
  retryableStatusCodes: Joi.array().items(Joi.number().integer().min(400).max(599)),
  apiKeyHeader: Joi.string().trim().default('X-API-Key'),
  supportsStreaming: Joi.boolean().default(false),
  headers: Joi.object().pattern(Joi.string(), Joi.string()),
  requestTransform: Joi.function(),
  responseTransform: Joi.function(),
  embeddingsRequestTransform: Joi.function(),
  embeddingsResponseTransform: Joi.function(),
  
  // Default models
  defaultModel: Joi.string().trim(),
  defaultEmbeddingModel: Joi.string().trim(),
  
  // Service type for local adapters
  serviceType: Joi.string().trim(),
  
  // Health check configuration
  healthEndpoint: Joi.string().trim(),
  healthCheckIntervalMs: Joi.number().integer().min(1000).max(3600000),
  healthCheckTimeoutMs: Joi.number().integer().min(1000).max(60000),
  healthRetryAttempts: Joi.number().integer().min(1).max(10),
  
  // Remote access flag for local adapters
  allowRemote: Joi.boolean().default(false),
  
  // Header rewriting for proxy adapters
  headerRewrites: Joi.object().pattern(Joi.string(), Joi.string()),
  removeHeaders: Joi.array().items(Joi.string().trim()),
});

const createProvider = {
  body: Joi.object({
    name: Joi.string().required().trim().max(100),
    slug: Joi.string().required().trim().lowercase().max(50).pattern(/^[a-z0-9-]+$/),
    type: Joi.string().required().valid('spawn-cli', 'http-sdk', 'proxy', 'local'),
    description: Joi.string().trim().max(500),
    enabled: Joi.boolean().default(true),
    models: Joi.array().items(modelMappingSchema).min(1).required(),
    adapterConfig: adapterConfigSchema.required(),
    credentials: Joi.object().pattern(Joi.string(), Joi.string()),
    rateLimits: Joi.object({
      requestsPerMinute: Joi.number().integer().min(1).max(10000).default(60),
      tokensPerMinute: Joi.number().integer().min(1).max(1000000).default(10000),
    }),
    metadata: Joi.object(),
  }),
};

const updateProvider = {
  params: Joi.object({
    providerId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  }),
  body: Joi.object({
    name: Joi.string().trim().max(100),
    slug: Joi.string().trim().lowercase().max(50).pattern(/^[a-z0-9-]+$/),
    type: Joi.string().valid('spawn-cli', 'http-sdk', 'proxy', 'local'),
    description: Joi.string().trim().max(500),
    enabled: Joi.boolean(),
    models: Joi.array().items(modelMappingSchema).min(1),
    adapterConfig: adapterConfigSchema,
    credentials: Joi.object().pattern(Joi.string(), Joi.string()),
    rateLimits: Joi.object({
      requestsPerMinute: Joi.number().integer().min(1).max(10000),
      tokensPerMinute: Joi.number().integer().min(1).max(1000000),
    }),
    metadata: Joi.object(),
  }).min(1),
};

const getProvider = {
  params: Joi.object({
    providerId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  }),
};

const deleteProvider = {
  params: Joi.object({
    providerId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  }),
};

const getProviders = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    enabled: Joi.string().valid('true', 'false'),
    type: Joi.string().valid('spawn-cli', 'http-sdk', 'proxy', 'local'),
    sortBy: Joi.string(),
  }),
};

const testProvider = {
  params: Joi.object({
    providerId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  }),
  body: Joi.object({
    dryRun: Joi.boolean().default(false),
  }),
};

const checkProviderHealth = {
  params: Joi.object({
    providerId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  }),
};

module.exports = {
  createProvider,
  updateProvider,
  getProvider,
  deleteProvider,
  getProviders,
  testProvider,
  checkProviderHealth,
};