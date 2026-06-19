# Codex ThreatCaddy Strategy Retrospective - 2026-06-11

This review summarizes how Codex-assisted ThreatCaddy work evolved from the first capability tests and country-hunt packages through the V3 multi-chat rollout. It is a process review, not a product requirements ledger. Case details, vendor results, artifact hashes, and promotion evidence remain in the original package folders, rollout ledger, and handoff.

Primary evidence reviewed:

- `Test-AI-ThreatHunt/Process_Observer_AAR.md`
- `Test-AI-ThreatHunt/Next_Test_Process_Improvement_Plan.md`
- `Daily_Country_Hunt_Issue_Log_2026-05-24.md`
- `Monday_Country_Hunt_Fix_Automation_Prompt.md`
- `Country-Hunt-Monday-Fix-2026-05-25/Final_Repair_Review.md`
- `Country-Hunt-Monday-Fix-2026-05-25/Daily_Memory_Update_Blocked.md`
- country-hunt `Process_Observer_AAR.md`, `Final_Review_Findings.md`, and fallback diagnostics from 2026-05-22 through 2026-06-05
- `ThreatCaddy-Archive-pre-V3-2026-06-08/CaddyAI-ThreatCaddy-Agentic-TI-SOC-Workflow-Release-Ledger-2026-06-04.md`
- `docs/assistantcaddy-rollout-ledger-2026-06-05.md`
- `docs/assistantcaddy-workspace-overhaul-handoff-2026-06-06.md`
- `docs/codex-experience-memory.md`
- archived Codex thread summaries for standalone storage/LLM bridge debugging, evidence bulk upload/theme import repair, the Jinja/products sidebar work, the main multi-chat rollout thread, and the rollout-command-center experiment

## Executive Assessment

The strategy improved substantially over time. Early runs optimized for producing a complete-looking ThreatCaddy package and report. Later runs became more honest about evidence gates: seed parity, live enrichment, visible standalone import, IOC auto-enrichment, Word/render QA, final review, and blocker classification were separated instead of collapsed into one pass/fail label.

The strongest improvement was discipline around status language. The work moved from "package exists" toward `DONE`, `PARTIAL`, `BLOCKED`, `NOT RUN`, `CONDITIONAL PASS`, and `INCOMPLETE` with exact recovery steps. That reduced false confidence.

The largest remaining weakness is last-mile validation. Across country-hunt work, visible `file://` standalone import, bounded IOC auto-enrichment in the user's browser profile, local CTI Agent Host access, and Word/PDF visual QA stayed environment-dependent. Those failures were documented better over time, but not fully solved.

The V3 rollout strategy then shifted from CTI package generation to source-gated product engineering. It added checkpoints, focused tests, browser gates, standalone promotion/parity checks, multi-chat handoffs, and eventually a Memory Curator role. That was the right direction, but parallelism created its own costs: stale ports, cross-slice file overlap, repeated source sanity checks, broad smoke-test failures, and token-heavy handoff polling.

Archived chats fill in why several later rules became important. The standalone-first rule was not theoretical; it followed real origin-split pain where the loose `file://` standalone could see notes but `127.0.0.1:5173` could not. The local LLM bridge documentation was updated only after direct bridge and completion smoke tests passed. Earlier evidence/theme work also showed that import surfaces need allowlists, batch caps, duplicate handling, and standalone artifact refresh before they are safe for user-facing workflows.

## Phase Timeline

### Phase 1 - Initial Capability Test And Report Package

Approximate period: 2026-05-21 to 2026-05-22.

Core strategy:

- Exercise many ThreatCaddy capabilities in one run: notes, tasks, timeline, IOCs, enrichment, report generation, import/export, AAR, and Word output.
- Use fallback packaging when direct active-investigation writes were unavailable.
- Produce a full artifact set with a process observer, source/IOC ledger, rendered report, and import JSON.

What worked:

- The team learned that package generation could be made repeatable with source ledgers, IOC freshness checks, import JSON, report context, and final review artifacts.
- The AAR identified that direct ThreatCaddy writes, vendor preflight, IOC freshness, Word rendering, and process recording needed to be first-class gates.
- The work produced a reusable improvement plan instead of treating the first package as fully mature.

What did not work:

- Too many goals were mixed together: investigation execution, product capability testing, and release-artifact production.
- Vendor and bridge preflight happened during the run, after the research workflow had already committed.
- Word/Jinja content validation was confused with visual release quality until render defects appeared late.
- The process observer started after some work, causing reconstructed rather than live telemetry.

