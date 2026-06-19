import { useState } from 'react';
import {
  Brain,
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  Loader2,
  Lock,
  Network,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Clipboard,
  PlayCircle,
  XCircle,
} from 'lucide-react';
import type { Folder, Settings } from '../../types';
import { normalizeLocalLlmEndpoint } from '../../lib/local-llm-endpoint';

type EndpointProbeStatus = 'idle' | 'probing' | 'ok' | 'error';

interface EndpointProbe {
  endpoint: string;
  status: EndpointProbeStatus;
  message: string;
  models: string[];
  durationMs?: number;
}

interface ExperimentalViewProps {
  folder?: Folder;
  settings: Settings;
  onUpdateFolder: (id: string, updates: Partial<Folder>) => void | Promise<void>;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  onOpenChat: () => void;
}

const ENDPOINT_CANDIDATES = [
  'http://127.0.0.1:11434/v1',
  'http://localhost:11434/v1',
  'http://127.0.0.1:11436/v1',
  'http://localhost:11436/v1',
  'http://127.0.0.1:8000/v1',
  'http://localhost:8000/v1',
];

const prototypes = [
  {
    id: 'research',
    title: 'Investigation-scoped deep research',
    eyebrow: 'Research lane',
    description: 'Plan deep research, collect source trails, and park open questions inside the current investigation before promoting findings into notes or products.',
    icon: Brain,
    accent: 'from-sky-500/20 to-cyan-400/5',
    border: 'border-sky-400/30',
    steps: [
      {
        id: 'scope',
        title: 'Scope to active investigation',
        description: 'Keeps CaddyAI focused on the current case instead of the broader workspace. Research stays grounded in the investigation\'s notes, evidence, IOCs, and unresolved questions.',
      },
      {
        id: 'assumptions',
        title: 'Capture assumptions',
        description: 'Makes the reasoning visible before conclusions harden into findings. This gives analysts a place to challenge source gaps, confidence levels, and possible overreach.',
      },
      {
        id: 'promote-findings',
        title: 'Promote reviewed findings',
        description: 'Turns reviewed research into case material only when the analyst is ready. Findings can then become notes, IOCs, evidence, or product content with a clear review trail.',
      },
    ],
  },
  {
    id: 'draft',
    title: 'Versioned working documents',
    eyebrow: 'Draft control',
    description: 'Experiment with checkpointed working papers, compare/revert affordances, and deliberate promotion into the Products workspace when a draft is ready.',
    icon: GitBranch,
    accent: 'from-emerald-500/20 to-lime-400/5',
    border: 'border-emerald-400/30',
    steps: [
      {
        id: 'checkpoints',
        title: 'Create checkpoints',
        description: 'Saves draft milestones while a report or working paper develops. Analysts can return to earlier versions without losing the reasoning behind them.',
      },
      {
        id: 'deltas',
        title: 'Review deltas',
        description: 'Shows what changed between draft checkpoints. This is meant to catch accidental removals, unsupported additions, and changes that weaken caveats or sourcing.',
      },
      {
        id: 'promote-product',
        title: 'Promote to product',
        description: 'Moves a reviewed draft toward formal Products output. It keeps experimentation separate from customer-facing or report-ready material.',
      },
    ],
  },
] as const;

type PrototypeLane = typeof prototypes[number]['id'];

function uniqueEndpoints(currentEndpoint?: string, customEndpoint?: string): string[] {
  const endpoints = [currentEndpoint, customEndpoint, ...ENDPOINT_CANDIDATES]
    .map((endpoint) => normalizeLocalLlmEndpoint(endpoint))
    .filter(Boolean);
  return Array.from(new Set(endpoints));
}

