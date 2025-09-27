/**
 * Dyad CLI Gateway - Main entry point
 * Exports the gateway app, service and configuration
 */

const app = require('./app');
const { startServer, gracefulShutdown } = require('./server');
const GatewayService = require('./services/gateway.service');
const gatewayConfig = require('./config/gateway.config');

module.exports = {
  app,
  startServer,
  gracefulShutdown,
  GatewayService,
  gatewayConfig,
};