import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ExternalLink, Bell } from 'lucide-react';
import type { AlertItem } from '../../hooks/useAlertSchedule';
import type { Settings } from '../../types';

// ─── Animation keyframes (injected once as a <style> tag) ───────────────────

const KEYFRAMES = `
@keyframes tc-alert-pulse {
  0%, 100% { opacity: 1; box-shadow: var(--tc-alert-glow-base); }
  50% { opacity: 0.88; box-shadow: var(--tc-alert-glow-peak); }
}
@keyframes tc-alert-color-cycle {
  0%   { filter: hue-rotate(0deg); box-shadow: var(--tc-alert-glow-base); }
  50%  { filter: hue-rotate(180deg); box-shadow: var(--tc-alert-glow-peak); }
  100% { filter: hue-rotate(360deg); box-shadow: var(--tc-alert-glow-base); }
}
@keyframes tc-alert-strobe {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0.15; }
}
@keyframes tc-alert-wiggle {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-5px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}
@keyframes tc-alert-gradient-sweep {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes tc-alert-chasing-light {
  0%   { box-shadow: 0 -4px 20px 2px var(--tc-alert-glow-color), 0 0 0 0 transparent; }
  25%  { box-shadow: 4px 0 20px 2px var(--tc-alert-glow-color), 0 0 0 0 transparent; }
  50%  { box-shadow: 0 4px 20px 2px var(--tc-alert-glow-color), 0 0 0 0 transparent; }
  75%  { box-shadow: -4px 0 20px 2px var(--tc-alert-glow-color), 0 0 0 0 transparent; }
  100% { box-shadow: 0 -4px 20px 2px var(--tc-alert-glow-color), 0 0 0 0 transparent; }
}
`;

let keyframesInjected = false;
function ensureKeyframes() {
  if (keyframesInjected) return;
  keyframesInjected = true;
  const style = document.createElement('style');
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

// ─── Audio chime (Web Audio API — no audio files needed) ────────────────────

function playChime(urgency: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    // Higher urgency → lower, more urgent tone
    osc.frequency.value = urgency > 0.8 ? 440 : urgency > 0.5 ? 523 : 659;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
    osc.onended = () => ctx.close();
  } catch {
    // AudioContext may be blocked before first user gesture
  }
}

// ─── Color resolution ────────────────────────────────────────────────────────

function resolveGlowColor(
  colorMode: NonNullable<Settings['alertColorMode']>,
  customColor: string,
  urgency: number,
): string {
  switch (colorMode) {
    case 'monochrome':
      return 'rgba(255,255,255,0.85)';
    case 'custom':
      return customColor || 'var(--color-accent)';
    case 'severity-tier': {
      // interpolate green → amber → red based on urgency
      if (urgency < 0.33) return '#22c55e';   // green
      if (urgency < 0.66) return '#f59e0b';   // amber
      return '#ef4444';                        // red
    }
    default:
      return 'var(--color-accent)';
  }
}

// ─── Single alert card ───────────────────────────────────────────────────────

interface AlertCardProps {
  item: AlertItem;
  animation: NonNullable<Settings['alertAnimation']>;
  colorMode: NonNullable<Settings['alertColorMode']>;
  customColor: string;
  strobeOptIn: boolean;
  reducedMotion: boolean;
  onDismiss: () => void;
  onJoin: () => void;
}

