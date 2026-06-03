# Roadmap: WorldWideView

## Milestones

- [x] **v1.2 Full MCP Support** - Phases 16-21 (shipped 2026-05-30) - [archive](milestones/v1.2-ROADMAP.md)
- [x] **v1.3 Location Intelligence** - Phases 22-25 (completed 2026-05-31)
- [x] **v1.4 Agentic Intelligence** - Phases 26-30 (shipped 2026-06-02) - [archive](milestones/v1.4-ROADMAP.md)
- [ ] **v1.5 MCP Public-Launch Hardening** - Phases 31-36 (planning, started 2026-06-03)

## Phases

<details>
<summary>v1.2 Full MCP Support (Phases 16-21) - SHIPPED 2026-05-30</summary>

- [x] Phase 16: API Key Auth Foundation (4/4 plans) - completed 2026-05-29
- [x] Phase 17: MCP Server Foundation (3/3 plans) - completed 2026-05-30
- [x] Phase 18: Globe State Sync + Sessions (4/4 plans + gap-closure) - completed 2026-05-30
- [x] Phase 19a: Globe Command Bridge poll-based (3/3 plans) - completed 2026-05-30
- [x] Phase 19b: SSE Push Transport (2/2 plans) - completed 2026-05-30
- [x] Phase 20: Data Query Tools (4/4 plans) - completed 2026-05-30
- [x] Phase 21: Plugin-Contributed Tools + Quality (5/5 plans) - completed 2026-05-30

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

<details>
<summary>v1.3 Location Intelligence (Phases 22-25) - COMPLETE 2026-05-31</summary>

- [x] **Phase 22: Geocoding + Favorites** - Geocode places, fly the globe, bookmark tracked entities (4/4 plans, verified 2026-05-31)
- [x] **Phase 23: Entity Filtering** - Push live filters to the globe and query plugin-declared filter schemas
- [x] **Phase 24: Route Wiring + Version Bump** - Wire all v1.3 registrars into the MCP handler and ship MCP_SERVER_VERSION 1.3.0
- [x] **Phase 25: Documentation** - MCP tool docs, plugin author filter guide, user-facing capability summary, and v1.3 release notes (1/1 plans, completed 2026-05-31)

</details>

<details>
<summary>v1.4 Agentic Intelligence (Phases 26-30) - SHIPPED 2026-06-02</summary>

- [x] **Phase 26: Server Instructions + Orientation** - Agent arrives oriented with role framing, canonical workflows, and named MCP Prompts baked into the server (completed 2026-05-31)
- [x] **Phase 27: Tool Description Rewrite** - All 15+ existing tools rewritten to the 6-component standard so agents select and invoke them correctly on the first try (completed 2026-05-31)
- [x] **Phase 28: Smart Response Contracts + Favorites CRUD** - Query responses carry semantic empty reasons, get_plugin_filters signals unavailable plugins, and favorites gain full update support (completed 2026-05-31)
- [x] **Phase 29: Compound and Discovery Tools** - Three new tools let agents self-orient and investigate in one call rather than assembling multi-step pipelines manually (completed 2026-05-31)
- [x] **Phase 30: Local Data-Source Bridge** - Server-reachable static/client-side plugins become MCP-queryable via a generalized LocalDataSource registry (4/4 plans, completed 2026-06-02)

Full details: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md)

</details>

### v1.5 MCP Public-Launch Hardening

**Milestone Goal:** Close the premortem blockers so the MCP server is safe and honest to expose to untrusted, authenticated public users -- a robust JSON-RPC error contract, abuse-resistant auth, truthful tool responses, real health checks, production wiring, and clear onboarding.

**Locked decision:** Command/control tools keep current behavior (they require a live signed-in browser session to drive the globe); a headless/render-on-demand globe is out of scope.

