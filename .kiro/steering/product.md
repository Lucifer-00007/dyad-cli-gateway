# Product Overview

## Dyad CLI Gateway

A pluggable, OpenAI-compatible gateway that enables Dyad (or any OpenAI-compatible client) to communicate with CLI agents, local model servers, and vendor SDKs through a unified `/v1` API surface.

### Core Purpose
- **Protocol Translation**: Converts OpenAI-style requests into calls to various adapter types (CLI spawning, HTTP SDKs, proxies, local models)
- **Unified Interface**: Exposes standard OpenAI endpoints (`/v1/chat/completions`, `/v1/models`, `/v1/embeddings`) for seamless integration
- **Provider Management**: Admin system for registering and configuring different AI providers and model mappings
- **Security & Sandboxing**: Safe execution of CLI agents with containerized sandboxing options

### Architecture
- **Backend-first design**: Core gateway functionality in Node.js/Express with MongoDB persistence
- **Frontend admin UI**: React/TypeScript interface for provider management (optional, can be added later)
- **Adapter pattern**: Pluggable system supporting spawn-cli, http-sdk, proxy, and local model adapters
- **OpenAI compatibility**: Drop-in replacement for OpenAI API endpoints

### Key Features
- Pluggable adapter system for different AI providers
- Provider registry with MongoDB persistence
- Admin API for CRUD operations on providers
- Optional streaming support
- Dockerized deployment
- Security-focused with API key authentication and sandboxed execution