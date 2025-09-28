/**
 * Configuration templates and presets for common provider setups
 * Provides pre-configured templates to help users quickly set up providers
 */

import { ProviderType, AdapterConfig, ModelMapping } from '@/types/api';

export interface ProviderTemplate {
  id: string;
  name: string;
  description: string;
  type: ProviderType;
  category: 'popular' | 'cloud' | 'local' | 'custom';
  icon?: string;
  adapterConfig: Partial<AdapterConfig>;
  models: ModelMapping[];
  credentials?: Array<{
    key: string;
    label: string;
    description: string;
    type: 'text' | 'password' | 'url';
    required: boolean;
    placeholder?: string;
  }>;
  documentation?: {
    setupUrl?: string;
    apiDocsUrl?: string;
    exampleUrl?: string;
  };
}

// Spawn-CLI Templates
const spawnCliTemplates: ProviderTemplate[] = [
  {
    id: 'ollama-cli',
    name: 'Ollama CLI',
    description: 'Local Ollama models via CLI interface',
    type: 'spawn-cli',
    category: 'popular',
    icon: '🦙',
    adapterConfig: {
      command: '/usr/local/bin/ollama',
      args: ['run'],
      dockerSandbox: false,
      timeoutSeconds: 60,
    },
    models: [
      {
        dyadModelId: 'llama2',
        adapterModelId: 'llama2:latest',
        maxTokens: 4096,
        contextWindow: 4096,
        supportsStreaming: true,
        supportsEmbeddings: false,
      },
      {
        dyadModelId: 'codellama',
        adapterModelId: 'codellama:latest',
        maxTokens: 4096,
        contextWindow: 16384,
        supportsStreaming: true,
        supportsEmbeddings: false,
      },
    ],
    documentation: {
      setupUrl: 'https://ollama.ai/download',
      apiDocsUrl: 'https://github.com/jmorganca/ollama/blob/main/docs/api.md',
    },
  },
  {
    id: 'python-script',
    name: 'Python Script',
    description: 'Custom Python script with JSON I/O',
    type: 'spawn-cli',
    category: 'custom',
    icon: '🐍',
    adapterConfig: {
      command: '/usr/bin/python3',
      args: ['-u', '/path/to/your/script.py'],
      dockerSandbox: true,
      sandboxImage: 'python:3.11-slim',
      memoryLimit: '512m',
      cpuLimit: '0.5',
      timeoutSeconds: 30,
      environmentVariables: {
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: '/app',
      },
    },
    models: [
      {
        dyadModelId: 'custom-model',
        adapterModelId: 'default',
        maxTokens: 2048,
        contextWindow: 4096,
        supportsStreaming: false,
        supportsEmbeddings: false,
      },
    ],
    credentials: [
      {
        key: 'api_key',
        label: 'API Key',
        description: 'API key for your custom service',
        type: 'password',
        required: false,
        placeholder: 'sk-...',
      },
    ],
  },
  {
    id: 'node-cli',
    name: 'Node.js CLI',
    description: 'Node.js CLI tool with Docker sandbox',
    type: 'spawn-cli',
    category: 'custom',
    icon: '📦',
    adapterConfig: {
      command: '/usr/local/bin/node',
      args: ['/app/index.js'],
      dockerSandbox: true,
      sandboxImage: 'node:18-alpine',
      memoryLimit: '256m',
      cpuLimit: '0.25',
      timeoutSeconds: 30,
      workingDirectory: '/app',
    },
    models: [
      {
        dyadModelId: 'custom-node-model',
        adapterModelId: 'default',
        maxTokens: 1024,
        contextWindow: 2048,
        supportsStreaming: false,
        supportsEmbeddings: false,
      },
    ],
  },
];

