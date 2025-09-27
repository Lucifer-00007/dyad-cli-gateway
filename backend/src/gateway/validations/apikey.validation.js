const Joi = require('joi');

const rateLimitSchema = Joi.object({
  requestsPerMinute: Joi.number().integer().min(1).max(10000).default(60),
  requestsPerDay: Joi.number().integer().min(1).max(1000000).default(1000),
  tokensPerMinute: Joi.number().integer().min(1).max(1000000).default(10000),
  tokensPerDay: Joi.number().integer().min(1).max(10000000).default(100000),
});

const createApiKey = {
  body: Joi.object({
    name: Joi.string().required().trim().max(100),
    userId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
    permissions: Joi.array().items(
      Joi.string().valid('chat', 'embeddings', 'models', 'admin')
    ).min(1).default(['chat', 'models']),
    enabled: Joi.boolean().default(true),
    rateLimits: rateLimitSchema,
    allowedModels: Joi.array().items(Joi.string().trim()),
    allowedProviders: Joi.array().items(Joi.string().trim()),
    expiresAt: Joi.date().greater('now'),
    metadata: Joi.object(),
  }),
};

const updateApiKey = {
  params: Joi.object({
    apiKeyId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  }),
  body: Joi.object({
    name: Joi.string().trim().max(100),
    permissions: Joi.array().items(
      Joi.string().valid('chat', 'embeddings', 'models', 'admin')
    ).min(1),
    enabled: Joi.boolean(),
    rateLimits: rateLimitSchema,
    allowedModels: Joi.array().items(Joi.string().trim()),
    allowedProviders: Joi.array().items(Joi.string().trim()),
    expiresAt: Joi.date().greater('now').allow(null),
    metadata: Joi.object(),
  }).min(1),
};

const getApiKey = {
  params: Joi.object({
    apiKeyId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  }),
};

const deleteApiKey = {
  params: Joi.object({
    apiKeyId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  }),
};

const getApiKeys = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    enabled: Joi.string().valid('true', 'false'),
    userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    sortBy: Joi.string(),
  }),
};

const revokeApiKey = {
  params: Joi.object({
    apiKeyId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  }),
  body: Joi.object({
    reason: Joi.string().trim().max(500).default('Manual revocation'),
  }),
};

const regenerateApiKey = {
  params: Joi.object({
    apiKeyId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  }),
  body: Joi.object({
    reason: Joi.string().trim().max(500).default('Manual regeneration'),
  }),
};

module.exports = {
  createApiKey,
  updateApiKey,
  getApiKey,
  deleteApiKey,
  getApiKeys,
  revokeApiKey,
  regenerateApiKey,
};