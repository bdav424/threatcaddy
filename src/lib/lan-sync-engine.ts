/**
 * LAN sync engine — Dexie snapshot export/import for peer-to-peer LAN sync.
 * No network calls here; transport is handled by the desktop sync server
 * (desktop/sync-server.mjs) and the mobile PWA (MobileSyncSettings.tsx).
 */

import { db } from '../db';
import type { Dexie as DexieType } from 'dexie';

const dynamicDb = db as unknown as DexieType;

export interface SyncSnapshot {
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

export interface SyncResult {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const SNAPSHOT_VERSION = 1;

// All user-data tables included in LAN sync snapshots.
// Internal tables (_syncQueue, _syncMeta, activityLog, enrichmentCache) are excluded
// because they are device-specific or ephemeral.
const LAN_SYNC_TABLES = [
  'folders',
  'notes',
  'tasks',
  'tags',
  'timelineEvents',
  'timelines',
  'whiteboards',
  'standaloneIOCs',
  'evidenceItems',
  'chatThreads',
  'journalPages',
  'networkDevices',
  'virtualCaddyJobs',
  'syncAuthSettings',
  'agentProfiles',
  'agentDeployments',
  'noteTemplates',
  'playbookTemplates',
] as const;

export async function exportSyncSnapshot(): Promise<SyncSnapshot> {
  const tables: Record<string, unknown[]> = {};
  await Promise.all(
    LAN_SYNC_TABLES.map(async (name) => {
      try {
        tables[name] = await dynamicDb.table(name).toArray();
      } catch {
        tables[name] = [];
      }
    }),
  );
  return {
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

function getTimestamp(record: unknown): number {
  const r = record as Record<string, unknown>;
  const ts = r['updatedAt'] ?? r['createdAt'];
  if (typeof ts === 'string') return new Date(ts).getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

export async function importSyncSnapshot(
  remote: SyncSnapshot,
  strategy: 'newer-wins' | 'remote-wins' = 'newer-wins',
): Promise<SyncResult> {
  const result: SyncResult = { added: 0, updated: 0, skipped: 0, errors: [] };

  for (const [tableName, remoteRows] of Object.entries(remote.tables)) {
    if (!Array.isArray(remoteRows) || remoteRows.length === 0) continue;

    try {
      const toPut: unknown[] = [];

      if (strategy === 'remote-wins') {
        toPut.push(...remoteRows);
        result.added += remoteRows.length;
      } else {
        // newer-wins: compare updatedAt/createdAt for existing records
        const typedRows = remoteRows as Record<string, unknown>[];
        const ids = typedRows.map((r) => r['id']).filter(Boolean) as string[];

        const existing = ids.length > 0
          ? ((await dynamicDb.table(tableName).bulkGet(ids)) as (Record<string, unknown> | undefined)[])
          : [];

        const localMap = new Map<string, Record<string, unknown>>();
        for (let i = 0; i < ids.length; i++) {
          const row = existing[i];
          if (row) localMap.set(ids[i], row);
        }

        for (const remoteRow of typedRows) {
          const id = remoteRow['id'] as string;
          if (!id) continue;
          const localRow = localMap.get(id);
          if (!localRow) {
            toPut.push(remoteRow);
            result.added++;
          } else if (getTimestamp(remoteRow) > getTimestamp(localRow)) {
            toPut.push(remoteRow);
            result.updated++;
          } else {
            result.skipped++;
          }
        }
      }

      if (toPut.length > 0) {
        await dynamicDb.table(tableName).bulkPut(toPut);
      }
    } catch (err) {
      result.errors.push(`${tableName}: ${(err as Error).message}`);
    }
  }

  return result;
}
