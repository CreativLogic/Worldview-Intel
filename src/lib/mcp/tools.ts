/**
 * MCP Data Query Tool registrar (Phase 20 Wave 3 — 20-04).
 *
 * Registers four read-only MCP tools that expose the data-query service to
 * MCP clients. These tools operate on shared engine data and do not require
 * a userId — unlike the globe resource registrar, they are not scoped to a
 * specific authenticated user.
 *
 *   TOOL-01  search_entities         — full-text search across active plugins
 *   TOOL-02  get_entities_in_region  — bounding-box spatial query
 *   TOOL-03  get_entity_details      — single entity lookup by pluginId + entityId
 *   TOOL-04  get_plugin_data         — full snapshot for a named plugin
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { latSchema, lonSchema } from "@/lib/mcp/coordinateSchemas";
import { filterValueSchema } from "@/lib/mcp/filterSchemas";
import {
    searchEntities,
    getEntitiesInRegion,
    getEntityDetails,
    getPluginData,
} from "@/lib/data-query/service";

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

/** Produces the standard MCP tool error response shape. */
function toolError(msg: string): { content: [{ type: "text"; text: string }] } {
    return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }] };
}

// ---------------------------------------------------------------------------
// Public registrar
// ---------------------------------------------------------------------------

export function registerDataQueryTools(server: McpServer): void {
    // TOOL-01: search_entities
    server.registerTool(
        "search_entities",
        {
            description:
                "Full-text search for geospatial entities by name across active plugins. Use when you need entities matching a keyword. Limitation: an empty result (count 0) has two distinct causes -- plugin not loaded or not streaming yet (re-call tools/list after the plugin loads), OR no entities matched the query; a future emptyReason field will distinguish these. Returns up to 20 results (id, name, lat, lon, pluginId). Optional 'filters' apply inline property filters independent of set_filter state. Example: search_entities({ query: 'flight', pluginId: 'flights' })",
            inputSchema: {
                query: z.string().describe("Search query string"),
                pluginId: z.string().optional().describe("Restrict search to a specific plugin"),
                limit: z.number().optional().describe("Maximum results to return (max 20)"),
                filters: z
                    .record(z.string(), filterValueSchema)
                    .optional()
                    .describe("Optional inline filters keyed by entity property key (e.g. { status: { type: 'select', values: ['airborne'] } }). Independent of set_filter state."),
            },
        },
        async (input) => {
            try {
                const results = await searchEntities(
                    input.query,
                    input.pluginId,
                    Math.min(input.limit ?? 20, 20),
                    input.filters,
                );
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, entities: results, count: results.length }),
                        },
                    ],
                };
            } catch (err) {
                console.error("[mcp/tools] search_entities failed:", err);
                return toolError("Failed to search entities");
            }
        },
    );

    // TOOL-02: get_entities_in_region
    server.registerTool(
        "get_entities_in_region",
        {
            description:
                "Spatial query returning entities within a bounding box (north/south/east/west lat-lon bounds). Use when you need entities in a geographic area. Limitation: an empty result (count 0) has two distinct causes -- plugin not loaded or not streaming yet (re-call tools/list after the plugin loads), OR no entities matched the region; a future emptyReason field will distinguish these. Returns up to 100 results. Example: get_entities_in_region({ north: 52, south: 51, east: 0, west: -1, pluginId: 'flights' })",
            inputSchema: {
                north: latSchema.describe("Northern latitude bound"),
                south: latSchema.describe("Southern latitude bound"),
                east: lonSchema.describe("Eastern longitude bound"),
                west: lonSchema.describe("Western longitude bound"),
                pluginId: z.string().optional().describe("Restrict to a specific plugin"),
                limit: z.number().optional().describe("Maximum results to return (max 100)"),
            },
        },
        async (input) => {
            try {
                const results = await getEntitiesInRegion({
                    north: input.north,
                    south: input.south,
                    east: input.east,
                    west: input.west,
                    pluginId: input.pluginId,
                    limit: Math.min(input.limit ?? 100, 100),
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, entities: results, count: results.length }),
                        },
                    ],
                };
            } catch (err) {
                console.error("[mcp/tools] get_entities_in_region failed:", err);
                return toolError("Failed to get entities in region");
            }
        },
    );

    // TOOL-03: get_entity_details
    server.registerTool(
        "get_entity_details",
        {
            description:
                "Single entity lookup returning full detail by pluginId + entityId. Use after search_entities or get_entities_in_region to retrieve complete properties for one entity. Limitation: plugin not loaded or not streaming yet means the entity will not be found even if it exists -- re-call tools/list after the plugin loads; no entities matched returns an error string (not a success envelope); a future emptyReason field will clarify load state. Example: get_entity_details({ pluginId: 'flights', entityId: 'BA123' })",
            inputSchema: {
                pluginId: z.string().describe("The plugin that owns this entity"),
                entityId: z.string().describe("The entity identifier"),
            },
        },
        async (input) => {
            try {
                const detail = await getEntityDetails(input.pluginId, input.entityId);
                if (detail === null) {
                    return toolError("Entity not found");
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, entity: detail }),
                        },
                    ],
                };
            } catch (err) {
                console.error("[mcp/tools] get_entity_details failed:", err);
                return toolError("Failed to get entity details");
            }
        },
    );

    // TOOL-04: get_plugin_data
    server.registerTool(
        "get_plugin_data",
        {
            description:
                "Full data snapshot returning all current entities for one plugin by pluginId. Use to bulk-read a plugin's live state. Limitation: an empty result (count 0) has two distinct causes -- plugin not loaded or not streaming yet (re-call tools/list after the plugin loads), OR no entities matched (plugin loaded but empty); a future emptyReason field will distinguish these. Includes capturedAt timestamp. Example: get_plugin_data({ pluginId: 'earthquakes' })",
            inputSchema: {
                pluginId: z.string().describe("The plugin identifier"),
            },
        },
        async (input) => {
            try {
                const snapshot = await getPluginData(input.pluginId);
                if (snapshot === null) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ success: true, entities: [], count: 0 }),
                            },
                        ],
                    };
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                entities: snapshot.entities ?? [],
                                count: snapshot.entities?.length ?? 0,
                                capturedAt: snapshot.timestamp,
                            }),
                        },
                    ],
                };
            } catch (err) {
                console.error("[mcp/tools] get_plugin_data failed:", err);
                return toolError("Failed to get plugin data");
            }
        },
    );
}
