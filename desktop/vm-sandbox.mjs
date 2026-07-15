// desktop/vm-sandbox.mjs
//
// VirtualCaddy VM Sandbox (Phase 2) — Electron main-process orchestration of a
// VirtualBox VM to detonate a submitted sample: snapshot restore, network isolation,
// guest file copy-in, guest execution under a hard timeout, periodic screenshots, and a
// guaranteed final snapshot restore. Uses desktop/vm-sandbox-detonation.mjs for every
// command-argument construction and the job state machine — this file only wires those
// pure builders to real child_process calls and IPC.
//
// SCOPE / SAFETY BOUNDARIES (do not silently expand without re-reviewing with the user):
// - Network mode is always 'isolated' or 'simulated-internet', both of which configure
//   ONLY a host-only VirtualBox adapter — never NAT or bridged. There is no code path
//   here that requests real internet egress for the detonation VM. If you want to add
//   one, that's a deliberate, separate decision, not a natural extension of this file.
// - Packet capture is NOT performed by this module. VirtualBox screenshot capture needs
//   no elevated host privileges, but a live network capture would (Npcap on Windows,
//   root/setcap on Linux, BPF device permission on macOS) — expanding this Electron
//   process's privilege footprint for that is a separate, deliberate decision this v1
//   does not make. Point your own tcpdump/Wireshark at the host-only adapter for the
//   run's duration and drop the summary into the job's output folder — the same
//   external-capture pattern Phase 1 (VirtualCaddyWorkspace) already uses for VM
//   artifacts in general — and Detonation Review will pick it up automatically.
// - Job status is in-memory only for this pass (pushed to the renderer via IPC events),
//   not persisted to Dexie the way static-analysis jobs (vm-ingest.mjs) are. A restart
//   loses the in-app job list, though the on-disk job folder and its artifacts survive.
// - Every job is required to reference a snapshot; there is no "run against the live VM
//   state" mode — a job without a valid, pre-existing snapshot is rejected outright.
//
// Register in desktop/main.mjs:
//   import { registerVmSandbox } from './vm-sandbox.mjs';
//   app.whenReady().then(() => { createWindow(); registerVmSandbox(); });

import { ipcMain, BrowserWindow, safeStorage } from 'electron';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import {
  isSafeVmOrSnapshotName,
  sanitizeGuestFilename,
  buildListVmsArgs,
  buildListSnapshotsArgs,
  buildNetworkModeArgs,
  buildRestoreSnapshotArgs,
  buildStartVmArgs,
  buildPoweroffArgs,
  buildScreenshotArgs,
  buildCopyToGuestArgs,
  buildGuestRunArgs,
  buildGuestSamplePath,
  parseListVmsOutput,
  parseSnapshotListOutput,
  parseHostOnlyInterfacesOutput,
  DETONATION_STATES,
  DetonationJobStateMachine,
} from './vm-sandbox-detonation.mjs';
import { getConfiguredWatchDir } from './virtual-bridge.mjs';

// ── Constants ──────────────────────────────────────────────────────────────

// Relies on the VirtualBox installer having put VBoxManage on PATH, which it does by
// default on Windows, macOS, and Linux — documented as a prerequisite in the VM Sandbox
// tab's own help text rather than hardcoding an install path that varies by version/OS.
const VBOXMANAGE = 'VBoxManage';
const DEFAULT_OUTPUT_DIR = path.join(os.homedir(), 'ThreatCaddy', 'VirtualCaddy', 'detonation');
const SCREENSHOT_INTERVAL_MS = 5000;
const MAX_TIMEOUT_MS = 10 * 60 * 1000; // hard ceiling regardless of what the caller requests
const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000;

// ── Guest credential store (mirrors desktop/mail-bridge.mjs exactly) ───────
// The renderer only ever holds a credentialReferenceId. Raw guest username/password
// live here, encrypted with the OS keychain via Electron safeStorage — never written
// to disk in plaintext, never passed to VBoxManage as a bare --password argv value
// (see runGuestControlWithPassword, which uses a short-lived --password-file instead).

const CRED_DIR = path.join(os.homedir(), '.threatcaddy', 'vm-sandbox-credentials');

function credPath(ref) {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(ref)) throw new Error('bad credentialReferenceId');
  return path.join(CRED_DIR, `${ref}.bin`);
}

