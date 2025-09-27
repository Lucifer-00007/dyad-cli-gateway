const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/gateway/app');
const setupTestDB = require('../../utils/setupTestDB');
const { User, ApiKey, Provider } = require('../../../src/models');
const { userOne, admin, insertUsers } = require('../../fixtures/user.fixture');
const { userOneAccessToken, adminAccessToken } = require('../../fixtures/token.fixture');

setupTestDB();

describe('Admin Provider Management Endpoints', () => {
  beforeEach(async () => {
    await insertUsers([userOne, admin]);
  });

  describe('POST /admin/providers', () => {
    let newProvider;

    beforeEach(() => {
      newProvider = {
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'spawn-cli',
        description: 'A test provider for CLI commands',
        enabled: true,
        models: [
          {
            dyadModelId: 'test-model-1',
            adapterModelId: 'test-cli-model',
            maxTokens: 4096,
            contextWindow: 8192,
            supportsStreaming: false,
            supportsEmbeddings: false,
          },
        ],
        adapterConfig: {
          command: '/usr/bin/test-cli',
          args: ['--json'],
          dockerSandbox: true,
          sandboxImage: 'test:latest',
          timeoutSeconds: 30,
        },
        credentials: {
          apiKey: 'test-api-key',
        },
        rateLimits: {
          requestsPerMinute: 100,
          tokensPerMinute: 50000,
        },
      };
    });

    test('should return 201 and successfully create provider if data is ok', async () => {
      const res = await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newProvider)
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.anything(),
        name: newProvider.name,
        slug: newProvider.slug,
        type: newProvider.type,
        description: newProvider.description,
        enabled: newProvider.enabled,
        models: expect.arrayContaining([
          expect.objectContaining({
            dyadModelId: 'test-model-1',
            adapterModelId: 'test-cli-model',
            maxTokens: 4096,
          }),
        ]),
        adapterConfig: expect.objectContaining({
          command: '/usr/bin/test-cli',
          args: ['--json'],
        }),
        rateLimits: expect.objectContaining({
          requestsPerMinute: 100,
          tokensPerMinute: 50000,
        }),
        healthStatus: expect.objectContaining({
          status: expect.any(String),
        }),
      });

      // Credentials should not be returned
      expect(res.body.credentials).toBeUndefined();

      const dbProvider = await Provider.findById(res.body.id);
      expect(dbProvider).toBeDefined();
      expect(dbProvider.name).toBe(newProvider.name);
      expect(dbProvider.slug).toBe(newProvider.slug);
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .post('/admin/providers')
        .send(newProvider)
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(newProvider)
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 400 error if slug is already taken', async () => {
      await Provider.create(newProvider);

      await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newProvider)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if required fields are missing', async () => {
      delete newProvider.name;
      delete newProvider.slug;

      await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newProvider)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if adapter config is invalid for type', async () => {
      newProvider.type = 'http-sdk';
      // Missing baseUrl for http-sdk type

      await request(app)
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newProvider)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /admin/providers', () => {
    beforeEach(async () => {
      const providers = [
        {
          name: 'Provider 1',
          slug: 'provider-1',
          type: 'spawn-cli',
          enabled: true,
          models: [{ dyadModelId: 'model-1', adapterModelId: 'adapter-1' }],
          adapterConfig: { command: 'test1' },
        },
        {
          name: 'Provider 2',
          slug: 'provider-2',
          type: 'http-sdk',
          enabled: false,
          models: [{ dyadModelId: 'model-2', adapterModelId: 'adapter-2' }],
          adapterConfig: { baseUrl: 'https://api.example.com' },
        },
      ];
      await Provider.insertMany(providers);
    });

    test('should return 200 and apply the default query options', async () => {
      const res = await request(app)
        .get('/admin/providers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 2,
      });
      expect(res.body.results).toHaveLength(2);
    });

    test('should return 200 and apply filtering', async () => {
      const res = await request(app)
        .get('/admin/providers')
        .query({ enabled: 'true' })
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].enabled).toBe(true);
    });

    test('should return 401 if access token is missing', async () => {
      await request(app)
        .get('/admin/providers')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 if user is not admin', async () => {
      await request(app)
        .get('/admin/providers')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /admin/providers/:providerId', () => {
    let provider;

    beforeEach(async () => {
      provider = await Provider.create({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'spawn-cli',
        models: [{ dyadModelId: 'model-1', adapterModelId: 'adapter-1' }],
        adapterConfig: { command: 'test' },
        credentials: { apiKey: 'secret' },
      });
    });

    test('should return 200 and the provider object if data is ok', async () => {
      const res = await request(app)
        .get(`/admin/providers/${provider._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: provider._id.toHexString(),
        name: provider.name,
        slug: provider.slug,
        type: provider.type,
        enabled: expect.any(Boolean),
        models: expect.any(Array),
        adapterConfig: expect.any(Object),
        rateLimits: expect.any(Object),
        healthStatus: expect.any(Object),
      });
      // Credentials should not be returned
      expect(res.body.credentials).toBeUndefined();
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .get(`/admin/providers/${provider._id}`)
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .get(`/admin/providers/${provider._id}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 404 error if provider is not found', async () => {
      await request(app)
        .get('/admin/providers/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 400 error if providerId is not a valid mongo id', async () => {
      await request(app)
        .get('/admin/providers/invalidId')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('PATCH /admin/providers/:providerId', () => {
    let provider;

    beforeEach(async () => {
      provider = await Provider.create({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'spawn-cli',
        models: [{ dyadModelId: 'model-1', adapterModelId: 'adapter-1' }],
        adapterConfig: { command: 'test' },
      });
    });

    test('should return 200 and successfully update provider if data is ok', async () => {
      const updateBody = {
        name: 'Updated Provider',
        description: 'Updated description',
        enabled: false,
      };

      const res = await request(app)
        .patch(`/admin/providers/${provider._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: provider._id.toHexString(),
        name: updateBody.name,
        slug: provider.slug,
        type: provider.type,
        description: updateBody.description,
        enabled: updateBody.enabled,
        models: expect.any(Array),
        adapterConfig: expect.any(Object),
        rateLimits: expect.any(Object),
        healthStatus: expect.any(Object),
      });

      const dbProvider = await Provider.findById(provider._id);
      expect(dbProvider.name).toBe(updateBody.name);
      expect(dbProvider.description).toBe(updateBody.description);
      expect(dbProvider.enabled).toBe(updateBody.enabled);
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .patch(`/admin/providers/${provider._id}`)
        .send({ name: 'Updated' })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .patch(`/admin/providers/${provider._id}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ name: 'Updated' })
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 404 error if provider is not found', async () => {
      await request(app)
        .patch('/admin/providers/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ name: 'Updated' })
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 400 error if slug is already taken', async () => {
      await Provider.create({
        name: 'Another Provider',
        slug: 'another-provider',
        type: 'spawn-cli',
        models: [{ dyadModelId: 'model-2', adapterModelId: 'adapter-2' }],
        adapterConfig: { command: 'test2' },
      });

      await request(app)
        .patch(`/admin/providers/${provider._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ slug: 'another-provider' })
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('DELETE /admin/providers/:providerId', () => {
    let provider;

    beforeEach(async () => {
      provider = await Provider.create({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'spawn-cli',
        models: [{ dyadModelId: 'model-1', adapterModelId: 'adapter-1' }],
        adapterConfig: { command: 'test' },
      });
    });

    test('should return 204 if data is ok', async () => {
      await request(app)
        .delete(`/admin/providers/${provider._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.NO_CONTENT);

      const dbProvider = await Provider.findById(provider._id);
      expect(dbProvider).toBeNull();
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .delete(`/admin/providers/${provider._id}`)
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .delete(`/admin/providers/${provider._id}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 404 error if provider is not found', async () => {
      await request(app)
        .delete('/admin/providers/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('POST /admin/providers/:providerId/test', () => {
    let provider;

    beforeEach(async () => {
      provider = await Provider.create({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'spawn-cli',
        enabled: true,
        models: [
          {
            dyadModelId: 'test-model',
            adapterModelId: 'test-cli-model',
            maxTokens: 100,
          },
        ],
        adapterConfig: {
          command: 'echo',
          args: ['test'],
          dockerSandbox: false, // Disable sandbox for testing
        },
      });
    });

    test('should return 200 and test result for dry run', async () => {
      const res = await request(app)
        .post(`/admin/providers/${provider._id}/test`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ dryRun: true })
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        status: 'success',
        message: expect.stringContaining('dry run'),
        timestamp: expect.any(String),
        duration: expect.any(Number),
        providerId: provider._id.toHexString(),
        providerName: provider.name,
        providerType: provider.type,
        dryRun: true,
      });
    });

    test('should return 200 and skip test for disabled provider', async () => {
      await Provider.findByIdAndUpdate(provider._id, { enabled: false });

      const res = await request(app)
        .post(`/admin/providers/${provider._id}/test`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ dryRun: false })
        .expect(httpStatus.OK);

      expect(res.body.status).toBe('skipped');
      expect(res.body.message).toContain('disabled');
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .post(`/admin/providers/${provider._id}/test`)
        .send({ dryRun: true })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .post(`/admin/providers/${provider._id}/test`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ dryRun: true })
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 404 error if provider is not found', async () => {
      await request(app)
        .post('/admin/providers/507f1f77bcf86cd799439011/test')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ dryRun: true })
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('POST /admin/providers/:providerId/health', () => {
    let provider;

    beforeEach(async () => {
      provider = await Provider.create({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'spawn-cli',
        enabled: true,
        models: [{ dyadModelId: 'model-1', adapterModelId: 'adapter-1' }],
        adapterConfig: { command: 'test' },
      });
    });

    test('should return 200 and health check result', async () => {
      const res = await request(app)
        .post(`/admin/providers/${provider._id}/health`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        status: expect.any(String),
        message: expect.any(String),
        timestamp: expect.any(String),
        duration: expect.any(Number),
        providerId: provider._id.toHexString(),
        providerName: provider.name,
        providerType: provider.type,
        lastChecked: expect.anything(),
      });
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .post(`/admin/providers/${provider._id}/health`)
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .post(`/admin/providers/${provider._id}/health`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 404 error if provider is not found', async () => {
      await request(app)
        .post('/admin/providers/507f1f77bcf86cd799439011/health')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });
  });
});