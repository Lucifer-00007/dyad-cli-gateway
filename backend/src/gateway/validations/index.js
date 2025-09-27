/**
 * Gateway Validations Index
 * Exports all gateway validation modules
 */

const providerValidation = require('./provider.validation');
const apikeyValidation = require('./apikey.validation');
const circuitBreakerValidation = require('./circuit-breaker.validation');
const fallbackPolicyValidation = require('./fallback-policy.validation');
const securityValidation = require('./security.validation');

module.exports = {
  providerValidation,
  apikeyValidation,
  circuitBreakerValidation,
  fallbackPolicyValidation,
  securityValidation,
};