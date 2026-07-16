# DISPATCH — ThreatCaddy Journal: retire Draw + context-menu/TLP foundation

## Environment
- Repo: `/home/user/threatcaddy`, branch `claude/threatcaddy-appearance-fixes-qdpcwt` (already checked out). Default branch is `master`.
- Build/preview: `pnpm build`; preview via `pnpm desktop:site:browser` (serves 127.0.0.1:4174, rebuilds on start, ~30-90s). Hard-refresh / the script self-unregisters the SW.
- Visual verify: Playwright against `/opt/pw-browsers/chromium` (run scripts from inside the repo). Put temp scripts as `*.tmp.mjs` in the repo root and delete before committing.
- Gates before every commit: `npx tsc -b` clean, `npx eslint <changed files>` clean, `npx vitest run` green (note: `virtual-caddy-detonation-review.test.tsx` "screenshot thumbnail…lightbox" is a known flake — passes in isolation, ignore it). Then commit + `git push -u origin claude/threatcaddy-appearance-fixes-qdpcwt`.
- Commit-message footer lines are auto-added by the harness; don't add model IDs anywhere in commits.

## Decisions already made (don't re-litigate)
1. **Canvas replaces Draw.** The new Excalidraw "Canvas" mode (`src/components/Journal/JournalCanvas.tsx`, already shipped) supersedes the legacy freehand "Draw" overlay. Retire interactive Draw; keep existing freehand drawings read-only.
2. **Journal = the analyst's thinking layer**, distinct from Notes (Notes = the investigation record). TLP must be enforced on journal pages. Security-first sequencing: **TLP on pages → Books IA → canvas entity-bridge.**
3. **Right-click is missing app-wide** → build ONE reusable `ContextMenu` primitive; Journal adopts it first.
4. Reuse, don't reinvent: `ClsSelect`, `EntityInvestigationBar`, TLP helpers, existing tear plumbing.

## Reuse map (exact, already verified)
- TLP helpers in `src/lib/classification.ts`: `getClsBadgeStyle(level)` (chip style), `getTlpBorderColor(level)` (border color, may be undefined), `effectiveTlpLevel(...)`, `detectClsLevelFromText(text)`.
- `src/components/Common/ClsSelect.tsx` → `ClsSelect({ value, onChange:(level|undefined)=>void, clsLevels?, className? })`.
- `src/components/Common/EntityInvestigationBar.tsx` → `EntityInvestigationBar({ folders, currentFolderId?, onMove:(folderId|undefined)=>void, className? })`. NOTE: journal pages link to an investigation via `linkedInvestigationId` (soft link), NOT `folderId`. Wire `currentFolderId={page.linkedInvestigationId}` and `onMove` → `linkToInvestigation(page.id, id)`.
- UX reference for menu items (Settings/Archive/Delete): `src/components/Investigations/InvestigationCard.tsx` (bespoke 3-dot menu, ~lines 255-305).

---

## TASK 1 — Retire interactive freehand Draw (Canvas is the one surface)
File: `src/components/Journal/JournalView.tsx`. Keep the diff focused.

Remove:
- `drawMode` state (`const [drawMode, setDrawMode] = useState(false)`).
- The **Draw** toolbar `<button>` (the one with `<Pencil size={12}/> Draw`, toggles `setDrawMode`). Leave the **Canvas** button.
- The interactive `{drawMode && (<DrawingCanvas .../>)}` render block.
- The now-dead components/consts once unused: `DrawingCanvas` (fn ~857) and its props interface, `DrawColorPicker` (~665) + props, `DRAW_COLORS` (~554), the `DrawColor` type, and the `Pencil` lucide import.

Keep (still used for read-only display of existing drawings):
- `StaticDrawingCanvas` (~819), `parseStrokes` (~792), `Stroke` type, `isLegacyRasterDrawing` (~788).
- The read-only overlay render: change `{page.drawingData && !drawMode && (…StaticDrawingCanvas/img…)}` to just `{page.drawingData && (…)}` (in canvas mode the whole text surface is already `hidden`, so no conflict).

Result: no more `border`/compression bugs (they were inherent to the legacy Draw overlay). Existing `page.drawingData` still renders read-only; new drawing happens on Canvas. Do NOT re-patch legacy Draw layout — it's being removed.

Verify: tsc + eslint clean, open a page with an existing freehand drawing (if any) still shows it read-only; Canvas button still works. Commit (e.g. `refactor(journal): retire legacy freehand Draw; Canvas is the sole drawing surface`).

---

## TASK 2 (Slice A) — Reusable ContextMenu + right-click on pages + TLP foundation

### 2a. TLP field
- `src/types.ts`, `JournalPage`: add `clsLevel?: string;` (non-indexed — **no Dexie migration needed**; Dexie stores extra props freely, only indexed fields go in `db.version().stores()`).

