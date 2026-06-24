// src/lib/capability-registry.ts
//
// New-feature convention: to expose tools to CaddyAI (operational) or
// AssistantCaddy (administrative), create a CapabilityManifest below and call
// registry.register(manifest). The registry auto-wires the feature's tools to
// the correct AI based on scope and active context — no edits to ChatView.tsx
// or caddy-agent.ts are needed for new manifests.
//
// Scope values:
//   'operational'    → CaddyAI (investigation tools)
//   'administrative' → AssistantCaddy (email, calendar, messaging)
//   'both'           → available to both AIs
//
// Context requirements (all must be satisfied for tools to appear):
//   'active-investigation' → only when an investigation folder is open
//   'desktop-only'         → only in the Electron desktop build
//   (empty array)          → no restrictions

import { TOOL_DEFINITIONS, type ToolDefinition } from './llm-tool-defs';

// ── Public types ────────────────────────────────────────────────────────────

export type CapabilityScope = 'operational' | 'administrative' | 'both';
export type ContextRequirement = 'active-investigation' | 'desktop-only';

export interface ActiveContext {
  hasActiveInvestigation: boolean;
  isDesktop: boolean;
}

export interface CapabilityManifest {
  id: string;
  name: string;
  scope: CapabilityScope;
  contextRequirements: ContextRequirement[];
  tools: ToolDefinition[];
  description?: string;
}

// ── Registry ────────────────────────────────────────────────────────────────

class CapabilityRegistryImpl {
  private readonly manifests: CapabilityManifest[] = [];

  register(manifest: CapabilityManifest): void {
    const idx = this.manifests.findIndex((m) => m.id === manifest.id);
    if (idx >= 0) {
      this.manifests[idx] = manifest;
    } else {
      this.manifests.push(manifest);
    }
  }

  getToolsFor(scope: CapabilityScope, context: ActiveContext): ToolDefinition[] {
    return this.manifests
      .filter((m) => {
        if (m.scope !== scope && m.scope !== 'both') return false;
        for (const req of m.contextRequirements) {
          if (req === 'active-investigation' && !context.hasActiveInvestigation) return false;
          if (req === 'desktop-only' && !context.isDesktop) return false;
        }
        return true;
      })
      .flatMap((m) => m.tools);
  }

  listCapabilities(): CapabilityManifest[] {
    return [...this.manifests];
  }
}

export const registry = new CapabilityRegistryImpl();

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick(...names: string[]): ToolDefinition[] {
  const set = new Set(names);
  return TOOL_DEFINITIONS.filter((d) => set.has(d.name));
}

// ── Manifests — operational (CaddyAI) ───────────────────────────────────────

registry.register({
  id: 'investigation-read',
  name: 'Investigation Read',
  scope: 'operational',
  contextRequirements: [],
  description: 'Search, list, and read all investigation entities.',
  tools: pick(
    'search_notes', 'search_all', 'read_note',
    'list_evidence', 'search_evidence', 'read_evidence',
    'list_product_baselines',
    'list_tasks', 'read_task',
    'list_iocs', 'read_ioc',
    'list_timeline_events', 'read_timeline_event',
    'get_investigation_summary', 'analyze_graph', 'get_investigation_context',
    'list_integrations',
    'list_investigations', 'get_investigation_details',
    'list_deployed_agents',
    'list_folders',
    'recall_knowledge',
  ),
});

registry.register({
  id: 'investigation-notes',
  name: 'Investigation Notes',
  scope: 'operational',
  contextRequirements: [],
  description: 'Create and update notes and folder structure.',
  tools: pick(
    'create_note', 'update_note',
    'create_note_folder', 'delete_note_folder', 'move_to_folder',
  ),
});

registry.register({
  id: 'investigation-tasks',
  name: 'Investigation Tasks',
  scope: 'operational',
  contextRequirements: [],
  description: 'Create and manage investigation tasks and checklists.',
  tools: pick(
    'create_task', 'update_task',
    'add_subtask', 'add_sub_subtask', 'update_task_status',
  ),
});

registry.register({
  id: 'investigation-iocs',
  name: 'Investigation IOCs',
  scope: 'operational',
  contextRequirements: [],
  description: 'Create, update, link, and extract indicators of compromise.',
  tools: pick(
    'create_ioc', 'update_ioc', 'bulk_create_iocs',
    'extract_iocs', 'link_entities',
  ),
});

