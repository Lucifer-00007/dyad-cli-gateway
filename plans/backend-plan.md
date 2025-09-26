# Backend-only implementation plan — **Dyad-CLI-Gateway** (mapped into your repo)

Great — below is a detailed, backend-only plan that fits into the codebase tree you already showed. It covers architecture, file-level mapping, data/models, API contracts for both the OpenAI-compatible gateway endpoints and the admin endpoints your future frontend will call, adapter designs, security, tests, Docker/compose, CI hooks, and step-by-step implementation milestones. I include clear, copy-pasteable Mongoose/Express code *stubs* (well-commented) you can drop into `backend/src` and build from.

---

# 1 — High-level decisions (context)

* **Service boundary:** implement the Gateway as a separate backend module within the existing `backend/` folder (so you can run it standalone or alongside the existing API). This keeps concerns separated but reuses existing middleware, logger, models and auth.
* **Persisted config:** store providers (adapter configs + credentials) in MongoDB using new `Provider` Mongoose model (the repo already uses Mongoose).
* **OpenAI compatibility:** gateway implements the subset Dyad needs:

  * `POST /v1/chat/completions` (primary)
  * `GET /v1/models`
  * `POST /v1/embeddings` (optional for RAG later)
* **Admin API (frontend-facing):** secure CRUD endpoints to create/update/test providers. These endpoints will be consumed by frontend admin pages.
* **Adapter pattern:** adapter interface + implementations:

  * `spawn-cli` (safe spawn with docker sandbox option)
  * `http-sdk` (call vendor HTTP/SDK)
  * `proxy` (forward to an external proxy)
  * `local-model` (Ollama/TGI that already speak OpenAI compat)
* **Auth:** gateway authenticates requests with API keys (for Dyad) and protects admin endpoints with existing JWT + role middleware (reuse `auth` and `roles`).
* **Safety first:** sandbox spawned CLIs (prefer Docker runner), sanitize inputs, per­-key quotas and timeouts.

---

# 2 — Directory & file mapping (what to add under `backend/`)

```
backend/
└── src/
    ├── gateway/                    # new module
    │   ├── index.js                # gateway service bootstrap (standalone)
    │   ├── gatewayApp.js           # creates Express app (used by index.js & tests)
    │   ├── api/
    │   │   ├── openai.routes.js    # /v1/* openai-compatible endpoints
    │   │   └── admin.routes.js     # /admin/providers CRUD (frontend uses this)
    │   ├── controllers/
    │   │   ├── openai.controller.js
    │   │   └── admin.controller.js
    │   ├── services/
    │   │   ├── gateway.service.js  # orchestrates adapters & mapping
    │   │   └── provider.service.js # CRUD + validation + test invocation
    │   ├── adapters/
    │   │   ├── adapter.interface.js
    │   │   ├── spawn-cli.adapter.js
    │   │   ├── http-sdk.adapter.js
    │   │   ├── proxy.adapter.js
    │   │   └── local.adapter.js
    │   ├── normalizers/
    │   │   └── openai.normalizer.js
    │   ├── models/
    │   │   └── provider.model.js
    │   ├── middlewares/
    │   │   ├── apiKeyAuth.js       # API key middleware for /v1 endpoints
    │   │   └── rateLimiter.js     # reuse or extend existing one in repo
    │   ├── utils/
    │   │   ├── sandbox.js         # helper to run dockerized commands
    │   │   └── spawnHelper.js     # safe spawn helpers
    │   └── config/
    │       └── gateway.config.js
    ├── routes/                     # optional: add mount in existing app.js
    │   └── v1/
    │       └── gateway.mount.js    # mount points if you integrate instead of standalone
    └── tests/
        └── gateway/
            ├── unit/
            └── integration/
Dockerfile.gateway
docker-compose.gateway.yml
```

---

# 3 — Data model(s)

### `backend/src/gateway/models/provider.model.js` (Mongoose)

Short schema explanation:

* `name`, `slug`, `type` (spawn-cli/http-sdk/proxy/local), `models` (array mapping `dyad_model_id` → `adapter_model_id`), `adapterConfig` (object), `credentials` (encrypted token(s)), `enabled`, `owner`, timestamps.

```js
// backend/src/gateway/models/provider.model.js
const mongoose = require('mongoose');

const ProviderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  type: { type: String, required: true, enum: ['spawn-cli','http-sdk','proxy','local'] },
  description: { type: String },
  enabled: { type: Boolean, default: true },
  // models: mapping visible model id -> adapter model id / metadata
  models: [{
    dyadModelId: { type: String, required: true }, // e.g. "gemini-2.5-pro"
    adapterModelId: { type: String, required: true }, // e.g. "gemini-cli-v1"
    maxTokens: { type: Number },
    contextWindow: { type: Number }
  }],
  // arbitrary adapter config (command, baseUrl, region, extra flags)
  adapterConfig: { type: Object, default: {} },
  // credentials stored encrypted in production (here as plain for PoC)
  credentials: { type: Object, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Provider', ProviderSchema);
```

