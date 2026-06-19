import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  KeyRound,
  Link2,
  Mail,
  MessageSquare,
  Settings2,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  WorkspaceShell,
  type AssistantPromptResponse,
  type AssistantPromptSuggestion,
} from './CaddyAssistantPrimitives';
import { useNavigation } from '../../contexts/NavigationContext';
import { useUIModals } from '../../contexts/UIModalContext';
import { cn } from '../../lib/utils';
import type { ViewMode } from '../../types';

const WIDGET_STORAGE_KEY = 'threatcaddy-assistantcaddy-overview-widgets-v2';
const OVERVIEW_MODULE_IDS = ['route-details', 'quick-actions', 'signals', 'today'] as const;

type OverviewModuleId = (typeof OVERVIEW_MODULE_IDS)[number];
type OverviewTone = 'blue' | 'green' | 'amber' | 'purple' | 'rose';
type SetupPanelMode = 'compact' | 'full' | 'hidden';
type OverviewAction =
  | { kind: 'view'; label: string; target: ViewMode }
  | { kind: 'settings'; label: string; target: 'ai' | 'integrations' | 'general' };
type WorkflowRoute =
  | { id: string; label: string; detail: string; icon: LucideIcon; tone: OverviewTone; kind: 'view'; target: ViewMode }
  | { id: string; label: string; detail: string; icon: LucideIcon; tone: OverviewTone; kind: 'settings'; target: 'ai' | 'integrations' | 'general' }
  | { id: string; label: string; detail: string; icon: LucideIcon; tone: OverviewTone; kind: 'prompt'; prompt: string };

const DEFAULT_MODULE_IDS: OverviewModuleId[] = [];

interface OverviewModule {
  id: OverviewModuleId;
  label: string;
  description: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  prompt: string;
  tone: OverviewTone;
}

interface SignalCard {
  id: string;
  title: string;
  value: string;
  detail: string;
  actionLabel: string;
  tone: OverviewTone;
  icon: LucideIcon;
  action: OverviewAction;
}

interface TodayItem {
  id: string;
  time: string;
  title: string;
  meta: string;
  actionLabel: string;
  tone: OverviewTone;
  action: OverviewAction;
}

const overviewModules: OverviewModule[] = [
  {
    id: 'route-details',
    label: 'Route cards',
    description: 'Show expanded lane descriptions under the compact workflow route bar.',
  },
  {
    id: 'quick-actions',
    label: 'Quick actions',
    description: 'Show the assistant shortcuts under the main prompt bar.',
  },
  {
    id: 'signals',
    label: 'Signals row',
    description: 'Show the compact status cards for review, conflicts, meetings, and inbox pressure.',
  },
  {
    id: 'today',
    label: 'Today list',
    description: 'Show the upcoming-today strip with direct prep and review actions.',
  },
];

