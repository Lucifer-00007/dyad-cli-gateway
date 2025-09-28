/**
 * Core API types generated from OpenAPI specification
 * These types represent the data models used throughout the admin UI
 */

// Base types
export type ProviderType = 'spawn-cli' | 'http-sdk' | 'proxy' | 'local';
export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown';
export type ChatRole = 'system' | 'user' | 'assistant';
export type FinishReason = 'stop' | 'length' | 'content_filter' | 'null';

// Provider Management Types
export interface Provider {
  id: string;
  name: string;
  slug: string;
  type: ProviderType;
  description?: string;
  enabled: boolean;
  models: ModelMapping[];
  adapterConfig: AdapterConfig;
  healthStatus?: ProviderHealthStatus;
  rateLimits?: RateLimits;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ModelMapping {
  dyadModelId: string;
  adapterModelId: string;
  maxTokens?: number;
  contextWindow?: number;
  supportsStreaming?: boolean;
  supportsEmbeddings?: boolean;
}

export interface AdapterConfig {
  // Common properties
  timeoutSeconds?: number;
  retryAttempts?: number;
  
  // Spawn-CLI specific
  command?: string;
  args?: string[];
  dockerSandbox?: boolean;
  sandboxImage?: string;
  memoryLimit?: string;
  cpuLimit?: string;
  
  // HTTP-SDK specific
  baseUrl?: string;
  headers?: Record<string, string>;
  
  // Proxy specific
  proxyUrl?: string;
  
  // Local specific
  localUrl?: string;
  healthCheckPath?: string;
}

export interface ProviderHealthStatus {
  status: HealthStatus;
  lastChecked?: string;
  errorMessage?: string;
}

export interface RateLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

// API Request/Response Types
export interface CreateProviderRequest {
  name: string;
  slug: string;
  type: ProviderType;
  description?: string;
  enabled?: boolean;
  models: ModelMapping[];
  adapterConfig: AdapterConfig;
  credentials?: Record<string, string>;
  rateLimits?: RateLimits;
  metadata?: Record<string, any>;
}

export interface UpdateProviderRequest {
  name?: string;
  slug?: string;
  type?: ProviderType;
  description?: string;
  enabled?: boolean;
  models?: ModelMapping[];
  adapterConfig?: AdapterConfig;
  credentials?: Record<string, string>;
  rateLimits?: RateLimits;
  metadata?: Record<string, any>;
}

export interface ProvidersListResponse {
  results: Provider[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}

export interface ProviderTestResponse {
  status: 'success' | 'failure';
  message: string;
  duration: number;
  timestamp: string;
  testResult?: {
    response: string;
    tokensUsed: number;
  };
  error?: {
    type: string;
    message: string;
  };
}

export interface ProviderHealthResponse {
  status: HealthStatus | 'disabled';
  message: string;
  timestamp: string;
  duration: number;
  providerName: string;
  providerType: ProviderType;
  lastChecked: string;
  error?: {
    type: string;
    message: string;
  };
}

// OpenAI v1 API Types
export interface Model {
  id: string;
  object: 'model';
  owned_by: string;
  provider?: string;
  max_tokens?: number;
  context_window?: number;
  supports_streaming?: boolean;
  supports_embeddings?: boolean;
}

export interface ModelsResponse {
  object: 'list';
  data: Model[];
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: FinishReason;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: Usage;
}

export interface ChatCompletionDelta {
  role?: 'assistant';
  content?: string;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionDelta;
  finish_reason: FinishReason | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  usage?: Usage;
}

// Health Check Types
export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  service: string;
  version?: string;
}

export interface ReadinessResponse {
  status: 'ready';
  timestamp: string;
  checks: {
    database: 'ok' | 'error';
  };
}

// Error Types
export interface ApiError {
  message: string;
  type: string;
  code: string;
  request_id?: string;
  stack?: string;
}

export interface ErrorResponse {
  error: ApiError;
}

// System Metrics Types (for monitoring dashboard)
export interface SystemMetrics {
  totalRequests: number;
  successRate: number;
  averageLatency: number;
  activeProviders: number;
  errorRate: number;
  uptime: number;
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

// Log Entry Types
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  source: string;
  providerId?: string;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

// API Key Management Types
export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  enabled: boolean;
  permissions: string[];
  rateLimits: RateLimits;
  usage: {
    requestsToday: number;
    tokensToday: number;
  };
  createdAt: string;
  lastUsed?: string;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: string[];
  rateLimits?: RateLimits;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  key: string; // Full key shown only once
}

// Pagination and Filtering
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ProviderFilters {
  enabled?: boolean;
  type?: ProviderType;
}

export interface ListProvidersParams extends PaginationParams, ProviderFilters {}

// Form validation types
export interface FormErrors {
  [key: string]: string | FormErrors;
}

export interface ValidationResult {
  isValid: boolean;
  errors: FormErrors;
}