async function probeEndpoint(endpoint: string): Promise<EndpointProbe> {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${endpoint.replace(/\/+$/, '')}/models`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const durationMs = Math.round(performance.now() - started);

    if (!response.ok) {
      return {
        endpoint,
        status: 'error',
        message: `HTTP ${response.status}`,
        models: [],
        durationMs,
      };
    }

    const body = await response.json().catch(() => null) as { data?: Array<{ id?: string }>; models?: Array<{ name?: string; id?: string }> } | null;
    const models = [
      ...(body?.data?.map((model) => model.id).filter(Boolean) || []),
      ...(body?.models?.map((model) => model.id || model.name).filter(Boolean) || []),
    ] as string[];

    return {
      endpoint,
      status: 'ok',
      message: models.length > 0 ? `${models.length} model${models.length === 1 ? '' : 's'} found` : 'Reachable, no models listed',
      models,
      durationMs,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - started);
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'Timed out after 2.5s'
      : error instanceof Error
        ? error.message
        : 'Fetch failed';

    return {
      endpoint,
      status: 'error',
      message,
      models: [],
      durationMs,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-border-subtle bg-bg-base/55 px-4 py-3 text-left transition hover:border-border-medium disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>
        <span className="block text-sm font-semibold text-text-primary">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-text-muted">{description}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full border transition ${checked ? 'border-accent-blue bg-accent-blue' : 'border-border-medium bg-bg-surface'}`}>
        <span className={`absolute top-0.5 h-[1.125rem] w-[1.125rem] rounded-full bg-white shadow transition ${checked ? 'left-5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function ProbeStatusIcon({ status }: { status: EndpointProbeStatus }) {
  if (status === 'probing') return <Loader2 className="animate-spin text-accent-blue" size={16} />;
  if (status === 'ok') return <CheckCircle2 className="text-accent-green" size={16} />;
  if (status === 'error') return <XCircle className="text-red-400" size={16} />;
  return <Server className="text-text-muted" size={16} />;
}

function ActionRequestPanel({
  lane,
  folderName,
  onOpenChat,
}: {
  lane: PrototypeLane;
  folderName?: string;
  onOpenChat: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [researchQuestion, setResearchQuestion] = useState('');
  const [researchScope, setResearchScope] = useState('Use only the active investigation context and cited source material. Do not invent IOCs, TTPs, or actor claims.');
  const [researchOutput, setResearchOutput] = useState('Produce a source-aware research brief with findings, caveats, confidence, and recommended next pivots.');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftType, setDraftType] = useState('Analyst working note');
  const [draftGoal, setDraftGoal] = useState('Create a checkpointed draft from reviewed investigation material and list open questions before promotion to Products.');

  const prompt = lane === 'research'
    ? [
      'CaddyShack request: investigation-scoped deep research.',
      `Investigation: ${folderName || 'No investigation selected yet; ask me to select one before using case data.'}`,
      `Research question: ${researchQuestion || '[fill in the research question]'}`,
      `Scope and guardrails: ${researchScope}`,
      `Requested output: ${researchOutput}`,
      'Privacy rule: keep conclusions inside this investigation unless I explicitly approve reuse or export.',
      'Review gate: present findings for analyst review before creating notes, IOCs, evidence, or products.',
    ].join('\n')
    : [
      'CaddyShack request: versioned working document.',
      `Investigation: ${folderName || 'No investigation selected yet; ask me to select one before using case data.'}`,
      `Draft title: ${draftTitle || '[fill in the draft title]'}`,
      `Draft type: ${draftType}`,
      `Checkpoint goal: ${draftGoal}`,
      'Drafting rule: treat this as a working document, not a final product. Preserve assumptions, open questions, and source caveats.',
      'Review gate: do not promote the draft to Products or export formats until I approve the checkpoint.',
    ].join('\n');

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function copyAndOpen() {
    await copyPrompt();
    onOpenChat();
  }

  return (
    <section className="rounded-2xl border border-accent-blue/25 bg-bg-raised/80 p-5 shadow-xl shadow-black/10">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-accent-blue/25 bg-accent-blue/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent-blue">
            <PlayCircle size={14} />
            {lane === 'research' ? 'Research action' : 'Draft action'}
          </div>
          <h2 className="mt-3 text-lg font-semibold text-text-primary">
            {lane === 'research' ? 'Stage a CaddyAI research request' : 'Stage a CaddyAI working-document request'}
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Fill this out, copy the generated prompt, then open CaddyAI. This prototype does not silently execute tools or write entities.
          </p>
        </div>
      </div>

      {lane === 'research' ? (
        <div className="grid gap-3">
          <label className="grid gap-1 text-xs font-medium text-text-secondary">
            Research question
            <input
              value={researchQuestion}
              onChange={(event) => setResearchQuestion(event.target.value)}
              maxLength={240}
              placeholder="What should CaddyAI investigate?"
              className="rounded-xl border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-blue"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-text-secondary">
            Scope and guardrails
            <textarea
              value={researchScope}
              onChange={(event) => setResearchScope(event.target.value)}
              maxLength={700}
              rows={3}
              className="rounded-xl border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-blue"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-text-secondary">
            Requested output
            <textarea
              value={researchOutput}
              onChange={(event) => setResearchOutput(event.target.value)}
              maxLength={500}
              rows={2}
              className="rounded-xl border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-blue"
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-3">
          <label className="grid gap-1 text-xs font-medium text-text-secondary">
            Draft title
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              maxLength={180}
              placeholder="Working paper title"
              className="rounded-xl border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-blue"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-text-secondary">
            Draft type
            <input
              value={draftType}
              onChange={(event) => setDraftType(event.target.value)}
              maxLength={120}
              className="rounded-xl border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-blue"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-text-secondary">
            Checkpoint goal
            <textarea
              value={draftGoal}
              onChange={(event) => setDraftGoal(event.target.value)}
              maxLength={600}
              rows={3}
              className="rounded-xl border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-blue"
            />
          </label>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-border-subtle bg-bg-base/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Generated prompt</span>
          <button
            type="button"
            onClick={copyPrompt}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-raised px-2.5 py-1 text-xs font-semibold text-text-secondary transition hover:border-accent-blue hover:text-accent-blue"
          >
            <Clipboard size={13} />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-base p-3 text-xs leading-5 text-text-secondary">{prompt}</pre>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyAndOpen}
          className="rounded-xl border border-accent-blue/40 bg-accent-blue/15 px-4 py-2 text-sm font-semibold text-accent-blue transition hover:bg-accent-blue/20"
        >
          Copy prompt and open CaddyAI
        </button>
      </div>
    </section>
  );
}

export function ExperimentalView({ folder, settings, onUpdateFolder, onUpdateSettings, onOpenChat }: ExperimentalViewProps) {
  const [activeLane, setActiveLane] = useState<PrototypeLane | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [probes, setProbes] = useState<EndpointProbe[]>(() => (
    uniqueEndpoints(settings.llmLocalEndpoint).map((endpoint) => ({
      endpoint,
      status: 'idle',
      message: 'Not probed',
      models: [],
    }))
  ));
  const [probing, setProbing] = useState(false);
  const [previewMemoryEnabled, setPreviewMemoryEnabled] = useState(false);
  const [previewSealedCaseMemory, setPreviewSealedCaseMemory] = useState(false);
  const [previewSuppressAgentLearning, setPreviewSuppressAgentLearning] = useState(false);

  const memoryEnabled = folder ? folder.investigationMemoryEnabled === true : previewMemoryEnabled;
  const sealedCaseMemory = folder ? folder.sealedCaseMemory === true : previewSealedCaseMemory;
  const suppressAgentLearning = folder ? folder.suppressAgentLearning === true : previewSuppressAgentLearning;

  async function scanEndpoints() {
    const endpoints = uniqueEndpoints(settings.llmLocalEndpoint, customEndpoint);
    setProbing(true);
    setProbes(endpoints.map((endpoint) => ({ endpoint, status: 'probing', message: 'Checking /models', models: [] })));

    const results = await Promise.all(endpoints.map((endpoint) => probeEndpoint(endpoint)));
    setProbes(results);
    setProbing(false);
  }

  function updateFolderMemory(updates: Partial<Folder>) {
    if (folder) {
      void onUpdateFolder(folder.id, updates);
      return;
    }

    if (updates.investigationMemoryEnabled !== undefined) {
      setPreviewMemoryEnabled(updates.investigationMemoryEnabled);
    }
    if (updates.sealedCaseMemory !== undefined) {
      setPreviewSealedCaseMemory(updates.sealedCaseMemory);
    }
    if (updates.suppressAgentLearning !== undefined) {
      setPreviewSuppressAgentLearning(updates.suppressAgentLearning);
    }
  }

  function selectEndpoint(probe: EndpointProbe) {
    const preferredModel = probe.models[0] || settings.llmLocalModelName || settings.llmDefaultModel;
    onUpdateSettings({
      llmLocalEndpoint: probe.endpoint,
      llmDefaultProvider: 'local',
      ...(preferredModel ? { llmLocalModelName: preferredModel, llmDefaultModel: preferredModel } : {}),
    });
  }

  function toggleStep(stepKey: string) {
    setExpandedSteps((current) => ({
      ...current,
      [stepKey]: !current[stepKey],
    }));
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_32rem),linear-gradient(180deg,rgba(15,23,42,0.72),transparent)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 lg:px-8">
        <section className="relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-raised/80 p-6 shadow-2xl shadow-black/10">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-accent-blue/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-blue/25 bg-accent-blue/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-blue">
                <ShieldCheck size={14} />
                CaddyShack workbench
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">CaddyShack</h1>
              <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">
                A client-first staging area for ThreatCaddy ideas that need analyst review before they become storage, server, or automation commitments.
              </p>
              <p className="mt-2 text-xs text-text-muted">
                {folder ? `Current investigation context: ${folder.name}` : 'Select an investigation to evaluate scoped prototype behavior.'}
              </p>
            </div>

            <div className="grid gap-2 text-xs text-text-secondary sm:grid-cols-3 lg:w-[25rem]">
              {['No migrations', 'No server routes', 'No secrets'].map((label) => (
                <div key={label} className="rounded-xl border border-border-subtle bg-bg-base/60 px-3 py-2 text-center font-medium">
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {prototypes.map((prototype) => {
            const Icon = prototype.icon;
            return (
              <article
                key={prototype.title}
                className={`relative cursor-default overflow-hidden rounded-2xl border ${activeLane === prototype.id ? 'border-accent-blue shadow-xl shadow-accent-blue/10' : prototype.border} bg-bg-raised p-5 transition-colors duration-200`}
              >
                <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${prototype.accent}`} />
                <div className="relative">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="rounded-2xl border border-white/10 bg-bg-base/70 p-3 text-text-primary shadow-lg">
                      <Icon size={24} />
                    </div>
                    <span className="rounded-full border border-border-subtle bg-bg-base/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                      {prototype.eyebrow}
                    </span>
                  </div>

                  <h2 className="text-lg font-semibold text-text-primary">{prototype.title}</h2>
                  <p className="mt-2 min-h-[4.5rem] text-sm leading-6 text-text-secondary">{prototype.description}</p>
                  <button
                    type="button"
                    aria-pressed={activeLane === prototype.id}
                    onClick={() => setActiveLane((current) => current === prototype.id ? null : prototype.id)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-base/70 px-2.5 py-1 text-xs font-semibold text-text-secondary transition hover:border-accent-blue hover:text-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
                  >
                    <PlayCircle size={12} />
                    {activeLane === prototype.id ? 'Close form' : 'Open request form'}
                  </button>

                  <div className="mt-5 grid gap-2">
                    {prototype.steps.map((step) => (
                      <div key={step.id} className="overflow-hidden rounded-xl border border-border-subtle bg-bg-base/50">
                        <button
                          type="button"
                          aria-expanded={expandedSteps[`${prototype.id}:${step.id}`] === true}
                          onClick={() => toggleStep(`${prototype.id}:${step.id}`)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-semibold text-text-secondary transition hover:border-accent-blue hover:bg-bg-base/70 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-blue/40"
                        >
                          <span className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-blue/10 text-accent-blue">
                              <FileText size={12} />
                            </span>
                            {step.title}
                          </span>
                          <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                            {expandedSteps[`${prototype.id}:${step.id}`] ? 'Hide' : 'Details'}
                          </span>
                        </button>
                        {expandedSteps[`${prototype.id}:${step.id}`] && (
                          <div className="border-t border-border-subtle px-3 pb-3 pt-2 text-xs leading-5 text-text-muted">
                            {step.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {activeLane && (
          <ActionRequestPanel
            lane={activeLane}
            folderName={folder?.name}
            onOpenChat={onOpenChat}
          />
        )}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <article className="rounded-2xl border border-amber-400/30 bg-bg-raised p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                  <Database size={14} />
                  Memory hygiene
                </div>
                <h2 className="mt-3 text-lg font-semibold text-text-primary">Investigation memory controls</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Prototype narrow CaddyAI memory as an investigation-local feature. Sensitive cases can suppress durable learning before any memory table exists.
                </p>
              </div>
              <SlidersHorizontal className="text-text-muted" size={22} />
            </div>

            <div className="grid gap-3">
              <ToggleRow
                title="Enable investigation memory"
                description="Allow CaddyAI to remember reviewed context only for this investigation. Default is off."
                checked={memoryEnabled}
                onChange={(checked) => updateFolderMemory({ investigationMemoryEnabled: checked })}
              />
              <ToggleRow
                title="Sensitive case mode"
                description="Seal the case boundary and suppress reusable lessons for this investigation."
                checked={sealedCaseMemory}
                onChange={(checked) => updateFolderMemory({ sealedCaseMemory: checked, suppressAgentLearning: checked ? true : suppressAgentLearning })}
              />
              <ToggleRow
                title="Suppress reusable agent learning"
                description="Prevent this case from contributing memories, patterns, or defaults to future investigations."
                checked={suppressAgentLearning}
                disabled={sealedCaseMemory}
                onChange={(checked) => updateFolderMemory({ suppressAgentLearning: checked })}
              />
            </div>

            <div className="mt-4 rounded-xl border border-border-subtle bg-bg-base/50 p-3 text-xs leading-5 text-text-muted">
              {folder
                ? 'These controls persist on the selected investigation record only. They do not create a new database table or export memory content.'
                : 'Preview mode: these toggles are interactive here, but they will not persist until an investigation is selected.'}
            </div>
          </article>

          <article className="rounded-2xl border border-rose-400/30 bg-bg-raised p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-300">
                  <Network size={14} />
                  Local-first setup
                </div>
                <h2 className="mt-3 text-lg font-semibold text-text-primary">Local endpoint discovery</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Probe local OpenAI-compatible endpoints with short timeouts, then choose the endpoint explicitly. No fabricated host or bearer token is written.
                </p>
              </div>
              <Server className="text-text-muted" size={22} />
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="grid gap-1 text-xs font-medium text-text-secondary">
                Optional endpoint
                <input
                  value={customEndpoint}
                  onChange={(event) => setCustomEndpoint(event.target.value)}
                  maxLength={160}
                  placeholder="http://127.0.0.1:11434/v1"
                  className="rounded-xl border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-blue"
                />
              </label>
              <button
                type="button"
                onClick={scanEndpoints}
                disabled={probing}
                className="self-end rounded-xl border border-accent-blue/40 bg-accent-blue/15 px-4 py-2 text-sm font-semibold text-accent-blue transition hover:bg-accent-blue/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {probing ? 'Scanning...' : 'Scan local endpoints'}
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-border-subtle">
              <div className="grid grid-cols-[minmax(0,1fr)_8rem_6rem] gap-2 border-b border-border-subtle bg-bg-base/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                <span>Endpoint</span>
                <span>Status</span>
                <span className="text-right">Action</span>
              </div>
              <div className="divide-y divide-border-subtle">
                {probes.map((probe) => (
                  <div key={probe.endpoint} className="grid grid-cols-[minmax(0,1fr)_8rem_6rem] items-center gap-2 px-3 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-text-primary">{probe.endpoint}</div>
                      <div className="mt-1 truncate text-xs text-text-muted">
                        {probe.message}{probe.durationMs ? ` · ${probe.durationMs}ms` : ''}
                        {probe.models.length > 0 ? ` · ${probe.models.slice(0, 2).join(', ')}${probe.models.length > 2 ? '...' : ''}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <ProbeStatusIcon status={probe.status} />
                      {probe.status}
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        disabled={probe.status !== 'ok'}
                        onClick={() => selectEndpoint(probe)}
                        className="rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:border-accent-blue hover:text-accent-blue disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-4 rounded-2xl border border-border-subtle bg-bg-raised/70 p-5 md:grid-cols-3">
          <div className="flex gap-3">
            <Search className="mt-0.5 text-accent-blue" size={18} />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Review gate first</h3>
              <p className="mt-1 text-xs leading-5 text-text-muted">Research and working-document lanes stay visible prototypes until we add reviewed write paths.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Lock className="mt-0.5 text-accent-amber" size={18} />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Analyst controlled</h3>
              <p className="mt-1 text-xs leading-5 text-text-muted">Memory is case-scoped, disabled by default, and suppressible for sensitive investigations.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Server className="mt-0.5 text-accent-green" size={18} />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Local boundary</h3>
              <p className="mt-1 text-xs leading-5 text-text-muted">Endpoint discovery uses browser-visible local probes and writes only the selected local endpoint.</p>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={onOpenChat}
          className="self-start rounded-xl border border-border-subtle bg-bg-raised px-4 py-2 text-sm font-semibold text-text-secondary transition hover:border-accent-blue hover:text-accent-blue"
        >
          Open CaddyAI to test the selected endpoint
        </button>
      </div>
    </div>
  );
}
