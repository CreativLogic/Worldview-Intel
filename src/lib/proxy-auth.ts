/**
 * Dual-auth session checking helpers for proxy.ts.
 *
 * During Phase 71 coexistence, proxy.ts must check BOTH NextAuth
 * (getToken) and Better Auth (getSessionCookie) sessions. This module
 * provides the composable helpers to do that.
 *
 * Both checkers are Edge Runtime compatible:
 *  - getToken() — JWT verification on Edge (no Prisma needed)
 *  - getSessionCookie() — pure cookie string parser (no Prisma/Node.js deps)
 */
import { getToken } from "next-auth/jwt";
import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { isHttpsDeployment } from "@/core/edition";

/**
 * Create a minimal request-like object for testing.
 * Provides the headers API that getSessionCookie() expects.
 */
export function createTestRequest(): NextRequest {
    return {
        cookies: {
            get: () => undefined,
        },
        headers: {
            get: () => null,
        },
        nextUrl: { pathname: "/" },
    } as unknown as NextRequest;
}

/**
 * Check if the request carries a Better Auth session cookie.
 *
 * NOTE: This checks only cookie PRESENCE, not cryptographic validity.
 * A renamed surface-level guard to avoid implying JWT verification.
 *
 * Uses getSessionCookie() from better-auth/cookies — a pure sync
 * cookie-header parser that does NOT require Node.js runtime or Prisma.
 *
 * Returns true when a session cookie exists, false otherwise.
 */
export function hasBetterAuthCookie(req: NextRequest): boolean {
    const sessionCookie = getSessionCookie(req);
    return sessionCookie !== null && sessionCookie !== undefined;
}

/**
 * Check if the request has a valid session via EITHER NextAuth or Better Auth.
 *
 * Returns true when either auth system has a session.
 * This is the dual-auth gate used in proxy.ts during Phase 71 coexistence.
 *
 * @param req - The incoming NextRequest
 * @param secret - The AUTH_SECRET for verify NextAuth tokens
 */
export async function hasValidSession(
    req: NextRequest,
    secret?: string,
): Promise<boolean> {
    // Check NextAuth first (existing users)
    const isSecure = isHttpsDeployment();
    const nextAuthToken = await getToken({
        req,
        secret: secret ?? process.env.AUTH_SECRET,
        secureCookie: isSecure,
    });
    if (nextAuthToken) return true;

    // Fall through to Better Auth (migrated users)
    const baCookie = getSessionCookie(req);
    if (baCookie) return true;

    return false;
}