const assistantSuggestions: AssistantPromptSuggestion[] = [
  {
    id: 'brief',
    label: 'Build my morning brief',
    prompt: 'Build my daily brief from today’s emails, meetings, and anything I am likely to forget.',
    matchTerms: ['daily', 'brief', 'today', 'forget', 'morning'],
    tone: 'blue',
    response: {
      title: 'Daily brief preview',
      summary: 'The assistant would lead with two follow-ups, one external meeting needing prep, and one sanitization review before lunch.',
      bullets: [
        'Start in EmailCaddy with the flagged partner thread because it contains the clearest external deadline.',
        'Reserve 20 minutes before the afternoon architecture review for missing-context prep.',
        'Keep the externally marked draft in review until sanitization confirms names and tenant references.',
      ],
      footer: 'AssistantCaddy stays routing-first here. It points to the right lane instead of trying to replace the lane.',
      tone: 'blue',
    },
  },
  {
    id: 'meeting',
    label: 'Prep my 2pm meeting',
    prompt: 'Prep me for the next external meeting and tell me what context, files, or questions I still need.',
    matchTerms: ['prep', 'meeting', 'external', 'context', 'questions'],
    tone: 'green',
    response: {
      title: 'Meeting prep preview',
      summary: 'The next external call is missing one attachment, one decision owner, and a clear statement of desired outcome.',
      bullets: [
        'Open CalendarCaddy first because the prep gap is tied to the invite body and linked meeting artifacts.',
        'Use EmailCaddy second to pull the relevant sender thread and extract unresolved asks.',
        'Keep the final talking points in review instead of turning them into a sent message.',
      ],
      footer: 'Calendar and email stay as the working surfaces. AssistantCaddy is there to get you into the right one quickly.',
      tone: 'green',
    },
  },
  {
    id: 'attention',
    label: 'What am I forgetting?',
    prompt: 'Look across my threads and meetings and tell me what I am forgetting today.',
    matchTerms: ['attention', 'today', 'threads', 'meetings', 'priority', 'forget', 'forgetting'],
    tone: 'amber',
    response: {
      title: 'What am I forgetting preview',
      summary: 'The likely pressure points are one unsent recap, one meeting prep gap, and one draft that still needs a safety pass.',
      bullets: [
        'Protect a short follow-up block after the external sync so commitments do not drift into tomorrow.',
        'Reopen the recommendation rail in EmailCaddy and confirm every inbound question is answered or explicitly deferred.',
        'Use the sanitization pass before anything leaves the review lane.',
      ],
      footer: 'This stays intentionally compact so the overview feels like a control surface, not a second inbox or calendar.',
      tone: 'amber',
    },
  },
  {
    id: 'schedule',
    label: 'Find time for a 30 min call',
    prompt: 'Find a reasonable 30 minute slot across my day without creating a silent conflict or losing travel buffer.',
    matchTerms: ['find', 'time', '30', 'call', 'conflict', 'buffer'],
    tone: 'purple',
    response: {
      title: 'Scheduling assist preview',
      summary: 'CalendarCaddy would keep the work, family, and follow-up holds visible before recommending where the call should land.',
      bullets: [
        'Use CalendarCaddy to compare existing holds instead of relying on a silent free/busy read.',
        'Prefer a slot with a prep buffer before it and room for follow-up after it.',
        'If the call comes from email, keep the thread open in EmailCaddy so the commitments stay anchored to the request.',
      ],
      footer: 'Scheduling stays reviewable and human-approved. The assistant is there to stage the decision, not hide it.',
      tone: 'purple',
    },
  },
  {
    id: 'sanitize',
    label: 'Sanitize for sharing',
    prompt: 'Sanitize the selected draft for external sharing and flag anything sensitive before it leaves review.',
    matchTerms: ['sanitize', 'sharing', 'external', 'sensitive', 'draft'],
    tone: 'rose',
    response: {
      title: 'Sanitization routing preview',
      summary: 'AssistantCaddy would route this to EmailCaddy so the draft, recipients, classification tags, and source context stay visible together.',
      bullets: [
        'Open EmailCaddy and keep the original thread beside the draft before changing wording.',
        'Flag internal-only names, tenant references, speculative claims, and unexplained acronyms before external sharing.',
        'Stage the safe wording for human review; AssistantCaddy does not send the message.',
      ],
      footer: 'Use this as a safety pass, not as an automatic send path.',
      tone: 'rose',
    },
  },
];

const fallbackResponse: AssistantPromptResponse = {
  title: 'Assistant routing preview',
  summary: 'AssistantCaddy would sort your ask into inbox review, calendar prep, or a safety pass and point you to the right lane.',
  bullets: [
    'EmailCaddy is the best lane for sender intent, commitments, reply shaping, and sanitization.',
    'CalendarCaddy is the best lane for view switching, meeting prep, buffer planning, and join-link review.',
    'The overview stays focused on routing and daily orientation so it does not become a duplicate of the working screens.',
  ],
  footer: 'Enter is intentionally lightweight here: you get a short response preview instead of a full chat thread.',
  tone: 'purple',
};