function saveGuestCredential(ref, cred) {
  fs.mkdirSync(CRED_DIR, { recursive: true, mode: 0o700 });
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS keychain unavailable');
  const enc = safeStorage.encryptString(JSON.stringify(cred));
  fs.writeFileSync(credPath(ref), enc, { mode: 0o600 });
}

function loadGuestCredential(ref) {
  const enc = fs.readFileSync(credPath(ref));
  try {
    return JSON.parse(safeStorage.decryptString(enc)); // { username, password }
  } catch (err) {
    console.warn('[vm-sandbox] decryptString failed (signing identity change?), clearing entry:', err.message);
    try { fs.unlinkSync(credPath(ref)); } catch { /* already gone */ }
    throw new Error('Guest credential decryption failed — please re-enter the VM login');
  }
}

// ── VBoxManage process helpers ──────────────────────────────────────────────

function runVBoxManage(args, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve) => {
    execFile(VBOXMANAGE, args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        const notFound = err.code === 'ENOENT';
        resolve({ ok: false, error: notFound ? 'VBoxManage not found on PATH — is VirtualBox installed?' : (stderr || err.message), stdout: stdout || '', stderr: stderr || '' });
        return;
      }
      resolve({ ok: true, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

/**
 * Runs a guestcontrol subcommand that needs a password, via a short-lived, 0600
 * temp file passed as --password-file — never a bare --password argv value (which
 * would be visible to other local processes/users via ps/Task Manager for the
 * command's lifetime). The temp file is deleted immediately after the call, in a
 * finally block so it's removed even if VBoxManage itself errors.
 */
async function runGuestControlWithPassword(buildArgs, password, { timeoutMs = 30000 } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-vmsandbox-'));
  const pwFile = path.join(tmpDir, 'pw.txt');
  try {
    fs.writeFileSync(pwFile, password, { mode: 0o600 });
    const args = buildArgs(pwFile);
    return await runVBoxManage(args, { timeoutMs });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

async function listVms() {
  const result = await runVBoxManage(buildListVmsArgs());
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, vms: parseListVmsOutput(result.stdout) };
}

async function listSnapshots(vmName) {
  const result = await runVBoxManage(buildListSnapshotsArgs(vmName));
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, snapshots: parseSnapshotListOutput(result.stdout) };
}

async function listHostOnlyAdapters() {
  const result = await runVBoxManage(['list', 'hostonlyifs']);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, adapters: parseHostOnlyInterfacesOutput(result.stdout) };
}

/** Defense in depth beyond isSafeVmOrSnapshotName: only ever act on a name VBoxManage itself just reported. */
async function assertKnownVm(vmName) {
  const { ok, vms, error } = await listVms();
  if (!ok) throw new Error(`Could not enumerate VMs: ${error}`);
  if (!vms.some((v) => v.name === vmName)) throw new Error(`"${vmName}" is not a VM VBoxManage currently reports — refusing to act on it`);
}

async function assertKnownSnapshot(vmName, snapshotName) {
  const { ok, snapshots, error } = await listSnapshots(vmName);
  if (!ok) throw new Error(`Could not enumerate snapshots for "${vmName}": ${error}`);
  if (!snapshots.some((s) => s.name === snapshotName)) throw new Error(`"${snapshotName}" is not a snapshot of "${vmName}" — refusing to act on it`);
}

async function assertKnownHostOnlyAdapter(adapterName) {
  const { ok, adapters, error } = await listHostOnlyAdapters();
  if (!ok) throw new Error(`Could not enumerate host-only adapters: ${error}`);
  if (!adapters.includes(adapterName)) throw new Error(`"${adapterName}" is not a host-only adapter VBoxManage currently reports — refusing to act on it`);
}

// ── State ──────────────────────────────────────────────────────────────────

const state = {
  jobs: new Map(), // jobId -> { machine: DetonationJobStateMachine, outputDir, screenshotTimer, hardTimeoutTimer }
};

function sendToRenderer(channel, data) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, data);
  }
}

function jobOutputDir(jobId) {
  const base = getConfiguredWatchDir() || DEFAULT_OUTPUT_DIR;
  return path.join(base, `detonation-${jobId}`);
}

function emitStatus(jobId, machine, extra = {}) {
  sendToRenderer('vmsandbox:job-status', { jobId, state: machine.state, ...extra });
}

// ── Detonation pipeline ──────────────────────────────────────────────────────

