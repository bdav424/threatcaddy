import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { autoEnrichImportedIOCs } from '../lib/ioc-auto-enrichment';
import type { StandaloneIOC } from '../types';

function makeIOC(overrides: Partial<StandaloneIOC> = {}): StandaloneIOC {
  const now = Date.now();
  return {
    id: overrides.id || 'ioc-1',
    type: overrides.type || 'domain',
    value: overrides.value || 'evil.example.com',
    confidence: overrides.confidence || 'medium',
    folderId: overrides.folderId || 'folder-1',
    tags: overrides.tags || ['source:evidence'],
    relationships: overrides.relationships || [],
    trashed: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('autoEnrichImportedIOCs', () => {
  beforeEach(async () => {
    await db.standaloneIOCs.clear();
  });

  it('marks extracted evidence IOCs as skipped when VirusTotal is not installed', async () => {
    const ioc = makeIOC();
    await db.standaloneIOCs.add(ioc);
    const onComplete = vi.fn();

    const stats = await autoEnrichImportedIOCs([ioc], {
      getInstallationsForIOCType: () => [],
      addRun: vi.fn(),
      onComplete,
    });

    expect(stats).toMatchObject({
      queued: 1,
      enriched: 0,
      errors: 0,
      skipped: 1,
      missingIntegration: 1,
    });
    expect(onComplete).toHaveBeenCalledWith(stats);
    const stored = await db.standaloneIOCs.get(ioc.id);
    expect(stored?.tags).toContain('auto-enrich:vt:skipped');
  });
});
