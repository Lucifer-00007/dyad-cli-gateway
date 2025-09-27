const faker = require('faker');
const { Provider } = require('../../../src/models');

describe('Provider model', () => {
  describe('Provider validation', () => {
    let newProvider;
    
    beforeEach(() => {
      newProvider = {
        name: faker.company.companyName(),
        slug: faker.lorem.slug(),
        type: 'spawn-cli',
        description: faker.lorem.sentence(),
        models: [{
          dyadModelId: 'test-model-1',
          adapterModelId: 'adapter-model-1',
          maxTokens: 4096,
          contextWindow: 8192,
          supportsStreaming: true,
          supportsEmbeddings: false,
        }],
        adapterConfig: {
          command: '/usr/bin/test-cli',
          args: ['--json'],
          timeoutSeconds: 60,
          dockerSandbox: true,
        },
        credentials: new Map([
          ['apiKey', 'test-api-key'],
          ['secret', 'test-secret'],
        ]),
      };
    });

    test('should correctly validate a valid provider', async () => {
      await expect(new Provider(newProvider).validate()).resolves.toBeUndefined();
    });

    test('should throw validation error if name is missing', async () => {
      delete newProvider.name;
      await expect(new Provider(newProvider).validate()).rejects.toThrow();
    });

    test('should throw validation error if slug is missing', async () => {
      delete newProvider.slug;
      await expect(new Provider(newProvider).validate()).rejects.toThrow();
    });

    test('should throw validation error if type is missing', async () => {
      delete newProvider.type;
      await expect(new Provider(newProvider).validate()).rejects.toThrow();
    });

    test('should throw validation error if type is invalid', async () => {
      newProvider.type = 'invalid-type';
      await expect(new Provider(newProvider).validate()).rejects.toThrow();
    });

    test('should throw validation error if slug contains invalid characters', async () => {
      newProvider.slug = 'Invalid Slug!';
      await expect(new Provider(newProvider).validate()).rejects.toThrow();
    });

    test('should throw validation error if adapterConfig is missing', async () => {
      delete newProvider.adapterConfig;
      await expect(new Provider(newProvider).validate()).rejects.toThrow();
    });

    test('should validate memory limit format', async () => {
      newProvider.adapterConfig.memoryLimit = 'invalid';
      await expect(new Provider(newProvider).validate()).rejects.toThrow();
      
      newProvider.adapterConfig.memoryLimit = '512m';
      await expect(new Provider(newProvider).validate()).resolves.toBeUndefined();
      
      newProvider.adapterConfig.memoryLimit = '1g';
      await expect(new Provider(newProvider).validate()).resolves.toBeUndefined();
    });

    test('should validate CPU limit format', async () => {
      newProvider.adapterConfig.cpuLimit = 'invalid';
      await expect(new Provider(newProvider).validate()).rejects.toThrow();
      
      newProvider.adapterConfig.cpuLimit = '0.5';
      await expect(new Provider(newProvider).validate()).resolves.toBeUndefined();
      
      newProvider.adapterConfig.cpuLimit = '2';
      await expect(new Provider(newProvider).validate()).resolves.toBeUndefined();
    });

    test('should validate URL fields', async () => {
      newProvider.type = 'http-sdk';
      newProvider.adapterConfig.baseUrl = 'invalid-url';
      await expect(new Provider(newProvider).validate()).rejects.toThrow();
      
      newProvider.adapterConfig.baseUrl = 'https://api.example.com';
      await expect(new Provider(newProvider).validate()).resolves.toBeUndefined();
    });
  });

  describe('Provider pre-save validation', () => {
    test('should require command for spawn-cli adapter', async () => {
      const provider = new Provider({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'spawn-cli',
        adapterConfig: {
          args: ['--json'],
        },
      });

      await expect(provider.save()).rejects.toThrow('Command is required for spawn-cli adapter');
    });

    test('should require baseUrl for http-sdk adapter', async () => {
      const provider = new Provider({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'http-sdk',
        adapterConfig: {
          timeoutSeconds: 60,
        },
      });

      await expect(provider.save()).rejects.toThrow('Base URL is required for http-sdk adapter');
    });

    test('should require proxyUrl for proxy adapter', async () => {
      const provider = new Provider({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'proxy',
        adapterConfig: {
          timeoutSeconds: 60,
        },
      });

      await expect(provider.save()).rejects.toThrow('Base URL is required for proxy adapter');
    });

    test('should require localUrl for local adapter', async () => {
      const provider = new Provider({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'local',
        adapterConfig: {
          timeoutSeconds: 60,
        },
      });

      await expect(provider.save()).rejects.toThrow('Base URL is required for local adapter');
    });
  });

  describe('Provider static methods', () => {
    test('should check if slug is taken', async () => {
      const mockProvider = { slug: 'existing-slug', _id: 'some-id' };
      Provider.findOne = jest.fn().mockResolvedValue(mockProvider);

      const isTaken = await Provider.isSlugTaken('existing-slug');
      expect(isTaken).toBe(true);
      expect(Provider.findOne).toHaveBeenCalledWith({
        slug: 'existing-slug',
        _id: { $ne: undefined },
      });
    });

    test('should get providers by model ID', async () => {
      const mockProviders = [
        { name: 'Provider 1', models: [{ dyadModelId: 'test-model' }] },
        { name: 'Provider 2', models: [{ dyadModelId: 'test-model' }] },
      ];
      Provider.find = jest.fn().mockResolvedValue(mockProviders);

      const providers = await Provider.getProvidersByModel('test-model');
      expect(providers).toEqual(mockProviders);
      expect(Provider.find).toHaveBeenCalledWith({
        enabled: true,
        'models.dyadModelId': 'test-model',
      });
    });

    test('should get all models across providers', async () => {
      const mockProviders = [
        {
          name: 'Provider 1',
          slug: 'provider-1',
          models: [{
            dyadModelId: 'model-1',
            maxTokens: 4096,
            contextWindow: 8192,
            supportsStreaming: true,
            supportsEmbeddings: false,
          }],
        },
        {
          name: 'Provider 2',
          slug: 'provider-2',
          models: [{
            dyadModelId: 'model-2',
            maxTokens: 2048,
            contextWindow: 4096,
            supportsStreaming: false,
            supportsEmbeddings: true,
          }],
        },
      ];
      Provider.find = jest.fn().mockResolvedValue(mockProviders);

      const models = await Provider.getAllModels();
      expect(models).toHaveLength(2);
      expect(models[0]).toMatchObject({
        id: 'model-1',
        object: 'model',
        owned_by: 'provider-1',
        provider: 'Provider 1',
        max_tokens: 4096,
        context_window: 8192,
        supports_streaming: true,
        supports_embeddings: false,
      });
    });
  });

  describe('Provider instance methods', () => {
    let provider;

    beforeEach(() => {
      provider = new Provider({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'spawn-cli',
        models: [{
          dyadModelId: 'test-model',
          adapterModelId: 'adapter-model',
          maxTokens: 4096,
        }],
        adapterConfig: {
          command: '/usr/bin/test',
        },
      });
    });

    test('should update health status', async () => {
      provider.save = jest.fn().mockResolvedValue(provider);
      
      await provider.updateHealthStatus('healthy');
      
      expect(provider.healthStatus.status).toBe('healthy');
      expect(provider.healthStatus.lastChecked).toBeInstanceOf(Date);
      expect(provider.healthStatus.errorMessage).toBeNull();
      expect(provider.save).toHaveBeenCalled();
    });

    test('should update health status with error message', async () => {
      provider.save = jest.fn().mockResolvedValue(provider);
      
      await provider.updateHealthStatus('unhealthy', 'Connection failed');
      
      expect(provider.healthStatus.status).toBe('unhealthy');
      expect(provider.healthStatus.errorMessage).toBe('Connection failed');
    });

    test('should get model mapping by dyad model ID', () => {
      const mapping = provider.getModelMapping('test-model');
      
      expect(mapping).toMatchObject({
        dyadModelId: 'test-model',
        adapterModelId: 'adapter-model',
        maxTokens: 4096,
      });
    });

    test('should return null for non-existent model mapping', () => {
      const mapping = provider.getModelMapping('non-existent-model');
      expect(mapping).toBeNull();
    });
  });

  describe('Provider toJSON()', () => {
    test('should not return credentials when toJSON is called', () => {
      const provider = new Provider({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'spawn-cli',
        adapterConfig: {
          command: '/usr/bin/test',
        },
        credentials: new Map([
          ['apiKey', 'secret-key'],
        ]),
      });

      const json = provider.toJSON();
      expect(json).not.toHaveProperty('credentials');
    });
  });

  describe('Provider model mappings', () => {
    test('should validate model mapping fields', async () => {
      const provider = new Provider({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'spawn-cli',
        models: [{
          dyadModelId: 'test-model',
          adapterModelId: 'adapter-model',
          maxTokens: -1, // Invalid
        }],
        adapterConfig: {
          command: '/usr/bin/test',
        },
      });

      await expect(provider.validate()).rejects.toThrow();
    });

    test('should allow valid model mappings', async () => {
      const provider = new Provider({
        name: 'Test Provider',
        slug: 'test-provider',
        type: 'spawn-cli',
        models: [{
          dyadModelId: 'test-model',
          adapterModelId: 'adapter-model',
          maxTokens: 4096,
          contextWindow: 8192,
          supportsStreaming: true,
          supportsEmbeddings: false,
        }],
        adapterConfig: {
          command: '/usr/bin/test',
        },
      });

      await expect(provider.validate()).resolves.toBeUndefined();
    });
  });
});