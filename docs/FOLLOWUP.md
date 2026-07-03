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
 placeholder tokens `gray-400` → `text-muted` on title input
and content editable placeholder.

---

## Slice-5: Workspace panel reconciliation follow-up items

### 1. Content components with hardcoded dark Tailwind colors

The following content components were found to use raw `bg-gray-*`, `border-gray-*`, and
`text-gray-*` Tailwind utilities instead of CSS token classes. They are out-of-scope for
slice-5 (which focused on panel chrome and the panel integration menu) but should be
converted in a follow-up theming pass:

| File | Notes |
|------|-------|
| `src/components/Notes/NoteEditor.tsx` | Extensive hardcoded dark colors throughout editor chrome |
| `src/components/Notes/NoteList.tsx` | Folder/list row backgrounds and borders |
| `src/components/Analysis/IOCPanel.tsx` | Panel header, row backgrounds, tag chips |
| `src/components/Analysis/IOCItem.tsx` | Row chrome, confidence badge colors |
| `src/components/Analysis/BulkEnrichModal.tsx` | Modal background, input borders |
| `src/components/Analysis/BulkIOCImportModal.tsx` | Modal background, input borders |
| `src/components/Analysis/IOCDeduplicator.tsx` | Table rows and headers |
| `src/components/Analysis/AttributionComboInput.tsx` | Dropdown list items |
| `src/components/Activity/ActivityLogView.tsx` | Log row backgrounds and timestamps |
| `src/components/Alerts/AlertGlowPanel.tsx` | Toast container (z-[9999]); hardcoded dark glow variants |

Token mapping reference (from slice-3):
- `bg-gray-900` / `bg-gray-800` → `bg-bg-deep` / `bg-bg-raised`
- `bg-gray-700` → `bg-bg-hover`
- `border-gray-700` → `border-border-subtle`
- `text-gray-300` → `text-text-primary`
- `text-gray-400` → `text-text-secondary`
- `text-gray-500` → `text-text-tertiary`

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
