import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import type { FilterValue } from "@/core/plugins/PluginTypes";

/**
 * Reason explaining why a data-query result is empty.
 *
 * - plugin_not_streaming: the requested pluginId is absent from the engine
 *   /manifest, or its snapshot fetch returned null (plugin not loaded / offline).
 * - no_data_matches: the plugin is streaming but 0 entities matched the
 *   query / region / filters.
 * - no_session_active: the authenticated user has no active globe session.
 *   This value is emitted by the tool layer (which has access to userId),
 *   NEVER by the service layer.
 */
export type EmptyReason = "plugin_not_streaming" | "no_data_matches" | "no_session_active";

/**
 * Discriminated result carrying a list of entities and an optional emptyReason.
 * emptyReason is ONLY present when entities.length === 0.
 */
export interface QueryResult<T> {
    entities: T[];
    emptyReason?: EmptyReason;
}

/**
 * Discriminated result for single-entity or plugin-data lookups.
 * data is null when nothing was found; emptyReason explains why.
 */
export interface SingleResult<T> {
    data: T | null;
    emptyReason?: EmptyReason;
}

export interface SearchOptions {
    query: string;
    pluginId?: string;
    limit?: number;
    /** Optional inline filters keyed by entity property key (FILT-04, D-07). */
    filters?: Record<string, FilterValue>;
}

export interface SearchResult {
    id: string;
    pluginId: string;
    name?: string;
    latitude: number;
    longitude: number;
}

export interface RegionOptions {
    north: number;
    south: number;
    east: number;
    west: number;
    pluginId?: string;
    limit?: number;
}

export interface DetailResult {
    id: string;
    pluginId: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    heading?: number;
    speed?: number;
    timestamp: Date;
    label?: string;
    properties: Record<string, unknown>;
}

export interface PluginDataSnapshot {
    pluginId: string;
    entities: GeoEntity[];
    timestamp: Date;
}