// HTTP-SDK Templates
const httpSdkTemplates: ProviderTemplate[] = [
  {
    id: 'openai-api',
    name: 'OpenAI API',
    description: 'Official OpenAI API with GPT models',
    type: 'http-sdk',
    category: 'popular',
    icon: '🤖',
    adapterConfig: {
      baseUrl: 'https://api.openai.com/v1',
      authType: 'bearer',
      timeoutSeconds: 60,
      retryAttempts: 3,
      maxConcurrentRequests: 10,
    },
    models: [
      {
        dyadModelId: 'gpt-4',
        adapterModelId: 'gpt-4',
        maxTokens: 8192,
        contextWindow: 8192,
        supportsStreaming: true,
        supportsEmbeddings: false,
      },
      {
        dyadModelId: 'gpt-3.5-turbo',
        adapterModelId: 'gpt-3.5-turbo',
        maxTokens: 4096,
        contextWindow: 4096,
        supportsStreaming: true,
        supportsEmbeddings: false,
      },
    ],
    credentials: [
      {
        key: 'api_key',
        label: 'OpenAI API Key',
        description: 'Your OpenAI API key from platform.openai.com',
        type: 'password',
        required: true,
        placeholder: 'sk-...',
      },
    ],
    documentation: {
      setupUrl: 'https://platform.openai.com/api-keys',
      apiDocsUrl: 'https://platform.openai.com/docs/api-reference',
    },
  },
  {
    id: 'anthropic-api',
    name: 'Anthropic Claude',
    description: 'Anthropic Claude API integration',
    type: 'http-sdk',
    category: 'popular',
    icon: '🧠',
    adapterConfig: {
      baseUrl: 'https://api.anthropic.com/v1',
      authType: 'api-key',
      headers: {
        'anthropic-version': '2023-06-01',
      },
      timeoutSeconds: 60,
      retryAttempts: 3,
      maxConcurrentRequests: 5,
    },
    models: [
      {
        dyadModelId: 'claude-3-opus',
        adapterModelId: 'claude-3-opus-20240229',
        maxTokens: 4096,
        contextWindow: 200000,
        supportsStreaming: true,
        supportsEmbeddings: false,
      },
      {
        dyadModelId: 'claude-3-sonnet',
        adapterModelId: 'claude-3-sonnet-20240229',
        maxTokens: 4096,
        contextWindow: 200000,
        supportsStreaming: true,
        supportsEmbeddings: false,
      },
    ],
    credentials: [
      {
        key: 'api_key',
        label: 'Anthropic API Key',
        description: 'Your Anthropic API key from console.anthropic.com',
        type: 'password',
        required: true,
        placeholder: 'sk-ant-...',
      },
    ],
    documentation: {
      setupUrl: 'https://console.anthropic.com/',
      apiDocsUrl: 'https://docs.anthropic.com/claude/reference',
    },
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    description: 'Microsoft Azure OpenAI Service',
    type: 'http-sdk',
    category: 'cloud',
    icon: '☁️',
    adapterConfig: {
      baseUrl: 'https://your-resource.openai.azure.com/openai/deployments',
      authType: 'api-key',
      headers: {
        'api-version': '2023-12-01-preview',
      },
      timeoutSeconds: 60,
      retryAttempts: 3,
      maxConcurrentRequests: 10,
    },
    models: [
      {
        dyadModelId: 'gpt-4',
        adapterModelId: 'gpt-4-deployment',
        maxTokens: 8192,
        contextWindow: 8192,
        supportsStreaming: true,
        supportsEmbeddings: false,
      },
    ],
    credentials: [
      {
        key: 'api_key',
        label: 'Azure API Key',
        description: 'Your Azure OpenAI API key',
        type: 'password',
        required: true,
        placeholder: 'your-api-key',
      },
      {
        key: 'resource_name',
        label: 'Resource Name',
        description: 'Your Azure OpenAI resource name',
        type: 'text',
        required: true,
        placeholder: 'your-resource',
      },
    ],
    documentation: {
      setupUrl: 'https://azure.microsoft.com/en-us/products/cognitive-services/openai-service',
      apiDocsUrl: 'https://learn.microsoft.com/en-us/azure/cognitive-services/openai/reference',
    },
  },
  {
    id: 'huggingface-api',
    name: 'Hugging Face Inference API',
    description: 'Hugging Face hosted models',
    type: 'http-sdk',
    category: 'cloud',
    icon: '🤗',
    adapterConfig: {
      baseUrl: 'https://api-inference.huggingface.co/models',
      authType: 'bearer',
      timeoutSeconds: 30,
      retryAttempts: 3,
      maxConcurrentRequests: 5,
    },
    models: [
      {
        dyadModelId: 'mistral-7b',
        adapterModelId: 'mistralai/Mistral-7B-Instruct-v0.1',
        maxTokens: 4096,
        contextWindow: 8192,
        supportsStreaming: false,
        supportsEmbeddings: false,
      },
    ],
    credentials: [
      {
        key: 'api_key',
        label: 'Hugging Face Token',
        description: 'Your Hugging Face API token',
        type: 'password',
        required: true,
        placeholder: 'hf_...',
      },
    ],
    documentation: {
      setupUrl: 'https://huggingface.co/settings/tokens',
      apiDocsUrl: 'https://huggingface.co/docs/api-inference/index',
    },
  },
];

