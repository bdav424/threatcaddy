import { useState } from 'react';
import { HardDriveDownload, Sparkles, Trash2 } from 'lucide-react';
import type { Note, Settings } from '../../types';
import { ExportImport } from './ExportImport';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { removeBgImage } from '../../lib/theme-bg';
import { useToast } from '../../contexts/ToastContext';

interface SystemHygienePanelProps {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  notes: Note[];
  onImportComplete: () => void;
}

type DangerActionId = 'assistant' | 'appearance' | 'background' | 'motion';

type DangerAction = {
  id: DangerActionId;
  title: string;
  description: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel: string;
};

const DANGER_ACTIONS: DangerAction[] = [
  {
    id: 'assistant',
    title: 'Reset AssistantCaddy layout',
    description: 'Clears the saved AssistantCaddy overview preferences and restores the default compact layout.',
    confirmTitle: 'Reset AssistantCaddy layout?',
    confirmMessage: 'This removes the saved AssistantCaddy overview preferences and restores the default layout modules.',
    confirmLabel: 'Reset layout',
  },
  {
    id: 'appearance',
    title: 'Reset appearance customizations',
    description: 'Restores the master theme defaults, removes saved custom theme tweaks, and clears the stored background image.',
    confirmTitle: 'Reset appearance customizations?',
    confirmMessage: 'This restores the built-in ThreatCaddy appearance defaults. Investigation content is not touched.',
    confirmLabel: 'Reset appearance',
  },
  {
    id: 'background',
    title: 'Clear background image',
    description: 'Removes the stored background image while leaving the rest of the theme and motion settings alone.',
    confirmTitle: 'Clear background image?',
    confirmMessage: 'This removes the stored background image from the local browser bucket.',
    confirmLabel: 'Clear image',
  },
  {
    id: 'motion',
    title: 'Disable ambient motion',
    description: 'Turns off the Odysseus-style background effect and frosted-glass shell while keeping color choices intact.',
    confirmTitle: 'Disable ambient motion?',
    confirmMessage: 'This turns off animated background effects and frosted panels, but keeps the current theme colors.',
    confirmLabel: 'Disable motion',
  },
];

const ASSISTANT_WIDGET_KEYS = [
  'threatcaddy-assistantcaddy-overview-widgets-v1',
  'assistantcaddy.widgets',
  'threatcaddy.assistant.widgets',
  'threatcaddy.assistantCaddy.widgets',
];

