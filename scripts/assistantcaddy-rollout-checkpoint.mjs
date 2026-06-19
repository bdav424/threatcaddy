import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const oneHourMs = 60 * 60 * 1000;

const requestedId = readArg('--id');
const now = new Date();
const checkpointId = requestedId || `assistantcaddy-${formatCheckpointId(now)}`;
const checkpointDir = path.join(repoRoot, '.recovery-snapshots', checkpointId);

const highRiskFiles = [
  'AGENTS.md',
  'package.json',
  'scripts/assistantcaddy-rollout-checkpoint.mjs',
  'docs/codex-experience-memory.md',
  'docs/assistantcaddy-rollout-ledger-2026-06-05.md',
  'docs/assistantcaddy-workspace-overhaul-handoff-2026-06-06.md',
  'public/locales/ar/common.json',
  'public/locales/de/common.json',
  'public/locales/en/common.json',
  'public/locales/es/common.json',
  'public/locales/fa/common.json',
  'public/locales/fr/common.json',
  'public/locales/he/common.json',
  'public/locales/hi/common.json',
  'public/locales/id/common.json',
  'public/locales/it/common.json',
  'public/locales/ja/common.json',
  'public/locales/ko/common.json',
  'public/locales/nl/common.json',
  'public/locales/pl/common.json',
  'public/locales/pt-BR/common.json',
  'public/locales/ru/common.json',
  'public/locales/th/common.json',
  'public/locales/tr/common.json',
  'public/locales/uk/common.json',
  'public/locales/vi/common.json',
  'public/locales/zh-CN/common.json',
  'src/App.tsx',
  'src/types.ts',
  'src/contexts/NavigationContext.tsx',
  'src/components/Agent/AgentActionCard.tsx',
  'src/components/Agent/AgentCycleSummaryCard.tsx',
  'src/components/Agent/AgentDashboard.tsx',
  'src/components/Agent/AgentMeetingPanel.tsx',
  'src/components/Agent/AgentPanel.tsx',
  'src/components/Agent/AgentProfileManager.tsx',
  'src/components/Agent/AgentProfilePicker.tsx',
  'src/components/Agent/SupervisorSummary.tsx',
  'src/components/CaddyAssistant/AssistantCaddyWorkspaceShell.tsx',
  'src/components/CaddyAssistant/CadEmailWorkspace.tsx',
  'src/components/CaddyAssistant/CalendarCaddyWorkspace.tsx',
  'src/components/CaddyAssistant/workspacePanelRegistrations.ts',
  'src/components/Chat/CaddyAssistantPanel.tsx',
  'src/components/Chat/ChatInput.tsx',
  'src/components/Chat/ChatMessage.tsx',
  'src/components/Chat/ChatView.tsx',
  'src/components/Chat/FortuneIntBar.tsx',
  'src/components/Experimental/ExperimentalView.tsx',
  'src/components/Layout/Sidebar.tsx',
  'src/components/Layout/SidebarHelpers.tsx',
  'src/components/Products/ProductView.tsx',
  'src/components/Settings/AppearanceSettings.tsx',
  'src/components/Timeline/TimelineEventCard.tsx',
  'src/components/Timeline/TimelineEventForm.tsx',
  'src/components/Timeline/TimelineFeed.tsx',
  'src/components/Timeline/TimelineGantt.tsx',
  'src/components/Timeline/TimelineMap.tsx',
  'src/components/Timeline/TimelineView.tsx',
  'src/components/WorkspacePanels/AppWorkspaceShell.tsx',
  'src/components/WorkspacePanels/WorkspacePanel.tsx',
  'src/components/WorkspacePanels/WorkspacePanelProvider.tsx',
  'src/components/WorkspacePanels/WorkspacePanelDock.tsx',
  'src/components/WorkspacePanels/useWorkspacePanels.ts',
  'src/components/WorkspacePanels/workspace-panel-context.ts',
  'src/components/WorkspacePanels/workspaceGrid.ts',
  'src/components/WorkspacePanels/workspaceLayoutTemplate.ts',
  'src/components/WorkspacePanels/workspacePanelLaunch.ts',
  'src/components/Common/ToolbarSelect.tsx',
  'src/components/Settings/AgentHostsConfig.tsx',
  'src/hooks/useAgentDeployments.ts',
  'src/hooks/useAgentProfiles.ts',
  'src/hooks/useCaddyAgent.ts',
  'src/hooks/useChatLoops.ts',
  'src/hooks/useChats.ts',
  'src/hooks/useLLM.ts',
  'src/hooks/useNavigationHistory.ts',
  'src/hooks/useServerAgents.ts',
  'src/lib/agent-hosts.ts',
  'src/lib/caddy-agent-manager.ts',
  'src/lib/caddy-agent-meeting.ts',
  'src/lib/caddy-agent-policy.ts',
  'src/lib/caddy-agent-supervisor.ts',
  'src/lib/caddy-agent.ts',
  'src/lib/chat-loop.ts',
  'src/lib/chat-mentions.ts',
  'src/lib/chat-utils.ts',
  'src/lib/llm-router.ts',
  'src/lib/llm-tool-defs.ts',
  'src/lib/llm-tools-read.ts',
  'src/lib/llm-tools-write.ts',
  'src/lib/llm-tools.ts',
  'src/lib/runtime-trusted-contract-object.ts',
  'src/lib/provider-adapter-execution-boundary.ts',
  'src/lib/provider-adapter-invocation-implementation-boundary.ts',
  'src/lib/messaging-delivery-execution-boundary.ts',
  'src/lib/messaging-adapter-invocation-implementation-boundary.ts',
  'src/lib/local-bridge-requester-execution-boundary.ts',
  'src/lib/local-bridge-requester-invocation-implementation-boundary.ts',
  'src/lib/local-bridge-live-activation-gate.ts',
  'src/lib/llm-runtime-invocation-implementation-boundary.ts',
  'src/lib/llm-provider-live-activation-gate.ts',
  'src/lib/connector-credential-store.ts',
  'src/lib/connector-runtime-credential-session.ts',
  'src/lib/connector-runtime-persistence-implementation-boundary.ts',
  'src/lib/email-provider-runtime-executor.ts',
  'src/lib/messaging-runtime-executor.ts',
  'src/lib/assistant-provider-runtime-executor.ts',
  'src/lib/durable-persistence-operations-implementation-manifest.ts',
  'src/lib/evidence-import.ts',
  'src/__tests__/provider-adapter-execution-boundary.test.ts',
  'src/__tests__/provider-adapter-invocation-implementation-boundary.test.ts',
  'src/__tests__/messaging-delivery-execution-boundary.test.ts',
  'src/__tests__/messaging-adapter-invocation-implementation-boundary.test.ts',
  'src/__tests__/local-bridge-requester-execution-boundary.test.ts',
  'src/__tests__/local-bridge-requester-invocation-implementation-boundary.test.ts',
  'src/__tests__/local-bridge-live-activation-gate.test.ts',
  'src/__tests__/llm-runtime-invocation-implementation-boundary.test.ts',
  'src/__tests__/llm-provider-live-activation-gate.test.ts',
  'src/__tests__/connector-credential-store.test.ts',
  'src/__tests__/connector-runtime-credential-session.test.ts',
  'src/__tests__/connector-runtime-persistence-implementation-boundary.test.ts',
  'src/__tests__/email-provider-runtime-executor.test.ts',
  'src/__tests__/messaging-runtime-executor.test.ts',
  'src/__tests__/assistant-provider-runtime-executor.test.ts',
  'src/__tests__/durable-persistence-operations-implementation-manifest.test.ts',
  'src/__tests__/investigations-hub.test.tsx',
  'src/__tests__/components.test.tsx',
  'src/__tests__/i18n.test.ts',
  'src/__tests__/workspace-panel-launch.test.ts',
  'src/__tests__/useNavigationHistory.test.tsx',
  'src/__tests__/slash-commands.test.tsx',
  'src/__tests__/caddyassistant-workspaces.test.tsx',
  'src/__tests__/workspace-layout-template.test.ts',
  'src/__tests__/workspace-panel-provider.test.ts',
  'src/__tests__/useLoggedActions.test.ts',
  'src/__tests__/utils.test.ts',
  'e2e/assistantcaddy-smoke.spec.ts',
  'e2e/workspace-panels-smoke.spec.ts',
  'e2e/fixtures.ts',
];

