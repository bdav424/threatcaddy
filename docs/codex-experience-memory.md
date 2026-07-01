# Codex Experience Memory

Project-local memory for ThreatCaddy V3 Codex work. This file is for reusable operating lessons that help future chats work faster with fewer repeated lookups.

This is not the product ledger, not a requirements source of truth, and not a place for investigation/case substance. Product decisions, user-facing bugs, source-gated slice status, artifact hashes, and promotion evidence belong in the rollout ledger and handoff.

## How To Use This File

- Read this file after `AGENTS.md` and before deep source exploration.
- Prefer entries that include a verified command, file path, or gate result.
- Treat entries as reusable process guidance, not proof that current source still behaves that way.
- Add concise hotwash-derived lessons after each source-gated slice.
- Do not store credentials, tokens, private investigation details, live customer data, or provider-specific secrets here.

## Memory Curator Role

The sixth rollout teammate is the Memory Curator. Its job is to reduce future token spend by converting verified hotwash feedback into short reusable process lessons.

Responsibilities:

- Read completed slice hotwashes, ledger entries, handoff notes, and gate evidence.
- Extract only reusable process lessons.
- Deduplicate repeated lessons before appending.
- Keep product-specific details in `docs/assistantcaddy-rollout-ledger-2026-06-05.md` or `docs/assistantcaddy-workspace-overhaul-handoff-2026-06-06.md`.
- Mark uncertainties as `needs recheck` instead of presenting them as durable rules.
- Never edit standalone artifacts or run promotion commands.

Done criteria:

- New lesson is short enough for future chats to scan quickly.
- Lesson points to the canonical file or command when useful.
- Lesson avoids product backlog duplication.
- `git diff --check` passes after edits.

## Current Project Shortcuts

- Canonical source tree: `/Users/brdavies/Documents/ThreatCaddy updates/ThreatCaddy-V3`.
- Primary ledger: `docs/assistantcaddy-rollout-ledger-2026-06-05.md`.
- Handoff: `docs/assistantcaddy-workspace-overhaul-handoff-2026-06-06.md`.
- Full strategy retrospective: `docs/codex-threatcaddy-strategy-retrospective-2026-06-11.md`.
- Standalone smoke preference: `http://127.0.0.1:4181/threatcaddy-standalone.html`.
- Avoid stale `4179` unless explicitly revalidated.
- Before standalone promotion, confirm `src/components/CaddyAssistant/CadEmailWorkspace.tsx` line count and `export const CadEmailWorkspace = EmailCaddyWorkspace;`.

## Verified Process Lessons

### Multi-Chat Coordination

