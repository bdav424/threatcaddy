import { useRef, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  FileStack,
  FileText,
  Loader2,
  Lock,
  Network,
  Palette,
  Search,
  Server,
  ShieldCheck,
  Clipboard,
  PlayCircle,
  Table2,
  Upload,
  XCircle,
} from 'lucide-react';
import type { Folder, NoteTemplate, ProductBaselineStructuralMap, Settings } from '../../types';
import { uniqueEndpoints, probeEndpoint, type EndpointProbe, type EndpointProbeStatus } from '../../lib/local-endpoint-discovery';
import { arrayBufferToBase64, deriveDocxTemplate } from '../../lib/docx-template-renderer';
import { buildDerivedBaselineFromDocx } from '../../lib/product-baselines';


interface ExperimentalViewProps {
  folder?: Folder;
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  onOpenChat: () => void;
  /** CaddyLab docx round-trip (Stage 1) — same handler ProductView uses to
   * create a baseline from an uploaded document, reused here so a derived
   * template lands in the same picker either way. */
  onCreateBaseline?: (partial: Partial<NoteTemplate> & { name: string; content: string }) => Promise<NoteTemplate>;
}


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
] as const;

type PrototypeLane = typeof prototypes[number]['id'];

// ── CaddyLab docx round-trip (BUILDSPEC Stage 1) ───────────────────────────
// Upload a report → derive a reusable structural template (headings, table
// map, color palette) → save it as a product baseline. The existing
// docx-template-renderer.ts fills it back out section-by-section against
// the SAME stored bytes; unmatched sections keep the original template's
// content untouched instead of being wiped, which is what makes the
// round-trip "faithful" rather than a wholesale content replace.

