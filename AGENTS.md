# ThreatCaddy AI Maintainer Guide

This file is for Codex, Claude Code, and any other AI maintainer working on ThreatCaddy. Read it before changing the app. When you make a material architecture, storage, build, sync, extension, or AI-agent change, append a short dated note to the maintenance log at the bottom.

## Project Shape

ThreatCaddy is a local-first threat investigation workspace for analysts. The main client is a React 19 + TypeScript + Vite app in `src/`. Data is stored first in browser IndexedDB through Dexie in `src/db.ts`. The optional team server in `server/` adds auth, PostgreSQL-backed collaboration, WebSockets, server-side LLM routing, and bot/agent runtime support. The browser extension in `extension/` adds clipping, page capture, and browser-mediated API/fetch workflows.

Important entry points:

- `src/App.tsx`: top-level app state, navigation, import/export hooks, entity wiring.
- `src/db.ts`: Dexie schema and migrations. Treat schema changes as high risk.
- `src/types.ts`: shared entity and settings types.
- `src/hooks/use*.ts`: local entity CRUD and filtering hooks.
- `src/lib/export.ts`: JSON export/import/merge import.
- `src/lib/backup-*.ts`: encrypted backup and restore payloads.
- `src/lib/llm-*.ts`, `src/lib/caddy-agent*.ts`: CaddyAI and AgentCaddy tools, routing, policy, and execution.
- `public/locales/*`: i18n files. English keys must be propagated to other locales.
- `vite.config.ts`: served/PWA build.
- `vite.config.single.ts`: offline standalone build.
- `scripts/`: repo maintenance helpers.

## Data And Storage Rules

ThreatCaddy data lives in the browser origin that opened the app. The database name can be the same while the storage bucket is different.

Examples of different buckets:

- `http://127.0.0.1:5173`
- `http://localhost:5173`
- `http://127.0.0.1:4173`
- `https://threatcaddy.com`
- `file:///Users/brdavies/workspace/threatcaddy-standalone.html`

Do not assume notes are missing just because one entry point cannot see them. First suspect an origin split. Export from the origin where the notes are visible, then merge-import into the chosen origin. Prefer merge import for recovery. Full replace is destructive and should only be used intentionally.

When adding a Dexie table or changing entity persistence, update all relevant layers:

- `src/types.ts`
- `src/db.ts`
- `src/lib/backup-data.ts`
- `src/lib/backup-restore.ts`
- `src/lib/backup-crypto.ts`
- `src/lib/export.ts`
- `src/hooks/useFolders.ts` cascade cleanup where applicable
- tests that assert schema version, export/import counts, backup payloads, or encryption behavior

## Dev Server Vs Standalone

`127.0.0.1:5173` is the Vite development server. Use it for development, HMR, local bridge testing, and same-origin testing. It is not the normal offline user artifact.

The standalone file is the offline `file://` artifact. Build it with:

```bash
pnpm build:single
```

The generated HTML source of truth is:

```text
dist-single/index.html
```

The standalone build may also emit top-level JS sidecars in `dist-single/`. Keep them beside whichever standalone HTML copy is being used.

The sibling workspace convenience copy is:

```text
/Users/brdavies/workspace/threatcaddy-standalone.html
```

Refresh that copy with:

```bash
pnpm update:standalone
```

That command builds the current standalone bundle, copies it to the sibling workspace HTML file, and copies the top-level JS sidecars emitted by the single-file build. Updating the HTML updates app code only. It does not move or merge browser data, because the data lives in browser storage for the origin/path the user opened.

The dev server also serves the latest built standalone at:

```text
http://127.0.0.1:5173/threatcaddy-standalone.html
```

That route uses the `127.0.0.1:5173` storage bucket because it is served from the dev origin. A `file://` standalone opened from Finder uses its own separate bucket.

## Standalone Release Rules

