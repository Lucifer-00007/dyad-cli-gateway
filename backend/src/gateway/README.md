# Dyad CLI Gateway

A pluggable, OpenAI-compatible gateway that enables communication with CLI agents, local model servers, and vendor SDKs through a unified `/v1` API interface.

## Directory Structure

```
gateway/
├── adapters/           # Pluggable adapter implementations
├── config/            # Gateway-specific configuration
├── controllers/       # HTTP request handlers
├── middlewares/       # Gateway-specific middleware
├── models/           # Data models for providers, API keys, etc.
├── routes/           # API route definitions
├── services/         # Business logic and orchestration
├── utils/            # Utility functions
└── index.js          # Main gateway export
```

## Configuration

The gateway is configured through environment variables. See `backend/.env.example` for all available options.

Key configuration areas:
- **Core Settings**: Port, API prefixes, enable/disable
- **Sandbox**: Docker container settings for CLI execution
- **Security**: Rate limiting, CORS, authentication
- **Adapters**: Timeouts, retries, circuit breaker settings
- **Logging**: Log levels and sensitive data redaction

## Getting Started

### Development Mode
```bash
npm run gateway:dev
```

### Production Mode
```bash
npm run gateway:start
```

### Docker Deployment
```bash
npm run gateway:docker:build
```

## API Endpoints

### OpenAI-Compatible Endpoints
- `POST /v1/chat/completions` - Chat completion requests
- `GET /v1/models` - List available models
- `POST /v1/embeddings` - Generate embeddings

### Admin Endpoints
- `GET /admin/providers` - List providers
- `POST /admin/providers` - Create provider
- `PUT /admin/providers/:id` - Update provider
- `DELETE /admin/providers/:id` - Delete provider
- `POST /admin/providers/:id/test` - Test provider connectivity

### Health Endpoints
- `GET /healthz` - Liveness check
- `GET /ready` - Readiness check

## Security

- API key authentication for `/v1/*` endpoints
- JWT authentication for `/admin/*` endpoints
- Containerized execution for CLI adapters
- Input sanitization and validation
- Rate limiting and quotas
- Sensitive data redaction in logs

## Adapters

The gateway supports multiple adapter types:

1. **Spawn-CLI**: Execute CLI commands in sandboxed containers
2. **HTTP-SDK**: Call vendor APIs with authentication and mapping
3. **Proxy**: Forward requests to OpenAI-compatible services
4. **Local**: Connect to local model servers (Ollama, TGI)

## Implementation Status

This is the initial project structure setup. Individual components will be implemented in subsequent tasks according to the implementation plan.