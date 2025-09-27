/**
 * Unit tests for BaseAdapter
 */

const BaseAdapter = require('../../../../src/gateway/adapters/base.adapter');

describe('BaseAdapter', () => {
  describe('constructor', () => {
    it('should throw error when instantiated directly', () => {
      expect(() => {
        new BaseAdapter({}, {});
      }).toThrow('BaseAdapter is abstract and cannot be instantiated directly');
    });

    it('should allow instantiation of subclass', () => {
      class TestAdapter extends BaseAdapter {
        async handleChat() { return {}; }
        async handleEmbeddings() { return {}; }
        async testConnection() { return {}; }
        getModels() { return []; }
      }

      const adapter = new TestAdapter({ test: 'config' }, { api_key: 'test' });
      expect(adapter.providerConfig).toEqual({ test: 'config' });
      expect(adapter.credentials).toEqual({ api_key: 'test' });
      expect(adapter.supportsStreaming).toBe(false);
    });
  });

  describe('abstract methods', () => {
    let TestAdapter;
    let adapter;

    beforeEach(() => {
      TestAdapter = class extends BaseAdapter {};
      adapter = Object.create(TestAdapter.prototype);
      adapter.providerConfig = {};
      adapter.credentials = {};
    });

    it('should throw error for handleChat if not implemented', async () => {
      await expect(adapter.handleChat({})).rejects.toThrow('handleChat method must be implemented by subclass');
    });

    it('should throw error for handleEmbeddings if not implemented', async () => {
      await expect(adapter.handleEmbeddings({})).rejects.toThrow('handleEmbeddings method must be implemented by subclass');
    });

    it('should throw error for testConnection if not implemented', async () => {
      await expect(adapter.testConnection()).rejects.toThrow('testConnection method must be implemented by subclass');
    });

    it('should throw error for getModels if not implemented', () => {
      expect(() => adapter.getModels()).toThrow('getModels method must be implemented by subclass');
    });
  });

  describe('default implementations', () => {
    let TestAdapter;
    let adapter;

    beforeEach(() => {
      TestAdapter = class extends BaseAdapter {
        async handleChat() { return {}; }
        async handleEmbeddings() { return {}; }
        async testConnection() { return {}; }
        getModels() { return []; }
      };
      adapter = new TestAdapter({}, {});
    });

    it('should have default validateConfig implementation', () => {
      const result = adapter.validateConfig();
      expect(result).toEqual({
        valid: true,
        errors: []
      });
    });

    it('should have default cleanup implementation', async () => {
      // Should not throw
      await expect(adapter.cleanup()).resolves.toBeUndefined();
    });
  });
});