export function SystemHygienePanel({
  settings,
  onUpdateSettings,
  notes,
  onImportComplete,
}: SystemHygienePanelProps) {
  const { addToast } = useToast();
  const [pendingAction, setPendingAction] = useState<DangerAction | null>(null);
  const [runningActionId, setRunningActionId] = useState<DangerActionId | null>(null);

  const resetAppearance = async () => {
    await removeBgImage().catch(() => undefined);
    onUpdateSettings({
      colorScheme: 'indigo',
      customAppearanceThemes: [],
      appearanceFontFamily: undefined,
      appearanceFontTargets: undefined,
      appearanceFontScale: 100,
      sidebarAccentStyle: 'default',
      windowGlassTransparency: 0,
      windowGlassBlur: 0,
      bgImageEnabled: false,
      bgImageOpacity: 85,
      bgImagePosX: 50,
      bgImagePosY: 50,
      bgImageZoom: 100,
      bgImageBlur: 0,
      bgEffectPattern: 'none',
      bgEffectColor: undefined,
      bgEffectIntensity: 60,
      bgEffectSize: 100,
      frostedPanels: false,
    });
  };

  const clearBackground = async () => {
    await removeBgImage();
    onUpdateSettings({ bgImageEnabled: false });
  };

  const runDangerAction = async (action: DangerAction) => {
    setRunningActionId(action.id);
    try {
      switch (action.id) {
        case 'assistant':
          ASSISTANT_WIDGET_KEYS.forEach((key) => localStorage.removeItem(key));
          window.dispatchEvent(new CustomEvent('assistantcaddy:reset-widgets'));
          addToast('success', 'AssistantCaddy layout reset');
          break;
        case 'appearance':
          await resetAppearance();
          addToast('success', 'Appearance reset to ThreatCaddy defaults');
          break;
        case 'background':
          await clearBackground();
          addToast('success', 'Background image cleared');
          break;
        case 'motion':
          onUpdateSettings({
            bgEffectPattern: 'none',
            bgEffectColor: undefined,
            bgEffectIntensity: 60,
            bgEffectSize: 100,
            frostedPanels: false,
          });
          addToast('success', 'Ambient motion disabled');
          break;
      }
    } catch {
      addToast('error', 'System action failed');
    } finally {
      setRunningActionId(null);
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-700/70 bg-gray-900/40 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-green/20 bg-accent-green/10 text-accent-green">
            <HardDriveDownload size={18} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Data Backup</h3>
            <p className="mt-1 text-sm text-gray-400">
              Export or import the local ThreatCaddy workspace without leaving the settings surface.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-gray-800 bg-black/10 p-4">
          <ExportImport notes={notes} onImportComplete={onImportComplete} />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-700/70 bg-gray-900/40 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-blue/20 bg-accent-blue/10 text-accent-blue">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Quick Toggles</h3>
            <p className="mt-1 text-sm text-gray-400">
              Fast system-level switches for the new assistant chrome and Odysseus-inspired background controls.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <label className="flex items-start justify-between rounded-xl border border-gray-800 bg-black/10 px-4 py-3">
            <div className="pr-3">
              <div className="text-sm font-medium text-gray-100">Color-coded menu chips</div>
              <div className="mt-1 text-[11px] leading-5 text-gray-500">
                Apply the colored assistant menu treatment without opening the appearance lab.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.sidebarAccentStyle === 'color-chips'}
              onChange={(event) => onUpdateSettings({ sidebarAccentStyle: event.target.checked ? 'color-chips' : 'default' })}
              className="mt-1 rounded border-gray-600"
            />
          </label>

          <label className="flex items-start justify-between rounded-xl border border-gray-800 bg-black/10 px-4 py-3">
            <div className="pr-3">
              <div className="text-sm font-medium text-gray-100">Animated background</div>
              <div className="mt-1 text-[11px] leading-5 text-gray-500">
                Keep the ambient motion layer active from the Odysseus-style appearance controls.
              </div>
            </div>
            <input
              type="checkbox"
              checked={(settings.bgEffectPattern ?? 'none') !== 'none'}
              onChange={(event) => onUpdateSettings({ bgEffectPattern: event.target.checked ? 'swirls' : 'none' })}
              className="mt-1 rounded border-gray-600"
            />
          </label>

          <label className="flex items-start justify-between rounded-xl border border-gray-800 bg-black/10 px-4 py-3">
            <div className="pr-3">
              <div className="text-sm font-medium text-gray-100">Frosted shell</div>
              <div className="mt-1 text-[11px] leading-5 text-gray-500">
                Lift the shell and settings surfaces off the ambient background with a light glass treatment.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.frostedPanels ?? false}
              onChange={(event) => onUpdateSettings({ frostedPanels: event.target.checked })}
              className="mt-1 rounded border-gray-600"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-300">
            <Trash2 size={18} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-200">Danger Zone</h3>
            <p className="mt-1 text-sm text-gray-400">
              These actions are local-only. They reset UI state and appearance settings, not investigations, notes, or IOC data.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {DANGER_ACTIONS.map((action) => (
            <div key={action.id} className="flex items-center justify-between gap-4 rounded-xl border border-red-500/10 bg-black/10 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-100">{action.title}</div>
                <div className="mt-1 text-[11px] leading-5 text-gray-500">{action.description}</div>
              </div>
              <button
                type="button"
                onClick={() => setPendingAction(action)}
                disabled={runningActionId === action.id}
                className="shrink-0 rounded-xl border border-red-400/25 px-4 py-2 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/10 disabled:cursor-wait disabled:opacity-60"
              >
                {runningActionId === action.id ? 'Working…' : 'Reset'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={() => pendingAction && void runDangerAction(pendingAction)}
        title={pendingAction?.confirmTitle || 'Confirm action'}
        message={pendingAction?.confirmMessage || ''}
        confirmLabel={pendingAction?.confirmLabel || 'Confirm'}
        danger
      />
    </div>
  );
}