async function runDetonation(jobId, params) {
  const { vmName, snapshotName, hostOnlyAdapter, networkMode, filePath, credentialReferenceId, timeoutMs } = params;
  const machine = new DetonationJobStateMachine(jobId);
  const outputDir = jobOutputDir(jobId);
  const screenshotsDir = path.join(outputDir, 'screenshots');
  const entry = { machine, outputDir, screenshotTimer: null, hardTimeoutTimer: null };
  state.jobs.set(jobId, entry);

  const clampedTimeoutMs = Math.min(Math.max(timeoutMs || DEFAULT_TIMEOUT_MS, 5000), MAX_TIMEOUT_MS);
  const startedAt = new Date().toISOString();
  let guestExecResult = null;

  const stopScreenshots = () => {
    if (entry.screenshotTimer) { clearInterval(entry.screenshotTimer); entry.screenshotTimer = null; }
  };
  const startScreenshots = () => {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    let n = 0;
    entry.screenshotTimer = setInterval(async () => {
      n += 1;
      const outPath = path.join(screenshotsDir, `screenshot-${String(n).padStart(3, '0')}.png`);
      await runVBoxManage(buildScreenshotArgs(vmName, outPath), { timeoutMs: 10000 });
    }, SCREENSHOT_INTERVAL_MS);
  };

  const attemptFinalRestore = async () => {
    stopScreenshots();
    // Always try poweroff first — restoring a snapshot while the VM is still running
    // fails, and a hung/anti-analysis sample may not have exited on its own.
    await runVBoxManage(buildPoweroffArgs(vmName), { timeoutMs: 15000 });
    const restoreResult = await runVBoxManage(buildRestoreSnapshotArgs(vmName, snapshotName), { timeoutMs: 60000 });
    if (!restoreResult.ok) throw new Error(`Post-run snapshot restore failed: ${restoreResult.error}. The VM "${vmName}" may be left in a non-clean state — check it manually before reusing this snapshot.`);
  };

  try {
    await assertKnownVm(vmName);
    await assertKnownSnapshot(vmName, snapshotName);
    await assertKnownHostOnlyAdapter(hostOnlyAdapter);
    if (!fs.existsSync(filePath)) throw new Error('Sample file not accessible');
    const cred = loadGuestCredential(credentialReferenceId);

    fs.mkdirSync(outputDir, { recursive: true });

    machine.transition(DETONATION_STATES.RESTORING_PRE);
    emitStatus(jobId, machine);
    const preRestore = await runVBoxManage(buildRestoreSnapshotArgs(vmName, snapshotName), { timeoutMs: 60000 });
    if (!preRestore.ok) throw new Error(`Pre-run snapshot restore failed: ${preRestore.error}`);

    machine.transition(DETONATION_STATES.CONFIGURING_NETWORK);
    emitStatus(jobId, machine);
    const netResult = await runVBoxManage(buildNetworkModeArgs(vmName, hostOnlyAdapter), { timeoutMs: 15000 });
    if (!netResult.ok) throw new Error(`Network configuration failed: ${netResult.error}`);

    machine.transition(DETONATION_STATES.STARTING);
    emitStatus(jobId, machine);
    const startResult = await runVBoxManage(buildStartVmArgs(vmName), { timeoutMs: 60000 });
    if (!startResult.ok) throw new Error(`VM failed to start: ${startResult.error}`);
    // Give the guest OS a moment to finish booting before guestcontrol calls.
    await new Promise((r) => setTimeout(r, 8000));

    machine.transition(DETONATION_STATES.COPYING_IN);
    emitStatus(jobId, machine);
    const sanitizedName = sanitizeGuestFilename(path.basename(filePath));
    const guestPlatform = /win/i.test(vmName) ? 'windows' : 'posix';
    const guestPath = buildGuestSamplePath(guestPlatform, sanitizedName);
    const copyResult = await runGuestControlWithPassword(
      (pwFile) => buildCopyToGuestArgs(vmName, filePath, guestPath, cred.username, pwFile),
      cred.password,
      { timeoutMs: 60000 },
    );
    if (!copyResult.ok) throw new Error(`Could not copy sample into the guest: ${copyResult.error}`);

    machine.transition(DETONATION_STATES.RUNNING);
    emitStatus(jobId, machine, { networkMode, timeoutMs: clampedTimeoutMs });
    startScreenshots();

    const runPromise = runGuestControlWithPassword(
      (pwFile) => buildGuestRunArgs(vmName, guestPath, cred.username, pwFile, clampedTimeoutMs),
      cred.password,
      { timeoutMs: clampedTimeoutMs + 15000 },
    );
    const hardTimeout = new Promise((resolve) => {
      entry.hardTimeoutTimer = setTimeout(() => resolve({ ok: false, error: 'hard-timeout', timedOut: true }), clampedTimeoutMs);
    });
    guestExecResult = await Promise.race([runPromise, hardTimeout]);
    if (entry.hardTimeoutTimer) { clearTimeout(entry.hardTimeoutTimer); entry.hardTimeoutTimer = null; }

    if (guestExecResult.timedOut) {
      machine.transition(DETONATION_STATES.TIMED_OUT);
      emitStatus(jobId, machine);
    }

    machine.transition(DETONATION_STATES.POWERING_OFF);
    emitStatus(jobId, machine);
    await attemptFinalRestore();

    machine.transition(DETONATION_STATES.RESTORING_POST);
    emitStatus(jobId, machine);

    machine.transition(DETONATION_STATES.PACKAGING);
    emitStatus(jobId, machine);
    const completedAt = new Date().toISOString();
    const report = {
      jobId, vmName, snapshotName, networkMode, hostOnlyAdapter,
      filename: path.basename(filePath),
      startedAt, completedAt,
      timedOut: !!guestExecResult.timedOut,
      guestExecOk: !!guestExecResult.ok,
      guestExecOutput: guestExecResult.timedOut ? undefined : { stdout: guestExecResult.stdout, stderr: guestExecResult.stderr },
    };
    fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

    machine.transition(DETONATION_STATES.COMPLETE);
    sendToRenderer('vmsandbox:job-complete', { jobId, outputDir, report });
  } catch (err) {
    const message = err?.message ?? String(err);
    try { machine.transition(DETONATION_STATES.ERROR, { error: message }); } catch { /* already terminal-ish */ }
    sendToRenderer('vmsandbox:job-status', { jobId, state: machine.state, error: message });
    try {
      await attemptFinalRestore();
      machine.transition(DETONATION_STATES.RESTORING_POST);
      machine.transition(DETONATION_STATES.PACKAGING);
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify({
        jobId, vmName, snapshotName, networkMode, hostOnlyAdapter,
        startedAt, completedAt: new Date().toISOString(), ok: false, error: message,
      }, null, 2), 'utf8');
      machine.transition(DETONATION_STATES.COMPLETE);
      sendToRenderer('vmsandbox:job-error', { jobId, error: message, recovered: true, outputDir });
    } catch (restoreErr) {
      sendToRenderer('vmsandbox:job-error', { jobId, error: `${message}; additionally, cleanup failed: ${restoreErr.message}`, recovered: false });
    }
  } finally {
    stopScreenshots();
  }
}

