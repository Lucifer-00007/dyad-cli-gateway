# Requirements Document — Dyad CLI Gateway

## Introduction

The **Dyad CLI Gateway** is a pluggable, OpenAI-compatible gateway that enables Dyad (or any OpenAI-compatible client) to communicate with CLI agents, local model servers, and vendor SDKs via a uniform `/v1` API interface. It acts as a protocol translation layer, converting OpenAI-style requests into adapter-specific operations while enforcing security, sandboxing, provider governance, and observability.

---

## Requirements

### Requirement 1: OpenAI-Compatible API Gateway

**User Story:**  
As a Dyad client, I want to interact with multiple AI providers through a consistent API interface, so I don’t need custom integrations for each.

**Acceptance Criteria:**

1. **Chat Completion**:  
   - `POST /v1/chat/completions` must accept standard OpenAI Chat schema: `model`, `messages[]`, optional params (e.g. `max_tokens`, `temperature`).  
   - The gateway must support **streaming / chunked response** (Server-Sent Events or HTTP chunk streaming) if the underlying adapter supports streaming.

2. **Model Discovery**:  
   - `GET /v1/models` must return a list of available models across providers, with metadata (e.g. `id`, `max_tokens`, `context_window`, `owned_by`).  
   - Optionally support `GET /v1/models/{modelId}` for detailed metadata.

3. **Embeddings**:  
   - `POST /v1/embeddings` must be routed to providers that support embeddings; if a model does not support embeddings, respond with a standard error.

