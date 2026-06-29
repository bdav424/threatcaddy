import { app, BrowserWindow, ipcMain, Menu, safeStorage, shell } from 'electron';
import { registerMailBridge } from './mail-bridge.mjs';
import { registerVirtualBridge } from './virtual-bridge.mjs';
import { registerVmIngest } from './vm-ingest.mjs';
import { registerNetworkScanBridge } from './network-scan.mjs';
import { registerUpdaterBridge } from './updater.mjs';
import { registerCredsBridge } from './creds-bridge.mjs';
import { registerSyncAuthBridge } from './sync-auth-bridge.mjs';
import * as cal from './mail-calendar-sync.mjs';
import { runCalendarOAuthPopout, refreshCalendarToken } from './cal-oauth.mjs';
import { runSlackOAuthPopout } from './slack-oauth.mjs';
import { pollSlackDMs } from './slack-sync.mjs';
import { postSlackWebhook } from './slack-outbound.mjs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ── Static file server (loopback) ──────────────────────────────────────────
// Serves dist/ over HTTP so Vite-built JS modules load correctly.
// file:// breaks ES module CORS; a loopback server avoids that.

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff':  'font/woff',
  '.webmanifest': 'application/manifest+json',
};

const NO_OP_SW = [
  "self.addEventListener('install', () => self.skipWaiting());",
  "self.addEventListener('activate', () => self.clients.claim());",
].join('\n');

function findPort(start) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(start, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', () => {
      if (start > start + 20) { reject(new Error('No free port found')); return; }
      findPort(start + 1).then(resolve, reject);
    });
  });
}

function startStaticServer(distDir) {
  return new Promise((resolve, reject) => {
    findPort(4174).then((port) => {
      const indexHtml = path.join(distDir, 'index.html');
      const server = http.createServer((req, res) => {
        const urlPath = (req.url || '/').split('?')[0];

        // No-op service worker — prevents PWA from caching in Electron context
        if (urlPath.endsWith('/sw.js') || urlPath.endsWith('/workbox-') || urlPath.match(/\/workbox-[^/]+\.js$/)) {
          res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
          res.end(NO_OP_SW);
          return;
        }

        const candidate = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath);
        const ext = path.extname(candidate).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          res.writeHead(200, { 'Content-Type': mimeType, 'Cache-Control': 'no-store' });
          res.end(fs.readFileSync(candidate));
        } else {
          // SPA fallback — any unknown path serves index.html
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(fs.existsSync(indexHtml) ? fs.readFileSync(indexHtml) : '<h1>ThreatCaddy: run pnpm build first</h1>');
        }
      });

      server.on('error', reject);
      server.listen(port, '127.0.0.1', () => resolve({ server, port }));
    }, reject);
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rendererDevUrl = process.env.TC_DESKTOP_DEV_URL;

// ── Calendar credential store ──────────────────────────────────────────────
// Mirrors the mail-bridge.mjs pattern. Raw tokens are never returned to the
// renderer — it holds only a credRefId (random UUID). Tokens live in
// OS safeStorage encrypted-at-rest under ~/.threatcaddy/calendar-credentials/.

const CAL_CRED_DIR = path.join(os.homedir(), '.threatcaddy', 'calendar-credentials');

function calCredPath(ref) {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(ref)) throw new Error('bad credRefId');
  return path.join(CAL_CRED_DIR, `${ref}.bin`);
}

function saveCalCredential(ref, cred) {
  fs.mkdirSync(CAL_CRED_DIR, { recursive: true, mode: 0o700 });
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS keychain unavailable');
  const enc = safeStorage.encryptString(JSON.stringify(cred));
  fs.writeFileSync(calCredPath(ref), enc, { mode: 0o600 });
}

function loadCalCredential(ref) {
  const enc = fs.readFileSync(calCredPath(ref));
  return JSON.parse(safeStorage.decryptString(enc));
}

// ── Account registry ───────────────────────────────────────────────────────
// In-memory; populated from the renderer on mount via calendar:register-account.
// Stores { id, provider, label, email?, credRefId } — NO raw tokens.
const accountRegistry = new Map();

function getAccount(accountId) {
  const a = accountRegistry.get(accountId);
  if (!a) throw new Error(`No calendar account registered for id: ${accountId}`);
  return a;
}

// ── Token resolution ───────────────────────────────────────────────────────
// Resolves the correct API token for a calendar account by decrypting its
// stored credential from safeStorage. Refreshes Google tokens when expired.

