import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/data-query/service");

import { registerDataQueryTools } from "./tools";

const schemas: Record<string, unknown> = {};
const mockServer = {
    registerTool: vi.fn((name: string, schema: { description: string }, _handler: unknown) => {
        schemas[name] = schema;
    }),
};

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(schemas).forEach((k) => delete schemas[k]);
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