// Proxy Templates
const proxyTemplates: ProviderTemplate[] = [
  {
    id: 'openai-proxy',
    name: 'OpenAI Proxy',
    description: 'Proxy to OpenAI API with custom routing',
    type: 'proxy',
    category: 'popular',
    icon: '🔄',
    adapterConfig: {
      proxyUrl: 'https://api.openai.com/v1',
      apiKeyHeaderName: 'Authorization',
      forwardHeaders: ['User-Agent', 'Content-Type'],
      transformRequest: false,
      transformResponse: false,
      timeoutSeconds: 60,
      retryAttempts: 3,
      maxConcurrentRequests: 10,
    },
    models: [
      {
        dyadModelId: 'gpt-4',
        adapterModelId: 'gpt-4',
        maxTokens: 8192,
        contextWindow: 8192,
        supportsStreaming: true,
        supportsEmbeddings: false,
      },
    ],
    credentials: [
      {
        key: 'api_key',
        label: 'API Key',
        description: 'API key to forward to the proxied service',
        type: 'password',
        required: true,
        placeholder: 'sk-...',
      },
    ],
  },
  {
    id: 'custom-proxy',
    name: 'Custom Proxy',
    description: 'Generic proxy configuration for custom endpoints',
    type: 'proxy',
    category: 'custom',
    icon: '🌐',
    adapterConfig: {
      proxyUrl: 'https://your-proxy.example.com/v1',
      apiKeyHeaderName: 'X-API-Key',
      forwardHeaders: [],
      transformRequest: true,
      transformResponse: true,
      timeoutSeconds: 30,
      retryAttempts: 2,
      maxConcurrentRequests: 5,
    },
    models: [
      {
        dyadModelId: 'custom-model',
        adapterModelId: 'default',
        maxTokens: 2048,
        contextWindow: 4096,
        supportsStreaming: false,
        supportsEmbeddings: false,
      },
    ],
    credentials: [
      {
        key: 'api_key',
        label: 'API Key',
        description: 'API key for your custom proxy service',
        type: 'password',
        required: true,
        placeholder: 'your-api-key',
      },
    ],
  },
];

