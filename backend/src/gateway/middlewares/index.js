/**
 * Gateway Middlewares Index
 * Exports all gateway middleware modules
 */

const apiKeyAuth = require('./apiKeyAuth');
const requestLogger = require('./requestLogger');
const { gatewayRateLimit, apiKeyRateLimit } = require('./gatewayRateLimit');
const { errorConverter, errorHandler } = require('./errorHandler');

module.exports = {
  apiKeyAuth,
  requestLogger,
  gatewayRateLimit,
  apiKeyRateLimit,
  errorConverter,
  errorHandler,
};