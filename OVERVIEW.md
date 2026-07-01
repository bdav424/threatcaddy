# ThreatCaddy V3 — System Overview

> Architecture, AI model, and design decisions for the master branch as of this PR.

---

## The Two-Pillar Model

ThreatCaddy V3 is organized around two independent, strictly-scoped AI pillars:

| Pillar | Scope | Agents | Tools |
|---|---|---|---|
| **CaddyAI + AgentCaddy** | Investigation — notes, IOCs, timelines, tasks, enrichment | 17 builtin profiles (CISO, IOC Enricher, Threat Hunter, etc.) | 58 tools (investigation + admin-scoped) |
| **AssistantCaddy** | Admin — email, calendar, routing, onboarding | Overview panel | Shared `run_integration` + routing |

The pillars share API keys (the user enters each key once) but have separate model configs (`assistantLlmSeparate` flag + `assistantLlm*` fields). A user can run CaddyAI on Claude and AssistantCaddy on a cheaper local model, or vice versa.

---

## Architecture

```
Browser / Standalone HTML
  └── React SPA (src/)
        ├── CaddyAI Chat       (src/components/Chat/ChatView.tsx)
        ├── AgentCaddy         (src/components/Agent/)
        ├── AssistantCaddy     (src/components/CaddyAssistant/)
        │     ├── Overview / Onboarding
        │     ├── EmailCaddy
        │     └── CalendarCaddy
        ├── Reports Panel      (src/components/Reports/ReportsPanel.tsx)
        ├── Integrations       (src/components/Integrations/)
        └── Workspace Shell    (src/components/WorkspacePanels/)

Chrome Extension (extension/src/)
  ├── background.js  — LLM streaming, fetch proxy, notifications
  ├── bridge.js      — page ↔ extension relay
  └── content.js     — quick capture UI

Desktop App (desktop/)           [optional]
  ├── main.mjs       — Electron main process
  ├── mail-bridge.mjs — IMAP/SMTP adapter (confirmedSend guard)
  └── preload.mjs    — secure IPC bridge

Team Server (server/)            [optional, self-hosted]
  ├── Hono + Drizzle + PostgreSQL
  ├── Team sync (per-investigation opt-in)
  ├── Server-side agents (via caddy-agent-bridge.ts)
  └── Backup/restore API
```

**Data layer.** All investigation data lives in IndexedDB via Dexie (schema version 33, adding `reportTemplates`). Nothing leaves the browser unless the user explicitly enables team sync or AI calls.

---

## The Four Promises (preserved throughout)

1. **Local-first / no accounts.** All data in IndexedDB. API keys go only to the chosen LLM provider, never stored server-side.
2. **Zero setup.** Open the URL and work; standalone HTML works from `file://` without a server.
3. **Optional server.** Team sync is opt-in, per-investigation, self-hosted Docker.
4. **Encryption at rest.** AES-256-GCM + PBKDF2 (600k iterations) for backups and server-stored data.

---

## Database (Dexie, v33)

New table in this PR: `reportTemplates` (type `ReportTemplate`). Added to all 10 required places per the Dexie checklist: types → db → backup-data → backup-restore → backup-crypto → export/import sanitizer → db.test → export.test → cascade delete in useFolders.

---

## AI / LLM Architecture

### Config split (`src/lib/assistant-llm-config.ts`)

```
resolveCaddyAiConfig(settings)       → uses llmDefaultProvider / llmDefaultModel
resolveAssistantLLMConfig(settings)  → uses assistantLlm* (or falls back to CaddyAI's config)
```

When `settings.assistantLlmSeparate` is false/undefined, AssistantCaddy transparently reuses CaddyAI's config. The user opts in to a separate model via the provider picker in the AssistantCaddy overview panel.

### Provider picker (S2)

The AssistantCaddy overview panel shows a compact `AssistantProviderPicker` bar listing every configured provider (Anthropic, OpenAI, Gemini, Mistral, local). Selecting one writes `assistantLlmSeparate: true` + `assistantLlmDefaultProvider` to localStorage without touching CaddyAI's settings. "Inherits CaddyAI" reverts to shared config.

### Local LLM

`sendDirectToLocal` in `llm-router.ts` bypasses the extension entirely for local endpoints (Ollama, vLLM, LM Studio). Handles SSE streaming + text-based tool parsing fallback. The desktop app is the right home for live transports that can't run in the browser.

---

## AgentCaddy

17 builtin profiles. Key invariants:

- **Tool allowlist** in `buildAgentToolset` (`caddy-agent.ts`) is single source of truth for both the LLM-visible tool list and runtime authorization — they can't drift. Locked by 9 invariant tests.
- **Action-class policy**: 6 classes (read / enrich / fetch / create / modify / delegate). `delegate` is always auto-approved so lead→specialist handoff can never silently break.
- **Delegation**: Lead/executive agents get `delegate_task` + `list_agent_activity` + `review_completed_task`. Auto-escalates after 3 rejections; escalated tasks frozen to all agents.
- **Idempotency**: write tool calls carry `${deploymentId}:${cycleStartedAt}:${toolName}:fnv1a(args)` keys — safe across client crashes and handoff boundaries.
- **Metrics**: `AgentMetrics` tracks cycles, tool calls, tokens, cost, error histogram, cycle outcomes. Per-cycle `AgentCycleSummary` is rendered inline.

---

## Tool Scoping (S3 foundation)

Tools carry an explicit scope:

| Scope | Access | Examples |
|---|---|---|
| `investigation` | CaddyAI + AgentCaddy only | create_note, get_iocs, delegate_task |
| `admin` | AssistantCaddy only | (future: send_email, post_message) |
| `shared` | Both AIs | `run_integration` |