const quickActions: QuickAction[] = [
  {
    id: 'meeting',
    label: 'Prep my 2pm meeting',
    icon: CalendarDays,
    prompt: assistantSuggestions[1].prompt,
    tone: 'green',
  },
  {
    id: 'attention',
    label: 'What am I forgetting?',
    icon: ClipboardCheck,
    prompt: assistantSuggestions[2].prompt,
    tone: 'amber',
  },
  {
    id: 'brief',
    label: 'Build my morning brief',
    icon: Sparkles,
    prompt: assistantSuggestions[0].prompt,
    tone: 'blue',
  },
  {
    id: 'schedule',
    label: 'Find time for a 30 min call',
    icon: Clock3,
    prompt: assistantSuggestions[3].prompt,
    tone: 'purple',
  },
  {
    id: 'sanitize',
    label: 'Sanitize draft',
    icon: ShieldCheck,
    prompt: assistantSuggestions[4].prompt,
    tone: 'rose',
  },
];

const workflowRoutes: WorkflowRoute[] = [
  {
    id: 'emailcaddy',
    label: 'Open EmailCaddy',
    detail: 'Work sender intent, asks, draft staging, sanitization, and coverage checks.',
    icon: Mail,
    tone: 'blue',
    kind: 'view',
    target: 'cademail',
  },
  {
    id: 'calendarcaddy',
    label: 'Open CalendarCaddy',
    detail: 'Review meetings, conflicts, prep windows, travel buffers, and calendar holds.',
    icon: CalendarDays,
    tone: 'green',
    kind: 'view',
    target: 'calendarcaddy',
  },
  {
    id: 'daily-brief',
    label: 'Daily brief',
    detail: 'Summarize the day without turning the overview into another inbox.',
    icon: Sparkles,
    tone: 'purple',
    kind: 'prompt',
    prompt: assistantSuggestions[0].prompt,
  },
  {
    id: 'prep',
    label: 'Prep',
    detail: 'Find missing context, open questions, files, and expected decisions.',
    icon: Clock3,
    tone: 'amber',
    kind: 'prompt',
    prompt: assistantSuggestions[1].prompt,
  },
  {
    id: 'sanitize',
    label: 'Sanitization',
    detail: 'Route sensitive wording checks through EmailCaddy before anything is sent.',
    icon: ShieldCheck,
    tone: 'rose',
    kind: 'prompt',
    prompt: assistantSuggestions[4].prompt,
  },
  {
    id: 'forgetting',
    label: 'What am I forgetting?',
    detail: 'Check unresolved asks, prep gaps, follow-ups, and calendar commitments.',
    icon: ClipboardCheck,
    tone: 'blue',
    kind: 'prompt',
    prompt: assistantSuggestions[2].prompt,
  },
  {
    id: 'ai-setup',
    label: 'AI setup',
    detail: 'Open Settings > AI for AssistantCaddy model routing and local endpoint setup.',
    icon: KeyRound,
    tone: 'purple',
    kind: 'settings',
    target: 'ai',
  },
  {
    id: 'integrations-setup',
    label: 'Integrations',
    detail: 'Open the source catalog for local connector catalog entries and installed integration tools.',
    icon: Link2,
    tone: 'green',
    kind: 'settings',
    target: 'integrations',
  },
];

const signalCards: SignalCard[] = [
  {
    id: 'review',
    title: 'Needs review',
    value: '7',
    detail: 'Drafts and threaded asks still waiting on your judgment.',
    actionLabel: 'Review items',
    tone: 'amber',
    icon: ShieldCheck,
    action: { kind: 'view', label: 'Review items', target: 'cademail' },
  },
  {
    id: 'conflicts',
    title: 'Calendar conflicts',
    value: '2',
    detail: 'Two overlaps still need an explicit decision instead of a silent overwrite.',
    actionLabel: 'Review schedule',
    tone: 'rose',
    icon: CalendarDays,
    action: { kind: 'view', label: 'Review schedule', target: 'calendarcaddy' },
  },
  {
    id: 'meetings',
    title: 'Upcoming meetings',
    value: '4',
    detail: 'The next meeting starts in 45 minutes and still needs a prep pass.',
    actionLabel: 'View calendar',
    tone: 'green',
    icon: Clock3,
    action: { kind: 'view', label: 'View calendar', target: 'calendarcaddy' },
  },
  {
    id: 'triage',
    title: 'Inbox triage',
    value: '12',
    detail: 'New messages need sorting before they become buried follow-ups.',
    actionLabel: 'Open inbox',
    tone: 'blue',
    icon: Mail,
    action: { kind: 'view', label: 'Open inbox', target: 'cademail' },
  },
];

