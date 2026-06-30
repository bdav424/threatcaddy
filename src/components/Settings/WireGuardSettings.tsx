import { useState, useCallback, useEffect } from 'react';
import { Shield, RefreshCw, Plus, Wifi, WifiOff, Trash2, Route } from 'lucide-react';
import {
  isWireGuardAvailable,
  wgGetStatus,
  wgListPeers,
  wgRegisterMachine,
  wgGetRoutes,
  type WgPeer,
  type WgRoute,
  type WgStatus,
} from '../../lib/wireguard-bridge';
import {
  saveHeadscaleConfig,
  getHeadscaleConfig,
  clearHeadscaleConfig,
} from '../../lib/sync-bridge';

type Tab = 'peers' | 'routes' | 'register';

export function WireGuardSettings() {
  const available = isWireGuardAvailable();

  const [hsUrl, setHsUrl] = useState('');
  const [hsKey, setHsKey] = useState('');
  const [hsUrlSaved, setHsUrlSaved] = useState('');
  const [hsSaved, setHsSaved] = useState(false);

  const [status, setStatus] = useState<WgStatus | null>(null);
  const [peers, setPeers] = useState<WgPeer[]>([]);
  const [routes, setRoutes] = useState<WgRoute[]>([]);
  const [tab, setTab] = useState<Tab>('peers');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [regKey, setRegKey] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regBusy, setRegBusy] = useState(false);
  const [regResult, setRegResult] = useState<string | null>(null);

  // Load saved server URL on mount
  useEffect(() => {
    if (!available) return;
    void getHeadscaleConfig().then((cfg) => {
      if (cfg) setHsUrlSaved(cfg.serverUrl);
    });
  }, [available]);

  const refresh = useCallback(async () => {
    if (!available) return;
    setLoading(true);
    setError(null);
    try {
      const [st, peersRes, routesRes] = await Promise.all([
        wgGetStatus(),
        wgListPeers(),
        wgGetRoutes(),
      ]);
      setStatus(st);
      setPeers(peersRes.peers);
      setRoutes(routesRes.routes);
      if (!st.connected && st.configured) setError(st.error ?? 'Cannot reach Headscale server');
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setLoading(false);
    }
  }, [available]);

  useEffect(() => {
    if (!available) return;
    void refresh();
    const id = setInterval(() => { void refresh(); }, 30_000);
    return () => clearInterval(id);
  }, [available, refresh]);

  const handleSave = useCallback(async () => {
    const r = await saveHeadscaleConfig({ serverUrl: hsUrl.trim(), authKey: hsKey.trim() });
    if (r.ok) {
      setHsUrlSaved(hsUrl.trim());
      setHsKey('');
      setHsSaved(true);
      setTimeout(() => setHsSaved(false), 2500);
      void refresh();
    }
  }, [hsUrl, hsKey, refresh]);

  const handleClear = useCallback(async () => {
    await clearHeadscaleConfig();
    setHsUrlSaved('');
    setHsUrl('');
    setHsKey('');
    setStatus(null);
    setPeers([]);
    setRoutes([]);
  }, []);

  const handleRegister = useCallback(async () => {
    setRegBusy(true);
    setRegResult(null);
    try {
      const res = await wgRegisterMachine(regKey.trim(), regUser.trim());
      if (res.ok) {
        setRegResult(`Registered: ${res.machine?.name ?? 'unknown'}`);
        setRegKey('');
        setRegUser('');
        void refresh();
      } else {
        setRegResult(`Error: ${res.error}`);
      }
    } finally {
      setRegBusy(false);
    }
  }, [regKey, regUser, refresh]);

  if (!available) return null;

  return (
    <div className="border-t border-border-subtle pt-4 space-y-3">
      <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
        <Shield size={12} />
        WireGuard / Headscale
      </h4>

      {/* Config block */}
      <div className="space-y-2">
        <p className="text-[11px] text-text-muted">
          Connect via a Headscale-managed WireGuard overlay network. Auth key stored encrypted in OS keychain.
        </p>

        {hsUrlSaved && (
          <div className="flex items-center justify-between rounded bg-accent/5 border border-accent/20 px-2 py-1.5 text-xs">
            <span className="flex items-center gap-1.5">
              {status?.connected ? (
                <Wifi size={11} className="text-green-400" />
              ) : (
                <WifiOff size={11} className="text-text-muted" />
              )}
              <span className="text-text-muted">
                Server: <span className="text-text-primary font-mono">{hsUrlSaved}</span>
              </span>
              {status?.connected && (
                <span className="text-text-muted ml-1">({status.machineCount} machine{status.machineCount !== 1 ? 's' : ''})</span>
              )}
            </span>
            <button onClick={handleClear} className="text-red-400 hover:text-red-300">
              <Trash2 size={11} />
            </button>
          </div>
        )}

        <input
          type="url"
          value={hsUrl}
          onChange={(e) => setHsUrl(e.target.value)}
          placeholder="https://headscale.example.com"
          className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:border-accent/40 focus:outline-none"
        />
        <input
          type="password"
          value={hsKey}
          onChange={(e) => setHsKey(e.target.value)}
          placeholder="Headscale API key (write-only)"
          autoComplete="new-password"
          className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:border-accent/40 focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={!hsUrl.trim() || !hsKey.trim()}
          className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-40 transition-colors"
        >
          {hsSaved ? 'Saved!' : 'Save Headscale config'}
        </button>
      </div>

      {/* Live panel — only when configured */}
      {hsUrlSaved && (
        <div className="rounded-lg border border-border-subtle/60 bg-bg-primary/30 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-border-subtle/40 text-[11px]">
            {(['peers', 'routes', 'register'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 capitalize font-medium transition-colors ${
                  tab === t
                    ? 'text-accent border-b-2 border-accent -mb-px bg-accent/5'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {t === 'register' ? <Plus size={10} className="inline mr-1" /> : null}
                {t}
              </button>
            ))}
            <button
              onClick={() => { void refresh(); }}
              disabled={loading}
              className="ml-auto px-2 text-text-muted hover:text-text-primary"
              title="Refresh"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {error && (
            <div className="px-3 py-2 text-[11px] text-red-400">{error}</div>
          )}

          {/* Peers tab */}
          {tab === 'peers' && (
            <div className="divide-y divide-border-subtle/30">
              {peers.length === 0 ? (
                <p className="px-3 py-3 text-[11px] text-text-muted">No machines registered.</p>
              ) : (
                peers.map((p) => (
                  <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.online ? 'bg-green-400' : 'bg-text-muted/40'}`} />
                        <span className="text-[11px] font-medium text-text-primary truncate">{p.name}</span>
                        <span className="text-[10px] text-text-muted">({p.user})</span>
                      </div>
                      <div className="flex gap-1.5 mt-0.5 flex-wrap">
                        {p.ipAddresses.map((ip) => (
                          <code key={ip} className="text-[10px] text-text-secondary font-mono">{ip}</code>
                        ))}
                      </div>
                    </div>
                    <span className={`text-[10px] shrink-0 ${p.online ? 'text-green-400' : 'text-text-muted'}`}>
                      {p.online ? 'online' : 'offline'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Routes tab */}
          {tab === 'routes' && (
            <div className="divide-y divide-border-subtle/30">
              {routes.length === 0 ? (
                <p className="px-3 py-3 text-[11px] text-text-muted">No routes advertised.</p>
              ) : (
                routes.map((r) => (
                  <div key={r.id} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Route size={11} className="text-text-muted shrink-0" />
                      <code className="text-[11px] font-mono text-text-primary">{r.prefix}</code>
                      {r.machine && <span className="text-[10px] text-text-muted truncate">via {r.machine.name}</span>}
                    </div>
                    <div className="flex gap-1.5 shrink-0 text-[10px]">
                      {r.advertised && <span className="text-text-muted">advertised</span>}
                      {r.enabled && <span className="text-green-400">enabled</span>}
                      {r.isPrimary && <span className="text-accent">primary</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Register tab */}
          {tab === 'register' && (
            <div className="px-3 py-3 space-y-2">
              <p className="text-[11px] text-text-muted">Register a new machine by its WireGuard public key.</p>
              <input
                type="text"
                value={regKey}
                onChange={(e) => setRegKey(e.target.value)}
                placeholder="WireGuard machine public key"
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs font-mono text-text-primary placeholder-text-muted focus:border-accent/40 focus:outline-none"
              />
              <input
                type="text"
                value={regUser}
                onChange={(e) => setRegUser(e.target.value)}
                placeholder="Headscale user / namespace"
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:border-accent/40 focus:outline-none"
              />
              <button
                onClick={handleRegister}
                disabled={regBusy || !regKey.trim() || !regUser.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-40 transition-colors"
              >
                {regBusy && <RefreshCw size={10} className="animate-spin" />}
                Register machine
              </button>
              {regResult && (
                <p className={`text-[11px] ${regResult.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                  {regResult}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
