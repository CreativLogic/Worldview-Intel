# Plugin Filter Guide

This guide explains how a plugin author declares filterable fields so they become
discoverable and controllable by AI agents over MCP through the `get_plugin_filters`
and `set_filter` tools (v1.3 Location Intelligence).

## How it fits together

1. Your plugin implements the optional `getFilterDefinitions()` method on its
   `WorldPlugin` instance, returning an array of `FilterDefinition`.
2. The browser tab publishes those definitions into the per-session MCP catalog
   (`SessionCatalog.filterDefinitions`, keyed by `pluginId`) in Redis.
3. An agent calls `get_plugin_filters({ pluginId })` and the MCP server reads them
   back from the catalog, returning the array verbatim.
4. The agent builds a matching `set_filter({ pluginId, filters })` call. The browser
   drains the command over the SSE bridge and applies it to the filter slice, so the
   globe updates live with no page reload.

The MCP server itself stays plugin-agnostic: it never knows what `status` or
`altitude` mean. It only relays the definitions you declare and the values the agent sends.

## The `FilterDefinition` type

Exported from `@worldwideview/wwv-plugin-sdk`:

```ts
interface FilterSelectOption { value: string; label: string; }
interface FilterRangeConfig { min: number; max: number; step: number; }

interface FilterDefinition {
    id: string;                       // stable filter id used as the key in set_filter `filters`
    label: string;                    // human-readable label
    type: "text" | "select" | "range" | "boolean";
    propertyKey: string;              // the entity property this filter matches against
    options?: FilterSelectOption[];   // for type "select"
    range?: FilterRangeConfig;        // for type "range"
}
```

- `id` is the key the agent uses inside `set_filter`'s `filters` map.
- `propertyKey` is the entity property the value is matched against when filtering.
  It can differ from `id` (e.g. `id: "status"` matching `propertyKey: "flightStatus"`).
- `options` is only meaningful for `select`; `range` only for `range`.

## Filter values (`FilterValue`)

The value an agent sends for each filter id is a discriminated union on `type`,
validated at the MCP boundary:

```ts
type FilterValue =
    | { type: "text"; value: string }
    | { type: "select"; values: string[] }
    | { type: "range"; min: number; max: number }
    | { type: "boolean"; value: boolean };
```

The `type` of the value must match the `type` of the `FilterDefinition` whose `id`
it targets. Structurally invalid values are rejected before reaching the globe.

## Worked example: a "flights" plugin

Suppose a `flights` plugin renders aircraft, where each entity has properties
`flightStatus` ("airborne" or "landed") and `altitudeFt` (a number). Declare two
filters:

```ts
import type { WorldPlugin, FilterDefinition } from "@worldwideview/wwv-plugin-sdk";

export const flightsPlugin: WorldPlugin = {
    id: "flights",
    // ... other required WorldPlugin members ...

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "status",
                label: "Status",
                type: "select",
                propertyKey: "flightStatus",
                options: [
                    { value: "airborne", label: "Airborne" },
                    { value: "landed", label: "Landed" },
                ],
            },
            {
                id: "altitude",
                label: "Altitude (ft)",
                type: "range",
                propertyKey: "altitudeFt",
                range: { min: 0, max: 45000, step: 1000 },
            },
        ];
    },
};
```

### What an agent sees and sends

The agent first discovers the schema:

```
get_plugin_filters({ pluginId: "flights" })
-> [
     { id: "status", label: "Status", type: "select", propertyKey: "flightStatus",
       options: [{ value: "airborne", label: "Airborne" }, { value: "landed", label: "Landed" }] },
     { id: "altitude", label: "Altitude (ft)", type: "range", propertyKey: "altitudeFt",
       range: { min: 0, max: 45000, step: 1000 } }
   ]
```

Then it applies a filter, keyed by the `id`s above:

```
set_filter({
  pluginId: "flights",
  filters: {
    status:   { type: "select", values: ["airborne"] },
    altitude: { type: "range", min: 10000, max: 40000 }
  }
})
```

The globe immediately hides landed flights and any aircraft outside 10000-40000 ft.
To remove them again:

```
clear_filter({ pluginId: "flights" })   // just this plugin
clear_filter({})                          // every plugin's filters
```

### Inline filtering with `search_entities`

The same `FilterValue` shape works as the optional `filters` param on
`search_entities`, keyed by entity property key. This filters results in the query
itself, independent of any `set_filter` state:

```
search_entities({
  query: "AFR",
  pluginId: "flights",
  filters: { flightStatus: { type: "select", values: ["airborne"] } }
})
```

## Checklist for plugin authors

- [ ] Implement `getFilterDefinitions()` returning `FilterDefinition[]`.
- [ ] Give each filter a stable `id` and the correct `propertyKey`.
- [ ] Provide `options` for `select` filters and `range` for `range` filters.
- [ ] Ensure the value `type` an agent will send matches the definition `type`.
- [ ] Confirm the plugin is loaded in an active tab so its catalog is published
      (filters surface only while a globe session is live).
