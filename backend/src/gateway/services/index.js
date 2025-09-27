/**
 * Gateway Services Index
 * Exports all gateway service modules
 */

const GatewayService = require('./gateway.service');
const OpenAINormalizer = require('./openai.normalizer');

module.exports = {
  GatewayService,
  OpenAINormalizer,
};