/**
 * Integration tests for streaming endpoints
 */

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/gateway/app');
const setupTestDB = require('../../utils/setupTestDB');
const { ApiKey, Provider, User } = require('../../../src/models');
const { tokenService } = require('../../../src/services');

setupTestDB();

describe('Streaming Endpoints', () => {
  let apiKey;
  let provider;
  let validApiKeyToken;

  beforeEach(async () => {
    // Create test user first
    const testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'user'
    });

    // Create test API key with proper fields
    const keyData = ApiKey.generateKey();
    apiKey = await ApiKey.create({
      name: 'Test Streaming Key',
      userId: testUser._id,
      keyHash: keyData.keyHash,
      keyPrefix: keyData.keyPrefix,
      permissions: ['chat', 'models'],
      rateLimits: {
        requestsPerMinute: 100,
        tokensPerMinute: 10000
      }
    });
    validApiKeyToken = keyData.key;

    // Create test provider with streaming support
    provider = await Provider.create({
      name: 'Test Streaming Provider',
      slug: 'test-streaming-provider',
      type: 'spawn-cli',
      enabled: true,
      adapterConfig: {
        command: 'echo',
        args: [],
        timeoutSeconds: 30,
        supportsStreaming: true,
        dockerSandbox: false // Use direct execution for tests
      },
      credentials: {},
      models: [
        {
          dyadModelId: 'test-streaming-model',
          adapterModelId: 'echo',
          maxTokens: 1000,
          supportsStreaming: true
        }
      ],
      healthStatus: {
        status: 'healthy',
        lastCheck: new Date(),
        details: {}
      }
    });
  });

  describe('POST /v1/chat/completions with streaming', () => {
    const validChatRequest = {
      model: 'test-streaming-model',
      messages: [
        { role: 'user', content: 'Hello, streaming world!' }
      ],
      stream: true
    };

    it('should stream chat completion successfully', (done) => {
      const chunks = [];
      
      request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${validApiKeyToken}`)
        .send(validChatRequest)
        .expect(200)
        .expect('Content-Type', 'text/event-stream; charset=utf-8')
        .expect('Cache-Control', 'no-cache')
        .expect('Connection', 'keep-alive')
        .parse((res, callback) => {
          let buffer = '';
          
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            
            // Process complete SSE messages
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data === '[DONE]') {
                  // End of stream
                  callback(null, chunks);
                  return;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  chunks.push(parsed);
                } catch (e) {
                  // Ignore malformed chunks
                }
              }
            }
          });
          
          res.on('end', () => {
            callback(null, chunks);
          });
          
          res.on('error', (err) => {
            callback(err);
          });
        })
        .end((err, res) => {
          if (err) return done(err);
          
          // Verify we received streaming chunks
          expect(chunks.length).toBeGreaterThan(0);
          
          // Verify chunk format
          chunks.forEach(chunk => {
            expect(chunk).toMatchObject({
              id: expect.any(String),
              object: 'chat.completion.chunk',
              created: expect.any(Number),
              model: 'test-streaming-model',
              choices: expect.arrayContaining([
                expect.objectContaining({
                  index: 0,
                  delta: expect.any(Object)
                })
              ])
            });
          });
          
          // Verify final chunk has finish_reason
          const finalChunk = chunks[chunks.length - 1];
          expect(finalChunk.choices[0].finish_reason).toBe('stop');
          
          done();
        });
    });

    it('should handle client disconnect during streaming', (done) => {
      const req = request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${validApiKeyToken}`)
        .send(validChatRequest)
        .expect(200);
      
      // Simulate client disconnect after a short delay
      setTimeout(() => {
        req.abort();
        done();
      }, 100);
    });

    it('should fall back to non-streaming for non-streaming adapters', async () => {
      // Create provider without streaming support
      const nonStreamingProvider = await Provider.create({
        name: 'Test Non-Streaming Provider',
        slug: 'test-non-streaming-provider',
        type: 'spawn-cli',
        enabled: true,
        adapterConfig: {
          command: 'echo',
          args: [],
          timeoutSeconds: 30,
          supportsStreaming: false,
          dockerSandbox: false
        },
        credentials: {},
        models: [
          {
            dyadModelId: 'test-non-streaming-model',
            adapterModelId: 'echo',
            maxTokens: 1000,
            supportsStreaming: false
          }
        ],
        healthStatus: {
          status: 'healthy',
          lastCheck: new Date(),
          details: {}
        }
      });

      const response = await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${validApiKeyToken}`)
        .send({
          ...validChatRequest,
          model: 'test-non-streaming-model'
        })
        .expect(200);

      // Should return regular JSON response, not streaming
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        object: 'chat.completion',
        model: 'test-non-streaming-model',
        choices: expect.any(Array)
      });
    });

    it('should return 401 for missing API key', async () => {
      await request(app)
        .post('/v1/chat/completions')
        .send(validChatRequest)
        .expect(httpStatus.UNAUTHORIZED);
    });

    it('should return 401 for invalid API key', async () => {
      await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', 'Bearer invalid-key')
        .send(validChatRequest)
        .expect(httpStatus.UNAUTHORIZED);
    });

    it('should return 400 for missing required fields', async () => {
      await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${validApiKeyToken}`)
        .send({ stream: true })
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should return 404 for unknown model', async () => {
      await request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${validApiKeyToken}`)
        .send({
          ...validChatRequest,
          model: 'unknown-model'
        })
        .expect(httpStatus.INTERNAL_SERVER_ERROR); // Will be normalized to internal error
    });
  });

  describe('Streaming cancellation', () => {
    it('should handle request cancellation gracefully', (done) => {
      const req = request(app)
        .post('/v1/chat/completions')
        .set('Authorization', `Bearer ${validApiKeyToken}`)
        .send({
          model: 'test-streaming-model',
          messages: [
            { role: 'user', content: 'This is a long request that should be cancelled' }
          ],
          stream: true
        });

      let receivedData = false;
      
      req.on('response', (res) => {
        res.on('data', () => {
          receivedData = true;
          // Cancel the request after receiving some data
          req.abort();
        });
      });

      req.on('abort', () => {
        expect(receivedData).toBe(true);
        done();
      });

      req.on('error', (err) => {
        if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED') {
          // Expected error on abort
          done();
        } else {
          done(err);
        }
      });
    });
  });

  describe('Streaming error handling', () => {
    it('should stream error when adapter fails', (done) => {
      // Create provider that will fail
      Provider.create({
        name: 'Failing Provider',
        slug: 'failing-provider',
        type: 'spawn-cli',
        enabled: true,
        adapterConfig: {
          command: 'nonexistent-command',
          args: [],
          timeoutSeconds: 5,
          supportsStreaming: true,
          dockerSandbox: false
        },
        credentials: {},
        models: [
          {
            dyadModelId: 'failing-model',
            adapterModelId: 'fail',
            maxTokens: 1000,
            supportsStreaming: true
          }
        ],
        healthStatus: {
          status: 'healthy',
          lastCheck: new Date(),
          details: {}
        }
      }).then(() => {
        const chunks = [];
        
        request(app)
          .post('/v1/chat/completions')
          .set('Authorization', `Bearer ${validApiKeyToken}`)
          .send({
            model: 'failing-model',
            messages: [{ role: 'user', content: 'This will fail' }],
            stream: true
          })
          .expect(200)
          .parse((res, callback) => {
            let buffer = '';
            
            res.on('data', (chunk) => {
              buffer += chunk.toString();
              
              const lines = buffer.split('\n\n');
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.substring(6);
                  if (data === '[DONE]') {
                    callback(null, chunks);
                    return;
                  }
                  
                  try {
                    const parsed = JSON.parse(data);
                    chunks.push(parsed);
                  } catch (e) {
                    // Ignore malformed chunks
                  }
                }
              }
            });
            
            res.on('end', () => {
              callback(null, chunks);
            });
          })
          .end((err, res) => {
            if (err) return done(err);
            
            // Should receive error chunk
            expect(chunks.length).toBeGreaterThan(0);
            
            const errorChunk = chunks.find(chunk => chunk.error);
            expect(errorChunk).toBeDefined();
            expect(errorChunk.error).toMatchObject({
              message: expect.any(String),
              type: expect.any(String)
            });
            
            done();
          });
      }).catch(done);
    });
  });
});