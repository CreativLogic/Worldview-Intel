/**
 * SEC-04: isValidGlobeCommand input cap tests.
 *
 * Verifies that toggleLayer, setFilter, and clearFilter enforce the
 * layerId/pluginId charset and length bounds introduced in SEC-04.
 */

import { describe, it, expect } from "vitest";
import { isValidGlobeCommand } from "./GlobeCommand";

// ---------------------------------------------------------------------------
// toggleLayer -- layerId caps
// ---------------------------------------------------------------------------

describe("isValidGlobeCommand -- toggleLayer layerId caps (SEC-04)", () => {
    it("accepts a normal plugin id", () => {
        expect(isValidGlobeCommand({ type: "toggleLayer", layerId: "ais" })).toBe(true);
        expect(isValidGlobeCommand({ type: "toggleLayer", layerId: "wwv-flights-2" })).toBe(true);
        expect(isValidGlobeCommand({ type: "toggleLayer", layerId: "plugin.v2" })).toBe(true);
    });

    it("rejects layerId longer than 64 chars", () => {
        const long = "a".repeat(65);
        expect(isValidGlobeCommand({ type: "toggleLayer", layerId: long })).toBe(false);
    });

    it("accepts layerId of exactly 64 chars", () => {
        const exact = "a".repeat(64);
        expect(isValidGlobeCommand({ type: "toggleLayer", layerId: exact })).toBe(true);
    });

    it("rejects layerId with spaces", () => {
        expect(isValidGlobeCommand({ type: "toggleLayer", layerId: "bad id" })).toBe(false);
    });

    it("rejects layerId with colons (reserved for entityId)", () => {
        expect(isValidGlobeCommand({ type: "toggleLayer", layerId: "ship:123" })).toBe(false);
    });

    it("rejects empty layerId", () => {
        expect(isValidGlobeCommand({ type: "toggleLayer", layerId: "" })).toBe(false);
    });

    it("rejects null layerId", () => {
        expect(isValidGlobeCommand({ type: "toggleLayer", layerId: null })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// setFilter -- pluginId caps
// ---------------------------------------------------------------------------

describe("isValidGlobeCommand -- setFilter pluginId caps (SEC-04)", () => {
    const validFilters = { status: { type: "text", value: "live" } };

    it("accepts a normal plugin id", () => {
        expect(isValidGlobeCommand({ type: "setFilter", pluginId: "flights", filters: validFilters })).toBe(true);
    });

    it("rejects pluginId longer than 64 chars", () => {
        const long = "a".repeat(65);
        expect(isValidGlobeCommand({ type: "setFilter", pluginId: long, filters: validFilters })).toBe(false);
    });

    it("rejects pluginId with special chars outside the allowed set", () => {
        expect(isValidGlobeCommand({ type: "setFilter", pluginId: "bad id!", filters: validFilters })).toBe(false);
    });

    it("rejects empty pluginId", () => {
        expect(isValidGlobeCommand({ type: "setFilter", pluginId: "", filters: validFilters })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// clearFilter -- pluginId caps (optional)
// ---------------------------------------------------------------------------

describe("isValidGlobeCommand -- clearFilter pluginId caps (SEC-04)", () => {
    it("accepts a normal plugin id", () => {
        expect(isValidGlobeCommand({ type: "clearFilter", pluginId: "flights" })).toBe(true);
    });

    it("accepts absent pluginId (clear all)", () => {
        expect(isValidGlobeCommand({ type: "clearFilter" })).toBe(true);
    });

    it("rejects oversized pluginId", () => {
        const long = "x".repeat(65);
        expect(isValidGlobeCommand({ type: "clearFilter", pluginId: long })).toBe(false);
    });

    it("rejects pluginId with disallowed chars", () => {
        expect(isValidGlobeCommand({ type: "clearFilter", pluginId: "a b" })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// focusEntity -- entityId caps (MUST-FIX #1)
// ---------------------------------------------------------------------------

describe("isValidGlobeCommand -- focusEntity entityId caps (SEC-04)", () => {
    it("accepts a normal entity id", () => {
        expect(isValidGlobeCommand({ type: "focusEntity", entityId: "ship:123" })).toBe(true);
        expect(isValidGlobeCommand({ type: "focusEntity", entityId: "flight/AFR123" })).toBe(true);
    });

    it("accepts absent entityId (coordinate-only focus)", () => {
        expect(isValidGlobeCommand({ type: "focusEntity", lat: 35.68, lon: 139.69 })).toBe(true);
    });

    it("accepts entityId of exactly 256 chars", () => {
        const exact = "a".repeat(256);
        expect(isValidGlobeCommand({ type: "focusEntity", entityId: exact })).toBe(true);
    });

    it("rejects entityId longer than 256 chars", () => {
        const long = "a".repeat(257);
        expect(isValidGlobeCommand({ type: "focusEntity", entityId: long })).toBe(false);
    });

    it("rejects entityId with control characters", () => {
        expect(isValidGlobeCommand({ type: "focusEntity", entityId: "ship\x00123" })).toBe(false);
        expect(isValidGlobeCommand({ type: "focusEntity", entityId: "flight\n456" })).toBe(false);
    });
});
