# Frontend API Contract Documentation

## Overview

This document defines the complete API contract for frontend integration with the Dyad CLI Gateway. It covers all available endpoints, request/response formats, authentication requirements, and error handling patterns.

## Base Configuration

### API Base URLs
```typescript
// Development
const API_BASE_URL = 'http://localhost:3000/v1';

// Production
const API_BASE_URL = 'https://your-domain.com/v1';
```

### Authentication
All admin endpoints require JWT authentication with appropriate permissions.

```typescript
// Request headers
{
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}
```

## OpenAI-Compatible Endpoints

### 1. Chat Completions
**Endpoint:** `POST /v1/chat/completions`  
**Authentication:** API Key (Bearer token)  
**Permissions Required:** `chat`

#### Request Format
```typescript
interface ChatCompletionRequest {
  model: string;                    // Required: Model identifier
  messages: ChatMessage[];          // Required: Conversation messages
  max_tokens?: number;             // Optional: Maximum tokens to generate
  temperature?: number;            // Optional: 0.0 to 2.0, controls randomness
  top_p?: number;                  // Optional: Nucleus sampling parameter
  n?: number;                      // Optional: Number of completions to generate
  stream?: boolean;                // Optional: Enable streaming responses
  stop?: string | string[];        // Optional: Stop sequences
  presence_penalty?: number;       // Optional: -2.0 to 2.0
  frequency_penalty?: number;      // Optional: -2.0 to 2.0
  logit_bias?: Record<string, number>; // Optional: Token bias
  user?: string;                   // Optional: User identifier
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;                   // Optional: Message author name
}
```

#### Response Format (Non-streaming)
```typescript
interface ChatCompletionResponse {
  id: string;                      // Unique request identifier
  object: 'chat.completion';
  created: number;                 // Unix timestamp
  model: string;                   // Model used for completion
  choices: ChatChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}
```

#### Response Format (Streaming)
```typescript
// Server-Sent Events format
interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatChoiceChunk[];
}

interface ChatChoiceChunk {
  index: number;
  delta: {
    role?: string;
    content?: string;
  };
  finish_reason?: 'stop' | 'length' | 'content_filter' | null;
}

// Final chunk
// data: [DONE]
```

#### Example Usage
```typescript
// Non-streaming request
const response = await fetch('/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk-your-api-key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'Hello, how are you?' }
    ],
    max_tokens: 150,
    temperature: 0.7
  })
});

// Streaming request
const response = await fetch('/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk-your-api-key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'Tell me a story' }
    ],
    stream: true
  })
});

// Handle streaming response
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') return;
      
      try {
        const parsed = JSON.parse(data);
        console.log(parsed.choices[0]?.delta?.content || '');
      } catch (e) {
        // Handle parsing errors
      }
    }
  }
}
```

### 2. Models List
**Endpoint:** `GET /v1/models`  
**Authentication:** API Key (Bearer token)  
**Permissions Required:** `models`

#### Response Format
```typescript
interface ModelsResponse {
  object: 'list';
  data: ModelInfo[];
}

interface ModelInfo {
  id: string;                      // Model identifier
  object: 'model';
  created: number;                 // Unix timestamp
  owned_by: string;               // Provider/organization
  permission: ModelPermission[];
  root: string;                   // Base model
  parent: string | null;          // Parent model
}

interface ModelPermission {
  id: string;
  object: 'model_permission';
  created: number;
  allow_create_engine: boolean;
  allow_sampling: boolean;
  allow_logprobs: boolean;
  allow_search_indices: boolean;
  allow_view: boolean;
  allow_fine_tuning: boolean;
  organization: string;
  group: string | null;
  is_blocking: boolean;
}
```

#### Example Usage
```typescript
const response = await fetch('/v1/models', {
  headers: {
    'Authorization': 'Bearer sk-your-api-key',
  }
});

const models = await response.json();
console.log(models.data.map(m => m.id)); // ['gpt-3.5-turbo', 'gpt-4', ...]
```

### 3. Embeddings
**Endpoint:** `POST /v1/embeddings`  
**Authentication:** API Key (Bearer token)  
**Permissions Required:** `embeddings`

#### Request Format
```typescript
interface EmbeddingsRequest {
  model: string;                   // Required: Model identifier
  input: string | string[];        // Required: Text to embed
  encoding_format?: 'float' | 'base64'; // Optional: Response format
  user?: string;                   // Optional: User identifier
}
```

#### Response Format
```typescript
interface EmbeddingsResponse {
  object: 'list';
  data: EmbeddingData[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface EmbeddingData {
  object: 'embedding';
  embedding: number[];             // Vector representation
  index: number;                   // Input index
}
```

#### Example Usage
```typescript
const response = await fetch('/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk-your-api-key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'text-embedding-ada-002',
    input: ['Hello world', 'How are you?']
  })
});

const embeddings = await response.json();
console.log(embeddings.data[0].embedding); // [0.1, -0.2, 0.3, ...]
```

