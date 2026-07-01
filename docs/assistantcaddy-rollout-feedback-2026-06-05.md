# AssistantCaddy Rollout Feedback - 2026-06-05

Single aggregation file for the current AssistantCaddy / EmailCaddy / CalendarCaddy rollout.

## Operating Model

- Planner/integrator: parent Codex thread, owns merge order, verification, standalone rebuild, and final status.
- Developer lanes persist across loops unless blocked.
- Reviewers and testers must not certify their own code.
- Feedback loops target 2-3 passes: implement, review/test, aggregate, request fixes, revalidate.
- Status vocabulary: `DONE`, `PARTIAL`, `DEFERRED`, `BLOCKED`.

## Preflight

- `pnpm exec playwright --version`: available (`1.58.2`).
- Chromium cache: present under Playwright's current `chromium-1208/chrome-mac-arm64` layout.
- No user permission/install action is required before first browser-grade test run.

## Developer Lane Assignments

### Dev 1 - Appearance / Odysseus Background Parity

Owned files:

- `src/components/Settings/AppearanceSettings.tsx`
- `src/components/Layout/BgEffectLayer.tsx`
- `src/types.ts`
- focused appearance tests only as needed

Goals:

- Replace guessed Odysseus preset defaults with real Odysseus theme/background pairings.
- Add/repair compact background animation bubble picker.
- Preserve ThreatCaddy master theme and reduced-motion behavior.
- Keep imported presets clearly named as Odysseus presets, not `Odyssey Appearance Lab`.

### Dev 2 - CalendarCaddy Interactions

Owned files:

- `src/components/CaddyAssistant/CalendarCaddyWorkspace.tsx`
- focused AssistantCaddy workspace tests only as needed

Goals:

- Improve week horizontal drag/selection between days.
- Keep vertical drag/resizing fluid at 15-minute increments.
- Month drag should support event/stamp ranges.
- Selected event Delete/Backspace behavior must not hijack editable fields.
- Add keyboard affordances where safe: Enter confirm/open, Escape context/drawer close, predictable focus.

### Dev 3 - EmailCaddy Usability

Owned files:

- `src/components/CaddyAssistant/CadEmailWorkspace.tsx`
- focused AssistantCaddy workspace tests only as needed

Goals:

- Make EmailCaddy denser and more mail-client-like.
- Ensure compose/reply/reply-all/forward with To/CC/BCC/subject/body exists and is usable.
- Add compact bulk selection/actions.
- Add safe keyboard behavior: Enter open/activate, Escape close transient UI, Delete selected rows only outside draft fields.
- Preserve the guardrail that AI drafts/analyzes but does not send mail.

### Dev 4 - AssistantCaddy Onboarding / Shell

Owned files:

- `src/components/CaddyAssistant/CaddyAssistantOverviewPanel.tsx`
- `docs/caddyassistant-caddyshack-mini-spec.md`
- feedback/ledger docs only when recording phase-two items

Goals:

- Reduce card-heavy layout.
- Add setup prompts for missing AI provider and missing email/calendar accounts.
- Route cleanly to EmailCaddy, CalendarCaddy, daily brief, prep, sanitization, and "what am I forgetting" flows.
- Record desktop windowing/notifications as phase-two unless a safe minimal shell can be added without broad route churn.

## Reviewer Feedback

Pending.

## Tester Feedback

Pending.

## Loop 1 Integration Notes

### Integrator Add-On - Settings Top Tabs

Status: `DONE`.

- `DONE`: restored the Settings shell to ThreatCaddy's compact original top-tab navigation instead of the Odysseus-style left settings rail.
- `DONE`: tab order now follows the original-style top row: `General`, `Appearance`, `AI`, `Agents`, `Data`, `Templates`, `Intel`, `Integrations`, `Shortcuts`, `System`.
- `DONE`: kept the newer Appearance content under the original ThreatCaddy settings frame.
- `DONE`: removed noisy missing i18n warnings for the changed top-tab labels in the English settings locale.
- Validation: `pnpm exec vitest run src/__tests__/settings-panel.test.tsx --reporter=dot` passed with 23 tests.

