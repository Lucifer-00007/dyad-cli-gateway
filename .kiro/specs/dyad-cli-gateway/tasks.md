# Implementation Plan

## MVP Tasks (Core functionality for initial testing)

- [x] 1. Set up project structure and core configuration
  - Create gateway directory structure under `backend/src/gateway/`
  - Set up gateway-specific configuration files and environment variables
  - Create Docker configuration files for gateway deployment
  - **AC**: Directory structure matches design, config loads from ENV, Dockerfile builds successfully
  - _Requirements: 8.1, 8.2, 8.5_

- [x] 2. Implement core data models and database schemas
  - Create Provider Mongoose model with validation and encryption scaffolding
  - Create API Key model for gateway authentication
  - Implement model plugins for common functionality (encryption, validation)
  - Write unit tests for model validation and encryption
  - **AC**: Models save/load correctly, validation works, tests cover edge cases
  - _Requirements: 2.1, 2.6, 5.1_

- [x] 3. Create adapter interface and spawn-cli echo adapter
  - Implement BaseAdapter interface class with standard methods
  - Create spawn-cli adapter with Docker sandbox helper (echo command for PoC)
  - Create adapter factory for instantiating different adapter types
  - Write unit tests for adapter interface and echo functionality
  - **AC**: Echo adapter runs CLI in sandbox, returns stdout, supports timeout/cancel, logs sanitized command
  - _Requirements: 3.1, 3.2, 4.1, 4.6_

- [x] 4. Implement API key authentication middleware
  - Create API key authentication middleware for /v1 endpoints
  - Implement API key validation and basic rate limiting
  - Add request logging with authenticated user context
  - Write unit tests for authentication scenarios
  - **AC**: Requires Authorization: Bearer, returns 401 for invalid key, logs requests
  - _Requirements: 5.1, 5.3, 5.5_

- [x] 5. Create gateway service and response normalizer
  - Implement gateway service to coordinate request processing
  - Create OpenAI response normalizer to convert adapter outputs
  - Implement model-to-provider routing logic
  - Write unit tests for orchestration and normalization
  - **AC**: Routes requests to correct adapter, normalizes to OpenAI JSON format
  - _Requirements: 3.1, 6.1, 6.2, 6.3_

- [x] 6. Implement core OpenAI-compatible endpoints
  - Implement POST /v1/chat/completions endpoint
  - Implement GET /v1/models endpoint
  - Create controllers to handle request/response processing
  - Write integration tests for OpenAI endpoints
  - **AC**: POST /v1/chat returns OpenAI JSON shape (id, choices, usage), GET /v1/models returns model list
  - _Requirements: 1.1, 1.2_

- [x] 7. Create gateway Express application
  - Set up Express app with middleware stack
  - Mount OpenAI routes and basic error handling
  - Add request logging and health check endpoint
  - Write integration tests for complete application
  - **AC**: App starts successfully, handles requests, returns proper errors, /health responds
  - _Requirements: 1.5, 7.1, 7.2_

- [x] 8. Implement admin API for provider management
  - Create admin routes for provider CRUD operations
  - Implement provider testing endpoint for connectivity validation
  - Add JWT authentication and admin role authorization
  - Write integration tests for admin endpoints
  - **AC**: CRUD works, POST /admin/providers/:id/test validates connectivity, requires admin auth
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.2, 5.4_

- [x] 9. Generate OpenAPI specification
  - Create OpenAPI v3 spec for /v1 and admin endpoints
  - Include request/response examples and error schemas
  - Commit spec to md-docs/openapi.yaml
  - Add contract tests using OpenAPI spec
  - **AC**: md-docs/openapi.yaml exists, CI runs contract test validating sample request/response
  - _Requirements: Documentation for frontend integration_

- [x] 10. Add basic integration tests and CI setup
  - Create end-to-end tests for provider registration → chat completion flow
  - Set up CI pipeline with unit tests and integration tests
  - Add basic container image scanning
  - Test complete workflow with echo adapter
  - **AC**: Automated tests cover full workflow, CI passes on PR, image scans clean
  - _Requirements: All MVP requirements integration testing_

## Post-MVP Tasks (Production readiness and advanced features)

- [x] 11. Implement HTTP-SDK adapter for vendor APIs
  - Create HTTP-SDK adapter using axios for vendor API calls
  - Implement request/response transformation for different vendors
  - Add retry logic and error handling for HTTP requests
  - Write unit tests with mocked HTTP responses
  - **AC**: Successfully calls vendor APIs, handles retries, transforms responses correctly
  - _Requirements: 3.3, 3.6_

