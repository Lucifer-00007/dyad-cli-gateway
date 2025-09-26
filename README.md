# Dyad CLI Gateway — README

> **Dyad-CLI-Gateway**
> A pluggable, OpenAI-compatible gateway that lets Dyad (or any OpenAI-compatible client) talk to CLI agents, local model servers, and vendor SDKs by exposing a single `/v1` API surface.
> This repo/module is designed to fit inside your existing project structure (`backend/` and `frontend/`) and is intentionally backend-first so a frontend admin UI can be attached later.

---

## Table of contents

1. [Overview](#overview)
2. [Features](#features)
3. [Repository layout (where files go)](#repository-layout)
4. [Quick start (dev)](#quick-start-dev)
5. [Environment variables](#environment-variables)
6. [Running via Docker / docker-compose](#running-via-docker--docker-compose)
7. [API reference (OpenAI-compatible + admin)](#api-reference-openai-compatible--admin)
8. [Provider config example](#provider-config-example)
9. [Security & sandboxing notes](#security--sandboxing-notes)
10. [Testing](#testing)
11. [Integrating with Dyad (how to add as a Custom Provider)](#integrating-with-dyad-how-to-add-as-a-custom-provider)
12. [Development & contribution](#development--contribution)
13. [Roadmap / Next steps](#roadmap--next-steps)
14. [License](#license)

---

# Overview

This module implements an OpenAI-compatible gateway that:

* Exposes `/v1/chat/completions`, `/v1/models`, and optional `/v1/embeddings` endpoints so Dyad can call the gateway as any other model provider.
* Translates OpenAI-style requests into calls to one of several adapter types: `spawn-cli`, `http-sdk`, `proxy`, `local` (Ollama/TGI).
* Provides admin CRUD endpoints (`/admin/providers`) for registering providers and model mappings (designed to be used by a later frontend).
* Supports optional sandboxed CLI execution (recommended) using a Docker-runner helper.
* Persists provider configuration to MongoDB (leveraging your repo’s existing Mongoose setup).

This README focuses on **backend** usage, installation, configuration and examples.

---

# Features

* OpenAI-compatible endpoints for easy integration with Dyad and other OpenAI clients
* Pluggable adapter system:

  * `spawn-cli` — run CLI agents (Gemini CLI, Copilot CLI, Amazon Q CLI) via safe spawn or sandbox
  * `http-sdk` — call vendor APIs (Gemini OpenAI-compat, Bedrock via gateway pattern)
  * `proxy` — forward OpenAI requests to existing OpenAI-compatible proxies
  * `local` — forward to local model servers (Ollama / TGI / LocalAI)
* Provider registry persisted in MongoDB (Mongoose model)
* Admin API for CRUD & testing provider configs
* Optional streaming support (can be enabled in future)
* Dockerized for easy deployment

---

# Repository layout

This README assumes you will add the gateway under `backend/src/gateway/`. Example tree (important files you will create):

```
backend/
└── src/
    └── gateway/
        ├── index.js                # bootstrap (standalone service)
        ├── gatewayApp.js           # Express app factory
        ├── api/
        │   ├── openai.routes.js    # OpenAI-compatible endpoints
        │   └── admin.routes.js     # Admin CRUD endpoints
        ├── controllers/
        │   ├── openai.controller.js
        │   └── admin.controller.js
        ├── services/
        │   ├── gateway.service.js
        │   └── provider.service.js
        ├── adapters/
        │   ├── adapter.interface.js
        │   ├── spawn-cli.adapter.js
        │   ├── http-sdk.adapter.js
        │   ├── proxy.adapter.js
        │   └── local.adapter.js
        ├── normalizers/
        │   └── openai.normalizer.js
        ├── models/
        │   └── provider.model.js
        ├── middlewares/
        │   ├── apiKeyAuth.js
        │   └── rateLimiter.js
        ├── utils/
        │   ├── sandbox.js
        │   └── spawnHelper.js
        └── config/
            └── gateway.config.js

Dockerfile.gateway
docker-compose.gateway.yml
```

> NOTE: If you prefer to run the gateway inside your existing backend process, `gatewayApp.js` is an Express app factory you can `app.use('/gateway', gatewayApp)` from `backend/src/app.js`. Otherwise run it standalone using `index.js` and its own Docker image.

---

# Quick start (dev)

> These commands assume Node.js is installed and you are in the project root and have MongoDB available (or point `MONGO_URI` to a running instance).

1. Copy the gateway folder into your backend:

```bash
# from repo root
mkdir -p backend/src/gateway
# add files per layout above (or copy generated PoC)
```

2. Install dependencies (in `backend/`):

```bash
cd backend
npm install
# if using axios, mongoose, express, dotenv, winston, etc.
```

3. Create `.env.gateway` (or set envs) — see [Environment variables](#environment-variables) below.

4. Start the gateway (dev):

```bash
# run with node (or nodemon)
node src/gateway/index.js
# or npm run gateway:dev  (if you add script)
```

5. Test the echo PoC (if you added an echo adapter):

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer <GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cli-echo",
    "messages": [{"role":"user","content":"hello gateway"}]
  }'
```

You should receive an OpenAI-shaped response JSON containing the assistant content returned by the adapter.

---

# Environment variables

Create `.env.gateway` (or set these in your environment / Docker Compose):

```
GATEWAY_PORT=8080
MONGO_URI=mongodb://mongo:27017/yourdb
GATEWAY_MASTER_API_KEY=changeme_supersecret_key
GATEWAY_ADMIN_API_KEY=changeme_admin_key   # optional for admin UI/API calls
GATEWAY_JWT_SECRET=your_jwt_secret         # if reusing JWT from main backend
LOG_LEVEL=info
DOCKER_SOCKET=/var/run/docker.sock         # only if you use Docker sandbox runner
```

* `GATEWAY_MASTER_API_KEY` is used to authorize clients (Dyad) calling `/v1/*`. Keep it secret.
* Admin endpoints should be protected by your existing user auth + role checks; `GATEWAY_ADMIN_API_KEY` can be optional for internal automation.

---

# Running via Docker / docker-compose

Example `Dockerfile.gateway` (simple):

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/gateway/index.js"]
```

Example `docker-compose.gateway.yml` snippet:

```yaml
version: "3.8"
services:
  mongo:
    image: mongo:6
    restart: unless-stopped
    volumes:
      - mongo-data:/data/db
  gateway:
    build:
      context: .
      dockerfile: backend/Dockerfile.gateway
    ports:
      - "8080:8080"
    environment:
      - MONGO_URI=mongodb://mongo:27017/yourdb
      - GATEWAY_MASTER_API_KEY=${GATEWAY_MASTER_API_KEY}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # only if sandbox uses host docker
    depends_on:
      - mongo
volumes:
  mongo-data:
```

> Security note: mounting the Docker socket into a container is powerful and potentially dangerous — only do this in controlled environments, or prefer alternative sandboxing (Kubernetes pod exec, Firecracker, gVisor) for production.

---

# API reference (OpenAI-compatible + admin)

## OpenAI-compatible endpoints (public-facing for Dyad)

### `POST /v1/chat/completions`

**Auth:** `Authorization: Bearer <GATEWAY_MASTER_API_KEY>`
**Body (OpenAI chat schema):**

```json
{
  "model": "gemini-2.5-pro",
  "messages": [
    {"role":"system","content":"You are a helpful assistant."},
    {"role":"user","content":"Write a short haiku"}
  ],
  "max_tokens": 256
}
```

**Response:** OpenAI-shaped `chat.completion` JSON (id, object, created, model, choices[], usage).

### `GET /v1/models`

Returns a list of available models aggregated from configured providers:

```json
{
  "object": "list",
  "data": [
    { "id": "gemini-2.5-pro", "object": "model", "owned_by": "gemini-cli-local", "max_tokens": 4096 }
  ]
}
```

### `POST /v1/embeddings` (optional)

If provider supports embeddings, forwards accordingly.

---

## Admin endpoints (for frontend / operators)

**All admin endpoints must be protected** — integrate with your existing auth & `roles.isAdmin` middleware.

### `POST /admin/providers`

Create a provider (body: provider JSON — see sample below). Returns created provider document.

### `GET /admin/providers`

List providers.

### `GET /admin/providers/:id`

Get detail of provider (including models and last test status).

### `PUT /admin/providers/:id`

Update provider.

### `DELETE /admin/providers/:id`

Delete provider.

### `POST /admin/providers/:id/test`

Run a test with the provider (example request body: `{"messages":[{"role":"user","content":"ping"}]}`) — returns test result, logs, and success/fail.

---

# Provider config example

Example provider document (JSON) you can POST to `/admin/providers`:

```json
{
  "name": "Gemini-CLI-Local",
  "slug": "gemini-cli-local",
  "type": "spawn-cli",
  "description": "Local Gemini CLI wrapper (sandboxed)",
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
    "timeoutSeconds": 60
  },
  "credentials": {}
}
```

* `type` must be one of: `spawn-cli`, `http-sdk`, `proxy`, `local`.
* `adapterConfig` shape depends on `type`. The frontend will show dynamic fields.

---

# Security & sandboxing notes

**Do not run untrusted CLIs on the host without sandboxing.** Recommendations:

* Prefer running `spawn-cli` adapters inside ephemeral Docker containers (`docker run --rm --cpus=0.5 --memory=512m`) with minimal images containing only the CLI binary. The gateway's `sandbox.js` helper can manage this.
* Do not interpolate user input into shell commands — always pass prompt content into the process via stdin and use `spawn()` with argument arrays.
* Store provider credentials encrypted (KMS, environment variables, or vault) in production. In dev, cleartext is acceptable but insecure.
* Enforce per-key rate limits and per-call timeouts to avoid runaway usage.
* Carefully check third-party proxy projects (Copilot/Gemini reverse proxies) for legality and TOS compliance before using them in production.

---

# Testing

The repo includes Jest test wiring. Add tests under:

```
backend/tests/gateway/unit/
backend/tests/gateway/integration/
```

Important tests to add:

* Unit: `spawn-cli.adapter` (mock `child_process.spawn`), `http-sdk.adapter` (mock HTTP), normalizer.
* Integration: run the gateway app in test mode with MongoDB test DB, register a simple echo provider, hit `/v1/chat/completions` and assert OpenAI-shaped response.

Example run (from `backend/`):

```bash
npm run test -- tests/gateway
```

(You may add `gateway:test` npm script that limits jest to gateway tests.)

---

# Integrating with Dyad (how to add as a Custom Provider)

1. Ensure gateway is running and reachable from Dyad.
2. In Dyad UI: `Settings` → `AI Providers` → `Add Custom Provider`.

   * **ID:** `cli-gateway-local`
   * **Display name:** `Dyad CLI Gateway (local)`
   * **API base:** `http://<GATEWAY_HOST>:8080`
   * **API key:** `<GATEWAY_MASTER_API_KEY>` (set above)
3. Add a **Custom Model** in Dyad under that provider:

   * **Model ID:** `gemini-2.5-pro` (this must match the `dyadModelId` provided in a provider's `models` mapping)
   * **Name:** `Gemini 2.5 Pro (CLI)`
   * Set tokens/context per provider model mapping.

Now, Dyad will call your gateway on `/v1/chat/completions` and the gateway will dispatch the request to the configured adapter.

---

# Development & contribution

If you want to add features or contribute:

1. Fork the repo, create a feature branch `feat/gateway-<feature>`.
2. Follow the existing code style and tests.
3. Add unit tests for new adapters, and integration tests for end-to-end flows.
4. Submit a PR with a detailed description and example provider config.

Suggested tasks for first contributors:

* Implement initial `spawn-cli` adapter with an `echo-cli` PoC.
* Implement `provider.model.js` and admin CRUD endpoints + validation.
* Add integration tests that run gateway + echo adapter + call `/v1/chat/completions`.

---

# Roadmap / Next steps

* Add streaming (SSE or WebSocket) support for token-by-token streaming to Dyad.
* Add production-grade sandboxing (Kubernetes-based job runner or Firecracker microVMs).
* Add UI pages in `frontend/` (admin CRUD, test runner, logs viewer).
* Add adapters: Gemini via vendor API, Bedrock via access gateway, proxy adapters for community proxies if desired.
* Add secure secrets management (KMS/Vault), and Prometheus metrics + Grafana dashboards.

---

# Troubleshooting

* **`401 Unauthorized`**: Ensure the `Authorization` header is `Bearer <GATEWAY_MASTER_API_KEY>`.
* **`Command not found`** for `spawn-cli`: verify the container / host has the CLI binary mounted and `adapterConfig.command` points to the correct executable.
* **Timeouts**: Check provider `adapterConfig.timeoutSeconds` and gateway timeouts; verify sandbox runner doesn't restrict runtime too aggressively.
* **No models in Dyad**: Ensure you registered `models` mapping under the provider and that `/v1/models` lists them.

---

# Example quick curl flows

Create a provider (admin):

```bash
curl -X POST http://localhost:8080/admin/providers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT_OR_KEY>" \
  -d '@provider-gemini-cli.json'
```

Test a provider:

```bash
curl -X POST http://localhost:8080/admin/providers/<providerId>/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT_OR_KEY>" \
  -d '{ "messages": [{"role":"user","content":"ping"}]}'
```

Call from Dyad (or any OpenAI client) to the gateway:

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer <GATEWAY_MASTER_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-pro",
    "messages": [{"role":"user","content":"Write a to-do list"}]
  }'
```

---

# License

This module/code follows the main repository license. If you plan to publish this module separately, include a license (MIT / Apache-2.0). Check your main repo’s license to ensure compatibility.

---
