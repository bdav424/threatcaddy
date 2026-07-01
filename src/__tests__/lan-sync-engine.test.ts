import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock ../db ─────────────────────────────────────────────────────────────────
const {
  mockToArray,
  mockBulkGet,
  mockBulkPut,
} = vi.hoisted(() => {
  const mockToArray = vi.fn().mockResolvedValue([]);
  const mockBulkGet = vi.fn().mockResolvedValue([]);
  const mockBulkPut = vi.fn().mockResolvedValue(undefined);
  return { mockToArray, mockBulkGet, mockBulkPut };
});

vi.mock('../db', () => {
  const tableFactory = () => ({
    toArray: mockToArray,
    bulkGet: mockBulkGet,
    bulkPut: mockBulkPut,
  });
  return {
    db: new Proxy({}, {
      get: (_t, prop) => {
        if (prop === 'table') return () => tableFactory();
        return tableFactory();
      },
    }),
  };
});

import { exportSyncSnapshot, importSyncSnapshot } from '../lib/lan-sync-engine';
import type { SyncSnapshot } from '../lib/lan-sync-engine';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeNote(id: string, updatedAt: string): Record<string, unknown> {
  return { id, title: `Note ${id}`, updatedAt, createdAt: updatedAt };
}

function makeSnapshot(tables: SyncSnapshot['tables']): SyncSnapshot {
  return { version: 1, exportedAt: new Date().toISOString(), tables };
}

// ── exportSyncSnapshot ─────────────────────────────────────────────────────────

describe('exportSyncSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToArray.mockResolvedValue([]);
  });

  it('returns a snapshot with version and exportedAt', async () => {
    const snap = await exportSyncSnapshot();
    expect(snap.version).toBe(1);
    expect(snap.exportedAt).toBeTruthy();
    expect(new Date(snap.exportedAt).getTime()).toBeGreaterThan(0);
  });

  it('includes all expected table keys', async () => {
    const snap = await exportSyncSnapshot();
    const keys = Object.keys(snap.tables);
    expect(keys).toContain('folders');
    expect(keys).toContain('notes');
    expect(keys).toContain('tasks');
    expect(keys).toContain('tags');
    expect(keys).toContain('timelineEvents');
    expect(keys).toContain('timelines');
    expect(keys).toContain('whiteboards');
    expect(keys).toContain('standaloneIOCs');
    expect(keys).toContain('evidenceItems');
    expect(keys).toContain('chatThreads');
    expect(keys).toContain('journalPages');
    expect(keys).toContain('networkDevices');
    expect(keys).toContain('virtualCaddyJobs');
    expect(keys).toContain('syncAuthSettings');
  });

  it('returns row data from each table', async () => {
    const noteRow = makeNote('n1', '2025-01-01T00:00:00Z');
    mockToArray.mockResolvedValue([noteRow]);
    const snap = await exportSyncSnapshot();
    // Every table should have the same data (mockToArray returns the same for all)
    expect(Array.isArray(snap.tables['notes'])).toBe(true);
    expect((snap.tables['notes'] as unknown[]).length).toBe(1);
    expect((snap.tables['notes'] as Record<string, unknown>[])[0].id).toBe('n1');
  });

  it('returns empty array for tables that throw', async () => {
    mockToArray.mockRejectedValue(new Error('Table missing'));
    const snap = await exportSyncSnapshot();
    // Should not throw; tables default to []
    for (const rows of Object.values(snap.tables)) {
      expect(Array.isArray(rows)).toBe(true);
      expect((rows as unknown[]).length).toBe(0);
    }
  });
});

// ── importSyncSnapshot — newer-wins ───────────────────────────────────────────