- Keep parallel slices bounded and non-overlapping. Use one head-chat integrator to verify claimed write sets, rerun gates, reconcile conflicts, and own standalone promotion.
- Use subagents only for narrow, independently gateable slices with non-overlapping write sets. Keep shared/high-risk integration, broad source judgment, and standalone promotion in head chat.
- Worker slice output is advisory until head chat reproduces source sanity and the relevant gates locally.
- Require every worker to return a fixed `DONE PACKET` before head-chat review: objective, files changed, exact write set, gates run with pass/fail counts, ports used, temp files created/deleted, residual risks, hotwash, and one-line promotion recommendation.
- Head chat should review worker `DONE PACKET`s first, then spot-check source and tests. Do not broadly reread or rediscover a finished slice unless the packet is missing evidence, contradicts local source, or touches shared/high-risk code.
- Worker packets should include affected files, primary selectors/test names, and behavior boundaries so head chat can run one combined gate instead of rebuilding coverage from scratch.
- Do not treat green integrated gates as promotion-ready until assigned read-only cross-reviews are complete. If reviews find contract gaps, head chat should repair, add focused regressions, and rerun TypeScript/build/focused tests/static scan/diff before checkpoint or promotion.
- Every source-gated worker slice should close with a hotwash and `MEMORY-CANDIDATE` process lessons. Worker chats should not write global memory directly.
- Idle slice threads should receive a narrow next assignment or a `SOURCE-GATED BLOCKED` instruction with required evidence. Passive watching wastes tokens.
- Do not keep a worker in watcher mode when no work is assigned. Either give it the next narrow backlog item, ask it to verify a specific gate/evidence claim, or close it and record its final status.
- When reassigning a stalled slice to another worker, mark one worker as authoritative, send the original a no-write closure instruction, and reject any late original writes before accepting packets. Reassignment can otherwise create a same-write-set race.
- When conflicting multi-chat roster or replacement prompts appear, freeze worker routing first, append one latest authoritative roster with exact thread IDs and write sets, send no-write closure to every superseded/conflicted worker, and accept only local source evidence plus matching `DONE PACKET` or `SOURCE-GATED BLOCKED` output from that roster.
- After accepting final worker `DONE PACKET`s and promotion evidence, archive or close completed worker threads and record that closure in the ledger or handoff. Leaving accepted workers idle creates repeated status-audit token spend.
- Do not assume archived worker chats can be reopened or found by search for the next wave. If the thread tool cannot recover usable archived-worker metadata quickly, create fresh workers and record the new thread IDs in the ledger/handoff.
- When reusing or renaming old worker chats, assume their previews may contain stale project roots and tasks. Start each fresh delegation with an explicit supersede-old-context instruction, current source root, allowed write set, and forbidden promotion/artifact actions.
- After delegating to reused worker chats, poll them once for role acceptance before waiting on packets. If a worker forwards the prompt, routes threads, or returns an unrelated old packet, correct or replace it immediately and record the authoritative worker map before source gates.
- When fresh worker chats must be created from a parent workspace because the saved project does not target the source subdirectory directly, require a `pwd`/source-root preflight before edits and have head chat check the parent workspace for misplaced slice files before accepting packets.
- Prefer separate worktrees for write-capable worker chats when the thread tooling can support it. Same-directory workers can still be used for narrow slices, but build-mode failures from another active slice must be treated as integration-pending until head chat quiesces workers and reruns canonical gates from the current tree.
- Before dispatching a worker, make the assignment copy-ready: include exact shell-ready `writeSet`, `prodFiles`, `testFiles`, focused Vitest command, accepted blocker vocabulary, known opaque-handle exceptions, and known dependent roots/tests. Copy-ready prompts reduce worker rediscovery and regex drift.
- After a wave has already proven no-live contract-root hardening across a capability family, avoid repeating another micro-root-only wave unless a blocker requires it. Prefer broader vertical capability slices with non-overlapping write sets, clear live-side-effect gates, and fake/local test adapters so rollout work moves from proof-of-inertness toward usable execution paths.
- Include a compact `SLICE PREFLIGHT` block in worker delegations: source root, allowed write set, adjacent read-only files, known stale or outside-slice failures, required gates, current integration state, and the acceptance rule for shared-tree build failures. This reduces repeated reads of handoff rules and prevents workers from treating integration-pending failures as slice-local defects.
- For runtime-boundary worker prompts, add a compact contract map: `EXPECTED_SAFE_OUTCOME` (`ready metadata`, `fail-closed blocker`, or `source-gated outside write set`), current contract facts/reason strings, known safe exceptions, known tree or gate anomalies, and trusted helper line anchors. This lets workers update in-scope tests and classify integration-pending blockers without rereading long boundary files or weakening head-chat source acceptance.
- For manifest-only or boundary-only slices, state whether the new module is a one-way converter over an accepted upstream decision or a new caller-supplied request contract. That choice determines the trusted input boundary, fail-closed reasons, fixture shape, and whether broader callers must remain untouched.
- Require worker packets to include a compact machine-readable block when possible, even if the surrounding packet is human-readable. Minimum keys: state, files changed, exact write set, gates with pass/fail counts, ports, temp files, blockers, memory candidate, automation candidate, and promotion recommendation.

### Source Gates

- Minimum source gate before promotion discussion: source sanity, TypeScript, focused Vitest, focused Playwright/browser proof when UI changed, `git diff --check`, checkpoint, and ledger/handoff update.
- Promotion coordination should use a fixed checklist: source sanity, TypeScript, focused Vitest, focused Playwright, `git diff --check`, checkpoint, standalone update, artifact parity, HTTP smoke, browser smoke, ledger/handoff closeout.
- In this V3 checkout, `git status` has repeatedly shown the tree as all-untracked. Treat `git diff --check` as whitespace hygiene, not strong provenance.
- In all-untracked checkouts, pair `git diff --check -- <exact files>` with an exact-write-set trailing-whitespace scan such as `rg -n "[ \t]+$" <exact files>` before source-gate closeout. `git diff --check` can pass while untracked-file whitespace drift still needs explicit review.
- For new untracked source-gated files, workers should include `git status --short -- <exact files>` plus a targeted `find`/`rg --files` check for stale or alternate filenames in the DONE PACKET so head chat can verify provenance without broad rediscovery.
- In this V3 checkout, use `pnpm exec vitest run <exact files>` for focused worker evidence when possible. `pnpm test:run -- <paths>` has repeatedly expanded into broader unrelated suites and wasted worker/coordinator review tokens.
- Before build-mode TypeScript gates in multi-chat slices, pre-check likely `.tsbuildinfo` paths and record whether they are pre-existing, normal `node_modules/.tmp` cache updates, or unexpected out-of-write-set artifacts. Workers should report unexpected generated artifacts and let the coordinator own cleanup/provenance policy.
- Use checkpoints and explicit write-set records as rollback/provenance evidence when git tracking is weak.
- If checkpoint helpers use a static high-risk file list, verify new contract/helper source and test files are included before relying on the checkpoint. Until the helper is updated, copy the accepted new files into the checkpoint evidence set explicitly.
- Exact future write-set validators should allow the repo's real path grammar, including `src/__tests__`, before claiming a canonical source/test pair is valid; otherwise a manifest can fail its own declared write set.
- When updating shared required-file or durable-scope lists, run the dependent manifest and runtime tests in the same gate. Exact-key consumers may require inert metadata compatibility updates even when the changed list is intended as documentation or preflight scope only.
- Durable-scope reviews should keep three scans separate: exact current-path existence, literal stale-path/broad-directory sentinel checks, and executable no-live call-site scans. A scan for current path substrings does not prove stale paths are absent or safely confined to negative tests.
- After `pnpm update:standalone`, expect the secondary `/Users/brdavies/workspace` mirror to be stale until explicitly refreshed. Verify primary parity first, then refresh the secondary mirror with `node scripts/copy-standalone-artifacts.mjs --target /Users/brdavies/workspace` and prove three-way HTML/sidecar parity before closeout.
- Use `node scripts/assistantcaddy-slice-gate-runner.mjs` for repeatable slice gates when its options fit the slice. It emits compact status, focused Vitest, TypeScript, runtime-boundary scan, actual-call/no-live scan, diff-check, and whitespace evidence; head chat still owns source acceptance and promotion.