## Admin API Endpoints

### Authentication
All admin endpoints require JWT authentication with `manageUsers` permission.

```typescript
// Login to get JWT token
const loginResponse = await fetch('/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'password'
  })
});

const { tokens } = await loginResponse.json();
const accessToken = tokens.access.token;
```

### 1. Provider Management

#### Get All Providers
**Endpoint:** `GET /v1/admin/providers`

**Query Parameters:**
```typescript
interface GetProvidersQuery {
  page?: number;                   // Default: 1
  limit?: number;                  // Default: 10, Max: 100
  enabled?: boolean;               // Filter by enabled status
  type?: 'spawn-cli' | 'http-sdk' | 'proxy' | 'local'; // Filter by type
}
```

**Response:**
```typescript
interface ProvidersResponse {
  results: Provider[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}

interface Provider {
  id: string;
  name: string;
  type: 'spawn-cli' | 'http-sdk' | 'proxy' | 'local';
  enabled: boolean;
  config: ProviderConfig;
  models: string[];
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck: string;         // ISO date string
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags?: string[];
  description?: string;
}

interface ProviderConfig {
  // Common fields
  endpoint?: string;
  timeout?: number;
  retries?: number;
  
  // Type-specific fields
  command?: string;                // For spawn-cli
  args?: string[];                // For spawn-cli
  env?: Record<string, string>;   // For spawn-cli
  apiKey?: string;                // For http-sdk
  headers?: Record<string, string>; // For http-sdk
  proxyUrl?: string;              // For proxy
  modelPath?: string;             // For local
}
```

#### Create Provider
**Endpoint:** `POST /v1/admin/providers`

**Request:**
```typescript
interface CreateProviderRequest {
  name: string;                    // Required: Unique provider name
  type: 'spawn-cli' | 'http-sdk' | 'proxy' | 'local'; // Required
  enabled?: boolean;               // Default: true
  config: ProviderConfig;          // Required: Type-specific configuration
  models: string[];               // Required: Supported model IDs
  tags?: string[];                // Optional: Organization tags
  description?: string;           // Optional: Provider description
}
```

**Response:** `Provider` object with 201 status

#### Update Provider
**Endpoint:** `PATCH /v1/admin/providers/:providerId`

**Request:** Partial `CreateProviderRequest`  
**Response:** Updated `Provider` object

#### Delete Provider
**Endpoint:** `DELETE /v1/admin/providers/:providerId`

**Response:** 204 No Content

#### Test Provider
**Endpoint:** `POST /v1/admin/providers/:providerId/test`

**Request:**
```typescript
interface TestProviderRequest {
  dryRun?: boolean;               // Default: false
}
```

**Response:**
```typescript
interface TestProviderResponse {
  status: 'success' | 'failure';
  message: string;
  details: {
    responseTime: number;         // Milliseconds
    statusCode?: number;
    error?: string;
    testPayload?: any;
    testResponse?: any;
  };
  timestamp: string;
}
```

#### Check Provider Health
**Endpoint:** `POST /v1/admin/providers/:providerId/health`

**Response:**
```typescript
interface ProviderHealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  details: {
    responseTime: number;
    availability: number;         // Percentage
    errorRate: number;           // Percentage
    lastError?: string;
    lastErrorTime?: string;
  };
  timestamp: string;
}
```

### 2. API Key Management

#### Get All API Keys
**Endpoint:** `GET /v1/admin/apikeys`

**Query Parameters:**
```typescript
interface GetApiKeysQuery {
  page?: number;
  limit?: number;
  enabled?: boolean;
  userId?: string;                // Filter by user ID
}
```

**Response:**
```typescript
interface ApiKeysResponse {
  results: ApiKey[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;              // First 8 characters of key
  enabled: boolean;
  permissions: ('chat' | 'embeddings' | 'models')[];
  allowedModels: string[];        // Empty array = all models
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  usage: {
    totalRequests: number;
    totalTokens: number;
    lastUsed?: string;
  };
  expiresAt?: string;             // ISO date string
  createdAt: string;
  updatedAt: string;
  userId: string;
  user?: {                        // Populated if requested
    id: string;
    name: string;
    email: string;
  };
}
```

#### Create API Key
**Endpoint:** `POST /v1/admin/apikeys`

**Request:**
```typescript
interface CreateApiKeyRequest {
  name: string;                   // Required: Key name/description
  userId: string;                 // Required: Owner user ID
  permissions: ('chat' | 'embeddings' | 'models')[]; // Required
  allowedModels?: string[];       // Optional: Restrict to specific models
  rateLimit?: {
    requestsPerMinute?: number;   // Default: 60
    tokensPerMinute?: number;     // Default: 10000
  };
  expiresAt?: string;            // Optional: ISO date string
  enabled?: boolean;             // Default: true
}
```

**Response:**
```typescript
interface CreateApiKeyResponse {
  apiKey: ApiKey;
  key: string;                   // Full API key (only returned once!)
  message: string;
}
```

