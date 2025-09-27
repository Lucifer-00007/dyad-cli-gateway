/**
 * Dyad CLI Gateway - Server Entry Point
 * Starts the gateway Express server
 */

const mongoose = require('mongoose');
const app = require('./app');
const config = require('../config/config');
const gatewayConfig = require('./config/gateway.config');
const logger = require('../config/logger');

let server;

// Connect to MongoDB if not in test environment
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
    logger.info('Connected to MongoDB');
  });
}

// Start the server
const startServer = () => {
  server = app.listen(gatewayConfig.port, () => {
    logger.info(`Dyad CLI Gateway listening on port ${gatewayConfig.port}`);
    logger.info(`Health check available at http://localhost:${gatewayConfig.port}/health`);
    logger.info(`API endpoints available at http://localhost:${gatewayConfig.port}${gatewayConfig.apiPrefix}`);
  });
};

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      
      // Close database connection
      mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed');
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, gracefulShutdown };