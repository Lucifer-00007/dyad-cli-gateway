const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { toJSON, paginate } = require('./plugins');

const usageStatsSchema = mongoose.Schema({
  requestsToday: {
    type: Number,
    default: 0,
  },
  requestsThisMonth: {
    type: Number,
    default: 0,
  },
  tokensToday: {
    type: Number,
    default: 0,
  },
  tokensThisMonth: {
    type: Number,
    default: 0,
  },
  lastUsed: {
    type: Date,
  },
  lastResetDate: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const rateLimitSchema = mongoose.Schema({
  requestsPerMinute: {
    type: Number,
    min: 1,
    max: 10000,
    default: 60,
  },
  requestsPerDay: {
    type: Number,
    min: 1,
    max: 1000000,
    default: 1000,
  },
  tokensPerMinute: {
    type: Number,
    min: 1,
    max: 1000000,
    default: 10000,
  },
  tokensPerDay: {
    type: Number,
    min: 1,
    max: 10000000,
    default: 100000,
  },
}, { _id: false });

const apiKeySchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
      private: true, // Used by toJSON plugin to exclude from responses
    },
    keyPrefix: {
      type: String,
      required: true,
      length: 8,
    },
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },
    permissions: {
      type: [String],
      enum: ['chat', 'embeddings', 'models', 'admin'],
      default: ['chat', 'models'],
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    rateLimits: {
      type: rateLimitSchema,
      default: () => ({}),
    },
    usageStats: {
      type: usageStatsSchema,
      default: () => ({}),
    },
    allowedModels: {
      type: [String],
      default: [],
    },
    allowedProviders: {
      type: [String],
      default: [],
    },
    expiresAt: {
      type: Date,
    },
    lastUsedAt: {
      type: Date,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Add plugins
apiKeySchema.plugin(toJSON);
apiKeySchema.plugin(paginate);

// Indexes for performance
apiKeySchema.index({ keyHash: 1 });
apiKeySchema.index({ userId: 1 });
apiKeySchema.index({ enabled: 1 });
apiKeySchema.index({ expiresAt: 1 });

/**
 * Generate a new API key
 * @returns {string} - The generated API key
 */
apiKeySchema.statics.generateKey = function () {
  // Generate a 32-byte random key and encode as base64
  const key = crypto.randomBytes(32).toString('base64url');
  return `dyad_${key}`;
};

/**
 * Hash an API key for storage
 * @param {string} key - The API key to hash
 * @returns {Promise<string>} - The hashed key
 */
apiKeySchema.statics.hashKey = async function (key) {
  return bcrypt.hash(key, 12);
};

/**
 * Get key prefix from full key
 * @param {string} key - The full API key
 * @returns {string} - The key prefix
 */
apiKeySchema.statics.getKeyPrefix = function (key) {
  return key.substring(0, 8);
};

/**
 * Find API key by key value
 * @param {string} key - The API key to find
 * @returns {Promise<ApiKey|null>}
 */
apiKeySchema.statics.findByKey = async function (key) {
  if (!key || !key.startsWith('dyad_')) {
    return null;
  }

  const prefix = this.getKeyPrefix(key);
  const candidates = await this.find({ 
    keyPrefix: prefix,
    enabled: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });

  for (const candidate of candidates) {
    const isMatch = await bcrypt.compare(key, candidate.keyHash);
    if (isMatch) {
      return candidate;
    }
  }

  return null;
};

/**
 * Check if API key has permission
 * @param {string} permission - The permission to check
 * @returns {boolean}
 */
apiKeySchema.methods.hasPermission = function (permission) {
  return this.permissions.includes(permission);
};

/**
 * Check if API key can access model
 * @param {string} modelId - The model ID to check
 * @returns {boolean}
 */
apiKeySchema.methods.canAccessModel = function (modelId) {
  if (!this.allowedModels || this.allowedModels.length === 0) {
    return true; // No restrictions
  }
  return this.allowedModels.includes(modelId);
};

/**
 * Check if API key can access provider
 * @param {string} providerSlug - The provider slug to check
 * @returns {boolean}
 */
apiKeySchema.methods.canAccessProvider = function (providerSlug) {
  if (!this.allowedProviders || this.allowedProviders.length === 0) {
    return true; // No restrictions
  }
  return this.allowedProviders.includes(providerSlug);
};

/**
 * Update usage statistics
 * @param {number} tokens - Number of tokens used
 * @returns {Promise<ApiKey>}
 */
apiKeySchema.methods.updateUsage = async function (tokens = 0) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Reset daily stats if it's a new day
  if (!this.usageStats.lastResetDate || this.usageStats.lastResetDate < today) {
    this.usageStats.requestsToday = 0;
    this.usageStats.tokensToday = 0;
  }
  
  // Reset monthly stats if it's a new month
  if (!this.usageStats.lastResetDate || this.usageStats.lastResetDate < thisMonth) {
    this.usageStats.requestsThisMonth = 0;
    this.usageStats.tokensThisMonth = 0;
  }
  
  // Update stats
  this.usageStats.requestsToday += 1;
  this.usageStats.requestsThisMonth += 1;
  this.usageStats.tokensToday += tokens;
  this.usageStats.tokensThisMonth += tokens;
  this.usageStats.lastUsed = now;
  this.usageStats.lastResetDate = now;
  this.lastUsedAt = now;
  
  return this.save();
};

/**
 * Check if API key is within rate limits
 * @param {number} tokens - Number of tokens for this request
 * @returns {Object} - Rate limit check result
 */
apiKeySchema.methods.checkRateLimit = function (tokens = 0) {
  const now = new Date();
  const result = {
    allowed: true,
    reason: null,
    resetTime: null,
  };
  
  // Check daily request limit
  if (this.usageStats.requestsToday >= this.rateLimits.requestsPerDay) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    result.allowed = false;
    result.reason = 'Daily request limit exceeded';
    result.resetTime = tomorrow;
    return result;
  }
  
  // Check daily token limit
  if (this.usageStats.tokensToday + tokens > this.rateLimits.tokensPerDay) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    result.allowed = false;
    result.reason = 'Daily token limit exceeded';
    result.resetTime = tomorrow;
    return result;
  }
  
  return result;
};

/**
 * Check if API key is expired
 * @returns {boolean}
 */
apiKeySchema.methods.isExpired = function () {
  if (!this.expiresAt) {
    return false;
  }
  return this.expiresAt < new Date();
};

/**
 * Validate before saving
 */
apiKeySchema.pre('save', function (next) {
  const apiKey = this;
  
  // Ensure permissions are valid
  const validPermissions = ['chat', 'embeddings', 'models', 'admin'];
  const invalidPermissions = apiKey.permissions.filter(p => !validPermissions.includes(p));
  if (invalidPermissions.length > 0) {
    return next(new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`));
  }
  
  next();
});

/**
 * @typedef ApiKey
 */
const ApiKey = mongoose.model('ApiKey', apiKeySchema);

module.exports = ApiKey;