function DocxTemplateDeriver({
  onCreateBaseline,
}: {
  onCreateBaseline?: (partial: Partial<NoteTemplate> & { name: string; content: string }) => Promise<NoteTemplate>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [docxBase64, setDocxBase64] = useState<string | null>(null);
  const [structuralMap, setStructuralMap] = useState<ProductBaselineStructuralMap | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setError('');
    setMessage('');
    setStructuralMap(null);
    setDocxBase64(null);
    try {
      const buffer = await file.arrayBuffer();
      const map = deriveDocxTemplate(new Uint8Array(buffer));
      if (map.sections.length === 0) {
        setError('No headings were found in this document. Add Heading/Title styles in Word and re-upload.');
        return;
      }
      setFileName(file.name);
      setDocxBase64(arrayBufferToBase64(buffer));
      setStructuralMap(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read this document.');
    }
  }

  async function handleSaveAsBaseline() {
    if (!fileName || !docxBase64 || !structuralMap || !onCreateBaseline) return;
    setSaving(true);
    setError('');
    try {
      const partial = buildDerivedBaselineFromDocx(fileName, docxBase64, structuralMap);
      const created = await onCreateBaseline(partial);
      setMessage(`Saved "${created.name}" as a product baseline — open it from Products → Baselines.`);
      setFileName(null);
      setDocxBase64(null);
      setStructuralMap(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save this baseline.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-400/25 bg-bg-raised/80 p-5 shadow-xl shadow-black/10">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
            <FileStack size={14} />
            Report engine
          </div>
          <h2 className="mt-3 text-lg font-semibold text-text-primary">Derive a template from a report</h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Upload a .docx and CaddyLab maps its real structure — headings, tables, and color palette — into a
            reusable baseline. Save it, then fill it section-by-section from Products; sections you don't fill
            keep the original document's content untouched.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/20">
          <Upload size={14} />
          Upload .docx
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
        {fileName && <span className="text-xs text-text-muted">{fileName}</span>}
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {message && <p className="mt-3 text-xs text-accent-green">{message}</p>}

      {structuralMap && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-subtle bg-bg-base/60 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              <FileText size={12} />
              {structuralMap.sections.length} section{structuralMap.sections.length === 1 ? '' : 's'} detected
            </div>
            <ul className="space-y-1 text-xs text-text-secondary">
              {structuralMap.sections.map((section) => (
                <li key={section.key} className="flex items-center gap-1.5" style={{ paddingLeft: (section.level - 1) * 12 }}>
                  <span className="truncate">{section.heading}</span>
                  {section.hasTable && (
                    <span title="Contains a table" className="shrink-0 text-accent-blue">
                      <Table2 size={11} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-base/60 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              <Palette size={12} />
              Palette · {structuralMap.tableCount} table{structuralMap.tableCount === 1 ? '' : 's'}
              {structuralMap.figurePlaceholderCount > 0 ? ` · ${structuralMap.figurePlaceholderCount} figure${structuralMap.figurePlaceholderCount === 1 ? '' : 's'}` : ''}
            </div>
            {structuralMap.palette.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {structuralMap.palette.map((color) => (
                  <span
                    key={`${color.hex}-${color.usage}`}
                    title={`${color.hex} · ${color.usage} · seen ${color.count}x`}
                    className="h-6 w-6 rounded-full border border-white/10"
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">No distinct colors sampled.</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={handleSaveAsBaseline}
              disabled={saving || !onCreateBaseline}
              className="inline-flex items-center gap-1.5 rounded-xl border border-accent-blue/40 bg-accent-blue/15 px-4 py-2 text-sm font-semibold text-accent-blue transition hover:bg-accent-blue/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <FileStack size={14} />}
              {saving ? 'Saving…' : 'Save as baseline'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ProbeStatusIcon({ status }: { status: EndpointProbeStatus }) {
  if (status === 'probing') return <Loader2 className="animate-spin text-accent-blue" size={16} />;
  if (status === 'ok') return <CheckCircle2 className="text-accent-green" size={16} />;
  if (status === 'error') return <XCircle className="text-red-400" size={16} />;
  return <Server className="text-text-muted" size={16} />;
}

function ActionRequestPanel({
  folderName,
  onOpenChat,
}: {
  folderName?: string;
  onOpenChat: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [researchQuestion, setResearchQuestion] = useState('');
  const [researchScope, setResearchScope] = useState('Use only the active investigation context and cited source material. Do not invent IOCs, TTPs, or actor claims.');
  const [researchOutput, setResearchOutput] = useState('Produce a source-aware research brief with findings, caveats, confidence, and recommended next pivots.');

  const prompt = [
    'CaddyLab request: investigation-scoped deep research.',
    `Investigation: ${folderName || 'No investigation selected yet; ask me to select one before using case data.'}`,
    `Research question: ${researchQuestion || '[fill in the research question]'}`,
    `Scope and guardrails: ${researchScope}`,
    `Requested output: ${researchOutput}`,
    'Privacy rule: keep conclusions inside this investigation unless I explicitly approve reuse or export.',
    'Review gate: present findings for analyst review before creating notes, IOCs, evidence, or products.',
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
            Research action
          </div>
          <h2 className="mt-3 text-lg font-semibold text-text-primary">
            Stage a CaddyAI research request
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Fill this out, copy the generated prompt, then open CaddyAI. This prototype does not silently execute tools or write entities.
          </p>
        </div>
      </div>

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

export function ExperimentalView({ folder, settings, onUpdateSettings, onOpenChat, onCreateBaseline }: ExperimentalViewProps) {
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
  async function scanEndpoints() {
    const endpoints = uniqueEndpoints(settings.llmLocalEndpoint, customEndpoint);
    setProbing(true);
    setProbes(endpoints.map((endpoint) => ({ endpoint, status: 'probing', message: 'Checking /models', models: [] })));

    const results = await Promise.all(endpoints.map((endpoint) => probeEndpoint(endpoint)));
    setProbes(results);
    setProbing(false);
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
                CaddyLab
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">CaddyLab</h1>
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

        <DocxTemplateDeriver onCreateBaseline={onCreateBaseline} />

        <section className="grid gap-4 md:max-w-xl">
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
            folderName={folder?.name}
            onOpenChat={onOpenChat}
          />
        )}

        <div className="rounded-2xl border border-border-subtle bg-bg-raised/60 p-4 text-sm leading-6 text-text-secondary">
          Looking for versioned working documents? Draft checkpointing, delta review, and promotion to Products now live in{' '}
          <span className="font-semibold text-text-primary">ReportCaddy</span> — open a report there and use the checkpoint button in its toolbar.
        </div>

        <section className="grid gap-4">
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
