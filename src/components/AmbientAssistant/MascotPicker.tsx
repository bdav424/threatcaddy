import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { AmbientAssistantCharacter, Settings } from '../../types';
import { AMBIENT_MASCOTS } from './mascots';

/**
 * Settings → AI control for the experimental ambient assistant. Lets the
 * operator turn the desk companion on (off by default) and pick a character.
 * Each card previews the live mascot SVG and plays its signature flourish on
 * hover so the choice is made by seeing the animation, not reading a name.
 */

interface MascotPickerProps {
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => void;
}

export function MascotPicker({ settings, onUpdateSettings }: MascotPickerProps) {
  const enabled = settings.ambientAssistantEnabled ?? false;
  const selected = settings.ambientAssistantCharacter ?? 'edgar';
  const tipsEnabled = settings.ambientAssistantTips ?? true;
  const [hovered, setHovered] = useState<AmbientAssistantCharacter | null>(null);

  return (
    <section className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/25 p-3" aria-label="Ambient assistant">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">
            <Sparkles size={13} /> Ambient assistant
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-medium tracking-normal text-accent">Experimental</span>
          </h4>
          <p className="mt-1 text-[11px] leading-5 text-gray-500">
            A friendly desk companion that keeps you company while you work. Passive and dismissible — it
            only speaks when you click it. Pick your character below.
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={enabled}
            onChange={(e) => onUpdateSettings({ ambientAssistantEnabled: e.target.checked })}
          />
          <div className="h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-accent peer-checked:after:translate-x-4" />
        </label>
      </div>

      <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-4 ${enabled ? '' : 'pointer-events-none opacity-45'}`}>
        {AMBIENT_MASCOTS.map((mascot) => {
          const isSelected = selected === mascot.id && enabled;
          const showWave = hovered === mascot.id;
          return (
            <button
              key={mascot.id}
              type="button"
              onClick={() => onUpdateSettings({ ambientAssistantCharacter: mascot.id, ambientAssistantEnabled: true })}
              onMouseEnter={() => setHovered(mascot.id)}
              onMouseLeave={() => setHovered((h) => (h === mascot.id ? null : h))}
              aria-pressed={isSelected}
              className={`group flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-colors ${
                isSelected
                  ? 'border-accent bg-accent/10'
                  : 'border-gray-800 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/70'
              }`}
              style={isSelected ? { borderColor: mascot.accent } : undefined}
            >
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: `radial-gradient(circle at 50% 40%, ${mascot.accent}22, transparent 70%)` }}
              >
                <mascot.Component size={54} waving={showWave} title={mascot.name} />
              </span>
              <span className="text-xs font-semibold text-gray-200">{mascot.name}</span>
              <span className="text-[10px] leading-tight text-gray-500">{mascot.tagline}</span>
            </button>
          );
        })}
      </div>

      <label className={`flex items-center gap-2 text-[11px] text-gray-400 ${enabled ? '' : 'pointer-events-none opacity-45'}`}>
        <input
          type="checkbox"
          checked={tipsEnabled}
          onChange={(e) => onUpdateSettings({ ambientAssistantTips: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-accent focus:ring-0"
        />
        Let {AMBIENT_MASCOTS.find((m) => m.id === selected)?.name ?? 'the assistant'} share the occasional tip when clicked
      </label>
    </section>
  );
}