### Threat Hunt And Report Packages

- Before country-hunt or report-package work, run a capability preflight for CTI Agent Host, VT/Censys/Flashpoint credentials and routes, visible `file://` standalone access, Word/render tooling, import/export path, and seed source availability. If a required live gate fails, choose package-only/source-only mode up front or stop as blocked.
- Keep live enrichment merge-back mandatory. Validated VT, Censys, Flashpoint, or other enrichment results should be merged into ledgers, report context, notes/tasks/timeline/evidence, and import JSON instead of left only in raw output files.
- Treat visible standalone validation as a separate gate from package generation. Isolated browser profiles, localhost, and dev-server origins do not prove the user's `file://` storage bucket; use Merge import in the visible standalone profile or mark validation incomplete.
- Separate content checks from visual report QA. Jinja/rendered text can prove completeness, but Word/PDF visual QA must verify template fidelity, table fit, page flow, source markers, and classification/footer behavior before release-ready claims.
- When global or automation memory writes are blocked by writable-root policy, preserve the intended memory entry in a workspace-local blocked-memory artifact and report the exact target path and blocker. Do not retry broad writes or treat the memory update as completed.

### Import And User Data Boundaries

- For user-imported artifacts such as evidence files, themes, layouts, connector catalogs, or package JSON, validate at the boundary with explicit caps, parser allowlists, and fail-closed defaults. Do not trust imported IDs, CSS variables, geometry, status, or background-image state without checking that referenced blobs/data exist in the current browser bucket.
- Deduplication should preserve the richest safe object, not blindly the first or newest item. Prefer records with linked entities, OCR/image analysis, analyst notes, or validated enrichment over plainer duplicates, and document what was moved to trash or skipped.

### Browser And Ports

- Prefer standard project Playwright/webServer after confirming the port is clear.
- For standalone promotion smoke, prefer the reusable helper `pnpm smoke:standalone -- --url=http://127.0.0.1:4181/threatcaddy-standalone.html` after HTTP smoke proves the server is serving the promoted parent directory. If macOS Chromium sandboxing blocks the helper, route through Build Web Apps/Browser or a narrow local-only smoke escalation instead of creating ad hoc `/private/tmp` Playwright scripts.
- For standalone smoke in restricted-network sessions, prefer the repo-installed Playwright binary over `npx` CLI wrappers that may try to fetch packages. If the first screenshot catches only the loader, take a delayed app-initialized screenshot before counting browser smoke as passed.
- On macOS Codex desktop, avoid first-running ad hoc Chromium/Playwright smoke scripts inside the command sandbox. If Chromium reports a Mach-port sandbox permission error, treat it as tool noise and rerun through the in-app Browser, the repo Playwright command path, or a narrow approved local-only smoke escalation before recording product evidence.
- If a default browser-test port is occupied, capture exact `lsof`/PID evidence. Do not test against an unknown server.
- A short-lived in-repo Playwright config is safer than a temp config outside the repo when module resolution needs `@playwright/test`.
- Delete temporary configs and confirm the test port is clear before final gates.
- If a test-only browser proof is blocked by unrelated build or TypeScript state from another slice, a controlled short-lived dev server on a cleared standard port with `reuseExistingServer` can prove the scoped browser behavior. Mark the default webServer/build path as not proven and have head chat rerun canonical build gates after integration.

### Connector And Onboarding Work

