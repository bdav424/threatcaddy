/**
 * ThreatCaddy LAN sync server — minimal Node http server.
 * Bound only to LAN/loopback (never 0.0.0.0 internet-facing).
 * Called from main.mjs via ipcMain handlers; state is module-level.
 *
 * Routes (all require Bearer token):
 *   GET  /health        — { ok: true, version: 1 }
 *   POST /push-backup   — Accept a backup payload from a mobile peer
 *   GET  /pull-backup   — Return the latest backup blob we hold in memory
 *
 * No WebSocket, no external fetches. LAN-only by bind address.
 */

import http from 'http';
import os from 'os';

const PORT_DEFAULT = 7463;

let server = null;
let serverToken = null;   // shared secret, set on start
let latestBlob = null;    // in-memory staging for a received backup

// ── Utilities ─────────────────────────────────────────────────────────────────

function getLANAddress() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function authFail(res) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Unauthorized' }));
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── Request handler ───────────────────────────────────────────────────────────

function handleRequest(req, res) {
  // CORS preflight from mobile browser PWA on LAN
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Auth — Bearer token required for all non-health routes
  const auth = req.headers['authorization'] ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  const url = req.url?.split('?')[0] ?? '';

  if (url === '/health' && req.method === 'GET') {
    send(res, 200, { ok: true, version: 1 });
    return;
  }

  if (!serverToken || token !== serverToken) { authFail(res); return; }

  if (url === '/push-backup' && req.method === 'POST') {
    readBody(req).then((raw) => {
      try {
        // Accept any JSON — callers send encrypted backup blobs
        const parsed = JSON.parse(raw);
        latestBlob = parsed;
        send(res, 200, { ok: true });
      } catch {
        send(res, 400, { error: 'Invalid JSON' });
      }
    }).catch(() => send(res, 500, { error: 'Read error' }));
    return;
  }

  if (url === '/pull-backup' && req.method === 'GET') {
    if (!latestBlob) { send(res, 404, { error: 'No backup available' }); return; }
    send(res, 200, { ok: true, blob: latestBlob });
    return;
  }

  send(res, 404, { error: 'Not found' });
}

// ── Exported control functions (called from main.mjs IPC handlers) ────────────

export function startSyncServer({ port = PORT_DEFAULT, token } = {}) {
  if (server) return getStatus();
  if (!token || typeof token !== 'string') throw new Error('LAN sync token required');
  serverToken = token;
  const bindAddr = getLANAddress();
  server = http.createServer(handleRequest);
  server.listen(port, bindAddr, () => {
    // Intentionally empty — main.mjs calls getStatus() for address
  });
  server.on('error', (err) => {
    console.error('[sync-server] Error:', err.message);
    server = null;
    serverToken = null;
  });
  return getStatus();
}

export function stopSyncServer() {
  if (!server) return { running: false };
  server.close();
  server = null;
  serverToken = null;
  return { running: false };
}

export function getStatus() {
  if (!server || !server.listening) return { running: false };
  const addr = server.address();
  return {
    running: true,
    address: typeof addr === 'object' ? addr.address : addr,
    port: typeof addr === 'object' ? addr.port : PORT_DEFAULT,
    lanIP: getLANAddress(),
  };
}