Correction attempt:

- `Test-AI-ThreatHunt/Next_Test_Process_Improvement_Plan.md` proposed preflight, source ledger, lane telemetry, final reviewer, template maintainer, query packs, and report QA automation.

Assessment:

- Corrected at the process-design level, not fully automated. The plan became the template for later runs, but the infrastructure gaps remained.

### Phase 2 - Early Daily Country-Hunt Packages

Approximate period: 2026-05-22 to 2026-05-24.

Core strategy:

- Build country-focused ThreatCaddy packages with official seed files, working seed files, IOC freshness ledgers, import JSON, reports, and QA artifacts.
- Use vendor enrichment where possible and document missing routes.

Recurring problems:

- Vendor access was unreliable in sandboxed runs. VT, Censys, and Flashpoint failures were often caused by local socket, keychain, env var, or route problems rather than analytic no-hit results.
- Seed gates initially lagged real IOC shapes. IP:port and URL observables needed explicit support.
- Enrichment findings were not always merged back into ledgers, report context, notes, timeline/evidence, and import JSON.
- Standalone validation required the user's visible `file://` browser profile, not localhost or an isolated browser profile.
- Word/render QA depended on GUI or render tooling that was often unavailable.

Correction attempts:

- The daily issue log captured cross-day root causes and made merge-back, visible standalone import, bounded IOC auto-enrichment, and Word/render QA explicit gates.
- Seed gates were expanded to support more observable shapes.
- Package reviews began preserving exact blocker evidence and manual recovery steps.

Assessment:

- Seed and package structure improved. Live product validation did not consistently improve because the missing capabilities were environmental or tooling gaps.

### Phase 3 - Monday Repair And Backfill Strategy

Approximate period: 2026-05-25 through 2026-06-05 refreshes.

Core strategy:

- Stop creating duplicate country packages until earlier packages were repaired or reclassified.
- Read package README, final review, AAR, hotwash, fallback diagnostics, standalone QA, Word/render QA, source ledgers, freshness ledgers, and import JSON before making changes.
- Use a repair ledger with `DONE`, `PARTIAL`, `BLOCKED`, and `NOT RUN`.
- Merge live-backfill results into existing packages rather than leaving raw enrichment output separate.

What worked:

- Seed integrity was repeatedly rechecked and stabilized.
- Ukraine, India, China, Azerbaijan, and Thailand received live-backfill addenda and package merge-back where evidence existed.
- Vendor outcomes became more nuanced: VT errors/not-found stayed source-led, Censys related hosts stayed context until corroborated and VT-rechecked, and Flashpoint exact misses were separated from broader reporting.
- Stale package docs were later corrected when they contradicted live-backfill state.
- Runtime socket denial to `127.0.0.1:8766` was isolated as a blocker, not misreported as vendor no-hit evidence.

What did not work:

- Visible standalone `file://` Merge import stayed unproven in the user's normal browser profile.
- Bounded IOC auto-enrichment stayed blocked because it depends on visible import and VT route access.
- Full Word/PDF visual render QA stayed blocked or partial.
- Global automation memory updates repeatedly failed because the target path was outside writable roots.

Correction attempts:

- Blocked memory updates were preserved in workspace-local files such as `Daily_Memory_Update_Blocked.md` and `Automation_Memory_Update_Blocked.md`.
- Full-access rerun steps were written into final reviews instead of pretending the sandbox proved them.
- Helper failures were classified by cause: socket denial, missing credential, route mismatch, browser profile isolation, Word automation failure, or missing render dependency.

Assessment:

- Strong improvement in truthfulness and recoverability. Partial correction for vendor merge-back. No full correction for browser-profile validation, IOC auto-enrichment, Word render QA, or external memory writes.

### Phase 4 - Repeated Country Runs After The Repair Loop

Approximate period: 2026-05-27 through 2026-06-05.

Core strategy:

- Continue producing package/report artifacts with stricter preflight, seed parity, fallback diagnostics, final review, and manual full-access recovery steps.

What worked:

- Most later packages consistently created official and working seed files before enrichment.
- Final reviews clearly separated package/report QA from product validation.
- Fallback diagnostics preserved the exact failed commands and recovery paths.
- Some packages caught and corrected seed issues, such as omitted observables or a wrong hash.

What did not work:

- The same environmental gates failed repeatedly: local Agent Host access, vendor credentials, visible standalone import, Word/render QA, media/transcription, and IOC auto-enrichment.
- Repeated blocked runs consumed tokens because the automation lacked a hard stop after failed preflight.