- Prove storage boundaries, failure states, and no-send/no-network behavior before adding live connector claims.
- When borrowing connector patterns from another local app, classify the source design first: built-in app connector with app-owned storage/routes/tools, generic webhook delivery, or external MCP/server preset. Do not copy UI copy or provider lists across those lanes until auth, secret storage, ownership, consent, send/test boundaries, and no-live gates are explicit.
- For multi-account email or inbox work, require a first-class account registry with owner/default/enabled state, separate receive/send capability fields, encrypted credential references, and an `account` selector carried through every read, send, bulk, background, and agent tool path. Agent prompts should call `list accounts` before named-mailbox actions and should not use generic internal API routes that can be owner-filtered differently from the tool context.
- Treat Slack and chat-message integrations differently from email unless the source proves a native connector. A generic webhook or MCP preset is useful pattern evidence for setup/catalog UI, but not evidence of OAuth, DMs, channel discovery, notification policy, or live-post readiness; build those as separate contracts with dry-run/no-send tests before claiming live messaging support.
- Use pure local metadata modules for design-only catalogs. Importing or reading them should not fetch, write storage, contact providers, or touch credentials.
- Keep provider discovery/design metadata separate from executable or installable integration templates. Make statuses such as `builtin-template`, `catalog-only`, `design-only`, and `not-configured` explicit before UI copy or promotion.
- Keep setup state session-local unless a reviewed secret store and connector boundary exist.
- Gate no-network onboarding shells with both component-level `fetch`/storage spies and browser request monitoring.
- Reuse provider metadata contracts when available instead of creating temporary UI enums.
- Keep catalog dashboards as adapter layers over shared local metadata instead of duplicating provider lists in UI components. Show source status and configuration status separately so catalog support is not mistaken for live connectivity.
- Clone nested optional catalog metadata on read, the same way shared helper arrays are cloned, so UI tests and consumers cannot mutate shared local catalog state across assertions.
- For sanitizer utilities that inspect imported or caller-provided objects, avoid `JSON.stringify` as the safety gate. Use circular-safe traversal and cover cyclic safe/unsafe objects, maps, and sets in focused tests.
- For onboarding no-network browser proof, start request monitoring at the boundary being proven and document unrelated global app-load telemetry separately. Do not click explicit test/connect actions in a passive-selection proof.
- In Vite dev-mode no-network browser proof, classify provider/webhook requests by real hostnames and external origins, not by local module path text. Source paths can include provider names such as `misp` or `webhook` and create false positives.
- For no-live static scans on guard modules, separate broad text hits from executable behavior before treating a scan as blocked. First classify expected guard strings, forbidden-key lists, optional input fields, and test stubs, then run a narrower pass for actual call syntax, dynamic imports, SDK imports, storage calls, and re-export wiring.
- Prefer domain-specific no-live scan profiles or the slice gate runner over hand-written regexes in worker prompts. If a manual scan is needed, distinguish actual calls/imports from inert boundary strings, comments, type names, test stubs, forbidden-key lists, and rejection regex literals before declaring a blocker.
- During same-workspace multi-chat slices, a worker browser gate can fail on a transient TypeScript/build state from another slice. Treat that as advisory until head chat reruns canonical TypeScript and build gates after all `DONE PACKET`s are in.
- In same-directory multi-chat rollouts, stop or quiesce stale workers before running build-mode gates. TypeScript errors that reference exports or shapes not present on disk can indicate a same-directory write race, so rerun the gate after local source reconciliation before accepting or reverting code.
- When parallel same-directory workers add new source files, a worker's full `tsc -b` can fail on another active slice even if its own write set is type-clean. If the failure paths are in the current active roster and the worker's focused tests, plain TypeScript, and diff hygiene pass, treat it as integration-pending evidence for head-chat replay rather than making each worker rediscover the other slice's defects.
- In multi-chat runtime waves, classify build blockers by ownership before repair: own-write-set blocker, outside-slice active-worker blocker, resolved-after-head-chat-replay blocker, or watcher/no-new-state blocker. Only own-write-set blockers should trigger a worker repair; outside-slice blockers should stay integration-pending until head chat quiesces workers and reruns canonical build gates.
- When new contract helpers freeze or return readonly decisions, include a build-mode TypeScript gate such as `pnpm exec tsc -b --pretty false` or `pnpm build`; plain `tsc --noEmit` can miss project-build failures around readonly/mutable API shapes.
- Trusted-builder test fixtures should return explicit production input types at the test boundary, with any trusted-object branding or casts kept inside the fixture builder. Do not let branded trusted objects leak into public evaluator type signatures, because integrated build-mode TypeScript can catch that even when focused runtime tests pass.
- Rejection helpers and runtime facades that return caller-provided or adapter-returned values need one shared redaction policy for every exit path, including skipped, over-limit, malformed, partially parsed, and token-shaped identifier fields. Test both parseable and malformed secret-bearing examples.
- Raw-secret scanners in boundary helpers should separate untrusted live payload key/value scans from reviewed metadata and provenance fields. Validate reviewed metadata with explicit allowlists so safe reference IDs and no-store flags are not misclassified as secrets.
- Runtime provenance validators should reject URL-shaped, schemeless host-path, or transport-like identifiers before ownership-mismatch checks. This preserves the sharper security reason and prevents later owner comparison logic from treating live endpoint material as ordinary provenance metadata.
- Identifier hardening reviews should test both authority URLs such as `scheme://host` and colon-only scheme-bearing strings such as `mailto:user` or `urn:opaque`. A scanner that only rejects `://` forms can still let transport-like identifiers through as safe metadata.
- When blocking scheme-bearing identifiers, anchor scheme regexes at the start of the identifier and keep explicit positive fixtures for supported opaque handles such as local credential references. An unanchored colon/scheme scan can accidentally reject safe handles that contain colons.
- Opaque identifier exceptions must be structurally narrower than generic schemes, such as a reviewed hyphenated-prefix form rather than any `word:` value. Keep shared unsafe-identifier fixtures synchronized across provider, credential, and durable roots so `ftp`, `mailto`, `urn`, localhost, loopback, and host/path forms stay rejected consistently.
- Runtime-boundary slices move faster when generic identifiers, credential-reference exceptions, endpoint URLs, token-like values, raw-secret scans, and approved opaque-prefix handles are validated by separate reusable fixtures instead of inferred from one broad identifier test.
- Contract helpers that ingest externally assembled result objects should validate result ownership against the contract before accepting a pass state. Matching TypeScript shapes are not enough for security-sensitive prerequisites.
- Cross-reviews of dry-run or activation-plan trusted-root adoption should pair source guard evidence with focused negative tests for exact result-key allowlists, proxy/accessor rejection before traversal, and unsafe live-capability fields. Broad static no-live scans alone are useful evidence but not enough to clear these boundary contracts.
- Dry-run harnesses that accept future adapter/result objects should clone and freeze returned safe metadata instead of reusing nested plan/result references, so caller mutation cannot alter accepted decisions after validation.
- When accepting caller-provided typed plan or guard objects, reconstruct returned metadata from explicit allowlisted fields and validate every contradictory boundary flag/blocker, not just the positive `status` or owner fields.
- For fail-closed boundary tests, assert the security invariant when multiple blocker reasons are valid. Over-specifying the first blocker string creates churn when validation order changes but the object remains blocked and non-callable.
- Public mapper helpers that accept multiple precomputed contract/result objects should compare shared ownership fields locally before deriving any ready-shaped output.
- Security-sensitive optional-match helpers should distinguish unconstrained expected fields from missing actual ownership. If the caller or stored capability expects an identity value, absent actual identity must block.
- Credential and identity-boundary tests should include synthetic token-prefix values across every identifier field, not only generic secret-word cases. When proving no storage side effects, spy on `getItem`, `setItem`, `removeItem`, `clear`, and `key`, and avoid cleanup calls inside the assertion window.
- Negative tests for malformed security inputs should cast at the untrusted boundary instead of relaxing the valid production type that enforces secure literal fields.
- For `Partial<>` validation helpers, bind optional properties to local constants and use explicit `typeof` guards so `pnpm exec tsc -b --pretty false` and plain `tsc --noEmit` agree.
- After a source-gate path warning, verify both the mistaken absolute root and intended source root, remove out-of-scope artifacts first, and rerun a final parent-path `find` before accepting gates.
- Union credential/reference helpers should prefer explicit field guards or switch accessors over dynamic indexing so build-mode TypeScript and plain no-emit TypeScript agree.
- Source-gated adapter plans should treat missing independent ownership facts as blockers, not caller convention. Omitted runtime owner, provider id, or request-kind metadata can be as unsafe as a mismatch if the plan would otherwise return inert-but-trusted metadata.
- Readiness contracts should keep catalog support, configured preference, credential reference, consent, runtime ownership, event scope, and manual-test eligibility as separate facts. A configured baseline or symbolic catalog action should not become executable readiness by itself.
- Local endpoint readiness should re-run the local endpoint or bridge allowlist contract on claimed endpoints. Do not trust serialized `allowed`, `accepted`, or probe flags alone.
- Local bridge probe plans should bind the original user/caller input to the accepted endpoint after applying the accepted endpoint scheme. A truthy local revalidation is not enough if a different local endpoint can ride through the plan.
- Runtime adapter or transport facades should stay blocked until the upstream gate exposes an explicit executable contract. If an injected transport is allowed, match it against the exact gate output before calling it.
- Before shape or semantic reads on untrusted adapter/requester objects, inspect property descriptors and reject accessors/proxies; exact-key checks on the parent object are not enough if later code reads nested callable fields.
- Callable injected test doubles are not enforceably safe just because metadata says no side effects. Source-gated executable-contract waves should validate metadata and request shape but keep supplied functions no-call until a reviewed execution boundary can enforce the callable path.
- Callable runtime boundaries must not authorize requester/adapter invocation from structural reviewed fields alone; require non-forgeable trusted identity from the execution boundary, or keep the path plan-only/no-call.
- Targeted no-callback repairs should prove both static absence of the disputed call site and a focused regression where valid-looking caller contracts are not invoked.
- When executor tests feed newly trusted lower-level runtime roots into caller-level fixtures, build those fixtures with the shared trusted contract object helper before treating downstream provenance failures as product behavior.
- Activation-plan and dry-run fixture builders must track current trusted-object and proof preconditions. When a trusted-root contract changes, update the shared fixture builder first so focused tests fail on real boundary behavior instead of stale test construction.
- When an inert execution-gate preview lives near legacy live controls, visually and testably segment the live controls as explicit runtime behavior outside the gate. Adjacent `Test`, `Fetch`, or `Save` actions should not contradict a blocked/plan-only gate state.
- Browser no-live proofs should assert the exact DOM attributes emitted by each runtime-gate surface, including surface-specific names such as `data-provider-action-executable` and `data-provider-action-side-effects`, not only shared/generic descriptor names.
- If concurrent slice work changes UI copy during a browser-proof repair, update stale copy assertions only when the replacement preserves the same no-live invariant and stays within the allowed test write set.
- For AssistantCaddy routing tests, assert the owner surface route first, then open nested setup from that surface. Do not assume overview buttons deep-open nested setup panels unless that route is an explicit UI contract.
- Local bridge requester execution boundaries should enforce loopback/local endpoint provenance, not just absolute HTTP(S) syntax. Reject exact-shape requester facts with extra callback, fetch, socket, or result fields even if the boundary never invokes them.
- Runtime execution boundaries that compose several caller-provided objects should runtime-validate known enum values locally before deriving ready-shaped output. Do not treat self-consistent forged action/kind/scope/target strings as sufficient readiness evidence.
- Checklist-only implementation gates should scan owner fields inside evidence descriptors for token-shaped or secret-like material, and should count only clean, owner-matched, complete descriptors as reviewed evidence.
- Operations-manifest validators should require every proof input that justifies a ready decision, including operation plan, exact future write set, checkpoint requirements, rollback requirements, and upstream blocked-path classes. Treat omitted proof arrays, unexpected nested keys, callback/requester/adapter metadata, and same-origin endpoint path drift as blockers instead of relying on final output redaction.

