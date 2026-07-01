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
import crypto from 'node:crypto';

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_INGEST_DIR = path.join(os.homedir(), 'ThreatCaddy', 'VirtualCaddy', 'ingest');
const RESULTS_DIR = path.join(os.homedir(), 'ThreatCaddy', 'VirtualCaddy', 'results');

// ── IOC extraction patterns ────────────────────────────────────────────────
// Air-gapped static analysis: no network, only regex over printable strings.

const IOC_PATTERNS = [
  { type: 'ipv4',   regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },
  { type: 'domain', regex: /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|io|gov|edu|mil|biz|info|co|uk|de|fr|ru|cn|jp|br|au|nl|se|no|fi|dk|ch|at|be|es|pt|it|pl|cz|hu|ro|bg|gr|hr|sk|si|lt|lv|ee|is|nz|za|in|sg|hk|tw|kr|ar|mx|cl|pe|ve|ua|by|kz|uz|tm|tj|kg|am|ge|az|md|mn|th|vn|ph|my|id|bd|pk|lk|np|mm|kh|la|eg|sa|ae|qa|kw|bh|jo|il|lb|tr|ir|iq|sy|ly|tn|dz|ma|et|ke|ng|gh|tz|ug|zm|zw|sn|ci|cm|cd|mg|ml|bf|tg|bj|gn|ne|td|rw|bi|dj|er|so|sd|ss|mr|gw|sl|lr|gm|gq|cf|cg|ga|st|cv|km|sc|mu|mz|mw|sz|ls|na|bw|ao|bv|gl|pm|yt|re|ws|to|fj|pg|sb|vu|nc|pf|gu|as|mp|fm|pw|mh|ki|nr|tv|ck|nu|wf|tk|ax|ad|mc|sm|va|li|lu|mt|cy|im|je|gg|fo|gi|jm|bb|lc|vc|ag|gd|dm|tt|ky|bm|tc|bs|pr|vg|vi|us|ca|mx)\b/gi },
  { type: 'url',    regex: /https?:\/\/[^\s"'<>()[\]{}|\\^`]+/gi },
  { type: 'email',  regex: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g },
  { type: 'md5',    regex: /\b[a-fA-F0-9]{32}\b/g },
  { type: 'sha1',   regex: /\b[a-fA-F0-9]{40}\b/g },
  { type: 'sha256', regex: /\b[a-fA-F0-9]{64}\b/g },
  { type: 'cve',    regex: /\bCVE-\d{4}-\d{4,}\b/gi },
];

// Filter out obviously non-IOC hex strings (all-same-char, sequential, etc.)
function looksLikeRealHash(value) {
  if (/^(.)\1+$/.test(value)) return false;
  const unique = new Set(value.toLowerCase()).size;
  return unique > 4;
}

// Extract printable ASCII strings of length >= 6 from a buffer
function extractPrintableStrings(buffer, minLen = 6) {
  const strings = [];
  let current = '';
  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    if (ch >= 0x20 && ch <= 0x7e) {
      current += String.fromCharCode(ch);
    } else {
      if (current.length >= minLen) strings.push(current);
      current = '';
    }
  }
  if (current.length >= minLen) strings.push(current);
  return strings;
}

// Run all IOC patterns against the joined string corpus, dedup by value+type
function extractIOCs(corpus) {
  const seen = new Set();
  const iocs = [];

  for (const { type, regex } of IOC_PATTERNS) {
    const matches = corpus.match(regex) ?? [];
    for (const raw of matches) {
      const value = raw.trim();
      if (!value) continue;

      // Filter out hash false-positives
      if ((type === 'md5' || type === 'sha1' || type === 'sha256') && !looksLikeRealHash(value)) continue;

      // Exclude private/loopback IPs
      if (type === 'ipv4') {
        if (/^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(value)) continue;
      }

      const key = `${type}:${value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      iocs.push({ type, value });
    }
  }
  return iocs;
}

// ── Core analysis ──────────────────────────────────────────────────────────

function computeSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const buf = fs.readFileSync(filePath);
  hash.update(buf);
  return { hash: hash.digest('hex'), buffer: buf };
}

function analyzeFile(filePath) {
  const { hash, buffer } = computeSha256(filePath);
  const strings = extractPrintableStrings(buffer);
  const corpus = strings.join('\n');
  const iocs = extractIOCs(corpus);
  const notes = [];

  if (iocs.length > 0) {
    notes.push(`Static analysis found ${iocs.length} potential IOC${iocs.length === 1 ? '' : 's'}.`);
  } else {
    notes.push('Static string scan found no IOC patterns.');
  }

  notes.push(`File hash (SHA-256): ${hash}`);
  notes.push(`Unique printable strings: ${strings.length}`);

  return { hash, iocs, notes, stringCount: strings.length };
}

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
