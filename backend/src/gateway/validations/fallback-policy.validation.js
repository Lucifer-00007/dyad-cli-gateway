/**
 * Fallback Policy Validation Schemas
 */

const Joi = require('joi');
const { objectId } = require('../../validations/custom.validation');

const fallbackStrategies = ['none', 'round_robin', 'priority', 'random', 'health_based'];

const configureFallbackPolicy = {
  params: Joi.object().keys({
    modelId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    strategy: Joi.string().valid(...fallbackStrategies).required(),
    providers: Joi.array().items(Joi.string().custom(objectId)).optional(),
    maxAttempts: Joi.number().integer().min(1).max(10).optional(),
    enabled: Joi.boolean().optional(),
    retryDelay: Joi.number().integer().min(0).max(10000).optional(),
  }),
};

const getFallbackPolicy = {
  params: Joi.object().keys({
    modelId: Joi.string().required(),
  }),
};

const removeFallbackPolicy = {
  params: Joi.object().keys({
    modelId: Joi.string().required(),
  }),
};

const setProviderPriorities = {
  body: Joi.object().pattern(
    Joi.string().custom(objectId),
    Joi.number().integer().min(0).max(999)
  ).required(),
};

module.exports = {
  configureFallbackPolicy,
  getFallbackPolicy,
  removeFallbackPolicy,
  setProviderPriorities,
};