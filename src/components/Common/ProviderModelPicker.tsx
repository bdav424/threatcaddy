import { Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LLMProvider } from '../../types';

const PROVIDER_SHORT: Record<LLMProvider, string> = {
  anthropic: 'Claude',
  openai: 'GPT',
  gemini: 'Gemini',
  mistral: 'Mistral',
  local: 'Local',
};

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT)',
  gemini: 'Google Gemini',
  mistral: 'Mistral AI',
  local: 'Local model',
};

export interface ProviderModelPickerProps {
  /** Providers that have a key/endpoint configured */
  configuredProviders: LLMProvider[];
  /** Currently active provider */
  activeProvider: LLMProvider;
  /** Currently active model value */
  activeModel: string;
  /** Available models for the active provider (optional; shows model select if provided) */
  availableModels?: { label: string; value: string; provider: LLMProvider; group: string }[];
  /** Whether this picker has an "Inherits" option (AssistantCaddy: inherit from CaddyAI) */
  inheritLabel?: string;
  /** Whether the inherit option is currently active */
  isInheriting?: boolean;
  onSelectProvider: (provider: LLMProvider | 'inherit') => void;
  onSelectModel?: (model: string, provider: LLMProvider) => void;
  onOpenSettings?: () => void;
  className?: string;
}

export function ProviderModelPicker({
  configuredProviders,
  activeProvider,
  activeModel,
  availableModels,
  inheritLabel,
  isInheriting = false,
  onSelectProvider,
  onSelectModel,
  onOpenSettings,
  className,
}: ProviderModelPickerProps) {
  const hasProviders = configuredProviders.length > 0;

  const modelsForActiveProvider = availableModels?.filter((m) => m.provider === activeProvider) ?? [];

  return (
    <div
      aria-label="AI model picker"
      className={cn('rounded-xl border border-border-subtle bg-bg-deep/40 px-3 py-2', className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          AI model
        </span>

        {!hasProviders && (
          <span className="text-xs text-text-muted italic">
            No provider configured —
          </span>
        )}

        {hasProviders && inheritLabel && (
          <button
            type="button"
            onClick={() => onSelectProvider('inherit')}
            aria-pressed={isInheriting}
            className={cn(
              'inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold transition-colors',
              isInheriting
                ? 'border-purple/30 bg-purple/15 text-text-primary'
                : 'border-border-subtle bg-transparent text-text-secondary hover:border-border-medium hover:text-text-primary',
            )}
          >
            {inheritLabel}
          </button>
        )}

        {configuredProviders.map((provider) => {
          const active = !isInheriting && activeProvider === provider;
          return (
            <button
              key={provider}
              type="button"
              onClick={() => onSelectProvider(provider)}
              aria-pressed={active}
              title={PROVIDER_LABELS[provider]}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors',
                active
                  ? 'border-purple/30 bg-purple/15 text-text-primary'
                  : 'border-border-subtle bg-transparent text-text-secondary hover:border-border-medium hover:text-text-primary',
              )}
            >
              {PROVIDER_SHORT[provider]}
            </button>
          );
        })}

        {hasProviders && !isInheriting && (
          modelsForActiveProvider.length > 1 && onSelectModel ? (
            <select
              value={activeModel}
              onChange={(e) => {
                const m = availableModels?.find((m) => m.value === e.target.value);
                if (m) onSelectModel(m.value, m.provider);
              }}
              className="h-7 rounded-full border border-border-subtle bg-bg-deep px-2 text-[11px] text-text-secondary focus:outline-none focus:border-purple/40"
            >
              {modelsForActiveProvider.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          ) : (
            <span className="ml-1 max-w-[12rem] truncate text-[11px] text-text-muted" title={activeModel}>
              {activeModel || 'No model set'}
            </span>
          )
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border-subtle bg-transparent px-2 text-[11px] text-text-muted transition-colors hover:border-border-medium hover:text-text-primary"
          >
            <Settings2 size={11} />
            AI settings
          </button>
        )}
      </div>
    </div>
  );
}
