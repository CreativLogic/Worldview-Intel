/**
 * RED test scaffold for GlobeCommand type guard (Phase 19a Wave 0).
 *
 * These tests INTENTIONALLY FAIL because GlobeCommand.ts does not exist yet.
 * They lock the following contracts:
 *
 *   CMD-01  valid pan command passes the guard
 *   CMD-02  pan with non-number lat fails the guard
 *   CMD-03  valid toggleLayer passes the guard
 *   CMD-04  toggleLayer without layerId fails the guard
 *   CMD-05  valid focusEntity passes the guard
 *   CMD-06  valid setTimeline passes the guard
 *   CMD-07  unknown type fails the guard
 *   CMD-08  null/undefined/string all fail (never throws)
 */

import { describe, it, expect } from "vitest";
import { isValidGlobeCommand } from "./GlobeCommand";

describe("isValidGlobeCommand", () => {
    // CMD-01
    it("returns true for a valid pan command with required fields", () => {
        expect(
            isValidGlobeCommand({ type: "pan", lat: 1, lon: 2, alt: 3 })
        ).toBe(true);
    });

    // CMD-01 variant with optional fields
    it("returns true for pan with all optional fields", () => {
        expect(
            isValidGlobeCommand({
                type: "pan",
                lat: 40.7,
                lon: -74.0,
                alt: 500000,
                duration: 2,
                heading: 45,
                pitch: -30,
            })
        ).toBe(true);
    });

    // CMD-02
    it("returns false for pan when lat is not a number", () => {
        expect(
            isValidGlobeCommand({ type: "pan", lat: "north", lon: 2, alt: 3 })
        ).toBe(false);
    });

    it("returns false for pan when lon is not a number", () => {
        expect(
            isValidGlobeCommand({ type: "pan", lat: 1, lon: null, alt: 3 })
        ).toBe(false);
    });

    it("returns false for pan when alt is missing", () => {
        expect(
            isValidGlobeCommand({ type: "pan", lat: 1, lon: 2 })
        ).toBe(false);
    });

    // CMD-03
    it("returns true for a valid toggleLayer command", () => {
        expect(
            isValidGlobeCommand({ type: "toggleLayer", layerId: "ais" })
        ).toBe(true);
    });

    it("returns true for toggleLayer with enabled field", () => {
        expect(
            isValidGlobeCommand({ type: "toggleLayer", layerId: "aviation", enabled: false })
        ).toBe(true);
    });

    // CMD-04
    it("returns false for toggleLayer without layerId", () => {
        expect(
            isValidGlobeCommand({ type: "toggleLayer" })
        ).toBe(false);
    });

    it("returns false for toggleLayer with non-string layerId", () => {
        expect(
            isValidGlobeCommand({ type: "toggleLayer", layerId: 42 })
        ).toBe(false);
    });

    // CMD-05
    it("returns true for a valid focusEntity command with entityId", () => {
        expect(
            isValidGlobeCommand({ type: "focusEntity", entityId: "ship:1" })
        ).toBe(true);
    });

    it("returns true for focusEntity with lat/lon", () => {
        expect(
            isValidGlobeCommand({ type: "focusEntity", lat: 51.5, lon: -0.12 })
        ).toBe(true);
    });

    it("returns true for focusEntity with no fields (all optional)", () => {
        expect(
            isValidGlobeCommand({ type: "focusEntity" })
        ).toBe(true);
    });

    // CMD-06
    it("returns true for a valid setTimeline command with timeWindow", () => {
        expect(
            isValidGlobeCommand({ type: "setTimeline", timeWindow: "24h" })
        ).toBe(true);
    });

    it("returns true for setTimeline with all optional fields", () => {
        expect(
            isValidGlobeCommand({
                type: "setTimeline",
                currentTime: "2026-01-01T00:00:00.000Z",
                timeWindow: "6h",
                isPlaybackMode: true,
            })
        ).toBe(true);
    });

    it("returns true for setTimeline with no fields (all optional)", () => {
        expect(
            isValidGlobeCommand({ type: "setTimeline" })
        ).toBe(true);
    });

    // CMD-07
    it("returns false for an unknown type", () => {
        expect(
            isValidGlobeCommand({ type: "flyTo", lat: 1, lon: 2 })
        ).toBe(false);
    });

    it("returns false for an object with no type", () => {
        expect(
            isValidGlobeCommand({ lat: 1, lon: 2 })
        ).toBe(false);
    });

    // CMD-08
    it("returns false for null without throwing", () => {
        expect(isValidGlobeCommand(null)).toBe(false);
    });

    it("returns false for undefined without throwing", () => {
        expect(isValidGlobeCommand(undefined)).toBe(false);
    });

    it("returns false for a plain string without throwing", () => {
        expect(isValidGlobeCommand("pan")).toBe(false);
    });

    it("returns false for a number without throwing", () => {
        expect(isValidGlobeCommand(42)).toBe(false);
    });

    it("returns false for an array without throwing", () => {
        expect(isValidGlobeCommand([])).toBe(false);
    });
});

