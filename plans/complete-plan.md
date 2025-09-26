Nice — below is a **detailed, actionable plan** that maps a Dyad-CLI-Gateway into the repository structure you showed. It includes architecture, concrete files to add, adapters to implement, security & testing, CI/Docker, and a prioritized milestone schedule so you (or your team) can implement it in phases.

I also include links to existing projects and patterns you can reuse (proxies for Gemini / Copilot, Ollama OpenAI compatibility, AWS Bedrock Access Gateway) so you don’t re-invent wheels. Key supporting references: Gemini & Copilot proxy projects, Ollama OpenAI compatibility, Bedrock Access Gateway. ([GitHub][1])

---

# 1) Summary — what we will build

A self-hosted **Dyad-CLI-Gateway** service that:

* exposes an **OpenAI-compatible HTTP API** (`/v1/chat/completions`, `/v1/embeddings`, `/v1/models`) so Dyad can add it as a Custom Provider;
* contains a **pluggable adapter layer** that can (a) spawn CLIs (stdin/stdout), (b) call vendor SDKs/HTTP APIs (Gemini/Bedrock), or (c) proxy to existing community proxies (Copilot/Gemini proxies);
* provides an **admin UI** in the `frontend` for registering providers and adapters (optional at first — config file + env is OK);
* is dockerized, testable, and production-hardened with auth, quotas, and sandboxing.

Why this works: Dyad accepts OpenAI-style custom providers — so the gateway acts as a protocol translation layer and permits CLI agents to appear as normal model providers to Dyad. Reuse: `gemini-openai-proxy`, `copilot-api` reverse proxies, and AWS `bedrock-access-gateway` demonstrate the approach. ([GitHub][1])

---

# 2) High-level architecture (component view)

Dyad UI → OpenAI-style HTTP → **dyad-cli-gateway (backend)**
Gateway components:

1. **HTTP API (OpenAI-compat)** — endpoints `/v1/chat/completions`, `/v1/embeddings`, `/v1/models`, streaming support optional.
2. **Provider Registry** — config file + admin endpoints to register adapters (YAML/JSON).
3. **Adapter Layer** — implementations for:

   * `spawn-cli` adapter (spawn CLI, stream stdin/out)
   * `http-sdk` adapter (call vendor HTTP/SDK like Bedrock/Gemini)
   * `proxy` adapter (forward to community proxies like `gemini-openai-proxy` or `copilot-api`)
4. **Normalizer** — convert adapter output → OpenAI response schema.
5. **Security** — API key auth, per-adapter creds, rate limits, sandboxing.
6. **Observability** — logs, request ids, metrics.

---

# 3) Where to put things in your repo (mapped to your tree)

Your repo already has `backend/` and `frontend/`. Map the gateway into `backend` with a clear module layout, and add a small admin UI in `frontend` integrated with existing app.

Suggested additions:

```
backend/
├── src/
│   ├── gateway/                     # new gateway module root
│   │   ├── index.js                 # gateway server entry (registered in ecosystem.config.json)
│   │   ├── api/
│   │   │   ├── openai.routes.js     # /v1/* endpoints
│   │   │   └── admin.routes.js      # register/list providers
│   │   ├── adapters/
│   │   │   ├── adapter.interface.js # adapter base class / types
│   │   │   ├── spawn-cli.adapter.js # runs CLI via child_process
│   │   │   ├── http-sdk.adapter.js  # calls vendor SDKs (Gemini / Bedrock)
│   │   │   └── proxy.adapter.js     # forward to external proxy (gemini/copilot)
│   │   ├── providers/
│   │   │   └── config.store.js      # load/save provider registry (json/yaml)
│   │   ├── normalizers/
│   │   │   └── openai.normalizer.js # makes responses OpenAI-shaped
│   │   ├── auth/
│   │   │   └── apiKey.middleware.js
│   │   ├── sandbox/
│   │   │   └── container.exec.js    # optional: containerized execution helper
│   │   └── utils/
│   │       └── logger.js
│   └── config/
│       └── gateway.config.js        # runtime config (port, rate-limits, secret keys)
├── Dockerfile.gateway               # specific dockerfile for gateway
├── docker-compose.gateway.yml       # compose fragment to run gateway & proxies
└── tests/
    └── gateway/                      # unit & integration test for gateway
```

Frontend:

```
frontend/
├── src/
│   ├── pages/
│   │   └── GatewayAdmin.tsx         # UI to add provider (optional, M3)
│   └── lib/
│       └── gatewayApi.ts            # convenience calls to admin endpoints
```

Add documentation in `md-docs/` and a new top-level `plans/dyad-cli-gateway-plan.md`.