4. **Error Responses**:  
   - On failure, respond in **OpenAI error schema** with `error: { message, type, code, param? }`.  
   - Map internal errors to appropriate OpenAI error types (e.g. `invalid_request_error`, `rate_limit_error`, `internal_error`).  [oai_citation:1‡OpenAI](https://platform.openai.com/docs/guides/error-codes?utm_source=chatgpt.com)

5. **Versioning & Compatibility**:  
   - API must be versioned (e.g. `/v1/`) and changes in future versions must maintain backward compatibility where possible.

---

### Requirement 2: Provider Management System

**User Story:**  
As an administrator, I want to register, update, and remove AI providers with their configurations, so I can control which models are available.

**Acceptance Criteria:**

1. **CRUD Operations**:  
   - Create, Read, Update, Delete providers via secure admin API endpoints.  
   - Store fields: `name`, `slug`, `type`, `adapterConfig`, `credentials`, `models` (mapping), `enabled`.

2. **Validation & Testing**:  
   - On create/update, validate config (e.g. ensure adapter command exists, HTTP base URL correct).  
   - Provide a `POST /admin/providers/:id/test` endpoint to execute a test chat and return status, timing, and error details.

3. **Model Mapping**:  
   - Each provider must declare which `dyadModelId`s it supports and map them to adapter/internal model IDs, along with `max_tokens` and `context_window`.

4. **Credential Encryption & Rotation**:  
   - Sensitive credentials must be encrypted before persistence.  
   - Credentials must be rotatable (admin can update them and re-test without downtime).

5. **Enable / Disable**:  
   - Provider may be `enabled = false` so clients cannot use it, without deleting config.

6. **Adapter Health Checks**:  
   - Periodically validate adapters (CLI binary existence, HTTP connectivity) and surface status in admin API.

---

### Requirement 3: Pluggable Adapter System

**User Story:**  
As a system architect, I want a clean adapter interface so adding new AI providers is modular and easy.

**Acceptance Criteria:**

1. **Adapter Routing**:  
   - Based on the requested `model` in a chat call, choose the correct provider and instantiate its adapter.

2. **Spawn-CLI Adapter**:  
   - Safely execute CLI commands (with sandboxing, timeouts, resource limits).  
   - Accept `messages` via stdin; parse stdout or JSON output.

3. **HTTP-SDK Adapter**:  
   - Call remote APIs or SDKs (like Gemini, Bedrock) with correct authentication and mapping of OpenAI schema to vendor API.

4. **Proxy Adapter**:  
   - Forward OpenAI requests to another compatible proxy endpoint (inject API keys, route response).  
   - Support streaming passthrough if supported.

5. **Local Adapter**:  
   - Communicate with local model servers (Ollama, TGI, LocalAI) that already adhere to OpenAI-style API.

6. **Adapter Failure Handling**:  
   - Catch adapter exceptions and translate into proper OpenAI error responses.  
   - Optionally fallback to other adapters if configured.

---

### Requirement 4: Security & Sandboxing

**User Story:**  
As a security admin, I want to ensure CLI agents can't compromise the host or access unauthorized resources.

**Acceptance Criteria:**

1. **Containerized Execution**:  
   - CLI commands must run inside Docker containers (or equivalent sandbox) with CPU, memory limits, no host access beyond needed boundaries.

2. **Input Sanitization**:  
   - Prevent shell injection. Do **not** use `sh -c`. Use `spawn()` with arguments, pass user content over stdin.

3. **Timeout & Cancellation**:  
   - Adapter operations must enforce configured timeouts.  
   - If the client aborts (via signal/cancellation), the adapter must terminate the process or HTTP request promptly.

4. **API Authentication**:  
   - Clients calling `/v1/*` must supply valid API keys.  
   - Admin endpoints must use JWT or existing user auth system with `admin` role.

5. **Rate Limiting & Quotas**:  
   - Enforce per-API-key rate limits and quotas (requests per minute, total tokens) to avoid abusive usage.

6. **Transport Security**:  
   - All network communication (client ↔ gateway, gateway ↔ backend) must use TLS/HTTPS.

7. **Logging Redaction**:  
   - Sensitive content (passwords, user secrets) must be redacted or masked in logs and audit trails.

---

### Requirement 5: Authentication & Authorization

**User Story:**  
As admin, I want controlled access so only permitted users or clients can use the system.

**Acceptance Criteria:**

1. **API Key for Gateway**:  
   - `/v1/*` routes require a valid `Authorization: Bearer <API_KEY>`.  
   - Missing or invalid keys must lead to `401 Unauthorized`.

2. **Admin Endpoints Role Guard**:  
   - `/admin/*` endpoints require authenticated user with `admin` role (via JWT or session).  
   - Unauthorized access returns `403 Forbidden`.

3. **Logging Identity**:  
   - Log the identity (API key owner or user) and action for each request.

---

### Requirement 6: Response Normalization

**User Story:**  
As a client developer, I want consistent, predictable responses irrespective of which provider handled the request.

**Acceptance Criteria:**

1. **Uniform Format**:  
   - All adapter outputs (raw text, JSON, or streaming chunks) must be normalized into standard OpenAI Chat response structure (`choices`, `usage`, `model`, etc.).

2. **Token Usage Metrics**:  
   - The gateway should compute or estimate usage (prompt, completion tokens) and include them.

3. **Model Name Mapping**:  
   - Internally map adapter model IDs to client-facing `dyadModelId`.

4. **Streaming Response Format**:  
   - For streaming calls, use SSE or chunked JSON lines in the same pattern OpenAI uses (e.g. `data: { … }` chunks).

5. **Error Normalization**:  
   - Convert adapter or internal exceptions into error objects matching OpenAI’s error spec.

---

### Requirement 7: Monitoring, Health & Logging

**User Story:**  
As an operator, I want observability into system health & behavior for debugging and metrics.

**Acceptance Criteria:**

1. **Request Logging**:  
   - Log each incoming request (model, provider, client key), request time, and status code.

2. **Adapter Execution Logging**:  
   - Log start/end times, execution duration, adapter type, and errors.

3. **Admin Action Audits**:  
   - Record who created/updated/deleted providers and when.

4. **Health Endpoints**:  
   - Provide `/healthz` (liveness) and `/ready` (readiness) endpoints.

5. **Metrics Export**:  
   - Expose counters/histograms (requests per provider, latency, errors) (e.g. Prometheus metrics).

---

### Requirement 8: Configuration, Deployment & Scalability

**User Story:**  
As a DevOps engineer, I want flexible configuration and scalable deployment options.

**Acceptance Criteria:**

1. **Config Sources**:  
   - Load settings from environment variables, config files, or secret stores (with overrides) at startup.

2. **Sandbox Config**:  
   - Support configurable Docker sandbox image, CPU, memory, timeout settings.

3. **Rate / Timeout Config**:  
   - Make throttles, quotas, timeouts configurable per environment.

4. **Deployment Modes**:  
   - Support **standalone** deployment (dedicated service) and **integrated** mode (mounted within existing backend).

5. **Scalability**:  
   - The gateway must support horizontal scaling. Stateless parts (request routing, request normalization) should scale across instances. Shared state (provider configs, logs, metrics) should be centralized (database, metrics backend).  
   - Consider caching of `GET /v1/models` responses for performance.

---

## Additional Suggestions & Notes

- You may want a *simulation/dry-run mode* where admin can validate provider configuration without executing actual CLI commands.
- Consider **fallback logic**: if one adapter fails, optionally try a backup adapter.
- Define **SLAs / performance budgets**: e.g. max 2s latency for small prompts under normal load.
- Document **error mapping guidelines** explicitly (which adapter exceptions map to which OpenAI error types).
- Review and comply with third-party CLI / API provider Terms of Service prior to proxying or reverse-engineering.

---