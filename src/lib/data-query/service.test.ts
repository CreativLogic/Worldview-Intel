import {
    describe, it, expect, vi, beforeEach,
} from "vitest";
import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import {
    searchEntities,
    getEntitiesInRegion,
    getEntityDetails,
    getPluginData,
} from "@/lib/data-query/service";

// Module does not exist yet — this file is intentionally RED (Wave 0 TDD scaffold)

global.fetch = vi.fn();

beforeEach(() => {
    vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntity(overrides: Partial<GeoEntity> = {}): GeoEntity {
    return {
        id: "e1",
        pluginId: "test-plugin",
        latitude: 51.5,
        longitude: -0.1,
        timestamp: new Date(),
        properties: {},
        ...overrides,
    };
}

function mockEngineSnapshot(pluginId: string, entities: GeoEntity[]): void {
    vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify({ items: entities }), { status: 200 }),
    );
}

function mockEngine404(): void {
    vi.mocked(global.fetch).mockResolvedValue(
        new Response(null, { status: 404 }),
    );
}

// ---------------------------------------------------------------------------
// QUERY-01 — searchEntities
// ---------------------------------------------------------------------------

describe("searchEntities", () => {
    it("returns [] for empty query string (no fetch called)", async () => {
        const result = await searchEntities("");
        expect(result.entities).toEqual([]);
        expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
    });

    it("returns [] when engine returns 404 for plugin", async () => {
        mockEngine404();
        const result = await searchEntities("london", "test-plugin");
        expect(result.entities).toEqual([]);
        expect(result.emptyReason).toBe("plugin_not_streaming");
    });

    it("returns matching entities for substring match on label", async () => {
        const entity = makeEntity({ id: "e1", label: "London Heathrow", pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await searchEntities("heathrow", "test-plugin");
        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].id).toBe("e1");
    });

    it("match is case-insensitive", async () => {
        const entity = makeEntity({ id: "e2", label: "PARIS CDG", pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await searchEntities("paris", "test-plugin");
        expect(result.entities).toHaveLength(1);
    });

    it("respects limit parameter (returns at most N results)", async () => {
        const entities = Array.from({ length: 10 }, (_, i) =>
            makeEntity({ id: `e${i}`, label: `entity ${i}`, pluginId: "test-plugin" }),
        );
        mockEngineSnapshot("test-plugin", entities);
        const result = await searchEntities("entity", "test-plugin", 3);
        expect(result.entities.length).toBeLessThanOrEqual(3);
    });

    it("restricts to pluginId when provided (fetch URL contains pluginId)", async () => {
        const entity = makeEntity({ id: "e3", label: "item", pluginId: "my-plugin" });
        mockEngineSnapshot("my-plugin", [entity]);
        await searchEntities("item", "my-plugin");
        const calledUrl = String(vi.mocked(global.fetch).mock.calls[0][0]);
        expect(calledUrl).toContain("my-plugin");
    });
});

// ---------------------------------------------------------------------------
// FILT-04 — searchEntities inline filters (on GeoEntity.properties, D-07)
// ---------------------------------------------------------------------------

describe("searchEntities filters", () => {
    it("returns only entities whose properties match the filter", async () => {
        const airborne = makeEntity({ id: "a1", label: "flight a1", pluginId: "flights", properties: { status: "airborne" } });
        const landed = makeEntity({ id: "a2", label: "flight a2", pluginId: "flights", properties: { status: "landed" } });
        mockEngineSnapshot("flights", [airborne, landed]);
        const result = await searchEntities("flight", "flights", 20, {
            status: { type: "select", values: ["airborne"] },
        });
        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].id).toBe("a1");
    });

    it("behaves identically when filters are omitted (no regression)", async () => {
        const e1 = makeEntity({ id: "b1", label: "flight b1", pluginId: "flights", properties: { status: "airborne" } });
        const e2 = makeEntity({ id: "b2", label: "flight b2", pluginId: "flights", properties: { status: "landed" } });
        mockEngineSnapshot("flights", [e1, e2]);
        const result = await searchEntities("flight", "flights", 20);
        expect(result.entities).toHaveLength(2);
    });

    it("excludes an entity missing the filtered property key", async () => {
        const withProp = makeEntity({ id: "c1", label: "flight c1", pluginId: "flights", properties: { status: "airborne" } });
        const missingProp = makeEntity({ id: "c2", label: "flight c2", pluginId: "flights", properties: {} });
        mockEngineSnapshot("flights", [withProp, missingProp]);
        const result = await searchEntities("flight", "flights", 20, {
            status: { type: "select", values: ["airborne"] },
        });
        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].id).toBe("c1");
    });

    it("limit counts only matching entities", async () => {
        const entities = Array.from({ length: 6 }, (_, i) =>
            makeEntity({
                id: `d${i}`,
                label: `flight d${i}`,
                pluginId: "flights",
                properties: { status: i % 2 === 0 ? "airborne" : "landed" },
            }),
        );
        mockEngineSnapshot("flights", entities);
        const result = await searchEntities("flight", "flights", 2, {
            status: { type: "select", values: ["airborne"] },
        });
        expect(result.entities).toHaveLength(2);
        expect(result.entities.every((r) => r.id.startsWith("d"))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// QUERY-02 — getEntitiesInRegion
// ---------------------------------------------------------------------------

describe("getEntitiesInRegion", () => {
    it("returns entities within bounding box", async () => {
        const entity = makeEntity({ id: "e1", latitude: 51.5, longitude: -0.1, pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntitiesInRegion({
            north: 52,
            south: 50,
            east: 1,
            west: -1,
            pluginId: "test-plugin",
        });
        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].id).toBe("e1");
    });

    it("returns [] when no entities in region", async () => {
        const entity = makeEntity({ id: "e1", latitude: 10, longitude: 10, pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntitiesInRegion({
            north: 52,
            south: 50,
            east: 1,
            west: -1,
            pluginId: "test-plugin",
        });
        expect(result.entities).toEqual([]);
        expect(result.emptyReason).toBe("no_data_matches");
    });

    it("handles antimeridian wraparound (east < west): entity at lon 175 inside bounds west:170 east:-170", async () => {
        const entity = makeEntity({ id: "e1", latitude: 0, longitude: 175, pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntitiesInRegion({
            north: 10,
            south: -10,
            east: -170,
            west: 170,
            pluginId: "test-plugin",
        });
        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].id).toBe("e1");
    });

    it("respects pluginId filter", async () => {
        const entity = makeEntity({ id: "e1", latitude: 51.5, longitude: -0.1, pluginId: "specific-plugin" });
        mockEngineSnapshot("specific-plugin", [entity]);
        await getEntitiesInRegion({
            north: 52,
            south: 50,
            east: 1,
            west: -1,
            pluginId: "specific-plugin",
        });
        const calledUrl = String(vi.mocked(global.fetch).mock.calls[0][0]);
        expect(calledUrl).toContain("specific-plugin");
    });
});

// ---------------------------------------------------------------------------
// QUERY-03 — getEntityDetails
// ---------------------------------------------------------------------------

describe("getEntityDetails", () => {
    it("returns DetailResult with all fields when entity found", async () => {
        const props = { speed: 250, airline: "BA" };
        const entity = makeEntity({
            id: "e1",
            pluginId: "test-plugin",
            latitude: 51.5,
            longitude: -0.1,
            label: "BA123",
            properties: props,
        });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntityDetails("test-plugin", "e1");
        expect(result.data).not.toBeNull();
        expect(result.data?.id).toBe("e1");
        expect(result.data?.pluginId).toBe("test-plugin");
        expect(result.data?.latitude).toBe(51.5);
        expect(result.data?.longitude).toBe(-0.1);
        expect(result.data?.label).toBe("BA123");
        expect(result.data?.properties).toEqual(props);
    });

    it("returns plugin_not_streaming when plugin returns 404", async () => {
        mockEngine404();
        const result = await getEntityDetails("test-plugin", "e1");
        expect(result.data).toBeNull();
        expect(result.emptyReason).toBe("plugin_not_streaming");
    });

    it("returns no_data_matches when entityId not in snapshot", async () => {
        const entity = makeEntity({ id: "other-entity", pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntityDetails("test-plugin", "e1");
        expect(result.data).toBeNull();
        expect(result.emptyReason).toBe("no_data_matches");
    });

    it("returned properties includes original entity.properties object", async () => {
        const props = { foo: "bar", nested: { x: 1 } };
        const entity = makeEntity({ id: "e1", pluginId: "test-plugin", properties: props });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntityDetails("test-plugin", "e1");
        expect(result.data?.properties).toEqual(props);
    });
});

// ---------------------------------------------------------------------------
// QUERY-04 — getPluginData
// ---------------------------------------------------------------------------

describe("getPluginData", () => {
    it("returns PluginDataSnapshot with normalized entities when engine returns { items: [...] }", async () => {
        const entity = makeEntity({ id: "e1", pluginId: "test-plugin" });
        vi.mocked(global.fetch).mockResolvedValue(
            new Response(JSON.stringify({ items: [entity] }), { status: 200 }),
        );
        const result = await getPluginData("test-plugin");
        expect(result.data).not.toBeNull();
        expect(result.data?.pluginId).toBe("test-plugin");
        expect(result.data?.entities).toHaveLength(1);
    });

    it("returns PluginDataSnapshot when engine returns flat array []", async () => {
        const entity = makeEntity({ id: "e1", pluginId: "test-plugin" });
        vi.mocked(global.fetch).mockResolvedValue(
            new Response(JSON.stringify([entity]), { status: 200 }),
        );
        const result = await getPluginData("test-plugin");
        expect(result.data).not.toBeNull();
        expect(result.data?.entities).toHaveLength(1);
    });

    it("returns plugin_not_streaming on engine 404", async () => {
        mockEngine404();
        const result = await getPluginData("missing-plugin");
        expect(result.data).toBeNull();
        expect(result.emptyReason).toBe("plugin_not_streaming");
    });

    it("returns plugin_not_streaming on engine non-2xx (500)", async () => {
        vi.mocked(global.fetch).mockResolvedValue(
            new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
        );
        const result = await getPluginData("test-plugin");
        expect(result.data).toBeNull();
        expect(result.emptyReason).toBe("plugin_not_streaming");
    });

    it("normalizes timestamp string to Date object", async () => {
        const entityWithStringTimestamp = {
            ...makeEntity({ id: "e1", pluginId: "test-plugin" }),
            timestamp: "2026-05-29T10:00:00Z",
        };
        vi.mocked(global.fetch).mockResolvedValue(
            new Response(JSON.stringify({ items: [entityWithStringTimestamp] }), { status: 200 }),
        );
        const result = await getPluginData("test-plugin");
        expect(result.data?.entities[0].timestamp).toBeInstanceOf(Date);
    });
});
