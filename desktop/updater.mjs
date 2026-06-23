// Electron main-process only. Do NOT import from renderer or src/lib.
import { autoUpdater } from 'electron-updater';
import { ipcMain, app } from 'electron';

/**
 * Wire up electron-updater with GitHub Releases.
 * Call once from main.mjs after the BrowserWindow is ready.
 *
 * IPC channels (renderer ← main):
 *   updater:checking          — checking for update
 *   updater:available         — { version } — update available, will download
 *   updater:not-available     — already on latest
 *   updater:progress          — { percent } — download progress
 *   updater:downloaded        — { version } — ready to install
 *   updater:error             — { message }
 *
 * IPC channels (renderer → main):
 *   updater:check             — trigger a manual check
 *   updater:install-and-quit  — quitAndInstall()
 */
export function registerUpdaterBridge(win) {
  // Never run the updater in dev mode; app.isPackaged is false in dev.
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (channel, payload) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload ?? null);
  };

  autoUpdater.on('checking-for-update', () => send('updater:checking'));
  autoUpdater.on('update-available', (info) => send('updater:available', { version: info.version }));
  autoUpdater.on('update-not-available', () => send('updater:not-available'));
  autoUpdater.on('download-progress', (p) => send('updater:progress', { percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => send('updater:downloaded', { version: info.version }));
  autoUpdater.on('error', (err) => send('updater:error', { message: err?.message ?? String(err) }));

  ipcMain.on('updater:check', () => autoUpdater.checkForUpdates().catch(() => {}));
  ipcMain.on('updater:install-and-quit', () => autoUpdater.quitAndInstall(false, true));

  // Initial check on launch (30 s delay to not block startup).
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 30_000);
}