### UI Slice Testing

- Scope selectors carefully when the same label appears in headings, buttons, cards, nav, empty states, and panel chrome.
- Prefer expanded-state, role-scoped, or card-scoped browser assertions when the same detail text can appear in both a provider card summary and its expanded body.
- For passive catalog UI tests, prefer data-driven or regex count assertions and prove boundary copy through ARIA/live summaries. Avoid pinning exact provider counts unless the provider list itself is the behavior under test.
- For safety-gated UI, keep no-live and blocked-state guarantees executable and mostly invisible: prove them through tests, ARIA/data attributes, and compact status affordances instead of visible placeholder paragraphs or decorative warning panels unless the user can act on them.
- Legacy network-capable UI can be mounted beside newer surfaces only when its default visible state is inert. Add a focused regression proving catalog/provider fetches wait for an explicit user tab/action before unifying old and new UI.
- For responsive UI, first navigate to the intended shell, then resize within that shell. Very narrow initial viewports can boot a different app surface and invalidate the test.
- Browser tests should prove the exact changed user-visible behavior, not broad unrelated smoke paths that can fail from stale legacy assertions.
- For clipped or nested-scroll settings panels, use browser proof for reliable rendered behavior such as compact layout, filters, details expansion, columns, and no-network assertions. Leave callback plumbing that depends on hidden/clipped controls in focused component tests instead of forcing brittle Playwright visibility/click semantics.