async function tokenFor(account) {
  const cred = loadCalCredential(account.credRefId);

  if (account.provider === 'google') {
    let { accessToken, refreshToken, expiresAt, clientId } = cred;
    if (Date.now() > (expiresAt ?? 0) - 60_000) {
      const fresh = await refreshCalendarToken('google', { clientId, refreshToken });
      accessToken = fresh.accessToken;
      saveCalCredential(account.credRefId, { ...cred, ...fresh });
    }
    return { google: accessToken };
  }

  if (account.provider === 'microsoft') {
    // getGraphToken() always re-exchanges the refresh token for a short-lived
    // Graph access token with the Calendars.ReadWrite audience.
    const graphToken = await cal.getGraphToken(cred.refreshToken, cred.clientId ?? '');
    return { graph: graphToken };
  }

  throw new Error(`Calendar sync does not support provider: ${account.provider}`);
}

// ── Slack credential store ─────────────────────────────────────────────────
// Mirrors calendar-credentials pattern. Renderer holds only credRefId.

const SLACK_CRED_DIR = path.join(os.homedir(), '.threatcaddy', 'slack-credentials');

function slackCredPath(ref) {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(ref)) throw new Error('bad slack credRefId');
  return path.join(SLACK_CRED_DIR, `${ref}.bin`);
}

function saveSlackCredential(ref, cred) {
  fs.mkdirSync(SLACK_CRED_DIR, { recursive: true, mode: 0o700 });
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS keychain unavailable');
  const enc = safeStorage.encryptString(JSON.stringify(cred));
  fs.writeFileSync(slackCredPath(ref), enc, { mode: 0o600 });
}

function loadSlackCredential(ref) {
  const enc = fs.readFileSync(slackCredPath(ref));
  return JSON.parse(safeStorage.decryptString(enc));
}

function deleteSlackCredential(ref) {
  try { fs.unlinkSync(slackCredPath(ref)); } catch { /* already gone */ }
}

// ── IPC handlers ───────────────────────────────────────────────────────────

ipcMain.handle('calendar:save-credential', (_e, { ref, cred }) => {
  saveCalCredential(ref, cred);
  return { ok: true };
});

ipcMain.handle('calendar:register-account', (_e, account) => {
  // account shape: { id, provider, label, email?, credRefId } — no tokens
  accountRegistry.set(account.id, account);
  return { ok: true };
});

ipcMain.handle('calendar:start-oauth', async (_e, { providerId }) => {
  // Runs the PKCE loopback flow, stores tokens in safeStorage, returns only
  // { credRefId, email } to the renderer. Tokens never cross to the renderer.
  const result   = await runCalendarOAuthPopout(providerId);
  const ref      = crypto.randomUUID();
  const credData = {
    provider:     providerId,
    email:        result.email,
    accessToken:  result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt:    result.expiresAt,
    clientId:     result.clientId,
  };
  saveCalCredential(ref, credData);
  return { credRefId: ref, email: result.email ?? '' };
});

ipcMain.handle('calendar:pull', async (_e, accountId, range) => {
  const a = getAccount(accountId);
  const t = await tokenFor(a);
  return a.provider === 'google'
    ? cal.fetchGoogleCalendar(t.google, range)
    : cal.fetchMicrosoftCalendar(t.graph, range);
});

ipcMain.handle('calendar:create', async (_e, accountId, event) => {
  const a = getAccount(accountId);
  const t = await tokenFor(a);
  return a.provider === 'google'
    ? cal.createGoogleEvent(t.google, event)
    : cal.createMicrosoftEvent(t.graph, event);
});

ipcMain.handle('calendar:update', async (_e, accountId, event) => {
  const a = getAccount(accountId);
  const t = await tokenFor(a);
  return a.provider === 'google'
    ? cal.updateGoogleEvent(t.google, event)
    : cal.updateMicrosoftEvent(t.graph, event);
});

ipcMain.handle('calendar:remove', async (_e, accountId, remoteId) => {
  const a = getAccount(accountId);
  const t = await tokenFor(a);
  return a.provider === 'google'
    ? cal.deleteGoogleEvent(t.google, remoteId)
    : cal.deleteMicrosoftEvent(t.graph, remoteId);
});

// ── Slack IPC handlers ─────────────────────────────────────────────────────

