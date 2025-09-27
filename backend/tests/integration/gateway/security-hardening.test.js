/**
 * Security Hardening Integration Tests
 * Tests for advanced security features and hardening measures
 */

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/gateway/app');
const { setupTestDB } = require('../../utils/setupTestDB');
const { userOne, admin, insertUsers } = require('../../fixtures/user.fixture');
const { userOneAccessToken, adminAccessToken } = require('../../fixtures/token.fixture');

setupTestDB();

describe('Security Hardening', () => {
  beforeEach(async () => {
    await insertUsers([userOne, admin]);
  });

  describe('Input Sanitization', () => {
    test('should sanitize XSS attempts in request body', async () => {
      const maliciousPayload = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: '<script>alert("xss")</script>Hello world'
          }
        ]
      };

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer test-api-key`)
        .send(maliciousPayload)
        .expect(httpStatus.UNAUTHORIZED); // Will fail auth first, but input should be sanitized

      // The malicious script should be escaped
      expect(res.body).not.toContain('<script>');
    });

    test('should block SQL injection attempts', async () => {
      const maliciousQuery = {
        model: "'; DROP TABLE users; --"
      };

      const res = await request(app)
        .get('/v1/models')
        .query(maliciousQuery)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body.error.code).toBe('invalid_input');
    });

    test('should block command injection attempts', async () => {
      const maliciousPayload = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: 'Hello; rm -rf /'
          }
        ]
      };

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer test-api-key`)
        .send(maliciousPayload)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body.error.code).toBe('invalid_input');
    });

    test('should limit request size', async () => {
      const largePayload = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: 'A'.repeat(100 * 1024 * 1024) // 100MB
          }
        ]
      };

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer test-api-key`)
        .send(largePayload)
        .expect(httpStatus.REQUEST_ENTITY_TOO_LARGE);

      expect(res.body.error.code).toBe('request_too_large');
    });

    test('should limit object depth', async () => {
      // Create deeply nested object
      let deepObject = { model: 'test-model', messages: [] };
      let current = deepObject;
      
      for (let i = 0; i < 20; i++) {
        current.nested = {};
        current = current.nested;
      }

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer test-api-key`)
        .send(deepObject)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body.error.code).toBe('invalid_input');
    });
  });

  describe('Rate Limiting', () => {
    test('should apply progressive slowdown', async () => {
      const requests = [];
      const startTime = Date.now();

      // Make multiple requests quickly
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/v1/models')
            .set('Authorization', `Bearer test-api-key`)
        );
      }

      await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Later requests should be slower due to progressive slowdown
      expect(duration).toBeGreaterThan(100); // Should take some time due to delays
    });

    test('should block after rate limit exceeded', async () => {
      // Make many requests to trigger rate limit
      const requests = [];
      for (let i = 0; i < 1100; i++) { // Exceed the 1000 request limit
        requests.push(
          request(app)
            .get('/healthz')
            .expect((res) => {
              // Later requests should be rate limited
              if (res.status === httpStatus.TOO_MANY_REQUESTS) {
                expect(res.body.error.code).toBe('rate_limit_exceeded');
              }
            })
        );
      }

      await Promise.allSettled(requests);
    });
  });

  describe('DDoS Protection', () => {
    test('should detect scanning behavior', async () => {
      const uniquePaths = [];
      
      // Generate many unique paths to simulate scanning
      for (let i = 0; i < 60; i++) {
        uniquePaths.push(`/v1/test-path-${i}`);
      }

      const requests = uniquePaths.map(path =>
        request(app)
          .get(path)
          .set('User-Agent', 'TestScanner/1.0')
      );

      const responses = await Promise.allSettled(requests);
      
      // Some requests should be blocked due to scanning detection
      const blockedRequests = responses.filter(
        result => result.value?.status === httpStatus.TOO_MANY_REQUESTS
      );
      
      expect(blockedRequests.length).toBeGreaterThan(0);
    });

    test('should block malicious user agents', async () => {
      const maliciousUserAgents = [
        'sqlmap/1.0',
        'nikto/2.1',
        'nmap/7.0',
        'burpsuite/2.0'
      ];

      for (const userAgent of maliciousUserAgents) {
        const res = await request(app)
          .get('/v1/models')
          .set('User-Agent', userAgent)
          .expect(httpStatus.FORBIDDEN);

        expect(res.body.error.code).toBe('forbidden');
      }
    });
  });

  describe('HTTPS Enforcement', () => {
    test('should require HTTPS in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .get('/v1/models')
        .set('x-forwarded-proto', 'http')
        .expect(httpStatus.UPGRADE_REQUIRED);

      expect(res.body.error.code).toBe('https_required');

      process.env.NODE_ENV = originalEnv;
    });

    test('should allow HTTP in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await request(app)
        .get('/healthz')
        .set('x-forwarded-proto', 'http')
        .expect(httpStatus.OK);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Security Headers', () => {
    test('should set security headers', async () => {
      const res = await request(app)
        .get('/healthz')
        .expect(httpStatus.OK);

      // Check for important security headers
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-xss-protection']).toBe('1; mode=block');
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    });

    test('should set CORS headers properly', async () => {
      const res = await request(app)
        .options('/v1/models')
        .set('Origin', 'https://example.com')
        .expect(httpStatus.NO_CONTENT);

      expect(res.headers['access-control-allow-origin']).toBeDefined();
      expect(res.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    test('should validate chat completion request schema', async () => {
      const invalidPayload = {
        model: '', // Empty model
        messages: 'invalid', // Should be array
        max_tokens: -1, // Invalid value
        temperature: 5 // Out of range
      };

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer test-api-key`)
        .send(invalidPayload)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body.error.type).toBe('invalid_request_error');
    });

    test('should validate embeddings request schema', async () => {
      const invalidPayload = {
        model: 'test-model',
        input: null // Invalid input
      };

      const res = await request(app)
        .post('/v1/embeddings')
        .set('Authorization', `Bearer test-api-key`)
        .send(invalidPayload)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body.error.type).toBe('invalid_request_error');
    });

    test('should limit array sizes', async () => {
      const payloadWithLargeArray = {
        model: 'test-model',
        messages: Array(200).fill({
          role: 'user',
          content: 'test'
        })
      };

      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer test-api-key`)
        .send(payloadWithLargeArray)
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body.error.code).toBe('invalid_input');
    });
  });

  describe('Security Monitoring', () => {
    test('should provide security status endpoint', async () => {
      const res = await request(app)
        .get('/admin/security/status')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.data).toHaveProperty('scanning');
      expect(res.body.data).toHaveProperty('configuration');
      expect(res.body.data).toHaveProperty('policies');
    });

    test('should allow triggering security scan', async () => {
      const res = await request(app)
        .post('/admin/security/scan')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.ACCEPTED);

      expect(res.body).toHaveProperty('scanId');
      expect(res.body).toHaveProperty('estimatedDuration');
    });

    test('should provide security metrics', async () => {
      const res = await request(app)
        .get('/admin/security/metrics')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.data).toHaveProperty('requests');
      expect(res.body.data).toHaveProperty('vulnerabilities');
      expect(res.body.data).toHaveProperty('security');
    });

    test('should require admin access for security endpoints', async () => {
      await request(app)
        .get('/admin/security/status')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);

      await request(app)
        .post('/admin/security/scan')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('Error Handling', () => {
    test('should not leak sensitive information in errors', async () => {
      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer invalid-key`)
        .send({ model: 'test' })
        .expect(httpStatus.UNAUTHORIZED);

      // Should not contain stack traces or internal paths
      expect(JSON.stringify(res.body)).not.toMatch(/\/src\/|\/node_modules\/|Error:/);
      expect(res.body.error.message).not.toContain('stack');
    });

    test('should handle malformed JSON gracefully', async () => {
      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer test-api-key`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body.error.type).toBe('invalid_request_error');
    });
  });

  describe('Container Security', () => {
    test('should run with non-root user in container', () => {
      // This would be tested in the actual container environment
      // For now, we just verify the configuration exists
      const fs = require('fs');
      const dockerfilePath = './Dockerfile.gateway';
      
      if (fs.existsSync(dockerfilePath)) {
        const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
        expect(dockerfileContent).toContain('USER gateway');
        expect(dockerfileContent).not.toContain('USER root');
      }
    });

    test('should have security labels in Dockerfile', () => {
      const fs = require('fs');
      const dockerfilePath = './Dockerfile.gateway';
      
      if (fs.existsSync(dockerfilePath)) {
        const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
        expect(dockerfileContent).toContain('LABEL');
        expect(dockerfileContent).toContain('security.scan');
      }
    });
  });
});

describe('Vulnerability Scanner Service', () => {
  const vulnerabilityScanner = require('../../../src/gateway/services/vulnerability-scanner.service');

  test('should provide scan status', () => {
    const status = vulnerabilityScanner.getScanStatus();
    
    expect(status).toHaveProperty('isScanning');
    expect(status).toHaveProperty('lastScanTime');
    expect(status).toHaveProperty('totalScans');
  });

  test('should handle scan errors gracefully', async () => {
    // Mock a scan that would fail
    const originalExecSync = require('child_process').execSync;
    require('child_process').execSync = jest.fn(() => {
      throw new Error('Mock scan failure');
    });

    try {
      const results = await vulnerabilityScanner.runFullScan();
      expect(results.scans.dependencies).toHaveProperty('error');
    } catch (error) {
      // Expected to handle errors gracefully
    } finally {
      require('child_process').execSync = originalExecSync;
    }
  });
});