### Retrospectives And Automation

- Use `docs/codex-threatcaddy-strategy-retrospective-2026-06-11.md` when a future chat needs the beginning-to-end strategy arc. It summarizes early capability tests, country-hunt repairs, pre-V3 workflow design, and V3 rollout lessons without re-reading every package artifact.
- For long-running or repeated workflows, make preflight a hard decision point: full-validation, source/package-only, or blocked. Continuing after preflight proves a required live gate is unavailable should be an explicit user choice, not the default.
- When the user asks for full history or prior rationale, search archived Codex threads before reconstructing from filesystem artifacts alone. Archived chats captured standalone-origin, local bridge, import-hardening, and RCC coordination lessons that did not all appear in package ledgers.
- For multi-chat rollouts, prefer RCC-style task state: explicit scope, avoid paths, assigned ports, report commands, review gates, capacity limits, and manager-owned acceptance. This reduces duplicated localhost servers, overlapping edits, and ambiguous worker completion claims.
- When a watcher or memory-curator thread performs approved smoke-server cleanup, head chat should verify or record the exact PID/port evidence, avoid rerunning promotion unless artifacts changed, and continue ledger/handoff closeout from the last green parity and smoke gates.
- After same-directory multi-chat races, re-run source discovery and focused gates from the current local tree before promotion, even if the ledger already has a source-gate entry. Append a correction entry when local evidence changes file names, write sets, or test counts instead of silently relying on stale coordination notes.
- Memory-curator/watch threads should include a brief impact review after long runs: lookup avoided, memory entries added/skipped, product feedback routed to ledger instead of memory, duplicate work observed, and one concrete automation or script improvement. Poll the coordinator's latest turn and targeted `rg`/`tail` slices before reading long ledgers.
- For routine coordinator polling, use the smallest thread read that proves current state, usually latest turn only. Multi-turn `read_thread` calls can drag in large completed turns and defeat the token-saving purpose of a watcher.
- If latest-turn polling is itself too large because the active coordinator turn carries a long stale prompt or preview, stop retrying `read_thread`; use `list_threads` only for liveness and the compact ledger/handoff helper or tails for state until a smaller tracker lands.
- Impact reviews should grade the memory/token result, name one thing that wasted tokens, and turn that waste into a tighter next-pass rule when reusable. For large ledgers, avoid broad `rg` output; constrain by recent headings, exact timestamps, `-m`, or `tail` before widening the search.
- Head/coordinator chats should explicitly ask the watcher or memory-curator to run a token/autonomy review after finishing a meaningful unit: worker packet collection, cross-review closeout, integrated gate completion, checkpoint, promotion, blocker decision, or new automation/script adoption. This is cheaper than constant polling because the watcher can stay in anchor-delta mode until the coordinator signals that a review-worthy event happened.
- For rollout-doc status checks, do not run unbounded `rg` across the whole ledger for common terms like `PROMOTED`, `SOURCE-GATED`, or `Dispatch`. Start with `tail -n` around the newest entries, or use anchored date/headline patterns and `-m` limits.
- For memory-candidate harvesting, do not run unbounded `rg` for `MEMORY-CANDIDATE` across the full ledger and handoff. First identify the newest relevant heading or timestamp, then search only that tail/range so historical worker packets do not flood the watcher context.
- When searching for literal status text that contains backticks or shell metacharacters, pass each pattern with single quotes and `rg -e` so the shell cannot perform command substitution or path execution during watcher checks.
- Impact reviews for active rollout goals should check the goal token/time counter when available and compare it against concrete lookup reductions, so the review measures cost control instead of relying on subjective impressions.
- For any token-heavy task, choose the narrowest durable home before saving knowledge: thread for temporary facts, project memory or `AGENTS.md` for repo conventions, skills for cross-project workflows, scripts for deterministic repeated work, automations for recurring checks, issue trackers for deferred work, and handoffs for continuation state. Do not save raw logs, speculation, secrets, or facts already captured in code/docs/tests/issues.
- When the same lookup, extraction, status check, or prompt-shaping step recurs twice, prefer a tiny bounded script/helper or saved template before adding more prose memory. Scripts should emit compact line-numbered evidence, truncation counts, and next-action hints so future chats spend tokens on decisions instead of rediscovery.
- For broad "reduce tokens across any task" goals, start with a reusable task-cost audit: list repeated reads, repeated commands, repeated prompts, and repeated status decisions; convert deterministic repeats into scripts/templates/automations first; reserve memory for short routing rules and reserve extra chats for independent judgment or adversarial review.
- When the user asks to use newly installed plugins, first distinguish exposed MCP tools from skill-only or CLI-backed plugins. Record unavailable CLI/auth gates as tooling evidence, and do not route product assurance through live account connectors unless the user explicitly scopes that side effect.
- Before creating a team of brainstorming, watcher, or task-specific chats, run a token-reduction triage: identify the repeated lookup or decision, decide whether a bounded script, saved template, automation wakeup, or memory entry would remove it, and spawn extra chats only for independent judgment that cannot be made deterministic. Each spawned chat should return one reusable rule, one rejected idea, and one candidate script or automation.
- For long-running multi-chat rollouts, keep a compact resume packet in the ledger/handoff with the current canonical roster, latest accepted source gate, promotion hold, next command set, and memory deltas. This lets a new or reconnected chat resume from targeted `tail`/`rg` reads instead of replaying the whole conversation.
- For connection-resilient rollout watching, prefer a heartbeat/automation plus compact resume packet over a continuously active polling chat. Each wake should poll the latest coordinator turn, run targeted `tail`/`rg` checks, record only changed status or memory deltas, and stop when no action is needed.
- For rollout watcher/context passes, run `node scripts/assistantcaddy-rollout-context.mjs --sections 1` before manual ledger/handoff scans. Widen only if the helper output lacks the current wave, worker roster, promotion hold, or memory/process lane needed for the decision.
- For cheapest routine watcher passes, run `node scripts/assistantcaddy-watch-summary.mjs --sections 1 --context 1` first. It prints latest ledger/handoff headings, line numbers, status, next actions, and in-section `MEMORY-CANDIDATE` lines without dumping historical packets or memory snippets. On follow-up passes, add `--since-ledger-line <line>` and `--since-handoff-line <line>` from the last seen headings to report only new sections; if repeated unchanged pulses are expected, add `--quiet-no-change`, and if a packet line is too large, add `--max-line-chars <n>` before widening reads or retrying thread reads.
- Plugin routing for rollout gates should be milestone-based, not always-on: use Build Web Apps/Browser for rendered UI and standalone smoke evidence; use Codex Security diff scan after integrated source gates on security-sensitive runtime/storage/auth/connector waves; use CodeRabbit only when a clean git-backed diff or staged write set exists and an independent code-review pass is worth the CLI/auth overhead. Worker slices should still use local focused gates first.
- For integrated no-live source gates, prefer `node scripts/assistantcaddy-no-live-call-scan.mjs --files <prod files...>` over ad hoc regex commands. It emits compact file counts, executable call/import matches, and pass/fail status while avoiding known false positives such as RegExp `.exec(...)`.
- After several consecutive `no_change` watcher pulses from the same ledger/handoff anchors, widen the heartbeat interval and avoid thread metadata or transcript reads until the local docs move. Rechecking unchanged anchors too frequently becomes the dominant token cost once the helper is quiet.
- For blocker retrospectives, separate active rollout blockers from watcher blockers. Count distinct root causes instead of repeated tracker mentions, then convert only repeated process causes into memory or automation: build-gate phase mistakes, missing shared fixture matrices, trusted-fixture typing leaks, stale worker routing, or over-frequent no-change polling.
- Once the rollout-context helper surfaces several packet trackers, avoid dumping its full output in watcher turns. Use `tail`/bounded `rg` around the newest timestamps or pipe the helper through a short `sed -n` window so the watcher spends context on changed state rather than replaying all packets.
- If existing worker threads are readable or pinnable but `send_message_to_thread`/title updates fail with `No AppServerManager registered for conversationId`, do not count those threads as assigned. Record the route blocker and use active in-session workers or newly reachable threads with exact write sets.