describe("flyTo validator", () => {
    it("accepts valid point command with lat and lng only", () => {
        expect(isValidGlobeCommand({ type: "flyTo", lat: 51.5, lng: -0.1 })).toBe(true);
    });

    it("accepts valid point command with lat, lng, and alt", () => {
        expect(isValidGlobeCommand({ type: "flyTo", lat: 51.5, lng: -0.1, alt: 15000 })).toBe(true);
    });

    it("accepts valid command with a 4-element bbox [west,south,east,north]", () => {
        expect(isValidGlobeCommand({ type: "flyTo", lat: 51.5, lng: -0.1, bbox: [-1, 50, 1, 52] })).toBe(true);
    });

    it("rejects bbox with wrong length (3 elements)", () => {
        expect(isValidGlobeCommand({ type: "flyTo", lat: 51.5, lng: -0.1, bbox: [-1, 50, 1] })).toBe(false);
    });

    it("rejects lat out of range (>90)", () => {
        expect(isValidGlobeCommand({ type: "flyTo", lat: 91, lng: 0 })).toBe(false);
    });

    it("rejects lng out of range (>180)", () => {
        expect(isValidGlobeCommand({ type: "flyTo", lat: 0, lng: 181 })).toBe(false);
    });

    it("rejects negative alt (alt must be > 0 if provided)", () => {
        expect(isValidGlobeCommand({ type: "flyTo", lat: 0, lng: 0, alt: -1 })).toBe(false);
    });

    it("rejects bbox with non-numeric element", () => {
        expect(isValidGlobeCommand({ type: "flyTo", lat: 0, lng: 0, bbox: ["west", 50, 1, 52] })).toBe(false);
    });
});

describe("setFilter / clearFilter validator", () => {
    it("accepts setFilter with a select filter value", () => {
        expect(
            isValidGlobeCommand({ type: "setFilter", pluginId: "flights", filters: { status: { type: "select", values: ["airborne"] } } })
        ).toBe(true);
    });

    it("accepts setFilter with a range filter value", () => {
        expect(
            isValidGlobeCommand({ type: "setFilter", pluginId: "flights", filters: { alt: { type: "range", min: 0, max: 1000 } } })
        ).toBe(true);
    });

    it("accepts setFilter with a boolean filter value", () => {
        expect(
            isValidGlobeCommand({ type: "setFilter", pluginId: "flights", filters: { live: { type: "boolean", value: true } } })
        ).toBe(true);
    });

    it("accepts setFilter with a text filter value", () => {
        expect(
            isValidGlobeCommand({ type: "setFilter", pluginId: "flights", filters: { name: { type: "text", value: "ba" } } })
        ).toBe(true);
    });

    it("rejects setFilter with an empty pluginId", () => {
        expect(
            isValidGlobeCommand({ type: "setFilter", pluginId: "", filters: {} })
        ).toBe(false);
    });

    it("rejects setFilter when select values is not an array", () => {
        expect(
            isValidGlobeCommand({ type: "setFilter", pluginId: "flights", filters: { x: { type: "select", values: "nope" } } })
        ).toBe(false);
    });

    it("rejects setFilter when range min is not a number", () => {
        expect(
            isValidGlobeCommand({ type: "setFilter", pluginId: "flights", filters: { x: { type: "range", min: "0", max: 1 } } })
        ).toBe(false);
    });

    it("rejects setFilter with an unknown filter type", () => {
        expect(
            isValidGlobeCommand({ type: "setFilter", pluginId: "flights", filters: { x: { type: "bogus" } } })
        ).toBe(false);
    });

    it("rejects setFilter when filters is not an object", () => {
        expect(
            isValidGlobeCommand({ type: "setFilter", pluginId: "flights", filters: null })
        ).toBe(false);
    });

    it("accepts clearFilter with no pluginId (clear all)", () => {
        expect(isValidGlobeCommand({ type: "clearFilter" })).toBe(true);
    });

    it("accepts clearFilter with a pluginId", () => {
        expect(isValidGlobeCommand({ type: "clearFilter", pluginId: "flights" })).toBe(true);
    });

    it("rejects clearFilter when pluginId is not a string", () => {
        expect(isValidGlobeCommand({ type: "clearFilter", pluginId: 123 })).toBe(false);
    });
});
