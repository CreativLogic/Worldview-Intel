# SECURITY.md -- Phase 3: Local App PKCE + SSRF Proxy Hardening

**Audit date:** 2026-05-24
**Phase:** 3 -- Local App PKCE + SSRF Proxy Hardening
**ASVS Level:** 2
**Audit mode:** Retroactive-STRIDE (no formal threat model at plan time; register constructed from implementation)
**block_on:** open

---

## Threat Register

| ID | Category | Description | Disposition | Status |
|----|----------|-------------|-------------|--------|
| T01 | SSRF | Proxy endpoints use raw `fetch` instead of `safeFetch` | mitigate | CLOSED |
| T02 | SSRF | `PROXY_HOST_ALLOWLIST` not enforced | mitigate | CLOSED |
| T03 | SSRF | Private IP ranges not blocked | mitigate | CLOSED |
| T04 | SSRF/DNS-rebinding | DNS resolved multiple times; IP not pinned between lookup and connect | mitigate | CLOSED |
| T05 | SSRF/Open-redirect | Proxy follows 3xx redirects, enabling open-redirect chains | mitigate | CLOSED |
| T06 | SSRF | iframe proxy previously used raw `fetch` with no size cap | mitigate | CLOSED |
| T07 | Spoofing | PKCE state not validated; forged state accepted | mitigate | CLOSED |
| T08 | Spoofing | PKCE state cookie not `__Host-` prefixed on HTTPS | mitigate | CLOSED |
| T09 | Spoofing | PKCE state/verifier cookies not `httpOnly`, missing `SameSite` | mitigate | CLOSED |
| T10 | Spoofing | PKCE state/verifier cookies too long-lived (>10 min) | mitigate | CLOSED |
| T11 | Elevation | `code_verifier` cookie reusable after exchange (replay) | mitigate | CLOSED |
| T12 | Tampering | `ENCRYPTION_MASTER_KEY` unset falls back to zero-key silently | mitigate | CLOSED |
| T13 | Elevation | WsClient sends `subscribe` before auth (`onopen` path) | mitigate | CLOSED |
| T14 | Elevation | WsClient sends `subscribe` before auth (`subscribe()` method -- race, already-open connection) | mitigate | OPEN (BLOCKER) |

---

## Verification Evidence

### T01 -- Proxy endpoints use `safeFetch`

All three user-facing proxy routes import and call `safeFetch`, not raw `fetch`:

- `src/app/api/camera/proxy/route.ts:6,27` -- `import { safeFetch }` + `await safeFetch(targetUrl, ...)`
- `src/app/api/camera/proxy/iframe/route.ts:6,32` -- `import { safeFetch }` + `await safeFetch(targetUrl, ...)`
- `src/app/api/camera/proxy/stream/route.ts:6,31` -- `import { safeFetch }` + `await safeFetch(targetUrl, ...)`

**Status: CLOSED**

---

### T02 -- `PROXY_HOST_ALLOWLIST` enforced

`src/lib/security/ssrf.ts:25-42` -- `checkHostAllowlist()` is called at the top of `safeFetch` before any network I/O. Behavior:
- Unset env var: throws `SSRF Error: PROXY_HOST_ALLOWLIST is not configured`
- Empty string: throws same error
- `"*"`: warns and permits (permissive mode, documented)
- Specific list: rejects unlisted hostnames

Covered by unit tests in `src/lib/security/ssrf.spec.ts:63-82`.

**Status: CLOSED**

---

### T03 -- Private IP ranges blocked

`src/lib/security/ssrf.ts:4-9` -- `isPrivateIP()` covers:
- `127.*`, `10.*`, `192.168.*`, `169.254.*` (AWS/GCP metadata), `0.*`
- `172.16-31.*`
- IPv6: `::1`, `fc*`, `fd*`, `fe80*`

Called twice: once against the literal URL hostname (line 56) and once against the resolved IP (line 66).

**Status: CLOSED**

---

### T04 -- DNS pinning via undici Agent

`src/lib/security/ssrf.ts:60-80` -- Single `dns.lookup()` call stores `resolvedIp` and `resolvedFamily`. A custom undici `Agent` is constructed with a `connect.lookup` override that always returns the pre-resolved address, preventing a second DNS resolution during TCP connect.