### Budgeted Usage

- For a target Codex budget around `$100/month`, reserve Codex for reasoning-heavy work: diagnosis, design decisions, non-trivial edits, and review. Move repeatable inspection, status summaries, hash checks, file inventories, and rebuild freshness checks into local scripts or one-shot commands.
- Batch related work into fewer sessions and avoid re-asking the same question across chats. If a check is deterministic, script it once and reuse the helper instead of spending chat turns re-deriving the answer.
- Rebuild and smoke-test only when source changed. Do not rerun standalone promotion or browser smoke against unchanged artifacts just to confirm the same state twice.
- For ledger/handoff timestamps, use local shell time commands such as `date` and `TZ=UTC date` rather than web/time lookups. Timestamp conversion is deterministic local state and should not spend network/tool context.
- During long worker-collection phases, record each partial worker packet in a compact ledger/handoff tracker as it arrives: slice id, DONE/BLOCKED state, exact files, gate blocker, memory/automation candidates, and whether it is integration-pending. Do not leave packet state only in chat history if another session may need to resume.
- If a coordinator turn is `interrupted` or `systemError` after a `fileChange`, classify that loop as source-touched but ungated until current files, focused tests, ledger/handoff closeout, and promotion evidence prove otherwise. Watchers should use exact `git status --short -- <files>`, bounded `rg`, and `git diff --check` rather than treating prior docs as final.
- For injected runtime facades, cross-review should require negative tests for every independently matchable identity field, not just one representative mismatch.
- Plan-only invocation boundaries should exact-key-validate provider execution and runtime result objects. Extra adapter metadata, live-claim fields, or prompt/body/header echo text should invalidate the contract even when primary identifiers match.
- Runtime-boundary facades should keep reviewed readiness facts separate from forbidden side-effect facts, exact-key-check short status markers as well as obvious live-action fields, and keep returned decision shapes stable for downstream exact-key validators.
- For local provider readiness, treat multiple accepted loopback endpoints as endpoint drift and block until one reviewed endpoint is bound and revalidated.
- Manifest-style security gates must exact-key-validate the root input object as well as nested evidence objects. Root-level requester, callback, fetch, socket, transport, result, provider, or storage fields should not ride along with a ready plan-only decision.
- Exact-key allowlists prove only key names. Security boundary validators must also validate allowed field value types and array element types so objects/functions cannot hide inside approved metadata fields.
- Browser JavaScript contract roots cannot claim arbitrary-object safety from descriptor traversal or `structuredClone` alone: prove getter-free and Proxy-trap-free normalization separately, or require a trusted builder/brand before promotion.
- Browser trusted-object guards should be identity-only on untrusted inputs; keep any key, value, array, or nested traversal inside controlled trusted builders and never present builders as arbitrary-object sanitizers.
- For trusted-root residual cross-reviews, a no-change or caller-lag slice is acceptably fail-closed only when review evidence cites the callee identity guard before snapshot/scans, exact/root-shape rejection, no-side-effect output, and no-live tests; otherwise route a bounded repair instead of treating no code changes as acceptance.
- Trusted-root repair re-reviews should require negative tests for plain-object, accessor-object, and Proxy roots with getter/trap counters, plus one positive trusted-builder fixture proving compatibility.