const artifactRoots = {
  distSingle: path.join(repoRoot, 'dist-single'),
  rolloutTarget: path.resolve(repoRoot, '..'),
  workspaceTarget: '/Users/brdavies/workspace',
};

await mkdir(checkpointDir, { recursive: true });

const copiedFiles = [];
for (const relativePath of highRiskFiles) {
  const source = path.join(repoRoot, relativePath);
  if (!existsSync(source)) continue;
  const destination = path.join(checkpointDir, relativePath.replaceAll('/', '__'));
  await copyFile(source, destination);
  copiedFiles.push(relativePath);
}

const lineCounts = {};
for (const relativePath of copiedFiles) {
  const content = await readFile(path.join(repoRoot, relativePath), 'utf8');
  lineCounts[relativePath] = content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
}

const sidecars = await readSidecarNames();
const htmlArtifacts = {
  distSingle: await fileDigest(path.join(artifactRoots.distSingle, 'index.html')),
  rolloutTarget: await fileDigest(path.join(artifactRoots.rolloutTarget, 'threatcaddy-standalone.html')),
  workspaceTarget: await fileDigest(path.join(artifactRoots.workspaceTarget, 'threatcaddy-standalone.html')),
};

const sidecarArtifacts = {};
for (const sidecar of sidecars) {
  sidecarArtifacts[sidecar] = {
    distSingle: await fileDigest(path.join(artifactRoots.distSingle, sidecar)),
    rolloutTarget: await fileDigest(path.join(artifactRoots.rolloutTarget, sidecar)),
    workspaceTarget: await fileDigest(path.join(artifactRoots.workspaceTarget, sidecar)),
  };
}