### Dev 1 - Appearance / Odysseus Background Parity Result

Status: `DONE` for focused Appearance implementation and tests; `DEFERRED` for visual standalone smoke to the integration/test lanes.

- `DONE`: replaced guessed Odysseus visual defaults with the real Odysseus prebaked pairings, including `dark` none, `light` dots, `midnight` rain, `paper` dots, `cyberpunk` synapse, `retrowave` embers, `forest` petals, `ocean` constellations, `terminal` perlin-flow, `organs` rain, `ume` petals, and `cute` sparkles.
- `DONE`: preserved Odysseus-defined effect color, intensity, and frosted defaults; other effect colors derive from the active ThreatCaddy palette so manual animation swaps stay theme-aware.
- `DONE`: added a compact background-animation bubble picker independent of theme selection and kept the imported preset section named `Odysseus themes`.
- `DONE`: `BgEffectLayer` falls back to current appearance CSS tokens and renders a static safe frame for reduced-motion users instead of continuing a slowed animation loop.
- Validation: `pnpm exec tsc --noEmit --pretty false` passed. `pnpm exec vitest run src/__tests__/settings-panel.test.tsx --reporter=dot` passed with 22 tests.

### Dev 2 - CalendarCaddy Interaction Polish Result

Status: `DONE` for focused interaction polish; `PARTIAL` for browser-grade manual drag verification.

- `DONE`: Week drag release continues to leave a provisional `New event` on-grid, while cross-day selection and event drops preserve the chosen/original time and report that behavior in status text.
- `DONE`: Vertical resize now listens at window level during the drag and keeps 15-minute snapping; top and bottom handles are visibly present instead of hover-only.
- `DONE`: Month drag supports ranged all-day `New event` creation, and active stamp dragging works across date-bearing month/week surfaces for compact stamp ranges.
- `DONE`: Single click selects, double click edits, right click keeps the contextual menu, Enter opens the selected event outside editable/action controls, Escape closes context/drawer/selection/stamp transient UI, and Delete/Backspace removal is guarded away from editable fields and the drawer.
- `DONE`: Calendar stamp bank now includes the requested birthday, holiday, vacation/PTO, school, travel, focus/work, family, medical, deadline, and parental leave coverage; sample data includes a normal appointment, Zoom appointment, 21 daily recurring appointments, and a two-week August PTO block.
- `PARTIAL`: No in-browser pointer smoke was run in this lane, so real drag feel should still be checked by tester/integrator against the standalone UI.
- Validation: `pnpm exec vitest run src/__tests__/caddyassistant-workspaces.test.tsx` passed with 15 tests. `pnpm exec tsc --noEmit --pretty false` passed.

### Dev 3 - EmailCaddy Usability Polish Result

Status: `DONE` for focused EmailCaddy usability polish; `PARTIAL` for standalone/browser manual smoke.

- `DONE`: `EmailCaddy` keeps the compatible `CadEmailWorkspace` source/export while visible UI stays `EmailCaddy`, with dense rowed inbox layout, compact account/view/filter controls, and compact bulk selection/action controls.
- `DONE`: compose, reply, reply-all, and forward flows now stage editable drafts with To, CC, BCC, Subject, Body, sensitivity, classification, and audience-depth fields.
- `DONE`: reply/reply-all/forward drafts retain quoted source context and show source/attachment chips; forward preserves attachment reference chips without pretending to send provider attachments.
- `DONE`: assistant aids include AI draft staging, `Sanitize`, `What am I forgetting?`, ask extraction, sensitivity warning/classification controls, and explicit guardrails that CaddyAI may draft/analyze but does not send mail.
- `DONE`: safe keyboard behavior covers Enter via row/action buttons, Escape clearing transient assist/notice UI, and Delete/Backspace deleting selected visible rows only when focus is outside draft/editable fields.
- `PARTIAL`: no standalone browser smoke was run in this lane, so tester/integrator should still verify visual density and keyboard feel in the final built artifact.
- Validation: `pnpm exec vitest run src/__tests__/caddyassistant-workspaces.test.tsx` passed with 15 tests. `pnpm exec tsc --noEmit --pretty false` passed.

