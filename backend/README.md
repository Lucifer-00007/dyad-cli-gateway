# Dyad CLI Gateway - Backend

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/dyad/gateway)
[![Coverage Status](https://img.shields.io/badge/coverage-85%25-green.svg)](https://github.com/dyad/gateway)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

A pluggable, OpenAI-compatible gateway that enables Dyad (or any OpenAI-compatible client) to communicate with CLI agents, local model servers, and vendor SDKs through a unified `/v1` API surface.

The backend provides protocol translation, converting OpenAI-style requests into calls to various adapter types (CLI spawning, HTTP SDKs, proxies, local models) while maintaining full OpenAI API compatibility for seamless integration.

## Quick Start

### Prerequisites

- Node.js (>=18.0.0)
- MongoDB (>=5.0)
- Redis (optional, for caching and rate limiting)

### Installation

Install the dependencies:

```bash
cd backend
npm install
```

Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

### Development

Start the development server:

```bash
npm run dev
```

The gateway will be available at `http://localhost:3000` with OpenAI-compatible endpoints at `/v1/*`.

## Table of Contents

- [Features](#features)
- [Commands](#commands)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Error Handling](#error-handling)
- [Validation](#validation)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Logging](#logging)
- [Custom Mongoose Plugins](#custom-mongoose-plugins)
- [Linting](#linting)
- [Contributing](#contributing)

## Core Features

### Gateway Capabilities
- **OpenAI API Compatibility**: Full `/v1/chat/completions`, `/v1/models`, `/v1/embeddings` endpoint support
- **Pluggable Adapter System**: Support for CLI spawning, HTTP SDKs, proxy, and local model adapters
- **Provider Management**: Dynamic registration and configuration of AI providers
- **Request Routing**: Intelligent model-to-provider mapping with fallback support
- **Streaming Support**: Real-time response streaming for chat completions

### Infrastructure & Operations
- **MongoDB Integration**: Provider registry and configuration persistence using [Mongoose](https://mongoosejs.com)
- **Authentication & Authorization**: JWT-based auth with API key management using [Passport.js](http://www.passportjs.org)
- **Request Validation**: Comprehensive input validation using [Joi](https://github.com/hapijs/joi)
- **Monitoring & Logging**: Structured logging with [Winston](https://github.com/winstonjs/winston) and HTTP logging with [Morgan](https://github.com/expressjs/morgan)
- **Health Checks**: Provider health monitoring with circuit breaker patterns
- **Rate Limiting**: Configurable rate limiting per API key and provider
- **Caching**: Multi-level caching with Redis support

### Security & Performance
- **Security Headers**: HTTP security headers using [Helmet](https://helmetjs.github.io)
- **Input Sanitization**: XSS and injection protection with sanitization middleware
- **CORS Support**: Cross-Origin Resource-Sharing enabled using [cors](https://github.com/expressjs/cors)
- **Compression**: Gzip compression with [compression](https://github.com/expressjs/compression)
- **Connection Pooling**: Optimized database and HTTP connection management
- **Circuit Breakers**: Fault tolerance with automatic failover

### Development & Deployment
- **Testing Suite**: Unit and integration tests using [Jest](https://jestjs.io)
- **Process Management**: Production deployment with [PM2](https://pm2.keymetrics.io)
- **Docker Support**: Containerized deployment with Docker Compose
- **Code Quality**: [ESLint](https://eslint.org) (Airbnb config) and [Prettier](https://prettier.io) formatting
- **Git Hooks**: Pre-commit validation with [Husky](https://github.com/typicode/husky) and [lint-staged](https://github.com/okonet/lint-staged)

## Commands

### Development
```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Start with PM2 process manager
npm run start:pm2
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run test coverage report
npm run coverage

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance
```

### Docker
```bash
# Development container
npm run docker:dev

# Production container
npm run docker:prod

# Test container
npm run docker:test

# Full stack with dependencies
docker-compose up -d
```

### Code Quality
```bash
# Run ESLint
npm run lint

# Auto-fix ESLint issues
npm run lint:fix

# Check Prettier formatting
npm run prettier

# Auto-format with Prettier
npm run prettier:fix
```

### Database
```bash
# Run database migrations
npm run migrate

# Seed development data
npm run seed

# Reset database
npm run db:reset
```

## Environment Variables

Configure the gateway using environment variables in the `.env` file:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URL=mongodb://127.0.0.1:27017/dyad-gateway
REDIS_URL=redis://127.0.0.1:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_ACCESS_EXPIRATION_MINUTES=60
JWT_REFRESH_EXPIRATION_DAYS=30

# API Configuration
API_VERSION=v1
MAX_REQUEST_SIZE=10mb
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Provider Configuration
DEFAULT_TIMEOUT_MS=30000
MAX_RETRIES=3
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT_MS=60000

# Monitoring & Logging
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL_MS=30000

# Security
CORS_ORIGIN=*
HELMET_ENABLED=true
API_KEY_PREFIX=sk-dyad-

# Optional: External Services
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

## Project Structure

```
backend/
├── src/
│   ├── adapters/           # Provider adapter implementations
│   │   ├── spawn-cli.js    # CLI spawning adapter
│   │   ├── http-sdk.js     # HTTP SDK adapter
│   │   ├── proxy.js        # Proxy adapter
│   │   └── local.js        # Local model adapter
│   ├── config/             # Configuration and setup
│   │   ├── config.js       # Environment-based configuration
│   │   ├── database.js     # MongoDB connection setup
│   │   ├── logger.js       # Winston logger configuration
│   │   ├── passport.js     # Authentication strategies
│   │   └── redis.js        # Redis connection setup
│   ├── controllers/        # HTTP request handlers
│   │   ├── auth.controller.js
│   │   ├── chat.controller.js
│   │   ├── models.controller.js
│   │   ├── providers.controller.js
│   │   └── health.controller.js
│   ├── middlewares/        # Express middleware
│   │   ├── auth.js         # Authentication middleware
│   │   ├── rateLimiter.js  # Rate limiting
│   │   ├── validate.js     # Request validation
│   │   ├── errorHandler.js # Error handling
│   │   └── metrics.js      # Metrics collection
│   ├── models/             # Mongoose schemas
│   │   ├── provider.model.js
│   │   ├── apiKey.model.js
│   │   ├── user.model.js
│   │   └── plugins/        # Reusable model plugins
│   ├── routes/             # API route definitions
│   │   ├── v1/             # OpenAI-compatible v1 routes
│   │   └── admin/          # Admin API routes
│   ├── services/           # Business logic layer
│   │   ├── gateway.service.js
│   │   ├── provider.service.js
│   │   ├── auth.service.js
│   │   ├── cache.service.js
│   │   └── health.service.js
│   ├── utils/              # Utility functions
│   │   ├── ApiError.js     # Custom error classes
│   │   ├── catchAsync.js   # Async error wrapper
│   │   ├── circuitBreaker.js
│   │   └── openai.js       # OpenAI format utilities
│   ├── validations/        # Joi validation schemas
│   │   ├── chat.validation.js
│   │   ├── provider.validation.js
│   │   └── auth.validation.js
│   ├── app.js              # Express app configuration
│   └── index.js            # Application entry point
├── tests/                  # Test suites
├── docs/                   # API documentation
├── docker-compose.yml      # Development environment
├── Dockerfile              # Container definition
├── ecosystem.config.json   # PM2 configuration
└── package.json            # Dependencies and scripts
```

## API Documentation

The gateway provides OpenAI-compatible endpoints for seamless integration. View the complete API documentation at `http://localhost:3000/docs` when running the server.

### OpenAI-Compatible Endpoints

**Chat Completions**:
```bash
POST /v1/chat/completions
```
Standard OpenAI chat completions with streaming support.

**Models**:
```bash
GET /v1/models
GET /v1/models/{model_id}
```
List available models and get model details.

**Embeddings**:
```bash
POST /v1/embeddings
```
Generate embeddings using configured providers.

### Admin API Endpoints

**Provider Management**:
```bash
GET /admin/providers          # List all providers
POST /admin/providers         # Create new provider
GET /admin/providers/:id      # Get provider details
PUT /admin/providers/:id      # Update provider
DELETE /admin/providers/:id   # Delete provider
POST /admin/providers/:id/test # Test provider health
```

**API Key Management**:
```bash
GET /admin/api-keys           # List API keys
POST /admin/api-keys          # Create new API key
DELETE /admin/api-keys/:id    # Revoke API key
```

**System Health**:
```bash
GET /health                   # Basic health check
GET /health/detailed          # Detailed system status
GET /metrics                  # Prometheus metrics
```

### Example Usage

```bash
# Chat completion request
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-dyad-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'

# List available models
curl -X GET http://localhost:3000/v1/models \
  -H "Authorization: Bearer sk-dyad-your-api-key"
```

## Error Handling

The gateway implements comprehensive error handling with OpenAI-compatible error responses and detailed logging.

### Error Response Format

All errors follow the OpenAI API error format:

```json
{
  "error": {
    "message": "The model 'gpt-4' does not exist",
    "type": "invalid_request_error",
    "param": "model",
    "code": "model_not_found"
  }
}
```

### Error Types

- **Authentication Errors** (401): Invalid or missing API key
- **Authorization Errors** (403): Insufficient permissions
- **Validation Errors** (400): Invalid request parameters
- **Rate Limit Errors** (429): Rate limit exceeded
- **Provider Errors** (502/503): Upstream provider failures
- **Internal Errors** (500): System errors

### Circuit Breaker Pattern

The gateway implements circuit breakers for provider fault tolerance:

```javascript
const CircuitBreaker = require('../utils/circuitBreaker');

const providerCircuitBreaker = new CircuitBreaker({
  threshold: 5,        // Open after 5 failures
  timeout: 60000,      // Stay open for 60 seconds
  resetTimeout: 30000  // Half-open after 30 seconds
});
```

### Custom Error Classes

```javascript
const ApiError = require('../utils/ApiError');

// Provider-specific errors
throw new ApiError(502, 'Provider unavailable', 'provider_error');

// Rate limiting errors
throw new ApiError(429, 'Rate limit exceeded', 'rate_limit_exceeded');

// Model not found errors
throw new ApiError(400, 'Model not found', 'model_not_found');
```

## Request Validation

All API requests are validated using [Joi](https://joi.dev/) schemas to ensure OpenAI API compatibility and data integrity.

### Chat Completion Validation

```javascript
const chatCompletionSchema = {
  body: Joi.object().keys({
    model: Joi.string().required(),
    messages: Joi.array().items(
      Joi.object().keys({
        role: Joi.string().valid('system', 'user', 'assistant').required(),
        content: Joi.string().required()
      })
    ).min(1).required(),
    max_tokens: Joi.number().integer().min(1).max(4096),
    temperature: Joi.number().min(0).max(2),
    stream: Joi.boolean(),
    stop: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string()).max(4)
    )
  })
};
```

### Provider Configuration Validation

```javascript
const providerSchema = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    type: Joi.string().valid('spawn-cli', 'http-sdk', 'proxy', 'local').required(),
    config: Joi.object().keys({
      endpoint: Joi.string().uri(),
      timeout: Joi.number().integer().min(1000).max(300000),
      apiKey: Joi.string(),
      command: Joi.string(),
      args: Joi.array().items(Joi.string())
    }),
    models: Joi.array().items(
      Joi.object().keys({
        modelId: Joi.string().required(),
        adapterModelId: Joi.string(),
        maxTokens: Joi.number().integer().min(1)
      })
    ).required()
  })
};
```

### Usage in Routes

```javascript
const express = require('express');
const validate = require('../../middlewares/validate');
const chatValidation = require('../../validations/chat.validation');
const chatController = require('../../controllers/chat.controller');

const router = express.Router();

router.post('/chat/completions', 
  validate(chatValidation.chatCompletion), 
  chatController.createChatCompletion
);
```

## Authentication & Authorization

The gateway uses API key-based authentication compatible with OpenAI's authentication model.

### API Key Authentication

All requests to `/v1/*` endpoints require a valid API key in the Authorization header:

```bash
Authorization: Bearer sk-dyad-your-api-key-here
```

### API Key Management

API keys are managed through the admin interface and stored securely with bcrypt hashing:

```javascript
// Create API key
const apiKey = await ApiKeyService.create({
  name: 'My Application Key',
  permissions: ['chat', 'embeddings'],
  allowedModels: ['gpt-3.5-turbo', 'text-embedding-ada-002'],
  rateLimit: {
    requestsPerMinute: 60,
    tokensPerMinute: 10000
  }
});
```

### Permission System

API keys support granular permissions:

- **chat**: Access to chat completion endpoints
- **embeddings**: Access to embedding endpoints  
- **models**: Access to model listing endpoints
- **admin**: Access to admin endpoints (provider management)

### Rate Limiting

Each API key has configurable rate limits:

```javascript
const rateLimitConfig = {
  windowMs: 60 * 1000,           // 1 minute window
  maxRequests: 100,              // Max requests per window
  maxTokens: 50000,              // Max tokens per window
  skipSuccessfulRequests: false,
  skipFailedRequests: false
};
```

### Usage Tracking

The gateway tracks API key usage for billing and monitoring:

```javascript
const usage = {
  totalRequests: 1250,
  totalTokens: 45000,
  lastUsed: new Date(),
  requestsToday: 150,
  tokensToday: 5000
};
```

### Admin Authentication

Admin endpoints use JWT tokens for user authentication:

```bash
# Login to get JWT token
POST /admin/auth/login
{
  "email": "admin@example.com",
  "password": "secure-password"
}

# Use JWT token for admin operations
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Provider Adapters

The gateway supports multiple adapter types for connecting to different AI providers and services.

### Adapter Types

#### 1. HTTP SDK Adapter
For providers with HTTP APIs (OpenAI, Anthropic, etc.):

```javascript
{
  "type": "http-sdk",
  "config": {
    "endpoint": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "timeout": 30000
  },
  "models": [
    {
      "modelId": "gpt-3.5-turbo",
      "adapterModelId": "gpt-3.5-turbo",
      "maxTokens": 4096
    }
  ]
}
```

#### 2. CLI Spawning Adapter
For command-line AI tools:

```javascript
{
  "type": "spawn-cli",
  "config": {
    "command": "ollama",
    "args": ["run", "{model}"],
    "timeout": 60000,
    "workingDirectory": "/opt/ollama"
  },
  "models": [
    {
      "modelId": "llama2",
      "adapterModelId": "llama2:7b",
      "maxTokens": 2048
    }
  ]
}
```

#### 3. Proxy Adapter
For forwarding requests to other gateways:

```javascript
{
  "type": "proxy",
  "config": {
    "endpoint": "https://other-gateway.com/v1",
    "apiKey": "gateway-key",
    "preserveHeaders": true
  }
}
```

#### 4. Local Model Adapter
For locally hosted models:

```javascript
{
  "type": "local",
  "config": {
    "endpoint": "http://localhost:8080",
    "modelPath": "/models/llama2",
    "gpuLayers": 32
  }
}
```

### Provider Health Monitoring

Each provider is continuously monitored for health and availability:

```javascript
const healthStatus = {
  status: 'healthy',        // healthy, unhealthy, degraded
  lastCheck: new Date(),
  responseTime: 250,        // milliseconds
  errorRate: 0.02,         // 2% error rate
  availability: 99.8       // 99.8% uptime
};
```

## Monitoring & Logging

The gateway provides comprehensive monitoring and logging capabilities for operational visibility.

### Structured Logging

Uses [Winston](https://github.com/winstonjs/winston) for structured logging with multiple transports:

```javascript
const logger = require('../config/logger');

// Log levels (most to least important)
logger.error('Provider connection failed', { providerId, error: err.message });
logger.warn('High response time detected', { providerId, responseTime: 5000 });
logger.info('Chat completion processed', { model, tokens: 150, duration: 1200 });
logger.http('Request processed', { method: 'POST', url: '/v1/chat/completions' });
logger.debug('Cache hit', { key: 'provider:openai:models' });
```

### Request Logging

Automatic HTTP request logging with [Morgan](https://github.com/expressjs/morgan):

```
POST /v1/chat/completions 200 1247ms - 2.1kb
GET /v1/models 200 45ms - 0.8kb
POST /admin/providers 201 156ms - 0.3kb
```

### Metrics Collection

Prometheus-compatible metrics for monitoring:

```javascript
// Request metrics
gateway_requests_total{method="POST",endpoint="/v1/chat/completions",status="200"} 1250
gateway_request_duration_seconds{method="POST",endpoint="/v1/chat/completions"} 1.247

// Provider metrics  
gateway_provider_requests_total{provider="openai",model="gpt-3.5-turbo"} 850
gateway_provider_errors_total{provider="openai",error_type="timeout"} 12

// Token usage metrics
gateway_tokens_processed_total{model="gpt-3.5-turbo",type="input"} 45000
gateway_tokens_processed_total{model="gpt-3.5-turbo",type="output"} 12000
```

### Health Checks

Multiple health check endpoints:

```bash
# Basic health check
GET /health
{"status": "ok", "timestamp": "2024-01-15T10:30:00Z"}

# Detailed system status
GET /health/detailed
{
  "status": "healthy",
  "checks": {
    "database": {"status": "healthy", "responseTime": 45},
    "redis": {"status": "healthy", "responseTime": 12},
    "providers": {"healthy": 3, "total": 4, "percentage": 75}
  }
}

# Prometheus metrics
GET /metrics
```

### Log Configuration

Environment-based log configuration:

```bash
# Development: Console output with colors
LOG_LEVEL=debug
LOG_FORMAT=dev

# Production: JSON format for log aggregation
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=/var/log/dyad-gateway.log
```

## Database Models & Plugins

The gateway uses MongoDB with Mongoose for data persistence, featuring custom plugins for enhanced functionality.

### Core Models

#### Provider Model
Stores AI provider configurations and health status:

```javascript
const providerSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  type: { type: String, enum: ['spawn-cli', 'http-sdk', 'proxy', 'local'] },
  enabled: { type: Boolean, default: true },
  config: { type: Map, of: mongoose.Schema.Types.Mixed },
  models: [{
    modelId: String,
    adapterModelId: String,
    maxTokens: Number,
    supportsStreaming: Boolean
  }],
  healthStatus: {
    status: { type: String, enum: ['healthy', 'unhealthy', 'degraded'] },
    lastCheck: Date,
    responseTime: Number,
    errorRate: Number
  }
}, { timestamps: true });
```

#### API Key Model
Manages API key authentication and usage tracking:

```javascript
const apiKeySchema = new mongoose.Schema({
  name: String,
  keyHash: { type: String, required: true, unique: true },
  keyPrefix: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  permissions: [String],
  allowedModels: [String],
  rateLimit: {
    requestsPerMinute: Number,
    tokensPerMinute: Number
  },
  usage: {
    totalRequests: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    lastUsed: Date
  },
  enabled: { type: Boolean, default: true },
  expiresAt: Date
}, { timestamps: true });
```

### Custom Mongoose Plugins

#### toJSON Plugin
Transforms model output for API responses:

```javascript
// Removes internal fields and transforms _id to id
userSchema.plugin(toJSON);

// Result:
{
  "id": "507f1f77bcf86cd799439011",
  "name": "OpenAI Provider",
  "type": "http-sdk"
  // __v, _id, and private fields removed
}
```

#### Paginate Plugin
Adds pagination support to models:

```javascript
providerSchema.plugin(paginate);

// Usage:
const providers = await Provider.paginate(
  { enabled: true },
  { 
    page: 2, 
    limit: 10, 
    sortBy: 'name:asc',
    populate: 'models'
  }
);

// Returns:
{
  "results": [...],
  "page": 2,
  "limit": 10,
  "totalPages": 5,
  "totalResults": 47,
  "hasNextPage": true,
  "hasPrevPage": true
}
```

#### Health Tracking Plugin
Automatically tracks model health metrics:

```javascript
providerSchema.plugin(healthTracking);

// Automatically updates health status on operations
await provider.recordHealthCheck('healthy', 250); // responseTime in ms
await provider.recordError('timeout');
```

### Database Indexing

Optimized indexes for performance:

```javascript
// Provider indexes
providerSchema.index({ type: 1, enabled: 1 });
providerSchema.index({ 'models.modelId': 1 });
providerSchema.index({ 'healthStatus.status': 1 });

// API Key indexes
apiKeySchema.index({ keyHash: 1 }, { unique: true });
apiKeySchema.index({ userId: 1, enabled: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

## Development & Deployment

### Code Quality

The project uses [ESLint](https://eslint.org/) and [Prettier](https://prettier.io) for code quality and formatting:

- **ESLint**: Follows [Airbnb JavaScript style guide](https://github.com/airbnb/javascript) with gateway-specific modifications
- **Prettier**: Consistent code formatting across the codebase
- **EditorConfig**: Consistent editor settings across different IDEs

Configuration files:
- `.eslintrc.json` - ESLint rules and plugins
- `.prettierrc.json` - Prettier formatting options
- `.editorconfig` - Editor configuration
- `.eslintignore` / `.prettierignore` - Files to exclude from linting

### Docker Deployment

Multi-stage Docker build for optimized production images:

```dockerfile
# Development stage
FROM node:18-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage
FROM node:18-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Docker Compose

Full development environment with dependencies:

```yaml
version: '3.8'
services:
  gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - MONGODB_URL=mongodb://mongo:27017/dyad-gateway
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
  
  mongo:
    image: mongo:5.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Production Deployment

PM2 ecosystem configuration for production:

```javascript
// ecosystem.config.json
{
  "apps": [{
    "name": "dyad-gateway",
    "script": "src/index.js",
    "instances": "max",
    "exec_mode": "cluster",
    "env": {
      "NODE_ENV": "production",
      "PORT": 3000
    },
    "error_file": "./logs/err.log",
    "out_file": "./logs/out.log",
    "log_file": "./logs/combined.log",
    "time": true
  }]
}
```

## Testing

Comprehensive test suite covering unit, integration, and performance testing.

### Test Structure

```
tests/
├── unit/                   # Unit tests for individual modules
│   ├── services/
│   ├── utils/
│   └── adapters/
├── integration/            # API endpoint integration tests
│   ├── auth.test.js
│   ├── chat.test.js
│   ├── providers.test.js
│   └── health.test.js
├── performance/            # Load and performance tests
│   ├── load-test.js
│   └── stress-test.js
├── fixtures/               # Test data and mocks
└── utils/                  # Test utilities and setup
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Performance tests
npm run test:performance

# Test coverage
npm run coverage

# Watch mode for development
npm run test:watch
```

### Test Examples

```javascript
// Integration test example
describe('POST /v1/chat/completions', () => {
  it('should process chat completion successfully', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${validApiKey}`)
      .send({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      object: 'chat.completion',
      choices: expect.any(Array)
    });
  });
});
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Run linting: `npm run lint:fix`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](./docs/)
- 🐛 [Issue Tracker](https://github.com/dyad/gateway/issues)
- 💬 [Discussions](https://github.com/dyad/gateway/discussions)
- 📧 [Email Support](mailto:support@dyad.dev)