const todayItems: TodayItem[] = [
  {
    id: 'today-1',
    time: '10:00 AM',
    title: 'Quarterly Planning Sync',
    meta: '45 min • Zoom',
    actionLabel: 'Prep meeting',
    tone: 'purple',
    action: { kind: 'view', label: 'Prep meeting', target: 'calendarcaddy' },
  },
  {
    id: 'today-2',
    time: '1:30 PM',
    title: 'Threat Intel Review',
    meta: '30 min • Teams',
    actionLabel: 'Prep meeting',
    tone: 'blue',
    action: { kind: 'view', label: 'Prep meeting', target: 'calendarcaddy' },
  },
  {
    id: 'today-3',
    time: '3:00 PM',
    title: 'EmailCaddy Digest',
    meta: '15 min • Review lane',
    actionLabel: 'View digest',
    tone: 'purple',
    action: { kind: 'view', label: 'View digest', target: 'cademail' },
  },
];

const toneStyles: Record<OverviewTone, string> = {
  blue: 'border-accent-blue/20 bg-accent-blue/10 text-accent-blue',
  green: 'border-accent-green/20 bg-accent-green/10 text-accent-green',
  amber: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  purple: 'border-purple/20 bg-purple/10 text-purple',
  rose: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
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
  fallback: AssistantPromptResponse,
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
    response: fallback,
  };
}

function normalizeStoredModuleIds(value: unknown): OverviewModuleId[] {
  if (!Array.isArray(value)) return [...DEFAULT_MODULE_IDS];
  const validIds = new Set<OverviewModuleId>(OVERVIEW_MODULE_IDS);
  const seen = new Set<OverviewModuleId>();
  const next: OverviewModuleId[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    if (!validIds.has(entry as OverviewModuleId)) continue;
    const id = entry as OverviewModuleId;
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }

  return next;
}

function sortModuleIds(ids: OverviewModuleId[]) {
  const idSet = new Set(ids);
  return OVERVIEW_MODULE_IDS.filter((id) => idSet.has(id));
}

function loadStoredModuleIds() {
  if (typeof window === 'undefined') return [...DEFAULT_MODULE_IDS];

  try {
    const raw = localStorage.getItem(WIDGET_STORAGE_KEY);
    if (!raw) return [...DEFAULT_MODULE_IDS];
    return normalizeStoredModuleIds(JSON.parse(raw));
  } catch {
    return [...DEFAULT_MODULE_IDS];
  }
}

function SignalSummaryCard({
  card,
  onAction,
}: {
  card: SignalCard;
  onAction: (action: OverviewAction) => void;
}) {
  const Icon = card.icon;

  return (
    <article className="rounded-2xl border border-border-subtle bg-bg-primary/75 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', toneStyles[card.tone])}>
            <Icon size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{card.title}</h3>
            <p className="mt-1 text-xs leading-5 text-text-secondary">{card.detail}</p>
          </div>
        </div>
        <div className="text-4xl font-semibold leading-none text-text-primary">{card.value}</div>
      </div>

      <button
        type="button"
        onClick={() => onAction(card.action)}
        className={cn(
          'mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
          toneStyles[card.tone],
        )}
      >
        {card.actionLabel}
        <ArrowRight size={12} />
      </button>
    </article>
  );
}

