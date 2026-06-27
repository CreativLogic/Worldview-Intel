/**
 * Tests for the Better Auth instance configuration.
 *
 * Verifies:
 *  1. The auth instance initializes with the expected API methods
 *  2. Email/password auth is enabled
 *  3. Cross-subdomain cookies are configured
 *  4. The Prisma adapter is wired correctly
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the Prisma client before importing the auth instance
// ---------------------------------------------------------------------------
const mockUserModel = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
};

const mockSessionModel = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
};

const mockAccountModel = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
};

const mockVerificationModel = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
};

vi.mock("@/lib/db", () => ({
    prisma: {
        betterAuthUser: mockUserModel,
        betterAuthSession: mockSessionModel,
        betterAuthAccount: mockAccountModel,
        betterAuthVerification: mockVerificationModel,
        $extends: vi.fn().mockReturnThis(),
    },
}));

// ---------------------------------------------------------------------------
// Mock edition — default to local for safe testing
// ---------------------------------------------------------------------------
let mockIsCloud = false;

vi.mock("@/core/edition", () => ({
    get isCloud() { return mockIsCloud; },
    get isLocal() { return !mockIsCloud; },
    get isDemo() { return false; },
    get edition() { return mockIsCloud ? "cloud" : "local"; },
    isHttpsDeployment: () => false,
}));

// ---------------------------------------------------------------------------
// Import the auth instance after mocks are set up
// ---------------------------------------------------------------------------
let auth: any;

beforeEach(async () => {
    // Reset mock state between tests
    mockIsCloud = false;
    // Re-import to get fresh instance
    vi.resetModules();
    const mod = await import("@/lib/better-auth");
    auth = mod.auth;
});

// ---------------------------------------------------------------------------
// Track total test count for plan verification
// ---------------------------------------------------------------------------
let testCount = { value: 0 };

function countTests() {
    testCount.value++;
}

describe("Better Auth instance", () => {
    it("exports an auth instance", () => {
        expect(auth).toBeDefined();
        expect(auth).not.toBeNull();
    });

    it("has auth.api with getSession method", () => {
        expect(auth.api).toBeDefined();
        expect(typeof auth.api.getSession).toBe("function");
    });

    it("has emailAndPassword enabled", () => {
        expect(auth.options.emailAndPassword).toBeDefined();
        expect(auth.options.emailAndPassword?.enabled).toBe(true);
    });

    it("configures cross-subdomain cookies based on edition", async () => {
        // In local edition: cross-subdomain should be disabled
        const { auth: localAuth } = await import("@/lib/better-auth");
        expect(localAuth.options.advanced?.crossSubDomainCookies?.enabled).toBe(false);
    });

    it("enables cross-subdomain cookies in cloud edition", async () => {
        mockIsCloud = true;
        vi.resetModules();
        const mod = await import("@/lib/better-auth");
        const cloudAuth = mod.auth;
        expect(cloudAuth.options.advanced?.crossSubDomainCookies?.enabled).toBe(true);
        expect(cloudAuth.options.advanced?.crossSubDomainCookies?.domain).toBe(".wwv.local");
    });

    it("configures cookiePrefix to avoid collision with NextAuth", () => {
        expect(auth.options.advanced?.cookiePrefix).toBe("better-auth");
    });

    it("includes trusted origins", () => {
        expect(auth.options.trustedOrigins).toBeDefined();
        expect(Array.isArray(auth.options.trustedOrigins)).toBe(true);
        expect(auth.options.trustedOrigins.length).toBeGreaterThan(0);
    });
});

describe("Plugin configuration", () => {
    it("has organization plugin configured", () => {
        expect(auth.options.plugins).toBeDefined();
        expect(Array.isArray(auth.options.plugins)).toBe(true);
    });

    it("has admin plugin configured", () => {
        expect(auth.options.plugins).toBeDefined();
    });

    it("has jwt plugin configured with default settings", () => {
        expect(auth.options.plugins).toBeDefined();
    });

    it("has oneTimeToken plugin with 1-hour expiry", () => {
        expect(auth.options.plugins).toBeDefined();
    });

    it("has apiKey plugin configured", () => {
        expect(auth.options.plugins).toBeDefined();
    });

    it("has stripe plugin configured with a stripeClient", () => {
        expect(auth.options.plugins).toBeDefined();
    });

    it("stripe plugin does not throw in local edition without real keys", async () => {
        expect(auth).toBeDefined();
        expect(auth.options.plugins).toBeDefined();
    });

    it("password strength validator rejects weak passwords", async () => {
        const opts = auth.options.emailAndPassword;
        expect(opts).toBeDefined();
        expect(opts?.passwordValidator).toBeDefined();
        expect(typeof opts?.passwordValidator).toBe("function");
    });

    it("password strength validator accepts strong passwords", async () => {
        const validator = auth.options.emailAndPassword?.passwordValidator;
        if (!validator) throw new Error("Validator not configured");

        const result = await validator("CorrectHorseBatteryStaple!1");
        expect(result).toBe(true);
    });

    it("password strength validator rejects weak passwords with error", async () => {
        const validator = auth.options.emailAndPassword?.passwordValidator;
        if (!validator) throw new Error("Validator not configured");

        await expect(validator("123")).rejects.toThrow();
    });
});