### Dev 4 - AssistantCaddy Onboarding / Shell Result

Status: `DONE` for overview shell cleanup; `DEFERRED` for broad desktop windowing/notifications.

- `DONE`: `AssistantCaddy` now defaults to a compact routing console. Optional quick-action, signal, and today modules are behind widget preferences instead of being the default panel.
- `DONE`: setup prompts appear when no AI provider is configured and when no email/calendar source has been staged. Copy stays provider-agnostic across Microsoft, Google, Proton, meeting apps, maps, and similar sources.
- `DONE`: workflow routes are explicit for `EmailCaddy`, `CalendarCaddy`, daily brief, prep, sanitization, `What am I forgetting?`, and setup.
- `DEFERRED`: Odysseus-style draggable/minimizable/snappable panes and bottom-right notification bubbles are documented as phase two in `docs/caddyassistant-caddyshack-mini-spec.md` to avoid broad route/shell churn in this pass.
- Validation: `pnpm exec tsc --noEmit --pretty false` passed. `pnpm exec vitest run src/__tests__/caddyassistant-workspaces.test.tsx` passed after dropping unsupported `--runInBand`.

### Reviewer 1 - Product/UX Consistency Review

Status: `PARTIAL` pending developer iterations and standalone/browser smoke.

- `DONE`: Settings top tabs are restored as compact text-first tabs in the requested order, and the newer Appearance content sits inside the original ThreatCaddy settings shell. Focused settings/workspace tests passed: `pnpm exec vitest run src/__tests__/settings-panel.test.tsx src/__tests__/caddyassistant-workspaces.test.tsx --reporter=dot` (`38` tests).
- `DONE`: Appearance source review found separate `ThreatCaddy themes` and `Odysseus themes`, Odysseus background pairings, Color Harmony controls for accent/harmony/mode/preview/apply, sidebar icon accent toggle, and `AppLayout` wiring for `BgEffectLayer`.
- `DONE`: AssistantCaddy and EmailCaddy mostly match the ledger direction: AssistantCaddy is a routing/setup console with optional widgets, EmailCaddy is a dense rowed inbox with compose/reply/reply-all/forward, CC/BCC/subject/body, sanitize, coverage check, ask extraction, and explicit no-send guardrails.
- `PARTIAL` (`P1`): CalendarCaddy's "today" model is hard-coded to `2026-06-04T09:00:00` in `src/components/CaddyAssistant/CalendarCaddyWorkspace.tsx`, so the Today button, selected date, current-day text, and highlight are stale on the current rollout date (`2026-06-05`). The focused test currently asserts `Thursday, June 4`, so it preserves the bug instead of catching dynamic-current-day behavior. Requested iteration: derive today from the runtime clock or an injectable clock fixture, update the test to prove current-day behavior, and preserve deterministic sample events separately.
- `PARTIAL` (`P2`): Week drag-selection appears to remain a single-day state. When crossing into an adjacent day, the implementation moves the selected time range to the hovered day instead of representing a horizontal adjacent-day selection. Requested iteration: either implement true adjacent-day horizontal selection per the ledger or explicitly narrow the acceptance wording/status if "move selected range to adjacent day" is the intended behavior.
- `PARTIAL` (`P2`): IA naming still has adjacent visible drift. The CaddyShack workbench route still shows `Experimental lane` / `Odysseus Lab`, and the Team Feed onboarding panel has hard-coded `Getting Started with CaddyShack` / `CaddyShack requires...` text even though the English locale and ledger distinguish `CaddyShack` from `Team Feed`. Requested iteration: align those visible strings with the ledger, keeping hidden compatibility aliases only where needed.
- `PARTIAL`: Source and focused tests support CalendarCaddy stamp/event/delete/drawer behavior and EmailCaddy keyboard guardrails, but no browser-grade pointer smoke or file-standalone visual check was run by Reviewer 1. Tester/integrator should still verify file target behavior for background motion visibility, CalendarCaddy drag/drop/resize/stamp ranges, EmailCaddy keyboard feel, and overall density before final `DONE`.

### Reviewer 2 - Code Quality / Safety / Accessibility Review

