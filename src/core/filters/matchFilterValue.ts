import type { FilterValue } from "@/core/plugins/PluginTypes";

/**
 * Pure per-value filter matching shared by the client filterEngine and the
 * server-side search_entities filter (Phase 23, D-08). Behavior must remain
 * identical to the original inline filterEngine.matchesFilter.
 */
export function matchFilterValue(propValue: unknown, filter: FilterValue): boolean {
    switch (filter.type) {
        case "text": {
            if (!filter.value) return true; // empty text = no filter
            const str = String(propValue ?? "").toLowerCase();
            return str.includes(filter.value.toLowerCase());
        }
        case "select": {
            if (filter.values.length === 0) return true; // no selection = no filter
            const pVal = String(propValue ?? "").toLowerCase();
            return filter.values.some((v) => v.toLowerCase() === pVal);
        }
        case "range": {
            const num = Number(propValue ?? 0);
            if (isNaN(num)) return false;
            return num >= filter.min && num <= filter.max;
        }
        case "boolean": {
            return Boolean(propValue) === filter.value;
        }
        default:
            return true;
    }
}
