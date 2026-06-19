# CaddyAI + CaddyShack Mini-Spec

This note captures the current user-facing direction discussed after the Odysseus experiment. The goal is to move from a generic experimental panel toward a clearer split between a CaddyShack workbench, investigation-scoped CaddyAI, and broader AssistantCaddy flows without hard-coding the experience to one provider or vendor stack.

## Product boundary

- `CaddyShack` is the Experimental route and acts as a workbench for scoped research, draft shaping, and guarded experiments.
- `CaddyAI` is investigation-scoped and lives inside the `Investigations` dropdown with Notes, Tasks, Evidence, Products, Timeline, Whiteboards, IOCs, Graph, and Activity.
- `AssistantCaddy` is the broader assistant surface for personal/work coordination outside a single investigation, including EmailCaddy and CalendarCaddy.
- Assistant-driven retrieval, summarization, classification, sanitization, staged drafting, and related action flows can appear inside the relevant surface, but routing should keep investigation work separate from email/calendar coordination.
- `CaddyAI` does not send email directly.
- ThreatCaddy the platform may send staged email only after explicit human approval.
- External meeting and map links should open externally, not inside the app, to preserve the correct account and app context.

## Recommended menu structure

- `Dashboard`
- `CaddyShack`
- `Investigations`
  - `CaddyAI`
  - `Notes`
  - `Tasks`
  - `Evidence`
  - `Products`
  - `Timeline`
  - `Whiteboards`
  - `IOCs`
  - `Graph`
  - `Activity`
- `AssistantCaddy`
  - `EmailCaddy`
  - `CalendarCaddy`
- `FortuneINT`
- `Team Feed`
- `AgentCaddy`

## Naming decision

- The current `Experimental` panel is renamed in the product concept to `CaddyShack`.
- `CaddyAssistant` is retired as a visible label; use `AssistantCaddy`.
- `CadEmail` is retired as a visible label; use `EmailCaddy`.
- `AssistantCaddy` remains a top-level panel and dropdown parent because it coordinates email, calendar, onboarding, daily brief, and cross-surface automation work.
- The older team-feed feature should keep a plain visible label such as `Team Feed` to avoid two different UI destinations both being called `CaddyShack`.

## Core feature ideas

### EmailCaddy

Read-only email intake that converts inbound mail into a structured work surface.

Primary actions:
- detect the ask type
- extract entities, dates, links, attachments, teams, and recipients
- pull matching ThreatCaddy notes, products, tasks, evidence, and timelines into a relevance viewer
- let the analyst choose a response mode before drafting

Key smart behaviors:
- `Audience Sense`: infer likely response depth from signature, title, team, org, thread history, recipient list, and internal vs external context
- classification tags such as `spam`, `low-value`, `needs-answer`, `needs-lookup`, `needs-meeting`, `needs-escalation`
- `Sanitize` button for safe external wording
- `What am I forgetting?` review that checks spelling, unanswered questions, weak claims, and omissions against the original email
- sensitivity warning when a reply appears to include internal-only details for external recipients
- draft reply packs that stage one or more reply options without sending

Suggested probe modes:
- `Executive Brief`
- `Analyst Readout`
- `Source Viewer`
- `Sanitized External`
- `Delta Since Last Ask`

### CalendarCaddy

Cross-calendar assistant surface for events, conflicts, meetings, and travel-aware prep.

Primary actions:
- ingest events from connected calendar providers
- normalize title, date, time, timezone, location, meeting links, organizer, attendees, and notes
- detect conflicts across work and shared family calendars
- generate prep cards and related work items

Key smart behaviors:
- conflict detection across calendars
- travel buffer suggestions using time and location context
- map/location extraction and external launch
- meeting join detection for Zoom, Teams, Meet, Webex, and similar tools
- `Turn this meeting into work` button to create tasks, notes, and timeline items
- deadline radar for upcoming meetings, due dates, and preparation windows

## Meeting Prep surface

This can either be a standalone submenu item or a deep state within CalendarCaddy.

Inputs:
- calendar invite
- related email thread
- matching ThreatCaddy artifacts
- prior notes/tasks for the same person, team, topic, or investigation

Outputs:
- 30-second prep brief
- technical prep brief
- unresolved questions
- likely asks from attendees
- related docs and prior deliverables
- open tasks that should be discussed before the meeting

## Smart Alerts

Attention-grabbing but compact tiles for urgent or time-bound actions.

Suggested alert card:
- meeting title
- meeting start time
- source app label such as `Zoom`, `Teams`, or `Meet`
- `Join Meeting` button that opens externally
- `Open Prep Brief`
- `Snooze 5 min`

Visual behavior:
- border glow or pulse
- stronger emphasis when the start time is near
- reduced motion support for accessibility

## Guided onboarding

The assistant should help discover likely integration settings without silently wiring accounts.

Suggested approach:
- inspect pasted invite bodies, email headers, domains, and provider-specific formatting
- infer likely provider families such as Google, Microsoft, Proton, Zoom, Teams, Meet
- generate a short setup checklist
- prefill connection hints and recommended scopes
- link the user to the relevant provider settings path

This keeps onboarding fast without taking unsafe automatic actions.

## AssistantCaddy overview shell

The top-level `AssistantCaddy` panel should read as a routing console, not a duplicate inbox, calendar, or dashboard. The default panel should stay compact: setup prompts, one assistant prompt bar, and clear workflow routes to `EmailCaddy`, `CalendarCaddy`, daily brief, meeting prep, sanitization, and `What am I forgetting?`.

Overview modules and widgets are optional. Signal cards, today strips, and extra shortcut chips can live behind overview preferences/settings, but they should not be the default first impression.

When setup is incomplete, the overview should show plain prompts for missing AI provider configuration and missing email/calendar account staging. Provider examples can include Microsoft, Google, Proton, Zoom, Teams, Meet, Webex, Slack, and maps, but the copy should stay provider-agnostic and avoid assuming one employer or tenant.

## Phase 1 cut

Build these first:

1. `CaddyShack` workbench surface for the current Experimental route
2. `AssistantCaddy` assistant surface for `EmailCaddy`, `CalendarCaddy`, setup guidance, daily brief routing, and smart alerts
3. `EmailCaddy` intake card with classification, `Audience Sense`, `Sanitize`, and `What am I forgetting?`
4. `CalendarCaddy` event card with conflict detection and external link opening
5. `Meeting Prep` brief generation
6. `Smart Alerts` meeting tile with external join behavior

## Phase 2 desktop workspace and notifications

Defer broad desktop windowing and notification behavior unless a later pass owns the shell architecture. The Odysseus references to preserve conceptually are `modalManager`, `windowDrag`, `modalSnap`, and `tileManager`: draggable panes, minimized dock chips, edge docking, ghost snap previews, and remembered dock placement.

Notification work should also be phase two unless a safe isolated shell exists. Desired behavior: bottom-right bubbles that do not stack noisily, important-email bubbles with sender/context/actions, meeting reminders with external `Join [app] Meeting` actions, and reduced-motion controls for any pulse/glow/jiggle behavior.

## Product rules worth preserving

- Keep email/calendar providers as systems of record.
- Promote selected items into ThreatCaddy rather than importing everything into investigations.
- Never force the user into an in-app meeting join when account context matters.
- Treat role-based response-depth guessing as a suggestion, not a lock.
- Keep send actions human-approved even if retrieval, summarization, and drafting are automated.