Status: `PARTIAL` pending developer iterations and browser-grade verification.

- `DONE`: EmailCaddy no-send guardrail is preserved in source review. `Stage send review` only marks local draft state as queued and shows explicit human-confirmation copy; I found no provider send call, `mailto:` launch, or hidden network send path in `src/components/CaddyAssistant/CadEmailWorkspace.tsx`.
- `DONE`: Provider copy is mostly agnostic in the reviewed AssistantCaddy/EmailCaddy/CalendarCaddy surfaces: Microsoft, Google, Proton, Zoom, Teams, Meet, Webex, Slack, and maps appear as examples or staged providers, not as a single assumed tenant.
- `DONE`: Phase-two desktop/windowing/notification work is properly deferred in `docs/caddyassistant-caddyshack-mini-spec.md`; I did not see a half-built AssistantCaddy window manager or notification bubble implementation in this pass.
- `PARTIAL` (`P1`): CalendarCaddy renders focusable `role="button"` month/week cells that contain nested real buttons for add-event, event rows, stamp badges, and draggable events (`src/components/CaddyAssistant/CalendarCaddyWorkspace.tsx:2023`, `src/components/CaddyAssistant/CalendarCaddyWorkspace.tsx:2083`, `src/components/CaddyAssistant/CalendarCaddyWorkspace.tsx:2105`, `src/components/CaddyAssistant/CalendarCaddyWorkspace.tsx:2193`, `src/components/CaddyAssistant/CalendarCaddyWorkspace.tsx:2270`). This is an accessibility and keyboard semantics risk because nested interactive controls can produce confusing focus order and screen-reader announcements. Requested iteration: make the cell container non-interactive with explicit child buttons, or split "select day/time slot" into a dedicated button that does not wrap other interactive controls; add a focused test for tab order/activation.
- `PARTIAL` (`P1`): CalendarCaddy still uses a hard-coded `CALENDAR_TODAY = new Date('2026-06-04T09:00:00')`, so the current-day state remains stale for the 2026-06-05 rollout date and the test currently protects June 4 behavior. Requested iteration matches Reviewer 1: use runtime/injectable clock for "today" while keeping sample events deterministic.
- `PARTIAL` (`P2`): Reduced-motion behavior is implemented in `BgEffectLayer` by stopping the animation frame loop, but there is no focused test or browser smoke proving reduced-motion users get a stable non-jarring canvas for non-dot effects. Requested iteration: add a small reduced-motion test around `matchMedia('(prefers-reduced-motion: reduce)')` or record explicit browser smoke before final `DONE`.
- `PARTIAL` (`P2`): Tests cover Enter/Delete/Escape guardrails and no-send copy, but not tab-order predictability, nested interactive calendar semantics, cross-day drag selection, or reduced-motion behavior. Requested iteration: add focused tests for those gaps or downgrade the relevant claims to `PARTIAL` until browser/pointer verification is complete.
- Validation run by Reviewer 2: `pnpm exec vitest run src/__tests__/caddyassistant-workspaces.test.tsx src/__tests__/settings-panel.test.tsx --reporter=dot` passed (`2` files, `38` tests). No heavy tests or standalone file smoke were run.

### Loop 2 - Reviewer Finding Resolution

Status: `DONE` for blocker-class reviewer findings; `PARTIAL` for browser-grade pointer/reduced-motion smoke.

