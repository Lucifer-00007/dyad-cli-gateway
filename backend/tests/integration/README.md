# Integration Tests

This directory contains comprehensive integration tests for the Dyad CLI Gateway, covering all MVP requirements and end-to-end workflows.

## Test Structure

### Core Integration Tests
- **`gateway/admin-endpoints.test.js`** - Admin API endpoints for provider CRUD operations
- **`gateway/openai-endpoints.test.js`** - OpenAI-compatible endpoints (`/v1/chat/completions`, `/v1/models`, `/v1/embeddings`)
- **`gateway/gateway-orchestration.test.js`** - Gateway service orchestration and response normalization
- **`gateway/middleware-integration.test.js`** - Authentication and middleware integration
- **`gateway/echo-adapter.test.js`** - Echo adapter functionality and Docker sandbox integration

### End-to-End Workflow Tests
- **`gateway/end-to-end-workflow.test.js`** - Complete provider registration → chat completion flow
- **`gateway/echo-workflow-validation.test.js`** - Comprehensive echo adapter workflow validation
- **`gateway/openapi-contract.test.js`** - OpenAPI specification contract validation

## Running Tests

### Individual Test Suites
```bash
# Run all integration tests
npm run test:integration

# Run end-to-end workflow tests
npm run test:e2e

# Run echo workflow validation
npm run test:workflow

# Run all workflow tests
npm run test:all-workflows

# Run OpenAPI contract tests
npm run test:contract
```

### Complete MVP Validation
```bash
# Run complete MVP test suite
npm run test:mvp

# Run tests in Docker environment
npm run test:docker

# Clean up Docker test environment
npm run test:docker:clean
```

### CI/CD Integration
The integration tests are automatically run in GitHub Actions CI pipeline:
- Unit tests run first
- Integration tests run after unit tests pass
- Container security scanning runs after Docker builds
- MVP validation runs as final verification

## Test Requirements

### Database
Tests require a MongoDB instance. The test setup automatically:
- Connects to test database
- Cleans up data between tests
- Uses transactions for data isolation

### Environment Variables
Required environment variables for tests:
```bash
NODE_ENV=test
MONGODB_URL=mongodb://localhost:27017/test
JWT_SECRET=test-jwt-secret
```

### Docker (Optional)
Some tests can run with Docker disabled for faster execution:
- Echo adapter tests disable Docker sandbox by default
- Set `dockerSandbox: false` in provider configurations for test speed

## Test Coverage

### MVP Requirements Validated

#### ✅ Requirement 1: OpenAI-Compatible API Gateway
- `POST /v1/chat/completions` with OpenAI schema compliance
- `GET /v1/models` returning available models with metadata
- `POST /v1/embeddings` with proper error handling for unsupported models
- Error responses in OpenAI error schema format
- API versioning and backward compatibility

#### ✅ Requirement 2: Provider Management System
- CRUD operations via admin API endpoints
- Provider validation and testing endpoints
- Model mapping and configuration validation
- Credential encryption and secure storage
- Enable/disable provider functionality
- Health check integration

#### ✅ Requirement 3: Pluggable Adapter System
- Adapter routing based on model selection
- Spawn-CLI adapter with echo command validation
- Adapter factory pattern implementation
- Error handling and normalization across adapters
- Timeout and cancellation support

#### ✅ Requirement 4: Security & Sandboxing
- API key authentication for `/v1/*` endpoints
- Input sanitization and validation
- Timeout enforcement and process cancellation
- Secure credential handling and logging redaction

#### ✅ Requirement 5: Authentication & Authorization
- API key validation for gateway endpoints
- Admin role authorization for `/admin/*` endpoints
- Request identity logging and audit trails

#### ✅ Requirement 6: Response Normalization
- Uniform OpenAI-compatible response format
- Token usage metrics calculation
- Model name mapping between internal and client-facing IDs
- Error normalization to OpenAI error schema

#### ✅ Requirement 7: Monitoring, Health & Logging
- Request logging with client identity
- Adapter execution timing and error logging
- Health check endpoints (`/healthz`, `/ready`)
- Admin action audit logging

#### ✅ Requirement 8: Configuration, Deployment & Scalability
- Environment-based configuration loading
- Docker deployment validation
- Horizontal scaling support (stateless design)
- Model list caching for performance

## Test Data and Fixtures

### User Fixtures
- `userOne` - Regular user for API key testing
- `admin` - Admin user for admin endpoint testing

### Provider Fixtures
- Echo providers with various configurations
- Disabled providers for negative testing
- Timeout providers for error scenario testing

### API Key Fixtures
- Valid API keys with different permissions
- Expired and invalid keys for authentication testing

## Debugging Tests

### Verbose Output
```bash
# Run with verbose Jest output
npm test -- --verbose --testPathPattern=gateway/

# Run specific test file with debugging
npm test -- --testPathPattern=end-to-end-workflow.test.js --verbose
```

### Database Inspection
Tests use the `setupTestDB()` utility which:
- Creates a clean database for each test suite
- Provides database connection for manual inspection
- Automatically cleans up after tests complete

### Docker Debugging
```bash
# Run Docker tests with logs
docker-compose -f docker-compose.integration.yml up --build

# Check container logs
docker-compose -f docker-compose.integration.yml logs gateway-integration-test

# Access test container shell
docker-compose -f docker-compose.integration.yml exec gateway-integration-test sh
```

## Contributing

When adding new integration tests:

1. **Follow the existing pattern** - Use the same setup/teardown structure
2. **Test real workflows** - Focus on end-to-end scenarios, not just unit functionality
3. **Validate OpenAI compatibility** - Ensure responses match OpenAI schema
4. **Include error scenarios** - Test both success and failure paths
5. **Document test purpose** - Add clear descriptions of what each test validates
6. **Update this README** - Document new test files and their purpose

## Performance Considerations

- Tests disable Docker sandbox by default for speed
- Database operations use transactions for isolation
- Concurrent test execution is disabled (`jest -i`) to avoid conflicts
- Model list caching is tested but cleared between tests
- Provider health checks use mock data to avoid external dependencies