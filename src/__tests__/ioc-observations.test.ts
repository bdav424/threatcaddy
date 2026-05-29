import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { upsertIOCObservations } from '../lib/ioc-observations';
import type { IOCEntry } from '../types';

function entry(value = 'evil.example.com'): IOCEntry {
  return {
    id: `ioc-${value}`,
    type: 'domain',
    value,
    confidence: 'medium',
    firstSeen: 1000,
    dismissed: false,
  };
}

describe('upsertIOCObservations', () => {
  beforeEach(async () => {
    vi.useRealTimers();
    await db.standaloneIOCs.clear();
  });

  it('creates standalone IOC rows from note observations', async () => {
    const result = await upsertIOCObservations([entry()], {
      folderId: 'folder-1',
      source: { kind: 'note', id: 'note-1', title: 'Daily notes' },
    });

    expect(result.created).toHaveLength(1);
    const stored = await db.standaloneIOCs.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      type: 'domain',
      value: 'evil.example.com',
      folderId: 'folder-1',
      linkedNoteIds: ['note-1'],
      firstSeen: 1000,
    });
    expect(stored[0].lastSeen).toBeGreaterThanOrEqual(stored[0].createdAt);
    expect(stored[0].tags).toContain('source:note');
  });

  it('updates lastSeen and source links when the IOC already exists', async () => {
    const first = await upsertIOCObservations([entry()], {
      folderId: 'folder-1',
      source: { kind: 'note', id: 'note-1', title: 'First note' },
    });
    const firstSeen = first.created[0].firstSeen;
    const firstLastSeen = first.created[0].lastSeen;

    await new Promise((resolve) => setTimeout(resolve, 2));

    const second = await upsertIOCObservations([entry('EVIL.EXAMPLE.COM')], {
      folderId: 'folder-1',
      source: { kind: 'evidence', id: 'evidence-1', fileName: 'iocs.txt' },
    });

    expect(second.created).toHaveLength(0);
    expect(second.updated).toHaveLength(1);
    const stored = await db.standaloneIOCs.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0].firstSeen).toBe(firstSeen);
    expect(stored[0].lastSeen).toBeGreaterThanOrEqual(firstLastSeen || 0);
    expect(stored[0].linkedNoteIds).toEqual(['note-1']);
    expect(stored[0].linkedEvidenceIds).toEqual(['evidence-1']);
    expect(stored[0].tags).toEqual(expect.arrayContaining(['source:note', 'source:evidence']));
  });
});
