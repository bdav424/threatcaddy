// desktop/virtual-bridge.mjs
//
// VM file-watch bridge for VirtualCaddy. Lives in the Electron MAIN process so it
// can use fs.watch and fs.readFileSync without violating the renderer's no-network /
// no-exec constraint. The renderer receives only read-only file snapshots; it never
// writes to the watched directory.
//
// Air-gap constraint: no fetch, no WebSocket, no exec — only fs.* and path.* calls.
//
// Register in desktop/main.mjs:
//   import { registerVirtualBridge } from './virtual-bridge.mjs';
//   app.whenReady().then(() => { createWindow(); registerVirtualBridge(mainWin); });

import { ipcMain, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const state = {
  watcher: null,
  dirPath: null,
  error: null,
};

function sendToRenderer(channel, data) {
  const [win] = BrowserWindow.getAllWindows();
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
}

function closeWatcher() {
  if (state.watcher) {
    try { state.watcher.close(); } catch { /* ignore */ }
    state.watcher = null;
  }
}

export function registerVirtualBridge() {

  ipcMain.handle('virtual:set-watch-dir', async (_event, { dirPath }) => {
    closeWatcher();
    state.error = null;

    let resolved;
    try {
      resolved = path.resolve(dirPath);
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) return { ok: false, error: 'Path is not a directory' };
    } catch (err) {
      state.error = err.message;
      return { ok: false, error: err.message };
    }

    state.dirPath = resolved;

    try {
      state.watcher = fs.watch(resolved, { persistent: false }, (eventType, filename) => {
        sendToRenderer('virtual:file-changed', {
          eventType,
          filename,
          dirPath: resolved,
          timestamp: Date.now(),
        });
      });

      state.watcher.on('error', (err) => {
        state.error = err.message;
        closeWatcher();
        sendToRenderer('virtual:watch-error', { error: err.message });
      });

      return { ok: true };
    } catch (err) {
      state.error = err.message;
      state.dirPath = null;
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('virtual:get-watch-dir', async () => {
    return { dirPath: state.dirPath };
  });

  ipcMain.handle('virtual:list-files', async () => {
    if (!state.dirPath) return { files: [] };
    try {
      const entries = fs.readdirSync(state.dirPath, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile())
        .map((e) => {
          const fullPath = path.join(state.dirPath, e.name);
          try {
            const stat = fs.statSync(fullPath);
            return { name: e.name, relativePath: e.name, size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs };
          } catch {
            return { name: e.name, relativePath: e.name, size: 0, mtimeMs: 0, ctimeMs: 0 };
          }
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
      return { files };
    } catch (err) {
      return { files: [], error: err.message };
    }
  });

  ipcMain.handle('virtual:read-file', async (_event, { relativePath }) => {
    if (!state.dirPath) return { ok: false, error: 'No watch directory configured' };

    // Prevent directory traversal: resolved path must stay inside dirPath.
    const fullPath = path.resolve(state.dirPath, relativePath);
    const dirResolved = path.resolve(state.dirPath);
    if (!fullPath.startsWith(dirResolved + path.sep) && fullPath !== dirResolved) {
      return { ok: false, error: 'Path traversal not permitted' };
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      return { ok: true, content, encoding: 'utf8' };
    } catch {
      // Fall back to base64 for binary files.
      try {
        const buf = fs.readFileSync(fullPath);
        return { ok: true, content: buf.toString('base64'), encoding: 'base64' };
      } catch (err2) {
        return { ok: false, error: err2.message };
      }
    }
  });

  ipcMain.handle('virtual:stop-watch', async () => {
    closeWatcher();
    state.dirPath = null;
    state.error = null;
    return { ok: true };
  });

  ipcMain.handle('virtual:get-status', async () => {
    return { watching: !!state.watcher, dirPath: state.dirPath, error: state.error };
  });
}
