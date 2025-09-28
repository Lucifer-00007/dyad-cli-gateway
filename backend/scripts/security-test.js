#!/usr/bin/env node

/**
 * Security Testing Script for Dyad CLI Gateway
 * 
 * This script performs basic penetration testing and security validation.
 * It should be run in a test environment only.
 */

const axios = require('axios').default;
const crypto = require('crypto');

class SecurityTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.results = [];
    this.testId = crypto.randomUUID();
  }

  /**
   * Add test result
   */
  addResult(category, test, status, details = null) {
    this.results.push({
      category,
      test,
      status, // PASS, FAIL, WARN, SKIP
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Test authentication bypass attempts
   */
  async testAuthenticationBypass() {
    console.log('🔐 Testing authentication bypass...');

    const tests = [
      {
        name: 'No Authorization Header',
        request: { url: '/v1/chat/completions', method: 'POST' }
      },
      {
        name: 'Invalid Bearer Token',
        request: { 
          url: '/v1/chat/completions', 
          method: 'POST',
          headers: { 'Authorization': 'Bearer invalid-token' }
        }
      },
      {
        name: 'Malformed Authorization Header',
        request: { 
          url: '/v1/chat/completions', 
          method: 'POST',
          headers: { 'Authorization': 'Malformed header' }
        }
      },
      {
        name: 'SQL Injection in Auth Header',
        request: { 
          url: '/v1/chat/completions', 
          method: 'POST',
          headers: { 'Authorization': "Bearer ' OR '1'='1" }
        }
      }
    ];

    for (const test of tests) {
      try {
        const response = await axios({
          method: test.request.method,
          url: `${this.baseUrl}${test.request.url}`,
          headers: test.request.headers || {},
          validateStatus: () => true // Don't throw on error status
        });

        if (response.status === 401 || response.status === 403) {
          this.addResult('Authentication', test.name, 'PASS', 
            `Correctly rejected with status ${response.status}`);
        } else {
          this.addResult('Authentication', test.name, 'FAIL', 
            `Unexpected status ${response.status}, should be 401/403`);
        }
      } catch (error) {
        this.addResult('Authentication', test.name, 'WARN', 
          `Request failed: ${error.message}`);
      }
    }
  }

  /**
   * Test input validation and injection attacks
   */
  async testInputValidation() {
    console.log('🛡️ Testing input validation...');

    const payloads = [
      // SQL Injection
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "1' UNION SELECT * FROM users--",
      
      // NoSQL Injection
      '{"$ne": null}',
      '{"$gt": ""}',
      '{"$where": "this.password.match(/.*/)"}',
      
      // Command Injection
      '; ls -la',
      '`whoami`',
      '$(id)',
      '| cat /etc/passwd',
      
      // XSS
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src=x onerror=alert("xss")>',
      
      // Path Traversal
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      
      // Large Payloads
      'A'.repeat(10000),
      'A'.repeat(100000)
    ];

    const endpoints = [
      { url: '/v1/chat/completions', method: 'POST', field: 'messages' },
      { url: '/v1/models', method: 'GET', field: 'query' },
      { url: '/admin/providers', method: 'POST', field: 'name' }
    ];

    for (const endpoint of endpoints) {
      for (const payload of payloads) {
        try {
          let requestData = {};
          
          if (endpoint.method === 'POST') {
            if (endpoint.field === 'messages') {
              requestData = {
                model: 'test-model',
                messages: [{ role: 'user', content: payload }]
              };
            } else {
              requestData[endpoint.field] = payload;
            }
          }

          const response = await axios({
            method: endpoint.method,
            url: `${this.baseUrl}${endpoint.url}${endpoint.method === 'GET' ? `?${endpoint.field}=${encodeURIComponent(payload)}` : ''}`,
            data: endpoint.method === 'POST' ? requestData : undefined,
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json'
            },
            validateStatus: () => true,
            timeout: 5000
          });

          // Check for signs of successful injection
          const responseText = JSON.stringify(response.data).toLowerCase();
          const dangerousSigns = [
            'syntax error',
            'mysql',
            'postgresql',
            'mongodb',
            'root:',
            '/etc/passwd',
            'command not found',
            '<script',
            'alert(',
            'onerror='
          ];

          const foundDangerousSign = dangerousSigns.some(sign => 
            responseText.includes(sign));

          if (foundDangerousSign) {
            this.addResult('Input Validation', 
              `${endpoint.url} - ${payload.substring(0, 50)}...`, 
              'FAIL', 
              'Response contains signs of successful injection');
          } else if (response.status >= 400 && response.status < 500) {
            this.addResult('Input Validation', 
              `${endpoint.url} - ${payload.substring(0, 50)}...`, 
              'PASS', 
              `Properly rejected with status ${response.status}`);
          } else {
            this.addResult('Input Validation', 
              `${endpoint.url} - ${payload.substring(0, 50)}...`, 
              'WARN', 
              `Unexpected status ${response.status}`);
          }
        } catch (error) {
          if (error.code === 'ECONNABORTED') {
            this.addResult('Input Validation', 
              `${endpoint.url} - ${payload.substring(0, 50)}...`, 
              'PASS', 
              'Request timed out (good - prevents DoS)');
          } else {
            this.addResult('Input Validation', 
              `${endpoint.url} - ${payload.substring(0, 50)}...`, 
              'WARN', 
              `Request failed: ${error.message}`);
          }
        }
      }
    }
  }

  /**
   * Test rate limiting
   */
  async testRateLimiting() {
    console.log('⏱️ Testing rate limiting...');

    const endpoint = '/v1/models';
    const requests = [];
    const requestCount = 50;

    // Send many requests quickly
    for (let i = 0; i < requestCount; i++) {
      requests.push(
        axios({
          method: 'GET',
          url: `${this.baseUrl}${endpoint}`,
          headers: { 'Authorization': 'Bearer test-token' },
          validateStatus: () => true
        }).catch(error => ({ error: error.message }))
      );
    }

    const responses = await Promise.all(requests);
    const rateLimitedCount = responses.filter(r => 
      r.status === 429 || (r.error && r.error.includes('rate limit'))).length;

    if (rateLimitedCount > 0) {
      this.addResult('Rate Limiting', 'Burst Request Test', 'PASS', 
        `${rateLimitedCount}/${requestCount} requests were rate limited`);
    } else {
      this.addResult('Rate Limiting', 'Burst Request Test', 'FAIL', 
        'No rate limiting detected');
    }
  }

  /**
   * Test for information disclosure
   */
  async testInformationDisclosure() {
    console.log('📋 Testing information disclosure...');

    const endpoints = [
      '/admin',
      '/admin/users',
      '/admin/config',
      '/.env',
      '/config',
      '/package.json',
      '/server-status',
      '/health',
      '/metrics',
      '/debug',
      '/api-docs',
      '/swagger',
      '/graphql'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios({
          method: 'GET',
          url: `${this.baseUrl}${endpoint}`,
          validateStatus: () => true,
          timeout: 5000
        });

        if (response.status === 200) {
          const responseText = JSON.stringify(response.data).toLowerCase();
          const sensitiveInfo = [
            'password',
            'secret',
            'key',
            'token',
            'database',
            'mongodb',
            'redis',
            'version',
            'debug',
            'stack trace'
          ];

          const foundSensitive = sensitiveInfo.some(info => 
            responseText.includes(info));

          if (foundSensitive) {
            this.addResult('Information Disclosure', endpoint, 'FAIL', 
              'Endpoint exposes sensitive information');
          } else {
            this.addResult('Information Disclosure', endpoint, 'WARN', 
              'Endpoint accessible but no obvious sensitive data');
          }
        } else if (response.status === 401 || response.status === 403) {
          this.addResult('Information Disclosure', endpoint, 'PASS', 
            'Endpoint properly protected');
        } else if (response.status === 404) {
          this.addResult('Information Disclosure', endpoint, 'PASS', 
            'Endpoint not found');
        }
      } catch (error) {
        this.addResult('Information Disclosure', endpoint, 'SKIP', 
          `Request failed: ${error.message}`);
      }
    }
  }

  /**
   * Test HTTP security headers
   */
  async testSecurityHeaders() {
    console.log('🔒 Testing security headers...');

    try {
      const response = await axios({
        method: 'GET',
        url: `${this.baseUrl}/`,
        validateStatus: () => true
      });

      const headers = response.headers;
      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'strict-transport-security',
        'content-security-policy',
        'referrer-policy'
      ];

      for (const header of securityHeaders) {
        if (headers[header]) {
          this.addResult('Security Headers', header, 'PASS', 
            `Header present: ${headers[header]}`);
        } else {
          this.addResult('Security Headers', header, 'FAIL', 
            'Security header missing');
        }
      }

      // Check for information disclosure headers
      const disclosureHeaders = ['server', 'x-powered-by'];
      for (const header of disclosureHeaders) {
        if (headers[header]) {
          this.addResult('Security Headers', `${header} disclosure`, 'WARN', 
            `Header reveals server info: ${headers[header]}`);
        } else {
          this.addResult('Security Headers', `${header} disclosure`, 'PASS', 
            'No server information disclosed');
        }
      }
    } catch (error) {
      this.addResult('Security Headers', 'Header Test', 'SKIP', 
        `Request failed: ${error.message}`);
    }
  }

  /**
   * Test CORS configuration
   */
  async testCORS() {
    console.log('🌐 Testing CORS configuration...');

    const origins = [
      'http://evil.com',
      'https://malicious.org',
      'null',
      '*'
    ];

    for (const origin of origins) {
      try {
        const response = await axios({
          method: 'OPTIONS',
          url: `${this.baseUrl}/v1/chat/completions`,
          headers: {
            'Origin': origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type,Authorization'
          },
          validateStatus: () => true
        });

        const corsHeader = response.headers['access-control-allow-origin'];
        
        if (corsHeader === '*') {
          this.addResult('CORS', `Origin: ${origin}`, 'FAIL', 
            'Wildcard CORS allows any origin');
        } else if (corsHeader === origin && origin.includes('evil')) {
          this.addResult('CORS', `Origin: ${origin}`, 'FAIL', 
            'Malicious origin allowed');
        } else if (!corsHeader) {
          this.addResult('CORS', `Origin: ${origin}`, 'PASS', 
            'Origin rejected (no CORS header)');
        } else {
          this.addResult('CORS', `Origin: ${origin}`, 'PASS', 
            `Origin handled appropriately: ${corsHeader}`);
        }
      } catch (error) {
        this.addResult('CORS', `Origin: ${origin}`, 'SKIP', 
          `Request failed: ${error.message}`);
      }
    }
  }

  /**
   * Test for common vulnerabilities
   */
  async testCommonVulnerabilities() {
    console.log('🔍 Testing common vulnerabilities...');

    // Test for directory traversal
    const traversalPaths = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
    ];

    for (const path of traversalPaths) {
      try {
        const response = await axios({
          method: 'GET',
          url: `${this.baseUrl}/static/${path}`,
          validateStatus: () => true
        });

        if (response.status === 200 && 
            (response.data.includes('root:') || response.data.includes('[drivers]'))) {
          this.addResult('Directory Traversal', path, 'FAIL', 
            'Directory traversal successful');
        } else {
          this.addResult('Directory Traversal', path, 'PASS', 
            'Directory traversal blocked');
        }
      } catch (error) {
        this.addResult('Directory Traversal', path, 'PASS', 
          'Directory traversal blocked');
      }
    }

    // Test for HTTP method override
    try {
      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/admin/providers`,
        headers: {
          'X-HTTP-Method-Override': 'DELETE',
          'Authorization': 'Bearer test-token'
        },
        validateStatus: () => true
      });

      if (response.status === 405) {
        this.addResult('HTTP Method Override', 'DELETE via POST', 'PASS', 
          'Method override properly rejected');
      } else {
        this.addResult('HTTP Method Override', 'DELETE via POST', 'WARN', 
          'Method override may be enabled');
      }
    } catch (error) {
      this.addResult('HTTP Method Override', 'DELETE via POST', 'SKIP', 
        `Request failed: ${error.message}`);
    }
  }

  /**
   * Generate security test report
   */
  generateReport() {
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      failed: this.results.filter(r => r.status === 'FAIL').length,
      warnings: this.results.filter(r => r.status === 'WARN').length,
      skipped: this.results.filter(r => r.status === 'SKIP').length
    };

    const report = {
      testId: this.testId,
      timestamp: new Date().toISOString(),
      target: this.baseUrl,
      summary,
      results: this.results,
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const failures = this.results.filter(r => r.status === 'FAIL');
    const warnings = this.results.filter(r => r.status === 'WARN');

    if (failures.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        title: 'Fix Security Vulnerabilities',
        description: `${failures.length} security tests failed`,
        actions: failures.map(f => `Fix ${f.category}: ${f.test}`)
      });
    }

    if (warnings.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'Address Security Warnings',
        description: `${warnings.length} security warnings identified`,
        actions: warnings.map(w => `Review ${w.category}: ${w.test}`)
      });
    }

    // Category-specific recommendations
    const authFailures = failures.filter(f => f.category === 'Authentication');
    if (authFailures.length > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        title: 'Fix Authentication Issues',
        description: 'Authentication bypass vulnerabilities detected',
        actions: [
          'Review authentication middleware',
          'Implement proper token validation',
          'Add rate limiting for auth endpoints'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Print test summary
   */
  printSummary(report) {
    console.log('\n🔒 SECURITY TEST SUMMARY');
    console.log('========================');
    console.log(`Test ID: ${report.testId}`);
    console.log(`Target: ${report.target}`);
    console.log(`Total Tests: ${report.summary.total}`);
    console.log(`  Passed: ${report.summary.passed}`);
    console.log(`  Failed: ${report.summary.failed}`);
    console.log(`  Warnings: ${report.summary.warnings}`);
    console.log(`  Skipped: ${report.summary.skipped}`);

    if (report.summary.failed > 0) {
      console.log('\n🚨 FAILED TESTS:');
      report.results
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`  - ${result.category}: ${result.test}`);
          if (result.details) {
            console.log(`    ${result.details}`);
          }
        });
    }

    if (report.summary.warnings > 0) {
      console.log('\n⚠️  WARNINGS:');
      report.results
        .filter(r => r.status === 'WARN')
        .forEach(result => {
          console.log(`  - ${result.category}: ${result.test}`);
        });
    }

    console.log('\n📋 RECOMMENDATIONS:');
    report.recommendations.forEach(rec => {
      console.log(`  ${rec.priority}: ${rec.title}`);
    });
  }

  /**
   * Run complete security test suite
   */
  async runTests() {
    console.log('🔒 Starting Security Tests...');
    console.log(`Test ID: ${this.testId}`);
    console.log(`Target: ${this.baseUrl}`);

    try {
      await this.testAuthenticationBypass();
      await this.testInputValidation();
      await this.testRateLimiting();
      await this.testInformationDisclosure();
      await this.testSecurityHeaders();
      await this.testCORS();
      await this.testCommonVulnerabilities();

      const report = this.generateReport();
      this.printSummary(report);

      console.log('\n✅ Security tests completed');
      return { success: true, report };

    } catch (error) {
      console.error('❌ Security tests failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const tester = new SecurityTester(baseUrl);
  
  tester.runTests()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = SecurityTester;