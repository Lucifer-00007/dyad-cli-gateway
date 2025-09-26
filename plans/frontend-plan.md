# Frontend-only implementation plan — **Dyad CLI Gateway Admin UI**

(A plan mapped to your existing `frontend/` codebase so it plugs into the backend you already planned)

Short summary: we'll add an admin UI inside `frontend/` that lets operators register CLI gateway providers, manage models, run tests, and view logs. The UI will call the backend admin endpoints (`/admin/providers`, `/admin/providers/:id/test`, `/v1/models`) described in your backend plan. The plan includes pages, components, data types, API client code, state-management choices, forms/validation, tests, accessibility, build/CI, and an ordered milestone list (no time estimates).

---

# 1. High-level UX & pages

Users: Admin / Operator (must be behind existing auth / roles)

Pages (under `frontend/src/pages`):

* `GatewayList.tsx` — list all registered providers, status, quick actions (edit, delete, test, enable/disable).
* `GatewayCreate.tsx` — form to create a new provider.
* `GatewayEdit.tsx` — edit existing provider and its model mappings.
* `GatewayDetail.tsx` — provider details, model list, recent test results/logs, run-once test tool.
* `ModelMappingEditor.tsx` (small page/section) — edit dyad → adapter model mappings.
* `GatewaySettings.tsx` — global UI settings (default timeouts, sandbox mode toggle, base gateway API key UI if needed).

Where to put them in your repo:

```
frontend/src/pages/
  GatewayList.tsx
  GatewayCreate.tsx
  GatewayEdit.tsx
  GatewayDetail.tsx
  GatewaySettings.tsx
```

Routing: add routes in `frontend/src/App.tsx` (or wherever your router is wired) behind admin role guard.

---

# 2. Components (re-usable, in `frontend/src/components/gateway/*`)

Components & responsibilities:

* `ProviderCard.tsx` — list-row UI for provider (status, quick actions).
* `ProviderForm.tsx` — reusable form used by create & edit pages.
* `ModelMappingForm.tsx` — editable list for mapping dyadModelId ↔ adapterModelId.
* `AdapterConfigEditor.tsx` — dynamic form section that shows fields based on provider `type` (spawn-cli / http-sdk / proxy / local).
* `TestRunModal.tsx` — modal to run and show test result (request sample, logs, success/fail).
* `ApiKeyManager.tsx` — UI to view/regenerate gateway API keys (if backend supports).
* `LogsViewer.tsx` — tail viewer for provider test logs (optional streaming).
* `ConfirmDialog.tsx` — generic confirmation modal (delete provider etc).

Paths:

```
frontend/src/components/gateway/
  ProviderCard.tsx
  ProviderForm.tsx
  ModelMappingForm.tsx
  AdapterConfigEditor.tsx
  TestRunModal.tsx
  LogsViewer.tsx
  ApiKeyManager.tsx
  ConfirmDialog.tsx
```

Style & primitives: use existing UI components under `frontend/src/components/ui/*` (button, input, dialog, table). Follow the project’s Tailwind classes and conventions used by the current UI components.

---

# 3. State & data fetching strategy

Recommended libraries (modern, commonly used, small learning curve):

* **React Query (TanStack Query)** for server-state (fetching providers, models, running tests, caching, optimistic updates).
* **react-hook-form** + **zod** for form handling + validation (schema-based).
* **axios** for HTTP client (or `fetch` if you prefer native).

Why:

* React Query makes caching/list invalidation straightforward for CRUD flows (create/update/delete provider).
* react-hook-form keeps forms fast and less verbose; zod gives typed validation and can generate typed form values.

Add libs:

```bash
# install (example)
npm install @tanstack/react-query react-hook-form zod axios
```

Global providers:

* Add `QueryClientProvider` in `frontend/src/main.tsx` (if not already present).
* Add a small `api` layer (see next section).

---

# 4. API client & types (integrate with backend)

Create `frontend/src/lib/gatewayApi.ts` (you mentioned a similar file earlier). Sample TypeScript-friendly client and types:

```ts
// frontend/src/types/gateway.ts
export type ProviderType = 'spawn-cli' | 'http-sdk' | 'proxy' | 'local';

export interface ModelMapping {
  dyadModelId: string;     // e.g. "gemini-2.5-pro"
  adapterModelId: string;  // e.g. "gemini-cli-2.5"
  maxTokens?: number;
  contextWindow?: number;
}

export interface Provider {
  _id?: string;
  name: string;
  slug: string;
  type: ProviderType;
  description?: string;
  enabled: boolean;
  adapterConfig: Record<string, any>;
  credentials?: Record<string, any>;
  models: ModelMapping[];
  createdAt?: string;
  updatedAt?: string;
}
```

