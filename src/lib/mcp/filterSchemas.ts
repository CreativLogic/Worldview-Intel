/**
 * Shared Zod filter-value schema for MCP tool input validation.
 *
 * A strict discriminated union on `type` so structurally invalid filter values
 * are rejected at the tool boundary (T-23-01-02 tampering mitigation). Reused by
 * filterTools.ts (set_filter) and search_entities in tools.ts.
 */

import { z } from "zod";

export const filterValueSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), value: z.string() }),
    z.object({ type: z.literal("select"), values: z.array(z.string()) }),
    z.object({ type: z.literal("range"), min: z.number(), max: z.number() }),
    z.object({ type: z.literal("boolean"), value: z.boolean() }),
]);
