# ThreatCaddy Fork Patch Notes

**Repository:** `bdav424/threatcaddy` — fork of `peterhanily/threatcaddy`

This document captures every commit present in `bdav424/threatcaddy` (branch `master`) that does not exist in the upstream `peterhanily/threatcaddy` (`main`). The upstream provides the foundational SPA with Evidence/Products, IOC enrichment, CTI surfaces, and basic backup infrastructure. Everything below represents additions, improvements, and new subsystems built on top of that base.

---

## New Features

### AI & Agents

- **Separate CaddyAI vs AssistantCaddy** — split the monolithic AI interface into two distinct surfaces with separate provider configs, scope, and toolsets (`8c87d5c4`)
- **AssistantCaddy AI provider picker** — dedicated model selector within the AssistantCaddy panel (`08446f70`)
- **AssistantCaddy onboarding checklist** — guided first-run setup flow for new AssistantCaddy users (`15e55ce9`)
- **Capability registry** — auto-wires features (email, calendar, Slack, etc.) to CaddyAI/AssistantCaddy based on connection scope (`223015f9`)
- **CaddyAI investigation write tools** — LLM can now create tasks, add timeline events, push to the knowledge graph, and push to CaddyShack from within chat (`5a6dd0a0`)
- **`run_integration` tool** — shared CaddyAI/AssistantCaddy tool for triggering integrations programmatically (`bcba98e2`)
- **`post_slack_notification` agent tool** — allows AgentCaddy to send outbound Slack alerts as a write tool (`8b959754`)
- **Supervisor note retention cap** — configurable (50–500, default 200) per-user setting for how many notes the cross-case supervisor retains (`ae614b5d`)
- **Strict investigation/admin tool scoping** — tightened LLM tool permissions to investigation vs admin boundaries; added live urlscan.io + OTX connectors (`98195b9f`)
- **Local enrichment cache** — TTL-based in-memory cache for IOC lookups, reduces redundant enrichment calls (`662c6af6`)

### Reports

- **Report/template builder panel** — full S5 implementation: build, preview, and export reports from within the UI (`8af885e0`)
- **Pivot graph as first-class report artifact** — graph snapshots can now be embedded directly into reports (`b7580f2e`)
- **Nunjucks structural templates** — pre-built landscape, adversary, and IR-trends report skeletons (`337491a5`)
- **CaddyShack → Report Template Library** — replaced the upstream team feed with a library of report templates and AI-driven example ingestion (`ba08f13a`)

### Integrations

- **Email (EmailCaddy)** — Gmail/Outlook/IMAP account connect UI with OAuth popout; inbox wired to real mail-bridge transport (`10373021`, `06ff1e9a`)
- **Mail unified accounts** — Google, Proton, and Microsoft accounts under a single management surface with OAuth popout (`14841759`)
- **CalendarCaddy live sync** — wired off hardcoded demo data onto real calendar sync; persistence + two-way sync button (`5c0b4b5c`, `f5eaab57`)
- **Slack DM reading** — OAuth bridge, polling loop, and alert panel integration for inbound Slack DMs (`bc20786d`)
- **Slack direct-token path** — `TC_SLACK_TOKEN` env var bypasses OAuth for server-side or scripted Slack access (`d87be0d5`)
- **Unified provider catalog** — single integrations panel with category filter; 20 new provider stubs added (`fd8fd37b`)

### Authentication & Sync Security

- **S-creds Credential Vault** — password-protected export/import of all desktop integration credentials (mail, calendar, Slack) as an encrypted `.tckeys` file. PBKDF2-SHA256 310k iterations + AES-256-GCM 12-byte IV; base64 wire format; also returns a copyable base64 bundle for cross-device transfer. UI card in Settings › General under the Security section (`c2d4eb89`, `a499ebd6`)
- **TOTP two-factor authentication** — Phase 1: time-based OTP 2FA (`9404e291`)
- **Passkey (WebAuthn) authentication** — Phase 2: hardware-key and biometric login (`54aa9e1b`)
- **Client-side AES-256-GCM sync encryption** — all sync payloads encrypted before leaving the browser (`a2805e1e`)
- **Passkey sync-passphrase prompt** — passkey-backed derivation of the sync encryption key (`cadb12e9`)
- **Device enrollment gate** — S8 Phase 3: new devices must complete enrollment before receiving encrypted sync data (`d762d7e5`)
- **Strip plaintext from encrypted sync push** — ensures no cleartext content leaks through the sync channel (`c685d0a4`)
- **S8 desktop sync auth MFA (TOTP + passkeys)** — standalone desktop TOTP and passkey MFA for sync-auth, independent of team server. Inline RFC 6238 TOTP with SHA-1/HMAC-SHA1 (no native crypto deps); secrets encrypted via OS safeStorage in main process; renderer bridge exposes opaque save/get/clear only. WebAuthn passkey registration/verification via `navigator.credentials` (desktop-only). UI card in Settings › General under Security. Dexie v38 `syncAuthSettings` table for UI metadata. *(S8 commit 1–2)*

### Mobile & PWA

