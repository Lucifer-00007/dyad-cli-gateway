/**
 * Enhanced Cache Service
 * Advanced caching with TTL, LRU eviction, and performance monitoring
 */

const EventEmitter = require('events');
const logger = require('../../config/logger');
const monitoringService = require('./monitoring.service');

class EnhancedCacheService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxSize: options.maxSize || 1000,
      defaultTTL: options.defaultTTL || 300000, // 5 minutes
      checkPeriod: options.checkPeriod || 60000, // 1 minute
      enableStats: options.enableStats !== false,
      enableCompression: options.enableCompression || false,
      ...options
    };

    this.cache = new Map();
    this.accessOrder = new Map(); // For LRU tracking
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      expired: 0,
      size: 0,
      memoryUsage: 0
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.options.checkPeriod);

    logger.info('Enhanced cache service initialized', {
      maxSize: this.options.maxSize,
      defaultTTL: this.options.defaultTTL,
      checkPeriod: this.options.checkPeriod
    });
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} - Cached value or undefined
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.recordMiss(key);
      return undefined;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.expired++;
      this.recordMiss(key);
      return undefined;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);
    this.recordHit(key);
    
    return this.deserializeValue(entry.value);
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - Time to live in milliseconds
   * @returns {boolean} - Success status
   */
  set(key, value, ttl = this.options.defaultTTL) {
    try {
      // Check if we need to evict entries
      if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
        this.evictLRU();
      }

      const serializedValue = this.serializeValue(value);
      const entry = {
        value: serializedValue,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttl,
        ttl,
        accessCount: 0,
        size: this.calculateSize(serializedValue)
      };

      this.cache.set(key, entry);
      this.updateAccessOrder(key);
      this.stats.sets++;
      this.updateStats();

      logger.debug('Cache set', { key, ttl, size: entry.size });
      
      this.emit('set', { key, value, ttl });
      return true;

    } catch (error) {
      logger.error('Cache set failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {boolean} - Success status
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessOrder.delete(key);
      this.stats.deletes++;
      this.updateStats();
      
      logger.debug('Cache delete', { key });
      this.emit('delete', { key });
    }
    return deleted;
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    this.updateStats();
    
    logger.info('Cache cleared', { entriesRemoved: size });
    this.emit('clear', { entriesRemoved: size });
  }

  /**
   * Get multiple values from cache
   * @param {string[]} keys - Array of cache keys
   * @returns {Object} - Object with key-value pairs
   */
  mget(keys) {
    const result = {};
    
    keys.forEach(key => {
      const value = this.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    });
    
    return result;
  }

  /**
   * Set multiple values in cache
   * @param {Object} entries - Object with key-value pairs
   * @param {number} [ttl] - Time to live in milliseconds
   * @returns {number} - Number of successfully set entries
   */
  mset(entries, ttl = this.options.defaultTTL) {
    let successCount = 0;
    
    Object.entries(entries).forEach(([key, value]) => {
      if (this.set(key, value, ttl)) {
        successCount++;
      }
    });
    
    return successCount;
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      utilization: `${((this.stats.size / this.options.maxSize) * 100).toFixed(2)}%`,
      averageEntrySize: this.stats.size > 0 ? Math.round(this.stats.memoryUsage / this.stats.size) : 0
    };
  }

  /**
   * Get cache health status
   * @returns {Object}
   */
  getHealthStatus() {
    const stats = this.getStats();
    const utilization = (this.stats.size / this.options.maxSize) * 100;
    const hitRate = parseFloat(stats.hitRate);
    
    let status = 'healthy';
    if (utilization > 80 || hitRate < 50) {
      status = 'degraded';
    }
    if (utilization > 95 || hitRate < 20) {
      status = 'unhealthy';
    }

    return {
      status,
      utilization: stats.utilization,
      hitRate: stats.hitRate,
      size: this.stats.size,
      maxSize: this.options.maxSize,
      memoryUsage: this.formatBytes(this.stats.memoryUsage)
    };
  }

  /**
   * Get all cache keys
   * @returns {string[]}
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entries with metadata
   * @returns {Object[]}
   */
  entries() {
    const entries = [];
    
    this.cache.forEach((entry, key) => {
      entries.push({
        key,
        value: this.deserializeValue(entry.value),
        createdAt: new Date(entry.createdAt),
        expiresAt: new Date(entry.expiresAt),
        ttl: entry.ttl,
        accessCount: entry.accessCount,
        size: entry.size,
        isExpired: this.isExpired(entry)
      });
    });
    
    return entries;
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.stats.expired += expiredCount;
      this.updateStats();
      
      logger.debug('Cache cleanup completed', { expiredCount });
      this.emit('cleanup', { expiredCount });
    }
  }

  /**
   * Evict least recently used entry
   */
  evictLRU() {
    if (this.accessOrder.size === 0) return;
    
    // Get the least recently used key (first in access order)
    const lruKey = this.accessOrder.keys().next().value;
    
    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessOrder.delete(lruKey);
      this.stats.evictions++;
      this.updateStats();
      
      logger.debug('LRU eviction', { key: lruKey });
      this.emit('evict', { key: lruKey, reason: 'lru' });
    }
  }

  /**
   * Update access order for LRU tracking
   * @param {string} key
   */
  updateAccessOrder(key) {
    // Remove and re-add to move to end (most recently used)
    this.accessOrder.delete(key);
    this.accessOrder.set(key, Date.now());
    
    // Update access count
    const entry = this.cache.get(key);
    if (entry) {
      entry.accessCount++;
    }
  }

  /**
   * Check if entry is expired
   * @param {Object} entry
   * @returns {boolean}
   */
  isExpired(entry) {
    return Date.now() > entry.expiresAt;
  }

  /**
   * Serialize value for storage
   * @param {*} value
   * @returns {*}
   */
  serializeValue(value) {
    if (this.options.enableCompression && typeof value === 'object') {
      // Simple JSON serialization (could be enhanced with compression)
      return JSON.stringify(value);
    }
    return value;
  }

  /**
   * Deserialize value from storage
   * @param {*} value
   * @returns {*}
   */
  deserializeValue(value) {
    if (this.options.enableCompression && typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        logger.warn('Failed to deserialize cached value', { error: error.message });
        return value;
      }
    }
    return value;
  }

  /**
   * Calculate size of value in bytes
   * @param {*} value
   * @returns {number}
   */
  calculateSize(value) {
    if (typeof value === 'string') {
      return Buffer.byteLength(value, 'utf8');
    }
    if (typeof value === 'object') {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    }
    return 8; // Approximate size for primitives
  }

  /**
   * Update cache statistics
   */
  updateStats() {
    this.stats.size = this.cache.size;
    
    let totalMemory = 0;
    this.cache.forEach(entry => {
      totalMemory += entry.size;
    });
    this.stats.memoryUsage = totalMemory;
  }

  /**
   * Record cache hit
   * @param {string} key
   */
  recordHit(key) {
    this.stats.hits++;
    
    if (this.options.enableStats) {
      logger.debug('Cache hit', { key });
    }
  }

  /**
   * Record cache miss
   * @param {string} key
   */
  recordMiss(key) {
    this.stats.misses++;
    
    if (this.options.enableStats) {
      logger.debug('Cache miss', { key });
    }
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      expired: 0,
      size: this.cache.size,
      memoryUsage: 0
    };
    
    this.updateStats();
  }

  /**
   * Shutdown cache service
   */
  shutdown() {
    logger.info('Shutting down enhanced cache service...');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.clear();
    
    logger.info('Enhanced cache service shut down');
  }
}

module.exports = EnhancedCacheService;