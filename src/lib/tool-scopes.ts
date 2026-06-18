// src/lib/tool-scopes.ts
//
// Strict tool separation between the two AIs:
//   • CaddyAI (ThreatCaddy AI)  -> 'investigation' tools only (notes, IOCs, timeline,
//     graph, evidence, integrations/enrichment, SIEM, tickets, agents).
//   • AssistantCaddy            -> 'admin' tools only (email, calendar, messaging/Slack).
//
// Enforced in two places:
//   1. Offer time  — each AI is only given the tool definitions in its scope.
//   2. Execute time — executeTool() rejects any tool outside the caller's scope, so a
//      hallucinated or injected tool name still cannot cross the boundary.
//
// Default scope is 'investigation' (every existing tool), so nothing changes for CaddyAI.
// Admin tool names are listed below so the boundary is real the moment those tools land —
// when you implement an email/calendar/messaging tool, give it one of these names (or add
// the new name here) and it is automatically AssistantCaddy-only.

export type ToolScope = 'investigation' | 'admin';

/**
 * Names that belong to AssistantCaddy's administrative surface. Anything NOT in this set
 * is treated as 'investigation' (CaddyAI). Forward-looking: these may not all exist yet.
 */
export const ADMIN_TOOL_NAMES: ReadonlySet<string> = new Set<string>([
  // email (EmailCaddy)
  'list_emails',
  'search_emails',
  'read_email',
  'draft_email',
  'send_email',          // remains gated/confirmed at execution regardless of scope
  // calendar (CalendarCaddy)
  'list_calendar_events',
  'read_calendar_event',
  'create_calendar_event',
  'update_calendar_event',
  'find_free_time',
  // messaging (Slack / chat triage)
  'list_messages',
  'read_message',
  'list_mentions',
  'summarize_messages',
  'mark_message_read',
  // cross-admin helpers
  'extract_commitments', // turn an email into a calendar hold (asks before applying)
  'daily_brief',
]);

/** Resolve the scope of a tool by name. Unknown/existing tools default to investigation. */
export function toolScope(name: string): ToolScope {
  return ADMIN_TOOL_NAMES.has(name) ? 'admin' : 'investigation';
}

/** True when a tool is allowed to run under the given scope (strict: exact match). */
export function isToolInScope(name: string, scope: ToolScope): boolean {
  return toolScope(name) === scope;
}

/** Filter a tool-definition list down to a single scope. */
export function getToolDefinitionsForScope<T extends { name: string }>(
  scope: ToolScope,
  defs: readonly T[],
): T[] {
  return defs.filter((d) => toolScope(d.name) === scope);
}
