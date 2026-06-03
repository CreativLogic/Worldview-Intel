# Requirements: WorldWideView -- v1.5 MCP Public-Launch Hardening

**Defined:** 2026-06-03
**Core Value:** A single globe that shows everything happening in the world right now, extensible by anyone via plugins, and controllable by any AI agent via MCP.

Derived from the public-launch premortem. Closes the blockers that make the MCP server unsafe or dishonest to expose to untrusted, authenticated public users.

## v1 Requirements

### Transport Resilience (Phase 31)

- [x] **TRANS-01**: Every MCP failure path (auth throw, malformed JSON-RPC, tool throw, Redis/DB down during request handling) returns a well-formed JSON-RPC error (-32603, id:null, HTTP 500) instead of a bare 500 / empty body.
- [x] **TRANS-02**: A database outage during API-key auth returns a clean 401 (authenticateApiKey returns null) rather than throwing.
- [x] **TRANS-03**: The MCP route declares an explicit maxDuration above the 10s plugin-relay blpop so platform timeouts never truncate a blocked plugin call into a non-JSON-RPC error.
- [x] **TRANS-04**: The server no longer advertises tools.listChanged unless it emits the notification; the stateless "re-call tools/list after enabling plugins" contract is documented in the server instructions.

### Security and Abuse-Resistance (Phase 32)

- [x] **SEC-01**: In cloud/demo editions the server requires a dedicated API_KEY_HMAC_SECRET and fails startup if it is unset or equal to AUTH_SECRET; local dev preserves the AUTH_SECRET fallback.
- [x] **SEC-02**: MCP tool calls are rate-limited per-userId/per-key via Redis (not only per-IP).
- [x] **SEC-03**: Client IP is derived from a trusted-proxy source so rate limiters cannot be bypassed via a spoofed X-Forwarded-For header.
- [x] **SEC-04**: Favorites are capped per user and all identifier/string tool inputs (entityId, pluginId, layerId, name, notes) have max-length and charset bounds in the Zod schemas and in isValidGlobeCommand.

### Tool Honesty and Agent UX (Phase 33)

- [x] **TOOL-01**: Session-independent data-query tools never report emptyReason "no_session_active"; they return the true reason (no_data_matches, engine_unreachable, or no_active_plugins).
- [x] **TOOL-02**: toggle_layer and set_filter validate the id against the live plugin set and return an explicit "enqueued but id not recognized" warning instead of success-shaped text; focus_entity resolves entityId to coordinates server-side.
- [x] **TOOL-03**: get_entities_in_region returns count and a truncated flag, tightens the radiusKmToBbox bounds, and documents that capped results are an unordered sample.
- [x] **TOOL-04**: investigate_area and get_plugin_data cap total entity output and set a truncated flag so a single response cannot blow client context.
- [x] **TOOL-05**: MCP_SERVER_INSTRUCTIONS matches the actual response shapes (emptyReason, {plugins, reason}), and list_available_plugins distinguishes engine_unreachable from no_active_plugins.

### Observability (Phase 34)

- [x] **OBS-01**: /api/health actively probes Redis, the database, and the data-engine manifest, returning a degraded status when any dependency is down.

### Deployment Wiring (Phase 35)

- [x] **DEPLOY-01**: The production compose template provisions/wires Redis via REDIS_URL so sessions, command queue, geocode cache, and rate limiters work in production.
- [x] **DEPLOY-02**: WWV_DATA_ENGINE_URL is set to the engine REST base (not the NEXT_PUBLIC_.../stream WS URL) in compose/env templates so MCP data tools reach /manifest.
- [x] **DEPLOY-03**: A single global Nominatim throttle (<=1 rps) protects the shared geocoder, and the geocode cache path is confirmed live.
- [x] **DEPLOY-04**: An INFRA-CHECKLIST.md documents the Coolify actions the operator must apply (managed Redis rediss://, REDIS_URL, WWV_DATA_ENGINE_URL, API_KEY_HMAC_SECRET distinct from AUTH_SECRET).

### Onboarding and Framing (Phase 36)

- [x] **ONBRD-01**: A public quickstart doc walks a new user from sign-up to a working MCP connection (generate key, paste JSON, open the globe tab).
- [x] **ONBRD-02**: ConnectAgentHelper states the hard prerequisites: signed-in account, a browser tab open for command tools, cloud edition.
- [x] **ONBRD-03**: Every command-tool description states the live-open-session requirement unmissably.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Headless / render-on-demand globe | Command tools require a live signed-in browser session; building a serverless globe is a large effort, deferred. Command tools keep current behavior. |
| API key scopes / rotation flows | Carried over from prior milestones; not a public-launch blocker. |
| Self-hosted geocoder | Global throttle is sufficient for launch; self-hosting Nominatim is a later option. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRANS-01 | Phase 31 | Done |
| TRANS-02 | Phase 31 | Done |
| TRANS-03 | Phase 31 | Done |
| TRANS-04 | Phase 31 | Done |
| SEC-01 | Phase 32 | Done |
| SEC-02 | Phase 32 | Done |
| SEC-03 | Phase 32 | Done |
| SEC-04 | Phase 32 | Done |
| TOOL-01 | Phase 33 | Done |
| TOOL-02 | Phase 33 | Done |
| TOOL-03 | Phase 33 | Done |
| TOOL-04 | Phase 33 | Done |
| TOOL-05 | Phase 33 | Done |
| OBS-01 | Phase 34 | Done |
| DEPLOY-01 | Phase 35 | Done |
| DEPLOY-02 | Phase 35 | Done |
| DEPLOY-03 | Phase 35 | Done |
| DEPLOY-04 | Phase 35 | Done |
| ONBRD-01 | Phase 36 | Done |
| ONBRD-02 | Phase 36 | Done |
| ONBRD-03 | Phase 36 | Done |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-03 after v1.5 milestone start*
