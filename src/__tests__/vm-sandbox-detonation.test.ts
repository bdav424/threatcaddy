import { describe, it, expect } from 'vitest';
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
} from '../../desktop/vm-sandbox-detonation.mjs';

// This module encodes the safety-critical guarantees for VirtualCaddy's VM Sandbox
// (Phase 2): every network mode maps to host-only VirtualBox networking only (never
// NAT/bridged — real internet egress is out of scope by design, not just policy), and
// every detonation job's state machine always routes through a final snapshot restore
// regardless of how the run ends. These tests exist to catch a regression in either
// guarantee, not just to exercise the happy path.

describe('isSafeVmOrSnapshotName', () => {
  it('accepts an ordinary VM name', () => {
    expect(isSafeVmOrSnapshotName('Ubuntu Sandbox')).toBe(true);
  });

  it('rejects names containing path separators', () => {
    expect(isSafeVmOrSnapshotName('../etc/passwd')).toBe(false);
    expect(isSafeVmOrSnapshotName('foo\\bar')).toBe(false);
  });

  it('rejects control characters', () => {
    expect(isSafeVmOrSnapshotName('name\x00injected')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isSafeVmOrSnapshotName(null)).toBe(false);
    expect(isSafeVmOrSnapshotName(undefined)).toBe(false);
    expect(isSafeVmOrSnapshotName(42)).toBe(false);
  });
});

describe('sanitizeGuestFilename', () => {
  it('keeps an already-safe filename', () => {
    expect(sanitizeGuestFilename('sample.exe')).toBe('sample.exe');
  });

  it('strips directory components from a path-traversal attempt', () => {
    expect(sanitizeGuestFilename('../../windows/system32/evil.exe')).toBe('evil.exe');
    expect(sanitizeGuestFilename('..\\..\\windows\\system32\\evil.exe')).toBe('evil.exe');
  });

  it('replaces unsafe characters', () => {
    expect(sanitizeGuestFilename('sam;ple $(whoami).exe')).toBe('sam_ple___whoami_.exe');
  });

  it('never returns a filename starting with a dot', () => {
    expect(sanitizeGuestFilename('.hidden')).not.toMatch(/^\./);
  });

  it('falls back to a default name for empty/degenerate input', () => {
    expect(sanitizeGuestFilename('')).toBe('sample.bin');
    expect(sanitizeGuestFilename('...')).not.toBe('');
  });
});

describe('argument builders never emit shell metacharacters as a single string', () => {
  it('all builders return arrays, never a joined string', () => {
    const results = [
      buildListVmsArgs(),
      buildListSnapshotsArgs('vm'),
      buildNetworkModeArgs('vm', 'vboxnet0'),
      buildRestoreSnapshotArgs('vm', 'clean'),
      buildStartVmArgs('vm'),
      buildPoweroffArgs('vm'),
      buildScreenshotArgs('vm', '/tmp/out.png'),
      buildCopyToGuestArgs('vm', '/host/sample.exe', 'C:\\ThreatCaddySample\\sample.exe', 'analyst', '/tmp/pw.txt'),
      buildGuestRunArgs('vm', 'C:\\ThreatCaddySample\\sample.exe', 'analyst', '/tmp/pw.txt', 60000),
    ];
    for (const r of results) expect(Array.isArray(r)).toBe(true);
  });

  it('buildNetworkModeArgs always requests hostonly, never nat or bridged', () => {
    const args = buildNetworkModeArgs('vm', 'vboxnet0');
    expect(args).toContain('hostonly');
    expect(args).not.toContain('nat');
    expect(args).not.toContain('bridged');
  });

  it('guest auth commands pass the password via --password-file, never a bare --password value', () => {
    const copyArgs = buildCopyToGuestArgs('vm', '/host/sample.exe', 'C:\\ThreatCaddySample\\sample.exe', 'analyst', '/tmp/tc-pw-123.txt');
    const runArgs = buildGuestRunArgs('vm', 'C:\\ThreatCaddySample\\sample.exe', 'analyst', '/tmp/tc-pw-123.txt', 60000);
    for (const args of [copyArgs, runArgs]) {
      expect(args).toContain('--password-file');
      expect(args).not.toContain('--password');
      expect(args).toContain('/tmp/tc-pw-123.txt');
    }
  });
});

describe('buildGuestSamplePath', () => {
  it('always places the sample under a fixed, non-attacker-controlled directory', () => {
    expect(buildGuestSamplePath('windows', 'evil.exe')).toBe('C:\\ThreatCaddySample\\evil.exe');
    expect(buildGuestSamplePath('posix', 'evil.bin')).toBe('/tmp/threatcaddy-sample/evil.bin');
  });
});

describe('parseListVmsOutput', () => {
  it('parses standard VBoxManage list vms output', () => {
    const stdout = '"Ubuntu Sandbox" {b1a2c3d4-1111-2222-3333-444455556666}\n"Win10 Sandbox" {aaaaaaaa-1111-2222-3333-444455556666}\n';
    expect(parseListVmsOutput(stdout)).toEqual([
      { name: 'Ubuntu Sandbox', uuid: 'b1a2c3d4-1111-2222-3333-444455556666' },
      { name: 'Win10 Sandbox', uuid: 'aaaaaaaa-1111-2222-3333-444455556666' },
    ]);
  });

  it('returns an empty array for empty/garbage output', () => {
    expect(parseListVmsOutput('')).toEqual([]);
    expect(parseListVmsOutput('not a vm line')).toEqual([]);
  });
});