This workspace is standalone-first for user-facing changes. Unless the user explicitly asks to validate only the Vite dev server, finish app updates by running `pnpm update:standalone` so `/Users/brdavies/workspace/threatcaddy-standalone.html` receives the new code. Use `127.0.0.1:5173` for development and browser testing only, and remember that data seen there is not the same browser storage bucket as the loose `file://` standalone file.

The hosted standalone download must be copied from `dist-single` after `pnpm build:single`. Use:

```bash
pnpm copy:standalone
```

This writes `dist/threatcaddy-standalone.html` and copies the standalone JS sidecars next to it. The `deploy` script already calls this helper. If the standalone build changes to emit new top-level JS sidecars, keep `scripts/copy-standalone-artifacts.mjs` and the Vite dev middleware in sync.

Before overwriting a user's loose standalone file, explain that this preserves code freshness but does not merge data between origins. Back up/export first before major storage migrations or any downgrade.

## AI And Agent System Map

CaddyAI is the human-driven assistant. AgentCaddy is the autonomous multi-agent layer.

Key files:

- `src/components/Chat/ChatView.tsx`: chat UI, streaming, tool-call display.
- `src/hooks/useLLM.ts`: client LLM hook.
- `src/lib/llm-router.ts`: provider routing, including local/server/extension paths.
- `src/lib/llm-tool-defs.ts`: LLM-visible tool schemas.
- `src/lib/llm-tools.ts`, `src/lib/llm-tools-read.ts`, `src/lib/llm-tools-write.ts`: tool execution.
- `src/lib/caddy-agent-policy.ts`: action class policy.
- `src/lib/caddy-agent.ts`: agent prompt/toolset construction and single-cycle execution.
- `src/lib/caddy-agent-manager.ts`: concurrent deployment runner.
- `src/lib/builtin-agent-profiles.ts`: built-in agent profile definitions.
- `src/components/Settings/AgentHostsConfig.tsx` and `src/lib/agent-hosts.ts`: external REST skill hosts.

When adding or changing tools, keep the visible schema, executor, policy action class, write-tool classification, tests, and built-in profile allowlists aligned.

## INTEL Intel Note Reporting Rules

ThreatCaddy reporting work is template-fidelity work, not generic document generation. When producing INTEL-style intel notes, future AI reporters must preserve the established Word note format unless the user explicitly asks for a redesign.

Known-good examples on this workstation include:

- `/Users/brdavies/Downloads/INTEL Intel Note_GitHub Supply Chain Breach_22May.docx`
- `/Users/brdavies/Downloads/INTEL Intel Note TeamPCP Megalodon report.docx`
- Older TeamPCP sample notes when present under `/Users/brdavies/Downloads/` or the current run package.

The dedicated procedure lives in `docs/intel-note-reporting-procedure.md`; update that file when the INTEL report format or QA rules change.

Required workflow for INTEL intel notes:

- Treat the prior INTEL DOCX as a locked visual template. Remove and replace old report text in-place instead of rebuilding the document from scratch.
- Preserve paragraph styles, heading hierarchy, spacing, caption placement, table fills/colors, table widths, row padding, headers/footers, logos, left-side visual theme elements, and source-note formatting.
- Preserve the source-note convention used by older reports, including superscript-style markers such as `1`/`¹` in body text and the matching `See: <source>` note text. Do not replace this with a generic Sources section unless the template already uses one.
- Use the existing table shape that matches the report type. For GitHub supply-chain notes, prefer the simple two-column IOC table pattern from the GitHub Supply Chain Breach sample: `IOC Type` / `IOC Value`. Do not add extra Notes columns or duplicate table cells unless the template already has them.
- Under `Recent Activity`, preserve lower-level subheads such as `GitHub Intrusion Disclosure`, `Megalodon CI/CD Malware Campaign`, `Malware Functionality and Objectives`, and `Assessment` when that structure fits the topic.
- Do not include noisy GitHub owner or affected-repository tables in customer-facing notes unless the user explicitly asks for victim/outreach tables. Keep repository-owner analysis in CSV/working artifacts or an appendix with clear caveats.
- Jinja is only a content assembly and validation aid. It does not replace the Word template or visual QA.
- Before final delivery, compare the new DOCX against at least one known-good INTEL sample and check for style drift, malformed tables, missing captions, missing source markers, source-note placement errors, awkward spacing, and table text clipping.
- If Word/visual render QA is unavailable, state that visual QA is incomplete and preserve the blocker. Do not imply the note passed final layout review.