- [x] 12. Implement proxy and local adapters
  - Create proxy adapter for forwarding to OpenAI-compatible services
  - Create local adapter for Ollama/TGI local model servers
  - Implement health checking for local services
  - Write unit tests for both adapter types
  - **AC**: Proxy forwards requests correctly, local adapter connects to Ollama, health checks work
  - _Requirements: 3.4, 3.5_

- [x] 13. Add SSE streaming and cancellation support
  - Implement Server-Sent Events streaming for chat completions
  - Add cancellation handling (connection close → kill sandbox)
  - Include tests for partial-token streaming and client cancellation
  - Add streaming support to OpenAPI spec
  - **AC**: Streams tokens in real-time, handles client disconnect, kills running processes on cancel
  - _Requirements: 1.1 streaming support_

- [x] 14. Implement credential rotation and revocation
  - Add POST /admin/providers/:id/rotate-credentials endpoint
  - Add POST /admin/apikeys/:id/revoke endpoint
  - Implement zero-downtime credential rotation workflow
  - Write tests for rotation scenarios
  - **AC**: Credentials rotate without service interruption, revoked keys immediately invalid
  - _Requirements: 2.6, 5.1_

- [x] 15. Add circuit breaker and fallback policies
  - Implement circuit breaker pattern for failing providers
  - Add configurable fallback policies and thresholds
  - Create background jobs for provider health monitoring
  - Write tests for circuit breaker behavior and recovery
  - **AC**: Circuit opens on failures, fallback works, auto-recovery after cooldown
  - _Requirements: 2.5, 7.5_

- [x] 16. Integrate secrets manager and KMS
  - Replace ENV-based secrets with KMS/Vault integration
  - Implement proper encryption key storage and rotation
  - Add credential encryption with external key management
  - Write tests for secrets integration
  - **AC**: Secrets stored in external system, keys rotate automatically, encryption uses KMS
  - _Requirements: 4.3, 4.4_

- [ ] 17. Add comprehensive monitoring and alerting
  - Integrate Prometheus metrics collection
  - Create Grafana dashboards for gateway metrics
  - Configure alerting for error rates, latency, and circuit breaker status
  - Add structured logging with correlation IDs
  - **AC**: Metrics exported, dashboards show key stats, alerts fire on thresholds
  - _Requirements: 7.1, 7.2, 7.4_

- [ ] 18. Implement advanced security hardening
  - Add comprehensive input sanitization and validation
  - Implement advanced rate limiting and DDoS protection
  - Add container image scanning and dependency vulnerability checks
  - Configure security headers and HTTPS enforcement
  - **AC**: All inputs validated, rate limits enforced, security scans pass, HTTPS required
  - _Requirements: 4.2, 4.3, 4.5_

- [ ] 19. Create production deployment configuration
  - Document and implement non-Docker-socket sandbox options (K8s Jobs/gVisor)
  - Add production deployment manifests and security review
  - Create startup scripts with graceful shutdown handling
  - Add database migration scripts and backup procedures
  - **AC**: Deploys without host Docker socket, graceful shutdown works, migrations run
  - _Requirements: 8.5, 4.1_

- [ ] 20. Add embeddings endpoint support
  - Implement POST /v1/embeddings endpoint
  - Add embeddings support to relevant adapters
  - Create embeddings-specific normalization
  - Write tests for embeddings workflow
  - **AC**: Embeddings endpoint works, returns OpenAI format, routes to supporting providers
  - _Requirements: 1.4_

- [ ] 21. Implement performance optimization and load testing
  - Add connection pooling and request queuing
  - Implement caching for model lists and provider health
  - Create performance and load testing scenarios
  - Add performance monitoring and optimization
  - **AC**: Handles concurrent load, response times within SLA, caching reduces DB calls
  - _Requirements: Performance and scalability_

- [ ] 22. Add legal compliance and security audit
  - Review vendor TOS for reverse-engineered proxy usage
  - Create legal compliance checklist for CLI integrations
  - Conduct security audit and penetration testing
  - Document security policies and incident response
  - **AC**: Legal review complete, security audit passes, policies documented
  - _Requirements: 4.4, 4.5_

- [ ] 23. Create comprehensive CI/CD pipeline
  - Add advanced security gates (SAST, DAST, dependency scanning)
  - Implement automated deployment with rollback capabilities
  - Add OpenAPI contract tests and breaking change detection
  - Create release automation and versioning strategy
  - **AC**: Full CI/CD pipeline, automated security checks, safe deployments
  - _Requirements: 8.5_