/**
 * Dyad CLI Gateway - Main entry point
 * Exports the gateway service and configuration
 */

const GatewayService = require('./services/gateway.service');
const gatewayConfig = require('./config/gateway.config');

module.exports = {
  GatewayService,
  gatewayConfig,
};