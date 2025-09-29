# Dyad CLI Gateway

> **A pluggable, OpenAI-compatible gateway that enables Dyad (or any OpenAI-compatible client) to communicate with CLI agents, local model servers, and vendor SDKs through a unified `/v1` API surface.**

This monorepo contains both backend and frontend applications, following a clear separation of concerns with a backend-first design that allows for optional frontend admin UI integration.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Technology Stack](#technology-stack)
4. [Repository Structure](#repository-structure)
5. [Quick Start](#quick-start)
6. [Environment Variables](#environment-variables)
7. [Docker Deployment](#docker-deployment)
8. [API Reference](#api-reference)
9. [Provider Configuration](#provider-configuration)
10. [Security & Sandboxing](#security--sandboxing)
11. [Testing](#testing)
12. [Dyad Integration](#dyad-integration)
13. [Development](#development)
14. [Roadmap](#roadmap)
15. [License](#license)

## Overview

The Dyad CLI Gateway is a comprehensive solution that implements an OpenAI-compatible API gateway with the following capabilities:

- **OpenAI Compatibility**: Exposes standard `/v1/chat/completions`, `/v1/models`, and `/v1/embeddings` endpoints
- **Multi-Adapter Support**: Translates requests to various backend types:
  - `spawn-cli` - Execute CLI agents (Gemini CLI, Copilot CLI, Amazon Q CLI)
  - `http-sdk` - Call vendor APIs through HTTP
  - `proxy` - Forward to existing OpenAI-compatible services
  - `local` - Connect to local model servers (Ollama, TGI, LocalAI)
- **Admin Interface**: RESTful admin API for provider management with optional React frontend
- **Secure Execution**: Sandboxed CLI execution using Docker containers
- **Persistent Storage**: MongoDB-based provider configuration and model mappings

## Features

- **OpenAI-Compatible Endpoints**: Drop-in replacement for OpenAI API with `/v1/chat/completions`, `/v1/models`, and `/v1/embeddings`
- **Pluggable Adapter System**:
  - `spawn-cli` — Execute CLI agents with sandboxed execution
  - `http-sdk` — Call vendor APIs (Gemini, Bedrock, etc.)
  - `proxy` — Forward to existing OpenAI-compatible proxies
  - `local` — Connect to local model servers (Ollama/TGI/LocalAI)
- **Provider Registry**: MongoDB-based persistence for provider configurations
- **Admin API**: Full CRUD operations for provider management
- **Security Features**: API key authentication, rate limiting, sandboxed execution
- **Streaming Support**: Optional token-by-token streaming (configurable)
- **Docker Ready**: Containerized deployment with Docker Compose

## Technology Stack

### Backend
- **Runtime**: Node.js (>=12.0.0)
- **Framework**: Express.js with comprehensive middleware ecosystem
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with Passport.js
- **Validation**: Joi schema validation
- **Testing**: Jest with supertest for integration tests
- **Process Management**: PM2 for production
- **Logging**: Winston with Morgan for HTTP logging
- **Security**: helmet, cors, express-rate-limit, xss-clean, express-mongo-sanitize

### Frontend
- **Build Tool**: Vite 5 with SWC plugin
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **UI Components**: Radix UI primitives, Lucide icons
- **Routing**: React Router DOM
- **State Management**: React Query (TanStack Query) for server state
- **Forms**: React Hook Form with Zod validation
- **Theme**: next-themes with dark mode support

## Repository Structure

```
/
├── backend/                 # Node.js/Express API server
│   ├── src/
│   │   ├── gateway/        # Gateway-specific modules
│   │   │   ├── api/        # Route definitions
│   │   │   ├── controllers/# Request handlers
│   │   │   ├── services/   # Business logic
│   │   │   ├── adapters/   # Provider adapters
│   │   │   ├── models/     # Mongoose schemas
│   │   │   └── utils/      # Utilities
│   │   ├── config/         # Configuration files
│   │   ├── middlewares/    # Express middleware
│   │   └── validations/    # Joi validation schemas
│   ├── tests/              # Test suites
│   ├── docker-compose.yml  # Container orchestration
│   └── package.json
├── frontend/               # React/TypeScript client
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route-level components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility libraries
│   │   └── constants/      # Application constants
│   ├── vite.config.ts      # Vite configuration
│   └── package.json
├── plans/                  # Project planning docs
├── md-docs/               # Additional documentation
└── README.md              # This file
```

## Quick Start

### Prerequisites

- Node.js (>=12.0.0)
- MongoDB (local or remote)
- Docker (optional, for containerized deployment)

### Backend Development

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start development server
npm run dev

# Or start gateway in standalone mode
npm run gateway:standalone
```

### Frontend Development

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server (runs on port 8080)
npm run dev

# Build for production
npm run build
```

### Testing

```bash
# Backend tests
cd backend
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:integration   # Gateway integration tests
npm run coverage           # Test coverage

# Frontend tests
cd frontend
npm run test               # Run unit tests
npm run test:e2e          # End-to-end tests
npm run test:all          # All test suites
```

## Environment Variables

### Backend Configuration

Create `.env` in the backend directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/dyad-gateway

# Gateway Configuration
GATEWAY_PORT=8080
GATEWAY_MASTER_API_KEY=your_secure_master_key
GATEWAY_ADMIN_API_KEY=your_secure_admin_key

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=30

# Security
BCRYPT_SALT_ROUNDS=8

# Logging
LOG_LEVEL=info

# Docker (for sandboxed execution)
DOCKER_SOCKET=/var/run/docker.sock
```

### Frontend Configuration

Frontend uses Vite's environment variables with `VITE_` prefix:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_GATEWAY_BASE_URL=http://localhost:8080
```

## Docker Deployment

### Development

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Start gateway only
npm run gateway:docker
```

### Production

```bash
# Build and start production containers
docker-compose -f docker-compose.prod.yml up --build

# Or use the production script
npm run docker:prod
```

### Gateway-Specific Deployment

```bash
# Gateway with MongoDB
docker-compose -f docker-compose.gateway.yml up

# Build and start
npm run gateway:docker:build
```

## API Reference

### OpenAI-Compatible Endpoints

#### POST `/v1/chat/completions`

**Authentication**: `Authorization: Bearer <GATEWAY_MASTER_API_KEY>`

**Request Body**:
```json
{
  "model": "gemini-2.5-pro",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Write a short haiku"}
  ],
  "max_tokens": 256,
  "temperature": 0.7
}
```

**Response**: OpenAI-compatible chat completion response

#### GET `/v1/models`

Returns available models from all configured providers:

```json
{
  "object": "list",
  "data": [
    {
      "id": "gemini-2.5-pro",
      "object": "model",
      "owned_by": "gemini-cli-local",
      "max_tokens": 4096
    }
  ]
}
```

#### POST `/v1/embeddings`

**Request Body**:
```json
{
  "model": "text-embedding-ada-002",
  "input": "The quick brown fox jumps over the lazy dog"
}
```

### Admin API Endpoints

All admin endpoints require authentication and admin role.

#### Provider Management

- `POST /admin/providers` - Create provider
- `GET /admin/providers` - List providers
- `GET /admin/providers/:id` - Get provider details
- `PUT /admin/providers/:id` - Update provider
- `DELETE /admin/providers/:id` - Delete provider
- `POST /admin/providers/:id/test` - Test provider configuration

## Provider Configuration

### Example Provider Configuration

```json
{
  "name": "Gemini CLI Local",
  "slug": "gemini-cli-local",
  "type": "spawn-cli",
  "description": "Local Gemini CLI wrapper with Docker sandbox",
  "enabled": true,
  "models": [
    {
      "dyadModelId": "gemini-2.5-pro",
      "adapterModelId": "gemini-cli-2.5",
      "maxTokens": 4096,
      "contextWindow": 8192
    }
  ],
  "adapterConfig": {
    "command": "/usr/local/bin/gemini",
    "args": ["--json", "--no-cache"],
    "dockerSandbox": true,
    "sandboxImage": "ghcr.io/yourorg/cli-runner:latest",
    "timeoutSeconds": 60,
    "environment": {
      "GEMINI_API_KEY": "${GEMINI_API_KEY}"
    }
  },
  "credentials": {
    "apiKey": "encrypted_api_key_value"
  }
}
```

### Adapter Types

#### spawn-cli
Execute CLI tools in sandboxed environments:
```json
{
  "type": "spawn-cli",
  "adapterConfig": {
    "command": "/path/to/cli",
    "args": ["--json"],
    "dockerSandbox": true,
    "sandboxImage": "custom-cli-image:latest",
    "timeoutSeconds": 30
  }
}
```

#### http-sdk
Call HTTP APIs:
```json
{
  "type": "http-sdk",
  "adapterConfig": {
    "baseUrl": "https://api.provider.com",
    "headers": {
      "Authorization": "Bearer ${API_KEY}"
    },
    "timeout": 30000
  }
}
```

#### proxy
Forward to OpenAI-compatible services:
```json
{
  "type": "proxy",
  "adapterConfig": {
    "targetUrl": "https://api.openai.com",
    "apiKey": "${OPENAI_API_KEY}"
  }
}
```

#### local
Connect to local model servers:
```json
{
  "type": "local",
  "adapterConfig": {
    "baseUrl": "http://localhost:11434",
    "modelPath": "/api/generate"
  }
}
```

## Security & Sandboxing

### Security Best Practices

- **API Key Management**: Store keys securely using environment variables or secret management systems
- **Sandboxed Execution**: Always use Docker containers for CLI execution
- **Rate Limiting**: Implement per-key and per-endpoint rate limits
- **Input Validation**: Validate all inputs using Joi schemas
- **CORS Configuration**: Properly configure CORS for frontend access

### Docker Sandboxing

For secure CLI execution:

```bash
# Example sandboxed execution
docker run --rm \
  --cpus=0.5 \
  --memory=512m \
  --network=none \
  --read-only \
  --tmpfs /tmp \
  custom-cli-image:latest \
  /usr/local/bin/cli-tool --json
```

### Production Security

- Use KMS or HashiCorp Vault for credential storage
- Implement proper logging and monitoring
- Regular security audits and dependency updates
- Network isolation for sensitive operations

## Testing

### Test Structure

```
backend/tests/
├── fixtures/              # Test data
├── integration/           # API endpoint tests
├── unit/                  # Unit tests
├── gateway/              # Gateway-specific tests
└── utils/                # Test utilities

frontend/src/
├── __tests__/            # Component tests
└── test/                 # Test utilities
```

### Running Tests

```bash
# Backend
npm test                   # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:gateway      # Gateway tests
npm run test:coverage     # Coverage report

# Frontend
npm run test              # Unit tests
npm run test:e2e         # End-to-end tests
npm run test:a11y        # Accessibility tests
```

### Load Testing

```bash
# Backend load tests
npm run test:load         # All load tests
npm run test:load:basic   # Basic endpoint tests
npm run test:load:chat    # Chat completion tests
```

## Dyad Integration

### Adding as Custom Provider

1. Ensure the gateway is running and accessible
2. In Dyad UI: `Settings` → `AI Providers` → `Add Custom Provider`
3. Configure:
   - **Provider ID**: `dyad-cli-gateway`
   - **Display Name**: `Dyad CLI Gateway`
   - **API Base URL**: `http://localhost:8080`
   - **API Key**: Your `GATEWAY_MASTER_API_KEY`
4. Add models that match your provider configurations

### Example Integration

```javascript
// Dyad configuration
const provider = {
  id: 'dyad-cli-gateway',
  name: 'Dyad CLI Gateway',
  baseUrl: 'http://localhost:8080',
  apiKey: process.env.GATEWAY_MASTER_API_KEY,
  models: [
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro (CLI)',
      maxTokens: 4096,
      contextWindow: 8192
    }
  ]
};
```

## Development

### Code Style

- **Backend**: ESLint with Airbnb configuration, Prettier formatting
- **Frontend**: ESLint with React hooks, TypeScript strict mode
- **Commits**: Conventional commit format
- **Pre-commit**: Husky with lint-staged for quality checks

### Development Scripts

```bash
# Backend
npm run dev              # Development server with nodemon
npm run lint             # ESLint check
npm run lint:fix         # Auto-fix ESLint issues
npm run prettier:fix     # Format code with Prettier

# Frontend
npm run dev              # Vite development server
npm run type-check       # TypeScript checking
npm run format           # Prettier formatting
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/new-feature`
3. Follow the existing code style and add tests
4. Commit using conventional commits: `feat: add new adapter type`
5. Submit a pull request with detailed description

### Architecture Guidelines

- **Backend**: Layered architecture (routes → controllers → services → models)
- **Frontend**: Component-based architecture with custom hooks
- **Testing**: Unit tests for business logic, integration tests for APIs
- **Documentation**: JSDoc for functions, README for modules

## Roadmap

### Phase 1: Core Gateway (Current)
- [x] OpenAI-compatible API endpoints
- [x] Basic adapter system (spawn-cli, http-sdk, proxy, local)
- [x] MongoDB provider registry
- [x] Admin CRUD API
- [x] Docker deployment

### Phase 2: Enhanced Features
- [ ] Streaming support (SSE/WebSocket)
- [ ] Advanced sandboxing (Kubernetes jobs, Firecracker)
- [ ] Metrics and monitoring (Prometheus/Grafana)
- [ ] Enhanced security (KMS integration, Vault)

### Phase 3: Frontend & UX
- [ ] React admin interface
- [ ] Provider configuration UI
- [ ] Real-time testing and logs
- [ ] Dashboard and analytics

### Phase 4: Production Ready
- [ ] High availability setup
- [ ] Auto-scaling capabilities
- [ ] Advanced logging and alerting
- [ ] Performance optimizations

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Verify `Authorization: Bearer <GATEWAY_MASTER_API_KEY>` header
- Check API key configuration in environment variables

**Command not found (spawn-cli)**
- Ensure CLI binary is available in container/host
- Verify `adapterConfig.command` path is correct
- Check Docker image includes required tools

**Timeouts**
- Adjust `adapterConfig.timeoutSeconds` for providers
- Check network connectivity to external services
- Verify sandbox resource limits aren't too restrictive

**No models available**
- Ensure providers are enabled and configured
- Check `/v1/models` endpoint response
- Verify model mappings in provider configuration

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Gateway-specific debugging
DEBUG=gateway:* npm run gateway:dev
```

### Health Checks

```bash
# Check gateway health
curl http://localhost:8080/health

# Check available models
curl -H "Authorization: Bearer <API_KEY>" \
     http://localhost:8080/v1/models

# Test provider
curl -X POST http://localhost:8080/admin/providers/<id>/test \
     -H "Authorization: Bearer <ADMIN_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"test"}]}'
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the Dyad ecosystem**

For questions, issues, or contributions, please visit our [GitHub repository](https://github.com/your-org/dyad-cli-gateway) or contact the development team.