#!/usr/bin/env node

/**
 * Performance Test Runner
 * Simple script to run performance tests and generate reports
 */

const path = require('path');
const fs = require('fs').promises;
const LoadTester = require('../tests/load/load-test');
const ChatCompletionLoadTest = require('../tests/load/scenarios/chat-completion-load');

async function runPerformanceTests() {
  console.log('🚀 Starting Performance Tests...\n');
  
  const baseUrl = process.env.GATEWAY_URL || 'http://localhost:3001';
  const apiKey = process.env.TEST_API_KEY || 'test-api-key';
  const outputDir = './performance-test-results';
  
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const results = {};
  
  try {
    // Test 1: Basic Load Test
    console.log('1️⃣  Running Basic Load Test (30s, 5 concurrent)...');
    const basicTester = new LoadTester({
      baseUrl,
      apiKey,
      maxConcurrent: 5,
      duration: 30000,
      scenarios: ['models-list']
    });
    results.basic = await basicTester.run();
    console.log(`   ✅ Completed: ${results.basic.summary.totalRequests} requests, ${results.basic.summary.successRate} success rate\n`);
    
    // Test 2: Chat Completion Test
    console.log('2️⃣  Running Chat Completion Test (30s, 3 concurrent)...');
    const chatTester = new ChatCompletionLoadTest({
      baseUrl,
      apiKey
    });
    results.chatCompletion = await chatTester.runConcurrentTest(3, 30000);
    console.log(`   ✅ Completed: ${results.chatCompletion.summary.totalRequests} requests, ${results.chatCompletion.summary.successRate} success rate\n`);
    
    // Test 3: Mixed Workload Test
    console.log('3️⃣  Running Mixed Workload Test (45s, 6 concurrent)...');
    results.mixedWorkload = await chatTester.runMixedWorkloadTest(6, 45000);
    console.log(`   ✅ Completed: ${results.mixedWorkload.summary.totalRequests} requests, ${results.mixedWorkload.summary.successRate} success rate\n`);
    
    // Generate summary report
    const summary = generateSummaryReport(results);
    
    // Save results
    const summaryFile = path.join(outputDir, `performance-summary-${timestamp}.json`);
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
    
    // Save detailed results
    for (const [testName, result] of Object.entries(results)) {
      const detailFile = path.join(outputDir, `${testName}-${timestamp}.json`);
      await fs.writeFile(detailFile, JSON.stringify(result, null, 2));
    }
    
    // Display summary
    console.log('📊 Performance Test Summary:');
    console.log('=' .repeat(50));
    console.log(`Total Requests: ${summary.overall.totalRequests}`);
    console.log(`Success Rate: ${summary.overall.averageSuccessRate}`);
    console.log(`Average Throughput: ${summary.overall.averageThroughput}`);
    console.log(`Average Response Time: ${summary.overall.averageResponseTime}`);
    console.log(`Results saved to: ${outputDir}`);
    
    // Check if performance meets SLA
    const slaCheck = checkSLA(summary);
    if (slaCheck.passed) {
      console.log('\n✅ Performance SLA: PASSED');
    } else {
      console.log('\n❌ Performance SLA: FAILED');
      console.log('Issues:');
      slaCheck.issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
  } catch (error) {
    console.error('❌ Performance tests failed:', error.message);
    process.exit(1);
  }
}

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

function checkSLA(summary) {
  const issues = [];
  
  // SLA Requirements
  const SLA = {
    minSuccessRate: 95, // 95%
    maxAverageResponseTime: 2000, // 2 seconds
    minThroughput: 5 // 5 req/s
  };
  
  const successRate = parseFloat(summary.overall.averageSuccessRate);
  const responseTime = parseFloat(summary.overall.averageResponseTime);
  const throughput = parseFloat(summary.overall.averageThroughput);
  
  if (successRate < SLA.minSuccessRate) {
    issues.push(`Success rate ${successRate}% below SLA requirement of ${SLA.minSuccessRate}%`);
  }
  
  if (responseTime > SLA.maxAverageResponseTime) {
    issues.push(`Average response time ${responseTime}ms exceeds SLA limit of ${SLA.maxAverageResponseTime}ms`);
  }
  
  if (throughput < SLA.minThroughput) {
    issues.push(`Throughput ${throughput} req/s below SLA requirement of ${SLA.minThroughput} req/s`);
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

// Run if called directly
if (require.main === module) {
  runPerformanceTests().catch(error => {
    console.error('Performance test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runPerformanceTests };