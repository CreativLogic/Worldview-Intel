/**
 * JSON-RPC 2.0 response helpers for the MCP route.
 *
 * Centralised here so route.ts stays under the ~300-line guideline and the
 * same error shapes can be reused by future route handlers without duplication.
 */

/**
 * Returns 403 + JSON-RPC 2.0 body for the demo edition gate (MCP-04).
 * Runs BEFORE auth so the demo-admin FK write path is never reached.
 */
export function demoBlockedResponse(): Response {
    return Response.json(
        {
            jsonrpc: "2.0",
            error: { code: -32600, message: "MCP is not available in demo mode" },
            id: null,
        },
        { status: 403 },
    );
}

/**
 * Returns 401 + JSON-RPC 2.0 body for missing/invalid Bearer token (MCP-03).
 * Content-Type is application/json (not plain text, Pitfall 3).
 */
export function unauthorizedResponse(): Response {
    return Response.json(
        {
            jsonrpc: "2.0",
            error: { code: -32600, message: "Unauthorized" },
            id: null,
        },
        { status: 401 },
    );
}

/**
 * Returns 429 + JSON-RPC 2.0 body when the authenticated key exceeds its
 * per-window request budget (SEC-02). Code -32000 is the server-defined range.
 */
export function rateLimitedResponse(retryAfterMs: number): Response {
    return Response.json(
        {
            jsonrpc: "2.0",
            error: { code: -32000, message: "rate limit exceeded" },
            id: null,
        },
        {
            status: 429,
            headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1_000)) },
        },
    );
}

/**
 * Returns 500 + JSON-RPC 2.0 body for unexpected server errors (TRANS-01).
 * Used by the top-level try/catch so MCP clients always receive a well-formed
 * JSON-RPC error frame instead of a bare HTML 500 from Next.js.
 */
export function internalErrorResponse(): Response {
    return Response.json(
        {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32603, message: "Internal error" },
        },
        {
            status: 500,
            headers: {
                "X-Accel-Buffering": "no",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
            },
        },
    );
}
