import {
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronRight,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type WorkspaceTone = 'default' | 'blue' | 'green' | 'amber' | 'purple' | 'rose';

export interface WorkspaceStat {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone?: WorkspaceTone;
}

export interface AssistantProviderBadge {
  id: string;
  label: string;
  shortLabel: string;
  tone?: WorkspaceTone;
}

export interface AssistantPromptResponse {
  title: string;
  summary: string;
  bullets: string[];
  footer?: string;
  tone?: WorkspaceTone;
}

export interface AssistantPromptSuggestion {
  id: string;
  label: string;
  prompt: string;
  matchTerms?: string[];
  response: AssistantPromptResponse;
  tone?: WorkspaceTone;
}

const TONE_STYLES: Record<WorkspaceTone, string> = {
  default: 'border-border-subtle bg-bg-deep/40 text-text-primary',
  blue: 'border-accent-blue/20 bg-accent-blue/5 text-text-primary',
  green: 'border-accent-green/20 bg-accent-green/5 text-text-primary',
  amber: 'border-amber-400/20 bg-amber-400/10 text-text-primary',
  purple: 'border-purple/20 bg-purple/10 text-text-primary',
  rose: 'border-rose-400/20 bg-rose-400/10 text-text-primary',
};

function normalizePromptInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function findBestPromptResponse(
  input: string,
  suggestions: AssistantPromptSuggestion[],
  fallbackResponse: AssistantPromptResponse,
) {
  const tokens = new Set(normalizePromptInput(input));
  let best: AssistantPromptSuggestion | null = null;
  let bestScore = 0;

  for (const suggestion of suggestions) {
    const terms = suggestion.matchTerms?.length
      ? suggestion.matchTerms
      : normalizePromptInput(`${suggestion.label} ${suggestion.prompt}`);
    const score = terms.reduce((count, term) => count + (tokens.has(term.toLowerCase()) ? 1 : 0), 0);
    if (score > bestScore) {
      best = suggestion;
      bestScore = score;
    }
  }

  if (best && bestScore > 0) {
    return {
      matchedLabel: best.label,
      response: best.response,
    };
  }

  return {
    matchedLabel: 'Custom ask',
    response: fallbackResponse,
  };
}

export function WorkspaceShell({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  accentClassName = 'border-purple/20 bg-purple/10 text-purple',
  status,
  actions,
  stats,
  children,
}: {
  title: string;
  subtitle: string;
  eyebrow: string;
  icon: LucideIcon;
  accentClassName?: string;
  status?: ReactNode;
  actions?: ReactNode;
  stats?: WorkspaceStat[];
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border-subtle bg-[color:rgba(15,23,42,0.42)] shadow-[0_24px_80px_rgba(15,23,42,0.2)] backdrop-blur-sm">
      <div className="border-b border-border-subtle bg-[linear-gradient(135deg,rgba(59,130,246,0.08),rgba(168,85,247,0.04),transparent)] px-4 py-4 md:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]', accentClassName)}>
              <Icon size={12} />
              {eyebrow}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">{subtitle}</p>
            </div>
          </div>
          {(status || actions) && (
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[260px]">
              {status}
              {actions}
            </div>
          )}
        </div>

        {stats && stats.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <article
                key={stat.id}
                className={cn(
                  'rounded-xl border px-3 py-3',
                  TONE_STYLES[stat.tone || 'default'],
                )}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  {stat.label}
                </div>
                <div className="mt-2 text-xl font-semibold text-text-primary">{stat.value}</div>
                <p className="mt-1 text-xs leading-5 text-text-secondary">{stat.detail}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

export function AssistantPromptDock({
  laneLabel,
  placeholder,
  providers,
  suggestions,
  fallbackResponse,
  helperText,
}: {
  laneLabel: string;
  placeholder: string;
  providers: AssistantProviderBadge[];
  suggestions: AssistantPromptSuggestion[];
  fallbackResponse: AssistantPromptResponse;
  helperText: string;
}) {
  const [promptValue, setPromptValue] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [responseState, setResponseState] = useState<{
    matchedLabel: string;
    response: AssistantPromptResponse;
  } | null>(null);

  const promptChips = useMemo(() => suggestions.slice(0, 3), [suggestions]);

  const submitPrompt = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLastQuestion(trimmed);
    setResponseState(findBestPromptResponse(trimmed, suggestions, fallbackResponse));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitPrompt(promptValue);
    }
  };

  return (
    <div className="rounded-2xl border border-border-subtle bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(30,41,59,0.88),rgba(15,23,42,0.8))] p-4 shadow-[0_24px_50px_rgba(15,23,42,0.18)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-purple/20 bg-purple/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-purple">
            <Sparkles size={12} />
            Ask {laneLabel}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            {helperText}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {promptChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setPromptValue(chip.prompt);
                setLastQuestion(chip.prompt);
                setResponseState({
                  matchedLabel: chip.label,
                  response: chip.response,
                });
              }}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                TONE_STYLES[chip.tone || 'default'],
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-bg-primary/70 p-3 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple/20 bg-purple/10 text-purple">
              <WandSparkles size={17} />
            </div>
            <input
              type="text"
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              aria-label={`Ask ${laneLabel}`}
            />
          </div>

          <div className="flex items-center justify-between gap-3 md:justify-end">
            <div className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-deep/60 px-2 py-1.5">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className={cn(
                    'flex h-8 min-w-[2rem] items-center justify-center rounded-lg border px-2 text-[10px] font-semibold uppercase tracking-[0.16em]',
                    TONE_STYLES[provider.tone || 'default'],
                  )}
                  title={provider.label}
                  aria-label={provider.label}
                >
                  {provider.shortLabel}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => submitPrompt(promptValue)}
              className="inline-flex items-center justify-center rounded-xl bg-purple px-3 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
            >
              Ask
            </button>
          </div>
        </div>

        {responseState && (
          <div className="mt-3 rounded-2xl border border-border-subtle bg-bg-primary/85 p-3 shadow-[0_16px_32px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Preview response
                </div>
                <div className="mt-1 text-sm font-semibold text-text-primary">
                  {responseState.response.title}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  {responseState.matchedLabel} {lastQuestion ? `· ${lastQuestion}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResponseState(null)}
                className="rounded-lg border border-border-subtle bg-bg-deep/60 p-1 text-text-muted transition-colors hover:text-text-primary"
                aria-label="Close assistant preview"
              >
                <X size={14} />
              </button>
            </div>

            <div
              className={cn(
                'mt-3 rounded-xl border px-3 py-3',
                TONE_STYLES[responseState.response.tone || 'default'],
              )}
            >
              <p className="text-sm leading-6 text-text-secondary">
                {responseState.response.summary}
              </p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-text-secondary">
                {responseState.response.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              {responseState.response.footer && (
                <p className="mt-3 text-[11px] text-text-muted">
                  {responseState.response.footer}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  accentClassName = 'border-border-subtle bg-bg-primary/70 text-text-primary',
  actionLabel,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  accentClassName?: string;
  actionLabel?: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-border-subtle bg-bg-primary/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', accentClassName)}>
            <Icon size={17} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
            {description && <p className="mt-1 text-xs leading-5 text-text-secondary">{description}</p>}
          </div>
        </div>
        {actionLabel && (
          <div className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted">
            {actionLabel}
            <ChevronRight size={12} />
          </div>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

export function SurfaceList({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    meta?: string;
    detail: string;
    tone?: WorkspaceTone;
    trailing?: string;
  }>;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'rounded-xl border px-3 py-3',
            TONE_STYLES[item.tone || 'default'],
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-text-primary">{item.title}</span>
                {item.meta && (
                  <span className="rounded-full border border-border-subtle bg-bg-primary/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
                    {item.meta}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-text-secondary">{item.detail}</p>
            </div>
            {item.trailing && (
              <div className="shrink-0 text-[11px] font-medium text-text-muted">{item.trailing}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PillRow({
  items,
}: {
  items: Array<{
    id: string;
    label: string;
    tone?: WorkspaceTone;
  }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.id}
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
            TONE_STYLES[item.tone || 'default'],
          )}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function SegmentedControl({
  items,
  value,
  onChange,
}: {
  items: Array<{
    id: string;
    label: string;
    tone?: WorkspaceTone;
  }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-border-subtle bg-bg-primary/70 p-1.5">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
              active
                ? TONE_STYLES[item.tone || 'blue']
                : 'border-transparent bg-transparent text-text-muted hover:border-border-subtle hover:text-text-primary',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