registry.register({
  id: 'investigation-timeline',
  name: 'Investigation Timeline',
  scope: 'operational',
  contextRequirements: [],
  description: 'Create and update timeline events.',
  tools: pick(
    'create_timeline_event', 'update_timeline_event', 'add_timeline_event',
  ),
});

registry.register({
  id: 'investigation-graph',
  name: 'Investigation Graph',
  scope: 'operational',
  contextRequirements: [],
  description: 'Build and extend the pivot/relationship graph.',
  tools: pick(
    'add_pivot_graph_node', 'add_pivot_graph_edge',
  ),
});

registry.register({
  id: 'investigation-cross',
  name: 'Cross-Investigation',
  scope: 'operational',
  contextRequirements: [],
  description: 'Search, create, and compare across investigations.',
  tools: pick(
    'search_across_investigations', 'create_in_investigation', 'compare_investigations',
  ),
});

registry.register({
  id: 'report-builder',
  name: 'Report Builder',
  scope: 'operational',
  contextRequirements: [],
  description: 'Generate and render intelligence reports and product baselines.',
  tools: pick(
    'generate_report', 'create_product_baseline', 'render_product_baseline',
  ),
});

registry.register({
  id: 'web-enrichment',
  name: 'Web Enrichment',
  scope: 'operational',
  contextRequirements: [],
  description: 'Fetch URLs, enrich IOCs, and extract web-sourced data.',
  tools: pick(
    'fetch_url', 'enrich_ioc',
  ),
});

registry.register({
  id: 'run-integration',
  name: 'Run Integration',
  scope: 'both',
  contextRequirements: [],
  description: 'Execute a configured integration or threat-intel lookup.',
  tools: pick('run_integration'),
});

registry.register({
  id: 'caddyshack-push',
  name: 'CaddyShack Push',
  scope: 'operational',
  contextRequirements: [],
  description: 'Push intelligence products to the CaddyShack portal.',
  tools: pick('push_to_caddyshack'),
});

registry.register({
  id: 'siem-soar',
  name: 'SIEM / SOAR',
  scope: 'operational',
  contextRequirements: [],
  description: 'Query SIEMs, run remote commands, create tickets, ingest alerts.',
  tools: pick(
    'run_remote_command', 'query_siem', 'create_ticket', 'ingest_alert',
  ),
});

registry.register({
  id: 'forensics',
  name: 'Forensics',
  scope: 'operational',
  contextRequirements: [],
  description: 'Run forensic scans and update the knowledge base.',
  tools: pick(
    'forensicate_scan', 'update_knowledge',
  ),
});

registry.register({
  id: 'agents',
  name: 'Agent Management',
  scope: 'operational',
  contextRequirements: [],
  description: 'Deploy, stop, and run AgentCaddy cycles.',
  tools: pick(
    'deploy_agent', 'stop_agent', 'run_agent_cycle',
    'post_slack_notification',
  ),
});

// ── Manifests — administrative (AssistantCaddy) ──────────────────────────────
// Tool definitions for admin tools live in the email/calendar/messaging bridges,
// not in the main TOOL_DEFINITIONS array. Placeholders here establish scope;
// wiring will be completed when those definitions are added.

registry.register({
  id: 'email-caddy',
  name: 'Email Caddy',
  scope: 'administrative',
  contextRequirements: [],
  description: 'Read, compose, and send emails via connected mail accounts.',
  tools: [],
});

registry.register({
  id: 'calendar-caddy',
  name: 'Calendar Caddy',
  scope: 'administrative',
  contextRequirements: [],
  description: 'List, read, create, and update calendar events.',
  tools: [],
});

registry.register({
  id: 'messaging-caddy',
  name: 'Messaging Caddy',
  scope: 'administrative',
  contextRequirements: [],
  description: 'Read Slack messages, mentions, and extract commitments.',
  tools: [],
});

registry.register({
  id: 'virtualcaddy',
  name: 'VirtualCaddy',
  scope: 'operational',
  contextRequirements: ['active-investigation', 'desktop-only'],
  description: 'Submit files for air-gapped static analysis and retrieve job results.',
  tools: pick('submit_virtual_analysis', 'get_virtual_jobs'),
});

registry.register({
  id: 'network-map',
  name: 'Network Map',
  scope: 'operational',
  contextRequirements: ['active-investigation', 'desktop-only'],
  description: 'Discover LAN devices via ARP + TCP probe and promote them to IOCs or graph nodes.',
  tools: pick('start_network_scan', 'get_network_devices', 'add_device_to_investigation'),
});