#### Revoke API Key
**Endpoint:** `POST /v1/admin/apikeys/:apiKeyId/revoke`

**Request:**
```typescript
interface RevokeApiKeyRequest {
  reason?: string;               // Optional: Revocation reason
}
```

**Response:**
```typescript
interface RevokeApiKeyResponse {
  status: 'success';
  message: string;
  apiKeyName: string;
  revokedAt: string;
}
```

### 3. Circuit Breaker Management

#### Get Circuit Breaker Status
**Endpoint:** `GET /v1/admin/circuit-breakers`

**Response:**
```typescript
interface CircuitBreakerStatusResponse {
  status: 'success';
  data: Record<string, CircuitBreakerStatus>;
  timestamp: string;
}

interface CircuitBreakerStatus {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  nextAttempt?: string;           // ISO date string
  lastFailure?: {
    error: string;
    timestamp: string;
  };
}
```

#### Reset Circuit Breaker
**Endpoint:** `POST /v1/admin/circuit-breakers/:providerId/reset`

**Response:**
```typescript
interface CircuitBreakerActionResponse {
  status: 'success';
  message: string;
  providerId: string;
  timestamp: string;
}
```

### 4. Monitoring & Analytics

#### Get Reliability Statistics
**Endpoint:** `GET /v1/admin/reliability-stats`

**Response:**
```typescript
interface ReliabilityStatsResponse {
  status: 'success';
  data: {
    overall: {
      uptime: number;             // Percentage
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageResponseTime: number; // Milliseconds
    };
    providers: Record<string, ProviderStats>;
    timeRange: {
      start: string;              // ISO date string
      end: string;
    };
  };
  timestamp: string;
}

interface ProviderStats {
  name: string;
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  errorRate: number;
  lastError?: {
    message: string;
    timestamp: string;
  };
}
```

## Error Handling

### Error Response Format
All endpoints return errors in a consistent format:

```typescript
interface ErrorResponse {
  error: {
    message: string;              // Human-readable error message
    type: string;                // Error category
    code: string;                // Specific error code
    details?: any;               // Additional error context
  };
  request_id?: string;           // For debugging
}
```

### Common Error Types

#### Authentication Errors (401)
```typescript
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

#### Permission Errors (403)
```typescript
{
  "error": {
    "message": "Access denied for model: gpt-4",
    "type": "permission_error",
    "code": "model_access_denied"
  }
}
```

#### Validation Errors (400)
```typescript
{
  "error": {
    "message": "Missing required fields: model and messages",
    "type": "invalid_request_error",
    "code": "invalid_request",
    "details": {
      "missing_fields": ["model", "messages"]
    }
  }
}
```

#### Rate Limit Errors (429)
```typescript
{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded",
    "details": {
      "retry_after": 60,          // Seconds
      "limit_type": "requests_per_minute"
    }
  }
}
```

#### Server Errors (500)
```typescript
{
  "error": {
    "message": "Internal server error",
    "type": "internal_error",
    "code": "internal_server_error"
  }
}
```

## TypeScript SDK Example

```typescript
class DyadGatewayClient {
  private baseUrl: string;
  private apiKey?: string;
  private accessToken?: string;

  constructor(config: { baseUrl: string; apiKey?: string; accessToken?: string }) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.accessToken = config.accessToken;
  }

  // OpenAI-compatible methods
  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return this.request('POST', '/chat/completions', request, this.apiKey);
  }

  async getModels(): Promise<ModelsResponse> {
    return this.request('GET', '/models', undefined, this.apiKey);
  }

  async createEmbeddings(request: EmbeddingsRequest): Promise<EmbeddingsResponse> {
    return this.request('POST', '/embeddings', request, this.apiKey);
  }

  // Admin methods
  async getProviders(query?: GetProvidersQuery): Promise<ProvidersResponse> {
    const params = new URLSearchParams(query as any).toString();
    return this.request('GET', `/admin/providers?${params}`, undefined, this.accessToken);
  }

  async createProvider(provider: CreateProviderRequest): Promise<Provider> {
    return this.request('POST', '/admin/providers', provider, this.accessToken);
  }

  async testProvider(providerId: string, options?: TestProviderRequest): Promise<TestProviderResponse> {
    return this.request('POST', `/admin/providers/${providerId}/test`, options, this.accessToken);
  }

  // Generic request method
  private async request<T>(
    method: string,
    path: string,
    body?: any,
    token?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error.message}`);
    }

    return response.json();
  }
}

// Usage example
const client = new DyadGatewayClient({
  baseUrl: 'http://localhost:3000/v1',
  apiKey: 'sk-your-api-key',
  accessToken: 'jwt-admin-token'
});

// Use OpenAI-compatible endpoints
const completion = await client.createChatCompletion({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello!' }]
});

// Use admin endpoints
const providers = await client.getProviders({ enabled: true });
```

This API contract provides a complete reference for frontend developers to integrate with the Dyad CLI Gateway system.