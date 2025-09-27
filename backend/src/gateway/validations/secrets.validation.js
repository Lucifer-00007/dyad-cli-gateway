/**
 * Secrets Management Validation Schemas
 */

const Joi = require('joi');

const performKeyRotation = {
  body: Joi.object().keys({
    force: Joi.boolean().default(false),
  }),
};

const toggleKeyRotation = {
  body: Joi.object().keys({
    enabled: Joi.boolean().required(),
  }),
};

const providerParams = {
  params: Joi.object().keys({
    providerId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message('Provider ID must be a valid MongoDB ObjectId'),
  }),
};

module.exports = {
  performKeyRotation,
  toggleKeyRotation,
  providerParams,
};