## Extension And Local Bridges

The extension treats hosted HTTP(S), local dev origins, and `file://` standalone pages as different targets. `file://` requires explicit browser permission for file URL access.

Local bridge defaults:

- Local LLM bridge (`everybody_llmbo`, OpenAI-compatible): `http://127.0.0.1:11434/v1`
- Local LLM API key for the current workstation bridge: `codex-local-dev`
- Local LLM model for the current workstation bridge: `gpt-5.4`
- CTI Agent Host: `http://127.0.0.1:8766`

Use `127.0.0.1:11434` plus the `/v1` API path in ThreatCaddy settings. Do not use `127.0.0.0/11434`; that is not the expected loopback host/port shape.

Current workstation `everybody_llmbo` implementation:

- LaunchAgent: `/Users/brdavies/Library/LaunchAgents/com.brdavies.everybody-llmbo.plist`
- Bridge source: `/Users/brdavies/.codex/packages/everybody_llmbo-zip/everybody_llmbo/codex_rest_server.py`
- Codex wrapper: `/Users/brdavies/.codex/bin/codex-chatgpt-exec`

The wrapper is intentional. It runs `codex exec --ignore-user-config` for `exec` requests so the local bridge stays on the ChatGPT-backed Codex CLI auth path instead of inheriting a user/provider config such as alternate CLI provider. If `/v1/models` works but chat returns "The model completed its action, but did not return a written response," test `POST /v1/chat/completions` directly and check for upstream auth errors such as `401 NotAuthenticated`.

Use `pnpm check:caddyai-bridges` to check common local bridge wiring.

## Verification Defaults

At minimum after app code changes:

```bash
pnpm exec tsc -b tsconfig.app.json
pnpm exec tsc -b tsconfig.node.json
```

Run focused tests when touching storage/export/import/sync/LLM tools:

```bash
pnpm test:run -- src/__tests__/export.test.ts
pnpm test:run -- src/__tests__/db.test.ts
pnpm test:run -- src/__tests__/llm-tools.test.ts
```

Run `pnpm build:single` or `pnpm update:standalone` when the user expects the loose standalone file to receive app updates.

Before long-running ThreatCaddy rollout work, read `docs/codex-experience-memory.md` after this file. It contains project-local reusable process lessons intended to reduce repeated lookup and token use. Keep product requirements, bug status, artifact hashes, and investigation substance in the ledger/handoff instead.

## Reusable Process Lessons

When building a dockable, draggable, minimizable, or popout panel runtime around an existing React workspace, use an additive runtime first instead of wrapping complex feature surfaces wholesale. Keep durable domain state above the panel shell, and let the shared panel runtime own only presentation state such as mode, geometry, focus, z-order, and dock membership. This prevents minimize/popout behavior from resetting drafts, selections, filters, drag state, or persisted data if the panel shell unmounts its children.

For high-interaction surfaces, migrate a passive read-only or parent-derived slice first. Defer moving grids, editors, drag/drop zones, and storage-backed controls until the runtime has passed focused UI tests and browser smoke. Render dock chips and cross-surface overlays through a portal when local containers use clipping or dense overflow rules, and keep a source-slot placeholder when removing a panel from its original layout would cause disruptive layout jumps.

For runtime implementation, prefer a small reducer or state-machine shape with idempotent panel registration, deterministic z-order, explicit restore mode, and boring actions such as focus, dock, float, minimize, restore, and set geometry. Avoid persistence until runtime behavior is stable. Snapshot high-risk files before the phase, then require source sanity, TypeScript, and focused tests before standalone promotion.

