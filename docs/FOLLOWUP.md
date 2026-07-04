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

---

## Slice-3: Theme token follow-up items

### 1. Repo-wide CRLF contamination

~200 files in the working tree have CRLF line endings (Windows-style `\r\n`).
The git object store uses LF, so these all show as modified even though content
is identical. Fix:

```
# .gitattributes (add to repo root)
* text=auto eol=lf
*.ts  text eol=lf
*.tsx text eol=lf
*.css text eol=lf
*.json text eol=lf
*.md  text eol=lf
*.mjs text eol=lf
```

After adding `.gitattributes`, run:
```sh
git add --renormalize .
git commit -m "chore: normalize line endings to LF"
```

This should be done as a standalone commit before the next feature slice.

### 2. `.light .bg-gray-*` cascade override problem

`src/index.css` contains a large block of `.light .bg-gray-900 { background-color: #ffffff; }` etc.
overrides. These apply globally to ANY element with a Tailwind gray utility class when in light
mode, including dark-on-purpose elements (code blocks, terminal panels, dark preview cards).

Recommended fix: add a `.tc-dark-island` utility class that restores dark-mode gray values inside
a light-mode root. Affected components: code preview panels, terminal output, any "dark card"
UI element that deliberately uses gray utility classes.

### 3. `@theme` tokens in Tailwind v4 vs CSS cascade for light mode

The `@theme {}` block registers dark mode values as Tailwind design tokens. The `.light {}`
block overrides them at the CSS variable level. This works correctly via the cascade because
Tailwind v4 generates utility classes as `background-color: var(--color-bg-deep)` etc.
However, the `FONT_OPTIONS` in `theme-schemes.ts` and any `@theme` string values that are
NOT expressed as CSS variables (e.g. if spacing tokens were added) would not cascade to light
mode. Keep all theme-switchable tokens as CSS custom properties, not literal `@theme` values.

### 4. `JournalView.tsx` was deleted in working tree ✓ RESOLVED (slice-4)

Working tree had only 704 of 1094 lines — file was truncated mid-JSX (NTFS mount
write interrupted during a prior session). Restored via `git show HEAD:... > file`.
Polish applied on top

---

## Slice-8: CalendarCaddy ICS + Graph event import

### 1. Install ical.js and rrule (REQUIRED before ICS import works)

`ical.js` and `rrule` were added to `package.json` dependencies but the packages
are **not yet installed** in `node_modules` (pnpm install was blocked by the slice
hard rules). Before ICS file import will work, run:

```sh
pnpm install
```

Then replace the stub in `src/lib/ics-parser.ts` with the real implementation
documented in the comments of that file.

### 2. Microsoft Graph calendar fetch (not implemented)

No Microsoft Graph or generic OAuth calendar endpoint exists in `server/src/routes/`.
The CalendarCaddy OAuth bridge (`getCalendarBridge().startOAuth`) handles Google and
Microsoft account linking for the desktop app, but server-side Graph API calls (fetch
upcoming events, create/update/delete via Graph) are not wired up.

To add Graph calendar fetch:
- Add a `/api/calendar/graph/events` route in `server/src/routes/` that accepts an
  `accountId`, resolves the stored credRefId, exchanges it for a Graph access token,
  and calls `https://graph.microsoft.com/v1.0/me/calendarView`.
- Wire the result into `useCalendarSync` or a new `useGraphCalendar` hook.
- The existing `calendarAccounts` state in `CalendarCaddyWorkspace` already tracks
  connected Microsoft accounts — use `account.credRefId` as the token reference.

---

## Slice-10: IOC re-check diffing follow-up items

### 1. Diff panel / tooltip in IOC detail view

`iocRecheckDiffs` are stored and the "CHANGED" badge is surfaced in the list,
but clicking the badge (or expanding the IOC row) does not yet show the diff
detail. `getLatestRecheckDiff(iocId)` is already exported from
`src/lib/ioc-recheck-diff.ts` — wire it into the expanded IOC detail panel
(the `isExpanded` block in `StandaloneIOCList.tsx`) to show the full summary,
score delta, and vendor lists.

