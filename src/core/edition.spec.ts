import { describe, it, expect, vi, afterEach } from "vitest";
import { ticketAuthEnabledForPlugin } from "./edition";

describe("ticketAuthEnabledForPlugin", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("returns false when env var is empty (dormant default)", () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS", "");
        expect(ticketAuthEnabledForPlugin("aviation")).toBe(false);
        expect(ticketAuthEnabledForPlugin("maritime")).toBe(false);
    });

    it("returns true only for plugin IDs in the comma-separated list", () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS", "aviation,maritime");
        expect(ticketAuthEnabledForPlugin("aviation")).toBe(true);
        expect(ticketAuthEnabledForPlugin("maritime")).toBe(true);
        expect(ticketAuthEnabledForPlugin("wildfire")).toBe(false);
    });

    it("trims whitespace around plugin IDs", () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS", " aviation , maritime ");
        expect(ticketAuthEnabledForPlugin("aviation")).toBe(true);
        expect(ticketAuthEnabledForPlugin("maritime")).toBe(true);
    });

    it("returns false for a partial match (no substring matching)", () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS", "aviation");
        expect(ticketAuthEnabledForPlugin("avi")).toBe(false);
    });
});
