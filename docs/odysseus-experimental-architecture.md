# Odysseus Experimental Architecture

This document captures the first-pass architecture for the Odysseus-inspired ThreatCaddy experiment. It is intentionally additive and should stay isolated from the standard ThreatCaddy repository until the prototype is reviewed.

## Feature Lanes

### Investigation-Scoped Deep Research

- Start as a client-visible workflow surface that can collect a research question, scope it to the active investigation, and produce draft notes or working documents.
- Do not allow research outputs to write across investigations without an explicit target selection.
- Keep source material and generated conclusions separate so analysts can review provenance.

### Versioned Working Documents

- Treat drafts as investigation artifacts, not global templates.
- Track lightweight document revisions before adding any file-rendering or DOCX persistence.
- Keep product baselines separate from analyst drafts.

### Narrow CaddyAI Memory

- Memory is scoped to the active investigation by default.
- Sensitive investigations need an obvious toggle that disables durable memory writes.
- Cross-investigation reuse must be opt-in, visible, and explainable.
- Avoid Dexie migrations in the first prototype unless the UI proves the model.

### Local Endpoint Discovery

- Probe candidate local OpenAI-compatible endpoints with short timeouts.
- Prefer visible status and user selection over silent fallback.
- Never persist fabricated hosts, bearer tokens, or API secrets as part of discovery.

## Privacy Rules

- No API keys or secrets in source, fixtures, screenshots, or docs.
- No VENDOR artifacts or customer data in this experimental lane.
- Do not export investigation memory unless the export flow explicitly labels it and the user opts in.
- Sensitive-case mode should suppress agent learning, reusable lessons, and cross-case suggestions.

## First Safe Prototype

- Add an `Experimental` route to the UI.
- Add an `Odysseus Lab` page with cards for the four lanes.
- Store only per-investigation toggle state at first.
- Defer durable memory tables, import/export wiring, and server changes until after review.