- `DONE` (`P1`): CalendarCaddy no longer hard-codes `2026-06-04` as today. The workspace derives today from runtime state, with an injectable `window.__TC_CALENDARCADDY_TODAY__` fixture for deterministic tests. Focused tests now pin today to `Friday, June 5` instead of preserving the stale June 4 assertion.
- `DONE` (`P1`): Month/week calendar cells are no longer focusable `role="button"` wrappers containing nested controls. The cells are containers, with explicit child buttons for selecting a month day and adding a week time-slot event; event and stamp controls remain separate interactive siblings.
- `DONE` (`P2`): Week selection now tracks selected days separately from selected time-of-day, so horizontal drag previews and provisional creation can span adjacent days instead of merely moving a single-day range.
- `DONE` (`P2`): Visible IA naming drift was reduced: the CaddyShack workbench header now says `CaddyShack`, the route pill says `CaddyShack workbench`, and old Team Feed onboarding/back-button strings now say `Team Feed`.
- `PARTIAL` (`P2`): Reduced-motion behavior remains source-reviewed but not yet separately unit-tested. It is queued for tester/browser smoke before final closeout.
- Validation: `pnpm exec vitest run src/__tests__/caddyassistant-workspaces.test.tsx --reporter=dot` passed with `16` tests. `pnpm exec tsc --noEmit --pretty false` passed. Integrated focused validation passed: `pnpm exec vitest run src/__tests__/settings-panel.test.tsx src/__tests__/components.test.tsx src/__tests__/caddyassistant-workspaces.test.tsx src/__tests__/theme-schemes.test.ts --reporter=dot` (`71` tests).

### Tester 2 - Manual Checklist / User Feedback Coverage

Status: `PARTIAL` for final manual/browser gate; `DONE` for scoped user-feedback representation; `BLOCKED`: none.

- `DONE`: Reviewed the rollout ledger, this feedback file through Loop 2, and current source/tests for the named user critiques. The critiques are represented in the working record and implementation surface: Settings top tabs, CalendarCaddy current day/Sunday start/stamps/drag/delete, EmailCaddy dense compose/reply/reply-all/forward/CC/BCC/no-send, AssistantCaddy setup/clean shell, Odysseus themes/backgrounds, and visible naming.
- `DONE`: Focused validation passed on `2026-06-05 11:06 EDT`: `pnpm exec vitest run src/__tests__/settings-panel.test.tsx src/__tests__/caddyassistant-workspaces.test.tsx --reporter=dot` (`2` files, `39` tests). The passing scope covers compact Settings tabs; Odysseus theme/background picker basics; dynamic CalendarCaddy current-day fixture; non-nested calendar controls; CalendarCaddy delete/input guardrails; EmailCaddy dense surface, editable draft/reply-all/no-send behavior; and AssistantCaddy routing/setup shell.
- `DONE`: Source inspection confirms the remaining critique details that are not all individually asserted by tests: CalendarCaddy uses Sunday-first `DEFAULT_WEEK_START_INDEX = 0`, includes the requested stamp set, and has day/event stamp removal plus drag/range paths; EmailCaddy exposes compose/reply/reply-all/forward with CC and BCC controls and keeps `Stage send review` local; Appearance separates `ThreatCaddy themes` from `Odysseus themes`, imports Odysseus seed palettes/background defaults, exposes the background animation bubble picker, and wires `BgEffectLayer`.
- `PARTIAL`: No real browser/file-standalone manual smoke was run in this Tester 2 lane. Final gate should still manually verify background motion/reduced-motion behavior, CalendarCaddy pointer drag/resizing/stamp range feel, EmailCaddy visual density/keyboard feel, and the standalone visible naming surface before changing the overall rollout to final `DONE`.
- `PARTIAL`: Focused tests do not explicitly assert Sunday-first weekday header order or the complete Settings top-tab order beyond the key tabs, even though source and ledger show the intended behavior. Final requested fix: add focused assertions for Sunday-first headers and full top-tab order, or record explicit manual proof in the final integration smoke.
- `BLOCKED`: none.

### Tester 1 - Automated Validation / Browser Standalone Readiness

Status: `PARTIAL` overall; `DONE` for build artifact confirmation, focused automated checks, and core browser/file-standalone smoke; `BLOCKED`: none after local-server/browser escalation.