ipcMain.handle('slack:start-oauth', async () => {
  // If a direct token is configured via env var, skip the full OAuth flow.
  // TC_SLACK_TOKEN accepts any user token (xoxp-...) obtained from the Slack app's
  // OAuth & Permissions page → "OAuth Tokens for Your Workspace" → User OAuth Token.
  const directToken = process.env.TC_SLACK_TOKEN;
  if (directToken) {
    // Resolve display info from the token itself
    let workspaceName = 'Slack Workspace';
    let userName = 'You';
    let userId = '';
    try {
      const r = await fetch('https://slack.com/api/auth.test', {
        headers: { Authorization: `Bearer ${directToken}` },
      });
      const d = await r.json();
      if (d.ok) {
        workspaceName = d.team ?? workspaceName;
        userName = d.user ?? userName;
        userId = d.user_id ?? '';
      }
    } catch { /* best-effort */ }

    const ref = crypto.randomUUID();
    saveSlackCredential(ref, { userToken: directToken, workspaceName, userName, userId });
    return { credRefId: ref, workspaceName, userName, userId };
  }

  // Full OAuth flow (requires TC_SLACK_CLIENT_ID + TC_SLACK_CLIENT_SECRET)
  const result = await runSlackOAuthPopout();
  const ref    = crypto.randomUUID();
  saveSlackCredential(ref, result);
  return {
    credRefId:     ref,
    workspaceName: result.workspaceName,
    userName:      result.userName,
    userId:        result.userId,
  };
});

ipcMain.handle('slack:pull-dms', async (_e, credRefId, sinceTs) => {
  const cred = loadSlackCredential(credRefId);
  return pollSlackDMs(cred.userToken, sinceTs);
});

ipcMain.handle('slack:revoke', (_e, credRefId) => {
  deleteSlackCredential(credRefId);
  return { ok: true };
});

ipcMain.handle('slack:post-webhook', async (_e, webhookUrl, payload) => {
  return postSlackWebhook(webhookUrl, payload);
});

// ── Window ─────────────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyWindowGlass(win, _config = {}) {
  if (process.platform !== 'darwin') return;
  win.setBackgroundColor('#00000000');
}

function createWindow(loopbackPort) {
  const win = new BrowserWindow({
    width:    1480,
    height:   960,
    // Kept low on purpose: analysts run ThreatCaddy at half-screen widths (~700-900px)
    // alongside a browser for OSINT work. Don't raise this without re-checking that
    // workflow — see OVERVIEW.md panel compact-width convention (700px).
    minWidth: 700,
    minHeight: 560,
    show:     false,
    transparent:    true,
    backgroundColor: '#00000000',
    titleBarStyle:   process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  win.once('ready-to-show', () => { win.show(); });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('context-menu', (_event, params) => {
    const { editFlags, isEditable, selectionText } = params;
    if (!isEditable && !selectionText) return;
    const template = [];
    if (isEditable) {
      template.push(
        { role: 'undo', enabled: editFlags.canUndo },
        { role: 'redo', enabled: editFlags.canRedo },
        { type: 'separator' },
        { role: 'cut', enabled: editFlags.canCut },
      );
    }
    template.push({ role: 'copy', enabled: editFlags.canCopy });
    if (isEditable) {
      template.push(
        { role: 'paste', enabled: editFlags.canPaste },
        { type: 'separator' },
        { role: 'selectAll', enabled: editFlags.canSelectAll },
      );
    }
    Menu.buildFromTemplate(template).popup({ window: win });
  });

  ipcMain.removeHandler('threatcaddy-desktop:set-window-glass');
  ipcMain.handle('threatcaddy-desktop:set-window-glass', (_event, config) => {
    applyWindowGlass(win, config);
  });

  if (rendererDevUrl) {
    void win.loadURL(rendererDevUrl).catch((error) => {
      console.error('Failed to load renderer URL:', error);
    });
  } else {
    // Load via loopback HTTP server — file:// breaks ES module CORS and Vite chunk resolution
    void win.loadURL(`http://127.0.0.1:${loopbackPort}/`).catch((error) => {
      console.error('Failed to load renderer from loopback server:', error);
    });
  }

  applyWindowGlass(win, {});
  return win;
}

// The unused `clamp` helper is intentional — retained for future glass-geometry clamping.
void clamp;

app.whenReady().then(async () => {
  let loopbackPort = null;
  if (!rendererDevUrl) {
    const distDir = path.join(__dirname, '..', 'dist');
    const { port } = await startStaticServer(distDir);
    loopbackPort = port;
    console.log(`ThreatCaddy loopback server running at http://127.0.0.1:${port}/`);
  }

  const win = createWindow(loopbackPort);
  registerMailBridge();
  registerVirtualBridge();
  registerVmIngest();
  registerNetworkScanBridge();
  registerUpdaterBridge(win);
  registerCredsBridge();
  registerSyncAuthBridge();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(loopbackPort);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection in ThreatCaddy desktop wrapper:', error);
});