> Note: in production, encrypt `credentials` field using a master key; or store secrets in a secret manager.

---

# 4 — Adapter interface & implementations (contract)

### `adapter.interface.js` — contract (JS-style)

```js
// backend/src/gateway/adapters/adapter.interface.js
/**
 * Adapter contract:
 * - init(providerConfig, credentials)
 * - handleChat({messages, options, requestMeta, signal}) => { choices: [...], usage: {...}, model: '...' }
 * - supportsStreaming: boolean
 * - optionally: handleEmbeddings({input})
 */
class BaseAdapter {
  constructor(providerConfig, credentials) {
    this.providerConfig = providerConfig;
    this.credentials = credentials;
  }
  async handleChat({ messages, options = {}, requestMeta = {}, signal }) {
    throw new Error('handleChat must be implemented');
  }
  async handleEmbeddings({ input, options = {} }) {
    throw new Error('handleEmbeddings not implemented');
  }
}
module.exports = BaseAdapter;
```

### `spawn-cli.adapter.js` — important notes

* Use `child_process.spawn` with argument array (no shell interpolation).
* Prefer writing the prompt to stdin; read stdout incrementally.
* Add timeout and kill if exceeding.
* **Sandbox**: run the CLI inside a Docker runner if CLI can execute arbitrary tools (recommended).

```js
// backend/src/gateway/adapters/spawn-cli.adapter.js
const { spawn } = require('child_process');
const BaseAdapter = require('./adapter.interface');

class SpawnCliAdapter extends BaseAdapter {
  constructor(providerConfig, credentials) {
    super(providerConfig, credentials);
    // providerConfig example: { command: "/usr/bin/gemini", args: ["--json"], dockerSandbox: true }
  }

  async handleChat({ messages, options = {}, requestMeta = {} }) {
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');

    // example: providerConfig.command and providerConfig.args (array)
    const cmd = this.providerConfig.command;
    const args = this.providerConfig.args || [];

    // spawn process (no shell)
    const child = spawn(cmd, args, { stdio: ['pipe','pipe','pipe'] });

    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });

    child.stdin.write(prompt);
    child.stdin.end();

    const exitCode = await new Promise((resolve) => child.on('close', resolve));
    if (exitCode !== 0) throw new Error(`CLI exited with ${exitCode}`);

    // Normalize as simple single-message assistant reply (normalizer will convert)
    return { raw: stdout };
  }
}
module.exports = SpawnCliAdapter;
```

> Production improvements: stream tokens back to Dyad (SSE/WebSocket), sandbox via Docker, robust parsing (JSON lines) and error classification.

### `http-sdk.adapter.js` — call vendor HTTP or SDK

* Use `axios` or vendor SDK (e.g., AWS SDK for Bedrock) to call API.
* Map OpenAI-like `messages` to the vendor payload and convert response.

### `proxy.adapter.js` — forward request

* Use `http-proxy` or `axios` to forward the entire OpenAI request to another OpenAI-compatible proxy. Mainly header/key injection and response passthrough.

### `local.adapter.js`

* Minimal adapter that forwards to `http://localhost:11434/v1` (Ollama/TGI) using axios.

---

# 5 — Gateway orchestration & normalizer

### `gateway.service.js`

* Accepts OpenAI-style request: pick provider by `model` requested (lookup in `Provider` models mapping), instantiate adapter for that provider, call `adapter.handleChat`, run `openai.normalizer` to convert into output.

### `openai.normalizer.js`

Converts `adapter` output (raw text or vendor response) into OpenAI response JSON:

```js
// minimal shape
{
  id: "chatcmpl-xxx",
  object: "chat.completion",
  created: 1234567890,
  model: "<dyad_model_id>",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "..." },
      finish_reason: "stop"
    }
  ],
  usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
}
```

---

# 6 — Routes & controllers (API contract)

## OpenAI-compatible endpoints (gateway primary)

All endpoints are mounted under the gateway's root, e.g. `http://GATEWAY_HOST:PORT`.

### `POST /v1/chat/completions`

* **Auth:** `Authorization: Bearer <GATEWAY_API_KEY>`
* **Request body** (OpenAI Chat schema):

```json
{
  "model": "gemini-2.5-pro",
  "messages": [
    {"role":"system","content":"You are ..."},
    {"role":"user","content":"Hello"}
  ],
  "max_tokens": 512
}
```

