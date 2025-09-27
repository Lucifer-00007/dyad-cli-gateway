/**
 * OpenAPI Contract Tests
 * Validates that the API responses match the OpenAPI specification
 */

const request = require('supertest');
const httpStatus = require('http-status');
const YAML = require('yaml');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const app = require('../../../src/gateway/app');
const setupTestDB = require('../../utils/setupTestDB');
const { userOne, admin, insertUsers } = require('../../fixtures/user.fixture');
const { userOneAccessToken, adminAccessToken } = require('../../fixtures/token.fixture');
const { ApiKey } = require('../../../src/models');

// Load OpenAPI specification
const openApiPath = path.join(__dirname, '../../../../md-docs/openapi.yaml');
const openApiSpec = YAML.parse(fs.readFileSync(openApiPath, 'utf8'));

// Setup JSON Schema validator
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Add OpenAPI schemas to validator
Object.entries(openApiSpec.components.schemas).forEach(([name, schema]) => {
  ajv.addSchema(schema, `#/components/schemas/${name}`);
});

setupTestDB();

describe('OpenAPI Contract Tests', () => {
  let apiKey;
  let apiKeyString;

  beforeEach(async () => {
    await insertUsers([userOne, admin]);
    
    // Create test API key
    apiKeyString = ApiKey.generateKey();
    const keyHash = await ApiKey.hashKey(apiKeyString);
    const keyPrefix = ApiKey.getKeyPrefix(apiKeyString);
    
    apiKey = await ApiKey.create({
      name: 'Test API Key',
      keyHash,
      keyPrefix,
      userId: userOne._id,
      permissions: ['chat', 'models', 'embeddings'],
      enabled: true,
    });
  });

  describe('Health Endpoints', () => {
    describe('GET /health', () => {
      test('should return health status matching OpenAPI schema', async () => {
        const res = await request(app)
          .get('/health')
          .expect(httpStatus.OK);

        // Validate response against OpenAPI schema
        const validate = ajv.compile(openApiSpec.components.schemas.HealthResponse);
        const valid = validate(res.body);
        
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);

        // Verify required fields
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('uptime');
        expect(res.body).toHaveProperty('service', 'dyad-cli-gateway');
        expect(typeof res.body.uptime).toBe('number');
      });
    });

    describe('GET /ready', () => {
      test('should return readiness status matching OpenAPI schema', async () => {
        const res = await request(app)
          .get('/ready')
          .expect(httpStatus.OK);

        // Validate response against OpenAPI schema
        const validate = ajv.compile(openApiSpec.components.schemas.ReadinessResponse);
        const valid = validate(res.body);
        
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);

        // Verify required fields
        expect(res.body).toHaveProperty('status', 'ready');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('checks');
        expect(res.body.checks).toHaveProperty('database');
      });
    });
  });

  describe('OpenAI v1 Endpoints', () => {
    describe('GET /v1/models', () => {
      test('should return models list matching OpenAPI schema', async () => {
        const res = await request(app)
          .get('/v1/models')
          .set('Authorization', `Bearer ${apiKeyString}`)
          .expect(httpStatus.OK);

        // Validate response against OpenAPI schema
        const validate = ajv.compile(openApiSpec.components.schemas.ModelsResponse);
        const valid = validate(res.body);
        
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);

        // Verify structure
        expect(res.body).toHaveProperty('object', 'list');
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      test('should return 401 for missing API key matching OpenAPI error schema', async () => {
        const res = await request(app)
          .get('/v1/models')
          .expect(httpStatus.UNAUTHORIZED);

        // Validate error response against OpenAPI schema
        const validate = ajv.compile(openApiSpec.components.schemas.ErrorResponse);
        const valid = validate(res.body);
        
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);

        // Verify error structure
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('type', 'authentication_error');
        expect(res.body.error).toHaveProperty('code', 'missing_authorization');
      });
    });

    describe('POST /v1/chat/completions', () => {
      test('should validate request body against OpenAPI schema', async () => {
        const requestBody = {
          model: 'test-model',
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          max_tokens: 100,
          temperature: 0.7
        };

        // Validate request body against OpenAPI schema
        const validate = ajv.compile(openApiSpec.components.schemas.ChatCompletionRequest);
        const valid = validate(requestBody);
        
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);
      });

      test('should return 400 for invalid request matching OpenAPI error schema', async () => {
        const res = await request(app)
          .post('/v1/chat/completions')
          .set('Authorization', `Bearer ${apiKeyString}`)
          .send({
            model: 'test-model',
            // Missing required messages field
          })
          .expect(httpStatus.BAD_REQUEST);

        // Validate error response against OpenAPI schema
        const validate = ajv.compile(openApiSpec.components.schemas.ErrorResponse);
        const valid = validate(res.body);
        
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);

        // Verify error structure
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('type', 'invalid_request_error');
        expect(res.body.error).toHaveProperty('code', 'invalid_request');
      });

      test('should validate chat message schema', async () => {
        const validMessages = [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ];

        const messageSchema = openApiSpec.components.schemas.ChatMessage;
        const validate = ajv.compile(messageSchema);

        validMessages.forEach(message => {
          const valid = validate(message);
          if (!valid) {
            console.error('Message validation errors:', validate.errors);
          }
          expect(valid).toBe(true);
        });
      });
    });

    describe('POST /v1/embeddings', () => {
      test('should validate request body against OpenAPI schema', async () => {
        const requestBody = {
          model: 'text-embedding-ada-002',
          input: 'Hello world',
          encoding_format: 'float'
        };

        // Validate request body against OpenAPI schema
        const validate = ajv.compile(openApiSpec.components.schemas.EmbeddingsRequest);
        const valid = validate(requestBody);
        
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);
      });

      test('should validate array input format', async () => {
        const requestBody = {
          model: 'text-embedding-ada-002',
          input: ['Hello', 'World', 'Test'],
          encoding_format: 'base64'
        };

        // Validate request body against OpenAPI schema
        const validate = ajv.compile(openApiSpec.components.schemas.EmbeddingsRequest);
        const valid = validate(requestBody);
        
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);
      });
    });
  });

  describe('Admin Endpoints', () => {
    describe('Provider Management', () => {
      test('should validate create provider request schema', async () => {
        const createProviderRequest = {
          name: 'Test Provider',
          slug: 'test-provider',
          type: 'spawn-cli',
          description: 'A test provider',
          enabled: true,
          models: [
            {
              dyadModelId: 'test-model',
              adapterModelId: 'test-model-internal',
              maxTokens: 2048,
              contextWindow: 4096,
              supportsStreaming: false,
              supportsEmbeddings: true
            }
          ],
          adapterConfig: {
            command: '/usr/bin/test',
            args: ['--json'],
            dockerSandbox: true,
            timeoutSeconds: 60
          },
          credentials: {
            api_key: 'test-key'
          }
        };

        // Validate request body against OpenAPI schema
        const validate = ajv.compile(openApiSpec.components.schemas.CreateProviderRequest);
        const valid = validate(createProviderRequest);
        
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);
      });

      test('should validate update provider request schema', async () => {
        const updateProviderRequest = {
          enabled: false,
          description: 'Updated description',
          rateLimits: {
            requestsPerMinute: 30,
            tokensPerMinute: 5000
          }
        };

        // Validate request body against OpenAPI schema
        const validate = ajv.compile(openApiSpec.components.schemas.UpdateProviderRequest);
        const valid = validate(updateProviderRequest);
        
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);
      });

      test('should validate model mapping schema', async () => {
        const modelMapping = {
          dyadModelId: 'gpt-4',
          adapterModelId: 'gpt-4-internal',
          maxTokens: 4096,
          contextWindow: 8192,
          supportsStreaming: true,
          supportsEmbeddings: false
        };

        // Validate against OpenAPI schema
        const validate = ajv.compile(openApiSpec.components.schemas.ModelMapping);
        const valid = validate(modelMapping);
        
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);
      });

      test('should validate adapter config for different types', async () => {
        const adapterConfigs = [
          // Spawn-CLI config
          {
            command: '/usr/bin/gemini',
            args: ['--json'],
            dockerSandbox: true,
            sandboxImage: 'gemini:latest',
            memoryLimit: '1g',
            cpuLimit: '1.0',
            timeoutSeconds: 120
          },
          // HTTP-SDK config
          {
            baseUrl: 'https://api.example.com',
            headers: {
              'User-Agent': 'Dyad-Gateway/1.0'
            },
            timeoutSeconds: 30,
            retryAttempts: 3
          },
          // Proxy config
          {
            proxyUrl: 'https://proxy.example.com/v1',
            timeoutSeconds: 60
          },
          // Local config
          {
            localUrl: 'http://localhost:11434',
            healthCheckPath: '/api/health',
            timeoutSeconds: 45
          }
        ];

        const validate = ajv.compile(openApiSpec.components.schemas.AdapterConfig);

        adapterConfigs.forEach((config, index) => {
          const valid = validate(config);
          if (!valid) {
            console.error(`Config ${index} validation errors:`, validate.errors);
          }
          expect(valid).toBe(true);
        });
      });
    });

    test('should return 401 for admin endpoints without JWT token', async () => {
      const res = await request(app)
        .get('/admin/providers')
        .expect(httpStatus.UNAUTHORIZED);

      // Validate error response against OpenAPI schema
      const validate = ajv.compile(openApiSpec.components.schemas.ErrorResponse);
      const valid = validate(res.body);
      
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe('Schema Validation Edge Cases', () => {
    test('should reject invalid model IDs in chat completion', async () => {
      const invalidRequest = {
        model: '', // Empty model
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      };

      const validate = ajv.compile(openApiSpec.components.schemas.ChatCompletionRequest);
      const valid = validate(invalidRequest);
      
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    test('should reject invalid message roles', async () => {
      const invalidMessage = {
        role: 'invalid_role',
        content: 'Hello'
      };

      const validate = ajv.compile(openApiSpec.components.schemas.ChatMessage);
      const valid = validate(invalidMessage);
      
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    test('should reject invalid provider types', async () => {
      const invalidProvider = {
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'invalid-type',
        models: [
          {
            dyadModelId: 'test-model',
            adapterModelId: 'test-model-internal'
          }
        ],
        adapterConfig: {
          timeoutSeconds: 60
        }
      };

      const validate = ajv.compile(openApiSpec.components.schemas.CreateProviderRequest);
      const valid = validate(invalidProvider);
      
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    test('should reject invalid slug patterns', async () => {
      const invalidProvider = {
        name: 'Test Provider',
        slug: 'Invalid_Slug!', // Contains invalid characters
        type: 'spawn-cli',
        models: [
          {
            dyadModelId: 'test-model',
            adapterModelId: 'test-model-internal'
          }
        ],
        adapterConfig: {
          command: '/usr/bin/test',
          timeoutSeconds: 60
        }
      };

      const validate = ajv.compile(openApiSpec.components.schemas.CreateProviderRequest);
      const valid = validate(invalidProvider);
      
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    test('should validate memory limit patterns', async () => {
      const validLimits = ['512m', '1g', '2048k', '1024'];
      const invalidLimits = ['512x', 'invalid', '1.5g'];

      const adapterConfigSchema = openApiSpec.components.schemas.AdapterConfig;
      const validate = ajv.compile(adapterConfigSchema);

      validLimits.forEach(limit => {
        const config = { memoryLimit: limit };
        const valid = validate(config);
        if (!valid) {
          console.error(`Valid limit ${limit} failed:`, validate.errors);
        }
        expect(valid).toBe(true);
      });

      invalidLimits.forEach(limit => {
        const config = { memoryLimit: limit };
        const valid = validate(config);
        expect(valid).toBe(false);
      });
    });

    test('should validate CPU limit patterns', async () => {
      const validLimits = ['0.5', '1.0', '2', '0.25'];
      const invalidLimits = ['invalid', '1.5x', 'two'];

      const adapterConfigSchema = openApiSpec.components.schemas.AdapterConfig;
      const validate = ajv.compile(adapterConfigSchema);

      validLimits.forEach(limit => {
        const config = { cpuLimit: limit };
        const valid = validate(config);
        if (!valid) {
          console.error(`Valid limit ${limit} failed:`, validate.errors);
        }
        expect(valid).toBe(true);
      });

      invalidLimits.forEach(limit => {
        const config = { cpuLimit: limit };
        const valid = validate(config);
        expect(valid).toBe(false);
      });
    });
  });

  describe('Response Format Validation', () => {
    test('should validate usage schema format', async () => {
      const usage = {
        prompt_tokens: 25,
        completion_tokens: 20,
        total_tokens: 45
      };

      const validate = ajv.compile(openApiSpec.components.schemas.Usage);
      const valid = validate(usage);
      
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should validate health status schema', async () => {
      const healthStatus = {
        status: 'healthy',
        lastChecked: '2024-01-15T10:30:00.000Z'
      };

      const validate = ajv.compile(openApiSpec.components.schemas.HealthStatus);
      const valid = validate(healthStatus);
      
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should validate rate limits schema', async () => {
      const rateLimits = {
        requestsPerMinute: 60,
        tokensPerMinute: 10000
      };

      const validate = ajv.compile(openApiSpec.components.schemas.RateLimits);
      const valid = validate(rateLimits);
      
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });
  });
});