Assessment:

- The strategy became consistent but plateaued. Documentation quality improved, but automation should have stopped earlier when required validation surfaces were unavailable.

### Phase 5 - Pre-V3 Agentic Workflow Design

Approximate period: 2026-06-04.

Core strategy:

- Formalize CaddyAI/AgentCaddy workflow with source neutrality, scoped investigation memory, approval gates, independent tester evidence, auditor review, and prompt-injection boundaries.

What worked:

- The workflow introduced a real separation of developer, tester, and auditor roles.
- Persistent memory writes required proposed-memory review rather than automatic writes.
- The ledger preserved acceptance criteria and artifact hash evidence.

What did not work:

- This was mostly workflow design and release evidence. It did not itself solve the earlier country-hunt runtime blockers.

Assessment:

- Strong strategic influence on later V3 rollout gates: independent review, scoped memory, and source-gated evidence carried forward.

### Phase 6 - Standalone-First Product Repairs And Local Bridge Documentation

Approximate period: late May 2026, from archived chat summaries.

Core strategy:

- Debug product behavior against the standalone file the user actually used, not only the dev server.
- Repair user-facing import flows, then refresh the standalone artifact.
- Update maintainer docs after a fix was proven, so future chats did not rediscover the same origin and bridge details.

What worked:

- The storage-origin issue was correctly identified as an origin split rather than missing notes.
- Local CaddyAI bridge settings were documented after `pnpm check:caddyai-bridges` and direct completion smoke tests passed.
- Evidence bulk upload was hardened with a 20-file cap, per-file error handling, duplicate detection, and focused tests.
- Evidence dedupe was corrected to preserve the richest copy, not just the first or newest duplicate.
- Theme import was hardened to avoid built-in ID collisions, constrain imported CSS to known hex color variables, and avoid phantom background-image mode when an image blob was missing in the current standalone bucket.
- The standalone file and hosted artifact were refreshed and hash-checked after user-facing changes.

What did not work:

- The work initially mixed an old evidence task with a new theme task, increasing the closure burden.
- Broad tests surfaced unrelated existing failures and had to be narrowed.
- Browser smoke tooling had module/path friction before a working standalone smoke succeeded.

Assessment:

- This phase explains why V3 memory now emphasizes standalone-first promotion, origin-scoped data, import boundary validation, focused tests, and docs updates after proven fixes.

### Phase 7 - Rollout Command Center Experiment

Approximate period: 2026-06-07 through 2026-06-09, from archived chat summaries.

Core strategy:

- Convert manual multi-chat prompting into a scoped rollout manager with task manifests, worker boundaries, avoid paths, assigned ports, review gates, capacity checks, and manager-owned acceptance state.

What worked:

- Worker tasks gained explicit scope and avoid paths.
- Dispatch prompts included report commands, worktree/port info, and skip reasons.
- The workflow added a manager review command and smoke tests for status transitions.
- Local-server coordination docs and an example manifest reduced the chance that workers would invent conflicting localhost ports.

What did not work:

- It was a separate orchestration tool, not automatically integrated into the V3 rollout threads.
- It still required manager discipline to accept or merge completed work.

Assessment:

- The RCC experiment is the concrete automation path for reducing V3 multi-chat coordination costs. Its strongest reusable ideas are manager-owned state, declared port assignments, scope-overlap detection, review gates, and capacity-aware worker limits.

### Phase 8 - V3 Workspace And AssistantCaddy Rollout

Approximate period: 2026-06-06 through 2026-06-11.

Core strategy:

- Move from report packages to source-gated product engineering.
- Use additive panel runtime slices, checkpoints, focused tests, browser proof, source sanity checks, handoff/ledger updates, artifact parity, and controlled standalone promotion.
- Use multiple chats/agents, then reconcile through one integrator.

What worked:

- Additive runtime work avoided wrapping the whole app at once.
- Durable domain state stayed above panel shells while presentation state moved into shared panel runtime.
- Focused Vitest and Playwright gates caught regressions around selectors, geometry, panel behavior, source placeholders, dock/minimize semantics, and connector no-network claims.
- Checkpoints and write-set records compensated for the all-untracked git worktree.
- The head-chat integrator model prevented worker slices from independently promoting standalone artifacts.
- Source-gated onboarding slices correctly kept design-only catalog/setup work separate from real connector implementation.
- A project-local memory file and Memory Curator role were added to reduce repeated lookup work.