## Candidate Lessons To Review Later

- Add a lightweight script that extracts `MEMORY-CANDIDATE`, `DONE PACKET`, `SOURCE-GATED BLOCKED`, and gate-command lines from the ledger/handoff, groups near-duplicates, and proposes compact manager summaries or project-memory wording without copying product facts.
- Add a small bounded-read helper for token-heavy tasks: accept path, optional pattern, context line count, and max output lines; return line-numbered snippets, truncation metadata, and suggested next narrow query before any broad file read.
- Add a standard handoff template for worker slices: write set, source base, gates, ports used, temp files created/deleted, residual risk, hotwash.
- Add a durable scope freshness helper that rejects required-file lists containing missing paths or broad directories, verifies banned stale paths appear only in negative tests, confirms no executable storage/sync call sites exist in manifest production files, and prints exact current candidate files before a worker packet is accepted.
- Add a wave-status helper or manifest that records the active wave roster, thread IDs, exact write sets, packet state, accepted gates, blockers, promotion hold, known ports, and current artifacts, then emits a compact head-chat status table without rereading chat history.
- Extend `scripts/assistantcaddy-slice-gate-runner.mjs` with review/repair modes, per-domain scan profiles for provider, messaging, local bridge, LLM, credential, durable storage, and UI browser gates, and packet-ready summaries that include trusted-root guard markers, actual-call/no-live matches, fixture counts, diff/whitespace/status, and focused Vitest results.
- Add a packet validator/generator that turns slice gate output into the required DONE/BLOCKED/REVIEW packet skeleton and rejects missing fields before head-chat review.
