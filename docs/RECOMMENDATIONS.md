# ThreatCaddy — Recommendations

Observations collected during the theme/optimization sweep (June 2026). Items are grouped by effort and impact. Each is out-of-scope for the current backlog sprint but worth scheduling.

---

## High Priority

### 1. `data-email-inline-nINTELe` prop warning
**File:** Any component that renders email inline previews  
**Issue:** React warns that `data-email-inline-nINTELe` contains uppercase chars and won't be passed to the DOM correctly. The prop name should be fully lowercase (`data-email-inline-nintele`).  
**Effort:** 15 min — grep and rename the prop across the codebase.

### 2. ReportsPanel uses `useTranslation()` default namespace but keys use flat dot-notation
**Status:** Fixed in sweep (added `reports.*` keys to `common.json` and translated to 20 languages). But worth auditing other panels for the same pattern — keys that look like they belong in a dedicated namespace but are flat in `common.json` can cause confusion when the namespace is refactored.

### 3. `builtin-report-templates.ts` — Nunjucks `.append()` array mutation
**Status:** Fixed in sweep (replaced with inline `{% if %}` conditional). Root cause: Nunjucks arrays are immutable — Python/Jinja2 patterns that call `.append()` silently no-op. Any future template authors must be warned; consider adding a lint rule or a comment in the template creation UI.

---

## Medium Priority

### 4. Agent Hosts skill discovery via `GET /skills` — no retry/timeout handling
**File:** `src/lib/agent-hosts.ts`  
**Issue:** `GET /skills` requests have no explicit timeout. A slow/unresponsive host will hang the skills discovery flow indefinitely.  
**Recommendation:** Add `AbortController` with a 5s timeout to the skill discovery fetch, and surface a "host unreachable" status in the Agent Hosts settings UI.

### 5. `AgentCycleSummary` rendering in audit threads — no virtualization
**File:** `src/components/Agent/AgentCycleSummaryCard.tsx`, `ChatView.tsx`  
**Issue:** Audit `ChatThread`s for long-running agents can accumulate hundreds of cycle summary cards. The list is not virtualized.  
**Recommendation:** Add `react-virtual` (already a dep for NoteList) to the audit chat message list to keep scroll performance acceptable on large threads.

### 6. Supervisor rolling retention hardcoded at 200 notes
**File:** `src/lib/caddy-agent-supervisor.ts`  
**Issue:** The 200-note cap is a magic number in the file. As investigations grow (many notes + sub-folders), the supervisor may miss context.  
**Recommendation:** Make the retention cap a `Settings` value (default 200, user-adjustable to 50–500), surfaced in `Settings > AI > Supervisor`.

### 7. `backup-restore.ts` `SYNCED_TABLES` — ordering dependency
**File:** `src/lib/backup-restore.ts`  
**Issue:** `SYNCED_TABLES` is a flat array; tables with FK dependencies must be restored in the right order or Dexie will throw. The current order happens to be correct but there's no enforcement or comment explaining the dependency chain.  
**Recommendation:** Add an inline comment listing the FK chain (`agentDeployments` depends on `agentProfiles` depends on `folders`), and add a test that asserts restoration order matches dependency order.

### 8. `model-pricing.ts` — no fallback for unknown model IDs
**File:** `src/lib/model-pricing.ts`  
**Issue:** If a new model is released (e.g. `claude-opus-4-8`) and not yet in the pricing table, cost tracking silently returns `0` rather than `null` (unknown). This makes the `$0.00` display ambiguous.  
**Recommendation:** Return `null` for unknown models and render "Unknown" in `AgentMetrics` cost display instead of `$0.00`.

---

## Low Priority / Nice-to-Have

### 9. `CaddyAssistantOverviewPanel.tsx` — `toneStyles` map could be driven by CSS custom properties
**Status:** Fixed in sweep (now uses `accent-amber`, `accent-pink`). However, if the user wants a third tone (e.g. `blue`, `green`), they'd need to add both the tone string and a CSS class. Consider extracting tone → CSS-var mapping into a shared config object in `src/lib/tone-styles.ts` used by both the overview panel and any other panel that renders tone badges.

### 10. `ReportSection.bodyTemplate` — no in-app Nunjucks preview/editor
**Current behavior:** `bodyTemplate` is defined in code (`builtin-report-templates.ts`) and rendered once when a report is created. Users can't see or edit the template.  
**Recommendation (S5-ext-c):** Add a "Template" tab in `SectionEditor` for sections that have a `bodyTemplate`. Show the raw Nunjucks source, a "Re-render" button, and a live preview pane. Gate behind a "Developer" toggle in Settings.

### 11. `useServerAgents` heartbeat — no exponential back-off on failure
**File:** `src/hooks/useServerAgents.ts`  
**Issue:** Heartbeat failures retry on the same fixed interval. A transient server hiccup causes a burst of repeated failed requests rather than backing off.  
**Recommendation:** Add exponential back-off (up to ~60s) on heartbeat failure, with a reset on first success.

### 12. Extension `background.js` — LLM streaming chunks not chunked for large payloads
**File:** `extension/src/background.js`  
**Issue:** Very large streaming responses (e.g. long Nunjucks template renders) that arrive as a single large SSE event may exceed the Chrome message bus 64MB limit.  
**Recommendation:** Add a chunked relay path for messages > 1MB, reassembled on the page side.

### 13. `WorkspacePanel` compact mode — no smooth transition
**File:** `src/components/WorkspacePanels/WorkspacePanel.tsx`  
**Issue:** Switching between compact and non-compact mode causes an abrupt layout jump. Adjacent panels (NoteList, ReportEditor) all re-render simultaneously with no transition.  
**Recommendation:** Add `transition-all duration-200` on the panel width and sidebar icon opacity to smooth the compact toggle.

---

## Security / Integrity

### 14. `confirmedSend: true` guard in `desktop/mail-bridge.mjs` — not integration tested
**File:** `desktop/mail-bridge.mjs`  
**Issue:** The `confirmedSend: true` guard is a critical safety rail preventing accidental email sends. It is not covered by any test.  
**Recommendation:** Add a unit test that asserts calling `send()` without `confirmedSend: true` throws or returns early. Also add a similar test for the extension `background.js` postMessage validation.

### 15. Agent idempotency key collisions on rapid cycle restart
**File:** `src/lib/caddy-agent.ts` — `idempotencyKey` generation  
**Issue:** The key is `${deploymentId}:${cycleStartedAt}:${toolName}:fnv1a(args)`. If a cycle is aborted and immediately restarted in the same millisecond (possible on fast machines under load), `cycleStartedAt` is identical and the second cycle's write will be silently dropped by the idempotency check.  
**Recommendation:** Append a per-deployment monotonic counter (`cyclesRun`) to the key: `${deploymentId}:${cyclesRun}:${toolName}:fnv1a(args)`.

---

*Last updated: 2026-06-19. See ROLLOUT-LEDGER.md for the active backlog.*
