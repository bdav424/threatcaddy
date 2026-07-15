// desktop/vm-sandbox-detonation.mjs
//
// Pure, Electron-free core for VirtualCaddy's VM Sandbox (Phase 2): VBoxManage argument
// builders, output parsers, and the detonation job state machine. No child_process, no
// ipcMain, no filesystem writes — everything here is a pure function or a state object,
// so it's fully unit-testable without a real VirtualBox install. The actual `execFile`
// calls that run these commands live in desktop/vm-sandbox.mjs.
//
// SAFETY INVARIANTS ENCODED HERE (do not weaken without updating the corresponding test):
// 1. Network mode is always one of 'isolated' | 'simulated-internet'. Both compile to the
//    SAME VirtualBox NIC configuration — a host-only adapter, never NAT or bridged — so a
//    detonation VM is structurally unable to reach the real internet regardless of mode.
//    The only difference between the two modes is operator-side: whether something (e.g.
//    INetSim) is listening on the host end of that host-only adapter to fake responses.
//    There is deliberately no third mode and no code path that requests NAT/bridged
//    networking — real internet egress for a detonation VM is out of scope for this
//    module by design, not by an easily-bypassed runtime check.
// 2. Every job's state machine restores the pre-run snapshot BEFORE start and the SAME
//    snapshot AFTER the run (success, timeout, or error) — modeled as a structural
//    transition table, not something the caller can accidentally skip by branching wrong.
// 3. A run always has a finite timeout; the state machine surfaces a 'timed-out' state
//    that forces poweroff + restore rather than waiting indefinitely.

// ── VM/snapshot name validation ─────────────────────────────────────────────
// Defense in depth: even though every VBoxManage invocation uses execFile with an
// argument array (never a shell string, so shell metacharacters in a name can't be
// interpreted), we still only ever act on names the caller re-confirms came from a
// live `VBoxManage list vms` / `list snapshots` — see vm-sandbox.mjs's validateKnownVm.
// This regex additionally rejects control characters and path separators outright.
const SAFE_NAME_RE = /^[^\x00-\x1f/\\]{1,255}$/;

export function isSafeVmOrSnapshotName(name) {
  return typeof name === 'string' && SAFE_NAME_RE.test(name);
}

// Guest-side filenames are derived from the analyst's local sample filename, which is
// attacker-influenceable (a malware sample can be named anything). Strip it down to a
// safe basename before it's ever used to build a guest-side destination path.
export function sanitizeGuestFilename(originalName) {
  const base = String(originalName).split(/[/\\]/).pop() ?? 'sample';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : 'sample.bin';
}

// ── Argument builders ───────────────────────────────────────────────────────
// Every builder returns a plain argv array for execFile('VBoxManage', argv, ...) —
// never a shell string. No function here performs any I/O.

export function buildListVmsArgs() {
  return ['list', 'vms'];
}

export function buildListSnapshotsArgs(vmName) {
  return ['snapshot', vmName, 'list', '--machinereadable'];
}

/**
 * Both network modes below configure the SAME host-only adapter — see the safety
 * invariant note at the top of this file. `hostOnlyAdapter` is an adapter name
 * returned by `VBoxManage list hostonlyifs` (validated by the caller), never
 * freeform text from a form field.
 */
export function buildNetworkModeArgs(vmName, hostOnlyAdapter) {
  return ['modifyvm', vmName, '--nic1', 'hostonly', '--hostonlyadapter1', hostOnlyAdapter];
}

export function buildRestoreSnapshotArgs(vmName, snapshotName) {
  return ['snapshot', vmName, 'restore', snapshotName];
}

export function buildStartVmArgs(vmName) {
  return ['startvm', vmName, '--type', 'headless'];
}

export function buildPoweroffArgs(vmName) {
  return ['controlvm', vmName, 'poweroff'];
}

export function buildScreenshotArgs(vmName, outputPath) {
  return ['controlvm', vmName, 'screenshotpng', outputPath];
}

/**
 * guestPath must already be a sanitized, fixed-prefix path (see buildGuestSamplePath) —
 * this function does not sanitize it again. passwordFilePath must point to a temp file
 * the caller wrote with 0600 permissions and deletes immediately after the command
 * completes — VBoxManage's --password-file flag avoids the guest password ever
 * appearing in argv (visible to other local processes/users via ps/Task Manager),
 * which a plain --password <value> flag would not.
 */
export function buildCopyToGuestArgs(vmName, hostPath, guestPath, username, passwordFilePath) {
  return ['guestcontrol', vmName, 'copyto', hostPath, guestPath, '--username', username, '--password-file', passwordFilePath];
}

export function buildGuestRunArgs(vmName, guestPath, username, passwordFilePath, timeoutMs) {
  return [
    'guestcontrol', vmName, 'run',
    '--exe', guestPath,
    '--username', username,
    '--password-file', passwordFilePath,
    '--timeout', String(timeoutMs),
    '--',
    guestPath,
  ];
}

/** Fixed, non-attacker-controlled guest-side directory the sample is always copied into. */
export function buildGuestSamplePath(platform, sanitizedFilename) {
  return platform === 'windows'
    ? `C:\\ThreatCaddySample\\${sanitizedFilename}`
    : `/tmp/threatcaddy-sample/${sanitizedFilename}`;
}

// ── Output parsers ──────────────────────────────────────────────────────────