// Local Templates
const localTemplates: ProviderTemplate[] = [
  {
    id: 'ollama-server',
    name: 'Ollama Server',
    description: 'Local Ollama server instance',
    type: 'local',
    category: 'popular',
    icon: '🦙',
    adapterConfig: {
      localUrl: 'http://localhost:11434',
      healthCheckPath: '/api/tags',
      protocol: 'http',
      timeoutSeconds: 30,
      retryAttempts: 3,
      maxConcurrentRequests: 5,
      keepAlive: true,
      connectionPoolSize: 3,
    },
    models: [
      {
        dyadModelId: 'llama2',
        adapterModelId: 'llama2:latest',
        maxTokens: 4096,
        contextWindow: 4096,
        supportsStreaming: true,
        supportsEmbeddings: false,
      },
    ],
    documentation: {
      setupUrl: 'https://ollama.ai/download',
      apiDocsUrl: 'https://github.com/jmorganca/ollama/blob/main/docs/api.md',
    },
  },
  {
    id: 'text-generation-webui',
    name: 'Text Generation WebUI',
    description: 'oobabooga text-generation-webui server',
    type: 'local',
    category: 'local',
    icon: '💻',
    adapterConfig: {
      localUrl: 'http://localhost:5000',
      healthCheckPath: '/api/v1/models',
      protocol: 'http',
      timeoutSeconds: 60,
      retryAttempts: 2,
      maxConcurrentRequests: 3,
      keepAlive: true,
      connectionPoolSize: 2,
    },
    models: [
      {
        dyadModelId: 'local-model',
        adapterModelId: 'current',
        maxTokens: 2048,
        contextWindow: 4096,
        supportsStreaming: true,
        supportsEmbeddings: false,
      },
    ],
    documentation: {
      setupUrl: 'https://github.com/oobabooga/text-generation-webui',
      apiDocsUrl: 'https://github.com/oobabooga/text-generation-webui/wiki/12-%E2%80%90-OpenAI-API',
    },
  },
  {
    id: 'llamacpp-server',
    name: 'llama.cpp Server',
    description: 'llama.cpp HTTP server',
    type: 'local',
    category: 'local',
    icon: '🔧',
    adapterConfig: {
      localUrl: 'http://localhost:8080',
      healthCheckPath: '/health',
      protocol: 'http',
      timeoutSeconds: 45,
      retryAttempts: 2,
      maxConcurrentRequests: 4,
      keepAlive: true,
      connectionPoolSize: 2,
    },
    models: [
      {
        dyadModelId: 'llama-model',
        adapterModelId: 'llama',
        maxTokens: 2048,
        contextWindow: 2048,
        supportsStreaming: true,
        supportsEmbeddings: false,
      },
    ],
    documentation: {
      setupUrl: 'https://github.com/ggerganov/llama.cpp',
      apiDocsUrl: 'https://github.com/ggerganov/llama.cpp/blob/master/examples/server/README.md',
    },
  },
];

// Combine all templates
export const providerTemplates: ProviderTemplate[] = [
  ...spawnCliTemplates,
  ...httpSdkTemplates,
  ...proxyTemplates,
  ...localTemplates,
];

// Helper functions
export const getTemplatesByType = (type: ProviderType): ProviderTemplate[] => {
  return providerTemplates.filter(template => template.type === type);
};

export const getTemplatesByCategory = (category: string): ProviderTemplate[] => {
  return providerTemplates.filter(template => template.category === category);
};

export const getPopularTemplates = (): ProviderTemplate[] => {
  return providerTemplates.filter(template => template.category === 'popular');
};

export const getTemplateById = (id: string): ProviderTemplate | undefined => {
  return providerTemplates.find(template => template.id === id);
};

export const searchTemplates = (query: string): ProviderTemplate[] => {
  const lowercaseQuery = query.toLowerCase();
  return providerTemplates.filter(template =>
    template.name.toLowerCase().includes(lowercaseQuery) ||
    template.description.toLowerCase().includes(lowercaseQuery)
  );
};

// Template categories for UI organization
export const templateCategories = [
  { id: 'popular', name: 'Popular', description: 'Most commonly used providers' },
  { id: 'cloud', name: 'Cloud APIs', description: 'Hosted AI services' },
  { id: 'local', name: 'Local Servers', description: 'Self-hosted solutions' },
  { id: 'custom', name: 'Custom', description: 'Custom integrations' },
] as const;

export type TemplateCategory = typeof templateCategories[number]['id'];