- [ ] **Phase 31: Transport Resilience** - Every MCP failure path returns a well-formed JSON-RPC error, auth survives a DB outage, and timeouts/listChanged are honest
- [ ] **Phase 32: Security and Abuse-Resistance** - Dedicated HMAC secret enforcement, Redis-backed per-key rate limiting, trusted-proxy client IP, and input/length/charset caps
- [ ] **Phase 33: Tool Honesty and Agent UX** - Tools report the true reason for empty results, validate ids, bound region/output size, and ship corrected server instructions
- [ ] **Phase 34: Observability** - /api/health actively probes Redis, the database, and the data engine and reports a degraded status when any is down
- [ ] **Phase 35: Deployment Wiring** - Production compose wires Redis + the data-engine REST base, a global geocoder throttle protects Nominatim, and an infra checklist documents operator actions
- [ ] **Phase 36: Onboarding and Framing** - A public quickstart, ConnectAgentHelper prerequisites, and command-tool descriptions make the live-open-session requirement unmissable

## Phase Details

### Phase 31: Transport Resilience
**Goal**: Every MCP failure path -- auth throw, malformed JSON-RPC, tool throw, Redis/DB outage during request handling, or platform timeout -- surfaces to the client as a well-formed JSON-RPC error rather than a bare 500, an empty body, or a non-JSON-RPC truncation
**Depends on**: Phase 30 (v1.4 complete; stable MCP route, authenticateApiKey, plugin-relay blpop bridge)
**Requirements**: TRANS-01, TRANS-02, TRANS-03, TRANS-04
**Success Criteria** (what must be TRUE):
  1. Forcing any failure mode (invalid auth, malformed JSON-RPC body, a tool that throws, Redis/DB down mid-request) returns a well-formed JSON-RPC error object (code -32603, id:null, HTTP 500) with a non-empty body -- never a bare 500 or empty response
  2. With the database unavailable, calling an authenticated MCP endpoint returns a clean 401 (authenticateApiKey resolves to null) instead of throwing an unhandled exception
  3. The MCP route declares an explicit maxDuration greater than the 10s plugin-relay blpop window, so a blocked plugin call still returns a JSON-RPC error rather than a platform-truncated non-JSON-RPC response
  4. The server's advertised capabilities no longer claim tools.listChanged unless the notification is actually emitted, and the server instructions document the stateless "re-call tools/list after enabling plugins" contract
**Plans**: TBD

### Phase 32: Security and Abuse-Resistance
**Goal**: An authenticated but untrusted public user cannot bypass auth hardening, exhaust shared resources, spoof their identity to defeat rate limiting, or smuggle oversized/malformed input through the tool schemas
**Depends on**: Phase 31 (clean error contract in place so rejected/limited requests return well-formed errors)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. In cloud/demo editions the server fails to start when API_KEY_HMAC_SECRET is unset or equal to AUTH_SECRET, while local dev still boots using the AUTH_SECRET fallback
  2. Repeated MCP tool calls from the same userId/key are throttled by a Redis-backed limiter (per-user/per-key, not only per-IP), and an over-limit call returns a clean rate-limit error
  3. A spoofed X-Forwarded-For header cannot reset or bypass the rate limiter -- the client IP is derived only from a trusted-proxy source
  4. Favorites are capped per user, and every identifier/string tool input (entityId, pluginId, layerId, name, notes) is rejected when it exceeds max-length or violates charset bounds, enforced in both the Zod schemas and isValidGlobeCommand
**Plans**: TBD

### Phase 33: Tool Honesty and Agent UX
**Goal**: Every tool response tells the agent the truth -- the real reason a result is empty, whether an id was actually recognized, whether results were truncated -- so an agent never reports a false success or a misleading cause to its user
**Depends on**: Phase 31 (error contract), Phase 32 (validated/bounded inputs so honesty checks operate on sanitized ids)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05
**Success Criteria** (what must be TRUE):
  1. Session-independent data-query tools never return emptyReason "no_session_active"; an empty result reports the true cause -- no_data_matches, engine_unreachable, or no_active_plugins
  2. toggle_layer and set_filter validate the id against the live plugin set and return an explicit "enqueued but id not recognized" warning instead of success-shaped text, and focus_entity resolves entityId to coordinates server-side rather than silently no-op'ing
  3. get_entities_in_region returns a count and a truncated flag, applies tightened radiusKmToBbox bounds, and documents that capped results are an unordered sample
  4. investigate_area and get_plugin_data cap total entity output and set a truncated flag so a single response cannot blow the client's context window
  5. MCP_SERVER_INSTRUCTIONS matches the actual response shapes (emptyReason, {plugins, reason}) and list_available_plugins distinguishes engine_unreachable from no_active_plugins