const summary = {
  checkpoint_id: checkpointId,
  started_at: now.toISOString(),
  closed_at: new Date().toISOString(),
  next_due_at: new Date(now.getTime() + oneHourMs).toISOString(),
  integrator_reviewed_by: 'Codex',
  integrator_reviewed_at: new Date().toISOString(),
  raw_agent_note_vs_verified: 'Raw agent notes are not verified until the integrator records accepted findings in the rollout ledger or handoff.',
  command_log_refs: [
    'Record the gate commands and exit codes in the rollout ledger for any promotion checkpoint.',
  ],
  copied_files: copiedFiles,
  line_counts: lineCounts,
  artifacts: {
    html: htmlArtifacts,
    sidecars: sidecarArtifacts,
    html_parity: sameSha(Object.values(htmlArtifacts)),
    sidecar_parity: Object.fromEntries(
      Object.entries(sidecarArtifacts).map(([name, entries]) => [name, sameSha(Object.values(entries))]),
    ),
  },
};

await writeFile(
  path.join(checkpointDir, 'checkpoint-summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
);
await writeFile(path.join(checkpointDir, 'checkpoint-summary.md'), renderMarkdown(summary));

console.log(`AssistantCaddy checkpoint: ${checkpointId}`);
console.log(`Snapshot: ${checkpointDir}`);
console.log(`HTML parity: ${summary.artifacts.html_parity ? 'pass' : 'fail'}`);
for (const [sidecar, parity] of Object.entries(summary.artifacts.sidecar_parity)) {
  console.log(`Sidecar parity ${sidecar}: ${parity ? 'pass' : 'fail'}`);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function formatCheckpointId(date) {
  return date.toISOString().replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
}

async function readSidecarNames() {
  const manifests = [
    path.join(artifactRoots.rolloutTarget, '.threatcaddy-standalone-sidecars.json'),
    path.join(artifactRoots.workspaceTarget, '.threatcaddy-standalone-sidecars.json'),
  ];

  for (const manifest of manifests) {
    if (!existsSync(manifest)) continue;
    try {
      const parsed = JSON.parse(await readFile(manifest, 'utf8'));
      if (Array.isArray(parsed.sidecars)) {
        return parsed.sidecars.filter((name) => typeof name === 'string');
      }
    } catch {
      // Fall through to the static known sidecars.
    }
  }

  return [
    'browser-ponyfill-C8fpMoVO.js',
    'chunk-reload-guard.js',
    'search.worker-B4u8OH9_.js',
  ];
}

async function fileDigest(filePath) {
  if (!existsSync(filePath)) {
    return { path: filePath, exists: false, bytes: 0, sha256: null };
  }

  const content = await readFile(filePath);
  return {
    path: filePath,
    exists: true,
    bytes: content.byteLength,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

function sameSha(entries) {
  const shas = entries.map((entry) => entry.sha256).filter(Boolean);
  return shas.length === entries.length && new Set(shas).size === 1;
}

function renderMarkdown(data) {
  const lines = [
    `# AssistantCaddy Rollout Checkpoint ${data.checkpoint_id}`,
    '',
    `- Started: ${data.started_at}`,
    `- Closed: ${data.closed_at}`,
    `- Next due: ${data.next_due_at}`,
    `- Integrator reviewed by: ${data.integrator_reviewed_by}`,
    `- Integrator reviewed at: ${data.integrator_reviewed_at}`,
    `- Raw vs verified: ${data.raw_agent_note_vs_verified}`,
    `- HTML parity: ${data.artifacts.html_parity ? 'PASS' : 'FAIL'}`,
    '',
    '## HTML Artifacts',
    '',
  ];

  for (const [name, artifact] of Object.entries(data.artifacts.html)) {
    lines.push(`- ${name}: ${artifact.exists ? `${artifact.sha256} (${artifact.bytes} bytes)` : 'missing'} - ${artifact.path}`);
  }

  lines.push('', '## Sidecars', '');
  for (const [sidecar, entries] of Object.entries(data.artifacts.sidecars)) {
    lines.push(`- ${sidecar}: ${data.artifacts.sidecar_parity[sidecar] ? 'PASS' : 'FAIL'}`);
    for (const [name, artifact] of Object.entries(entries)) {
      lines.push(`  - ${name}: ${artifact.exists ? `${artifact.sha256} (${artifact.bytes} bytes)` : 'missing'} - ${artifact.path}`);
    }
  }

  lines.push('', '## Line Counts', '');
  for (const [file, count] of Object.entries(data.line_counts)) {
    lines.push(`- ${file}: ${count}`);
  }

  return `${lines.join('\n')}\n`;
}