// ── IPC handlers ───────────────────────────────────────────────────────────

export function registerVmSandbox() {
  ipcMain.handle('vmsandbox:list-vms', async () => listVms());
  ipcMain.handle('vmsandbox:list-snapshots', async (_event, { vmName }) => {
    if (!isSafeVmOrSnapshotName(vmName)) return { ok: false, error: 'invalid VM name' };
    return listSnapshots(vmName);
  });
  ipcMain.handle('vmsandbox:list-network-adapters', async () => listHostOnlyAdapters());

  ipcMain.handle('vmsandbox:save-guest-credential', async (_event, { username, password }) => {
    if (!username || !password) return { ok: false, error: 'username and password are required' };
    const ref = crypto.randomBytes(16).toString('hex');
    try {
      saveGuestCredential(ref, { username, password });
      return { ok: true, credentialReferenceId: ref };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('vmsandbox:submit-detonation', async (_event, params) => {
    const { vmName, snapshotName, hostOnlyAdapter, networkMode, filePath, credentialReferenceId, timeoutMs } = params ?? {};
    if (!isSafeVmOrSnapshotName(vmName) || !isSafeVmOrSnapshotName(snapshotName)) {
      return { ok: false, error: 'invalid VM or snapshot name' };
    }
    if (networkMode !== 'isolated' && networkMode !== 'simulated-internet') {
      return { ok: false, error: 'invalid network mode' };
    }
    if (!filePath || !credentialReferenceId) {
      return { ok: false, error: 'filePath and credentialReferenceId are required' };
    }
    const jobId = nanoid();
    // Fire and forget — progress is reported via vmsandbox:job-status/-complete/-error events.
    runDetonation(jobId, { vmName, snapshotName, hostOnlyAdapter, networkMode, filePath, credentialReferenceId, timeoutMs });
    return { ok: true, jobId };
  });
}