**Status: CLOSED**

---

### T05 -- Redirect following disabled

`src/lib/security/ssrf.ts:92` -- `redirect: "manual" as const` is passed to undici `fetch`. Verified by test at `ssrf.spec.ts:117-135` which asserts `callOpts.redirect === "manual"` and that only one fetch call is made when a 301 is returned.

**Status: CLOSED**

---

### T06 -- iframe proxy uses `safeFetch` with size cap

`src/app/api/camera/proxy/iframe/route.ts:6,32,39` -- Uses `safeFetch` with `maxSize: 5 * 1024 * 1024` and `timeout: MAX_IFRAME_DURATION_MS` (10 s). The previous raw-fetch vulnerability is no longer present.

**Status: CLOSED**

---

### T07 -- PKCE state validated in callback

`src/app/api/marketplace/callback/route.ts:10-15`:

```
const stateCookie = req.cookies.get(`${cookiePrefix}pkce_state`)?.value;
const urlState = req.nextUrl.searchParams.get("state");
if (!stateCookie || urlState !== stateCookie) {
    return NextResponse.json({ error: "State mismatch" }, { status: 400 });
}
```

Both missing cookie and value mismatch are rejected.

**Status: CLOSED**

---

### T08 -- `__Host-` cookie prefix on HTTPS

`src/app/api/marketplace/connect/route.ts:22-23`:
```
const isHttps = req.nextUrl.protocol === "https:";
const cookiePrefix = isHttps ? "__Host-" : "";
```
Same logic mirrored in `src/app/api/marketplace/callback/route.ts:7-8`. On HTTPS the cookies are named `__Host-pkce_state` and `__Host-pkce_verifier`, which browsers enforce must be `Secure`, `Path=/`, and no `Domain` attribute.

Note: the cookies use `path: "/api/marketplace/callback"`, not `path: "/"`. The `__Host-` prefix specification (RFC 6265bis) requires `Path=/`. This is a partial inconsistency -- the `__Host-` prefix technically requires `Path=/` to be valid per browsers that enforce the prefix spec strictly. In practice Chromium enforces `Path=/` for `__Host-` cookies and will silently reject the Set-Cookie header. This is flagged as an unregistered finding below but does not affect current HTTP (dev) deployments. **Treat as unregistered flag UF-01.**

**Status: CLOSED** (state validation logic present; see UF-01 for prefix/path mismatch)

---

### T09 -- `httpOnly` + `SameSite` on PKCE cookies

`src/app/api/marketplace/connect/route.ts:26-38`:
- `httpOnly: true` -- set on both cookies
- `sameSite: "lax"` -- set on both cookies
- `secure: isHttps` -- conditional on protocol

**Status: CLOSED**

---

### T10 -- PKCE cookies short-lived (10 min)

`src/app/api/marketplace/connect/route.ts:30,38`: `maxAge: 60 * 10` (600 seconds = 10 minutes) on both state and verifier cookies.

**Status: CLOSED**

---

### T11 -- `code_verifier` cookie deleted post-exchange (single-use)

`src/app/api/marketplace/callback/route.ts:66-82` -- After successful token exchange, both `pkce_state` and `pkce_verifier` cookies are explicitly cleared by setting `maxAge: 0` with empty string values. This invalidates the cookies immediately on the response, preventing replay.

**Status: CLOSED**

---

### T12 -- `ENCRYPTION_MASTER_KEY` fails hard when unset

`src/lib/auth/encryption.ts:8-11`:
```
function getMasterKey(): string {
    const key = process.env.ENCRYPTION_MASTER_KEY;
    if (!key) throw new Error('[encryption] ENCRYPTION_MASTER_KEY env var is required');
    return key;
}
```
No fallback. No zero-key. Both `encryptCredential` and `decryptCredential` call `getMasterKey()`.

**Status: CLOSED**

---

### T13 -- WsClient `onopen` sends auth before subscribe (ticket-auth path)

`src/core/data/WsClient.ts:84-107`:
- When any subscription requires ticket auth, `engine.awaitingWelcome = true` is set and `subscribe` messages are NOT sent on `onopen`
- Subscribes are deferred until `data.type === "welcome"` is received (lines 118-124)
- A 3-second auth timeout closes the connection if welcome never arrives (lines 91-96)