- **S-mobile LAN sync diff/merge engine** — full bidirectional Dexie snapshot sync over LAN. Desktop serves GET/POST /sync endpoints; mobile PWA client calls `syncNow(url, token)` to pull desktop snapshot (newer-wins merge into local Dexie) then push local snapshot back. 18-table coverage. Bidirectional IPC bridges Electron main ↔ renderer so the Node sync server can read/write Dexie without duplicating data in the main process. *(S-mobile commit 1–4, `9604c7a2`–`f36e9d2a`)*
- **Mobile sync settings panel** — PWA-only Settings card with IP:port + Bearer token inputs (localStorage-persisted), Sync Now button with result counts, 5-min auto-sync (foreground-only), and error display. Self-hides inside Electron. (`f36e9d2a`)
- **Capacitor 8.4.1 native shell** — Android + iOS native app scaffolding (S-mobile step 2) (`6f8914c0`)
- **Push notification infrastructure** — S-mobile step 6: native push plumbing for mobile alerts (`c1098846`)
- **PWA manifest enhancements** — `share_target`, `shortcuts`, and `display_override` for the Mobile companion edition (`d6a64c3f`)

### Desktop (Electron)

- **Electron-builder packaging** — `electron-builder` added with mail-providers.mjs and missing mail deps; creates distributable installers (`0bab4197`)
- **Auto-update via GitHub Releases** — `electron-updater` wired to GitHub Releases for OTA desktop updates (`ec6ea5c2`)
- **Cross-platform startup hardening** — loopback server binding, namespace fix, service worker compatibility, postinstall script (`0b7c1819`)

### Investigations & TLP

- **TLP/PAP classification inheritance** — classification set on an investigation propagates to its header badge and panel border (`3fd14dd3`, `179e55b8`)
- **TLP color border on selected investigation** — the investigation list highlights the selected item with its TLP color (`30717712`)
- **TLP color badge** — right-aligned TLP badge on investigation cards with full border outline and briefcase icon tint (`200cc3f7`)
- **Investigation card color mode** — 3-way setting (Manual / TLP / Combined) in Settings › Appearance. Manual: existing color-strip behavior unchanged. TLP: card background tinted from live TLP classification (RED/AMBER/GREEN/CLEAR). Combined: TLP drives border treatment, manual color tints card background. Persisted in localStorage. *(S8 commit 3)*

### NetworkMap (NetMap)

- **NetworkDevice + NetworkScanJob schema** — new Dexie tables (migration) for storing network scan results (`ceb29898`)
- **Desktop LAN discovery** — `net-scan.mjs` electron process: ARP sweep + TCP probe for device discovery (`44525af1`)
- **IPC bridge + Dexie handler** — preload/renderer plumbing to surface scan results in the SPA (`3a4bda44`)
- **NetworkMapPanel UI** — scan controls, device list, one-click IOC promotion and graph add (`b9e959b1`)

### VirtualCaddy

- **VirtualCaddy subsystem** — air-gapped static analysis watcher: monitors a drop folder for files, runs static analysis, ingests results into a new Dexie schema (`393d65e1`, `f69c3dc2`)
- **IPC bridge** — preload exposure and renderer ingest handler for VirtualCaddy events (`7992869a`)
- **VirtualCaddy UI panel** — file-watch ingest panel with CaddyAI tools and capability registry integration (`6cad8cc2`, `3c724a80`)

### Edition System

- **Edition config + feature flag system** — foundation for building multiple product tiers from the same codebase (`5c7cb4c6`)
- **Lite edition Vite build config** — separate bundle target for the Lite tier (`cf8f490a`)
- **Pro edition build config** — formalises the existing feature set as the "Pro" tier (`9e9a32c5`)
- **Mobile edition build config stub** — foundation for S-mobile packaging (`493b6198`)
- **Edition badge in UI** — visible edition indicator in the app chrome with accompanying feature flag tests (`953528d4`)

### Task Management

- **Subtask hierarchy overhaul** — 3-level nesting, drag-to-reorder, and inline editing for tasks (`545861c2`)

### Alerts & Notifications

- **Escalating meeting alert panel** — proportional re-surface checkpoints so high-priority calendar alerts escalate until acknowledged (`031a4e2d`)

### Command Palette

- **Quick-pivot + hunt narrative CTA** — command palette now surfaces investigation pivot shortcuts and threat-hunt narrative prompts (`96332832`)

### Chat

- **CaddyAI background streaming continuity** — `ChatStreamContext` keeps streams alive when switching workspace tabs (`5b3e55ab`)
- **Write-tool approval overlay** — pending write-tool requests surface as a global portal overlay so they are never missed (`5b3c4d3c`)

---

## UI / UX

