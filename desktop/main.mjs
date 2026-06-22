import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron';
import { registerMailBridge } from './mail-bridge.mjs';
import * as cal from './mail-calendar-sync.mjs';
import { runCalendarOAuthPopout, refreshCalendarToken } from './cal-oauth.mjs';
import { runSlackOAuthPopout } from './slack-oauth.mjs';
import { pollSlackDMs } from './slack-sync.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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

// ── Window ─────────────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyWindowGlass(win, _config = {}) {
  if (process.platform !== 'darwin') return;
  win.setBackgroundColor('#00000000');
}

function createWindow() {
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

  ipcMain.removeHandler('threatcaddy-desktop:set-window-glass');
  ipcMain.handle('threatcaddy-desktop:set-window-glass', (_event, config) => {
    applyWindowGlass(win, config);
  });

  if (rendererDevUrl) {
    void win.loadURL(rendererDevUrl).catch((error) => {
      console.error('Failed to load renderer URL:', error);
    });
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html')).catch((error) => {
      console.error('Failed to load renderer file:', error);
    });
  }

  applyWindowGlass(win, {});
}

// The unused `clamp` helper is intentional — retained for future glass-geometry clamping.
void clamp;

app.whenReady().then(() => {
  createWindow();
  registerMailBridge();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
