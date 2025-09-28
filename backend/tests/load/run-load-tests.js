#!/usr/bin/env node

/**
 * Load Test Runner
 * Command-line interface for running load tests
 */

const { program } = require('commander');
const LoadTester = require('./load-test');
const ChatCompletionLoadTest = require('./scenarios/chat-completion-load');
const logger = require('../../src/config/logger');
const fs = require('fs').promises;
const path = require('path');

// Configure commander
program
  .name('load-test')
  .description('Run load tests for Dyad CLI Gateway')
  .version('1.0.0');

program
  .command('basic')
  .description('Run basic load test')
  .option('-u, --url <url>', 'Base URL', 'http://localhost:3001')
  .option('-k, --api-key <key>', 'API Key', 'test-api-key')
  .option('-c, --concurrent <number>', 'Max concurrent requests', '10')
  .option('-d, --duration <ms>', 'Test duration in milliseconds', '60000')
  .option('-r, --ramp-up <ms>', 'Ramp up time in milliseconds', '10000')
  .option('-o, --output <file>', 'Output file for results')
  .action(async (options) => {
    try {
      const tester = new LoadTester({
        baseUrl: options.url,
        apiKey: options.apiKey,
        maxConcurrent: parseInt(options.concurrent),
        duration: parseInt(options.duration),
        rampUpTime: parseInt(options.rampUp)
      });

      const report = await tester.run();
      
      if (options.output) {
        await saveReport(report, options.output);
      }
      
      console.log('\n=== LOAD TEST RESULTS ===');
      console.log(JSON.stringify(report, null, 2));
      
    } catch (error) {
      logger.error('Load test failed:', error);
      process.exit(1);
    }
  });

program
  .command('chat')
  .description('Run chat completion load test')
  .option('-u, --url <url>', 'Base URL', 'http://localhost:3001')
  .option('-k, --api-key <key>', 'API Key', 'test-api-key')
  .option('-c, --concurrent <number>', 'Max concurrent requests', '5')
  .option('-d, --duration <ms>', 'Test duration in milliseconds', '30000')
  .option('-o, --output <file>', 'Output file for results')
  .action(async (options) => {
    try {
      const tester = new ChatCompletionLoadTest({
        baseUrl: options.url,
        apiKey: options.apiKey
      });

      const report = await tester.runConcurrentTest(
        parseInt(options.concurrent),
        parseInt(options.duration)
      );
      
      if (options.output) {
        await saveReport(report, options.output);
      }
      
      console.log('\n=== CHAT COMPLETION LOAD TEST RESULTS ===');
      console.log(JSON.stringify(report, null, 2));
      
    } catch (error) {
      logger.error('Chat completion load test failed:', error);
      process.exit(1);
    }
  });

program
  .command('streaming')
  .description('Run streaming load test')
  .option('-u, --url <url>', 'Base URL', 'http://localhost:3001')
  .option('-k, --api-key <key>', 'API Key', 'test-api-key')
  .option('-c, --concurrent <number>', 'Max concurrent requests', '3')
  .option('-d, --duration <ms>', 'Test duration in milliseconds', '30000')
  .option('-o, --output <file>', 'Output file for results')
  .action(async (options) => {
    try {
      const tester = new ChatCompletionLoadTest({
        baseUrl: options.url,
        apiKey: options.apiKey
      });

      const report = await tester.runStreamingTest(
        parseInt(options.concurrent),
        parseInt(options.duration)
      );
      
      if (options.output) {
        await saveReport(report, options.output);
      }
      
      console.log('\n=== STREAMING LOAD TEST RESULTS ===');
      console.log(JSON.stringify(report, null, 2));
      
    } catch (error) {
      logger.error('Streaming load test failed:', error);
      process.exit(1);
    }
  });

program
  .command('mixed')
  .description('Run mixed workload test')
  .option('-u, --url <url>', 'Base URL', 'http://localhost:3001')
  .option('-k, --api-key <key>', 'API Key', 'test-api-key')
  .option('-c, --concurrent <number>', 'Max concurrent requests', '8')
  .option('-d, --duration <ms>', 'Test duration in milliseconds', '60000')
  .option('-o, --output <file>', 'Output file for results')
  .action(async (options) => {
    try {
      const tester = new ChatCompletionLoadTest({
        baseUrl: options.url,
        apiKey: options.apiKey
      });

      const report = await tester.runMixedWorkloadTest(
        parseInt(options.concurrent),
        parseInt(options.duration)
      );
      
      if (options.output) {
        await saveReport(report, options.output);
      }
      
      console.log('\n=== MIXED WORKLOAD TEST RESULTS ===');
      console.log(JSON.stringify(report, null, 2));
      
    } catch (error) {
      logger.error('Mixed workload test failed:', error);
      process.exit(1);
    }
  });