- `DONE`: Confirmed `/Users/brdavies/Documents/ThreatCaddy updates/threatcaddy-standalone.html` exists, was rebuilt on `2026-06-05 11:04:28 EDT`, is `12,518,652` bytes, and has SHA-256 `9228a12a6c8358ed75b5236a4107b4ef8c2bf63852d0f7ac43d35b913070a595`.
- `DONE`: Confirmed the standalone artifact matches the current single-file build output: `cmp -s dist-single/index.html "/Users/brdavies/Documents/ThreatCaddy updates/threatcaddy-standalone.html"` returned `standalone_matches_dist_single`; `dist-single/index.html` was built at `2026-06-05 11:04:27 EDT`.
- `DONE`: Static standalone content probe found expected rollout strings in the artifact: `AssistantCaddy` (`29`), `EmailCaddy` (`33`), `CalendarCaddy` (`21`), `ThreatCaddy themes` (`2`), `Odysseus themes` (`1`), `Color Harmony` (`1`), `General` (`14`), and `Appearance` (`20`).
- `DONE`: Focused validation passed: `pnpm exec tsc --noEmit --pretty false`; `pnpm exec vitest run src/__tests__/settings-panel.test.tsx src/__tests__/components.test.tsx src/__tests__/caddyassistant-workspaces.test.tsx src/__tests__/theme-schemes.test.ts --reporter=dot` passed with `4` files and `71` tests. Vitest emitted the existing warning ``--localstorage-file` was provided without a valid path`, but the run passed.
- `DONE`: Playwright was available: `pnpm exec playwright --version` returned `Version 1.58.2`.
- `DONE`: Preview smoke was feasible after escalation. Initial `pnpm exec vite preview --config vite.config.single.ts --host 127.0.0.1 --port 4173` failed in the sandbox with `Error: listen EPERM: operation not permitted 127.0.0.1:4173`; the same preview command was rerun with approval and served `http://127.0.0.1:4173/`.
- `DONE`: Initial sandboxed Playwright launch failed with `FATAL: ... bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer... Permission denied (1100)`; the same temporary `pnpm exec node -e` Playwright smoke was rerun with approval and Chromium launched successfully.
- `DONE`: Browser preview smoke covered app load, `AssistantCaddy`, `EmailCaddy`, `CalendarCaddy`, Settings top tabs, and Appearance theme sections. Passed checks included visible app header, sidebar views, AssistantCaddy heading/prompt/routes, EmailCaddy heading/search/bulk action/compose To field, CalendarCaddy heading/prompt/month/current `Friday, June 5`/stamp, Settings shell, full tab order `General | Appearance | AI | Agents | Data | Templates | Intel | Integrations | Shortcuts | System`, `ThreatCaddy themes`, and `Odysseus themes`.
- `DONE`: Direct `file://` standalone smoke passed for the actual user-facing artifact `file:///Users/brdavies/Documents/ThreatCaddy%20updates/threatcaddy-standalone.html`. Passed checks included header, views nav, AssistantCaddy, EmailCaddy, EmailCaddy search, CalendarCaddy, CalendarCaddy current `Friday, June 5`, Settings shell, full Settings tab order, `ThreatCaddy themes`, and `Odysseus themes`; no console errors or page errors were captured.
- `PARTIAL`: `Color Harmony` is present in the standalone bundle as a literal, but it is not rendered in `document.body.innerText` in either the preview smoke or direct `file://` standalone smoke after opening Settings -> Appearance. The focused smoke timed out waiting for visible `Color Harmony`, and a DOM inspection returned `hasColorHarmony: false`. This is the main residual browser-readiness risk for the Appearance claim.
- `PARTIAL`: This lane did not exercise real pointer drag/resize feel for CalendarCaddy, background animation/reduced-motion behavior, or deeper EmailCaddy keyboard traversal. The smoke proves the core surfaces load and key controls render in the rebuilt standalone, not full interaction quality.
- Commands run: `stat -f '%Sm %z %N' -t '%Y-%m-%d %H:%M:%S %Z' "/Users/brdavies/Documents/ThreatCaddy updates/threatcaddy-standalone.html"`; `shasum -a 256 "/Users/brdavies/Documents/ThreatCaddy updates/threatcaddy-standalone.html"`; `find dist-single -maxdepth 2 -type f -print | sort | xargs -n 1 stat -f '%Sm %z %N' -t '%Y-%m-%d %H:%M:%S %Z'`; `cmp -s dist-single/index.html "/Users/brdavies/Documents/ThreatCaddy updates/threatcaddy-standalone.html"`; `pnpm exec tsc --noEmit --pretty false`; `pnpm exec vitest run src/__tests__/settings-panel.test.tsx src/__tests__/components.test.tsx src/__tests__/caddyassistant-workspaces.test.tsx src/__tests__/theme-schemes.test.ts --reporter=dot`; `pnpm exec playwright --version`; `pnpm exec vite preview --config vite.config.single.ts --host 127.0.0.1 --port 4173`; temporary inline `pnpm exec node -e` Playwright preview smoke; temporary inline `pnpm exec node -e` Playwright direct `file://` standalone smoke; temporary inline `pnpm exec node -e` Playwright DOM inspection for Appearance `Color Harmony`.
- `BLOCKED`: none remaining. The exact transient blockers were sandbox-only local port bind denial and sandbox-only Chromium MachPort denial; both were resolved by approved reruns.

