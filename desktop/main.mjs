import { app, BrowserWindow, ipcMain, shell } from 'electron';
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

app.whenReady().then(() => {
  createWindow();

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
