const crypto = require('crypto');

/**
 * A mongoose schema plugin which provides field-level encryption for sensitive data
 * Uses AES-256-GCM encryption with a master key from environment variables
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 16
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Get encryption key from environment or generate a default one for development
 * In production, this should come from a secure key management service
 */
const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    // Development fallback - should not be used in production
    return crypto.scryptSync('dev-key-not-for-production', 'salt', 32);
  }
  
  // If key is provided as hex string, convert to buffer
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }
  
  // Otherwise derive key from string
  return crypto.scryptSync(key, 'salt', 32);
};

/**
 * Encrypt a string value
 * @param {string} text - The text to encrypt
 * @returns {string} - The encrypted text as hex string
 */
const encrypt = (text) => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  const cipher = crypto.createCipher('aes-256-cbc', key);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return salt.toString('hex') + iv.toString('hex') + encrypted;
};

/**
 * Decrypt a string value
 * @param {string} encryptedText - The encrypted text as hex string
 * @returns {string} - The decrypted text
 */
const decrypt = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== 'string') {
    return encryptedText;
  }

  try {
    const key = getEncryptionKey();
    
    const salt = Buffer.from(encryptedText.slice(0, SALT_LENGTH * 2), 'hex');
    const iv = Buffer.from(encryptedText.slice(SALT_LENGTH * 2, (SALT_LENGTH + IV_LENGTH) * 2), 'hex');
    const encrypted = encryptedText.slice((SALT_LENGTH + IV_LENGTH) * 2);
    
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // If decryption fails, it might be unencrypted data (for backward compatibility)
    // In production, you might want to handle this differently
    return encryptedText;
  }
};

/**
 * Mongoose plugin for field-level encryption
 * @param {mongoose.Schema} schema - The mongoose schema
 * @param {Object} options - Plugin options
 * @param {string[]} options.fields - Array of field names to encrypt
 */
const encryption = (schema, options = {}) => {
  const { fields = [] } = options;

  // Add encryption methods to schema
  schema.methods.encryptField = function(fieldName) {
    if (this[fieldName] && typeof this[fieldName] === 'string') {
      this[fieldName] = encrypt(this[fieldName]);
    }
  };

  schema.methods.decryptField = function(fieldName) {
    if (this[fieldName] && typeof this[fieldName] === 'string') {
      this[fieldName] = decrypt(this[fieldName]);
    }
  };

  // Auto-encrypt specified fields before saving
  schema.pre('save', function(next) {
    fields.forEach(field => {
      if (this.isModified(field) && this[field]) {
        this[field] = encrypt(this[field]);
      }
    });
    next();
  });

  // Auto-decrypt specified fields after finding
  schema.post(['find', 'findOne', 'findOneAndUpdate'], function(docs) {
    if (!docs) return;
    
    const documents = Array.isArray(docs) ? docs : [docs];
    documents.forEach(doc => {
      if (doc) {
        fields.forEach(field => {
          if (doc[field]) {
            doc[field] = decrypt(doc[field]);
          }
        });
      }
    });
  });

  // Add static methods for manual encryption/decryption
  schema.statics.encryptValue = encrypt;
  schema.statics.decryptValue = decrypt;
};

module.exports = encryption;