For long-running multi-phase UI work, create an hourly rollback and handoff checkpoint when the session remains active. Each checkpoint should capture current green or best-known source snapshots, summarize completed work, open issues, test status, artifact status, and next rollback point in the active handoff or ledger. Subagents may append concise finished-task notes to the active project handoff or ledger, but the integrator should perform a quick hourly review so the file reflects verified state rather than raw agent claims.

When using subagents for long-running SecDevOps work, designate one read-only agent manager. The manager tracks which agents are idle, running, or blocked; proposes the next safe assignment map after each completed task; and keeps snapshot, source sanity, TypeScript, focused test, browser smoke, artifact parity, and handoff-update gates visible. Recycle idle agents into bounded, non-overlapping read-only reviews or worker tasks rather than leaving them unused. The integrator remains responsible for final edits, merge decisions, promotion gates, and accepting, rejecting, or deferring raw agent findings in the ledger or handoff. Keep durable memory limited to reusable process lessons, not case or investigation substance.

When an expanded-assurance gate fails after a narrow rollout slice, repair the smallest truthful cause instead of weakening the gate. For React Fast Refresh lint errors, prefer moving hooks, context, and shared registrations into non-component modules over disabling the rule. When tests fail because shared entity coverage has expanded, update mocks and expectations to include the new entity type instead of hiding it. When new high-risk files are touched, add them to the checkpoint helper before taking the next rollback snapshot.

When panelizing an existing high-risk surface that owns imports, uploads, parsing, clipboard writes, external navigation, or agent/tool actions, make the first slice shell-only. Preserve the existing prop and callback surface, avoid exercising side-effect controls in smoke tests, and record deferred behavior explicitly. In browser tests, use exact or scoped selectors when a feature name appears in multiple headings, empty states, nav labels, or panel chrome.

When panelizing agent or LLM surfaces, checkpoint coverage must include the shell files plus the runtime risk files that own loops, providers, tool execution, policy, approvals, server hosts, deployments, and handoff/heartbeat state. A green UI slice is not enough rollback evidence if the checkpoint helper omits those parent-owned agent files.

When panelizing streaming or singleton assistant surfaces, keep the assistant component mounted exactly once and move only the presentation shell around it. Use an opt-in stable render path across docked, floating, minimized, and restored modes when remounting would duplicate providers, lose drafts, stop streams, reset approvals, or change tool-loop ownership. First browser smoke should be passive and instrumented for no-send/no-run boundaries where practical; guard message-send events, local bridge/model URLs, agent-host endpoints, and tool execution endpoints before promoting. If Playwright reports a webServer timeout before any tests execute, classify it as harness/server orchestration until proven otherwise; split `pnpm build` from preview/server startup when the app build duration can exceed the configured startup budget.

When adding drag-to-workspace or drag-to-popout launch points, use a custom MIME type plus a static descriptor allowlist instead of trusting arbitrary dropped JSON or DOM text. Parse and validate payloads only at the boundary, clamp geometry before applying it, consume malformed custom drops so they fail closed, and reject custom drags that also carry external files unless the feature explicitly supports file import. Cover expanded and collapsed launch surfaces separately, and distinguish browser-harness drag limitations from product behavior by keeping a focused real-browser drag/drop regression in the gate.

For multi-chat or multi-worktree rollouts, keep the parallel work intentionally bounded and finish with a single integrator pass. Each slice should hand off its claimed write set, source base, tests run, artifact hashes, open risks, and whether source is ahead of generated artifacts. Treat slice/chat/subagent output as advisory until reproduced locally. Do not let multiple chats promote release artifacts independently; the integrator owns conflict reconciliation, serial browser gates for shared dev-server ports, canonical handoff/ledger updates, and the final artifact hash/parity record.