export function CaddyAssistantOverviewPanel() {
  const { navigateTo } = useNavigation();
  const { openSettings } = useUIModals();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [responseState, setResponseState] = useState<{
    matchedLabel: string;
    response: AssistantPromptResponse;
  } | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [visibleModuleIds, setVisibleModuleIds] = useState<OverviewModuleId[]>(() => loadStoredModuleIds());
  const [setupPanelMode, setSetupPanelMode] = useState<SetupPanelMode>('compact');
  const visibleModules = useMemo(() => new Set(visibleModuleIds), [visibleModuleIds]);

  const setupCards = [
    {
      id: 'ai',
      title: 'AI setup in Settings',
      detail: 'Open Settings > AI for AssistantCaddy model routing, local endpoint fields, and explicit connection tests.',
      icon: KeyRound,
      tone: 'purple' as OverviewTone,
      actionLabel: 'Open AI setup',
      action: () => openSettings('ai'),
    },
    {
      id: 'slack',
      title: 'Slack workflow starter',
      detail: 'Open Settings > Integrations and start the Slack workflow from the built-in Slack card.',
      icon: MessageSquare,
      tone: 'rose' as OverviewTone,
      actionLabel: 'Open Slack workflow',
      action: () => openSettings('integrations'),
    },
    {
      id: 'email',
      title: 'EmailCaddy account setup',
      detail: 'Open EmailCaddy account setup for local mailbox staging. Live sync and send remain owned by that surface.',
      icon: Mail,
      tone: 'blue' as OverviewTone,
      actionLabel: 'Open email setup',
      action: () => navigateTo('cademail'),
    },
    {
      id: 'calendar',
      title: 'CalendarCaddy local calendar',
      detail: 'Open CalendarCaddy for local calendar review and any current setup placeholder. The overview does not probe calendars.',
      icon: CalendarDays,
      tone: 'green' as OverviewTone,
      actionLabel: 'Open calendar setup',
      action: () => navigateTo('calendarcaddy'),
    },
    {
      id: 'integrations',
      title: 'Integrations source catalog',
      detail: 'Open Settings > Integrations for the local source catalog and the installed integration tools entry point.',
      icon: Link2,
      tone: 'amber' as OverviewTone,
      actionLabel: 'Open source catalog',
      action: () => openSettings('integrations'),
    },
  ] satisfies Array<{
    id: string;
    title: string;
    detail: string;
    icon: LucideIcon;
    tone: OverviewTone;
    actionLabel: string;
    action: () => void;
  }>;
  const activeSetupLabels = 'AI setup, Slack workflow, EmailCaddy, CalendarCaddy, Integrations';
  const setupPanelVisible = setupPanelMode !== 'hidden';
  const routeDetailsVisible = visibleModules.has('route-details');

  useEffect(() => {
    try {
      localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(visibleModuleIds));
    } catch {
      // Ignore localStorage write failures; the overview still works as an in-memory layout.
    }
  }, [visibleModuleIds]);

  useEffect(() => {
    const resetLayout = () => {
      setVisibleModuleIds([...DEFAULT_MODULE_IDS]);
      setShowPreferences(false);
    };

    window.addEventListener('assistantcaddy:reset-widgets', resetLayout);
    return () => window.removeEventListener('assistantcaddy:reset-widgets', resetLayout);
  }, []);

  const layoutIsDefault = DEFAULT_MODULE_IDS.every((id, index) => visibleModuleIds[index] === id)
    && visibleModuleIds.length === DEFAULT_MODULE_IDS.length;

  const runAction = (action: OverviewAction) => {
    if (action.kind === 'view') {
      navigateTo(action.target);
      return;
    }

    openSettings(action.target);
  };

  const runWorkflowRoute = (route: WorkflowRoute) => {
    if (route.kind === 'view') {
      navigateTo(route.target);
      return;
    }

    if (route.kind === 'settings') {
      openSettings(route.target);
      return;
    }

    applyQuickAction(route.prompt);
  };

  const submitPrompt = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLastQuestion(trimmed);
    setResponseState(findBestPromptResponse(trimmed, assistantSuggestions, fallbackResponse));
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitPrompt(promptValue);
    }
  };

  const applyQuickAction = (prompt: string) => {
    setPromptValue(prompt);
    setLastQuestion(prompt);
    setResponseState(findBestPromptResponse(prompt, assistantSuggestions, fallbackResponse));
  };

  const toggleModule = (id: OverviewModuleId) => {
    setVisibleModuleIds((current) => (
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : sortModuleIds([...current, id])
    ));
  };

  const resetLayout = () => {
    setVisibleModuleIds([...DEFAULT_MODULE_IDS]);
  };

  return (
    <WorkspaceShell
      title="AssistantCaddy"
      subtitle="Use this as a clean routing layer for email, calendar, setup, prep, daily brief, sanitization, and forgotten-commitment checks. Widgets stay optional."
      eyebrow="AssistantCaddy"
      icon={Sparkles}
      accentClassName="border-purple/20 bg-purple/10 text-purple"
      actions={(
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowPreferences((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-deep/60 px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-border-medium hover:text-text-primary"
          >
            <Settings2 size={14} />
            Widget preferences
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="inline-flex items-center gap-2 rounded-full border border-purple/25 bg-purple/10 px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:border-purple/40 hover:bg-purple/15"
          >
            <Bot size={14} className="text-purple" />
            Ask AssistantCaddy
          </button>
        </div>
      )}
    >
      {showPreferences && (
        <div className="mb-4 rounded-2xl border border-border-subtle bg-bg-primary/75 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Widget preferences</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-text-secondary">
                Keep the overview lean by default. Turn optional modules on only when you want status summaries beside the main routing console.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {overviewModules.map((module) => {
              const active = visibleModules.has(module.id);
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => toggleModule(module.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors',
                    active
                      ? 'border-purple/25 bg-purple/10 text-text-primary'
                      : 'border-border-subtle bg-bg-deep/40 text-text-secondary hover:border-border-medium hover:text-text-primary',
                  )}
                  title={module.description}
                >
                  <span>{module.label}</span>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                    {active ? 'On' : 'Off'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-border-subtle bg-bg-deep/35 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Setup routes</h4>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  Control the routing strip without moving setup state into the overview.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['compact', 'full', 'hidden'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSetupPanelMode(mode)}
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
                      setupPanelMode === mode
                        ? 'border-amber-300/30 bg-amber-300/10 text-text-primary'
                        : 'border-border-subtle bg-bg-primary/60 text-text-secondary hover:border-border-medium hover:text-text-primary',
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openSettings('general')}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-deep/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-primary transition-colors hover:border-border-medium hover:bg-bg-primary"
            >
              Open general settings
              <ArrowRight size={12} />
            </button>
            <button
              type="button"
              onClick={() => openSettings('ai')}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-deep/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-primary transition-colors hover:border-border-medium hover:bg-bg-primary"
            >
              Open AI settings
              <ArrowRight size={12} />
            </button>
            <button
              type="button"
              onClick={() => openSettings('integrations')}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-deep/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-primary transition-colors hover:border-border-medium hover:bg-bg-primary"
            >
              Open integrations
              <ArrowRight size={12} />
            </button>
            <button
              type="button"
              onClick={() => openSettings('integrations')}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-primary transition-colors hover:border-emerald-500/45 hover:bg-emerald-500/15"
            >
              Open Slack workflow
              <ArrowRight size={12} />
            </button>
            <button
              type="button"
              onClick={resetLayout}
              disabled={layoutIsDefault}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-deep/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-primary transition-colors hover:border-border-medium hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset layout
            </button>
          </div>
        </div>
      )}

      {setupPanelVisible && setupPanelMode === 'compact' && (
        <div
          role="region"
          aria-label="AssistantCaddy setup routes"
          className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-300/8 px-3 py-2.5"
        >
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-300">
                <AlertCircle size={15} />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-text-primary">
                  Setup routes: {activeSetupLabels}
                </h3>
                <p className="truncate text-xs text-text-secondary">
                  Open the owning setup surface; this overview does not connect, probe, or store credentials.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {setupCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={card.action}
                    title={card.detail}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors',
                      toneStyles[card.tone],
                    )}
                  >
                    <Icon size={12} />
                    {card.actionLabel}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSetupPanelMode('full')}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-subtle bg-bg-deep/50 px-2.5 text-[11px] font-semibold text-text-secondary transition-colors hover:border-border-medium hover:text-text-primary"
              >
                <ChevronDown size={12} />
                Expand
              </button>
              <button
                type="button"
                onClick={() => setSetupPanelMode('hidden')}
                aria-label="Dismiss AssistantCaddy setup nudge"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle bg-bg-deep/50 text-text-muted transition-colors hover:border-border-medium hover:text-text-primary"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {setupPanelVisible && setupPanelMode === 'full' && (
        <div
          role="region"
          aria-label="AssistantCaddy setup routes"
          className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-300/8 p-3"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-300">
                <AlertCircle size={17} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">AssistantCaddy setup check</h3>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-text-secondary">
                  Use these routes when local setup is needed. AI setup lives in Settings, email and calendar setup stay in their Caddy surfaces, and the source catalog lives under Integrations.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => openSettings('integrations')}
                className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-deep/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-primary transition-colors hover:border-border-medium hover:bg-bg-primary"
              >
                <Link2 size={12} />
                Integrations
              </button>
              <button
                type="button"
                onClick={() => setSetupPanelMode('compact')}
                className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-deep/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-primary transition-colors hover:border-border-medium hover:bg-bg-primary"
              >
                <ChevronUp size={12} />
                Minimize
              </button>
              <button
                type="button"
                onClick={() => setSetupPanelMode('hidden')}
                aria-label="Dismiss AssistantCaddy setup check"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle bg-bg-deep/50 text-text-muted transition-colors hover:border-border-medium hover:text-text-primary"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {setupCards.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.id}
                  className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-bg-primary/68 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', toneStyles[card.tone])}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-text-primary">{card.title}</h4>
                      <p className="mt-1 text-xs leading-5 text-text-secondary">{card.detail}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={card.action}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
                        toneStyles[card.tone],
                      )}
                    >
                      {card.actionLabel}
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-[24px] border border-purple/25 bg-[linear-gradient(135deg,rgba(10,14,30,0.96),rgba(21,24,41,0.92),rgba(10,14,30,0.94))] p-3 shadow-[0_24px_60px_rgba(15,23,42,0.22)] md:p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[24px] border border-purple/25 bg-bg-primary/70 px-4 py-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple/25 bg-purple/10 text-purple">
                <WandSparkles size={18} />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                placeholder="What can I help you with?"
                aria-label="Ask AssistantCaddy"
                className="min-w-0 flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-muted"
              />
              <button
                type="button"
                onClick={() => submitPrompt(promptValue)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple text-white transition-all hover:brightness-110"
                aria-label="Send AssistantCaddy prompt"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          {visibleModules.has('quick-actions') && (
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => applyQuickAction(action.prompt)}
                    className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-primary/70 px-3 py-2 text-sm text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover"
                  >
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-full border', toneStyles[action.tone])}>
                      <Icon size={14} />
                    </span>
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-2xl border border-border-subtle bg-bg-primary/55 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                <Sparkles size={12} className="text-purple" />
                Routes
              </div>
              {workflowRoutes.map((route) => {
                const Icon = route.icon;
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => runWorkflowRoute(route)}
                    title={route.detail}
                    aria-label={route.label}
                    className={cn(
                      'inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-medium hover:bg-bg-hover',
                      routeDetailsVisible ? 'bg-bg-deep/35' : 'bg-bg-deep/50',
                    )}
                  >
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border', toneStyles[route.tone])}>
                      <Icon size={11} />
                    </span>
                    {route.label}
                  </button>
                );
              })}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openSettings('ai')}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border-subtle bg-bg-deep/50 px-2.5 text-[11px] font-semibold text-text-secondary transition-colors hover:border-border-medium hover:text-text-primary"
                >
                  AI settings
                  <Settings2 size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleModule('route-details')}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border-subtle bg-bg-deep/50 px-2.5 text-[11px] font-semibold text-text-secondary transition-colors hover:border-border-medium hover:text-text-primary"
                  aria-expanded={routeDetailsVisible}
                >
                  {routeDetailsVisible ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  Details
                </button>
              </div>
            </div>

            {routeDetailsVisible && (
              <div className="mt-3 rounded-2xl border border-border-subtle/70 bg-bg-deep/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-text-secondary">
                    Expanded route cards are optional. Hide them when you want AssistantCaddy to stay as a compact control surface.
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleModule('route-details')}
                    aria-label="Hide AssistantCaddy route details"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-primary/60 text-text-muted transition-colors hover:border-border-medium hover:text-text-primary"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {workflowRoutes.map((route) => {
                  const Icon = route.icon;
                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => runWorkflowRoute(route)}
                      aria-label={route.label}
                      className="group flex min-h-[72px] items-start gap-3 rounded-xl border border-border-subtle bg-bg-deep/35 p-3 text-left transition-colors hover:border-border-medium hover:bg-bg-hover"
                    >
                      <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', toneStyles[route.tone])}>
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                          {route.label}
                          <ArrowRight size={12} className="opacity-60 transition-transform group-hover:translate-x-0.5" />
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-text-secondary">{route.detail}</span>
                      </span>
                    </button>
                  );
                })}
                </div>
              </div>
            )}
          </div>

          {responseState && (
            <div className="rounded-2xl border border-border-subtle bg-bg-primary/80 p-4 shadow-[0_18px_34px_rgba(15,23,42,0.18)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                Preview response
              </div>
              <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{responseState.response.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    {responseState.matchedLabel}{lastQuestion ? ` · ${lastQuestion}` : ''}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-purple/15 bg-purple/5 px-4 py-3">
                <p className="text-sm leading-6 text-text-secondary">{responseState.response.summary}</p>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-text-secondary">
                  {responseState.response.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-purple" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                {responseState.response.footer && (
                  <p className="mt-3 text-[11px] text-text-muted">{responseState.response.footer}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {visibleModules.has('signals') && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {signalCards.map((card) => (
            <SignalSummaryCard key={card.id} card={card} onAction={runAction} />
          ))}
        </div>
      )}

      {visibleModules.has('today') && (
        <div className="mt-4 rounded-2xl border border-border-subtle bg-bg-primary/75 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple/20 bg-purple/10 text-purple">
                <CalendarDays size={17} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Upcoming today</h3>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  Keep the day visible without turning AssistantCaddy into a second calendar view.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('calendarcaddy')}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-deep/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-primary transition-colors hover:border-border-medium hover:bg-bg-primary"
            >
              View calendar
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border-subtle bg-bg-deep/35">
            {todayItems.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  'flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between',
                  index !== todayItems.length - 1 && 'border-b border-border-subtle',
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn('h-3 w-3 shrink-0 rounded-full', item.tone === 'green' ? 'bg-accent-green' : item.tone === 'amber' ? 'bg-amber-300' : item.tone === 'blue' ? 'bg-accent-blue' : item.tone === 'rose' ? 'bg-rose-300' : 'bg-purple')} />
                  <div className="min-w-0 md:w-28">
                    <div className="text-sm font-medium text-text-primary">{item.time}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-text-primary">{item.title}</div>
                    <div className="mt-1 text-xs text-text-secondary">{item.meta}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => runAction(item.action)}
                  className="inline-flex items-center gap-1.5 self-start rounded-full border border-purple/20 bg-purple/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-purple transition-colors hover:border-purple/35 hover:bg-purple/15 md:self-center"
                >
                  {item.actionLabel}
                  <ArrowRight size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-text-muted">
        AssistantCaddy can make mistakes. Verify important information before acting on it.
      </p>
    </WorkspaceShell>
  );
}
