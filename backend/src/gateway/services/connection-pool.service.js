/**
 * Connection Pool Service
 * Manages HTTP connection pooling for better performance
 */

const http = require('http');
const https = require('https');
const logger = require('../../config/logger');

class ConnectionPoolService {
  constructor(options = {}) {
    this.options = {
      maxSockets: options.maxSockets || 50,
      maxFreeSockets: options.maxFreeSockets || 10,
      timeout: options.timeout || 30000,
      keepAlive: options.keepAlive !== false,
      keepAliveMsecs: options.keepAliveMsecs || 1000,
      maxTotalSockets: options.maxTotalSockets || 100,
      ...options
    };

    this.httpAgent = new http.Agent({
      keepAlive: this.options.keepAlive,
      keepAliveMsecs: this.options.keepAliveMsecs,
      maxSockets: this.options.maxSockets,
      maxFreeSockets: this.options.maxFreeSockets,
      timeout: this.options.timeout,
      maxTotalSockets: this.options.maxTotalSockets,
    });

    this.httpsAgent = new https.Agent({
      keepAlive: this.options.keepAlive,
      keepAliveMsecs: this.options.keepAliveMsecs,
      maxSockets: this.options.maxSockets,
      maxFreeSockets: this.options.maxFreeSockets,
      timeout: this.options.timeout,
      maxTotalSockets: this.options.maxTotalSockets,
    });

    this.stats = {
      activeConnections: 0,
      totalRequests: 0,
      poolHits: 0,
      poolMisses: 0,
      errors: 0,
      timeouts: 0
    };

    logger.info('Connection pool service initialized', {
      maxSockets: this.options.maxSockets,
      maxFreeSockets: this.options.maxFreeSockets,
      keepAlive: this.options.keepAlive
    });
  }

  /**
   * Get HTTP agent for requests
   * @param {boolean} isHttps - Whether to use HTTPS agent
   * @returns {http.Agent|https.Agent}
   */
  getAgent(isHttps = false) {
    this.stats.totalRequests++;
    
    const agent = isHttps ? this.httpsAgent : this.httpAgent;
    
    // Track pool usage
    const sockets = agent.sockets;
    const freeSockets = agent.freeSockets;
    
    let activeCount = 0;
    let freeCount = 0;
    
    Object.values(sockets).forEach(socketArray => {
      activeCount += socketArray.length;
    });
    
    Object.values(freeSockets).forEach(socketArray => {
      freeCount += socketArray.length;
    });
    
    this.stats.activeConnections = activeCount;
    
    if (freeCount > 0) {
      this.stats.poolHits++;
    } else {
      this.stats.poolMisses++;
    }
    
    return agent;
  }

  /**
   * Get connection pool statistics
   * @returns {Object}
   */
  getStats() {
    const httpSockets = this.httpAgent.sockets;
    const httpFreeSockets = this.httpAgent.freeSockets;
    const httpsSockets = this.httpsAgent.sockets;
    const httpsFreeSockets = this.httpsAgent.freeSockets;

    let httpActive = 0;
    let httpFree = 0;
    let httpsActive = 0;
    let httpsFree = 0;

    Object.values(httpSockets).forEach(socketArray => {
      httpActive += socketArray.length;
    });
    
    Object.values(httpFreeSockets).forEach(socketArray => {
      httpFree += socketArray.length;
    });
    
    Object.values(httpsSockets).forEach(socketArray => {
      httpsActive += socketArray.length;
    });
    
    Object.values(httpsFreeSockets).forEach(socketArray => {
      httpsFree += socketArray.length;
    });

    return {
      ...this.stats,
      http: {
        active: httpActive,
        free: httpFree,
        total: httpActive + httpFree
      },
      https: {
        active: httpsActive,
        free: httpsFree,
        total: httpsActive + httpsFree
      },
      poolEfficiency: this.stats.totalRequests > 0 
        ? (this.stats.poolHits / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Record error
   * @param {string} type - Error type
   */
  recordError(type = 'general') {
    this.stats.errors++;
    if (type === 'timeout') {
      this.stats.timeouts++;
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      activeConnections: 0,
      totalRequests: 0,
      poolHits: 0,
      poolMisses: 0,
      errors: 0,
      timeouts: 0
    };
  }

  /**
   * Destroy all connections and cleanup
   */
  destroy() {
    logger.info('Destroying connection pools...');
    
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
    
    logger.info('Connection pools destroyed');
  }

  /**
   * Get pool health status
   * @returns {Object}
   */
  getHealthStatus() {
    const stats = this.getStats();
    const totalConnections = stats.http.total + stats.https.total;
    const maxConnections = this.options.maxSockets * 2; // HTTP + HTTPS
    
    const utilizationPercent = (totalConnections / maxConnections * 100).toFixed(2);
    const errorRate = stats.totalRequests > 0 
      ? (stats.errors / stats.totalRequests * 100).toFixed(2)
      : 0;

    return {
      status: errorRate > 10 ? 'unhealthy' : 'healthy',
      utilization: `${utilizationPercent}%`,
      errorRate: `${errorRate}%`,
      totalConnections,
      maxConnections,
      stats
    };
  }
}

module.exports = ConnectionPoolService;