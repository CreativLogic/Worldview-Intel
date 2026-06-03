/**
 * SEC-02: redisSlidingWindow helper tests.
 *
 * The helper lives in geocodingRateLimit.ts. Tests cover:
 *   - allows requests within the window
 *   - rejects requests over the limit (boundary: limit allowed, limit+1 rejected)
 *   - fails OPEN when Redis throws
 *   - two same-instant calls each occupy their own ZSET slot (unique members)
 *   - retryAfterMs is computed from the oldest in-window entry, not the full window
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => ({
    redis: {
        zremrangebyscore: vi.fn(),
        zadd: vi.fn(),
        expire: vi.fn(),
        zcard: vi.fn(),
        zrange: vi.fn(),
    },
}));

import { redisSlidingWindow } from "./geocodingRateLimit";
import { redis } from "@/lib/redis";

const mockRedis = vi.mocked(redis, true);

beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.zremrangebyscore.mockResolvedValue(0 as never);
    mockRedis.zadd.mockResolvedValue(1 as never);
    mockRedis.expire.mockResolvedValue(1 as never);
    // Default: no oldest entry (empty zrange result)
    (mockRedis as unknown as { zrange: ReturnType<typeof vi.fn> }).zrange.mockResolvedValue([] as never);
});

describe("redisSlidingWindow", () => {
    it("allows request when count is within limit", async () => {
        mockRedis.zcard.mockResolvedValue(5 as never);

        const result = await redisSlidingWindow("test:key", 10, 60_000);
        expect(result.allowed).toBe(true);
        expect(result.retryAfterMs).toBe(0);
    });

    it("allows the limit-th request (boundary: exactly limit is allowed)", async () => {
        mockRedis.zcard.mockResolvedValue(10 as never);

        const result = await redisSlidingWindow("test:key", 10, 60_000);
        expect(result.allowed).toBe(true);
    });

    it("rejects the (limit+1)-th request (boundary: one over limit is rejected)", async () => {
        mockRedis.zcard.mockResolvedValue(11 as never);
        // Oldest entry was added 10 seconds ago inside a 60s window
        const now = Date.now();
        const oldestScore = now - 10_000;
        (mockRedis as unknown as { zrange: ReturnType<typeof vi.fn> }).zrange.mockResolvedValue(
            [`${oldestScore}:abc`, String(oldestScore)] as never,
        );

        const result = await redisSlidingWindow("test:key", 10, 60_000);
        expect(result.allowed).toBe(false);
        // retryAfterMs should be ~50s (oldestScore + 60000 - now), not the full 60000
        expect(result.retryAfterMs).toBeGreaterThan(0);
        expect(result.retryAfterMs).toBeLessThan(60_000);
    });

    it("computes retryAfterMs from the oldest entry score, not the full window", async () => {
        mockRedis.zcard.mockResolvedValue(11 as never);
        // Oldest entry was added 55 seconds ago in a 60s window; should expire in ~5s
        const now = Date.now();
        const oldestScore = now - 55_000;
        (mockRedis as unknown as { zrange: ReturnType<typeof vi.fn> }).zrange.mockResolvedValue(
            [`${oldestScore}:xyz`, String(oldestScore)] as never,
        );

        const result = await redisSlidingWindow("test:key", 10, 60_000);
        expect(result.allowed).toBe(false);
        // Expected: oldestScore + 60000 - now = ~5000ms
        expect(result.retryAfterMs).toBeGreaterThanOrEqual(1);
        expect(result.retryAfterMs).toBeLessThanOrEqual(6_000);
    });

    it("fails OPEN when Redis throws (never blocks legit users on Redis outage)", async () => {
        mockRedis.zremrangebyscore.mockRejectedValue(new Error("ECONNREFUSED"));

        const result = await redisSlidingWindow("test:key", 10, 60_000);
        expect(result.allowed).toBe(true);
    });

    it("calls zremrangebyscore, zadd, expire, and zcard once each on allowed request", async () => {
        mockRedis.zcard.mockResolvedValue(1 as never);

        await redisSlidingWindow("mcp:ratelimit:key:k1", 120, 60_000);

        expect(mockRedis.zremrangebyscore).toHaveBeenCalledTimes(1);
        expect(mockRedis.zadd).toHaveBeenCalledTimes(1);
        expect(mockRedis.expire).toHaveBeenCalledTimes(1);
        expect(mockRedis.zcard).toHaveBeenCalledTimes(1);
    });

    it("uses unique ZSET members so two same-instant calls each occupy their own slot", async () => {
        mockRedis.zcard.mockResolvedValue(1 as never);

        await redisSlidingWindow("test:key", 10, 60_000);
        await redisSlidingWindow("test:key", 10, 60_000);

        // zadd must have been called twice with different member values
        expect(mockRedis.zadd).toHaveBeenCalledTimes(2);
        const [call1, call2] = mockRedis.zadd.mock.calls as [unknown, unknown, string][];
        const member1 = call1[2];
        const member2 = call2[2];
        expect(member1).not.toBe(member2);
    });
});
