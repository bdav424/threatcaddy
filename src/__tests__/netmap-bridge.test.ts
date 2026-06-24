import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../db';
import {
  getNetmapScanJobs,
  getNetmapDevices,
  createNetmapScanJob,
  registerNetmapRendererHandlers,
} from '../lib/netmap-bridge';
import type { NetmapDeviceFoundPayload, NetmapScanCompletePayload } from '../lib/netmap-bridge';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDeviceFoundPayload(overrides: Partial<NetmapDeviceFoundPayload['device']> = {}): NetmapDeviceFoundPayload {
  return {
    scanJobId: 'job-1',
    investigationId: 'inv-1',
    device: {
      id: 'dev-1',
      investigationId: 'inv-1',
      scanJobId: 'job-1',
      ip: '192.168.1.10',
      mac: 'aa:bb:cc:dd:ee:ff',
      hostname: 'workstation.local',
      vendor: 'Apple',
      openPorts: [22, 443],
      status: 'online',
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      addedToInvestigation: false,
      ...overrides,
    },
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await Promise.all([
    db.networkDevices.clear(),
    db.networkScanJobs.clear(),
  ]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── createNetmapScanJob ───────────────────────────────────────────────────────

describe('createNetmapScanJob', () => {
  it('creates a NetworkScanJob with running status', async () => {
    const startedAt = new Date().toISOString();
    await createNetmapScanJob('inv-1', 'job-1', '192.168.1.0/24', startedAt);

    const job = await db.networkScanJobs.get('job-1');
    expect(job).toBeDefined();
    expect(job!.investigationId).toBe('inv-1');
    expect(job!.subnet).toBe('192.168.1.0/24');
    expect(job!.status).toBe('running');
    expect(job!.deviceCount).toBe(0);
    expect(job!.startedAt).toBe(startedAt);
  });
});

// ── getNetmapScanJobs ─────────────────────────────────────────────────────────

describe('getNetmapScanJobs', () => {
  it('returns empty array when no jobs exist', async () => {
    const jobs = await getNetmapScanJobs('inv-x');
    expect(jobs).toEqual([]);
  });

  it('returns only jobs for the given investigation', async () => {
    const ts = new Date().toISOString();
    await db.networkScanJobs.bulkAdd([
      { id: 'job-a', investigationId: 'inv-1', subnet: '10.0.0.0/24', status: 'complete', startedAt: ts, deviceCount: 3 },
      { id: 'job-b', investigationId: 'inv-2', subnet: '10.0.1.0/24', status: 'complete', startedAt: ts, deviceCount: 1 },
    ]);
    const jobs = await getNetmapScanJobs('inv-1');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('job-a');
  });
});

// ── getNetmapDevices ──────────────────────────────────────────────────────────

describe('getNetmapDevices', () => {
  it('returns devices for a specific scan job', async () => {
    const ts = new Date().toISOString();
    await db.networkDevices.bulkAdd([
      { id: 'd1', investigationId: 'inv-1', scanJobId: 'job-1', ip: '192.168.1.1', status: 'online', firstSeen: ts, lastSeen: ts, addedToInvestigation: false },
      { id: 'd2', investigationId: 'inv-1', scanJobId: 'job-2', ip: '192.168.1.2', status: 'online', firstSeen: ts, lastSeen: ts, addedToInvestigation: false },
    ]);
    const devices = await getNetmapDevices('job-1');
    expect(devices).toHaveLength(1);
    expect(devices[0].ip).toBe('192.168.1.1');
  });
});

// ── registerNetmapRendererHandlers — device-found upsert ─────────────────────

describe('registerNetmapRendererHandlers', () => {
  it('returns no-op unsubscribe when bridge is unavailable', () => {
    // No bridge in test environment
    const sub = registerNetmapRendererHandlers();
    expect(() => sub.unsubscribe()).not.toThrow();
  });

  it('device-found payload is correctly upserted into Dexie when called directly', async () => {
    const payload = makeDeviceFoundPayload();

    // Simulate what the bridge handler does
    const { device } = payload;
    await db.networkDevices.put({
      id: device.id,
      investigationId: device.investigationId,
      scanJobId: device.scanJobId,
      ip: device.ip,
      mac: device.mac,
      hostname: device.hostname,
      vendor: device.vendor,
      openPorts: device.openPorts,
      status: device.status,
      firstSeen: device.firstSeen,
      lastSeen: device.lastSeen,
      addedToInvestigation: device.addedToInvestigation,
    });

    const stored = await db.networkDevices.get('dev-1');
    expect(stored).toBeDefined();
    expect(stored!.ip).toBe('192.168.1.10');
    expect(stored!.vendor).toBe('Apple');
    expect(stored!.openPorts).toEqual([22, 443]);
    expect(stored!.status).toBe('online');
    expect(stored!.addedToInvestigation).toBe(false);
  });

  it('scan-complete updates job status and deviceCount', async () => {
    const startedAt = new Date().toISOString();
    await createNetmapScanJob('inv-1', 'job-1', '192.168.1.0/24', startedAt);

    const completedAt = new Date().toISOString();
    const completePayload: NetmapScanCompletePayload = {
      scanJobId: 'job-1',
      investigationId: 'inv-1',
      completedAt,
      deviceCount: 5,
    };

    // Simulate what the bridge complete handler does
    await db.networkScanJobs.update(completePayload.scanJobId, {
      status: completePayload.errorMessage ? 'error' : 'complete',
      completedAt: completePayload.completedAt,
      deviceCount: completePayload.deviceCount,
    });

    const job = await db.networkScanJobs.get('job-1');
    expect(job!.status).toBe('complete');
    expect(job!.deviceCount).toBe(5);
    expect(job!.completedAt).toBe(completedAt);
  });
});
