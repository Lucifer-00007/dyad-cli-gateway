#!/usr/bin/env node

/**
 * Performance Gate Script
 * 
 * Runs performance tests and validates that performance metrics
 * meet defined thresholds before allowing deployment.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

class PerformanceGate {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.results = [];
    this.thresholds = {
      responseTime: {
        p50: 200,    // 50th percentile < 200ms
        p95: 500,    // 95th percentile < 500ms
        p99: 1000    // 99th percentile < 1000ms
      },
      throughput: {
        rps: 100     // Requests per second > 100
      },
      errorRate: {
        max: 0.01    // Error rate < 1%
      },
      resourceUsage: {
        cpu: 80,     // CPU usage < 80%
        memory: 512  // Memory usage < 512MB
      }
    };
  }

  /**
   * Run performance tests
   */
  async runPerformanceTests() {
    console.log('🚀 Running performance tests...');

    const tests = [
      { name: 'Health Check', endpoint: '/health', method: 'GET' },
      { name: 'Models List', endpoint: '/v1/models', method: 'GET', auth: true },
      { name: 'Chat Completion', endpoint: '/v1/chat/completions', method: 'POST', auth: true, payload: true },
      { name: 'Admin Provider List', endpoint: '/admin/providers', method: 'GET', auth: true }
    ];

    for (const test of tests) {
      await this.runLoadTest(test);
    }
  }

  /**
   * Run load test for a specific endpoint
   */
  async runLoadTest(test) {
    console.log(`📊 Testing ${test.name}...`);

    const duration = 30; // 30 seconds
    const concurrency = 10; // 10 concurrent users
    const results = {
      name: test.name,
      endpoint: test.endpoint,
      duration,
      concurrency,
      requests: [],
      errors: [],
      startTime: Date.now()
    };

    // Prepare request configuration
    const requestConfig = {
      method: test.method,
      url: `${this.baseUrl}${test.endpoint}`,
      timeout: 5000,
      validateStatus: () => true // Don't throw on error status
    };

    if (test.auth) {
      requestConfig.headers = {
        'Authorization': 'Bearer test-api-key-for-performance-testing'
      };
    }

    if (test.payload && test.method === 'POST') {
      requestConfig.headers = {
        ...requestConfig.headers,
        'Content-Type': 'application/json'
      };
      
      if (test.endpoint.includes('chat/completions')) {
        requestConfig.data = {
          model: 'test-model',
          messages: [{ role: 'user', content: 'Hello, this is a performance test message.' }]
        };
      } else {
        requestConfig.data = { name: 'test-provider', type: 'spawn-cli' };
      }
    }

    // Run concurrent requests for specified duration
    const workers = [];
    const endTime = Date.now() + (duration * 1000);

    for (let i = 0; i < concurrency; i++) {
      workers.push(this.runWorker(requestConfig, endTime, results));
    }

    await Promise.all(workers);

    // Calculate metrics
    const metrics = this.calculateMetrics(results);
    this.results.push({ test: test.name, metrics });

    console.log(`  Requests: ${metrics.totalRequests}`);
    console.log(`  RPS: ${metrics.rps.toFixed(2)}`);
    console.log(`  P50: ${metrics.responseTime.p50}ms`);
    console.log(`  P95: ${metrics.responseTime.p95}ms`);
    console.log(`  P99: ${metrics.responseTime.p99}ms`);
    console.log(`  Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
  }

  /**
   * Worker function to make requests
   */
  async runWorker(requestConfig, endTime, results) {
    while (Date.now() < endTime) {
      const startTime = Date.now();
      
      try {
        const response = await axios(requestConfig);
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        results.requests.push({
          timestamp: startTime,
          responseTime,
          statusCode: response.status,
          success: response.status >= 200 && response.status < 400
        });

        if (response.status >= 400) {
          results.errors.push({
            timestamp: startTime,
            statusCode: response.status,
            error: response.data
          });
        }

      } catch (error) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        results.requests.push({
          timestamp: startTime,
          responseTime,
          statusCode: 0,
          success: false
        });

        results.errors.push({
          timestamp: startTime,
          error: error.message
        });
      }

      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Calculate performance metrics
   */
  calculateMetrics(results) {
    const requests = results.requests;
    const totalRequests = requests.length;
    const successfulRequests = requests.filter(r => r.success).length;
    const errorRate = (totalRequests - successfulRequests) / totalRequests;

    // Calculate response time percentiles
    const responseTimes = requests.map(r => r.responseTime).sort((a, b) => a - b);
    const p50Index = Math.floor(responseTimes.length * 0.5);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    const actualDuration = (results.requests[results.requests.length - 1]?.timestamp || Date.now()) - results.startTime;
    const rps = totalRequests / (actualDuration / 1000);

    return {
      totalRequests,
      successfulRequests,
      errorRate,
      rps,
      responseTime: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        p50: responseTimes[p50Index] || 0,
        p95: responseTimes[p95Index] || 0,
        p99: responseTimes[p99Index] || 0
      }
    };
  }

  /**
   * Check resource usage
   */
  async checkResourceUsage() {
    console.log('📈 Checking resource usage...');

    try {
      // Get container stats if running in Docker
      const containerStats = await this.getContainerStats();
      if (containerStats) {
        return containerStats;
      }

      // Fallback to system stats
      return await this.getSystemStats();

    } catch (error) {
      console.warn('⚠️  Could not get resource usage:', error.message);
      return null;
    }
  }

  /**
   * Get Docker container stats
   */
  async getContainerStats() {
    try {
      const stats = execSync('docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" $(docker ps -q)', 
        { encoding: 'utf8' });
      
      const lines = stats.trim().split('\n');
      if (lines.length > 1) {
        const data = lines[1].split('\t');
        const cpuPercent = parseFloat(data[0].replace('%', ''));
        const memUsage = data[1].split(' / ')[0];
        const memMB = this.parseMemoryUsage(memUsage);

        return {
          cpu: cpuPercent,
          memory: memMB,
          source: 'docker'
        };
      }
    } catch (error) {
      // Docker not available or no containers running
    }
    return null;
  }

  /**
   * Get system stats
   */
  async getSystemStats() {
    try {
      // Get CPU usage (simplified)
      const cpuInfo = execSync('top -bn1 | grep "Cpu(s)" | awk \'{print $2}\' | cut -d\'%\' -f1', 
        { encoding: 'utf8' });
      const cpuPercent = parseFloat(cpuInfo.trim());

      // Get memory usage
      const memInfo = execSync('free -m | grep "Mem:" | awk \'{print $3}\'', 
        { encoding: 'utf8' });
      const memMB = parseInt(memInfo.trim());

      return {
        cpu: cpuPercent,
        memory: memMB,
        source: 'system'
      };
    } catch (error) {
      throw new Error('Could not get system stats');
    }
  }

  /**
   * Parse memory usage string to MB
   */
  parseMemoryUsage(memStr) {
    const match = memStr.match(/(\d+(?:\.\d+)?)(.*)/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'kb':
      case 'kib':
        return value / 1024;
      case 'mb':
      case 'mib':
        return value;
      case 'gb':
      case 'gib':
        return value * 1024;
      default:
        return value; // Assume MB
    }
  }

  /**
   * Validate performance against thresholds
   */
  validatePerformance() {
    console.log('✅ Validating performance against thresholds...');

    const violations = [];

    for (const result of this.results) {
      const metrics = result.metrics;
      const testName = result.test;

      // Check response time thresholds
      if (metrics.responseTime.p50 > this.thresholds.responseTime.p50) {
        violations.push({
          test: testName,
          metric: 'P50 Response Time',
          actual: metrics.responseTime.p50,
          threshold: this.thresholds.responseTime.p50,
          severity: 'medium'
        });
      }

      if (metrics.responseTime.p95 > this.thresholds.responseTime.p95) {
        violations.push({
          test: testName,
          metric: 'P95 Response Time',
          actual: metrics.responseTime.p95,
          threshold: this.thresholds.responseTime.p95,
          severity: 'high'
        });
      }

      if (metrics.responseTime.p99 > this.thresholds.responseTime.p99) {
        violations.push({
          test: testName,
          metric: 'P99 Response Time',
          actual: metrics.responseTime.p99,
          threshold: this.thresholds.responseTime.p99,
          severity: 'high'
        });
      }

      // Check throughput thresholds
      if (metrics.rps < this.thresholds.throughput.rps) {
        violations.push({
          test: testName,
          metric: 'Requests Per Second',
          actual: metrics.rps,
          threshold: this.thresholds.throughput.rps,
          severity: 'medium'
        });
      }

      // Check error rate thresholds
      if (metrics.errorRate > this.thresholds.errorRate.max) {
        violations.push({
          test: testName,
          metric: 'Error Rate',
          actual: metrics.errorRate,
          threshold: this.thresholds.errorRate.max,
          severity: 'high'
        });
      }
    }

    return violations;
  }

  /**
   * Generate performance report
   */
  generateReport(resourceUsage, violations) {
    const report = {
      timestamp: new Date().toISOString(),
      thresholds: this.thresholds,
      results: this.results,
      resourceUsage,
      violations,
      summary: {
        totalTests: this.results.length,
        totalViolations: violations.length,
        highSeverityViolations: violations.filter(v => v.severity === 'high').length,
        passed: violations.length === 0
      },
      recommendations: this.generateRecommendations(violations)
    };

    return report;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(violations) {
    const recommendations = [];

    if (violations.length === 0) {
      recommendations.push({
        priority: 'INFO',
        title: 'Performance Acceptable',
        description: 'All performance metrics meet defined thresholds',
        actions: ['Continue monitoring performance in production']
      });
      return recommendations;
    }

    const responseTimeViolations = violations.filter(v => v.metric.includes('Response Time'));
    if (responseTimeViolations.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        title: 'Response Time Issues',
        description: `${responseTimeViolations.length} response time thresholds exceeded`,
        actions: [
          'Profile application for performance bottlenecks',
          'Optimize database queries',
          'Consider caching strategies',
          'Review resource allocation'
        ]
      });
    }

    const throughputViolations = violations.filter(v => v.metric.includes('Requests Per Second'));
    if (throughputViolations.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'Throughput Issues',
        description: `${throughputViolations.length} throughput thresholds not met`,
        actions: [
          'Scale application horizontally',
          'Optimize request handling',
          'Consider load balancing',
          'Review connection pooling'
        ]
      });
    }

    const errorViolations = violations.filter(v => v.metric.includes('Error Rate'));
    if (errorViolations.length > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        title: 'High Error Rate',
        description: `${errorViolations.length} error rate thresholds exceeded`,
        actions: [
          'Investigate error causes immediately',
          'Review application logs',
          'Check external dependencies',
          'Consider rollback if necessary'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Print performance summary
   */
  printSummary(report) {
    console.log('\n🚀 PERFORMANCE GATE RESULTS');
    console.log('============================');
    console.log(`Tests Run: ${report.summary.totalTests}`);
    console.log(`Violations: ${report.summary.totalViolations}`);
    console.log(`High Severity: ${report.summary.highSeverityViolations}`);
    console.log(`Status: ${report.summary.passed ? '✅ PASSED' : '❌ FAILED'}`);

    if (report.resourceUsage) {
      console.log('\n📈 RESOURCE USAGE:');
      console.log(`  CPU: ${report.resourceUsage.cpu.toFixed(1)}%`);
      console.log(`  Memory: ${report.resourceUsage.memory.toFixed(0)}MB`);
    }

    if (report.violations.length > 0) {
      console.log('\n❌ PERFORMANCE VIOLATIONS:');
      report.violations.forEach(violation => {
        console.log(`  ${violation.severity.toUpperCase()}: ${violation.test} - ${violation.metric}`);
        console.log(`    Actual: ${violation.actual} | Threshold: ${violation.threshold}`);
      });
    }

    console.log('\n📋 RECOMMENDATIONS:');
    report.recommendations.forEach(rec => {
      console.log(`  ${rec.priority}: ${rec.title}`);
    });
  }

  /**
   * Run complete performance gate
   */
  async runGate() {
    console.log('🚀 Starting performance gate...');

    try {
      // Run performance tests
      await this.runPerformanceTests();

      // Check resource usage
      const resourceUsage = await this.checkResourceUsage();

      // Validate against thresholds
      const violations = this.validatePerformance();

      // Generate report
      const report = this.generateReport(resourceUsage, violations);
      this.printSummary(report);

      // Save report
      const reportPath = path.join(process.cwd(), 'performance-gate-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Report saved to: ${reportPath}`);

      if (report.summary.passed) {
        console.log('\n✅ Performance gate passed');
        return { success: true, report };
      } else {
        console.log('\n❌ Performance gate failed');
        return { success: false, report };
      }

    } catch (error) {
      console.error('❌ Performance gate failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Run gate if called directly
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const gate = new PerformanceGate(baseUrl);
  
  gate.runGate()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = PerformanceGate;