**Status: CLOSED** (for the `onopen` path)

---

### T14 -- WsClient `subscribe()` method sends `subscribe` on already-open connection while `awaitingWelcome = true` (OPEN BLOCKER)

`src/core/data/WsClient.ts:198-211`:

```typescript
public subscribe(pluginId: string, engineUrl: string) {
    engine.subscriptions.add(pluginId);
    this.connectEngine(engineUrl);
    this.send(engine, { action: "subscribe", pluginId });  // line 210
}
```

`this.send()` at line 210 checks only `ws.readyState === WebSocket.OPEN` before sending. It does **not** check `engine.awaitingWelcome`. If:
1. Plugin A connects and triggers ticket auth (`awaitingWelcome = true`)
2. Before the `welcome` arrives, Plugin B calls `subscribe()` on the same engine
3. The WS is already OPEN, so `send()` fires -- Plugin B's `subscribe` message is sent to the server before auth is complete

This allows an unauthenticated subscribe frame to reach the data engine server. Whether the server accepts it depends on server-side enforcement, but the client does not enforce the auth-first guarantee for late joiners.

The `onopen` path (T13) is correctly gated. The `subscribe()` entry point is not.

**Impact:** A second plugin subscribing to an engine in the window between connection open and welcome receipt bypasses the client-side auth gate. The data engine must reject unauthenticated subscriptions server-side for defense in depth, but the ADR-001 intent was client-enforced first-message auth.

**Required fix:** In `subscribe()`, check `engine.awaitingWelcome` before calling `this.send()`. If `awaitingWelcome` is true, skip the early send -- the subscription is already in `engine.subscriptions` and will be sent when `welcome` is received in `onmessage`.

**Status: OPEN (BLOCKER)**

---

## Unregistered Flags

### UF-01 -- `__Host-` prefix with `path: "/api/marketplace/callback"` violates prefix spec

**File:** `src/app/api/marketplace/connect/route.ts:29,37`

The `__Host-` cookie prefix per RFC 6265bis requires `Path=/`. The implementation sets `path: "/api/marketplace/callback"`. Chromium-based browsers enforce this and will silently reject the `Set-Cookie` header when `__Host-` is combined with a non-root path. In practice this means on HTTPS deployments the PKCE cookies may not be set at all, breaking the OAuth flow entirely -- or the browser falls back to setting them without the prefix, losing the security guarantee.

This is a functional correctness issue as well as a security regression. Recommend changing `path` to `"/"` or switching the cookie name to `pkce_state` / `pkce_verifier` without the `__Host-` prefix (accepting the loss of the prefix guarantee).

**Not a declared threat -- flagged as unregistered surface. Does not count as BLOCKER per config, but should be fixed before HTTPS deployment.**

---

### UF-02 -- `src/app/api/camera/extract/route.ts` uses raw `fetch` against user-supplied URL

**File:** `src/app/api/camera/extract/route.ts:17,29`

This route accepts a user-supplied `url` query parameter and passes it directly to `fetch()` without going through `safeFetch`. Current code only executes the fetch if `targetUrl.includes("balticlivecam.com")`, which provides weak host filtering via substring match rather than proper hostname validation. This is outside the declared Phase 3 scope but represents new SSRF attack surface that was not mitigated. A crafted URL like `https://evil.com?x=balticlivecam.com` would pass the check.

**Not a declared threat -- flagged as unregistered surface.**

---

### UF-03 -- `src/app/api/camera/test/route.ts` uses raw `fetch` against user-supplied URL

**File:** `src/app/api/camera/test/route.ts:45,56,68` (confirmed by grep)

The test route uses raw `fetch` with a user-supplied URL. Its auth posture was not reviewed in this phase. Flagged for completeness.

**Not a declared threat -- flagged as unregistered surface.**

---

## Summary

| Metric | Count |
|--------|-------|
| Total threats | 14 |
| CLOSED | 13 |
| OPEN (BLOCKER) | 1 |
| Unregistered flags | 3 |

**Phase 3 MUST NOT SHIP until T14 is resolved.**

The fix is mechanical: add an `awaitingWelcome` guard in the `public subscribe()` method before the `this.send()` call at `WsClient.ts:210`.
