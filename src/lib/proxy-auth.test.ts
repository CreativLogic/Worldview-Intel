/**
 * Tests for proxy-auth dual-auth helpers.
 *
 * Validates that the proxy gate accepts sessions from either
 * NextAuth (getToken) or Better Auth (getSessionCookie).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock variables must be hoisted before vi.mock() calls
// ---------------------------------------------------------------------------
const { mockGetToken, mockGetSessionCookie } = vi.hoisted(() => ({
    mockGetToken: vi.fn(),
    mockGetSessionCookie: vi.fn(),
}));

vi.mock("next-auth/jwt", () => ({
    getToken: mockGetToken,
}));

vi.mock("better-auth/cookies", () => ({
    getSessionCookie: mockGetSessionCookie,
}));

// ---------------------------------------------------------------------------
// Import the helpers after mocks are set up
// ---------------------------------------------------------------------------
import { hasBetterAuthCookie, createTestRequest, hasValidSession } from "./proxy-auth";

describe("hasBetterAuthCookie", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns true when Better Auth session cookie is present", () => {
        mockGetSessionCookie.mockReturnValue("valid-session-token");
        const req = createTestRequest();
        const result = hasBetterAuthCookie(req);
        expect(result).toBe(true);
    });

    it("returns false when Better Auth session cookie is null", () => {
        mockGetSessionCookie.mockReturnValue(null);
        const req = createTestRequest();
        const result = hasBetterAuthCookie(req);
        expect(result).toBe(false);
    });

    it("returns false when Better Auth session cookie is undefined", () => {
        mockGetSessionCookie.mockReturnValue(undefined);
        const req = createTestRequest();
        const result = hasBetterAuthCookie(req);
        expect(result).toBe(false);
    });

    it("calls getSessionCookie with the request object", () => {
        mockGetSessionCookie.mockReturnValue("token");
        const req = createTestRequest();
        hasBetterAuthCookie(req);
        expect(mockGetSessionCookie).toHaveBeenCalledWith(req);
    });
});

describe("hasValidSession (dual-auth)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns true when NextAuth session is present (Better Auth absent)", async () => {
        mockGetToken.mockResolvedValue({ sub: "user-1", email: "test@example.com" });
        mockGetSessionCookie.mockReturnValue(null);

        const result = await hasValidSession(createTestRequest());
        expect(result).toBe(true);
    });

    it("returns true when Better Auth session is present (NextAuth absent)", async () => {
        mockGetToken.mockResolvedValue(null);
        mockGetSessionCookie.mockReturnValue("better-auth-token");

        const result = await hasValidSession(createTestRequest());
        expect(result).toBe(true);
    });

    it("returns true when both sessions are present", async () => {
        mockGetToken.mockResolvedValue({ sub: "user-1" });
        mockGetSessionCookie.mockReturnValue("better-auth-token");

        const result = await hasValidSession(createTestRequest());
        expect(result).toBe(true);
    });

    it("returns false when neither session is present", async () => {
        mockGetToken.mockResolvedValue(null);
        mockGetSessionCookie.mockReturnValue(null);

        const result = await hasValidSession(createTestRequest());
        expect(result).toBe(false);
    });

    it("falls through to Better Auth when NextAuth cookie exists but token is null", async () => {
        mockGetToken.mockResolvedValue(null);
        mockGetSessionCookie.mockReturnValue("better-auth-token");

        const result = await hasValidSession(createTestRequest());
        expect(result).toBe(true);
    });
});
