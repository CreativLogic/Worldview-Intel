# Issue Triage Guide

How incoming **plugin requests** and **feature requests** are handled in `silvertakana/worldwideview`. The goal is a consistent, low-effort intake so nothing rots and contributors always know where their idea stands.

Run `/triage-issue <number>` to apply this guide to a specific issue.

## 1. Intake types and labels

Every non-bug request is one of two types:

| Type | What it is | Label | Examples |
|---|---|---|---|
| **Plugin request** | A new data source to render on the globe | `plugin-request` | BirdNET (#148), ISS tracker, AIS ships |
| **Feature request** | A platform capability, not a data source | `enhancement` | GeoJSON editor (#84), ontology layer (#138) |

Community-buildable plugin requests also get `good first issue` + `help wanted`.

## 2. Plugin requests funnel into #4

[Issue #4 - Plugin Wishlist](https://github.com/silvertakana/worldwideview/issues/4) is the **single pinned funnel** for plugin ideas. When a `[PLUGIN]` issue arrives:

1. **Vet the data source.** Is there a free, public API? Check rate limits and CORS. The `plugin-researcher` agent does this in about a minute.
2. **If viable:** add it as a checklist line in #4, label the standalone `plugin-request` + `good first issue` + `help wanted`, then close the standalone with a note: "Tracked in the Plugin Wishlist #4." This keeps one canonical list instead of scattered duplicates.
3. **If not viable** (no free API, paywalled, or geofenced - e.g. aviation/OpenSky in #149): close with the reason stated, so nobody re-opens the same dead end.

## 3. Feature requests stay open as tracking threads

1. Label `enhancement`.
2. Add a one-line entry to the `.planning` ROADMAP backlog (shared root, see `WWV_SHARED_PLANNING`).
3. Leave the issue **open** as the canonical tracking thread. Reply with status, but **promise no dates**.

## 4. The build / do-not-build rule

Only build a plugin yourself (or kick off the `/plugin-new` pipeline) when **all three** hold:

1. **Free API exists** - no paywall, usable rate limits.
2. **Renders something meaningful** - points, paths, or regions on the globe, not just a number.
3. **Fits the demo** - relevant to the live `demo` edition, not a niche one-off.

If any one fails, it lives in the wishlist (#4) for community contributors. The same three-part test is why aviation was pulled from the demo (#149): the only free API was unreliable.

## 5. Quick reference

```
[PLUGIN] issue  -> vet API -> viable?  yes: add to #4, label, close standalone
                                       no:  close with reason
[FEATURE] issue -> label enhancement -> add to ROADMAP backlog -> keep open
bug             -> reproduce -> label bug -> fix or route to debugger agent
question        -> answer -> close
```
