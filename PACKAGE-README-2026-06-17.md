# ThreatCaddy V3 Package Notes

This package is a handoff snapshot of the `ThreatCaddy-V3` working folder as of June 17, 2026.

## Included context

- Current ThreatCaddy V3 source tree
- Current settings/integrations UI work, including AssistantCaddy AI routing and Slack workflow startup work
- Existing repo documentation and rollout notes

## Planned and rollout references

Use these files first for planned follow-up work and rollout context:

- `docs/assistantcaddy-rollout-ledger-2026-06-05.md`
- `docs/assistantcaddy-rollout-feedback-2026-06-05.md`
- `scripts/assistantcaddy-rollout-context.mjs`
- `scripts/assistantcaddy-rollout-checkpoint.mjs`

## Current UI ownership split

- `AssistantCaddy AI` stays under `Settings > AI`
- `Slack workflow startup` lives under `Settings > Integrations`
- Slack startup is staged/inert and hands off into existing readiness/activation boundaries

## Packaging notes

This zip is intended as a working-source handoff package, not a full local environment clone.

Excluded from the zip:

- `node_modules`
- `dist`
- `dist-single`
- `playwright-report`
- `test-results`
- `.git`
- `.recovery-snapshots`

## Standalone artifact

The standalone export used during this work lives outside the repo folder in the parent workspace:

- `../threatcaddy-standalone.html`

If a future handoff needs the standalone bundled into the repo package, add that file explicitly in a separate packaging pass.