What did not work:

- Multi-chat concurrency increased coordination overhead.
- Shared dev-server/browser-test ports caused stale-port failures.
- Some broad smoke tests failed on unrelated stale assertions and had to be narrowed.
- Cross-slice overlap in `SettingsPanel`, `CadEmailWorkspace`, and integration catalog code required repeated source sanity and ownership checks.
- Workers produced useful hotwash material, but without a curator it would have remained scattered across the ledger/handoff.

Correction attempts:

- Use one head-chat integrator for promotion.
- Capture `lsof`/PID evidence before using or killing stale ports.
- Prefer standard managed Playwright ports after clearing them, or short-lived in-repo configs when isolation is needed.
- Add memory-candidate lines and a sixth Memory Curator role.
- Keep product requirements, promotion evidence, and artifact hashes in ledgers/handoffs rather than memory.

Assessment:

- Corrected many engineering-process issues. Remaining cost is coordination overhead; future runs need better automated extraction of slice state, memory candidates, port state, and pending gates.

## Problem Correction Matrix

| Problem | First Seen | Correction Attempt | Current Assessment |
| --- | --- | --- | --- |
| Vendor bridge and credential failures discovered mid-run | Initial capability and early country hunts | Preflight checks, fallback diagnostics, blocker classification | Partially corrected. Failures are now classified early, but hard-stop automation is still needed. |
| Live enrichment not merged back into packages | Ukraine and early daily runs | Monday repair and live-backfill merge manifests | Mostly corrected for repaired packages; must remain a required gate. |
| Unsupported IOC shapes in seed gates | India/China early runs | Added IP:port and URL parsing support | Corrected for known shapes; keep extensible parser tests. |
| Visible standalone validation confused with dev/isolated browser validation | Country hunts and V3 standalone work | Explicit `file://` storage rules and manual Merge steps | Documented, but not automated. Still a major last-mile blocker. |
| Word/Jinja validation confused with visual QA | Initial report work | INTEL procedure and Word/render QA gate | Partially corrected. Rules exist; tooling remains unreliable. |
| Automation memory writes blocked outside workspace | Monday repair and later country runs | Preserve intended entries in workspace-local blocked-memory files | Correct workaround. Needs a sanctioned memory-update path or explicit no-write policy. |
| Agent process telemetry reconstructed late | Initial capability test | Process observer and lane telemetry recommendations | Partially corrected. Later AARs improved, but live lane telemetry is still manual. |
| Standalone data differed from dev-server data | Archived standalone/storage chats | Origin-scoped storage rules and standalone-first docs | Corrected as guidance. Still requires discipline before using dev-server observations as user-facing evidence. |
| User import surfaces accepted risky or stale state | Archived evidence/theme repair chats | Batch caps, dedupe, rich-copy preservation, CSS allowlists, artifact refresh | Corrected for those surfaces; apply the same pattern to future import/export features. |
| Multi-chat coordination lacked explicit state | RCC archived chat | Task manifests, avoid paths, port assignments, review commands, manager acceptance state | Corrected in the RCC tool; not yet fully wired into V3 rollout practice. |
| Multi-chat output treated as trusted too early | V3 rollout | Head-chat integrator and advisory worker-output rule | Corrected as a process rule. |
| Broad browser tests failed on unrelated legacy assertions | V3 rollout | Narrow gates to touched behavior and record unrelated failures | Corrected in practice; keep broad suites as separate debt. |
| Stale browser-test ports caused misleading gates | V3 rollout | `lsof`/PID evidence, cleared standard port, short-lived configs | Mostly corrected; can be scripted. |
| Design-only connector UI risked being read as functional | V3 onboarding | No-network tests, explicit statuses, session-local state, design-only metadata | Corrected for current slices; real connector work remains future. |

## What Worked Best

- Explicit status vocabulary with evidence: `DONE`, `PARTIAL`, `BLOCKED`, `NOT RUN`, `CONDITIONAL`, and `INCOMPLETE`.
- Source/IOC ledgers and seed parity before enrichment.
- Merge-back discipline after live enrichment.
- Fallback diagnostics with exact command, failure class, and recovery path.
- Final reviewer pass before calling a package or slice complete.
- Source-gated V3 workflow: source sanity, TypeScript, focused tests, browser proof, `git diff --check`, checkpoint, ledger/handoff update.
- One integrator for parallel work.
- Project-local memory for reusable process lessons, with product facts kept in ledgers.

## What Did Not Work