/** Parses `VBoxManage list vms` — lines look like: "Ubuntu Sandbox" {b1a2c3d4-...} */
export function parseListVmsOutput(stdout) {
  const results = [];
  const re = /^"(.+)"\s+\{([0-9a-fA-F-]+)\}\s*$/;
  for (const line of String(stdout).split(/\r?\n/)) {
    const m = re.exec(line.trim());
    if (m) results.push({ name: m[1], uuid: m[2] });
  }
  return results;
}

/**
 * Parses `VBoxManage snapshot <vm> list --machinereadable` key=value output. Real
 * VBoxManage output emits each snapshot's SnapshotName-<n> line before its
 * SnapshotUUID-<n> line, so pairing must key off the shared numeric suffix rather
 * than scan order (a stateful "last UUID seen" pairing silently attaches the wrong
 * UUID to every snapshot, off by one — caught by this module's own test suite).
 */
export function parseSnapshotListOutput(stdout) {
  const names = new Map(); // suffix -> name, insertion-ordered
  const uuids = new Map(); // suffix -> uuid
  const nameRe = /^SnapshotName(-\d+)?="(.*)"$/;
  const uuidRe = /^SnapshotUUID(-\d+)?="(.*)"$/;
  for (const rawLine of String(stdout).split(/\r?\n/)) {
    const line = rawLine.trim();
    const nameMatch = nameRe.exec(line);
    if (nameMatch) { names.set(nameMatch[1] ?? '', nameMatch[2]); continue; }
    const uuidMatch = uuidRe.exec(line);
    if (uuidMatch) { uuids.set(uuidMatch[1] ?? '', uuidMatch[2]); continue; }
  }
  const results = [];
  for (const [suffix, name] of names) {
    results.push({ name, uuid: uuids.get(suffix) ?? null });
  }
  return results;
}

/** Parses `VBoxManage list hostonlyifs` — extracts adapter Name: lines. */
export function parseHostOnlyInterfacesOutput(stdout) {
  const results = [];
  for (const line of String(stdout).split(/\r?\n/)) {
    const m = /^Name:\s*(.+)$/.exec(line.trim());
    if (m) results.push(m[1].trim());
  }
  return results;
}

// ── Detonation job state machine ────────────────────────────────────────────
// Pure reducer: given a current state and an event, returns the next state (or throws
// on an invalid transition). vm-sandbox.mjs drives this by calling `transition()` as
// each real-world step completes; this module has no idea what a "real VBoxManage call"
// is — it only enforces the ALLOWED ORDER of steps, in particular that a post-run
// snapshot restore is reachable from every terminal outcome (success, timeout, error).

export const DETONATION_STATES = Object.freeze({
  QUEUED: 'queued',
  RESTORING_PRE: 'restoring-pre',
  CONFIGURING_NETWORK: 'configuring-network',
  STARTING: 'starting',
  COPYING_IN: 'copying-in',
  RUNNING: 'running',
  TIMED_OUT: 'timed-out',
  POWERING_OFF: 'powering-off',
  RESTORING_POST: 'restoring-post',
  PACKAGING: 'packaging',
  COMPLETE: 'complete',
  ERROR: 'error',
});

const S = DETONATION_STATES;

// Map of state -> allowed next states. RESTORING_POST is reachable from every
// in-progress state (including after an error at any prior step) so the "always revert"
// guarantee holds regardless of where a run fails.
const TRANSITIONS = {
  [S.QUEUED]: [S.RESTORING_PRE, S.ERROR],
  [S.RESTORING_PRE]: [S.CONFIGURING_NETWORK, S.ERROR],
  [S.CONFIGURING_NETWORK]: [S.STARTING, S.ERROR],
  [S.STARTING]: [S.COPYING_IN, S.ERROR],
  [S.COPYING_IN]: [S.RUNNING, S.ERROR],
  [S.RUNNING]: [S.TIMED_OUT, S.POWERING_OFF, S.ERROR],
  [S.TIMED_OUT]: [S.POWERING_OFF],
  [S.POWERING_OFF]: [S.RESTORING_POST, S.ERROR],
  [S.RESTORING_POST]: [S.PACKAGING, S.ERROR],
  [S.PACKAGING]: [S.COMPLETE, S.ERROR],
  [S.COMPLETE]: [],
  [S.ERROR]: [S.RESTORING_POST], // an error at any step still routes through a final restore attempt
};

export class DetonationJobStateMachine {
  constructor(jobId) {
    this.jobId = jobId;
    this.state = S.QUEUED;
    this.history = [{ state: S.QUEUED, at: Date.now() }];
    this.error = null;
  }

  /** True once RESTORING_POST has been reached at least once — the safety-critical guarantee. */
  get hasAttemptedFinalRestore() {
    return this.history.some((h) => h.state === S.RESTORING_POST);
  }

  transition(next, meta = {}) {
    const allowed = TRANSITIONS[this.state] ?? [];
    if (!allowed.includes(next)) {
      throw new Error(`Invalid detonation job transition: ${this.state} -> ${next}`);
    }
    if (next === S.ERROR && meta.error) this.error = meta.error;
    this.state = next;
    this.history.push({ state: next, at: Date.now(), ...meta });
    return this.state;
  }

  isTerminal() {
    return this.state === S.COMPLETE || (this.state === S.ERROR && this.hasAttemptedFinalRestore);
  }
}
