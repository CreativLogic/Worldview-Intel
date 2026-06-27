/**
 * Better Auth instance configuration.
 *
 * This is the auth SERVER instance — hosts the Better Auth runtime with
 * Prisma adapter and cross-subdomain cookie support.
 *
 * Coexists with NextAuth during Phase 71 migration. Both auth systems share
 * the same PostgreSQL database using lowercase @@map() table names.
 *
 * Key decisions:
 *  - crossSubDomainCookies gated on isCloud (local uses exact-domain cookies)
 *  - cookiePrefix "better-auth" avoids collision with NextAuth's "next-auth"
 *  - trustedOrigins configurable via env vars with localhost fallbacks
 *  - NO plugins configured — those come in Phase 72
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { isCloud } from "@/core/edition";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
    },
    // Cross-subdomain cookies: .wwv.local for cloud, exact domain for local.
    // Local edition: cookies scoped to exact host (localhost/wwv.local),
    // because localhost has special cookie domain rules and Safari ITP
    // blocks .local cross-domain cookies on non-HTTPS origins.
    advanced: {
        crossSubDomainCookies: {
            enabled: isCloud,
            domain: ".wwv.local",
        },
        cookiePrefix: "better-auth",
    },
    // Trusted origins: allow requests from all three apps in dev and prod.
    trustedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        process.env.NEXT_PUBLIC_WEB_APP_URL || "http://localhost:3001",
        process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3002",
    ].filter(Boolean),
});
