/**
 * Unit tests for AdapterFactory
 */

const AdapterFactory = require('../../../../src/gateway/adapters/adapter.factory');
const SpawnCliAdapter = require('../../../../src/gateway/adapters/spawn-cli.adapter');
const HttpSdkAdapter = require('../../../../src/gateway/adapters/http-sdk.adapter');
const BaseAdapter = require('../../../../src/gateway/adapters/base.adapter');

// Mock the logger to avoid console output during tests
jest.mock('../../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('AdapterFactory', () => {
  let factory;

  beforeEach(() => {
    // Get a fresh instance for each test
    factory = AdapterFactory;
  });

  describe('createAdapter', () => {
    const validProvider = {
      id: 'test-provider',
      name: 'Test Provider',
      type: 'spawn-cli',
      adapterConfig: {
        command: 'echo',
        args: [],
        timeoutSeconds: 30
      }
    };

    it('should create SpawnCliAdapter for spawn-cli type', () => {
      const adapter = factory.createAdapter(validProvider);
      
      expect(adapter).toBeInstanceOf(SpawnCliAdapter);
      expect(adapter.providerConfig).toBe(validProvider.adapterConfig);
    });

    it('should create HttpSdkAdapter for http-sdk type', () => {
      const httpProvider = {
        id: 'test-http-provider',
        name: 'Test HTTP Provider',
        type: 'http-sdk',
        adapterConfig: {
          baseUrl: 'https://api.example.com',
          chatEndpoint: '/v1/chat/completions'
        }
      };
      
      const adapter = factory.createAdapter(httpProvider);
      
      expect(adapter).toBeInstanceOf(HttpSdkAdapter);
      expect(adapter.providerConfig).toBe(httpProvider.adapterConfig);
    });

    it('should pass credentials to adapter', () => {
      const credentials = { api_key: 'test-key' };
      const adapter = factory.createAdapter(validProvider, credentials);
      
      expect(adapter.credentials).toBe(credentials);
    });

    it('should throw error for missing provider type', () => {
      const invalidProvider = {
        name: 'Invalid Provider',
        adapterConfig: {}
      };

      expect(() => {
        factory.createAdapter(invalidProvider);
      }).toThrow('Provider type is required');
    });

    it('should throw error for unknown adapter type', () => {
      const unknownProvider = {
        type: 'unknown-type',
        adapterConfig: {}
      };

      expect(() => {
        factory.createAdapter(unknownProvider);
      }).toThrow('Unknown adapter type: unknown-type. Available types: spawn-cli, http-sdk');
    });

    it('should throw error for invalid adapter configuration', () => {
      const invalidProvider = {
        type: 'spawn-cli',
        adapterConfig: {
          // Missing required 'command' field
          timeoutSeconds: 30
        }
      };

      expect(() => {
        factory.createAdapter(invalidProvider);
      }).toThrow('SpawnCliAdapter requires command in providerConfig');
    });
  });

  describe('getAvailableTypes', () => {
    it('should return array of available adapter types', () => {
      const types = factory.getAvailableTypes();
      
      expect(Array.isArray(types)).toBe(true);
      expect(types).toContain('spawn-cli');
      expect(types).toContain('http-sdk');
    });
  });

  describe('registerAdapter', () => {
    class TestAdapter extends BaseAdapter {
      async handleChat() { return {}; }
      async handleEmbeddings() { return {}; }
      async testConnection() { return {}; }
      getModels() { return []; }
    }

    it('should register new adapter type', () => {
      factory.registerAdapter('test-adapter', TestAdapter);
      
      const types = factory.getAvailableTypes();
      expect(types).toContain('test-adapter');
    });

    it('should create instance of registered adapter', () => {
      factory.registerAdapter('test-adapter', TestAdapter);
      
      const provider = {
        type: 'test-adapter',
        adapterConfig: {}
      };
      
      const adapter = factory.createAdapter(provider);
      expect(adapter).toBeInstanceOf(TestAdapter);
    });

    it('should override existing adapter type', () => {
      class NewTestAdapter extends BaseAdapter {
        async handleChat() { return { test: 'new' }; }
        async handleEmbeddings() { return {}; }
        async testConnection() { return {}; }
        getModels() { return []; }
      }

      factory.registerAdapter('test-adapter', TestAdapter);
      factory.registerAdapter('test-adapter', NewTestAdapter);
      
      const provider = {
        type: 'test-adapter',
        adapterConfig: {}
      };
      
      const adapter = factory.createAdapter(provider);
      expect(adapter).toBeInstanceOf(NewTestAdapter);
    });
  });

  describe('isSupported', () => {
    it('should return true for supported adapter type', () => {
      expect(factory.isSupported('spawn-cli')).toBe(true);
      expect(factory.isSupported('http-sdk')).toBe(true);
    });

    it('should return false for unsupported adapter type', () => {
      expect(factory.isSupported('unknown-type')).toBe(false);
    });
  });
});