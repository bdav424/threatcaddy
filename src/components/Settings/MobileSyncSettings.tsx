import { useState, useEffect, useRef, useCallback } from 'react';
import { Smartphone, RefreshCw, CheckCircle2, AlertCircle, Clock, Eye, EyeOff, ToggleLeft, ToggleRight } from 'lucide-react';
import { syncNow, isLanSyncAvailable } from '../../lib/sync-bridge';
import type { SyncResult } from '../../lib/sync-bridge';

const STORAGE_KEY = 'tc-mobile-sync-config';
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface MobileSyncConfig {
  host: string;   // IP:port, e.g. 192.168.1.100:7463
  token: string;
  autoSync: boolean;
}

function loadConfig(): MobileSyncConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { host: '', token: '', autoSync: false, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { host: '', token: '', autoSync: false };
}

function saveConfig(cfg: MobileSyncConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MobileSyncSettingsCore() {
  const [host, setHost] = useState(() => loadConfig().host);
  const [token, setToken] = useState(() => loadConfig().token);
  const [autoSync, setAutoSync] = useState(() => loadConfig().autoSync);
  const [showToken, setShowToken] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist config changes to localStorage
  useEffect(() => {
    saveConfig({ host, token, autoSync });
  }, [host, token, autoSync]);

  const handleSync = useCallback(async () => {
    const h = host.trim();
    const t = token.trim();
    if (!h || !t) return;
    setSyncing(true);
    setError(null);
    try {
      const url = h.startsWith('http') ? h : `http://${h}`;
      const result = await syncNow(url, t);
      setLastResult(result);
      setLastSyncTime(new Date());
    } catch (err) {
      setError((err as Error).message ?? 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [host, token]);

  // Auto-sync interval — only fires when the document is visible
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!autoSync || !host.trim() || !token.trim()) return;

    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') void handleSync();
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoSync, host, token, handleSync]);

  const canSync = host.trim().length > 0 && token.trim().length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-border-subtle/40 bg-bg-primary/40 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            <Smartphone size={14} />
            Desktop Sync
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Connect to the ThreatCaddy desktop app on your local network to sync investigation data.
            No internet connection required.
          </p>
        </div>
      </div>

      {/* Connection inputs */}
      <div className="space-y-2">
        <div>
          <label className="text-[10px] font-medium text-text-muted uppercase tracking-wide mb-1 block">
            Desktop IP:port
          </label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.1.100:7463"
            className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs font-mono text-text-primary placeholder-text-muted focus:border-accent/40 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-text-muted uppercase tracking-wide mb-1 block">
            Sync token
          </label>
          <div className="flex gap-1.5">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token from desktop Settings › LAN Sync"
              autoComplete="new-password"
              className="flex-1 min-w-0 rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs font-mono text-text-primary placeholder-text-muted focus:border-accent/40 focus:outline-none"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="rounded-lg border border-border-subtle bg-bg-surface px-2 py-1.5 text-text-muted hover:text-text-primary"
            >
              {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* Sync now button */}
      <button
        onClick={() => void handleSync()}
        disabled={!canSync || syncing}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/15 px-4 py-2 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {syncing ? <RefreshCw size={12} className="animate-spin" /> : <Smartphone size={12} />}
        {syncing ? 'Syncing…' : 'Sync now'}
      </button>

      {/* Auto-sync toggle */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-text-primary">Auto-sync</span>
          <p className="text-[10px] text-text-muted">Sync every 5 minutes when app is in foreground</p>
        </div>
        <button
          onClick={() => setAutoSync(!autoSync)}
          disabled={!canSync}
          className="text-accent disabled:opacity-40"
          aria-label="Toggle auto-sync"
        >
          {autoSync ? <ToggleRight size={22} /> : <ToggleLeft size={22} className="text-text-muted" />}
        </button>
      </div>

      {/* Result / status */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {lastResult && !error && (
        <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <CheckCircle2 size={12} />
            Sync complete
          </div>
          <div className="flex gap-3 text-[11px] text-text-muted font-mono">
            <span><span className="text-text-primary">{lastResult.added}</span> added</span>
            <span><span className="text-text-primary">{lastResult.updated}</span> updated</span>
            <span><span className="text-text-primary">{lastResult.skipped}</span> unchanged</span>
          </div>
          {lastResult.errors.length > 0 && (
            <p className="text-[10px] text-yellow-400">{lastResult.errors.length} table error(s)</p>
          )}
        </div>
      )}

      {lastSyncTime && (
        <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <Clock size={10} />
          Last synced at {formatTime(lastSyncTime)}
          {autoSync && <span className="ml-1 text-accent">(auto)</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Mobile/PWA-only sync settings panel.
 * Self-hides when running inside the Electron desktop (LAN sync bridge present)
 * since the desktop has the LAN sync server, not the client.
 */
export function MobileSyncSettings() {
  // In Electron, the app IS the desktop server — the mobile sync client panel is irrelevant.
  if (isLanSyncAvailable()) return null;
  return <MobileSyncSettingsCore />;
}