### 2. Investigation-scoped backup excludes diffs

`exportInvestigationJSON` / `buildFullBackupPayload` investigation scope do not
include `iocRecheckDiffs`. Diffs are derived data (can be regenerated by
re-running enrichment), so this was an intentional omission. If long-term diff
history becomes important for audit trails, include per-investigation diffs by
querying `db.iocRecheckDiffs.where('iocId').anyOf(iocIds).toArray()` after
collecting the investigation's IOC IDs.

### 3. Diff retention / pruning

`iocRecheckDiffs` rows accumulate unboundedly. Add a pruning job (e.g. keep
last N diffs per IOC, or drop diffs older than 90 days) to prevent the table
from growing without bound for long-lived investigations.

### 4. "CHANGED" badge dismissal

There is no way for an analyst to acknowledge / dismiss the "CHANGED" badge.
Options: (a) store a `reviewedAt` timestamp on the diff row; (b) clear the badge
when the analyst opens the detail view. Without dismissal the badge persists
forever once set.

---

## Slice-11: CTI interop batch follow-up items

### 1. `src/lib/export.ts` truncation (CRLF/WSL mount issue — FIXED in slice-11)

The working-tree `export.ts` was missing its final ~531 bytes (the `downloadFile`
function) due to NTFS→WSL write truncation. Restored from `git cat-file blob
HEAD:src/lib/export.ts` during this slice. If truncation recurs for other files,
the same restore pattern applies.

### 2. TLP marking-definition IDs in `stix.ts` vs `classification.ts`

`src/lib/stix.ts` uses the canonical FIRST.org STIX 2.1 TLP marking-definition
UUIDs (per the slice spec). The older `src/lib/classification.ts`
`STIX_TLP_MARKING_DEFS` map uses a different set of IDs (the pre-v2 TLP 1.0
STIX objects). These two maps are now in disagreement; the full exporter
(`stix-export.ts`) still uses the `classification.ts` IDs.

**Recommended fix:** unify both maps to use the canonical FIRST.org IDs and
update `stix-export.ts` to import from `stix.ts`. Ensure the STIX import path
(`stix-import.ts`) also accepts both ID sets for backward compatibility with
existing stored data.

### 3. Navigator export from IOC list only covers `mitre-attack` typed IOCs

The "ATT&CK Navigator layer" export in `StandaloneIOCList` is scoped to IOCs
with `type === 'mitre-attack'`. Timeline events store techniques in
`mitreAttackIds[]` and are already handled by `buildNavigatorLayer()` in
`mitre-attack.ts`. A follow-up could merge both sources into a single export if
a cross-view Navigator layer is desired.

### 4. TLP gating on other export surfaces

TLP enforcement is currently wired only in `StandaloneIOCList`. The following
export surfaces do NOT yet check `investigationTlp`:
- `IOCPanel` (per-item STIX/MISP/JSON/CSV export)
- `IOCStatsView` (CSV/JSON/TXT export)
- `TimelineView` (Navigator JSON, CSV, timeline JSON)
- Full-investigation JSON backup (`exportInvestigationJSON`)

Wire `tlpPermitsShare` / `tlpShareDescription` into each surface before marking
TLP enforcement "complete."

### 5. ATT&CK Navigator button in TimelineView

`TimelineView` already has an "ATT&CK Navigator JSON" button (uses
`buildNavigatorLayer` from `mitre-attack.ts`). The new `attack-navigator.ts`
module adds a complementary path for IOC-based exports. Consider whether the
Timeline button should be updated to use `exportATTACKNavigatorLayer` for API
consistency, or left using `buildNavigatorLayer` (which has richer event-level
metadata including actor and confidence).

### 6. STIX export does not include relationships or report SDO

`exportSTIX21Bundle` in `stix.ts` is deliberately minimal (indicators only).
`stix-export.ts` (`formatIOCsSTIX`) generates the full bundle including
Relationship and Report SDOs. If consumers of the new STIX export path need
relationships, consider calling the full exporter instead or promoting
relationship data from `StandaloneIOC.relationships[]`.

### 3. ICS import deduplication