function AlertCard({
  item,
  animation,
  colorMode,
  customColor,
  strobeOptIn,
  reducedMotion,
  onDismiss,
  onJoin,
}: AlertCardProps) {
  const { t } = useTranslation('alerts');
  const { urgency, minutesUntilStart, event } = item;

  const glowColor = resolveGlowColor(colorMode, customColor, urgency);
  const glowBase = `0 0 ${8 + urgency * 16}px 2px ${glowColor}40, 0 0 ${4 + urgency * 8}px 1px ${glowColor}60`;
  const glowPeak = `0 0 ${16 + urgency * 24}px 4px ${glowColor}70, 0 0 ${8 + urgency * 16}px 2px ${glowColor}90`;

  // Base animation speed — faster as urgency increases
  const baseDurationMs = Math.round(3000 - urgency * 2200); // 3000ms → 800ms

  // Resolve which animation to actually use
  const effectiveAnimation = (() => {
    if (reducedMotion) return 'none';
    if (animation === 'strobe' && !strobeOptIn) return 'pulse';
    if (animation === 'strobe' && strobeOptIn) return 'strobe';
    return animation;
  })();

  const animStyle = (): React.CSSProperties => {
    const vars = {
      '--tc-alert-glow-base': glowBase,
      '--tc-alert-glow-peak': glowPeak,
      '--tc-alert-glow-color': glowColor,
    } as React.CSSProperties;

    switch (effectiveAnimation) {
      case 'pulse':
        return {
          ...vars,
          animation: `tc-alert-pulse ${baseDurationMs}ms ease-in-out infinite`,
          boxShadow: glowBase,
        };
      case 'color-cycle':
        return {
          ...vars,
          animation: `tc-alert-color-cycle ${baseDurationMs * 2}ms linear infinite`,
          boxShadow: glowBase,
        };
      case 'strobe':
        // WCAG 2.3.1: keep below 3 flashes/sec (333ms min period)
        return {
          ...vars,
          animation: `tc-alert-strobe ${Math.max(350, baseDurationMs / 2)}ms step-end infinite`,
        };
      case 'wiggle':
        return {
          ...vars,
          animation: `tc-alert-wiggle ${Math.max(400, baseDurationMs)}ms ease-in-out infinite`,
          boxShadow: glowBase,
        };
      case 'gradient-sweep':
        return {
          ...vars,
          backgroundImage: `linear-gradient(135deg, ${glowColor}22, ${glowColor}44, ${glowColor}22)`,
          backgroundSize: '200% 200%',
          animation: `tc-alert-gradient-sweep ${baseDurationMs * 1.5}ms ease infinite`,
          boxShadow: glowBase,
        };
      case 'chasing-light':
        return {
          ...vars,
          animation: `tc-alert-chasing-light ${baseDurationMs}ms linear infinite`,
        };
      default:
        return { ...vars, boxShadow: glowBase };
    }
  };

  const mins = Math.ceil(minutesUntilStart);
  const timeLabel = minutesUntilStart <= 0
    ? t('timeNow')
    : mins === 1
    ? t('timeOneMinute')
    : t('timeMinutes', { count: mins });

  const hasJoinUrl = Boolean(event.conferenceUrl);

  return (
    <div
      className="relative rounded-xl border border-white/10 bg-gray-900/90 backdrop-blur-md px-4 py-3 flex gap-3 items-start"
      style={animStyle()}
      role="alert"
      aria-live="polite"
    >
      <Bell
        className="mt-0.5 shrink-0"
        size={16}
        style={{ color: glowColor }}
        aria-hidden
      />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{event.title}</div>
        <div className="text-xs mt-0.5" style={{ color: glowColor }}>
          {timeLabel}
          {event.conferenceApp ? ` · ${event.conferenceApp}` : ''}
        </div>
        {event.location && !event.conferenceApp && (
          <div className="text-xs text-gray-400 mt-0.5 truncate">{event.location}</div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {hasJoinUrl && (
          <button
            onClick={onJoin}
            className="rounded-lg px-2 py-1 text-xs font-medium text-white transition-colors"
            style={{ background: `${glowColor}33`, border: `1px solid ${glowColor}55` }}
            title={t('joinMeeting')}
          >
            <ExternalLink size={12} className="inline mr-1" aria-hidden />
            {t('join')}
          </button>
        )}
        <button
          onClick={onDismiss}
          className="rounded-lg p-1 text-gray-400 hover:text-white transition-colors"
          title={t('dismiss')}
          aria-label={t('dismiss')}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export interface AlertGlowPanelProps {
  items: AlertItem[];
  settings: Pick<
    Settings,
    | 'alertAnimation'
    | 'alertColorMode'
    | 'alertCustomColor'
    | 'alertChime'
    | 'strobeExplicitOptIn'
  >;
  onDismiss: (meetingId: string) => void;
  onAcknowledge: (meetingId: string) => void;
}

export function AlertGlowPanel({ items, settings, onDismiss, onAcknowledge }: AlertGlowPanelProps) {
  const animation = settings.alertAnimation ?? 'pulse';
  const colorMode = settings.alertColorMode ?? 'theme';
  const customColor = settings.alertCustomColor ?? '';
  const chimeEnabled = settings.alertChime ?? false;
  const strobeOptIn = settings.strobeExplicitOptIn ?? false;

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    ensureKeyframes();
  }, []);

  // Chime when a new item appears or urgency crosses a phase boundary
  const prevItemsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!chimeEnabled) return;
    const prevIds = prevItemsRef.current;
    const newItems = items.filter((i) => !prevIds.includes(`${i.meetingId}:${i.phase}`));
    if (newItems.length > 0) {
      const maxUrgency = Math.max(...newItems.map((i) => i.urgency));
      playChime(maxUrgency);
    }
    prevItemsRef.current = items.map((i) => `${i.meetingId}:${i.phase}`);
  }, [items, chimeEnabled]);

  const handleJoin = useCallback(
    (item: AlertItem) => {
      if (item.event.conferenceUrl) {
        window.open(item.event.conferenceUrl, '_blank', 'noopener,noreferrer');
      }
      onAcknowledge(item.meetingId);
    },
    [onAcknowledge],
  );

  if (items.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 w-80 pointer-events-none"
      aria-label="Meeting alerts"
    >
      {items.map((item) => (
        <div key={item.meetingId} className="pointer-events-auto">
          <AlertCard
            item={item}
            animation={animation}
            colorMode={colorMode}
            customColor={customColor}
            strobeOptIn={strobeOptIn}
            reducedMotion={reducedMotion}
            onDismiss={() => onDismiss(item.meetingId)}
            onJoin={() => handleJoin(item)}
          />
        </div>
      ))}
    </div>
  );
}
