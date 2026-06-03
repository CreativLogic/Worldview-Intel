import { vi } from "vitest";

/**
 * Manual mock for `@/lib/prisma`.
 *
 * The real module re-exports a Prisma client whose underlying singleton
 * (`@/lib/db`) throws on any property access when DATABASE_URL is unset (the
 * test environment). That makes vitest's automock unusable here, so this manual
 * mock supplies a deep-mocked `prisma.favorite` surface that tests can drive
 * via `vi.mocked(prisma, true)`.
 */
export const prisma = {
    favorite: {
        upsert: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        update: vi.fn(),
    },
};