* **Response:** OpenAI-style `chat.completion` JSON (see normalizer schema).
* **Errors:** Standard JSON `{ error: { message, type, code } }`.

### `GET /v1/models`

* **Returns:** array of available models (merged from registered providers)

```json
{
  "object": "list",
  "data": [
    { "id": "gemini-2.5-pro", "object": "model", "owned_by": "provider-slug", "max_tokens": 4096 }
  ]
}
```

### `POST /v1/embeddings`

* Optional; route to provider's embedding API if adapter supports it.

---

## Admin endpoints (frontend will use these)

Mount under `/admin` (or reuse `/v1/admin`), protected with existing auth + `roles.isAdmin` middleware.

### `POST /admin/providers` — create provider

* Body (example):

```json
{
  "name": "Gemini Local CLI",
  "slug": "gemini-cli-local",
  "type": "spawn-cli",
  "adapterConfig": {
    "command": "/usr/local/bin/gemini",
    "args": ["--json"]
  },
  "credentials": {},
  "models": [
    { "dyadModelId": "gemini-2.5-pro", "adapterModelId": "gemini-cli-2.5" }
  ]
}
```

* Response: created provider object.

### `GET /admin/providers` — list

### `GET /admin/providers/:id` — get

### `PUT /admin/providers/:id` — update

### `DELETE /admin/providers/:id` — remove

### `POST /admin/providers/:id/test` — run a quick test invocation (echo/ping). Returns OK or error — useful for admin UI to validate settings.

---

# 7 — Integrations with existing backend (where to change)

* **`backend/src/app.js`** — optionally mount gateway routes into the main Express app (if you prefer one process). Add something like:

```js
// in app.js (mounting when env var GATEWAY_INTEGRATED=true)
const gatewayApp = require('./gateway/gatewayApp');
app.use('/gateway', gatewayApp);
```

* Or run gateway as **standalone** using `backend/src/gateway/index.js` and add a new entry in `ecosystem.config.json` and `docker-compose.gateway.yml`. I recommend standalone to make resource limits and restarts independent.

* **Middleware reuse:** reuse `middlewares/auth.js` and `middlewares/rateLimiter.js` from existing `backend/src/config` and `backend/src/middlewares`. Copy or import them into gateway middlewares folder.

---

# 8 — Sandbox & security details

* **Sandbox options:**

  1. **Docker runner** (recommended): spawn the CLI inside a short-lived container that has only the CLI binary and limited resources (CPU, memory). Implement `sandbox.js` helper to run `docker run --rm --memory=...` with pipes for stdin/out.
  2. **Unprivileged user**: run CLI under a dedicated user account (less isolation).
* **Command execution rules**:

  * Never pass prompt as part of shell command string. Always write to stdin.
  * Validate `providerConfig.command` against allowed list or paths.
  * Enforce per-call timeout and kill processes that exceed.
* **Secrets & creds**:

  * Keep minimal sensitive data in DB; prefer storing external credentials in environment variables or secret manager.
  * Add simple master key in `gateway.config.js` and encrypt provider credentials before saving (you can start with plaintext for dev).
* **Rate limits**: reuse or extend `rateLimiter.js` to enforce per-API-key limits on `/v1/*`.

---

# 9 — Logging, metrics & observability

* Reuse existing `logger.js` from `backend/src/config/logger.js`.
* Add request ids and logs at:

  * Request receive (model, provider slug)
  * Adapter start / adapter end
  * Exit codes and errors
* Emit Prometheus-friendly metrics (requests, adapter errors, latencies) to `/metrics` endpoint (optional).
* Store audit logs for admin provider changes (who changed what + time).

---

# 10 — Tests

Create tests under `backend/tests/gateway/`:

* **Unit tests**:

  * Adapter `spawn-cli.adapter`: mock `child_process.spawn` and verify `handleChat` returns expected `raw` output.
  * `http-sdk.adapter`: mock axios responses.
  * `provider.service` create/update validation.
* **Integration tests**:

  * Start gateway app (in-memory or test DB), register an echo provider, call `/v1/chat/completions` and assert correct OpenAI-shaped response.
* Use existing Jest configuration (`jest.config.js`) and test DB setup (`tests/utils/setupTestDB.js` is present in repo; reuse pattern).

---

# 11 — Docker & compose

**`backend/Dockerfile.gateway`** — separate image for gateway (based on node:current-alpine or same as others in repo). Include ability to run inside Docker (ensure Docker-in-Docker not required for sandbox; the sandbox runner will use host Docker socket if you choose Docker sandbox strategy — document the security tradeoff).

**`docker-compose.gateway.yml`** — example services:

