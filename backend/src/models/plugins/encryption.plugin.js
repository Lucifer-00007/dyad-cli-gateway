const crypto = require('crypto');
const { createSecretsManager } = require('../../services/secrets.service');

/**
 * A mongoose schema plugin which provides field-level encryption for sensitive data
 * Uses KMS/secrets manager for key management and encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 16
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

// Global secrets manager instance
let secretsManager = null;
let encryptionKeyId = null;

/**
 * Initialize the secrets manager
 */
const initializeSecretsManager = () => {
  if (!secretsManager) {
    secretsManager = createSecretsManager();
    encryptionKeyId = process.env.ENCRYPTION_KEY_ID || 'dyad-gateway-encryption-key';
  }
  return secretsManager;
};

/**
 * Get encryption key from KMS/secrets manager
 * @returns {Promise<Buffer>} - The encryption key
 */
const getEncryptionKey = async () => {
  const manager = initializeSecretsManager();
  
  try {
    return await manager.getEncryptionKey(encryptionKeyId);
  } catch (error) {
    // Fallback to environment-based key for backward compatibility
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_KEY environment variable is required in production when KMS is not available');
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
  }
};

/**
 * Encrypt a string value using KMS
 * @param {string} text - The text to encrypt
 * @returns {Promise<string>} - The encrypted text as hex string
 */
const encrypt = async (text) => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  const manager = initializeSecretsManager();
  
  try {
    // Try to use KMS encryption first
    const encrypted = await manager.encrypt(text, encryptionKeyId);
    return `kms:${encrypted}`;
  } catch (error) {
    // Fallback to local encryption
    const key = await getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    const cipher = crypto.createCipher('aes-256-cbc', key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `local:${salt.toString('hex')}${iv.toString('hex')}${encrypted}`;
  }
};

/**
 * Decrypt a string value using KMS or local key
 * @param {string} encryptedText - The encrypted text as hex string
 * @returns {Promise<string>} - The decrypted text
 */
const decrypt = async (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== 'string') {
    return encryptedText;
  }

  try {
    const manager = initializeSecretsManager();
    
    // Check if this is KMS-encrypted data
    if (encryptedText.startsWith('kms:')) {
      const ciphertext = encryptedText.substring(4);
      return await manager.decrypt(ciphertext, encryptionKeyId);
    }
    
    // Check if this is locally encrypted data
    if (encryptedText.startsWith('local:')) {
      const data = encryptedText.substring(6);
      const key = await getEncryptionKey();
      
      const salt = Buffer.from(data.slice(0, SALT_LENGTH * 2), 'hex');
      const iv = Buffer.from(data.slice(SALT_LENGTH * 2, (SALT_LENGTH + IV_LENGTH) * 2), 'hex');
      const encrypted = data.slice((SALT_LENGTH + IV_LENGTH) * 2);
      
      const decipher = crypto.createDecipher('aes-256-cbc', key);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    }
    
    // Legacy format - try to decrypt with local key
    const key = await getEncryptionKey();
    
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
  schema.methods.encryptField = async function(fieldName) {
    if (this[fieldName] && typeof this[fieldName] === 'string') {
      this[fieldName] = await encrypt(this[fieldName]);
    }
  };

  schema.methods.decryptField = async function(fieldName) {
    if (this[fieldName] && typeof this[fieldName] === 'string') {
      this[fieldName] = await decrypt(this[fieldName]);
    }
  };

  // Auto-encrypt specified fields before saving
  schema.pre('save', async function(next) {
    try {
      for (const field of fields) {
        if (this.isModified(field) && this[field]) {
          // Handle nested fields (e.g., 'credentials.$*')
          if (field.includes('$*')) {
            const baseField = field.replace('.$*', '');
            if (this[baseField] && this[baseField] instanceof Map) {
              for (const [key, value] of this[baseField]) {
                if (value && typeof value === 'string') {
                  this[baseField].set(key, await encrypt(value));
                }
              }
            }
          } else {
            this[field] = await encrypt(this[field]);
          }
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  // Auto-decrypt specified fields after finding
  schema.post(['find', 'findOne', 'findOneAndUpdate'], async function(docs) {
    if (!docs) return;
    
    const documents = Array.isArray(docs) ? docs : [docs];
    
    for (const doc of documents) {
      if (doc) {
        for (const field of fields) {
          try {
            // Handle nested fields (e.g., 'credentials.$*')
            if (field.includes('$*')) {
              const baseField = field.replace('.$*', '');
              if (doc[baseField] && doc[baseField] instanceof Map) {
                for (const [key, value] of doc[baseField]) {
                  if (value && typeof value === 'string') {
                    doc[baseField].set(key, await decrypt(value));
                  }
                }
              }
            } else if (doc[field]) {
              doc[field] = await decrypt(doc[field]);
            }
          } catch (error) {
            // Log error but don't fail the query
            console.error(`Failed to decrypt field ${field}:`, error.message);
          }
        }
      }
    }
  });

  // Add static methods for manual encryption/decryption
  schema.statics.encryptValue = encrypt;
  schema.statics.decryptValue = decrypt;
  
  // Add method to rotate encryption keys
  schema.statics.rotateEncryptionKeys = async function() {
    const manager = initializeSecretsManager();
    try {
      const newKeyVersion = await manager.rotateEncryptionKey(encryptionKeyId);
      
      // Re-encrypt all documents with the new key
      const documents = await this.find({});
      for (const doc of documents) {
        let needsSave = false;
        
        for (const field of fields) {
          if (field.includes('$*')) {
            const baseField = field.replace('.$*', '');
            if (doc[baseField] && doc[baseField] instanceof Map) {
              for (const [key, value] of doc[baseField]) {
                if (value && typeof value === 'string') {
                  // Decrypt with old key and encrypt with new key
                  const decrypted = await decrypt(value);
                  doc[baseField].set(key, await encrypt(decrypted));
                  needsSave = true;
                }
              }
            }
          } else if (doc[field]) {
            // Decrypt with old key and encrypt with new key
            const decrypted = await decrypt(doc[field]);
            doc[field] = await encrypt(decrypted);
            needsSave = true;
          }
        }
        
        if (needsSave) {
          await doc.save();
        }
      }
      
      return newKeyVersion;
    } catch (error) {
      throw new Error(`Failed to rotate encryption keys: ${error.message}`);
    }
  };
};

module.exports = encryption;