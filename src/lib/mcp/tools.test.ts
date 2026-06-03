import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/data-query/service");
vi.mock("@/lib/globeCommandQueue");

import { registerDataQueryTools } from "./tools";
import {
    searchEntities,
    getEntitiesInRegion,
    getPluginData,
} from "@/lib/data-query/service";
import { resolveActiveSessionId } from "@/lib/globeCommandQueue";

const mockSearchEntities = vi.mocked(searchEntities);
const mockGetEntitiesInRegion = vi.mocked(getEntitiesInRegion);
const mockGetPluginData = vi.mocked(getPluginData);
const mockResolveActiveSessionId = vi.mocked(resolveActiveSessionId);

const schemas: Record<string, unknown> = {};
const handlers: Record<string, (args: unknown) => Promise<unknown>> = {};
const mockServer = {
    registerTool: vi.fn((name: string, schema: { description: string }, handler: (args: unknown) => Promise<unknown>) => {
        schemas[name] = schema;
        handlers[name] = handler;
    }),
};

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(schemas).forEach((k) => delete schemas[k]);
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    registerDataQueryTools(mockServer as never, { userId: "test-user" });
});

describe("data query tool descriptions (DESC-02)", () => {
    const QUERY_TOOLS = [
        "search_entities",
        "get_entities_in_region",
        "get_entity_details",
        "get_plugin_data",
    ];

    it.each(QUERY_TOOLS)("%s: description is non-empty and within 1024-char hard cap", (name) => {
        const schema = schemas[name] as { description: string };
        expect(schema).toBeDefined();
        expect(schema.description.length).toBeGreaterThan(0);
        expect(schema.description.length).toBeLessThanOrEqual(1024);
    });

    it.each(QUERY_TOOLS)("%s: description includes tools/list precondition", (name) => {
        const schema = schemas[name] as { description: string };
        expect(schema.description).toContain("tools/list");
    });

    it.each(QUERY_TOOLS)("%s: description soft-references emptyReason", (name) => {
        const schema = schemas[name] as { description: string };
        expect(schema.description).toContain("emptyReason");
    });

    it.each(QUERY_TOOLS)("%s: description ends with an Example: call", (name) => {
        const schema = schemas[name] as { description: string };
        expect(schema.description).toContain("Example:");
    });

    it.each(QUERY_TOOLS)("%s: description distinguishes plugin-not-loaded from no-entities-matched", (name) => {
        const schema = schemas[name] as { description: string };
        // Must name BOTH empty-result causes explicitly
        const notLoaded = schema.description.includes("plugin not loaded") || schema.description.includes("not streaming");
        const noMatch =
            schema.description.includes("no entities matched") ||
            schema.description.includes("no match") ||
            schema.description.includes("nothing matched");
        expect(notLoaded).toBe(true);
        expect(noMatch).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// RESP-01 -- emptyReason branch tests for search_entities
// ---------------------------------------------------------------------------

function parseResult(raw: unknown): Record<string, unknown> {
    const content = (raw as { content: Array<{ text: string }> }).content;
    return JSON.parse(content[0].text) as Record<string, unknown>;
}

describe("search_entities emptyReason (RESP-01)", () => {
    it("returns emptyReason plugin_not_streaming when plugin absent (snapshot null)", async () => {
        mockSearchEntities.mockResolvedValue({ entities: [], emptyReason: "plugin_not_streaming" });
        // Active session present -- session check passes, service reason wins
        mockResolveActiveSessionId.mockResolvedValue("sess-abc");

        const result = await handlers["search_entities"]({ query: "test", pluginId: "missing-plugin" });
        const body = parseResult(result);

        expect(body.success).toBe(true);
        expect(body.count).toBe(0);
        expect(body.emptyReason).toBe("plugin_not_streaming");
    });

    it("returns emptyReason no_data_matches when plugin streaming but 0 entities match", async () => {
        mockSearchEntities.mockResolvedValue({ entities: [], emptyReason: "no_data_matches" });
        mockResolveActiveSessionId.mockResolvedValue("sess-abc");

        const result = await handlers["search_entities"]({ query: "xyz", pluginId: "flights" });
        const body = parseResult(result);

        expect(body.success).toBe(true);
        expect(body.count).toBe(0);
        expect(body.emptyReason).toBe("no_data_matches");
    });

    it("returns the TRUE service reason (plugin_not_streaming) even when no active session (TOOL-01)", async () => {
        // TOOL-01: data-query tools must NEVER return no_session_active because they do
        // not require a browser session. The true service reason must propagate regardless.
        mockSearchEntities.mockResolvedValue({ entities: [], emptyReason: "plugin_not_streaming" });
        // No active session -- must NOT override the service reason for data-query tools.
        mockResolveActiveSessionId.mockResolvedValue(null);

        const result = await handlers["search_entities"]({ query: "test", pluginId: "flights" });
        const body = parseResult(result);

        expect(body.success).toBe(true);
        expect(body.count).toBe(0);
        // The true reason must be returned, not no_session_active.
        expect(body.emptyReason).toBe("plugin_not_streaming");
    });

    it("returns no_data_matches when service emptyReason is absent and session is missing (TOOL-01)", async () => {
        // A data-query tool with undefined serviceReason and no session must default
        // to no_data_matches, not no_session_active.
        mockSearchEntities.mockResolvedValue({ entities: [], emptyReason: undefined });
        mockResolveActiveSessionId.mockResolvedValue(null);

        const result = await handlers["search_entities"]({ query: "empty", pluginId: "flights" });
        const body = parseResult(result);

        expect(body.emptyReason).toBe("no_data_matches");
        expect(body.emptyReason).not.toBe("no_session_active");
    });

    it("does NOT include emptyReason in envelope when results are non-empty", async () => {
        mockSearchEntities.mockResolvedValue({
            entities: [{ id: "e1", pluginId: "flights", latitude: 51, longitude: -0.1 }],
        });
        mockResolveActiveSessionId.mockResolvedValue("sess-abc");

        const result = await handlers["search_entities"]({ query: "flight" });
        const body = parseResult(result);

        expect(body.success).toBe(true);
        expect(body.count).toBe(1);
        expect(Object.prototype.hasOwnProperty.call(body, "emptyReason")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// TOOL-03 -- get_entities_in_region count, truncated, totalMatched
// ---------------------------------------------------------------------------

describe("get_entities_in_region count/truncated (TOOL-03)", () => {
    const makeEntity = (id: string) => ({ id, pluginId: "quakes", latitude: 10, longitude: 20 });

    it("returns count and no truncated flag when result fits in cap", async () => {
        const entities = [makeEntity("e1"), makeEntity("e2")];
        mockGetEntitiesInRegion.mockResolvedValue({ entities });

        const result = await handlers["get_entities_in_region"]({
            north: 20, south: 0, east: 30, west: 10,
        });
        const body = parseResult(result);

        expect(body.count).toBe(2);
        expect(Object.prototype.hasOwnProperty.call(body, "truncated")).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(body, "totalMatched")).toBe(false);
    });

    it("returns truncated:true and totalMatched when service signals truncation", async () => {
        const entities = Array.from({ length: 100 }, (_, i) => makeEntity(`e${i}`));
        mockGetEntitiesInRegion.mockResolvedValue({ entities, totalMatched: 350 });

        const result = await handlers["get_entities_in_region"]({
            north: 20, south: 0, east: 30, west: 10,
        });
        const body = parseResult(result);

        expect(body.count).toBe(100);
        expect(body.truncated).toBe(true);
        expect(body.totalMatched).toBe(350);
    });

    it("returns emptyReason no_data_matches (not no_session_active) when no session (TOOL-01)", async () => {
        mockGetEntitiesInRegion.mockResolvedValue({ entities: [], emptyReason: "no_data_matches" });
        mockResolveActiveSessionId.mockResolvedValue(null);

        const result = await handlers["get_entities_in_region"]({
            north: 20, south: 0, east: 30, west: 10,
        });
        const body = parseResult(result);

        expect(body.emptyReason).toBe("no_data_matches");
        expect(body.emptyReason).not.toBe("no_session_active");
    });
});

// ---------------------------------------------------------------------------
// TOOL-04 -- get_plugin_data cap and truncation
// ---------------------------------------------------------------------------

describe("get_plugin_data cap and truncation (TOOL-04)", () => {
    it("returns all entities when below cap", async () => {
        const entities = Array.from({ length: 50 }, (_, i) => ({
            id: `e${i}`, pluginId: "quakes", latitude: 0, longitude: 0, timestamp: new Date(), properties: {},
        }));
        mockGetPluginData.mockResolvedValue({ data: { pluginId: "quakes", entities, timestamp: new Date() } });

        const result = await handlers["get_plugin_data"]({ pluginId: "quakes" });
        const body = parseResult(result);

        expect(body.count).toBe(50);
        expect(Object.prototype.hasOwnProperty.call(body, "truncated")).toBe(false);
    });

    it("truncates to 200 and sets truncated:true when snapshot exceeds cap", async () => {
        const entities = Array.from({ length: 250 }, (_, i) => ({
            id: `e${i}`, pluginId: "quakes", latitude: 0, longitude: 0, timestamp: new Date(), properties: {},
        }));
        mockGetPluginData.mockResolvedValue({ data: { pluginId: "quakes", entities, timestamp: new Date() } });

        const result = await handlers["get_plugin_data"]({ pluginId: "quakes" });
        const body = parseResult(result);

        expect(body.count).toBe(200);
        expect(body.truncated).toBe(true);
        expect(body.totalMatched).toBe(250);
    });

    it("returns emptyReason plugin_not_streaming (not no_session_active) when no session (TOOL-01)", async () => {
        mockGetPluginData.mockResolvedValue({ data: null, emptyReason: "plugin_not_streaming" });
        mockResolveActiveSessionId.mockResolvedValue(null);

        const result = await handlers["get_plugin_data"]({ pluginId: "missing" });
        const body = parseResult(result);

        expect(body.emptyReason).toBe("plugin_not_streaming");
        expect(body.emptyReason).not.toBe("no_session_active");
    });
});