---

# 4) Concrete features & code responsibilities (per file)

* `backend/src/gateway/index.js`

  * Bootstraps the gateway Express/Fastify app, mounts middleware (auth, logging), registers routes from `api/`, initializes provider registry, and starts HTTP server.
* `backend/src/gateway/api/openai.routes.js`

  * Implements `POST /v1/chat/completions` reading `model`/`messages`, selects provider adapter from registry, calls adapter, streams/returns OpenAI JSON.
  * Implements `GET /v1/models` to enumerate mapped models (Dyad will call this to list models).
* `backend/src/gateway/api/admin.routes.js`

  * `POST /admin/providers` — create provider (type, adapter config, credentials).
  * `GET /admin/providers` — list providers.
  * `PUT /admin/providers/:id` — update.
  * Secure with admin API key / basic auth.
* `backend/src/gateway/adapters/adapter.interface.js`

  * Exposes `async handleChat({messages, options, providerConfig, requestMeta}) => {stream|complete}`.
* `backend/src/gateway/adapters/spawn-cli.adapter.js`

  * Uses `child_process.spawn` to run CLI (e.g., `gemini` CLI or `copilot-cli`), writes prompt to stdin, reads stdout, applies a parser (or expects JSON).
  * Must validate/sanitize command arguments to prevent injection.
  * Optionally runs each command inside a disposable container (Docker) or restricted user using the `sandbox` helper.
* `backend/src/gateway/adapters/http-sdk.adapter.js`

  * Calls vendor SDKs/APIs (Gemini via OpenAI-compat endpoint if available, or Bedrock via `bedrock-access-gateway`) using official SDKs where possible. See AWS bedrock samples for guidance. ([GitHub][2])
* `backend/src/gateway/adapters/proxy.adapter.js`

  * Simple forwarder to public proxies (e.g., `gemini-openai-proxy`, `copilot-api`) with support for streaming proxies.
  * Include header rewriting and credential injection.
* `backend/src/gateway/normalizers/openai.normalizer.js`

  * Converts raw string output from CLI or proxied API into OpenAI chat response format: `{id, object, created, model, choices: [{message:{role:'assistant', content}}], usage}`.
* `backend/src/gateway/auth/apiKey.middleware.js`

  * Verifies incoming `Authorization: Bearer <KEY>`, checks against gateway master API key and/or per-provider allowed keys.

---

# 5) Security & sandboxing (important)

* **Do not run arbitrary CLI commands as root.** Use a sandboxed execution model:

  * Option A: run spawn-CLI adapters inside ephemeral Docker containers (Docker CLI invocation with volume mounts limited); use a prebuilt minimal runner image.
  * Option B: use a dedicated unprivileged user and chroot/jail (harder).
* **Input sanitization** — disallow shell interpolation; pass prompts over stdin, never pass unsanitized prompt into `sh -c`. Escape args and use `spawn` with arg array.
* **Secrets** — store provider credentials encrypted (e.g., environment or in file encrypted with master key).
* **Rate limiting & quotas** — enforce per-API key limits to avoid runaway CLI usage.
* **Logging & audit** — log provider used, command executed, user id, timestamp. Optionally redact sensitive outputs.
* **Legal/ToS** — proxies for Copilot/Gemini may be reverse-engineered — check TOS before production use. (There are community proxies—use carefully). ([GitHub][3])

---

# 6) Reuse: community proxies & patterns (links to reuse)

* `gemini-openai-proxy` — convert OpenAI calls to Gemini protocol. Good as a proxy adapter or direct reuse. ([GitHub][1])
* `ericc-ch/copilot-api` and `BjornMelin/github-copilot-proxy` — reverse-engineered Copilot proxies exposing OpenAI-compatible endpoints (experimentally useful). Use with caution; prefer vendor APIs when possible. ([GitHub][3])
* `aws-samples/bedrock-access-gateway` — example for Bedrock → OpenAI compat gateway. Good reference for Bedrock adapter logic. ([GitHub][2])
* `Ollama` OpenAI compat — run local models and treat them as a provider (no adapter work needed). ([Ollama][4])

---

# 7) Milestones (priority + approx. deliverable per milestone)

**M0 — Repo prep & design (1–2 days)**

* Create `backend/src/gateway` skeleton, add README and OpenAPI spec for `/v1/chat/completions`.
* Add `Dockerfile.gateway` and update `docker-compose.yml` (or create `docker-compose.gateway.yml`) to run gateway.

**M1 — Minimal PoC (3–5 days)** — *goal: Dyad talks to gateway and returns a response*

