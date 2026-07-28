import { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, Shuffle, RotateCcw, Sparkles } from 'lucide-react';
import type { AmbientAssistantCharacter, Settings } from '../../types';
import { AMBIENT_MASCOTS, getMascot, resolveConfig, Mascot, type MascotSlot, type MascotConfig } from './mascots';

/**
 * Settings → AI mascot studio (experimental). Pick a character, then customize
 * it paper-doll style: the chosen mascot sits centered with its feature slots
 * arranged as arrow steppers down each side — click ◀ / ▶ to cycle glasses,
 * hats, held items, colors, and the mascot updates live. Choices persist per
 * character, so switching away and back keeps each build.
 */

interface MascotPickerProps {
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => void;
}

export function MascotPicker({ settings, onUpdateSettings }: MascotPickerProps) {
  const enabled = settings.ambientAssistantEnabled ?? false;
  const selected = (settings.ambientAssistantCharacter ?? 'edgar') as AmbientAssistantCharacter;
  const tipsEnabled = settings.ambientAssistantTips ?? true;
  const [hoverPreview, setHoverPreview] = useState(false);

  const def = getMascot(selected);
  const config = resolveConfig(selected, settings.ambientAssistantCustomizations?.[selected]);

  const writeConfig = useCallback((next: MascotConfig) => {
    onUpdateSettings({
      ambientAssistantEnabled: true,
      ambientAssistantCustomizations: {
        ...(settings.ambientAssistantCustomizations || {}),
        [selected]: next,
      },
    });
  }, [onUpdateSettings, selected, settings.ambientAssistantCustomizations]);

  const cycle = useCallback((slot: MascotSlot, dir: 1 | -1) => {
    const cur = config[slot.id] ?? slot.options[0].id;
    const idx = Math.max(0, slot.options.findIndex((o) => o.id === cur));
    const next = slot.options[(idx + dir + slot.options.length) % slot.options.length];
    writeConfig({ ...config, [slot.id]: next.id });
  }, [config, writeConfig]);

  const randomize = useCallback(() => {
    const next: MascotConfig = {};
    for (const slot of def.slots) next[slot.id] = slot.options[Math.floor(Math.random() * slot.options.length)].id;
    writeConfig(next);
  }, [def.slots, writeConfig]);

  const reset = useCallback(() => writeConfig({ ...def.defaults }), [def.defaults, writeConfig]);

  const mid = Math.ceil(def.slots.length / 2);
  const leftSlots = def.slots.slice(0, mid);
  const rightSlots = def.slots.slice(mid);

  const stepper = (slot: MascotSlot, side: 'left' | 'right') => {
    const cur = config[slot.id] ?? slot.options[0].id;
    const opt = slot.options.find((o) => o.id === cur) ?? slot.options[0];
    return (
      <div key={slot.id} className="flex items-center gap-1.5">
        {side === 'right' && (
          <StepBtn label={`Previous ${slot.label}`} onClick={() => cycle(slot, -1)}><ChevronLeft size={15} /></StepBtn>
        )}
        <div className="min-w-0 flex-1 rounded-md border border-gray-700/70 bg-gray-800/60 px-2 py-1 text-left">
          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-500">{slot.label}</div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-200">
            {slot.type === 'color' && (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20" style={{ background: opt.swatch }} />
            )}
            <span className="truncate">{opt.label}</span>
          </div>
        </div>
        {side === 'left' && (
          <StepBtn label={`Next ${slot.label}`} onClick={() => cycle(slot, 1)}><ChevronRight size={15} /></StepBtn>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/25 p-3" aria-label="Ambient assistant">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">
            <Sparkles size={13} /> Ambient assistant
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-medium tracking-normal text-accent">Experimental</span>
          </h4>
          <p className="mt-1 text-[11px] leading-5 text-gray-500">
            A friendly desk companion. Pick a character, then click the arrows to dress it up. Passive and
            dismissible — it only speaks when you click it.
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input type="checkbox" className="peer sr-only" checked={enabled}
            onChange={(e) => onUpdateSettings({ ambientAssistantEnabled: e.target.checked })} />
          <div className="h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-accent peer-checked:after:translate-x-4" />
        </label>
      </div>

      {/* character selector */}
      <div className={`flex flex-wrap gap-2 ${enabled ? '' : 'pointer-events-none opacity-45'}`}>
        {AMBIENT_MASCOTS.map((m) => {
          const isSel = m.id === selected;
          return (
            <button key={m.id} type="button"
              onClick={() => onUpdateSettings({ ambientAssistantCharacter: m.id, ambientAssistantEnabled: true })}
              aria-pressed={isSel}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-colors ${isSel ? 'border-accent bg-accent/10' : 'border-gray-800 bg-gray-800/40 hover:border-gray-600'}`}
              style={isSel ? { borderColor: m.accent } : undefined}>
              <Mascot character={m.id} config={settings.ambientAssistantCustomizations?.[m.id]} size={26} title={m.name} />
              <span className="text-xs font-semibold text-gray-200">{m.name}</span>
            </button>
          );
        })}
      </div>

      {/* studio: steppers flank the live preview */}
      <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/40 p-3 ${enabled ? '' : 'pointer-events-none opacity-45'}`}>
        <div className="space-y-2">{leftSlots.map((s) => stepper(s, 'left'))}</div>
        <div
          className="flex flex-col items-center"
          onMouseEnter={() => setHoverPreview(true)}
          onMouseLeave={() => setHoverPreview(false)}
        >
          <div className="rounded-xl bg-gradient-to-b from-gray-800/50 to-gray-900/50 px-2 py-1">
            <Mascot character={selected} config={config} size={116} waving={hoverPreview} title={def.name} />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <button type="button" onClick={randomize} title="Surprise me"
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-gray-400 hover:text-gray-200">
              <Shuffle size={12} /> Random
            </button>
            <button type="button" onClick={reset} title="Reset to default"
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-gray-400 hover:text-gray-200">
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </div>
        <div className="space-y-2">{rightSlots.map((s) => stepper(s, 'right'))}</div>
      </div>

      <label className={`flex items-center gap-2 text-[11px] text-gray-400 ${enabled ? '' : 'pointer-events-none opacity-45'}`}>
        <input type="checkbox" checked={tipsEnabled}
          onChange={(e) => onUpdateSettings({ ambientAssistantTips: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-accent focus:ring-0" />
        Let {def.name} share the occasional tip when clicked
      </label>
    </section>
  );
}

function StepBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-300 transition-colors hover:border-accent hover:text-accent active:scale-95">
      {children}
    </button>
  );
}
