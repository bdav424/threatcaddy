import { useState, useCallback, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { nanoid } from 'nanoid';
import {
  isLanSyncAvailable,
  startLanSyncServer,
  stopLanSyncServer,
  getLanSyncStatus,
  type LanSyncStatus,
} from '../../lib/sync-bridge';
import { WireGuardSettings } from './WireGuardSettings';

function generateToken() {
  return nanoid(32);
}

export function LanSyncSettings() {
  const available = isLanSyncAvailable();
  const [status, setStatus] = useState<LanSyncStatus>({ running: false });
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    const s = await getLanSyncStatus();
    setStatus(s);
  }, []);

  useEffect(() => {
    if (!available) return;
    void refreshStatus();
    const id = setInterval(() => { void refreshStatus(); }, 5000);
    return () => clearInterval(id);
  }, [available, refreshStatus]);

  const handleToggle = useCallback(async () => {
    setBusy(true);
    try {
      if (status.running) {
        const s = await stopLanSyncServer();
        setStatus(s);
      } else {
        const t = token || generateToken();
        if (!token) setToken(t);
        const s = await startLanSyncServer({ token: t });
        setStatus(s);
      }
    } finally {
      setBusy(false);
    }
  }, [status.running, token]);

  if (!available) return null;

  return (
    <div className="space-y-4 rounded-xl border border-border-subtle/40 bg-bg-primary/40 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            <Wifi size={14} />
            LAN Sync
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Start a local HTTP server so mobile devices on the same network can push/pull encrypted backups.
            No internet connection used.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={busy}
          className={
            status.running
              ? 'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors'
              : 'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors'
          }
        >
          {busy ? <RefreshCw size={12} className="animate-spin" /> : status.running ? <WifiOff size={12} /> : <Wifi size={12} />}
          {status.running ? 'Stop' : 'Start'}
        </button>
      </div>

      {status.running && (
        <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-accent font-medium">
            <Wifi size={12} />
            Sync server active
          </div>
          <div className="text-xs text-text-muted font-mono">
            http://{status.lanIP ?? status.address}:{status.port}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <label className="text-[10px] text-text-muted shrink-0">Token</label>
            <code className="flex-1 truncate text-[10px] text-text-secondary font-mono bg-bg-surface rounded px-1.5 py-0.5">
              {showToken ? token : '••••••••••••••••••••••••••••••••'}
            </code>
            <button onClick={() => setShowToken(!showToken)} className="text-text-muted hover:text-text-primary">
              {showToken ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
            <button
              onClick={() => { void navigator.clipboard.writeText(token); }}
              className="text-[10px] text-accent hover:underline"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {!status.running && (
        <div className="space-y-1.5">
          <label className="text-xs text-text-muted">Sync token (leave blank to auto-generate)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Auto-generate on start"
              className="flex-1 min-w-0 rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs font-mono text-text-primary placeholder-text-muted focus:border-accent/40 focus:outline-none"
            />
            <button
              onClick={() => setToken(generateToken())}
              title="Generate new token"
              className="flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-surface px-2 py-1.5 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary"
            >
              <RefreshCw size={11} />
            </button>
          </div>
        </div>
      )}

      <WireGuardSettings />
    </div>
  );
}
