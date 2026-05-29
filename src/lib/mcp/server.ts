/**
 * MCP server factory — Phase 17 (Stateless Streamable HTTP transport)
 *
 * createMcpServer() returns a FRESH McpServer instance on every call.
 * It is the single aggregation point where future phases register their
 * capabilities:
 *
 *   Phase 18 — registerGlobeResources(server, { userId })   → globe:// resources
 *   Phase 19 — registerGlobeCommandTools(server, { userId }) → globe control tools
 *   Phase 20 — registerDataQueryTools(server, { userId })    → data query tools
 *   Phase 21 — dynamic per-plugin tools merged into tools/list
 *
 * Those registrars are NOT called here — Phase 17 ships the transport only.
 * Each feature phase calls its own registrar from src/app/api/mcp/route.ts
 * AFTER createMcpServer() returns, passing { userId } via closure injection
 * (per RECONCILIATION R-1).
 *
 * Stateless invariant (D-17-04): never cache this instance. A fresh server
 * is created per request so no session state or transport binding leaks
 * between concurrent requests.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Read the server version from the environment at module load so the factory
// stays pure (no I/O). The NEXT_PUBLIC_ prefix makes it available server-side
// and client-side, but only server-side code ever calls this factory.
const SERVER_NAME = "worldwideview" as const;
// package.json version is inlined by Next.js build (process.env.npm_package_version)
// or falls back to a safe default so the factory never throws.
const SERVER_VERSION: string =
    (process.env.npm_package_version ?? "0.0.0");

/**
 * Returns a fresh, empty-capability McpServer per call.
 *
 * Phase 17 registers NO tools and NO resources — the server advertises
 * `tools: { listChanged: true }` (required by Phase 21, RECONCILIATION R-1)
 * but `tools/list` returns [] until future phases register tools/resources.
 *
 * STATELESS (D-17-04): never cache this instance; a fresh server is created
 * per request. Do NOT hoist the return value to module scope.
 */
export function createMcpServer(): McpServer {
    return new McpServer(
        { name: SERVER_NAME, version: SERVER_VERSION },
        {
            capabilities: {
                // tools.listChanged: required so Phase 21 can push live tool
                // list updates to clients (RECONCILIATION R-1).
                tools: { listChanged: true },
            },
        },
    );
}
