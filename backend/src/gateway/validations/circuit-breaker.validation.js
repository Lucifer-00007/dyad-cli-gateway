/**
 * Circuit Breaker Validation Schemas
 */

const Joi = require('joi');
const { objectId } = require('../../validations/custom.validation');

const getProviderCircuitBreakerStatus = {
  params: Joi.object().keys({
    providerId: Joi.string().custom(objectId).required(),
  }),
};

const resetCircuitBreaker = {
  params: Joi.object().keys({
    providerId: Joi.string().custom(objectId).required(),
  }),
};

const openCircuitBreaker = {
  params: Joi.object().keys({
    providerId: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  getProviderCircuitBreakerStatus,
  resetCircuitBreaker,
  openCircuitBreaker,
};