When a user shares comments, ideas, screenshots, or feedback during an active long-running project, first decide whether the note fits the current project. If it does, add it to the active ledger, handoff, backlog, or source-of-truth doc after reading it, without interrupting the current implementation unless the user explicitly asks for immediate work. If the user asks for a clearly unrelated task while a long-running project is active, ask a short continuity question before switching context: confirm whether they want to pause the current project and follow the unrelated thread, or keep moving on the active project.

For connector or onboarding architecture slices, prove storage boundaries, failure states, and no-send/no-network behavior before adding UI claims or live connector actions. Use local pure metadata contracts first, keep setup state session-local unless a reviewed secret store and connector boundary exist, and cover imports/reads with tests that prove no fetch, storage, credential, or provider side effects occur.

For no-network onboarding shells, keep any legacy network-capable panels behind explicit user actions and gate both levels: component tests should spy on `fetch`/storage, and browser tests should monitor requests for provider probes or secret-bearing URLs before explicit connect/test actions. Reuse provider metadata contracts when available instead of inventing temporary UI enums.

For browser-gated multi-chat slices, never wait indefinitely on stale ports. Capture exact `lsof`/PID evidence, prefer the standard project port after it is cleared, or use a short-lived in-repo Playwright config on an isolated port and delete it before final gates. Avoid long-lived temp configs outside the repo when they need project module resolution.

Every source-gated worker slice in a multi-chat rollout should close with a product hotwash in the project ledger or handoff plus separate `MEMORY-CANDIDATE` process lessons. Worker chats must not write global memory directly; the head-chat integrator distills reusable, non-product lessons into this file after verification.

For large multi-chat rollouts, add a sixth read-only Memory Curator role when the work spans multiple slices or repeated feedback loops. The Memory Curator reviews finished slice hotwashes, deduplicates reusable process lessons, proposes updates to `docs/codex-experience-memory.md`, and flags repeated lookup/token waste. It should not implement product features, promote artifacts, or write global memory. The head-chat integrator owns accepting or rejecting its proposed memory updates.

## Known Product Issues For Future AI Chats

2026-05-23 IOC repository and enrichment UI backlog:

- IOC row borders are still not visible enough; inspect the IOC table/list CSS in both dev and standalone builds.
- IOC table headers are still not correct; verify labels, ordering, alignment, and localization keys.
- Bulk integrations action/button needs review for placement, visibility, and whether it launches the expected bulk enrichment flow.
- VT integrations and other enrichment integrations should surface richer research/review metadata of interest, not only compact verdict labels.
- Unix timestamps still appear in dropdowns; format all visible times into analyst-readable dates/times.
- Long menu text is not contained inside the menu pane; add wrapping, max-width, or truncation with tooltip where appropriate.
- IOC repo table is missing a `First seen` column.
- IOC repo should likely support moving/reordering columns or swapping visible columns from the table configuration UI.
- IOC rows should include direct links to the relevant VirusTotal pages for supported IOC types when VT context exists.

Treat these as known product issues, not confirmed implementation requirements. Before fixing, reproduce in the current standalone artifact and preserve the user's file:// storage constraint.

## Maintenance Log

