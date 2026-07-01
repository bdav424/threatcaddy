/**
 * WireGuard / Headscale bridge for ThreatCaddy desktop.
 *
 * All Headscale API calls go through Electron's `net` module.
 * No exec/shell — zero subprocess spawning.
 * Auth key is read from safeStorage (written by lansync:save-headscale);
 * it never crosses the IPC boundary to the renderer.
 *
 * IPC channels (all invoke-based):
 *   wg:get-status          → WgStatus
 *   wg:list-peers          → WgPeer[]
 *   wg:register-machine    → { ok, machine? }  (requires machineKey + user)
 *   wg:get-routes          → WgRoute[]
 */

import { app, ipcMain, net, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const HEADSCALE_KEY_FILE = path.join(app.getPath('userData'), 'headscale-config.enc');

// ─── Headscale config ─────────────────────────────────────────────────────

function loadConfig() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = fs.readFileSync(HEADSCALE_KEY_FILE);
    const parsed = JSON.parse(safeStorage.decryptString(encrypted));
    const serverUrl = (parsed.serverUrl ?? '').replace(/\/$/, '');
    const authKey   = parsed.authKey ?? '';
    if (!serverUrl || !authKey) return null;
    return { serverUrl, authKey };
  } catch {
    return null;
  }
}

// ─── HTTP helper (Electron net module only) ───────────────────────────────

function headscaleRequest(serverUrl, authKey, method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const url = `${serverUrl}/api/v1${apiPath}`;
    const req = net.request({ method, url });
    req.setHeader('Authorization', `Bearer ${authKey}`);
    req.setHeader('Accept', 'application/json');
    if (body !== null) {
      req.setHeader('Content-Type', 'application/json');
    }

    req.on('response', (response) => {
      let raw = '';
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: response.statusCode, data: raw });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body !== null) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ─── Peer normalizer ──────────────────────────────────────────────────────

function normalizePeer(m) {
  return {
    id:          String(m.id ?? ''),
    name:        String(m.name ?? m.givenName ?? ''),
    user:        String(m.user?.name ?? m.namespace?.name ?? ''),
    ipAddresses: Array.isArray(m.ipAddresses) ? m.ipAddresses : [],
    online:      Boolean(m.online ?? false),
    lastSeen:    m.lastSeen ?? null,
    os:          String(m.os ?? ''),
  };
}

// ─── IPC handlers ─────────────────────────────────────────────────────────

export function registerWireGuardBridge() {

  // wg:get-status — connectivity check + machine count
  ipcMain.handle('wg:get-status', async () => {
    const cfg = loadConfig();
    if (!cfg) return { configured: false, connected: false, machineCount: 0 };

    try {
      const { status, data } = await headscaleRequest(cfg.serverUrl, cfg.authKey, 'GET', '/machine');
      if (status !== 200) {
        return { configured: true, connected: false, machineCount: 0, error: `HTTP ${status}` };
      }
      const machines = Array.isArray(data.machines) ? data.machines : [];
      return {
        configured:   true,
        connected:    true,
        serverUrl:    cfg.serverUrl,
        machineCount: machines.length,
      };
    } catch (err) {
      return { configured: true, connected: false, machineCount: 0, error: String(err.message ?? err) };
    }
  });

  // wg:list-peers — enumerate all registered machines
  ipcMain.handle('wg:list-peers', async () => {
    const cfg = loadConfig();
    if (!cfg) return { ok: false, peers: [], error: 'Not configured' };

    try {
      const { status, data } = await headscaleRequest(cfg.serverUrl, cfg.authKey, 'GET', '/machine');
      if (status !== 200) return { ok: false, peers: [], error: `HTTP ${status}` };
      const machines = Array.isArray(data.machines) ? data.machines : [];
      return { ok: true, peers: machines.map(normalizePeer) };
    } catch (err) {
      return { ok: false, peers: [], error: String(err.message ?? err) };
    }
  });

  // wg:register-machine — add a machine by its WireGuard public key
  // Supports both modern (user) and legacy (namespace) Headscale versions.
  ipcMain.handle('wg:register-machine', async (_e, { machineKey, user }) => {
    const cfg = loadConfig();
    if (!cfg) return { ok: false, error: 'Not configured' };
    if (typeof machineKey !== 'string' || !machineKey.trim()) {
      return { ok: false, error: 'machineKey required' };
    }
    if (typeof user !== 'string' || !user.trim()) {
      return { ok: false, error: 'user (namespace) required' };
    }

    const query = `?key=${encodeURIComponent(machineKey.trim())}&user=${encodeURIComponent(user.trim())}`;
    try {
      const { status, data } = await headscaleRequest(
        cfg.serverUrl, cfg.authKey, 'POST', `/machine/register${query}`
      );
      if (status === 200 || status === 201) {
        return { ok: true, machine: data.machine ? normalizePeer(data.machine) : null };
      }
      return { ok: false, error: `HTTP ${status}: ${typeof data === 'string' ? data : JSON.stringify(data)}` };
    } catch (err) {
      return { ok: false, error: String(err.message ?? err) };
    }
  });

  // wg:get-routes — list all advertised and approved routes
  ipcMain.handle('wg:get-routes', async () => {
    const cfg = loadConfig();
    if (!cfg) return { ok: false, routes: [], error: 'Not configured' };

    try {
      const { status, data } = await headscaleRequest(cfg.serverUrl, cfg.authKey, 'GET', '/routes');
      if (status !== 200) return { ok: false, routes: [], error: `HTTP ${status}` };
      const routes = Array.isArray(data.routes) ? data.routes.map((r) => ({
        id:        String(r.id ?? ''),
        machine:   r.machine ? normalizePeer(r.machine) : null,
        prefix:    String(r.prefix ?? ''),
        advertised: Boolean(r.advertised ?? false),
        enabled:   Boolean(r.enabled ?? false),
        isPrimary: Boolean(r.isPrimary ?? false),
      })) : [];
      return { ok: true, routes };
    } catch (err) {
      return { ok: false, routes: [], error: String(err.message ?? err) };
    }
  });
}
