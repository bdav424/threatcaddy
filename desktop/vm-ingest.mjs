// desktop/vm-ingest.mjs
//
// VirtualCaddy desktop ingest process — watches the ingest directory, hashes
// each new file, runs a static IOC extraction pass, and pushes results to the
// renderer via IPC.
//
// Air-gap constraint: NO fetch, NO WebSocket, NO child_process.exec / execFile.
// Only fs.*, path.*, crypto.*, and os.* are used. All outbound enrichment
// happens after this process finishes and the renderer handles the IPC message.
//
// Register in desktop/main.mjs:
//   import { registerVmIngest } from './vm-ingest.mjs';
//   app.whenReady().then(() => { createWindow(); registerVmIngest(); });

import { ipcMain, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { analyzeFile } from './virtual-caddy-analysis.mjs';

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_INGEST_DIR = path.join(os.homedir(), 'ThreatCaddy', 'VirtualCaddy', 'ingest');
const RESULTS_DIR = path.join(os.homedir(), 'ThreatCaddy', 'VirtualCaddy', 'results');

// ── State ──────────────────────────────────────────────────────────────────

const state = {
  watcher: null,
  jobQueue: new Map(), // jobId → { investigationId, filePath }
};

function sendToRenderer(channel, data) {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) win.webContents.send(channel, data);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function startIngestWatcher(ingestDir) {
  if (state.watcher) {
    try { state.watcher.close(); } catch { /* ignore */ }
    state.watcher = null;
  }

  ensureDir(ingestDir);
  ensureDir(RESULTS_DIR);

  state.watcher = fs.watch(ingestDir, { persistent: false }, (_eventType, filename) => {
    if (!filename) return;
    const filePath = path.join(ingestDir, filename);

    // Small debounce — wait for the file to be fully written
    setTimeout(() => {
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return;
        sendToRenderer('virtualcaddy:file-detected', { filePath, filename });
      } catch { /* file already gone */ }
    }, 300);
  });

  state.watcher.on('error', (err) => {
    sendToRenderer('virtualcaddy:watch-error', { error: err.message });
  });
}

// ── IPC handlers ───────────────────────────────────────────────────────────

export function registerVmIngest() {
  // Start the default watcher on registration
  startIngestWatcher(DEFAULT_INGEST_DIR);

  ipcMain.handle('virtualcaddy:submit', async (_event, { jobId, investigationId, filePath }) => {
    if (!jobId || !investigationId || !filePath) {
      return { ok: false, error: 'jobId, investigationId, and filePath are required' };
    }

    // Validate that the file exists and is readable
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return { ok: false, error: 'Path is not a file' };
    } catch (err) {
      return { ok: false, error: `File not accessible: ${err.message}` };
    }

    // Queue the job
    state.jobQueue.set(jobId, { investigationId, filePath });

    // Run analysis asynchronously — notify renderer when done
    setImmediate(async () => {
      sendToRenderer('virtualcaddy:job-status', { jobId, status: 'running' });

      try {
        const filename = path.basename(filePath);
        const { hash, iocs, notes } = analyzeFile(filePath);

        const result = {
          jobId,
          investigationId,
          filename,
          fileHash: hash,
          iocs,
          notes,
          completedAt: new Date().toISOString(),
        };

        // Write result to disk
        ensureDir(RESULTS_DIR);
        const resultPath = path.join(RESULTS_DIR, `${jobId}.json`);
        fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');

        state.jobQueue.delete(jobId);

        sendToRenderer('virtualcaddy:job-complete', {
          jobId,
          investigationId,
          filename,
          fileHash: hash,
          iocs,
          notes,
          rawResultPath: resultPath,
          completedAt: result.completedAt,
        });
      } catch (err) {
        state.jobQueue.delete(jobId);
        sendToRenderer('virtualcaddy:job-error', {
          jobId,
          investigationId,
          error: err.message ?? String(err),
        });
      }
    });

    return { ok: true };
  });

  ipcMain.handle('virtualcaddy:get-ingest-dir', async () => {
    return { ingestDir: DEFAULT_INGEST_DIR };
  });

  ipcMain.handle('virtualcaddy:set-ingest-dir', async (_event, { dirPath }) => {
    try {
      const resolved = path.resolve(dirPath);
      startIngestWatcher(resolved);
      return { ok: true, ingestDir: resolved };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('virtualcaddy:get-jobs-status', async () => {
    return { activeJobs: Array.from(state.jobQueue.keys()) };
  });
}
