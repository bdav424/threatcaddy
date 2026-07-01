import { useState } from 'react';
import {
  BellRing,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Mail,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface CaddyAssistantPanelProps {
  disabled?: boolean;
  hasActiveThread?: boolean;
  onLaunchPrompt: (prompt: string) => void | Promise<void>;
}

interface AssistantPrompt {
  id: string;
  label: string;
  prompt: string;
}

interface AssistantSection {
  id: string;
  title: string;
  description: string;
  guidance: string;
  icon: LucideIcon;
  iconClassName: string;
  prompts: AssistantPrompt[];
}

const ASSISTANT_SECTIONS: AssistantSection[] = [
  {
    id: 'cad-email',
    title: 'EmailCaddy',
    description: 'Triage inbound messages, surface action items, and shape reply-ready drafts without sending anything.',
    guidance: 'Best for message clean-up, follow-up framing, and inbox-to-task handoffs.',
    icon: Mail,
    iconClassName: 'bg-sky-500/10 text-sky-300 border-sky-400/20',
    prompts: [
      {
        id: 'cad-email-triage',
        label: 'Triage a message',
        prompt: 'Review this message thread, summarize the asks, highlight deadlines or risks, and draft a concise professional reply.',
      },
      {
        id: 'cad-email-follow-up',
        label: 'Shape a follow-up',
        prompt: 'Turn my rough notes into a clear follow-up message with next steps, owners, and a short subject line.',
      },
    ],
  },
  {
    id: 'calendar-caddy',
    title: 'CalendarCaddy',
    description: 'Break down invites, resolve scheduling context, and prepare week-at-a-glance planning notes.',
    guidance: 'Useful when invites are vague, overloaded, or missing clear ownership and prep detail.',
    icon: CalendarDays,
    iconClassName: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20',
    prompts: [
      {
        id: 'calendar-caddy-invite',
        label: 'Decode an invite',
        prompt: 'Review this calendar invite and extract the agenda, participants, dependencies, deadlines, and missing context I should chase down.',
      },
      {
        id: 'calendar-caddy-week',
        label: 'Plan the week',
        prompt: 'Help me organize this week of meetings, flag conflicts, and suggest where I need more prep time or follow-up.',
      },
    ],
  },
  {
    id: 'meeting-prep',
    title: 'Meeting Prep',
    description: 'Build concise briefs, talking points, and question lists from scattered notes, threads, and prep material.',
    guidance: 'Good for stakeholder calls, status reviews, customer syncs, and internal handoffs.',
    icon: BriefcaseBusiness,
    iconClassName: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
    prompts: [
      {
        id: 'meeting-prep-brief',
        label: 'Build a prep brief',
        prompt: 'Create a meeting prep brief with objectives, participant context, key questions, likely risks, and the decisions I should drive.',
      },
      {
        id: 'meeting-prep-talking-points',
        label: 'Talking points',
        prompt: 'Turn these notes into talking points, follow-up questions, and a short post-meeting action checklist.',
      },
    ],
  },
  {
    id: 'drafts-sanitization',
    title: 'Drafts & Sanitization',
    description: 'Tighten wording, strip sensitive details, and convert rough updates into cleaner draft outputs.',
    guidance: 'Use this for redaction passes, audience shifts, and draft-to-share cleanups.',
    icon: ShieldCheck,
    iconClassName: 'bg-accent-pink/10 text-accent-pink border-accent-pink/20',
    prompts: [
      {
        id: 'drafts-sanitization-external',
        label: 'Sanitize for sharing',
        prompt: 'Rewrite this draft for external sharing, remove sensitive names or identifiers, and keep the timeline, impact, and action items intact.',
      },
      {
        id: 'drafts-sanitization-redline',
        label: 'Tighten a draft',
        prompt: 'Clean up this draft, tighten the wording, call out unclear claims, and suggest a safer version for a broader audience.',
      },
    ],
  },
  {
    id: 'smart-alerts',
    title: 'Smart Alerts',
    description: 'Turn raw notifications into short situational summaries with urgency, confidence, and next-step guidance.',
    guidance: 'Designed for quick triage when multiple signals are competing for attention.',
    icon: BellRing,
    iconClassName: 'bg-violet-500/10 text-violet-300 border-violet-400/20',
    prompts: [
      {
        id: 'smart-alerts-triage',
        label: 'Triage an alert',
        prompt: 'Triage this alert, explain why it matters, note the signal quality, and suggest the next actions I should take.',
      },
      {
        id: 'smart-alerts-watchlist',
        label: 'Build a watchlist',
        prompt: 'Group these alerts into a short watchlist with urgency, confidence, owner suggestions, and follow-up prompts.',
      },
    ],
  },
];

function getSelectedPrompt(selectedPromptId: string) {
  for (const section of ASSISTANT_SECTIONS) {
    const prompt = section.prompts.find((entry) => entry.id === selectedPromptId);
    if (prompt) {
      return { ...prompt, sectionTitle: section.title };
    }
  }

  const fallbackSection = ASSISTANT_SECTIONS[0];
  const fallbackPrompt = fallbackSection.prompts[0];
  return { ...fallbackPrompt, sectionTitle: fallbackSection.title };
}

export function CaddyAssistantPanel({
  disabled = false,
  hasActiveThread = false,
  onLaunchPrompt,
}: CaddyAssistantPanelProps) {
  const [selectedPromptId, setSelectedPromptId] = useState(ASSISTANT_SECTIONS[0].prompts[0].id);
  const selectedPrompt = getSelectedPrompt(selectedPromptId);

  return (
    <section className="rounded-2xl border border-border-subtle bg-[color:rgba(15,23,42,0.35)] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-sm md:p-5">
      <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple/20 bg-purple/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-purple">
            <Sparkles size={12} />
            AssistantCaddy
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">Guided assistant starters inside CaddyAI</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
              Pick a lane, review the starter text, and launch it in chat when you are ready.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-deep/60 px-3 py-2 text-xs leading-5 text-text-muted">
          Draft-only scaffold. No email send, scheduling, or alert delivery actions are triggered here.
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,320px)]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ASSISTANT_SECTIONS.map((section) => {
            const Icon = section.icon;

            return (
              <article
                key={section.id}
                className="rounded-xl border border-border-subtle bg-bg-primary/60 p-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                      section.iconClassName,
                    )}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary">{section.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">{section.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {section.prompts.map((prompt) => {
                    const isSelected = prompt.id === selectedPromptId;
                    return (
                      <button
                        key={prompt.id}
                        type="button"
                        onClick={() => setSelectedPromptId(prompt.id)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                          isSelected
                            ? 'border-purple/30 bg-purple/15 text-text-primary'
                            : 'border-border-subtle bg-bg-deep/60 text-text-secondary hover:border-purple/20 hover:text-text-primary',
                        )}
                      >
                        {prompt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs leading-5 text-text-muted">{section.guidance}</p>
              </article>
            );
          })}
        </div>

        <aside className="rounded-xl border border-accent-blue/20 bg-accent-blue/5 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-blue">Selected starter</div>
          <div className="mt-2 text-sm font-semibold text-text-primary">
            {selectedPrompt.sectionTitle}: {selectedPrompt.label}
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{selectedPrompt.prompt}</p>
          <p className="mt-4 text-xs leading-5 text-text-muted">
            Launching this starter opens it in CaddyAI so you can continue refining the response in chat.
          </p>
          <button
            type="button"
            onClick={() => void onLaunchPrompt(selectedPrompt.prompt)}
            disabled={disabled}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple px-3 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
          >
            {hasActiveThread ? 'Use in this chat' : 'Start in CaddyAI'}
            <ChevronRight size={14} />
          </button>
          <p className="mt-3 text-xs leading-5 text-text-muted">
            You can still free-type your own prompt. These starters are just a faster on-ramp.
          </p>
        </aside>
      </div>
    </section>
  );
}