describe('parseSnapshotListOutput', () => {
  it('parses machine-readable snapshot listing', () => {
    const stdout = [
      'SnapshotName="Clean Base"',
      'SnapshotUUID="11111111-1111-1111-1111-111111111111"',
      'SnapshotName-1="After Updates"',
      'SnapshotUUID-1="22222222-2222-2222-2222-222222222222"',
    ].join('\n');
    expect(parseSnapshotListOutput(stdout)).toEqual([
      { name: 'Clean Base', uuid: '11111111-1111-1111-1111-111111111111' },
      { name: 'After Updates', uuid: '22222222-2222-2222-2222-222222222222' },
    ]);
  });
});

describe('parseHostOnlyInterfacesOutput', () => {
  it('extracts adapter names', () => {
    const stdout = 'Name:            vboxnet0\nGUID:            786f6276-656e-4074-8000-0a0027000000\n\nName:            vboxnet1\n';
    expect(parseHostOnlyInterfacesOutput(stdout)).toEqual(['vboxnet0', 'vboxnet1']);
  });
});

describe('DetonationJobStateMachine', () => {
  it('follows the happy path from queued to complete', () => {
    const job = new DetonationJobStateMachine('job-1');
    expect(job.state).toBe(DETONATION_STATES.QUEUED);
    job.transition(DETONATION_STATES.RESTORING_PRE);
    job.transition(DETONATION_STATES.CONFIGURING_NETWORK);
    job.transition(DETONATION_STATES.STARTING);
    job.transition(DETONATION_STATES.COPYING_IN);
    job.transition(DETONATION_STATES.RUNNING);
    job.transition(DETONATION_STATES.POWERING_OFF);
    job.transition(DETONATION_STATES.RESTORING_POST);
    job.transition(DETONATION_STATES.PACKAGING);
    job.transition(DETONATION_STATES.COMPLETE);
    expect(job.state).toBe(DETONATION_STATES.COMPLETE);
    expect(job.hasAttemptedFinalRestore).toBe(true);
    expect(job.isTerminal()).toBe(true);
  });

  it('rejects skipping states out of order', () => {
    const job = new DetonationJobStateMachine('job-2');
    expect(() => job.transition(DETONATION_STATES.RUNNING)).toThrow(/Invalid detonation job transition/);
  });

  it('routes a mid-run timeout through poweroff and a final restore', () => {
    const job = new DetonationJobStateMachine('job-3');
    job.transition(DETONATION_STATES.RESTORING_PRE);
    job.transition(DETONATION_STATES.CONFIGURING_NETWORK);
    job.transition(DETONATION_STATES.STARTING);
    job.transition(DETONATION_STATES.COPYING_IN);
    job.transition(DETONATION_STATES.RUNNING);
    job.transition(DETONATION_STATES.TIMED_OUT);
    job.transition(DETONATION_STATES.POWERING_OFF);
    job.transition(DETONATION_STATES.RESTORING_POST);
    expect(job.hasAttemptedFinalRestore).toBe(true);
  });

  it('routes an error at every possible step through a final restore attempt', () => {
    const failableStates = [
      DETONATION_STATES.RESTORING_PRE,
      DETONATION_STATES.CONFIGURING_NETWORK,
      DETONATION_STATES.STARTING,
      DETONATION_STATES.COPYING_IN,
      DETONATION_STATES.RUNNING,
    ];
    for (const failAt of failableStates) {
      const job = new DetonationJobStateMachine(`job-fail-${failAt}`);
      const order = [
        DETONATION_STATES.RESTORING_PRE,
        DETONATION_STATES.CONFIGURING_NETWORK,
        DETONATION_STATES.STARTING,
        DETONATION_STATES.COPYING_IN,
        DETONATION_STATES.RUNNING,
      ];
      for (const s of order) {
        job.transition(s);
        if (s === failAt) break;
      }
      job.transition(DETONATION_STATES.ERROR, { error: `boom at ${failAt}` });
      expect(job.state).toBe(DETONATION_STATES.ERROR);
      // The safety guarantee: even after an error, ERROR must still be able to route to
      // a final restore attempt — this must not throw.
      expect(() => job.transition(DETONATION_STATES.RESTORING_POST)).not.toThrow();
      expect(job.hasAttemptedFinalRestore).toBe(true);
    }
  });

  it('does not report terminal on a bare error before a final restore attempt', () => {
    const job = new DetonationJobStateMachine('job-4');
    job.transition(DETONATION_STATES.RESTORING_PRE);
    job.transition(DETONATION_STATES.ERROR, { error: 'snapshot restore failed' });
    expect(job.isTerminal()).toBe(false);
    expect(job.error).toBe('snapshot restore failed');
  });

  it('a failed final restore still marks the job terminal (no infinite retry)', () => {
    const job = new DetonationJobStateMachine('job-5');
    job.transition(DETONATION_STATES.RESTORING_PRE);
    job.transition(DETONATION_STATES.CONFIGURING_NETWORK);
    job.transition(DETONATION_STATES.STARTING);
    job.transition(DETONATION_STATES.COPYING_IN);
    job.transition(DETONATION_STATES.RUNNING);
    job.transition(DETONATION_STATES.POWERING_OFF);
    job.transition(DETONATION_STATES.RESTORING_POST);
    job.transition(DETONATION_STATES.ERROR, { error: 'restore itself failed' });
    expect(job.isTerminal()).toBe(true);
  });
});
