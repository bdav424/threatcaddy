# ThreatCaddy Odysseus Reference Note

This note preserves the original Odysseus-inspired experiment guardrails for historical context. The active source folder has since been renamed to `ThreatCaddy-V3` and is now the canonical local ThreatCaddy source of truth for this rollout.

Odysseus remains a separate reference application. Do not merge `brdavies/odysseus` wholesale into ThreatCaddy; bring over only reviewed, focused behavior that matches the ThreatCaddy rollout ledger.

## Scope

- Prototype investigation-scoped deep research.
- Prototype versioned working documents.
- Prototype narrow CaddyAI memory scoped per investigation.
- Keep sensitive-case memory controls toggleable per investigation.
- Improve local endpoint discovery and onboarding without changing the standard ThreatCaddy repo.

## Guardrails

- Do not overwrite or merge `/Users/brdavies/workspace/threatcaddy` from this lane without a separate explicit approval and promotion plan.
- Keep experiments client-first unless a server or Dexie migration is explicitly needed.
- Prefer additive prototype surfaces over destructive schema or import/export changes.
- Treat investigation memory as private by default and make cross-investigation reuse explicit.
- Do not add API keys, secrets, VENDOR artifacts, or copied customer data.

## Agent Roles

- Job owns UI/navigation prototypes inside this experimental repo.
- John owns storage/settings/privacy checks inside this experimental repo.
