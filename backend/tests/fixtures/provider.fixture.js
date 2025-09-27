const mongoose = require('mongoose');
const Provider = require('../../src/models/provider.model');

const providerOne = {
  _id: mongoose.Types.ObjectId(),
  name: 'Test Provider One',
  slug: 'test-provider-one',
  type: 'http-sdk',
  description: 'Test provider for unit tests',
  enabled: true,
  models: [
    {
      dyadModelId: 'test-model-1',
      adapterModelId: 'adapter-model-1',
      maxTokens: 4096,
      contextWindow: 8192,
      supportsStreaming: true,
      supportsEmbeddings: false
    }
  ],
  adapterConfig: {
    baseUrl: 'https://api.test-provider-one.com',
    timeoutSeconds: 30,
    retryAttempts: 3,
    supportsStreaming: true,
    chatEndpoint: '/v1/chat/completions',
    modelsEndpoint: '/v1/models',
    healthCheckPath: '/health'
  },
  credentials: {
    apiKey: 'test-api-key-1',
    secret: 'test-secret-1'
  },
  healthStatus: {
    status: 'healthy',
    lastChecked: new Date(),
    errorMessage: null
  },
  rateLimits: {
    requestsPerMinute: 60,
    tokensPerMinute: 10000
  }
};

const providerTwo = {
  _id: mongoose.Types.ObjectId(),
  name: 'Test Provider Two',
  slug: 'test-provider-two',
  type: 'spawn-cli',
  description: 'Second test provider for unit tests',
  enabled: true,
  models: [
    {
      dyadModelId: 'test-model-2',
      adapterModelId: 'adapter-model-2',
      maxTokens: 2048,
      contextWindow: 4096,
      supportsStreaming: false,
      supportsEmbeddings: true
    }
  ],
  adapterConfig: {
    command: 'test-cli-command',
    args: ['--model', 'test-model'],
    timeoutSeconds: 60,
    retryAttempts: 2,
    dockerSandbox: true,
    sandboxImage: 'node:18-alpine',
    memoryLimit: '512m',
    cpuLimit: '0.5'
  },
  credentials: {
    token: 'test-token-2'
  },
  healthStatus: {
    status: 'healthy',
    lastChecked: new Date(),
    errorMessage: null
  },
  rateLimits: {
    requestsPerMinute: 30,
    tokensPerMinute: 5000
  }
};

const providerThree = {
  _id: mongoose.Types.ObjectId(),
  name: 'Test Provider Three',
  slug: 'test-provider-three',
  type: 'local',
  description: 'Third test provider for unit tests',
  enabled: false, // Disabled for testing
  models: [
    {
      dyadModelId: 'test-model-3',
      adapterModelId: 'local-model-3',
      maxTokens: 1024,
      contextWindow: 2048,
      supportsStreaming: true,
      supportsEmbeddings: true
    }
  ],
  adapterConfig: {
    baseUrl: 'http://localhost:8080',
    timeoutSeconds: 45,
    retryAttempts: 1,
    supportsStreaming: true,
    chatEndpoint: '/chat',
    embeddingsEndpoint: '/embeddings',
    healthCheckPath: '/status',
    allowRemote: false
  },
  credentials: {
    username: 'test-user',
    password: 'test-pass'
  },
  healthStatus: {
    status: 'unknown',
    lastChecked: null,
    errorMessage: null
  },
  rateLimits: {
    requestsPerMinute: 120,
    tokensPerMinute: 20000
  }
};

const insertProviders = async (providers) => {
  await Provider.insertMany(providers.map((provider) => ({ ...provider })));
};

module.exports = {
  providerOne,
  providerTwo,
  providerThree,
  insertProviders,
};