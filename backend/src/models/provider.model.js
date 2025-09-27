const mongoose = require('mongoose');
const validator = require('validator');
const { toJSON, paginate, encryption } = require('./plugins');

const modelMappingSchema = mongoose.Schema({
  dyadModelId: {
    type: String,
    required: true,
    trim: true,
  },
  adapterModelId: {
    type: String,
    required: true,
    trim: true,
  },
  maxTokens: {
    type: Number,
    min: 1,
    max: 1000000,
  },
  contextWindow: {
    type: Number,
    min: 1,
    max: 1000000,
  },
  supportsStreaming: {
    type: Boolean,
    default: false,
  },
  supportsEmbeddings: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const adapterConfigSchema = mongoose.Schema({
  // Common fields for all adapter types
  timeoutSeconds: {
    type: Number,
    default: 60,
    min: 1,
    max: 3600,
  },
  retryAttempts: {
    type: Number,
    default: 3,
    min: 0,
    max: 10,
  },
  
  // Spawn-CLI adapter specific
  command: {
    type: String,
    trim: true,
  },
  args: [{
    type: String,
    trim: true,
  }],
  dockerSandbox: {
    type: Boolean,
    default: true,
  },
  sandboxImage: {
    type: String,
    trim: true,
  },
  memoryLimit: {
    type: String,
    default: '512m',
    validate: {
      validator: function(v) {
        return /^\d+[kmg]?$/i.test(v);
      },
      message: 'Memory limit must be in format like 512m, 1g, etc.'
    }
  },
  cpuLimit: {
    type: String,
    default: '0.5',
    validate: {
      validator: function(v) {
        return /^\d*\.?\d+$/.test(v);
      },
      message: 'CPU limit must be a decimal number'
    }
  },
  
  // HTTP-SDK adapter specific
  baseUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || validator.isURL(v);
      },
      message: 'Base URL must be a valid URL'
    }
  },
  headers: {
    type: Map,
    of: String,
  },
  
  // Proxy adapter specific
  proxyUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || validator.isURL(v);
      },
      message: 'Proxy URL must be a valid URL'
    }
  },
  
  // Local adapter specific
  localUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || validator.isURL(v);
      },
      message: 'Local URL must be a valid URL'
    }
  },
  healthCheckPath: {
    type: String,
    default: '/health',
    trim: true,
  },
}, { _id: false });

const providerSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 50,
      validate: {
        validator: function(v) {
          return /^[a-z0-9-]+$/.test(v);
        },
        message: 'Slug must contain only lowercase letters, numbers, and hyphens'
      }
    },
    type: {
      type: String,
      required: true,
      enum: ['spawn-cli', 'http-sdk', 'proxy', 'local'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    models: [modelMappingSchema],
    adapterConfig: {
      type: adapterConfigSchema,
      required: true,
    },
    credentials: {
      type: Map,
      of: String,
      private: true, // Used by toJSON plugin to exclude from responses
    },
    healthStatus: {
      status: {
        type: String,
        enum: ['healthy', 'unhealthy', 'unknown'],
        default: 'unknown',
      },
      lastChecked: {
        type: Date,
      },
      errorMessage: {
        type: String,
        trim: true,
      },
    },
    rateLimits: {
      requestsPerMinute: {
        type: Number,
        min: 1,
        max: 10000,
        default: 60,
      },
      tokensPerMinute: {
        type: Number,
        min: 1,
        max: 1000000,
        default: 10000,
      },
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
providerSchema.plugin(toJSON);
providerSchema.plugin(paginate);
providerSchema.plugin(encryption, { 
  fields: ['credentials.$*'] // Encrypt all credential values
});

/**
 * Check if slug is taken
 * @param {string} slug - The provider's slug
 * @param {ObjectId} [excludeProviderId] - The id of the provider to be excluded
 * @returns {Promise<boolean>}
 */
providerSchema.statics.isSlugTaken = async function (slug, excludeProviderId) {
  const provider = await this.findOne({ slug, _id: { $ne: excludeProviderId } });
  return !!provider;
};

/**
 * Get providers by model ID
 * @param {string} dyadModelId - The model ID to search for
 * @returns {Promise<Provider[]>}
 */
providerSchema.statics.getProvidersByModel = async function (dyadModelId) {
  return this.find({
    enabled: true,
    'models.dyadModelId': dyadModelId,
  });
};

/**
 * Get all available models across providers
 * @returns {Promise<Object[]>}
 */
providerSchema.statics.getAllModels = async function () {
  const providers = await this.find({ enabled: true });
  const models = [];
  
  providers.forEach(provider => {
    provider.models.forEach(model => {
      models.push({
        id: model.dyadModelId,
        object: 'model',
        owned_by: provider.slug,
        provider: provider.name,
        max_tokens: model.maxTokens,
        context_window: model.contextWindow,
        supports_streaming: model.supportsStreaming,
        supports_embeddings: model.supportsEmbeddings,
      });
    });
  });
  
  return models;
};

/**
 * Update health status
 * @param {string} status - Health status ('healthy', 'unhealthy', 'unknown')
 * @param {string} [errorMessage] - Error message if unhealthy
 * @returns {Promise<Provider>}
 */
providerSchema.methods.updateHealthStatus = async function (status, errorMessage = null) {
  this.healthStatus = {
    status,
    lastChecked: new Date(),
    errorMessage: status === 'unhealthy' ? errorMessage : null,
  };
  return this.save();
};

/**
 * Get model mapping by dyad model ID
 * @param {string} dyadModelId - The dyad model ID
 * @returns {Object|null}
 */
providerSchema.methods.getModelMapping = function (dyadModelId) {
  return this.models.find(model => model.dyadModelId === dyadModelId) || null;
};

/**
 * Validate adapter configuration based on type
 */
providerSchema.pre('save', function (next) {
  const provider = this;
  const { type, adapterConfig } = provider;
  
  // Validate required fields based on adapter type
  switch (type) {
    case 'spawn-cli':
      if (!adapterConfig.command) {
        return next(new Error('Command is required for spawn-cli adapter'));
      }
      break;
    case 'http-sdk':
      if (!adapterConfig.baseUrl) {
        return next(new Error('Base URL is required for http-sdk adapter'));
      }
      break;
    case 'proxy':
      if (!adapterConfig.proxyUrl) {
        return next(new Error('Proxy URL is required for proxy adapter'));
      }
      break;
    case 'local':
      if (!adapterConfig.localUrl) {
        return next(new Error('Local URL is required for local adapter'));
      }
      break;
    default:
      return next(new Error(`Unknown adapter type: ${type}`));
  }
  
  next();
});

/**
 * @typedef Provider
 */
const Provider = mongoose.model('Provider', providerSchema);

module.exports = Provider;