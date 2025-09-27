# Embeddings Implementation

This document describes the implementation of the embeddings endpoint (`POST /v1/embeddings`) in the Dyad CLI Gateway.

## Overview

The embeddings endpoint provides OpenAI-compatible text embeddings functionality through various adapter types. It supports both single text inputs and arrays of text inputs, returning vector embeddings that can be used for semantic search, clustering, and other NLP tasks.

## API Endpoint

### POST /v1/embeddings

**Request Format:**
```json
{
  "model": "text-embedding-ada-002",
  "input": "Your text string here",
  "encoding_format": "float"
}
```

**Array Input:**
```json
{
  "model": "text-embedding-ada-002", 
  "input": ["First text", "Second text", "Third text"],
  "encoding_format": "float"
}
```

**Response Format:**
```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.1, 0.2, 0.3, ...],
      "index": 0
    }
  ],
  "model": "text-embedding-ada-002",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

## Authentication & Permissions

- Requires API key with `embeddings` permission
- API keys must be passed in the `Authorization: Bearer <key>` header
- Rate limiting applies based on API key configuration

## Adapter Support

### HTTP-SDK Adapter
- Supports embeddings through vendor APIs
- Configurable via `embeddingsEndpoint` in adapter config
- Handles request/response transformation for different vendors

### Proxy Adapter  
- Forwards embeddings requests to OpenAI-compatible services
- Supports header rewriting and authentication injection
- Maintains streaming compatibility where supported

### Local Adapter
- Communicates with local embedding models (Ollama, LocalAI)
- Auto-detects service type and capabilities
- Health checking for local services

### Spawn-CLI Adapter
- Executes CLI commands for embeddings generation
- Requires `supportsEmbeddings: true` in provider configuration
- Sandboxed execution with Docker containers
- JSON input/output format with `--embeddings` flag

## Provider Configuration

Providers must be configured with embeddings support:

```json
{
  "name": "OpenAI Embeddings",
  "type": "http-sdk",
  "models": [
    {
      "dyadModelId": "text-embedding-ada-002",
      "adapterModelId": "text-embedding-ada-002", 
      "supportsEmbeddings": true,
      "maxTokens": 8192
    }
  ],
  "adapterConfig": {
    "baseUrl": "https://api.openai.com",
    "embeddingsEndpoint": "/v1/embeddings"
  }
}
```

## Error Handling

The endpoint returns OpenAI-compatible error responses:

- `400 Bad Request`: Missing required fields, invalid input format
- `401 Unauthorized`: Missing or invalid API key
- `403 Forbidden`: Insufficient permissions (missing `embeddings` permission)
- `404 Not Found`: Model not found or not supported
- `500 Internal Server Error`: Provider errors, adapter failures

## Response Normalization

The OpenAI normalizer handles various response formats:

- **OpenAI Format**: Pass-through with model name correction
- **Array Format**: Converts arrays of embeddings to OpenAI list format
- **Single Embedding**: Wraps single embeddings in list format
- **Object Format**: Extracts embeddings from object responses

## Usage Tracking

- Token usage is tracked and updated in API key statistics
- Embeddings requests count toward daily/monthly quotas
- Usage information included in response for billing/monitoring

## Testing

Comprehensive test coverage includes:

- Unit tests for all adapters
- Integration tests for the embeddings endpoint
- Response normalization tests
- Error handling scenarios
- Permission and authentication tests

## CLI Adapter Implementation

For CLI-based embeddings, the adapter:

1. Prepares JSON input with `type: "embeddings"`
2. Executes command with `--embeddings` flag
3. Parses JSON output from stdout
4. Normalizes response to OpenAI format
5. Handles various output formats (arrays, objects, single embeddings)

Example CLI input format:
```json
{
  "input": "Text to embed",
  "options": {
    "encoding_format": "float"
  },
  "type": "embeddings"
}
```

Expected CLI output formats:
```json
// OpenAI format
{
  "object": "list",
  "data": [{"object": "embedding", "embedding": [0.1, 0.2], "index": 0}]
}

// Array format  
[[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]

// Single embedding
{"embedding": [0.1, 0.2, 0.3]}
```

## Security Considerations

- All CLI executions are sandboxed in Docker containers
- Input sanitization prevents injection attacks
- Credentials are encrypted at rest
- Request logging excludes sensitive data
- Rate limiting prevents abuse

## Performance

- Connection pooling for HTTP adapters
- Caching of provider health status
- Efficient JSON parsing and normalization
- Timeout handling for long-running operations
- Circuit breaker pattern for failing providers