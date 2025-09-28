/**
 * Load Testing Suite for Dyad CLI Gateway
 * Comprehensive load testing scenarios
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const logger = require('../../src/config/logger');

class LoadTester {
  constructor(options = {}) {
    this.options = {
      baseUrl: options.baseUrl || 'http://localhost:3001',
      apiKey: options.apiKey || 'test-api-key',
      maxConcurrent: options.maxConcurrent || 10,
      duration: options.duration || 60000, // 1 minute
      rampUpTime: options.rampUpTime || 10000, // 10 seconds
      scenarios: options.scenarios || ['chat-completion', 'models-list', 'embeddings'],
      ...options
    };

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: {},
      throughput: 0,
      startTime: null,
      endTime: null
    };

    this.activeRequests = new Set();
    this.isRunning = false;
  }

  /**
   * Run load test
   */
  async run() {
    logger.info('Starting load test', {
      baseUrl: this.options.baseUrl,
      maxConcurrent: this.options.maxConcurrent,
      duration: this.options.duration,
      scenarios: this.options.scenarios
    });

    this.stats.startTime = performance.now();
    this.isRunning = true;

    try {
      // Ramp up phase
      await this.rampUp();

      // Sustained load phase
      await this.sustainedLoad();

      // Ramp down phase
      await this.rampDown();

    } catch (error) {
      logger.error('Load test failed:', error);
      throw error;
    } finally {
      this.stats.endTime = performance.now();
      this.isRunning = false;
      await this.waitForActiveRequests();
    }

    return this.generateReport();
  }

  /**
   * Ramp up phase - gradually increase load
   */
  async rampUp() {
    logger.info('Starting ramp-up phase');
    
    const rampUpSteps = 5;
    const stepDuration = this.options.rampUpTime / rampUpSteps;
    const maxConcurrentPerStep = this.options.maxConcurrent / rampUpSteps;

    for (let step = 1; step <= rampUpSteps; step++) {
      const targetConcurrent = Math.floor(maxConcurrentPerStep * step);
      
      logger.info(`Ramp-up step ${step}/${rampUpSteps}`, { targetConcurrent });
      
      // Start requests for this step
      for (let i = 0; i < targetConcurrent; i++) {
        if (this.activeRequests.size < targetConcurrent) {
          this.startRequest();
        }
      }

      await this.sleep(stepDuration);
    }
  }

  /**
   * Sustained load phase - maintain peak load
   */
  async sustainedLoad() {
    logger.info('Starting sustained load phase');
    
    const sustainedDuration = this.options.duration - this.options.rampUpTime;
    const endTime = performance.now() + sustainedDuration;

    while (performance.now() < endTime && this.isRunning) {
      // Maintain target concurrency
      while (this.activeRequests.size < this.options.maxConcurrent) {
        this.startRequest();
      }

      await this.sleep(100); // Check every 100ms
    }
  }

  /**
   * Ramp down phase - gradually decrease load
   */
  async rampDown() {
    logger.info('Starting ramp-down phase');
    
    // Stop starting new requests
    this.isRunning = false;
    
    // Wait for active requests to complete
    await this.waitForActiveRequests();
  }

  /**
   * Start a single request
   */
  async startRequest() {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeRequests.add(requestId);

    try {
      const scenario = this.selectScenario();
      const startTime = performance.now();
      
      await this.executeScenario(scenario);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      this.recordSuccess(responseTime);
      
    } catch (error) {
      this.recordError(error);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Select random scenario
   */
  selectScenario() {
    const scenarios = this.options.scenarios;
    return scenarios[Math.floor(Math.random() * scenarios.length)];
  }

  /**
   * Execute specific test scenario
   */
  async executeScenario(scenario) {
    switch (scenario) {
      case 'chat-completion':
        return this.testChatCompletion();
      case 'chat-completion-streaming':
        return this.testChatCompletionStreaming();
      case 'models-list':
        return this.testModelsList();
      case 'embeddings':
        return this.testEmbeddings();
      case 'provider-health':
        return this.testProviderHealth();
      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }

  /**
   * Test chat completion endpoint
   */
  async testChatCompletion() {
    const response = await axios.post(
      `${this.options.baseUrl}/v1/chat/completions`,
      {
        model: 'test-model',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, how are you?' }
        ],
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    return response.data;
  }

  /**
   * Test streaming chat completion endpoint
   */
  async testChatCompletionStreaming() {
    const response = await axios.post(
      `${this.options.baseUrl}/v1/chat/completions`,
      {
        model: 'test-model',
        messages: [
          { role: 'user', content: 'Count from 1 to 5' }
        ],
        stream: true,
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream',
        timeout: 30000
      }
    );

    return new Promise((resolve, reject) => {
      let chunks = 0;
      
      response.data.on('data', (chunk) => {
        chunks++;
      });

      response.data.on('end', () => {
        resolve({ chunks });
      });

      response.data.on('error', reject);
    });
  }

  /**
   * Test models list endpoint
   */
  async testModelsList() {
    const response = await axios.get(
      `${this.options.baseUrl}/v1/models`,
      {
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`
        },
        timeout: 10000
      }
    );

    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    return response.data;
  }

  /**
   * Test embeddings endpoint
   */
  async testEmbeddings() {
    const response = await axios.post(
      `${this.options.baseUrl}/v1/embeddings`,
      {
        model: 'test-embedding-model',
        input: 'This is a test sentence for embeddings.'
      },
      {
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    return response.data;
  }

  /**
   * Test provider health endpoint
   */
  async testProviderHealth() {
    const response = await axios.get(
      `${this.options.baseUrl}/admin/providers/health`,
      {
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`
        },
        timeout: 10000
      }
    );

    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    return response.data;
  }

  /**
   * Record successful request
   */
  recordSuccess(responseTime) {
    this.stats.totalRequests++;
    this.stats.successfulRequests++;
    this.stats.responseTimes.push(responseTime);
  }

  /**
   * Record failed request
   */
  recordError(error) {
    this.stats.totalRequests++;
    this.stats.failedRequests++;
    
    const errorType = error.code || error.message || 'unknown';
    this.stats.errors[errorType] = (this.stats.errors[errorType] || 0) + 1;
  }

  /**
   * Wait for all active requests to complete
   */
  async waitForActiveRequests() {
    const timeout = 30000; // 30 seconds
    const startTime = performance.now();
    
    while (this.activeRequests.size > 0 && (performance.now() - startTime) < timeout) {
      await this.sleep(100);
    }
    
    if (this.activeRequests.size > 0) {
      logger.warn(`${this.activeRequests.size} requests still active after timeout`);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate test report
   */
  generateReport() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000; // seconds
    const throughput = this.stats.totalRequests / duration;
    
    // Calculate percentiles
    const sortedTimes = this.stats.responseTimes.sort((a, b) => a - b);
    const percentiles = {
      p50: this.getPercentile(sortedTimes, 0.5),
      p90: this.getPercentile(sortedTimes, 0.9),
      p95: this.getPercentile(sortedTimes, 0.95),
      p99: this.getPercentile(sortedTimes, 0.99)
    };

    const averageResponseTime = sortedTimes.length > 0 
      ? sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length
      : 0;

    const successRate = this.stats.totalRequests > 0 
      ? (this.stats.successfulRequests / this.stats.totalRequests * 100)
      : 0;

    const report = {
      summary: {
        duration: `${duration.toFixed(2)}s`,
        totalRequests: this.stats.totalRequests,
        successfulRequests: this.stats.successfulRequests,
        failedRequests: this.stats.failedRequests,
        successRate: `${successRate.toFixed(2)}%`,
        throughput: `${throughput.toFixed(2)} req/s`,
        averageResponseTime: `${averageResponseTime.toFixed(2)}ms`
      },
      responseTimePercentiles: {
        p50: `${percentiles.p50.toFixed(2)}ms`,
        p90: `${percentiles.p90.toFixed(2)}ms`,
        p95: `${percentiles.p95.toFixed(2)}ms`,
        p99: `${percentiles.p99.toFixed(2)}ms`
      },
      errors: this.stats.errors,
      configuration: {
        baseUrl: this.options.baseUrl,
        maxConcurrent: this.options.maxConcurrent,
        duration: this.options.duration,
        scenarios: this.options.scenarios
      }
    };

    logger.info('Load test completed', report);
    return report;
  }

  /**
   * Calculate percentile from sorted array
   */
  getPercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.floor(sortedArray.length * percentile);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }
}

module.exports = LoadTester;