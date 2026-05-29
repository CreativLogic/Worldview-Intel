import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDemo } from "@/core/edition";
import { generateApiKey } from "@/lib/apiKeyAuth";

// ---------------------------------------------------------------------------
// GET /api/api-keys — KEY-03 (list user's keys, secrets never returned)
// ---------------------------------------------------------------------------

export async function GET(_request: Request) {
    if (isDemo) {
        return NextResponse.json({ error: "Not available in demo edition" }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const keys = await prisma.userApiKey.findMany({
            where: { userId: session.user.id },
            select: {
                id: true,
                name: true,
                prefix: true,
                createdAt: true,
                lastUsedAt: true,
                // hashedSecret intentionally excluded — never returned to client
            },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json({ keys });
    } catch (err) {
        console.error("[api-keys] GET error:", err);
        return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// POST /api/api-keys — KEY-01 (reveal-once), KEY-04 (max-3)
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
    if (isDemo) {
        return NextResponse.json({ error: "Not available in demo edition" }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const count = await prisma.userApiKey.count({
            where: { userId: session.user.id },
        });

        if (count >= 3) {
            return NextResponse.json(
                { error: "max_keys_reached", message: "Maximum of 3 API keys allowed per user" },
                { status: 422 },
            );
        }

        const body = await request.json().catch(() => ({})) as { name?: unknown };
        const rawName = typeof body.name === "string" ? body.name.trim() : "";
        const name = rawName || `API Key ${count + 1}`;

        const created = await createKeyWithRetry(session.user.id, name);

        return NextResponse.json({ key: created }, { status: 201 });
    } catch (err) {
        console.error("[api-keys] POST error:", err);
        return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// Internal helper — generates a key + creates the DB row, retries once on
// P2002 prefix collision (extremely rare but possible with 8 random chars).
// fullToken is returned here (reveal-once) and never persisted.
// ---------------------------------------------------------------------------

async function createKeyWithRetry(
    userId: string,
    name: string,
): Promise<{ id: string; name: string; createdAt: Date; fullToken: string }> {
    const { prefix, hashedSecret, fullToken } = await generateApiKey();

    try {
        const row = await prisma.userApiKey.create({
            data: { userId, prefix, hashedSecret, name },
            select: { id: true, name: true, createdAt: true },
        });
        return { ...row, fullToken };
    } catch (err: unknown) {
        // Prisma unique-constraint violation (P2002) on prefix — retry once
        const isPrismaP2002 =
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: string }).code === "P2002";

        if (!isPrismaP2002) throw err;

        const retry = await generateApiKey();
        const row = await prisma.userApiKey.create({
            data: { userId, prefix: retry.prefix, hashedSecret: retry.hashedSecret, name },
            select: { id: true, name: true, createdAt: true },
        });
        return { ...row, fullToken: retry.fullToken };
    }
}
