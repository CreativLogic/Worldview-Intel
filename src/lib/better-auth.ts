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
 *  - basePath: "/api/ba" to avoid catch-all collision with NextAuth during coexistence
 *  - All 6 Phase 72 plugins configured: organization, admin, jwt, oneTimeToken,
 *    apiKey, and stripe (stripe gated on isCloud)
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { isCloud } from "@/core/edition";
import { organization, admin, jwt } from "better-auth/plugins";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { apiKey } from "@better-auth/api-key";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { evaluatePasswordStrength, MIN_PASSWORD_SCORE } from "@/lib/password-strength";

// Stripe client — uses dummy key in local edition to avoid initialization
// errors. Real keys are required only in cloud edition. The plugin degrades
// gracefully: customer creation and webhook processing silently no-op when
// the key is a dummy.
const stripeClient = new Stripe(
    process.env.STRIPE_SECRET_KEY || "sk_test_dummy_key_for_local_edition"
);

export const auth = betterAuth({
    basePath: "/api/ba",
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        // Validate password strength at sign-up and password reset.
        // Rejects passwords scoring below MIN_PASSWORD_SCORE (2).
        passwordValidator: async (password: string) => {
            const { score, feedback } = evaluatePasswordStrength(password);
            if (score < MIN_PASSWORD_SCORE) {
                // Better Auth will surface this error to the client
                throw new Error(feedback);
            }
            // Return true to allow the password
            return true;
        },
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
    // Phase 72: All six Better Auth plugins configured.
    // Bundled plugins (organization, admin, jwt, oneTimeToken) require no
    // additional npm packages. External plugins (apiKey, stripe) added in Task 2.
    plugins: [
        // Multi-tenant organization scaffolding — single-user org for local,
        // full multi-tenant for cloud.
        organization(),

        // User management — list, ban, impersonate.
        admin(),

        // JWT + JWKS — token endpoint at /api/ba/token, JWKS at /api/ba/jwks.
        // The data engine fetches JWKS from this endpoint to verify plugin tickets.
        jwt(),

        // One-time tokens — replaces setup token flow from src/lib/auth/setupToken.ts.
        // Tokens expire after 1 hour by default.
        oneTimeToken({
            expiresIn: 3600,
        }),

        // API Key management — replaces the HMAC bridge and manual API key
        // logic. Keys can be created, verified, listed, and revoked. Rate
        // limiting built-in.
        apiKey(),

        // Stripe billing — creates customers on sign-up, manages subscription
        // lifecycle. In local edition: stripeClient has a dummy key, plugin is
        // dormant. In cloud edition: real keys drive Checkout, Portal, and
        // webhook processing. createCustomerOnSignUp is gated on isCloud to
        // avoid dummy Stripe API calls in local edition.
        stripe({
            stripeClient,
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
            createCustomerOnSignUp: isCloud,
        }),
    ],
});