program
  .command('benchmark')
  .description('Run comprehensive benchmark suite')
  .option('-u, --url <url>', 'Base URL', 'http://localhost:3001')
  .option('-k, --api-key <key>', 'API Key', 'test-api-key')
  .option('-o, --output <dir>', 'Output directory for results', './load-test-results')
  .action(async (options) => {
    try {
      console.log('Running comprehensive benchmark suite...\n');
      
      const results = {};
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Ensure output directory exists
      await fs.mkdir(options.output, { recursive: true });
      
      // Test 1: Basic load test
      console.log('1. Running basic load test...');
      const basicTester = new LoadTester({
        baseUrl: options.url,
        apiKey: options.apiKey,
        maxConcurrent: 5,
        duration: 30000
      });
      results.basic = await basicTester.run();
      
      // Test 2: Chat completion test
      console.log('2. Running chat completion test...');
      const chatTester = new ChatCompletionLoadTest({
        baseUrl: options.url,
        apiKey: options.apiKey
      });
      results.chatCompletion = await chatTester.runConcurrentTest(5, 30000);
      
      // Test 3: Streaming test
      console.log('3. Running streaming test...');
      results.streaming = await chatTester.runStreamingTest(3, 30000);
      
      // Test 4: Mixed workload test
      console.log('4. Running mixed workload test...');
      results.mixedWorkload = await chatTester.runMixedWorkloadTest(8, 60000);
      
      // Test 5: High concurrency test
      console.log('5. Running high concurrency test...');
      const highConcurrencyTester = new LoadTester({
        baseUrl: options.url,
        apiKey: options.apiKey,
        maxConcurrent: 20,
        duration: 30000
      });
      results.highConcurrency = await highConcurrencyTester.run();
      
      // Save individual results
      for (const [testName, result] of Object.entries(results)) {
        const filename = `${testName}-${timestamp}.json`;
        await saveReport(result, path.join(options.output, filename));
      }
      
      // Generate summary report
      const summary = generateSummaryReport(results);
      await saveReport(summary, path.join(options.output, `summary-${timestamp}.json`));
      
      console.log('\n=== BENCHMARK SUITE COMPLETED ===');
      console.log(`Results saved to: ${options.output}`);
      console.log('\nSummary:');
      console.log(JSON.stringify(summary, null, 2));
      
    } catch (error) {
      logger.error('Benchmark suite failed:', error);
      process.exit(1);
    }
  });

/**
 * Save report to file
 */
async function saveReport(report, filename) {
  try {
    const dir = path.dirname(filename);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${filename}`);
  } catch (error) {
    logger.error('Failed to save report:', error);
  }
}

/**
 * Generate summary report from all test results
 */
function generateSummaryReport(results) {
  const summary = {
    timestamp: new Date().toISOString(),
    tests: {},
    overall: {
      totalRequests: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      averageSuccessRate: 0,
      averageThroughput: 0,
      averageResponseTime: 0
    }
  };

  const testNames = Object.keys(results);
  let totalSuccessRate = 0;
  let totalThroughput = 0;
  let totalResponseTime = 0;

  for (const [testName, result] of Object.entries(results)) {
    summary.tests[testName] = {
      duration: result.summary.duration,
      totalRequests: result.summary.totalRequests,
      successRate: result.summary.successRate,
      throughput: result.summary.throughput,
      averageResponseTime: result.summary.averageResponseTime,
      p95ResponseTime: result.responseTimePercentiles.p95,
      errors: Object.keys(result.errors).length
    };

    summary.overall.totalRequests += result.summary.totalRequests;
    summary.overall.totalSuccessful += result.summary.successfulRequests;
    summary.overall.totalFailed += result.summary.failedRequests;
    
    totalSuccessRate += parseFloat(result.summary.successRate);
    totalThroughput += parseFloat(result.summary.throughput);
    totalResponseTime += parseFloat(result.summary.averageResponseTime);
  }

  summary.overall.averageSuccessRate = `${(totalSuccessRate / testNames.length).toFixed(2)}%`;
  summary.overall.averageThroughput = `${(totalThroughput / testNames.length).toFixed(2)} req/s`;
  summary.overall.averageResponseTime = `${(totalResponseTime / testNames.length).toFixed(2)}ms`;

  return summary;
}

// Parse command line arguments
program.parse();