### 2b. Reusable ContextMenu primitive — NEW `src/components/Common/ContextMenu.tsx`
- Renders via `createPortal` to body at a cursor `{x, y}`, `position: fixed`, high z-index (match app popovers, e.g. `z-[9999]`).
- Props: `{ x:number; y:number; items: Array<{ label:string; icon?:ReactNode; onClick:()=>void; danger?:boolean } | 'separator'>; onClose:()=>void }`.
- Close on outside `mousedown`, on `Escape`, and after an item click. Clamp position so it doesn't overflow the viewport (shift left/up if x+width or y+height exceeds window).
- Style to match existing menus (see InvestigationCard menu / BackgroundPicker portal in JournalView): `rounded-xl border border-border-medium bg-bg-raised shadow-xl`, items `text-sm px-3 py-1.5 hover:bg-bg-hover`, danger items `text-red-400 hover:bg-red-500/10`.

### 2c. Wire right-click into the journal page list
File `src/components/Journal/JournalView.tsx`, `PageList` (page `<button>` render ~line 1475).
- `PageList` currently only receives `pages, selectedId, onSelect, onNewPage, onNewJournal`. Add props: `onEditDetails(page)`, `onTear(page)`, `onDelete(pageId)`.
- On each page item add `onContextMenu={(e) => { e.preventDefault(); openMenu({x:e.clientX, y:e.clientY, page:p}); }}`. Manage a small `menuState` in `PageList`. Also add a always-visible 3-dot affordance (touch/discoverability) that opens the same menu.
- Menu items: **Edit details** → `onEditDetails(p)`; **Tear to investigation** → `onTear(p)`; separator; **Delete** (danger) → `onDelete(p.id)`.
- In `JournalView` (owner, ~1569): pass `onDelete={deletePage}`, `onTear={(p)=>setTearingPage(p)}` (reuses the existing `TearModal` flow — `tearingPage` state + `handleTear`), and `onEditDetails={(p)=>setEditingPage(p)}` (new state).

### 2d. "Edit details" modal — NEW small modal (inline in JournalView is fine, mirror `MeetingPasteModal`/`TearModal` structure)
Fields for the selected page:
- Title (`<input>` → `updatePage(id,{title})`).
- **TLP**: `<ClsSelect value={page.clsLevel} onChange={(lvl)=>updatePage(id,{clsLevel:lvl})} clsLevels={settings?.tiClsLevels}/>`. (Thread `settings` into JournalView if not already — check `JournalViewProps`; if absent, pass from parent, else omit `clsLevels` to use defaults.)
- **Investigation**: `<EntityInvestigationBar folders={folders} currentFolderId={page.linkedInvestigationId} onMove={(id)=>id?linkToInvestigation(page.id,id):updatePage(page.id,{linkedInvestigationId:undefined,linkedAt:undefined})} />`.

### 2e. TLP border + chip on the page list item
- Item wrapper: inline `style={{ borderColor: getTlpBorderColor(p.clsLevel) }}` + a `border`/`border-l-2` class + `data-tlp={p.clsLevel}` (the `.has-panel-glass` frost rules already `:not([data-tlp],...)`-exclude TLP borders, so this stays visible under frost).
- Small chip when `p.clsLevel` set, styled via `getClsBadgeStyle(p.clsLevel)`.

### Verify Slice A (Playwright)
1. Right-click a page → menu shows Edit details / Tear / Delete; outside-click and Esc close it; menu near a viewport edge stays on-screen.
2. Edit details → set TLP:AMBER → page item shows an amber border + chip; reload → persists (read IndexedDB `journalPages[].clsLevel`).
3. Delete from the menu removes the page.
4. Add a short test guarding: JournalPage `clsLevel` round-trips through `updatePage`; and (CSS-string test like `theme-control-css.test.ts`) that the TLP border isn't clobbered.

Commit (e.g. `feat(journal): reusable ContextMenu + right-click page actions + TLP on pages`).

---

## ROADMAP (do NOT start these without a go-ahead; listed so you have the arc)
- **Slice B — Books IA:** new container level ("Book"), each Personal (default) or bound to an Investigation. The `+` icon opens a menu (**New page / New book**). Move-page-to-book. Investigation books inherit that investigation's TLP as a **floor** (page effective TLP = max(book floor, own, canvas content) — reuse `effectiveTlpLevel`; never silent-downgrade). An investigation book **survives** the investigation being archived (moves to Personal/Unfiled).
- **Slice C — menu-bar dropdown** for investigations/books.
- **Canvas Phase 2 (task tracked):** promote a canvas node → real Note/Investigation/Task/IOC via the tear plumbing; drop existing entities onto the canvas. Enforce TLP precedence at the drop.
- **Canvas Phase 3 (task tracked):** Excalidraw frames + element links for nested "zoom into an idea" pages.

## Guardrails
- TLP/security is load-bearing: any rule that sets a color-carrying property with `!important` on `.has-panel-glass` must keep the `:not([data-tlp], [class*="tlp-"], [data-investigation-status])` exclusion. Never let content lower a page's effective TLP.
- Local-first, offline, CSP `font-src 'self' data:` (no external CDNs).
- Keep Excalidraw lazy (`JournalCanvas` is already a lazy chunk).
