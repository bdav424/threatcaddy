# ThreatCaddy V3 Rollout Ledger

Tracks sprint group commits and status. Each sprint's commits are listed with their hashes once landed.

---

## S7 — Edition Split

**Status:** DONE

| # | Commit | Hash | Description |
|---|--------|------|-------------|
| 1 | `feat(editions): edition config + feature flag system` | `5c7cb4c6` | `src/lib/edition.ts`, `src/lib/feature-flags.ts`, capability-registry guards |
| 2 | `feat(editions): Lite edition Vite build config` | `cf8f490a` | `vite.config.lite.ts`, `build:lite` script |
| 3 | `feat(editions): Pro edition build config (formalize existing)` | `9e9a32c5` | `vite.config.pro.ts`, `build:pro` script |
| 4 | `feat(editions): Mobile edition build config stub (foundation for S-mobile)` | `493b6198` | `vite.config.mobile.ts`, `capacitor.config.ts` updated, `build:mobile`/`cap:sync` scripts |
| 5 | `feat(editions): edition badge in UI + feature flag tests + ledger update` | *(this commit)* | Sidebar edition badge, `edition.test.ts`, `feature-flags.test.ts` |

**Edition map:**
- `lite` — No Electron-specific features (`virtualcaddy`, `netmap`, `auto-updater`, `desktop-bridges`, `safe-storage` disabled)
- `pro` — All features (default)
- `mobile` — Pro+Mobile features only (no desktop-only capabilities)

---

## S-creds — Credential Vault

**Status:** DONE

| # | Commit | Hash | Description |
|---|--------|------|-------------|
| 1 | `feat(desktop): S-creds credential vault bridge — AES-256-GCM export/import` | `c2d4eb89` | `desktop/creds-bridge.mjs` — IPC bridge, crypto spec (PBKDF2 310k + AES-256-GCM 12-byte IV, base64 wire), `creds:export` / `creds:import` / `creds:open-file` |
| 2 | `feat(ui): S-creds Credential Vault — renderer bridge + Settings card` | `a499ebd6` | `preload.mjs` exposes `window.threatcaddyCreds`; `src/lib/creds-bridge.ts` thin IPC wrapper; `CredentialVault.tsx` UI card; `SettingsPanel.tsx` wired |
| 3 | `feat(test): S-creds — crypto round-trip + renderer bridge tests + ledger` | *(this commit)* | 16 new tests: 6 crypto round-trip, 10 renderer bridge mock (desktop + web mode) |

**Spec:**
- KDF: PBKDF2-SHA256, 310,000 iterations, 32-byte random salt
- Encryption: AES-256-GCM, 12-byte random IV, auth tag appended to ciphertext
- Wire format: `{ version: 1, salt: <base64>, iv: <base64>, data: <base64(cipher‖tag)> }`
- Import path: `.tckeys` file or base64 string; renderer never sees raw credentials

---

## S-netmap — Network Map

**Status:** DONE — see `docs/assistantcaddy-rollout-ledger-2026-06-05.md` for earlier sprint details.

---

## S8 — MFA-gated Sync Auth + Investigation Color Mode

**Status:** DONE

| # | Commit | Hash | Description |
|---|--------|------|-------------|
| 1 | `feat(security): S8 TOTP setup + DB schema + IPC bridge` | *(pending)* | `src/lib/totp.ts` (inline SHA-1/HMAC-SHA1, RFC 6238, generateSecret/getCode/verifyCode/getUri); `src/lib/sync-auth-bridge.ts` (renderer IPC wrapper); `desktop/sync-auth-bridge.mjs` (safeStorage-backed IPC handlers); `desktop/preload.mjs` + `main.mjs` wired; Dexie v38 `syncAuthSettings` table |
| 2 | `feat(security): S8 passkey.ts + SyncAuthSettings UI` | *(pending)* | `src/lib/passkey.ts` (desktop-only WebAuthn wrapper: registerPasskey/verifyPasskey/passkeySupported); `SyncAuthSettings.tsx` (Settings > General card — TOTP setup with copyable secret+URI, passkey registration, disable MFA); `SettingsPanel.tsx` wired |
| 3 | `feat(ui): S8 investigation color mode` | *(pending)* | `src/lib/investigation-color-mode.ts` (manual/tlp/combined, localStorage-persisted); `InvestigationCard.tsx` wired (TLP-derived bg tint, color strip per mode); Settings > Appearance 3-button toggle; i18n keys added + synced to 21 locales |
| 4 | `feat(test): S8 tests + ledger` | *(pending)* | totp.test.ts (RFC 6238 vectors + secret/code/verify/URI), investigation-color-mode.test.ts, sync-auth-bridge.test.ts (desktop + web mode mocks); ROLLOUT-LEDGER.md + PATCH-NOTES.md updated |

**Security posture:**
- TOTP secrets stored via OS safeStorage (`electron.safeStorage`); Dexie table holds only non-secret metadata
- Passkey public credential IDs stored via safeStorage; WebAuthn ceremony runs renderer-only (no IPC for credential ops)
- Sync auth settings excluded from backup/export (per-device enrollment; no cross-device migration of security state)
- `syncAuthBridge.isAvailable()` guard hides all UI in web/SPA mode

**Implementation notes:**
- TOTP: pure renderer-side (no fetch, no exec) with inline SHA-1/HMAC-SHA1 so functions stay synchronous
- QR code display: not rendered (no QR dep); shows copyable base32 secret + otpauth:// URI for manual authenticator entry
- Color mode: reads from localStorage on every InvestigationCard render (no re-subscribe needed; Settings toggle triggers re-render)

---
