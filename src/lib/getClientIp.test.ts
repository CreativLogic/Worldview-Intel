/**
 * SEC-03: getClientIp() tests.
 *
 * Verifies rightmost x-forwarded-for extraction and WWV_TRUSTED_IP_HEADER
 * override behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getClientIp } from "./rateLimit";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.WWV_TRUSTED_IP_HEADER;
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
});

function makeRequest(headers: Record<string, string>): Request {
    return new Request("http://localhost/test", { headers });
}

describe("getClientIp -- rightmost x-forwarded-for (SEC-03)", () => {
    it("returns the RIGHTMOST entry of x-forwarded-for (proxy-appended real IP)", () => {
        const req = makeRequest({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" });
        expect(getClientIp(req)).toBe("3.3.3.3");
    });

    it("handles single-entry x-forwarded-for correctly", () => {
        const req = makeRequest({ "x-forwarded-for": "4.4.4.4" });
        expect(getClientIp(req)).toBe("4.4.4.4");
    });

    it("trims whitespace from the rightmost entry", () => {
        const req = makeRequest({ "x-forwarded-for": "1.1.1.1,   5.5.5.5  " });
        expect(getClientIp(req)).toBe("5.5.5.5");
    });

    it("falls back to x-real-ip when x-forwarded-for is absent", () => {
        const req = makeRequest({ "x-real-ip": "6.6.6.6" });
        expect(getClientIp(req)).toBe("6.6.6.6");
    });

    it("returns 'unknown' when no IP header is present", () => {
        const req = makeRequest({});
        expect(getClientIp(req)).toBe("unknown");
    });
});

describe("getClientIp -- WWV_TRUSTED_IP_HEADER override (SEC-03)", () => {
    it("uses the override header when WWV_TRUSTED_IP_HEADER is set", () => {
        process.env.WWV_TRUSTED_IP_HEADER = "cf-connecting-ip";
        const req = makeRequest({
            "cf-connecting-ip": "7.7.7.7",
            "x-forwarded-for": "attacker-ip",
        });
        expect(getClientIp(req)).toBe("7.7.7.7");
    });

    it("falls back to x-forwarded-for when override header is missing from request", () => {
        process.env.WWV_TRUSTED_IP_HEADER = "cf-connecting-ip";
        const req = makeRequest({ "x-forwarded-for": "1.0.0.1, 8.8.8.8" });
        expect(getClientIp(req)).toBe("8.8.8.8");
    });

    it("override header lookup is case-insensitive (HTTP headers are case-insensitive)", () => {
        process.env.WWV_TRUSTED_IP_HEADER = "CF-Connecting-IP";
        const req = makeRequest({ "cf-connecting-ip": "9.9.9.9" });
        expect(getClientIp(req)).toBe("9.9.9.9");
    });
});
