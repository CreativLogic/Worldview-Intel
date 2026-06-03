# WorldWideView

## What This Is

WorldWideView is a real-time geospatial intelligence engine that visualizes live global data on an interactive 3D globe -- controllable by any AI agent via a production MCP server. Built for power users, researchers, and developers who need a live, plugin-extensible view of the world and want to connect their AI tools directly to it.

## Core Value

A single globe that shows everything happening in the world right now, extensible by anyone via plugins, and controllable by any AI agent via MCP.

## Current State (v1.2 shipped 2026-05-30)

**What shipped in v1.2:**
- Transport-agnostic personal API keys (wwv_prefix.secret bearer tokens)
- Production MCP server at /api/mcp (Streamable HTTP, stateless, Bearer auth)
- ConnectAgentHelper UI for one-copy-paste agent setup
- Globe state MCP resources (globe://state, globe://sessions, globe://layers)
- Globe control tools (pan_globe, focus_entity, toggle_layer, set_timeline) via SSE push
- Data query tools (search_entities, get_entities_in_region, get_entity_details, get_plugin_data)
- Plugin-contributed MCP tools via SDK manifest extension + frontend relay bridge

**Tech stack additions:** ioredis singleton, @modelcontextprotocol/sdk, ReadableStream SSE, Redis ZSET/LIST/SET for state/commands/catalog

## Current Milestone: v1.5 MCP Public-Launch Hardening

**Goal:** Close the premortem blockers so the MCP server is safe and honest to expose to the public -- a robust error contract, abuse-resistant auth, truthful tool responses, real health checks, production wiring, and clear onboarding.

**Target features (Phases 31-36):**
- Transport resilience: well-formed JSON-RPC errors (no bare 500s), DB-outage-safe auth, explicit maxDuration, honest listChanged
- Security and abuse-resistance: dedicated HMAC secret enforcement, Redis-backed per-key rate limiting, trusted-proxy client IP, input/length caps
- Tool honesty: accurate emptyReason, validated ids (no success-on-no-op), honest region coverage, output caps, corrected server instructions
- Observability: /api/health probes Redis + DB + data engine
- Deployment wiring: prod compose Redis + WWV_DATA_ENGINE_URL + global geocoding throttle + infra checklist
- Onboarding and framing: public quickstart, ConnectAgentHelper prerequisites, command tools documented as "requires an open globe session"

**Locked decisions:** command tools keep current behavior (they require a live signed-in browser session to control the globe); a headless/render-on-demand globe is out of scope (deferred).

## Requirements

### Validated (Shipped)

**v1.0 Unified Auth Account System (Phases 1-11, shipped 2026-05-28)**
- Supabase shared-cookie auth federation across worldwideview, marketplace, and web
- OAuth (GitHub, Google) and email+password auth with NextAuth v5
- Shared user identity via `NEXT_PUBLIC_WWV_COOKIE_DOMAIN` across three apps
- JWT session persistence, auth callback redirect fix, linked accounts page
- Legal/privacy compliance (ToS, cookie consent, GDPR data deletion flow)

**v1.1 Plugin Install Auth Gate (Phase 12 shipped 2026-05-28)**
- PluginInstall model + migration + Plugin.installs counter
- Fire-and-forget install tracking upsert in GET /api/install/start

**v1.2 Full MCP Support (Phases 16-21, shipped 2026-05-30)**
- Transport-agnostic API keys with bcrypt storage and timing-oracle prevention - v1.2
- Stateless MCP server (Streamable HTTP) with Bearer auth - v1.2
- ConnectAgentHelper per-client setup UI; secret only in Authorization header - v1.2
- Globe state as MCP resources backed by Redis with heartbeat TTL - v1.2
- Globe command bridge via SSE push (< 100ms latency) - v1.2
- Data query tools across all active plugins - v1.2
- Plugin-contributed namespaced MCP tools via frontend relay - v1.2

**v1.4 Agentic Intelligence (Phases 26-30, shipped 2026-06-02)**
- Server instructions + orientation prompts, 6-component tool description rewrite
- emptyReason response contract, list_available_plugins / get_globe_context / investigate_area, update_favorite CRUD
- Phase 30 LocalDataSource bridge (static/client-side plugins queryable server-side)

### Active (v1.5 MCP Public-Launch Hardening)

- [ ] Transport: top-level JSON-RPC error contract, DB-outage-safe auth, explicit maxDuration, honest listChanged + re-poll docs
- [ ] Security: dedicated API_KEY_HMAC_SECRET enforcement (cloud/demo), Redis-backed per-key rate limiting, trusted-proxy IP, favorites cap + identifier/string length+charset bounds
- [ ] Tool honesty: session-independent emptyReason, validated layer/filter ids + focus_entity wiring, get_entities_in_region count/truncated + tighter bbox, investigate_area/get_plugin_data output caps, corrected MCP_SERVER_INSTRUCTIONS, engine_unreachable vs no_active_plugins
- [ ] Observability: /api/health probes Redis + DB + data engine
- [ ] Deployment: prod compose Redis + REDIS_URL, WWV_DATA_ENGINE_URL REST base, global Nominatim throttle, infra checklist
- [ ] Onboarding: public quickstart doc, ConnectAgentHelper prerequisites, command-tool open-session requirement documented

### Out of Scope

- Embedding an AI chat UI inside the globe -- MCP is server-only
- Browser-side MCP client -- globe is an MCP server target, not client
- Playwright/computer-use globe control -- using SSE command bridge
- Stdio-only MCP transport -- HTTP/SSE for production deployability
- CLI tool -- API + MCP cover v1.2; CLI is additive and non-blocking
- API key scopes/permissions and rotation/grace-period flows -- revisit later
- OAuth 2.1 for MCP auth -- personal API keys sufficient for v1.2
- Headless / render-on-demand globe (v1.5) -- command tools require a live signed-in browser session; building a serverless globe is deferred

## Context

- **Three apps**: worldwideview (Next.js globe), worldwideview-marketplace (plugin store), worldwideview-web (marketing)
- **Auth**: NextAuth v5 + Supabase shared cookies, auth host at worldwideview.dev
- **State**: 9 Zustand slices (globe, layers, timeline, ui, filter, data, config, favorites, geojson)
- **MCP**: Stateless Streamable HTTP at /api/mcp; Redis for state/commands/catalog; 8 tools + 3 resources
- **Data pipeline**: wwv-data-engine (Fastify + Redis) + plugin seeders
- **Plugin SDK**: `@worldwideview/wwv-plugin-sdk` with mcpTools manifest extension

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase shared-cookie auth federation | Single sign-on across 3 Next.js apps | ✓ Good |
| JWT install bridge for plugin installs | Instance-level auth keeps globe secure | ✓ Good |
| HTTP/SSE Streamable HTTP for MCP | Production deployable, any AI client | ✓ Good |
| Redis for all MCP state (no in-process) | Scales to multi-user cloud deployment | ✓ Good |
| SSE push over WebSocket | Zero infra change, App Router native, MCP spec-first | ✓ Good |
| Plugin tools via frontend relay | worldwideview-only, no engine endpoint, composable | ✓ Good |
| Generic transport-agnostic API keys | One bearer key for MCP + future REST | ✓ Good |
| Marketplace tools deferred to v1.3 | Kept v1.2 worldwideview-only; clean scope | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-06-03 after v1.5 milestone start*