- 2026-06-20: Extracted canonical IPC adapter interfaces into `src/lib/bridges.ts` (MailBridge, CalendarBridge, DesktopCalendarBridge, plus getMailBridge/getCalendarBridge/isDesktopBridge resolvers). Desktop calendar OAuth (cal-oauth.mjs + main.mjs IPC) now stores tokens exclusively in OS safeStorage and returns only `{ credRefId, email }` to the renderer; raw tokens never cross the IPC boundary.
- 2026-06-20: PWA manifest hardened: added share_target, shortcuts, display_override, and `"purpose": "any maskable"` on the SVG icon so Android can use it as an adaptive icon. Explicit `apple-touch-icon` already in index.html.
- 2026-06-20: Fixed `isOverdue()` in `src/lib/utils.ts`: replaced timezone-unsafe `new Date(dateStr)` + `setHours` comparison with a pure local-date string comparison (`YYYY-MM-DD < todayStr`) to prevent false positives in UTC-behind timezones.
- 2026-06-20: Cleared 17 pre-existing test failures across slack-runtime-activation-plan, slack-live-delivery-activation-gate, integration-next-actions, provider-runtime-activation-plan, connector-runtime-persistence, evidence-view, integration-source-dashboard, utils, and slash-commands. Key patterns: BRAND_MARKERS case normalization, RuntimeTrustedContractObject wrapping, credential reference ID prefix constraints (must use `provider-oauth:`, `local-bridge:`, `macos-login:`, or `vault:` — not bare scheme format like `google-gmail:`), strict boolean AND evaluation, component data-attribute assertions, async test cleanup races, and IntegrationSourceDashboard render timeout (increased to 20s).
- 2026-06-08: Added reusable multi-chat rollout integration guidance: bounded parallel slices can speed review, but one final integrator must verify write sets, rerun gates, serialize browser tests that share ports, resolve docs/SHA conflicts, update handoff/ledger state, and own final artifact promotion.
- 2026-06-08: Added active-project continuity guidance: project-fit comments should be logged into the current ledger or handoff after reading, while unrelated new tasks during a long-running project should trigger a brief confirmation before switching context.
- 2026-06-10: Added reusable multi-chat onboarding/connectors guidance from the rollout hotwash: prove storage and failure boundaries before live connector claims, keep setup state session-local until a secret-store boundary is approved, test no-network shells at component and browser-request levels, clear or isolate stale Playwright ports with evidence, and let only the head-chat integrator distill worker hotwashes into durable memory.
- 2026-06-11: Added project-local Codex experience memory guidance and a sixth Memory Curator role for multi-chat rollouts. Future chats should read `docs/codex-experience-memory.md` after `AGENTS.md`, and memory updates should stay process-only unless promoted by the head-chat integrator.
- 2026-06-08: Added reusable snapped-panel occupancy guidance: keep snap occupancy separate from the panel `mode` enum, expose stable chrome/snap/z-index hooks, layer snapped tiles below ordinary floating popouts, fail unavailable snap zones closed, and cover the behavior with focused UI tests before claiming mosaic/grid-manager completion. Treat rectangle-overlap occupancy as an interim guard until persistent snap metadata and shared resize seams are explicitly designed and tested.
- 2026-06-07: Added shared compact-titlebar guidance from the CalendarCaddy workspace-panel slice: use an opt-in panel-shell accessory when compact controls truly belong in the WorkspacePanel top bar, keep controls inside a no-drag region, preserve accessible names/tooltips when labels are shortened, and gate with focused UI tests that prove primary controls remain usable without side-effect actions.
- 2026-06-07: Extended compact-panel guidance after the Notes/Tasks titlebar slice: all compact or minimized workspace panels should try top-bar placement for fit-capable controls before keeping a second toolbar row; expose shell compact state through a shared panel context rather than duplicating resize thresholds; remove duplicate hidden data hooks so tests and assistive technology target the active controls.
- 2026-06-07: Added snapped/mosaic chrome guidance from the workspace panel slice: do not overload the `docked | floating | minimized` mode enum for snapped visuals; use explicit snap/chrome metadata or data hooks, preserve floating resize/minimize semantics, update all floating render paths, keep existing adjacent resize-indicator tests green, and defer persistent snap serialization until layout-template trust handling is designed.
- 2026-06-06: Added reusable panel-runtime rollout lessons: introduce dock/popout behavior additively, keep durable feature state above the panel shell, migrate passive derived slices before complex interactive surfaces, portal docks/overlays out of clipped containers, preserve source placeholders to avoid layout jumps, and gate standalone promotion behind snapshots plus source sanity, TypeScript, and focused tests.
- 2026-06-06: Added hourly rollback/handoff checkpoint guidance for long-running UI rollouts: capture snapshots and status roughly hourly, let agents log finished-task notes, and require integrator review before treating those notes as verified handoff state.
- 2026-06-06: Added reusable subagent-management guidance for SecDevOps rollouts: keep a read-only manager agent assigned, recycle idle agents into bounded non-overlapping tasks after each completed work item, and keep final gate decisions with the integrator.
- 2026-06-06: Added expanded-assurance repair guidance: preserve lint/test gates, split React hooks/context/registrations out of component files for Fast Refresh hygiene, update entity-aware tests when coverage expands, and keep checkpoint file lists current with touched files.
- 2026-06-06: Added shell-only guidance for high-risk import/action surfaces: preserve props and callbacks, defer side-effect controls in first smoke tests, and use exact/scoped browser selectors when labels repeat across the UI.
- 2026-06-07: Added agent/LLM panelization checkpoint guidance: snapshot runtime risk files that own loops, providers, tools, policy, approvals, server hosts, deployments, and handoff state, not only shell files.
- 2026-06-07: Added reusable drag-launch guidance: custom MIME plus static descriptor allowlist, fail-closed malformed drops, reject external-file conflicts, clamp geometry, and test expanded/collapsed launch surfaces with focused browser coverage.
- 2026-05-26: Split note-template creation from note creation in the top-right New menu. `New Note from Template` opens the quick note composer for using existing templates, while `New Note Template` opens a real template creator that saves a user `NoteTemplate`; when an investigation is active, the new template is automatically appended to `Folder.noteTemplateIds` so its fast-create button appears in the notes header. Refresh both standalone artifacts after edits.
- 2026-05-26: Added per-investigation note-template attachments. `Folder.noteTemplateIds` stores the selected template IDs, the notes list header shows fast-create buttons for attached templates plus a blank New Note button, and the top-right New menu can open an investigation template picker. Backups/import/sync sanitization preserve `noteTemplateIds`; standalone artifacts must be refreshed for this UX to appear.
- 2026-05-23: Added known product issue backlog for IOC repository table/enrichment UX: row borders, headers, bulk integrations, enrichment metadata, timestamp formatting, menu overflow, missing First seen column, column movement, and VirusTotal links.
- 2026-05-22: Added INTEL intel note reporting rules for AI reporters. Future report generation must use prior INTEL Word notes as locked visual templates, preserve source-note/citation markers such as `1`/`¹ See: ...`, preserve table geometry/colors/captions/spacing, and avoid rebuilding intel notes from scratch when the task is a template transplant.
- 2026-05-21: Documented the current local CaddyAI bridge implementation for standalone use: `everybody_llmbo` serves `http://127.0.0.1:11434/v1` with token `codex-local-dev` and model `gpt-5.4`; the macOS LaunchAgent uses the extracted zip server plus the `codex-chatgpt-exec` wrapper to run ChatGPT-backed `codex exec --ignore-user-config` and avoid alternate CLI provider `401 NotAuthenticated` failures.
- 2026-05-21: Evidence dedup now keeps the richest duplicate copy before trashing others, including linked IOCs plus image data, OCR text, and image analysis.
- 2026-05-21: Hardened standalone appearance handling: imported themes apply bundled font settings, stale background-image flags no longer activate image mode without an image asset in the current browser bucket, and shell light/dark surfaces inherit appearance tokens.
- 2026-05-21: Reaffirmed standalone-first maintenance: user-facing updates should be published into `/Users/brdavies/workspace/threatcaddy-standalone.html` with `pnpm update:standalone`; `127.0.0.1:5173` remains dev/test storage.
- 2026-05-21: Added small-batch evidence import guidance in code: bulk evidence upload is capped at 20 files, duplicate imports are skipped by file identity, exact duplicate evidence items can be moved to trash, and evidence inspect rendering is capped for browser responsiveness.
- 2026-05-21: Added this guide. Documented the origin-scoped storage model, dev-server vs `file://` standalone split, the `pnpm update:standalone` workflow, and the rule that standalone updates change app code but do not merge browser data.
