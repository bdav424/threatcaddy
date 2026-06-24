// src/lib/netmap-bridge.ts
//
// Renderer-side handler for NetworkMap IPC events.
// Constraints (mirroring the desktop-side air-gap invariants):
//   - NO fetch, WebSocket, exec, or postMessage to external origins
//   - All DB writes go through the Dexie layer (db.ts)

import { db } from '../db';
import { getNetmapBridge } from './bridges';
import type { NetmapDeviceFoundPayload, NetmapScanCompletePayload } from './bridges';
import type { NetworkDevice, NetworkScanJob } from '../types';

export type { NetmapDeviceFoundPayload, NetmapScanCompletePayload };

// ── Dexie helpers ────────────────────────────────────────────────────────────

export async function getNetmapScanJobs(investigationId: string): Promise<NetworkScanJob[]> {
  return db.networkScanJobs
    .where('investigationId')
    .equals(investigationId)
    .reverse()
    .sortBy('startedAt');
}

export async function getNetmapDevices(scanJobId: string): Promise<NetworkDevice[]> {
  return db.networkDevices
    .where('scanJobId')
    .equals(scanJobId)
    .sortBy('ip');
}

export async function getNetmapDevicesByInvestigation(investigationId: string): Promise<NetworkDevice[]> {
  return db.networkDevices
    .where('investigationId')
    .equals(investigationId)
    .sortBy('ip');
}

export async function createNetmapScanJob(
  investigationId: string,
  scanJobId: string,
  subnet: string,
  startedAt: string,
): Promise<void> {
  const job: NetworkScanJob = {
    id: scanJobId,
    investigationId,
    subnet,
    status: 'running',
    startedAt,
    deviceCount: 0,
  };
  await db.networkScanJobs.put(job);
}

// ── IPC event handlers ───────────────────────────────────────────────────────

async function handleDeviceFound(payload: NetmapDeviceFoundPayload): Promise<void> {
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
  } satisfies NetworkDevice);
}

async function handleScanComplete(payload: NetmapScanCompletePayload): Promise<void> {
  const { scanJobId, completedAt, deviceCount, errorMessage } = payload;
  await db.networkScanJobs.update(scanJobId, {
    status: errorMessage ? 'error' : 'complete',
    completedAt,
    deviceCount,
    errorMessage,
  });
}

// ── Subscription registration ────────────────────────────────────────────────

interface NetmapBridgeSubscription {
  unsubscribe: () => void;
}

export function registerNetmapRendererHandlers(
  onDeviceFoundUi?: (payload: NetmapDeviceFoundPayload) => void,
  onScanCompleteUi?: (payload: NetmapScanCompletePayload) => void,
): NetmapBridgeSubscription {
  const bridge = getNetmapBridge();
  if (!bridge) return { unsubscribe: () => {} };

  const unsubDevice = bridge.onDeviceFound(async (payload) => {
    try {
      await handleDeviceFound(payload);
    } catch (err) {
      console.error('[NetmapBridge] handleDeviceFound error:', err);
    }
    onDeviceFoundUi?.(payload);
  });

  const unsubComplete = bridge.onScanComplete(async (payload) => {
    try {
      await handleScanComplete(payload);
    } catch (err) {
      console.error('[NetmapBridge] handleScanComplete error:', err);
    }
    onScanCompleteUi?.(payload);
  });

  return {
    unsubscribe: () => {
      unsubDevice();
      unsubComplete();
    },
  };
}