```ts
// frontend/src/lib/gatewayApi.ts
import axios from 'axios';
import type { Provider } from '../types/gateway';

const api = axios.create({
  baseURL: import.meta.env.VITE_GATEWAY_ADMIN_URL ?? '/gateway-admin', // set in env
  // optional: add interceptors for auth (reuse existing auth tokens)
});

// Providers CRUD
export const listProviders = () => api.get('/admin/providers').then(r => r.data);
export const getProvider = (id: string) => api.get(`/admin/providers/${id}`).then(r => r.data);
export const createProvider = (payload: Provider) => api.post('/admin/providers', payload).then(r => r.data);
export const updateProvider = (id: string, payload: Partial<Provider>) => api.put(`/admin/providers/${id}`, payload).then(r => r.data);
export const deleteProvider = (id: string) => api.delete(`/admin/providers/${id}`).then(r => r.data);

// Test invocation
export const testProvider = (id: string, sample?: { messages?: any[] }) =>
  api.post(`/admin/providers/${id}/test`, sample).then(r => r.data);

// Models list (global list that Dyad/frontend might show)
export const listModels = () => api.get('/v1/models').then(r => r.data);
```

Environment variable:

* `VITE_GATEWAY_ADMIN_URL` — base URL for the gateway admin API (set in `.env` / deployment).

---

# 5. Forms & validation

Use react-hook-form + zod:

* Create `frontend/src/lib/schemas/gatewaySchema.ts` with zod schemas for Provider creation/editing. Adapter-specific schema branches for `spawn-cli`, `http-sdk`, `proxy`, `local`.
* `ProviderForm.tsx` will:

  * use `useForm` and `zodResolver`.
  * dynamically show/hide fields based on `type`.
  * include client-side validation for `slug` (no spaces), required fields, and for `adapterConfig` keys.
  * allow uploading credentials (or edit via masked inputs).

UX details:

* For `spawn-cli` adapter, show `command` (string), `args` (array input), `dockerSandbox` (toggle), `sandboxImage` (if docker), `timeoutSeconds`.
* For `http-sdk`, show `baseUrl`, `authType` (API key / AWS role), region, modelPrefix mapping.
* For `proxy`, show `proxyBaseUrl`, `apiKeyHeaderName`.
* Provide an inline “Test” button on the form to call `POST /admin/providers/:id/test` after create/update.

---

# 6. UX flows & edge cases

Main flows:

1. Admin visits `GatewayList` → sees providers → clicks "Create".
2. `GatewayCreate` opens `ProviderForm` → submits → backend returns created provider → navigate to `GatewayDetail`.
3. `GatewayDetail` shows model mappings; click `Run Test` opens `TestRunModal` that posts a sample prompt and shows logs & result.
4. Edit mapping: `ModelMappingEditor` lets admin add dyadModelId / adapterModelId rows (validate duplicates).
5. Provider-level toggles: enable/disable; delete triggers `ConfirmDialog`.

Edge cases:

* Backend test fails; show error stack and last successful test timestamp.
* Credentials change: mask in UI; provide "Show" toggles & copy to clipboard.
* Long running tests/streaming: show spinner and live logs (SSE / websocket if backend supports).
* Permissions: use existing auth to gate the admin pages (roles.isAdmin).

---

# 7. Tests (unit & E2E)

Unit / component tests:

* Use **Vitest** (or Jest if project already uses it) + **React Testing Library**.
* Add tests for: `ProviderForm` validation, `ProviderCard` actions, `ModelMappingForm` behavior.

Integration / E2E:

* Use **Playwright** (recommended) or Cypress to cover flows:

  * Create provider, test provider, edit mapping, delete provider.
  * Auth-protected routes (login + role).

Where tests live:

```
frontend/src/__tests__/
  ProviderForm.test.tsx
  ProviderList.test.tsx
playwright/ (or cypress/)
  e2e.spec.ts
```

---

# 8. Accessibility & Internationalization

Accessibility:

* All inputs must have labels.
* Use proper ARIA attributes for dialogs, tables.
* Ensure keyboard navigation on forms, modals and list actions.
* Color contrast compliant with WCAG.

