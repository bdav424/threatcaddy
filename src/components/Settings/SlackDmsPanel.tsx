// src/components/Settings/SlackDmsPanel.tsx
//
// Settings panel for connecting a Slack workspace and configuring DM alerts.
// OAuth runs through the Electron desktop bridge (getSlackBridge()). No-ops in
// browser / standalone mode with a friendly "desktop only" notice.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Loader2, LogOut, CheckCircle } from 'lucide-react';
import { getSlackBridge } from '../../lib/bridges';
import type { Settings } from '../../types';

interface SlackDmsPanelProps {
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => void;
}

export function SlackDmsPanel({ settings, onUpdateSettings }: SlackDmsPanelProps) {
  const { t } = useTranslation('slack');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bridge = getSlackBridge();
  const account = settings.slackAccount ?? null;

  async function handleConnect() {
    if (!bridge) return;
    setConnecting(true);
    setError(null);
    try {
      const result = await bridge.startOAuth();
      onUpdateSettings({ slackAccount: result });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!bridge || !account) return;
    try {
      await bridge.revoke(account.credRefId);
    } catch { /* credential may already be gone */ }
    onUpdateSettings({ slackAccount: null });
  }

  if (!bridge) {
    return (
      <p className="text-xs text-gray-500">{t('desktopOnly', 'Slack DM reading is only available in the ThreatCaddy Desktop app.')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {account ? (
        <div className="flex items-center justify-between rounded-lg bg-gray-800 border border-gray-700 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle size={14} className="shrink-0 text-green-400" aria-hidden />
            <div className="min-w-0">
              <div className="text-sm text-gray-200 truncate">
                {account.userName}
              </div>
              <div className="text-xs text-gray-400 truncate">{account.workspaceName}</div>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="ml-3 shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors"
            title={t('disconnect', 'Disconnect Slack')}
          >
            <LogOut size={13} aria-hidden />
            {t('disconnect', 'Disconnect')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: '#4A154B' }}
          >
            {connecting
              ? <Loader2 size={14} className="animate-spin" aria-hidden />
              : <MessageSquare size={14} aria-hidden />}
            {connecting ? t('connecting', 'Connecting…') : t('connectSlack', 'Connect Slack Workspace')}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <p className="text-xs text-gray-500">
            {t('connectHint', 'Opens a Slack OAuth window. Requires im:read, im:history, and users:read user scopes.')}
          </p>
        </div>
      )}

      {account && (
        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={settings.slackDmAlertsEnabled !== false}
              onChange={(e) => onUpdateSettings({ slackDmAlertsEnabled: e.target.checked })}
            />
            <span className="text-sm text-gray-300">{t('alertsEnabled', 'Show DM alerts in overlay panel')}</span>
          </label>

          {settings.slackDmAlertsEnabled !== false && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 shrink-0">
                {t('snoozeDuration', 'Snooze for')}
              </label>
              <select
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-accent"
                value={settings.slackDmSnoozeDuration ?? 2}
                onChange={(e) => onUpdateSettings({ slackDmSnoozeDuration: Number(e.target.value) })}
              >
                <option value={1}>{t('snooze1h', '1 hour')}</option>
                <option value={2}>{t('snooze2h', '2 hours')}</option>
                <option value={4}>{t('snooze4h', '4 hours')}</option>
                <option value={8}>{t('snooze8h', '8 hours')}</option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
