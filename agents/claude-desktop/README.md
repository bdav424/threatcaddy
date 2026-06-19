# ThreatCaddy — Claude Desktop (MCP Server)

Future: MCP server that exposes ThreatCaddy's 29 tools for Claude Desktop.

## Required Reporting Procedure

Before producing an INTEL-style intelligence note, Claude Desktop agents must read
[`../../docs/intel-note-reporting-procedure.md`](../../docs/intel-note-reporting-procedure.md).
Do not treat Word report generation as generic DOCX creation; use the procedure
as the required entry point for template fidelity, source notes, table structure,
and visual QA.

## Status

Not yet implemented. See `../claude-code/` for the CDP-based approach that works today.

## Planned Architecture

```
Claude Desktop ←stdio→ MCP Server (Node.js) ←WebSocket→ Browser App (IndexedDB)
```
