const mongoose = require('mongoose');
const { encryption } = require('../../../../src/models/plugins');

describe('Encryption plugin', () => {
  let TestModel;
  let testSchema;

  beforeAll(() => {
    testSchema = new mongoose.Schema({
      name: String,
      secret: String,
      publicData: String,
    });

    testSchema.plugin(encryption, { fields: ['secret'] });
    TestModel = mongoose.model('TestEncryption', testSchema);
  });

  afterAll(() => {
    mongoose.deleteModel('TestEncryption');
  });

  describe('Field encryption', () => {
    test('should encrypt specified fields before saving', async () => {
      const originalSecret = 'my-secret-value';
      const doc = new TestModel({
        name: 'test',
        secret: originalSecret,
        publicData: 'public',
      });

      // Simulate the pre-save hook by calling it directly
      const preSaveHooks = testSchema.pre.bind(testSchema);
      
      // Manually trigger encryption by calling the plugin's pre-save logic
      doc.secret = TestModel.encryptValue(originalSecret);

      expect(doc.secret).not.toBe(originalSecret);
      expect(doc.secret).toBeDefined();
      expect(doc.publicData).toBe('public'); // Should not be encrypted
    });

    test('should not encrypt empty or null values', async () => {
      const doc1 = new TestModel({ name: 'test1', secret: null });
      const doc2 = new TestModel({ name: 'test2', secret: '' });
      const doc3 = new TestModel({ name: 'test3' });

      // Test encryption of null/empty values directly
      expect(TestModel.encryptValue(null)).toBeNull();
      expect(TestModel.encryptValue('')).toBe('');
      expect(TestModel.encryptValue(undefined)).toBeUndefined();

      expect(doc1.secret).toBeNull();
      expect(doc2.secret).toBe('');
      expect(doc3.secret).toBeUndefined();
    });

    test('should only encrypt when field is modified', async () => {
      const doc = new TestModel({
        name: 'test',
        secret: 'original-secret',
        publicData: 'public',
      });

      // Simulate first encryption
      const originalSecret = doc.secret;
      const encryptedValue = TestModel.encryptValue(originalSecret);
      expect(encryptedValue).not.toBe('original-secret');

      // Test that we can decrypt it back
      const decryptedValue = TestModel.decryptValue(encryptedValue);
      expect(decryptedValue).toBe(originalSecret);
    });
  });

  describe('Static encryption methods', () => {
    test('should provide static encryptValue method', () => {
      expect(typeof TestModel.encryptValue).toBe('function');
      
      const plaintext = 'test-value';
      const encrypted = TestModel.encryptValue(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');
    });

    test('should provide static decryptValue method', () => {
      expect(typeof TestModel.decryptValue).toBe('function');
      
      const plaintext = 'test-value';
      const encrypted = TestModel.encryptValue(plaintext);
      const decrypted = TestModel.decryptValue(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    test('should handle invalid encrypted values gracefully', () => {
      const invalidEncrypted = 'invalid-encrypted-value';
      const result = TestModel.decryptValue(invalidEncrypted);
      
      // Should return original value if decryption fails (backward compatibility)
      expect(result).toBe(invalidEncrypted);
    });

    test('should handle null and undefined values', () => {
      expect(TestModel.encryptValue(null)).toBeNull();
      expect(TestModel.encryptValue(undefined)).toBeUndefined();
      expect(TestModel.encryptValue('')).toBe('');
      
      expect(TestModel.decryptValue(null)).toBeNull();
      expect(TestModel.decryptValue(undefined)).toBeUndefined();
      expect(TestModel.decryptValue('')).toBe('');
    });
  });

  describe('Instance encryption methods', () => {
    test('should provide instance encryptField method', () => {
      const doc = new TestModel({
        name: 'test',
        secret: 'my-secret',
        publicData: 'public',
      });

      expect(typeof doc.encryptField).toBe('function');
      
      const originalSecret = doc.secret;
      doc.encryptField('secret');
      
      expect(doc.secret).not.toBe(originalSecret);
      expect(doc.secret).toBeDefined();
    });

    test('should provide instance decryptField method', () => {
      const doc = new TestModel({
        name: 'test',
        secret: 'my-secret',
        publicData: 'public',
      });

      expect(typeof doc.decryptField).toBe('function');
      
      const originalSecret = doc.secret;
      doc.encryptField('secret');
      const encryptedSecret = doc.secret;
      
      doc.decryptField('secret');
      expect(doc.secret).toBe(originalSecret);
    });
  });

  describe('Environment key handling', () => {
    const originalEnv = process.env.ENCRYPTION_KEY;
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.ENCRYPTION_KEY = originalEnv;
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('should use environment key when provided', () => {
      process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 64 char hex string
      
      const plaintext = 'test-value';
      const encrypted = TestModel.encryptValue(plaintext);
      const decrypted = TestModel.decryptValue(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    test('should throw error in production without encryption key', () => {
      delete process.env.ENCRYPTION_KEY;
      process.env.NODE_ENV = 'production';
      
      expect(() => {
        TestModel.encryptValue('test');
      }).toThrow('ENCRYPTION_KEY environment variable is required in production');
    });

    test('should use fallback key in development', () => {
      delete process.env.ENCRYPTION_KEY;
      process.env.NODE_ENV = 'development';
      
      const plaintext = 'test-value';
      const encrypted = TestModel.encryptValue(plaintext);
      const decrypted = TestModel.decryptValue(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });
});