- **Global hover tooltips** — tooltips added to all actionable elements across the app (`d15493e7`)
- **Persist safe/yolo mode** — CaddyAI tool-approval preference and active-session warning survive page reloads (`e4003da3`)
- **TLP:CLEAR frosted glass badge** — Pop Out button moved inline with action bar; CLEAR badge styled for light/dark (`17f603b0`)
- **Unified ProviderModelPicker** — shared component replaces duplicated provider+model selectors across CaddyAI and AssistantCaddy (`43062e90`)
- **Inline local endpoint discovery** — Local LLM config surface includes endpoint auto-discovery directly (`fd4adf70`)
- **Investigation memory controls moved** — memory management settings relocated to the AgentPanel policy editor instead of a buried settings panel (`a73a8bd0`)
- **Agent Hosts disclosure + graph caption editing** — surfaced previously hidden features in the UI (`83c37e29`)
- **Panel seam hover highlight** — all panels sharing a resize seam light up together on hover for clearer drag affordance (`8fa367f9`)
- **Frosted glass system fixed** — `frostedPanels` wired to the real glass CSS system; broken `theme-frosted` stub removed (`45302ba3`)
- **CSS-var theme tokens** — replaced hardcoded Tailwind `amber`/`rose` color classes with CSS variable tokens for proper theming (`dd196c57`)
- **Light/dark theme tags** — tag color swatches now visually reflect their assigned mode instead of rendering identically (`7f14ec10`)
- **Responsive integrations columns** — integrations panel uses responsive column layout with theme vars and sort-by-name (`0e02c262`)
- **Compact Notifications settings** — communications account management separated from the main Integrations panel (`8ea37deb`)

---

## Desktop

- **Background images and animations** — Electron renderer now correctly renders CSS background images and animations (`9b37a2a6`)
- **OAuth client IDs from env** — `.env.desktop` via `dotenv-cli`; IDs are never hardcoded (`bf5b2c0d`, `2ade3308`)
- **Baked-in Google OAuth client ID** — fallback client ID baked into the desktop build for zero-config mail OAuth (`c4a14797`)

---

## Fixes

- **Corruption scrub: "nINTEL" → "notic"** — a find/replace gone wrong had mangled "notic" across the codebase; fully restored (`a3a47015`)
- **Production build repair** — broken build masked by a test syntax error; fixed at root (`2e04298a`)
- **Notes/Tasks panel sizing** — workspace panels opened from the Investigation tree now size correctly (`96137355`)
- **`isOverdue` timezone safety** — due-date comparison now uses local date strings instead of UTC, fixing false "overdue" in non-UTC zones (`57e67923`)
- **Dropdown z-index isolation** — integration card dropdowns no longer bleed stacking context onto adjacent cards (`8386c471`)
- **Dead connector UIs removed** — cleaned up connector stubs that were blocking CaddyAI workspace layout (`3addd16f`)
- **External backup URL validation** — validation logic now matches the actual module contract (`32752a01`)
- **`min-h-0` on notes/tasks roots** — prevents flex children from overflowing their workspace containers (`fbe65b47`)
- **OCI naming scrub** — final vendor-agnostic rename pass; all OCI remnants replaced (`158f7218`)
- **CaddyShack nav → "Templates"** — navigation label and icon updated to match the new report template library purpose (`4c1428f7`)
- **EmailCaddy empty state copy** — cleaner CTA and account status text (`8c16f407`)
- **Dev-only execution gate removed** — runtime wiring panels that were never meant to ship are gone (`c387f4e6`)
- **Model pricing: claude-opus-4-8** — new model added to the pricing table for accurate cost tracking (`8c412e75`)
- **`deriveSyncKeyForPassword` type fix** — salt parameter narrowed to `string` to satisfy TypeScript strict checks (`cda2bc09`)
- **ESLint errors resolved** — all 16 lint errors fixed; warnings unchanged (`5b32fbea`)

---

## Performance

- **Lazy-mount inactive workspace panels** — AssistantCaddy panels not in view are deferred until first activation, reducing initial render cost (`3fd6d2e4`)
- **Memoize workspace content components** — prevents cross-workspace re-renders when switching tabs (`0933d3df`)

---

## Infrastructure & Build

- **Bridge extraction** — `MailBridge`, `CalendarBridge`, and `DesktopCalendarBridge` extracted from inline usage into `src/lib/bridges.ts` (`709858a0`)
- **Upstream ports** — CaddyShack social feed sub-components, evidence/products i18n locale files (21 languages), and GitHub Pages deploy workflow ported from peterhanily (`e18bb933`, `4c5e3320`, `31ac2bb2`)
- **OCI-sync and E2E tests ported** — smoke-surface and sample-entities test suites ported from upstream (`9ccacd21`)
- **Test suite hardening** — resolved 14+ pre-existing test failures across 5 suites; fixed timeout flakes, cleanup races, and stale selectors (`140bfee5`, `06e36f58`, `588ac81d`, `035d4eed`, `37b59b3e`)

---

## Docs

- **Comprehensive README** — full rewrite covering desktop packaging, all 8 feature groups, and deployment options (`dae7ddf8`)
- **System overview document** — high-level architecture and capability overview (S6) (`057ff28d`)
- **Rollout ledger** — running log of feature delivery status and session summaries (`various ledger commits`)
- **Agents maintenance log** — 2026-06-20 session summary appended (`b3456c8a`)
