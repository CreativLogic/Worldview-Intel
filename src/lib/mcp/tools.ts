/**
 * MCP Data Query Tool registrar (Phase 20 Wave 3 -- 20-04).
 *
 * Registers four read-only MCP tools that expose the data-query service to
 * MCP clients. Phase 28 (28-01): emptyReason discrimination added.
 * Phase 33 (TOOL-01): data-query tools never return no_session_active because
 * they do not require a browser session.
 *
 *   TOOL-01  search_entities         -- full-text search across active plugins
 *   TOOL-02  get_entities_in_region  -- bounding-box spatial query
 *   TOOL-03  get_entity_details      -- single entity lookup by pluginId + entityId
 *   TOOL-04  get_plugin_data         -- full snapshot for a named plugin (cap 200)
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
import type { EmptyReason } from "@/lib/data-query/types";

/** Maximum entities returned by get_plugin_data in a single response (TOOL-04). */
const GET_PLUGIN_DATA_CAP = 200;

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

/** Produces the standard MCP tool error response shape. */
function toolError(msg: string): { content: [{ type: "text"; text: string }] } {
    return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }] };
}

/**
 * Returns the emptyReason for data-query tools.
 *
 * Data-query tools run server-side and do NOT require a browser session.
 * They must NEVER return no_session_active. The service layer returns the
 * true reason (plugin_not_streaming or no_data_matches); this function
 * provides a safe default when the service omits it.
 */
function resolveDataQueryEmptyReason(serviceReason: EmptyReason | undefined): EmptyReason {
    return serviceReason ?? "no_data_matches";
}

// ---------------------------------------------------------------------------
// Public registrar
// ---------------------------------------------------------------------------

export function registerDataQueryTools(server: McpServer, _ctx: { userId: string }): void {
    // TOOL-01: search_entities
    server.registerTool(
        "search_entities",
        {
            description:
                "Full-text search for geospatial entities by name across active plugins. " +
                "This is a READ-ONLY data tool -- it does NOT require an active globe session. " +
                "Before calling, verify the plugin is active via tools/list. " +
                "Returns emptyReason on empty results: 'plugin_not_streaming' (plugin not loaded or not streaming), 'no_data_matches' (query ran but nothing matched). " +
                "Returns up to 20 results (id, name, lat, lon, pluginId). Optional 'filters' apply inline property filters independent of set_filter state. " +
                "Example: search_entities({ query: 'flight', pluginId: 'flights' })",
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
                const result = await searchEntities(
                    input.query,
                    input.pluginId,
                    Math.min(input.limit ?? 20, 20),
                    input.filters,
                );
                if (result.entities.length === 0) {
                    const emptyReason = resolveDataQueryEmptyReason(result.emptyReason);
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ success: true, entities: [], count: 0, emptyReason }),
                            },
                        ],
                    };
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, entities: result.entities, count: result.entities.length }),
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
                "Spatial query returning entities within a bounding box (north/south/east/west lat-lon bounds). " +
                "This is a READ-ONLY data tool -- it does NOT require an active globe session. " +
                "Before calling, verify the plugin is active via tools/list. " +
                "Returns emptyReason on empty results: 'plugin_not_streaming' (plugin not loaded or not streaming), 'no_data_matches' (no entities matched the region). " +
                "Returns up to 100 results per call. IMPORTANT: when 'truncated' is true the returned list is an UNORDERED SAMPLE (not nearest-first). " +
                "Check 'count' (returned) and 'totalMatched' (total in region, when truncated) to understand coverage. " +
                "Example: get_entities_in_region({ north: 52, south: 51, east: 0, west: -1, pluginId: 'flights' })",
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
                const result = await getEntitiesInRegion({
                    north: input.north,
                    south: input.south,
                    east: input.east,
                    west: input.west,
                    pluginId: input.pluginId,
                    limit: Math.min(input.limit ?? 100, 100),
                });
                if (result.entities.length === 0) {
                    const emptyReason = resolveDataQueryEmptyReason(result.emptyReason);
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ success: true, entities: [], count: 0, emptyReason }),
                            },
                        ],
                    };
                }
                const count = result.entities.length;
                const truncated = result.totalMatched !== undefined;
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                entities: result.entities,
                                count,
                                ...(truncated && { truncated: true, totalMatched: result.totalMatched }),
                            }),
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
                "Single entity lookup returning full detail by pluginId + entityId. " +
                "This is a READ-ONLY data tool -- it does NOT require an active globe session. " +
                "Use after search_entities or get_entities_in_region to retrieve complete properties for one entity. " +
                "Before calling, verify the plugin is active via tools/list. " +
                "Returns emptyReason on empty results: 'plugin_not_streaming' (plugin not loaded or not streaming), 'no_data_matches' (nothing matched -- entity not found in snapshot). " +
                "Example: get_entity_details({ pluginId: 'flights', entityId: 'BA123' })",
            inputSchema: {
                pluginId: z.string().describe("The plugin that owns this entity"),
                entityId: z.string().describe("The entity identifier"),
            },
        },
        async (input) => {
            try {
                const result = await getEntityDetails(input.pluginId, input.entityId);
                if (result.data === null) {
                    const emptyReason = resolveDataQueryEmptyReason(result.emptyReason);
                    return { content: [{ type: "text", text: JSON.stringify({ success: true, data: null, emptyReason }) }] };
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, entity: result.data }),
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
                "Full data snapshot returning current entities for one plugin by pluginId. " +
                "This is a READ-ONLY data tool -- it does NOT require an active globe session. " +
                "Use to bulk-read a plugin's live state. Before calling, verify the plugin is active via tools/list. " +
                "Returns emptyReason on empty results: 'plugin_not_streaming' (plugin not loaded or not streaming), 'no_data_matches' (nothing matched -- plugin loaded but no entities streamed yet). " +
                "Response is capped at 200 entities. When 'truncated' is true, check 'totalMatched' for the full count. " +
                "Includes a capturedAt timestamp when the plugin has streamed data (absent for the not-loaded case). " +
                "Example: get_plugin_data({ pluginId: 'earthquakes' })",
            inputSchema: {
                pluginId: z.string().describe("The plugin identifier"),
            },
        },
        async (input) => {
            try {
                const result = await getPluginData(input.pluginId);
                if (result.data === null) {
                    const emptyReason = resolveDataQueryEmptyReason(result.emptyReason);
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ success: true, entities: [], count: 0, emptyReason }),
                            },
                        ],
                    };
                }
                // Plugin is streaming; check if entities are empty
                const allEntities = result.data.entities ?? [];
                if (allEntities.length === 0) {
                    const emptyReason = resolveDataQueryEmptyReason(result.emptyReason);
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    success: true,
                                    entities: [],
                                    count: 0,
                                    capturedAt: result.data.timestamp,
                                    emptyReason,
                                }),
                            },
                        ],
                    };
                }
                const truncated = allEntities.length > GET_PLUGIN_DATA_CAP;
                const entities = truncated ? allEntities.slice(0, GET_PLUGIN_DATA_CAP) : allEntities;
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                entities,
                                count: entities.length,
                                ...(truncated && { truncated: true, totalMatched: allEntities.length }),
                                capturedAt: result.data.timestamp,
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
