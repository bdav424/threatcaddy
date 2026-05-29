import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { normalizeIOCEnrichment, persistIOCIntegrationUpdate } from '../lib/ioc-enrichment-persistence';
import type { StandaloneIOC } from '../types';

function makeIOC(overrides: Partial<StandaloneIOC> = {}): StandaloneIOC {
  return {
    id: 'ioc-1',
    type: 'domain',
    value: 'evil.example',
    confidence: 'medium',
    folderId: 'case-1',
    tags: ['existing'],
    trashed: false,
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('persistIOCIntegrationUpdate', () => {
  beforeEach(async () => {
    await db.standaloneIOCs.clear();
  });

  it('promotes extracted IOCs into standalone rows with normalized enrichment metadata', async () => {
    const persisted = await persistIOCIntegrationUpdate({
      ioc: { id: 'note-note-1-ioc-1', value: 'evil.example', type: 'domain', confidence: 'low' },
      folderId: 'case-1',
      source: { kind: 'note', id: 'note-1', title: 'Suspicious domains' },
      fields: {
        iocStatus: 'malicious',
        confidence: 'high',
        enrichment: {
          virusTotal: { malicious: 3, suspicious: 1, harmless: 50, undetected: 16, registrar: 'Example Registrar' },
        },
      },
    });

    const storedRows = await db.standaloneIOCs.toArray();
    expect(storedRows).toHaveLength(1);
    expect(persisted.id).toBe(storedRows[0].id);
    expect(storedRows[0]).toMatchObject({
      value: 'evil.example',
      type: 'domain',
      confidence: 'high',
      iocStatus: 'malicious',
      folderId: 'case-1',
      linkedNoteIds: ['note-1'],
    });
    expect(storedRows[0].tags).toEqual(expect.arrayContaining(['source:note', 'source:integration']));
    expect(storedRows[0].analystNotes).toContain('Suspicious domains');
    expect(storedRows[0].enrichment?.virusTotal).toHaveLength(1);
    expect(storedRows[0].enrichment?.virusTotal?.[0]).toMatchObject({
      malicious: 3,
      registrar: 'Example Registrar',
      source: 'integration',
    });
    expect(typeof storedRows[0].enrichment?.virusTotal?.[0].ts).toBe('number');
  });

  it('merges legacy object-shaped enrichment into snapshot arrays', async () => {
    await db.standaloneIOCs.add(makeIOC({
      enrichment: {
        virusTotal: { malicious: 1, total: 70, ts: 111 },
      } as never,
    }));

    const updated = await persistIOCIntegrationUpdate({
      ioc: { id: 'ioc-1', value: 'evil.example', type: 'domain', confidence: 'medium' },
      folderId: 'case-1',
      fields: {
        enrichment: {
          virusTotal: { malicious: 4, total: 71 },
        },
      },
    });

    expect(updated.tags).toEqual(expect.arrayContaining(['existing', 'source:integration']));
    expect(updated.enrichment?.virusTotal).toHaveLength(2);
    expect(updated.enrichment?.virusTotal?.[0]).toMatchObject({ malicious: 4, total: 71, source: 'integration' });
    expect(updated.enrichment?.virusTotal?.[1]).toMatchObject({ malicious: 1, total: 70, source: 'existing' });
  });
});

describe('normalizeIOCEnrichment', () => {
  it('drops empty providers and caps provider snapshots', () => {
    const snapshots = Array.from({ length: 25 }, (_, index) => ({ malicious: index }));
    const normalized = normalizeIOCEnrichment({ virusTotal: snapshots, empty: null }, 1234, 'test');
    expect(normalized?.virusTotal).toHaveLength(20);
    expect(normalized?.virusTotal?.[0]).toMatchObject({ malicious: 0, ts: 1234, source: 'test' });
    expect(normalized).not.toHaveProperty('empty');
  });
});