i18n:

* If you need i18n, add `react-intl` or `i18next`. Keep text strings in a `locales/*` folder. But start with English and structure components so i18n is easy later.

---

# 9. Styling & UX polish

* Use existing Tailwind config and `components/ui` primitives (button, input, dialog).
* Keep consistent spacing & form layout: labels on left for wide screens, stacked on small screens.
* Use badges for provider type and status (enabled/disabled).
* Provide helpful inline tooltips explaining `dockerSandbox` risks, and API key storage guidance.

---

# 10. Logging & diagnostics UI

* `GatewayDetail` should show:

  * Last test result (success/fail)
  * Test timestamp
  * Recent logs (if backend exposes logs): call `/admin/providers/:id/logs` or `/admin/providers/:id/test?follow=true` (SSE).
* `LogsViewer` component supports simple polling mode and eventual streaming.

Design assumption: backend exposes minimal logs per test invocation. If streaming is implemented later, upgrade component to use EventSource.

---

# 11. Build, env, and deployment

Vite env:

* `.env.development`, `.env.production`:

  * `VITE_GATEWAY_ADMIN_URL=https://gateway.example.com`

NPM scripts (add to `frontend/package.json`):

* `gateway:dev` — `vite`
* `gateway:build` — `vite build`
* `gateway:preview` — `vite preview`

Docker:

* If you want a separate frontend image, add a `Dockerfile.frontend` (or reuse repo-wide frontend Dockerfile). Make sure `VITE_GATEWAY_ADMIN_URL` is provided at build-time or via runtime env injection technique (for static builds you must bake the API base or use a small runtime wrapper).

CI:

* Add a GitHub Actions workflow `ci-frontend-gateway.yml`:

  * Install deps, run lint, run unit tests, run playwright e2e on main branch, build production artifact.

---

# 12. Security & privacy considerations (frontend)

* Never display secret values in logs. Mask credentials by default (show on demand).
* Use HTTPS for API calls to gateway.
* Apply CSRF protections if backend requires.
* Reuse the project’s existing auth token flow; do not store master API keys in localStorage in plaintext — use secure cookies if backend supports.

---

# 13. File mapping recap (final)

```
frontend/
└── src/
    ├── pages/
    │   GatewayList.tsx
    │   GatewayCreate.tsx
    │   GatewayEdit.tsx
    │   GatewayDetail.tsx
    │   GatewaySettings.tsx
    ├── components/
    │   gateway/
    │     ProviderCard.tsx
    │     ProviderForm.tsx
    │     ModelMappingForm.tsx
    │     AdapterConfigEditor.tsx
    │     TestRunModal.tsx
    │     LogsViewer.tsx
    │     ApiKeyManager.tsx
    │     ConfirmDialog.tsx
    ├── lib/
    │   gatewayApi.ts
    │   schemas/
    │     gatewaySchema.ts
    ├── types/
    │   gateway.ts
    ├── hooks/
    │   useProviders.ts   // React Query hooks for CRUD
    └── __tests__/ ...
```

---

# 14. Milestone checklist (ordered, no time estimates)

* M1 — Add `types/` + `lib/gatewayApi.ts` + `hooks/useProviders.ts`. Wire `QueryClientProvider`.
* M2 — Build `GatewayList` + `ProviderCard` and list providers from backend.
* M3 — Implement `ProviderForm` + `GatewayCreate` (create provider flow).
* M4 — Implement `GatewayDetail`, `ModelMappingEditor`, and `TestRunModal` (test invocation UX).
* M5 — Implement `AdapterConfigEditor` with dynamic fields per adapter type + validation.
* M6 — Add logs viewer and streaming/polling support.
* M7 — Tests (unit + e2e), accessibility pass, polish UI/UX.
* M8 — CI, Docker build, production env configuration, docs for integrating with backend.

---

# 15. Deliverables I can produce for you right now (pick any)

* Full React/TypeScript `gatewayApi.ts` + typed `gateway.ts` types.
* A complete `ProviderForm.tsx` (using react-hook-form + zod) that covers all adapter types.
* `GatewayList.tsx` + `ProviderCard.tsx` list implementation with React Query hooks.
* Test skeletons for `ProviderForm` and `GatewayList`.

Which deliverable would you like me to scaffold first? I recommend starting with the API client + `GatewayList` so you can wire real backend data and iterate the forms.