describe('importSyncSnapshot — newer-wins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBulkGet.mockResolvedValue([]);
    mockBulkPut.mockResolvedValue(undefined);
  });

  it('adds records that do not exist locally', async () => {
    const remoteNote = makeNote('new-1', '2025-06-01T00:00:00Z');
    mockBulkGet.mockResolvedValue([undefined]); // record not in local DB
    const snap = makeSnapshot({ notes: [remoteNote], tasks: [] });
    const result = await importSyncSnapshot(snap, 'newer-wins');
    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockBulkPut).toHaveBeenCalledWith([remoteNote]);
  });

  it('updates records where remote is newer', async () => {
    const localNote = makeNote('existing-1', '2025-01-01T00:00:00Z');
    const remoteNote = makeNote('existing-1', '2025-06-01T00:00:00Z');
    mockBulkGet.mockResolvedValue([localNote]);
    const snap = makeSnapshot({ notes: [remoteNote], tasks: [] });
    const result = await importSyncSnapshot(snap, 'newer-wins');
    expect(result.updated).toBe(1);
    expect(result.added).toBe(0);
    expect(mockBulkPut).toHaveBeenCalledWith([remoteNote]);
  });

  it('skips records where local is newer', async () => {
    const localNote = makeNote('existing-1', '2025-12-01T00:00:00Z');
    const remoteNote = makeNote('existing-1', '2025-06-01T00:00:00Z');
    mockBulkGet.mockResolvedValue([localNote]);
    const snap = makeSnapshot({ notes: [remoteNote], tasks: [] });
    const result = await importSyncSnapshot(snap, 'newer-wins');
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
    // bulkPut should not have been called with any rows
    const putCalls = mockBulkPut.mock.calls;
    const anyRows = putCalls.some(([rows]) => Array.isArray(rows) && rows.length > 0);
    expect(anyRows).toBe(false);
  });

  it('skips records with equal timestamps', async () => {
    const ts = '2025-06-15T10:00:00Z';
    const localNote = makeNote('same-1', ts);
    const remoteNote = makeNote('same-1', ts);
    mockBulkGet.mockResolvedValue([localNote]);
    const snap = makeSnapshot({ notes: [remoteNote] });
    const result = await importSyncSnapshot(snap, 'newer-wins');
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
  });

  it('handles mixed add/update/skip in a single table', async () => {
    const existing = makeNote('existing', '2025-01-01T00:00:00Z');
    const remoteExisting = makeNote('existing', '2025-06-01T00:00:00Z'); // newer → update
    const remoteNew = makeNote('new-one', '2025-06-01T00:00:00Z');       // missing → add
    const remoteOld = makeNote('old-one', '2024-01-01T00:00:00Z');       // older local → skip

    const localOld = makeNote('old-one', '2025-01-01T00:00:00Z');

    mockBulkGet.mockResolvedValue([existing, undefined, localOld]);

    const snap = makeSnapshot({
      notes: [remoteExisting, remoteNew, remoteOld],
    });
    const result = await importSyncSnapshot(snap, 'newer-wins');
    expect(result.added).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('counts errors but continues other tables', async () => {
    mockBulkPut.mockRejectedValueOnce(new Error('QuotaExceeded'));
    mockBulkGet.mockResolvedValue([undefined]); // triggers a bulkPut
    const snap = makeSnapshot({
      notes: [makeNote('n1', '2025-06-01T00:00:00Z')],
      tasks: [makeNote('t1', '2025-06-01T00:00:00Z')],
    });
    const result = await importSyncSnapshot(snap, 'newer-wins');
    expect(result.errors.length).toBeGreaterThan(0);
    // Other table should still have been attempted
    expect(result.added + result.errors.length).toBeGreaterThan(0);
  });

  it('ignores rows without an id field', async () => {
    const badRow = { title: 'No ID', updatedAt: '2025-06-01T00:00:00Z' };
    const snap = makeSnapshot({ notes: [badRow] });
    const result = await importSyncSnapshot(snap, 'newer-wins');
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('skips empty tables without calling bulkGet or bulkPut', async () => {
    const snap = makeSnapshot({ notes: [], tasks: [] });
    await importSyncSnapshot(snap, 'newer-wins');
    expect(mockBulkGet).not.toHaveBeenCalled();
    expect(mockBulkPut).not.toHaveBeenCalled();
  });
});

// ── importSyncSnapshot — remote-wins ─────────────────────────────────────────

describe('importSyncSnapshot — remote-wins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBulkPut.mockResolvedValue(undefined);
  });

  it('writes all remote rows unconditionally', async () => {
    const rows = [
      makeNote('r1', '2025-01-01T00:00:00Z'),
      makeNote('r2', '2025-06-01T00:00:00Z'),
    ];
    const snap = makeSnapshot({ notes: rows });
    const result = await importSyncSnapshot(snap, 'remote-wins');
    expect(result.added).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(mockBulkGet).not.toHaveBeenCalled(); // no comparison needed
    expect(mockBulkPut).toHaveBeenCalledWith(rows);
  });
});

// ── SyncSnapshot shape ────────────────────────────────────────────────────────

describe('SyncSnapshot shape invariants', () => {
  it('exportedAt is an ISO 8601 string', async () => {
    mockToArray.mockResolvedValue([]);
    const snap = await exportSyncSnapshot();
    expect(() => new Date(snap.exportedAt)).not.toThrow();
    expect(snap.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('tables record has only string-keyed array values', async () => {
    mockToArray.mockResolvedValue([{ id: 'x', updatedAt: '2025-01-01T00:00:00Z' }]);
    const snap = await exportSyncSnapshot();
    for (const [, rows] of Object.entries(snap.tables)) {
      expect(Array.isArray(rows)).toBe(true);
    }
  });
});
