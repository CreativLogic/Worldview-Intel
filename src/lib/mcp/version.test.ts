/**
 * Phase 24 (INTG-01 + INTG-02) verification.
 *
 * Locks two contracts for the v1.3 MCP surface:
 *   1. The MCP protocol server advertises version "1.3.0" (INTG-02). This is
 *      the serverInfo.version returned on every initialize handshake. It is the
 *      protocol server version, NOT package.json semver.
 *   2. All 8 v1.3 tools register and reach tools/list, and search_entities still
 *      exposes its optional `filters` param (INTG-01).
 *
 * The registrars run synchronously and only call server.registerTool(name,
 * schema, handler) at registration time, so a stub server captures the full
 * tool surface without a live transport. External deps are mocked so import +
 * registration never touch Nominatim, Redis, or Prisma.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/nominatim");
vi.mock("@/lib/geocodingRateLimit");
vi.mock("@/lib/globeCommandQueue");
vi.mock("@/lib/mcpSessionCatalog");
vi.mock("@/lib/prisma");
vi.mock("@/lib/globeStateStore");
vi.mock("@/lib/data-query/service");

import { MCP_SERVER_VERSION, createMcpServer } from "./server";
import { registerDataQueryTools } from "./tools";
import { registerGeocodingTools } from "@/app/api/mcp/geocodingTools";
import { registerFavoritesTools } from "@/app/api/mcp/favoritesTools";
import { registerFilterTools } from "@/app/api/mcp/filterTools";

// ---------------------------------------------------------------------------
// INTG-02: protocol server version
// ---------------------------------------------------------------------------

describe("MCP server version (INTG-02)", () => {
    it("advertises protocol server version 1.3.0", () => {
        expect(MCP_SERVER_VERSION).toBe("1.3.0");
    });

    it("createMcpServer() does not throw and is a fresh instance per call", () => {
        const a = createMcpServer();
        const b = createMcpServer();
        expect(a).toBeDefined();
        expect(b).toBeDefined();
        expect(a).not.toBe(b);
    });
});

// ---------------------------------------------------------------------------
// INTG-01: v1.3 tool surface
// ---------------------------------------------------------------------------

const schemas: Record<string, { inputSchema?: Record<string, unknown> }> = {};
const stubServer = {
    registerTool: vi.fn(
        (name: string, schema: { inputSchema?: Record<string, unknown> }) => {
            schemas[name] = schema;
        },
    ),
};

const ctx = { userId: "u1" };

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(schemas).forEach((k) => delete schemas[k]);
    registerDataQueryTools(stubServer as never, ctx);
    registerGeocodingTools(stubServer as never, ctx);
    registerFavoritesTools(stubServer as never, ctx);
    registerFilterTools(stubServer as never, ctx);
});

describe("v1.3 tool registration (INTG-01)", () => {
    const v13Tools = [
        "geocode_location",
        "fly_to",
        "save_favorite",
        "list_favorites",
        "remove_favorite",
        "set_filter",
        "clear_filter",
        "get_plugin_filters",
    ];

    it.each(v13Tools)("registers the %s tool", (name) => {
        expect(Object.keys(schemas)).toContain(name);
    });

    it("registers all 8 v1.3 tools", () => {
        for (const name of v13Tools) {
            expect(schemas[name]).toBeDefined();
        }
    });

    it("search_entities exposes the optional filters param in its input schema", () => {
        expect(schemas["search_entities"]).toBeDefined();
        expect(schemas["search_entities"].inputSchema).toHaveProperty("filters");
    });
});
