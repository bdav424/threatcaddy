import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { AmbientAssistantCharacter } from '../../types';
import { getMascot, Mascot, type MascotConfig } from './mascots';

/**
 * The floating ambient assistant — a Clippy-style desk companion.
 *
 * SCOPE (experimental): this is the *character + personality* layer only. It is
 * deliberately passive: it never grabs focus, surfaces only when the operator
 * clicks it, and is dismissible. The grounded, investigation-aware suggestion
 * engine ("the good Clippy" — see caddyai-analyst-suggestions FUTURE spec) is a
 * separate capability; the rotating quips here are flavor placeholders, not real
 * analysis. Off by default; enabled + chosen in Settings → AI.
 */

interface AmbientAssistantProps {
  enabled?: boolean;
  character?: AmbientAssistantCharacter;
  config?: MascotConfig;
  tipsEnabled?: boolean;
  /** Called when the operator hides the companion from the bubble. */
  onDisable?: () => void;
}

export function AmbientAssistant({ enabled, character, config, tipsEnabled = true, onDisable }: AmbientAssistantProps) {
  const mascot = getMascot(character);
  const { name, tips, accent } = mascot;

  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [waving, setWaving] = useState(false);
  const greetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A brief signature flourish shortly after the mascot appears — a greeting,
  // not a recurring interruption.
  useEffect(() => {
    if (!enabled) return;
    setWaving(true);
    greetTimer.current = setTimeout(() => setWaving(false), 2200);
    return () => clearTimeout(greetTimer.current);
  }, [enabled, character]);

  const nextTip = useCallback(() => {
    setTipIndex((i) => (i + 1) % Math.max(tips.length, 1));
  }, [tips.length]);

  const handleMascotClick = useCallback(() => {
    setBubbleOpen((open) => {
      if (!open && tipsEnabled) nextTip();
      return !open;
    });
    setWaving(true);
    setTimeout(() => setWaving(false), 1400);
  }, [nextTip, tipsEnabled]);

  if (!enabled) return null;

  return (
    <div className="ambient-assistant" data-character={character}>
      {bubbleOpen && (
        <div className="ambient-assistant-bubble" style={{ ['--aa-accent' as string]: accent }} role="status">
          <button
            className="ambient-assistant-bubble-close"
            onClick={() => setBubbleOpen(false)}
            aria-label="Close message"
          >
            <X size={12} />
          </button>
          <p className="ambient-assistant-bubble-name">{name}</p>
          <p className="ambient-assistant-bubble-text">
            {tipsEnabled ? tips[tipIndex] : `Hi, I’m ${name}. I’ll keep you company while you work.`}
          </p>
          <div className="ambient-assistant-bubble-actions">
            {tipsEnabled && tips.length > 1 && (
              <button className="ambient-assistant-bubble-btn" onClick={nextTip}>Another</button>
            )}
            {onDisable && (
              <button
                className="ambient-assistant-bubble-btn ambient-assistant-bubble-btn-muted"
                onClick={() => { setBubbleOpen(false); onDisable(); }}
              >
                Hide
              </button>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        className={`ambient-assistant-mascot${waving ? ' is-waving' : ''}`}
        onClick={handleMascotClick}
        onMouseEnter={() => setWaving(true)}
        onMouseLeave={() => setWaving(false)}
        aria-label={`${name}, your ambient assistant. Click for a tip.`}
        title={name}
      >
        <Mascot character={character ?? 'edgar'} config={config} size={64} waving={waving} title={name} />
      </button>
    </div>
  );
}
