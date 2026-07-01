import type { Settings, ViewMode } from '../types';

export type OnboardingStepId =
  | 'configure-ai'
  | 'connect-email'
  | 'enable-integration'
  | 'set-notifications';

export type OnboardingStepStatus = 'complete' | 'active' | 'skipped' | 'pending';

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  actionLabel: string;
  actionTarget: { kind: 'settings'; tab: string } | { kind: 'view'; target: ViewMode };
  optional?: boolean;
}

export interface OnboardingState {
  dismissed: boolean;
  skippedSteps: OnboardingStepId[];
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'configure-ai',
    title: 'Configure AI model',
    description: 'Pick an AI provider for AssistantCaddy. You can use the same key as CaddyAI or choose a different model.',
    actionLabel: 'Open AI settings',
    actionTarget: { kind: 'settings', tab: 'ai' },
  },
  {
    id: 'connect-email',
    title: 'Connect an email account',
    description: 'Link Gmail, Outlook, or a local bridge so EmailCaddy can work with your inbox.',
    actionLabel: 'Open email setup',
    actionTarget: { kind: 'view', target: 'cademail' },
    optional: false,
  },
  {
    id: 'enable-integration',
    title: 'Enable an integration',
    description: 'Add at least one threat intelligence integration (VirusTotal, Shodan, etc.) so the AI can enrich IOCs.',
    actionLabel: 'Open integrations',
    actionTarget: { kind: 'settings', tab: 'integrations' },
    optional: true,
  },
  {
    id: 'set-notifications',
    title: 'Set notification rules',
    description: 'Configure which AssistantCaddy events generate desktop alerts so you stay informed without checking constantly.',
    actionLabel: 'Open notifications',
    actionTarget: { kind: 'settings', tab: 'notifications' },
    optional: true,
  },
];

const STORAGE_KEY = 'assistant-onboarding-state-v1';

export function loadOnboardingState(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OnboardingState>;
      return {
        dismissed: typeof parsed.dismissed === 'boolean' ? parsed.dismissed : false,
        skippedSteps: Array.isArray(parsed.skippedSteps)
          ? parsed.skippedSteps.filter((s): s is OnboardingStepId =>
              typeof s === 'string' && ONBOARDING_STEPS.some((step) => step.id === s))
          : [],
      };
    }
  } catch {
    // ignore
  }
  return { dismissed: false, skippedSteps: [] };
}

export function saveOnboardingState(state: OnboardingState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** True when the given settings have at least one configured AI provider. */
export function isAiConfigured(settings: Settings): boolean {
  if (settings.llmAnthropicApiKey?.trim()) return true;
  if (settings.llmOpenAIApiKey?.trim()) return true;
  if (settings.llmGeminiApiKey?.trim()) return true;
  if (settings.llmMistralApiKey?.trim()) return true;
  const localEndpoint = settings.assistantLlmLocalEndpoint || settings.llmLocalEndpoint;
  const localModel = settings.assistantLlmLocalModelName || settings.llmLocalModelName;
  if (localEndpoint?.trim() && localModel?.trim()) return true;
  return false;
}

/** True when the given settings have at least one configured email account. */
export function isEmailConfigured(settings: Settings): boolean {
  return (settings.emailAccounts?.length ?? 0) > 0;
}

/** Compute the status of each step given settings + runtime state. */
export function computeStepStatuses(
  settings: Settings,
  onboardingState: OnboardingState,
  installedIntegrationCount: number,
): Record<OnboardingStepId, OnboardingStepStatus> {
  const skipped = new Set(onboardingState.skippedSteps);

  const aiComplete = isAiConfigured(settings);
  const emailComplete = isEmailConfigured(settings);
  const integrationComplete = installedIntegrationCount > 0;
  const notificationsComplete = false; // No notification settings field exists yet

  return {
    'configure-ai': skipped.has('configure-ai') ? 'skipped' : aiComplete ? 'complete' : 'active',
    'connect-email': skipped.has('connect-email')
      ? 'skipped'
      : emailComplete
        ? 'complete'
        : aiComplete ? 'active' : 'pending',
    'enable-integration': skipped.has('enable-integration')
      ? 'skipped'
      : integrationComplete
        ? 'complete'
        : emailComplete ? 'active' : 'pending',
    'set-notifications': skipped.has('set-notifications')
      ? 'skipped'
      : notificationsComplete
        ? 'complete'
        : 'pending',
  };
}

/** True when all non-optional, non-skipped steps are complete. */
export function isOnboardingComplete(
  statuses: Record<OnboardingStepId, OnboardingStepStatus>,
): boolean {
  for (const step of ONBOARDING_STEPS) {
    if (step.optional) continue;
    const status = statuses[step.id];
    if (status !== 'complete' && status !== 'skipped') return false;
  }
  return true;
}
