import type {
    GeoEntity,
    FilterDefinition,
    FilterValue,
} from "@/core/plugins/PluginTypes";
import { matchFilterValue } from "./matchFilterValue";

/**
 * Apply active filters to a list of entities.
 * All active filters must match for an entity to pass (AND logic).
 */
export function applyFilters(
    entities: GeoEntity[],
    definitions: FilterDefinition[],
    activeFilters: Record<string, FilterValue>
): GeoEntity[] {
    if (!Array.isArray(entities)) return [];
    const activeEntries = Object.entries(activeFilters);
    if (activeEntries.length === 0) return entities;

    // Build a lookup of definition by id for quick access
    const defMap = new Map(definitions.map((d) => [d.id, d]));

    return entities.filter((entity) => {
        for (const [filterId, filterVal] of activeEntries) {
            const def = defMap.get(filterId);
            if (!def) continue;

            const propValue = entity.properties[def.propertyKey];

            if (!matchFilterValue(propValue, filterVal)) {
                return false;
            }
        }
        return true;
    });
}
