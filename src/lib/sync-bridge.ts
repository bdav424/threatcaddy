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
  // Bidirectional IPC for snapshot export/import (main → renderer)
  onRequestExport?: (cb: (reqId: string) => void) => void;
  onRequestImport?: (cb: (reqId: string, snapshot: SyncSnapshot, strategy: string) => void) => void;
  respondExport?: (reqId: string, snapshot: SyncSnapshot | null) => void;
  respondImport?: (reqId: string, result: SyncResult) => void;
}

// Re-export snapshot types so callers only need one import.
export type { SyncSnapshot, SyncResult } from './lan-sync-engine';
import type { SyncSnapshot, SyncResult } from './lan-sync-engine';

// ── Renderer-side snapshot helpers ───────────────────────────────────────────

/**
 * Export all Dexie tables as a LAN sync snapshot.
 * Works in both Electron and PWA contexts.
 */
export async function getSyncSnapshot(): Promise<SyncSnapshot> {
  const { exportSyncSnapshot } = await import('./lan-sync-engine');
  return exportSyncSnapshot();
}

/**
 * Import a remote snapshot into local Dexie.
 * Works in both Electron and PWA contexts.
 */
export async function importLanSnapshot(
  remote: SyncSnapshot,
  strategy: 'newer-wins' | 'remote-wins' = 'newer-wins',
): Promise<SyncResult> {
  const { importSyncSnapshot } = await import('./lan-sync-engine');
  return importSyncSnapshot(remote, strategy);
}

/**
 * Full bidirectional sync with a desktop LAN server.
 * Called by the mobile PWA — not available in Electron (use the server directly).
 *
 * Flow:
 *  1. GET  {targetUrl}/sync  → pull desktop snapshot → merge into local Dexie
 *  2. POST {targetUrl}/sync  → push local snapshot → desktop merges it
 *
 * @param targetUrl Full URL of the desktop sync server, e.g. http://192.168.1.5:7463
 * @param token     Bearer token set on the desktop server
 */
export async function syncNow(targetUrl: string, token: string): Promise<SyncResult> {
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Pull desktop snapshot and merge into local Dexie
  const remoteResp = await fetch(`${targetUrl}/sync`, { headers: authHeaders });
  if (!remoteResp.ok) {
    throw new Error(`Desktop sync server returned ${remoteResp.status}`);
  }
  const remote = (await remoteResp.json()) as SyncSnapshot;
  const result = await importLanSnapshot(remote, 'newer-wins');

  // Push local snapshot to desktop so it can merge our changes
  const local = await getSyncSnapshot();
  await fetch(`${targetUrl}/sync`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(local),
  });

  return result;
}

// ── Bidirectional IPC handlers (Electron desktop renderer only) ───────────────
// Register once at module load so the LAN sync server can call into Dexie
// without the renderer needing to poll or the user needing to click anything.
;(function registerLanSyncIpcHandlers() {
  if (typeof window === 'undefined') return;
  const b = bridge();
  if (!b || !b.onRequestExport || !b.respondExport || !b.onRequestImport || !b.respondImport) return;

  const { respondExport, respondImport, onRequestExport, onRequestImport } = b;

  onRequestExport(async (reqId) => {
    try {
      const { exportSyncSnapshot } = await import('./lan-sync-engine');
      respondExport(reqId, await exportSyncSnapshot());
    } catch {
      respondExport(reqId, null);
    }
  });

  onRequestImport(async (reqId, snapshot, strategy) => {
    try {
      const { importSyncSnapshot } = await import('./lan-sync-engine');
      respondImport(reqId, await importSyncSnapshot(snapshot, strategy as 'newer-wins' | 'remote-wins'));
    } catch {
      respondImport(reqId, { added: 0, updated: 0, skipped: 0, errors: ['import failed'] });
    }
  });
})();
