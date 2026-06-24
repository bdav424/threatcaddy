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

## S-netmap — Network Map

**Status:** DONE — see `docs/assistantcaddy-rollout-ledger-2026-06-05.md` for earlier sprint details.

---