- Re-running package workflows after preflight had already proved required live gates were unavailable.
- Treating generated packages as equivalent to visible product validation.
- Treating Jinja/DOCX structural validity as visual report QA.
- Expecting global automation memory writes from restricted workspace runs.
- Letting multiple slices touch shared UI files without a single reconciliation pass.
- Using broad smoke suites as slice proof when stale unrelated assertions were known.
- Leaving memory candidates in scattered hotwash text without a curator or extractor.

## Strategy Evolution

The strategy evolved in six meaningful steps:

1. Artifact production: create reports, import JSON, and package files.
2. Evidence-gated packaging: add seed parity, fallback diagnostics, final reviews, and conditional status.
3. Repair and merge-back: reclassify old failures, backfill enrichment, and update package artifacts instead of leaving raw outputs.
4. Standalone-first user repair: debug against the user's `file://` artifact, harden imports, update docs, and refresh standalone after user-facing fixes.
5. Source-gated product engineering: use checkpoints, focused tests, browser proof, artifact parity, multi-chat integration, and process memory.
6. Orchestrated multi-chat: move from prompt-only coordination toward explicit task state, avoid paths, review gates, assigned ports, and manager acceptance.

The next step should be automation-gated strategy: preflight should decide whether to continue, pause, or switch tasks before tokens are spent on runs that cannot pass required live gates.

## Recommended Improvements

1. Build a `threatcaddy-capability-preflight` script.
   - Inputs: target workflow type such as country-hunt package, V3 source slice, standalone promotion, report generation, or connector onboarding.
   - Output: pass/fail table for CTI Agent Host, VT/Censys/Flashpoint credentials, visible standalone route, Browser attach, Word/render dependencies, Playwright port, git provenance, and required source files.
   - Rule: if a required live gate fails, stop before research or product edits unless the user explicitly wants a package-only or source-only run.

2. Build a visible standalone validation helper.
   - It should verify the correct `file://` origin and user browser profile, then run a Merge import checklist without using Replace All.
   - Until that exists, visible import remains manual and cannot be claimed as passed by isolated browser proof.

3. Build a report-render QA lane that is either fully functional or explicitly unavailable.
   - Standardize on the INTEL sample/template, page-image render, table clipping checks, source-marker checks, and unresolved-token checks.
   - If Word/PDF render is unavailable, fail that gate early and skip visual-pass claims.

4. Add a memory-candidate extractor.
   - Scan ledgers/handoffs for `MEMORY-CANDIDATE`, hotwash, `WHAT SLOWED`, and `DO NOT REPEAT` markers.
   - Group near-duplicates and emit proposed bullets for curator review.
   - Do not auto-write memory.

5. Add a slice/package status dashboard.
   - Summarize write set, source base, gates, blockers, ports, temp files, promotion state, and memory candidates.
   - This would reduce repeated ledger/handoff scanning.

6. Wire RCC-style coordination into future multi-chat rollouts.
   - Require each worker task to declare scope, avoid paths, assigned ports, write intent, report command, and review checklist.
   - Let the manager own status transitions and acceptance.
   - Block dispatch when scopes overlap unless the integrator explicitly sequences them.

7. Use hard-stop preflight modes.
   - Country-hunt live-validation mode should stop when vendor access, visible standalone, or render QA is blocked.
   - Package-only mode can proceed, but must label itself package-only from the start.
   - V3 source-slice mode can proceed without standalone promotion only when the ledger says `SOURCE-GATED / NOT PROMOTED`.

8. Keep memory narrow.
   - Memory should store reusable process lessons and canonical entry points.
   - Product backlog, evidence, hashes, route failures, provider results, and investigation substance stay in ledgers, handoffs, and package reviews.

## Current Best Operating Model

For future large ThreatCaddy work:

1. Read `AGENTS.md` and `docs/codex-experience-memory.md`.
2. Search archived Codex threads when the user asks for the full history or when a current rule has unclear origin.
3. Classify the run: country-hunt package, report, V3 source slice, standalone promotion, connector/onboarding, or repair.
4. Run or manually perform the relevant preflight.
5. Pick one of three modes:
   - full validation: all live gates available
   - source/package only: live gates unavailable but package/source work is still useful
   - blocked: prerequisites are unavailable and proceeding would waste tokens
6. Use the smallest focused gates for the touched surface.
7. Merge evidence back into the canonical package, ledger, or handoff before closeout.
8. Add hotwash and memory candidates.
9. Let the Memory Curator distill durable process lessons only.
