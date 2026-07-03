# Security & Maintenance Follow-up Items

Items noted during Slice-2 hardening that are out of scope for this diff
but should be addressed in a follow-up pass.

---

## Broken README links (missing files)

Two links in `README.md` point to docs that do not exist in the repo:

1. **`docs/intel-note-reporting-procedure.md`** (line 34 — "AI Reporter Entry Point" section)
   Referenced as the standing source of truth for Word template fidelity, source-note
   formatting, table geometry, and visual QA. File not found; either create it or
   remove the section until the doc exists.

2. **`docs/agent-hosts.md`** (line 388 — "Local CaddyAI bridge" section)
   Referenced as a "Detailed runbook" for Agent Hosts setup. File not found; either
   create the runbook or remove the cross-reference.

---

## Standalone-copy path (README)

`/Users/brdavies/workspace/threatcaddy-standalone.html` was a hardcoded developer
machine path committed to README.md. Fixed in Slice-2 to the relative path
`../threatcaddy-standalone.html` (sibling of the repo root). Verify that
`pnpm standard:standalone` / `pnpm update:standalone` scripts use an equivalent
relative or configurable path rather than a hardcoded absolute one.

---

## Token refresh on page reload (AuthContext)

Slice-2 removed tokens from localStorage (memory-only). After a page reload,
`connected` is set to `false` and the user must re-authenticate. The `getAccessToken`
path attempts a token refresh if `refreshTokenRef` is set — but since the refresh
token is no longer in localStorage either, a full re-login is required after every
reload.

Consider implementing a short-lived httpOnly cookie for the refresh token
(server-side) so silent token refresh survives page reloads without re-exposing
credentials to `localStorage`. This requires a server-side change to `auth.ts` to
`Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict` and a client-side
change to omit the refresh token from the request body (cookie is sent automatically).

---

## undici as explicit server dependency

`server/src/services/integration-executor.ts` uses `await import('undici')` for IP
pinning (DNS rebinding TOCTOU fix). undici ships with Node ≥ 18, but it is not listed
in `server/package.json`. Add `undici` as an explicit dependency to prevent silent
fallback to the un-pinned fetch path if the runtime ever drops the built-in.
