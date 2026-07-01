# ThreatCaddy V3 Source Of Truth

Status: canonical working source for the current local ThreatCaddy rollout.

Canonical source path:

```text
/Users/brdavies/Documents/ThreatCaddy updates/ThreatCaddy-V3
```

Primary standalone artifact:

```text
/Users/brdavies/Documents/ThreatCaddy updates/threatcaddy-standalone.html
```

Secondary workspace standalone copy:

```text
/Users/brdavies/workspace/threatcaddy-standalone.html
```

Current standalone smoke URL:

```text
http://127.0.0.1:4181/threatcaddy-standalone.html
```

Port discipline:

- Use `127.0.0.1:4181` as the single current standalone static-smoke port for this rollout.
- Do not start additional ad hoc standalone smoke ports unless `4181` is occupied or blocked; if a fallback is required, document the conflict and stop the fallback server when done.
- `127.0.0.1:4179` had a stale unhealthy listener during the 2026-06-09 audit and was stopped. Do not reuse it for this rollout unless `4181` is blocked and the fallback is documented.
- `localhost:4173` / `127.0.0.1:4173` is the Playwright/Vite app test server, not the standalone static-smoke port.

## Consolidation Notes

- `ThreatCaddy-V3` replaces the former `ThreatCaddy-Odysseus-Experimental-2026-06-03` folder name.
- Odysseus remains a separate reference application. Do not merge `brdavies/odysseus` wholesale into ThreatCaddy.
- Odysseus-inspired panel behavior should be brought into ThreatCaddy only through reviewed, focused source changes with TypeScript, focused Vitest, focused Playwright, standalone parity, and browser smoke evidence.
- Older ThreatCaddy source snapshots, dated zips, and PR handoff bundles were moved into `/Users/brdavies/Documents/ThreatCaddy updates/ThreatCaddy-Archive-pre-V3-2026-06-08/` for rollback/provenance. They are not the active source of truth.
- The live `/Users/brdavies/workspace/threatcaddy` repo still exists outside this workspace. Do not overwrite or merge into it without an explicit separate approval and gate plan.

## Promotion Gate

Before refreshing the standalone artifact from this source:

1. Confirm source sanity for high-risk files such as `CadEmailWorkspace.tsx`.
2. Run TypeScript.
3. Run focused Vitest for the touched area.
4. Run focused Playwright when UI behavior changes.
5. Take a checkpoint.
6. Run `pnpm update:standalone`.
7. Confirm parity and browser smoke.