* Implement `openai.routes.js` with `POST /v1/chat/completions` that calls a simple `spawn-cli` adapter which runs an `./adapters/echo-cli` script that echoes prompts.
* Add `GET /v1/models` enumerating a single model `cli-echo`.
* Add `backend/Dockerfile.gateway` and test locally; add provider in Dyad pointing to gateway.
  *Outcome:* Dyad → gateway → echo → Dyad UI shows responses.

**M2 — Adapter abstraction + proxy adapter (5–7 days)**

* Implement adapter interface and `proxy.adapter` to forward to an existing proxy (e.g., `gemini-openai-proxy` running separately).
* Add `provider.config` format and admin routes to register a proxy provider.

**M3 — SDK adapter (Gemini / Bedrock) + model mapping (7–10 days)**

* Implement `http-sdk.adapter.js` that can call (a) Gemini via OpenAI compatibility (if available), and (b) Bedrock via `bedrock-access-gateway` pattern. Use official SDKs where possible. Add model id mapping (`dyad-model-id` → provider adapter id). ([GitHub][2])

**M4 — spawn-CLI adapter hardening & sandboxing (7–14 days)**

* Replace PoC echo with robust `spawn-cli.adapter.js` that runs CLIs securely (Docker runner). Add per-task timeouts, resource limits, and tests. Provide templates for adapter configs for Gemini CLI, Copilot CLI (if used), Amazon Q CLI.
* Add `tests/gateway` E2E tests.

**M5 — Streaming + frontend admin UI (optional) (7–10 days)**

* Add streaming support (SSE or WebSocket) for partial tokens as they arrive.
* Add `frontend/src/pages/GatewayAdmin.tsx` to register providers and show status.

**M6 — Production hardening (7–14 days)**

* Add auth layers, secrets encryption, Prometheus metrics, centralized logging, CI. Prepare Helm chart or docker-compose production manifests.

---

# 8) Tests & CI

* **Unit tests** for adapters: mock child processes and proxy endpoints; assert normalizer output.
* **Integration tests**: run gateway + simple echo adapter + Dyad (or a curl script that mimics Dyad) to ensure end-to-end.
* Add GitHub Actions workflows: run linter, tests, build docker image, and optionally push image to registry on tag.

---

# 9) Example minimal PoC code snippets (node)

I can generate working code for **M1** (Express server, echo adapter) in TypeScript or JS. This will include:

* `backend/src/gateway/index.js` (server bootstrap)
* `backend/src/gateway/api/openai.routes.js` (chat endpoint)
* `backend/src/gateway/adapters/spawn-cli.adapter.js` (calls `./adapters/echo-cli`)
* `backend/src/gateway/adapters/echo-cli` (simple script)
* `backend/Dockerfile.gateway` and `docker-compose.gateway.yml`

(If you want, I’ll generate the full PoC files now in Node/TypeScript and give you exact instructions to run it with Docker and add Dyad provider entries.)

---

# 10) Operational & legal cautions

* Reverse-engineered proxies for Copilot/Gemini exist and are useful for experimentation, but check TOS for production usage. Use official API paths (Gemini OpenAI-compat or Bedrock Access Gateway) whenever possible. ([GitHub][3])

---

# 11) Next steps I’ll take if you say “do it now”

If you want me to produce code now I will:

* Create the **M1 PoC** Node.js implementation (Express) under `backend/src/gateway/*` (JS) plus `backend/Dockerfile.gateway` and `docker-compose.gateway.yml`.
* Add an `echo-cli` adapter script and basic tests.
* Provide exact Dyad provider config to paste (API base, model id, API key example).
  Tell me which language you prefer (Node + TypeScript, Node + plain JS, or Python + FastAPI). I recommend **Node + TypeScript** because your repo is Node/JS heavy and it fits the existing ecosystem.

---

If you want, I’ll start by generating the **M1 PoC** code in **Node (plain JS)** and the `docker-compose` fragment — ready to paste into your `backend` folder and run. Which language do you want for the PoC: **Node (JS)**, **Node (TS)**, or **Python (FastAPI)**?

[1]: https://github.com/zhu327/gemini-openai-proxy?utm_source=chatgpt.com "zhu327/gemini-openai-proxy"
[2]: https://github.com/aws-samples/bedrock-access-gateway?utm_source=chatgpt.com "aws-samples/bedrock-access-gateway"
[3]: https://github.com/ericc-ch/copilot-api?utm_source=chatgpt.com "ericc-ch/copilot-api - GitHub"
[4]: https://ollama.com/blog/openai-compatibility?utm_source=chatgpt.com "OpenAI compatibility · Ollama Blog"
