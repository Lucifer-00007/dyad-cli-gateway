/**
 * Dyad CLI Gateway - Server Entry Point
 * Starts the gateway Express server with enhanced production features
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

// Graceful shutdown with enhanced cleanup
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Set a timeout for forced shutdown
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000); // 30 seconds timeout
  
  if (server) {
    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        // Clean up any running sandbox jobs (Kubernetes)
        if (process.env.GATEWAY_SANDBOX_TYPE === 'kubernetes') {
          await cleanupSandboxJobs();
        }
        
        // Close database connection
        await mongoose.connection.close(false);
        logger.info('MongoDB connection closed');
        
        // Clear the force shutdown timeout
        clearTimeout(forceShutdownTimeout);
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        clearTimeout(forceShutdownTimeout);
        process.exit(1);
      }
    });
  } else {
    clearTimeout(forceShutdownTimeout);
    process.exit(0);
  }
};

// Cleanup sandbox jobs on shutdown
const cleanupSandboxJobs = async () => {
  try {
    const KubernetesSandbox = require('./utils/k8s-sandbox');
    const k8sSandbox = new KubernetesSandbox();
    
    // This would ideally track active jobs and clean them up
    // For now, we'll just log the cleanup attempt
    logger.info('Cleaning up sandbox jobs...');
    
    // In a real implementation, you'd maintain a registry of active jobs
    // and clean them up here
    
  } catch (error) {
    logger.warn('Failed to cleanup sandbox jobs:', error.message);
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