### Integrator Add-On - Theme-Aware Selects And Appearance Preview QA

Status: `DONE` for native select contrast patch; `DEFERRED` for deeper preview/dropper remap.

- `DONE`: Added global native select popup tokens in `src/index.css` so dropdown menus use the active `--color-*` palette instead of defaulting to white popups on dark/green themes.
- `DONE`: Added light/dark `color-scheme` rules and option/selected/disabled styling so native dropdown text remains readable across custom dark and light palettes.
- `DONE`: Added a focused source-level regression test in `src/__tests__/theme-control-css.test.ts` to keep the select popup token layer from being removed accidentally.
- `DONE`: Validation passed with `pnpm exec vitest run src/__tests__/theme-control-css.test.ts src/__tests__/caddyassistant-workspaces.test.tsx --reporter=dot` (`17` tests) and `pnpm exec tsc --noEmit --pretty false`.
- `DONE`: Rebuilt the standalone with `pnpm update:standalone`. The refreshed `/Users/brdavies/Documents/ThreatCaddy updates/threatcaddy-standalone.html` matches `dist-single/index.html` byte-for-byte and both have SHA-256 `4613477b99b8bd627ee769464bafaf9f83dbcaed3c4ba17a3cb77eed43dadc25`.
- `PARTIAL`: In-app browser `file://` reload verification was blocked by Browser Use URL policy after the rebuild, so this pass is artifact-verified rather than visually verified in the live browser.
- `DEFERRED`: The Appearance preview still needs a dedicated repair pass for logo/title accent representation, preview-region click accuracy, and the color-dropper mapping. The user-provided examples show the preview text/logo coloring and click target model do not yet match the real ThreatCaddy surface closely enough.
- `DEFERRED`: The previous Tester 1 finding that `Color Harmony` is present in the bundle but not visible during a default Appearance smoke remains open until the integration smoke explicitly opens the correct tab/section or the control is made more discoverable by default.

### Integrator Add-On - EmailCaddy Rounded Menus And Reader Splitter

Status: `DONE` for implementation and focused validation; `PARTIAL` for live visual file-browser confirmation.

- `DONE`: Replaced the visible EmailCaddy toolbar native selects with a shared `ToolbarSelect` popover so mailbox, account, focus, bulk-selection, and bulk-action menus use rounded ThreatCaddy-shaped surfaces instead of square native OS dropdown chrome.
- `DONE`: Added a draggable horizontal splitter between the inbox rows and selected email/draft reader. The inbox area now starts at a bounded height and can be resized between compact and spacious states.
- `DONE`: Made the selected email/draft article a flex column with an independent scrollable body, so message context, draft fields, safety notes, and action buttons remain reachable instead of being clipped at the bottom.
- `DONE`: Updated focused workspace tests to cover the custom toolbar comboboxes and the new `Resize selected email pane` separator.
- Validation: `pnpm exec vitest run src/__tests__/caddyassistant-workspaces.test.tsx --reporter=dot` passed with `16` tests, `pnpm exec tsc --noEmit --pretty false` passed, and `pnpm update:standalone` rebuilt `/Users/brdavies/Documents/ThreatCaddy updates/threatcaddy-standalone.html`.
- `PARTIAL`: As before, final visual confirmation should happen by manually reloading the open `file://` standalone because direct in-app Browser file reload automation is policy-limited in this environment.