* `gateway` (this service)
* `mongod` (or reuse existing db service)
* `gemini-proxy` (optional, for testing)
* `local-ollama` (optional)

Add to project `docker-compose.yml` via `extends` or include docs in `README`.

---

# 12 — CI / release

* Add npm scripts in `backend/package.json`:

  * `gateway:dev` — start gateway in dev mode
  * `gateway:start` — start production mode
  * `gateway:test` — run jest tests for gateway
* Add GitHub Actions workflow `ci-gateway.yml`:

  * Run `npm ci`, lint, unit tests, build docker image for gateway.
  * Optionally push image on tagged release.

---

# 13 — Implementation milestones (detailed step-by-step)

**Sprint 0 — Setup & skeleton (1–2 days)**

* Create `backend/src/gateway` folder + skeleton files.
* Add `Dockerfile.gateway` and `docker-compose.gateway.yml`.
* Add entry in `ecosystem.config.json` for gateway.

**Sprint 1 — M1 PoC / Echo adapter (2–3 days)**

* Implement `gatewayApp.js`, `index.js`.
* Implement `openai.routes.js` + `openai.controller.js` routing `POST /v1/chat/completions` → `gateway.service` → `spawn-cli` echo adapter (`./adapters/echo-cli.sh`).
* Add `GET /v1/models` returning a single `cli-echo`.
* Test manually with `curl` and add provider in Dyad pointing to `<host>/v1`.

**Sprint 2 — Provider persistence & admin endpoints (2–3 days)**

* Implement `provider.model.js`, `provider.service.js`, `admin.routes.js`, `admin.controller.js`.
* Admin endpoints protected by `auth` middleware + `roles` admin check (reuse existing).
* Implement `POST /admin/providers/:id/test` to run a small test.

**Sprint 3 — Adapter interface + proxy adapter (3–5 days)**

* Implement `adapter.interface.js` and `proxy.adapter.js`.
* Add `http-sdk.adapter.js` stub and `local.adapter.js` for Ollama.
* Add `normalizer`.

**Sprint 4 — Spawn-CLI hardening & sandbox (5–8 days)**

* Implement `spawn-cli.adapter.js` with sandboxing via Docker runner helper `sandbox.js`.
* Add timeout/kill, resource-limits config.
* Add integration tests.

**Sprint 5 — Streaming & embeddings (optional, 5–7 days)**

* Add SSE support or WebSocket streaming.
* Add `/v1/embeddings` endpoint if needed.

**Sprint 6 — Production hardening (7–10 days)**

* Secrets encryption, rate-limits, monitoring, Prometheus metrics, CI pipeline.

---

# 14 — API documentation for frontend (deliverable for frontend team)

Provide an OpenAPI (Swagger) spec for:

* `POST /v1/chat/completions`
* `GET /v1/models`
* Admin endpoints: `POST /admin/providers`, `GET /admin/providers`, `PUT /admin/providers/:id`, `DELETE /admin/providers/:id`, `POST /admin/providers/:id/test`
  Return example payloads and response contracts (as above). The frontend needs:
* to list providers: `GET /admin/providers`
* to create provider forms: use provider `type` enum + adapterConfig schema mapping (show fields based on type)
* to run `POST /admin/providers/:id/test` to validate credentials/config
* to show provider status (last test success/failure)

---

# 15 — Example provider config JSON (for admin UI)

```json
{
  "name": "Gemini-CLI-Local",
  "slug": "gemini-cli-local",
  "type": "spawn-cli",
  "enabled": true,
  "models": [
    { "dyadModelId": "gemini-2.5-pro", "adapterModelId": "gemini-cli-2.5", "maxTokens": 4096 }
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

---

# 16 — Security checklist (must-have before production)

* [ ] Provider credentials encrypted (KMS/ENV key)
* [ ] API keys (Dyad → gateway) stored safely; rotation plan
* [ ] Sandbox adapters run unprivileged / containerized
* [ ] Input sanitization & no `sh -c` usage
* [ ] Rate limiting / quotas per API key
* [ ] Audit logging for admin actions and executed commands
* [ ] Review legal/TOS before proxying third-party CLIs

---

# 17 — Deliverables I can produce for you now (if you want)

If you want I can immediately generate:

* PoC code for **Sprint 1** (Node.js plain JS) — `gatewayApp.js`, `index.js`, `openai.routes.js`, `spawn-cli.adapter.js` (echo), `provider.model.js`, `Dockerfile.gateway`, and `docker-compose.gateway.yml`.
* Unit test skeletons for Jest.
* OpenAPI spec skeleton for the gateway.

Tell me which PoC files you want first and which language (Node+JS recommended given your existing repo). I’ll output them ready to paste into your `backend/` folder.