**Plans**: TBD

### Phase 34: Observability
**Goal**: An operator (or uptime monitor) can tell at a glance whether the MCP server's critical dependencies are healthy, with /api/health actively probing them rather than returning a hardcoded OK
**Depends on**: Phase 31 (shared Redis/DB access patterns and error handling reused by the probes)
**Requirements**: OBS-01
**Success Criteria** (what must be TRUE):
  1. GET /api/health actively probes Redis, the database, and the data-engine manifest on each request rather than returning a static OK
  2. When any one dependency is unreachable, /api/health returns a degraded status identifying which dependency is down, while a fully healthy stack returns a healthy status
**Plans**: TBD

### Phase 35: Deployment Wiring
**Goal**: The production deployment has every dependency the MCP server needs actually provisioned and correctly wired -- Redis, the data-engine REST base, and a protected shared geocoder -- with an operator checklist so a real launch does not silently run on missing infrastructure
**Depends on**: Phase 32 (API_KEY_HMAC_SECRET requirement), Phase 34 (health probes confirm the wired dependencies are reachable)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. The production compose template provisions and wires Redis via REDIS_URL so sessions, the command queue, the geocode cache, and the rate limiters all function in production
  2. WWV_DATA_ENGINE_URL points at the engine REST base (not the NEXT_PUBLIC_.../stream WS URL) in the compose/env templates, so MCP data tools can reach /manifest
  3. A single global Nominatim throttle (<=1 rps) protects the shared geocoder and the geocode cache path is confirmed live in production configuration
  4. An INFRA-CHECKLIST.md documents the exact Coolify actions an operator must apply: managed Redis (rediss://), REDIS_URL, WWV_DATA_ENGINE_URL, and an API_KEY_HMAC_SECRET distinct from AUTH_SECRET
**Plans**: TBD

### Phase 36: Onboarding and Framing
**Goal**: A new public user can go from sign-up to a working MCP connection without hidden prerequisites, and the live-open-session requirement of command tools is stated unmissably everywhere an agent or user encounters it
**Depends on**: Phase 33 (final tool descriptions and instructions stable), Phase 35 (deployment wiring known so the quickstart documents the real path)
**Requirements**: ONBRD-01, ONBRD-02, ONBRD-03
**Success Criteria** (what must be TRUE):
  1. A public quickstart doc walks a brand-new user end to end: sign up, generate an API key, paste the connection JSON, and open the globe tab to reach a working MCP connection
  2. ConnectAgentHelper states the hard prerequisites up front: a signed-in account, a browser tab open for command tools, and cloud edition
  3. Every command-tool description states the live-open-session requirement unmissably, so an agent never attempts a command tool expecting it to work without an open globe session
**Plans**: TBD
**UI hint**: yes

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 22. Geocoding + Favorites | 4/4 | Complete | 2026-05-31 |
| 23. Entity Filtering | 3/3 | Complete | 2026-05-31 |
| 24. Route Wiring + Version Bump | 1/1 | Complete | 2026-05-31 |
| 25. Documentation | 1/1 | Complete | 2026-05-31 |
| 26. Server Instructions + Orientation | 1/1 | Complete | 2026-05-31 |
| 27. Tool Description Rewrite | 3/3 | Complete | 2026-05-31 |
| 28. Smart Response Contracts + Favorites CRUD | 3/3 | Complete | 2026-05-31 |
| 29. Compound and Discovery Tools | 1/1 | Complete | 2026-05-31 |
| 30. Local Data-Source Bridge | 4/4 | Complete | 2026-06-02 |
| 31. Transport Resilience | 0/TBD | Not started | - |
| 32. Security and Abuse-Resistance | 0/TBD | Not started | - |
| 33. Tool Honesty and Agent UX | 0/TBD | Not started | - |
| 34. Observability | 0/TBD | Not started | - |
| 35. Deployment Wiring | 0/TBD | Not started | - |
| 36. Onboarding and Framing | 0/TBD | Not started | - |
