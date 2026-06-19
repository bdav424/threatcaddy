import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { registerMailBridge } from './mail-bridge.mjs';
import * as cal from './mail-calendar-sync.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rendererDevUrl = process.env.TC_DESKTOP_DEV_URL;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyWindowGlass(win, config = {}) {
  if (process.platform !== 'darwin') return;

  win.setBackgroundColor('#00000000');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

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

// In-memory account registry (populated by the renderer via a future settings IPC).
// For v1, accounts are stored in Settings (renderer) — this map caches them for IPC handlers.
const accountRegistry = new Map();

function getAccount(accountId) {
  const a = accountRegistry.get(accountId);
  if (!a) throw new Error(`No account registered for id: ${accountId}`);
  return a;
}

ipcMain.handle('calendar:register-account', (_e, account) => {
  accountRegistry.set(account.id, account);
  return { ok: true };
});

async function tokenFor(account) {
  if (account.provider === 'google') {
    return { google: account.tokens.accessToken };
  }
  if (account.provider === 'microsoft') {
    const graphToken = await cal.getGraphToken(account.tokens.refreshToken, account.clientId);
    return { graph: graphToken };
  }
  throw new Error('Calendar sync supports Google and Microsoft today.');
}

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