`run_integration(integrationId, input)` is the one explicitly shared capability — lets either AI trigger a VirusTotal/Shodan/etc. lookup within action-class policy. Maps to `enrich` class (auto-approvable) for read-only enrichment, `modify` for anything that sends.

---

## Integrations (S3)

Live connectors: VirusTotal, Shodan, urlscan.io, AlienVault OTX (IP/domain/hash). All use the declarative `IntegrationTemplate` pattern with a connection-test gate before any production calls.

Integration executor runs inside the extension or desktop process (not the renderer) to respect the no-fetch-in-lib-files rule.

---

## Reports Panel (S5)

New `Reports` sidebar view. Architecture:

- **Templates**: `ReportTemplate` type stored in Dexie `reportTemplates` table. 4 builtins (Incident Report, Threat Intel, Executive Brief, Vulnerability Assessment) + user CRUD. Pattern mirrors `NoteTemplate` / `PlaybookTemplate`.
- **Active reports**: ephemeral (not persisted), built in-component state. Avoids Dexie complexity for transient authoring state.
- **Export**: Markdown download (copy-to-clipboard + file download). Section-by-section authoring with auto-resize textareas.
- **Hook**: `useReportTemplates()` in `src/hooks/useReportTemplates.ts`.

---

## AssistantCaddy Onboarding (S4)

State machine in `src/lib/assistant-onboarding.ts`:

```
Steps (in order):
  1. configure-ai       required  — checks settings.llmAnthropicApiKey / openai / local
  2. connect-email      required  — checks settings.emailAccounts.length > 0
  3. enable-integration optional  — checks installedIntegrationCount > 0
  4. set-notifications  optional  — (future: checks notification settings)

State persisted in localStorage under 'assistant-onboarding-state-v1':
  { dismissed: boolean, skippedSteps: OnboardingStepId[] }
```

The onboarding card shows in the AssistantCaddy overview panel when any required step is incomplete and the user hasn't dismissed it. Optional steps can be individually skipped. 16 unit tests cover step sequencing, completion logic, and persistence.

---

## Workspace Shell

Mosaic-style multi-panel workspace. Each panel has two resize thresholds:
- `compact` < panel-specific `compactWidth/compactHeight` — degrades gracefully, primary action always reachable
- `minimized` — DOM preserved/kept-mounted, state intact

Panel ID constants are stable (referenced in user localStorage). New panels added: `reports-workspace` (860×640, compact at 700px).

---

## Security Model

- **No fetch/WebSocket/exec in `src/lib/`** — enforced by CI scanner (`scripts/assistantcaddy-no-live-call-scan.mjs`).
- **No secrets in renderer bundle** — renderer holds only `credentialReferenceId`; actual keys stay in the OS keychain (desktop) or extension storage.
- **All network transport in `desktop/` or `server/`** — mail-bridge has a `confirmedSend: true` guard; no silent sends.
- **Injection-resistant**: all inbound email/Slack content treated as data, never executed as instructions. System prompts for AssistantCaddy are kept separate from user-content context.
- **Backup encryption**: AES-256-GCM, PBKDF2 (600k iterations), per the existing `backup-crypto.ts` implementation.

---

## i18n

21 languages. All new keys added with English values, then `pnpm translate:sync` fills the other 20. New key added in this PR: `sidebar.reports` ("Reports").

---

## Pre-commit Gate

Every commit in this PR passed:
- `node_modules/.bin/tsc --noEmit` — clean
- `pnpm lint` — no new errors (10 pre-existing react-refresh errors in workspace shell files, pre-existing cloud-sync parse error)
- `pnpm test:run` — new tests pass; known pre-existing failures: `cloud-sync.test.ts`, `caddyassistant-overview-setup.test.tsx` (label mismatch), `caddyassistant-workspaces.test.tsx`, others unrelated to this PR's changes

---

## Commit Map (this PR)

| Commit | Slice |
|---|---|
| `8c87d5c` | feat(ai): AI split + calendar stamp/sort fixes |
| `98195b9` | feat(tools): strict scoping + urlscan + OTX connectors |
| `1484175` | feat(mail): unified email accounts + OAuth popout |
| `f5eaab5` | feat(calsync): calendar persistence + two-way sync button |
| `1037302` | feat(email): account connect UI |
| `0e02c26` | feat(integrations): responsive columns, theme vars, sort |
| `bcba98e` | feat(tools): run_integration tool + shared scope (S3) |
| `8af885e` | feat(reports): report/template builder panel (S5) |
| `08446f7` | feat(assistant): AssistantCaddy AI provider picker (S2) |
| `15e55ce` | feat(assistant): AssistantCaddy onboarding checklist (S4) |

---

## Follow-ups (account-bound, not in this PR)

- **Live email transport**: wire `mail-bridge` into `email-provider-runtime-executor`; requires real mailbox + Electron run
- **Gmail/Outlook OAuth**: `googleapis` / `@azure/msal-node` + Graph API; requires provider OAuth app registration
- **Proton Bridge**: run `proton-bridge`/`hydroxide`, point adapter at `127.0.0.1`; requires Proton account
- **Slack transport**: `@slack/web-api` behind `messaging-runtime-executor`; requires workspace + scoped token
- **Durable sync**: pick storage backend (file/S3/team server) behind the durable gate
- **Desktop packaging**: `electron-builder` → `pnpm desktop:package`; see `MAKE-IT-AN-APP.md`
- **Mobile / virtual sandbox**: blocked on WireGuard/Headscale and VM setup
- **S5-ext-b**: LLM-drafted report sections (needs model configured)
