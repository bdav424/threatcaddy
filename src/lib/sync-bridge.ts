/**
 * LAN sync bridge — IPC wrapper for the desktop sync server.
 * Only callable in the Electron desktop build (window.threatcaddyLanSync present).
 * No fetch/WebSocket/exec here — all calls go through contextBridge IPC.
 */

export interface LanSyncStatus {
  running: boolean;
  address?: string;
  port?: number;
  lanIP?: string;
  error?: string;
}

export interface HeadscaleConfig {
  serverUrl: string;
  authKey: string;
}

function bridge() {
  return (typeof window !== 'undefined' && 'threatcaddyLanSync' in window)
    ? (window as unknown as Record<string, ThreatCaddyLanSyncAPI>).threatcaddyLanSync
    : null;
}

export function isLanSyncAvailable(): boolean {
  return bridge() !== null;
}

export async function startLanSyncServer(opts: { port?: number; token: string }): Promise<LanSyncStatus> {
  const b = bridge();
  if (!b) return { running: false, error: 'LAN sync not available (desktop only)' };
  return b.start(opts);
}

export async function stopLanSyncServer(): Promise<LanSyncStatus> {
  const b = bridge();
  if (!b) return { running: false };
  return b.stop();
}

export async function getLanSyncStatus(): Promise<LanSyncStatus> {
  const b = bridge();
  if (!b) return { running: false };
  return b.status();
}

export async function saveHeadscaleConfig(cfg: HeadscaleConfig): Promise<{ ok: boolean; reason?: string }> {
  const b = bridge();
  if (!b) return { ok: false, reason: 'desktop only' };
  return b.saveHeadscale(cfg);
}

export async function getHeadscaleConfig(): Promise<{ serverUrl: string } | null> {
  const b = bridge();
  if (!b) return null;
  return b.getHeadscale();
}

export async function clearHeadscaleConfig(): Promise<{ ok: boolean }> {
  const b = bridge();
  if (!b) return { ok: false };
  return b.clearHeadscale();
}

// Global type — declared here to avoid polluting env.d.ts with too much detail
interface ThreatCaddyLanSyncAPI {
  start: (opts: { port?: number; token: string }) => Promise<LanSyncStatus>;
  stop: () => Promise<LanSyncStatus>;
  status: () => Promise<LanSyncStatus>;
  saveHeadscale: (cfg: HeadscaleConfig) => Promise<{ ok: boolean; reason?: string }>;
  getHeadscale: () => Promise<{ serverUrl: string } | null>;
  clearHeadscale: () => Promise<{ ok: boolean }>;
}