Imported ICS events are deduplicated by `id` (`ics-${uid}-${timestamp}`). If the
same ICS file is imported twice with different timestamps (e.g. the file was regenerated),
events will duplicate. A better dedup key is `uid` + `start ISO string`. Address in a
follow-up once ical.js is installed and the real UID is available.
text-tertiary`

### 2. WorkspacePanelDock stub not implemented

`src/components/WorkspacePanels/WorkspacePanelDock.tsx` renders null. Minimized panels
currently appear as inline `MinimizedPanelRollup` buttons at the bottom of each route's
content area. A proper dock bar (bottom or side strip, always-visible) would improve
discoverability. Tracked here rather than in panel reconciliation because it requires
a new UX design decision.

### 3. Panel header button inconsistency (minimize vs. close affordance)

In `floating` mode, the panel chrome shows: drag handle → minimize → close.
In `docked` mode, it shows: accent dot → minimize (no close).

There is no explicit close button for docked panels. Close is only reachable via the
owning route's own UI (e.g., a sidebar toggle). Consider adding a subtle `×` icon
to docked panel headers for discoverability, guarded by the same `onClose` prop gate
already used in floating mode.

---

## Slice-6: Appearance settings consistency follow-up items

### 1. Duplicate `frostedPanels` toggle

The frosted-panels toggle appears in two places:

- `src/components/Settings/AppearanceSettings.tsx` — "Bordered Panels" section (the correct home)
- `src/components/Settings/SystemHygienePanel.tsx` — lines 217–218 (reset and standalone toggle)

The SystemHygienePanel copy is a legacy holdover. It works (both write to the same setting) but is
confusing. Remove `frostedPanels` from `SystemHygienePanel` in a follow-up — keep it only in
`AppearanceSettings`.

### 2. Dead `windowGlass*` settings fields

`DEFAULT_SETTINGS` and the `Settings` type carry three fields that are never read by any active code:

- `windowGlassEnabled: false`
- `windowGlassTransparency: 0`
- `windowGlassBlur: 0`

`useSettings.ts` does not reference them. The frosted-panel path in `useSettings.ts` (lines 160–197)
hardcodes `effectiveTransparency` and `effectiveBlur` from `settings.frostedPanels` only.

These appear to be stubs for a native Electron window-glass API that was never fully wired or has
been superseded by `frostedPanels`. Safe to remove from `DEFAULT_SETTINGS` and the `Settings` type
in a dedicated cleanup slice — grep first to confirm no other consumers (extension, server, export)
reference them.

---

## Slice-7: Bundle splitting follow-up items

### 1. cytoscape and excalidraw are static imports (not dynamic)

Both libraries are imported statically at the top of their components:

- `src/components/Graph/GraphCanvas.tsx` — `import cytoscape from 'cytoscape'`
- `src/components/Whiteboard/WhiteboardEditor.tsx` — `import { Excalidraw, ... } from '@excalidraw/excalidraw'`

However, both parent views (`GraphView`, `WhiteboardView`) ARE lazy-loaded via `React.lazy()` in
`App.tsx`. This means the libraries DO load lazily at runtime — just not via a dynamic import call
on the library itself. The `manualChunks` function ensures Rollup puts them in separate named chunks.
No immediate action required, but if the parent components are ever eagerly imported, these libs
would land in `index`. Consider wrapping the libraries themselves in dynamic imports inside the
component files as a more resilient pattern:

```ts
// GraphCanvas.tsx example
const [cytoscape, setCytoscape] = useState<typeof import('cytoscape') | null>(null);
useEffect(() => { import('cytoscape').then(m => setCytoscape(m.default)); }, []);
```

### 2. mermaid / flowchart-elk / subset-shared chunks are Mermaid-internal

`mermaid@10.9.3` is a transitive dependency via `@excalidraw/mermaid-to-excalidraw`. The chunks
`flowchart-elk-[hash].js` and `subset-[hash].js` (and `sequenceDiagram-*`, `ganttDiagram-*`, etc.)
are created by Mermaid's OWN dynamic imports within its source — they cannot be eliminated or
merged via our `manualChunks`. They'll always be separate lazy files. The only control we have is
ensuring mermaid's static base lands in the `excalidraw` chunk (done in slice-7) rather than `index`.

### 3. vendor-misc chunk size — consider further splitting

The `vendor-misc` catch-all chunk now contains all remaining node_modules code: `dexie`, `i18next`,
`react-i18next`, `lucide-react`, `react-router-dom`, `minisearch`, `react-virtuoso`, etc. Depending
on actual built size, it may still be large (>500 KB). If so, consider splitting further:

```ts
if (id.includes('/dexie/')) return 'vendor-dexie';
if (id.includes('/lucide-react/')) return 'vendor-icons';
if (id.includes('/i18next/') || id.includes('/react-i18next/')) return 'vendor-i18n';
```

Check the Vite build output for `vendor-misc-[hash].js` size before acting.

---

## Slice-9: DB + extraction performance follow-up items

### 1. IOC extractor — already guarded, no immediate action needed

`src/lib/ioc-extractor.ts` already has:
- `MAX_IOC_INPUT_LEN = 5_000_000` — truncates blobs > 5 MB before regex runs
- `MAX_IOCS_PER_TYPE = 500` / `MAX_TOTAL_IOCS = 5_000` — caps output size
- 8-entry LRU memoization cache (`extractionCache`) — deduplicates repeated extraction on the same content

No changes required. If performance degrades on very large evidence imports, consider reducing
`MAX_IOC_INPUT_LEN` to 1 MB or gating extraction on file type (skip extraction for image-only
evidence items where `fileType === 'image'` and `imageOcrText` is empty).

### 2. ExecDashboard — agentDeployments full-table load for stat counter

`src/components/ExecMode/ExecDashboard.tsx` lines 91-97: loads all `agentDeployments` with
`db.agentDeployments.toArray()`, then counts `.filter(d => d.status !== 'paused' && d.shift !== 'resting')`.

The deployments table is small (one row per agent per investigation), so this is not currently
a hot path. If the deployment count grows large (e.g., auto-archived deployments are never pruned),
replace with a count-only query: use `db.agentDeployments.where('status').anyOf(['active', 'idle'])` plus
a JS filter on `shift`. Alternatively, add a pruning step that archives resting/paused deployments
older than N days.

### 3. graphSnapshots — client-side sort after folderId index fetch

`src/hooks/useGraphSnapshots.ts`: `.where('folderId').equals(folderId).reverse().sortBy('createdAt')`
uses the `folderId` single-field index but sorts in JS. DB version 42 adds a `[folderId+createdAt]`
composite to `chatThreads`, `whiteboards`, and `standaloneIOCs` — `graphSnapshots` was intentionally
excluded (table is tiny; per-investigation snapshots rarely exceed 10 rows). If usage grows, add
`[folderId+createdAt]` to the schema in a follow-up and replace `sortBy('createdAt')` with a
`.between([folderId, Dexie.minKey], [folderId, Dexie.maxKey]).reverse().toArray()` call.

### 4. useChats global load — no per-folder index path

`src/hooks/useChats.ts` loads ALL chat threads globally (`db.chatThreads.toArray()`) because it
manages the message cache and thread list for the CaddyAI sidebar. DB v42 adds `[folderId+updatedAt]`
to `chatThreads`, but `useChats` does not use it — the hook is intentionally global.

The index will benefit future callers (e.g., investigation-scoped chat panel, report builder) that
need only a single investigation's threads sorted by activity.

### 5. useActivityLog — encryption middleware cursor note

The `useActivityLog.ts` refactor (slice-9) now uses:
1. `where('timestamp').below(cutoff).delete()` — cursor-delete on the `timestamp` index
2. `where('timestamp').aboveOrEqual(cutoff).toArray()` — range query through DBCore `query()` handler

`timestamp` is NOT in `ENCRYPTED_FIELDS`, so both operations work correctly regardless of
encryption state. The comment warning about `orderBy().reverse()` and open cursors remains valid
for any query that needs the encrypted `detail`/`itemTitle` fields returned in sorted order —
those must still use `.toArray()` (query handler path) rather than `orderBy().reverse()`.
