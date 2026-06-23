import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../db';
import {
  getInvestigationVirtualJobs,
  createVirtualCaddyJob,
  handleJobComplete,
} from '../lib/virtual-bridge';
import type { VirtualCaddyJobCompletePayload } from '../lib/virtual-bridge';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeJobPayload(
  overrides: Partial<VirtualCaddyJobCompletePayload> = {},
): VirtualCaddyJobCompletePayload {
  return {
    jobId: 'job-1',
    investigationId: 'inv-1',
    filename: 'sample.exe',
    fileHash: 'a'.repeat(64),
    iocs: [
      { type: 'ipv4', value: '1.2.3.4' },
      { type: 'domain', value: 'evil.example.com' },
    ],
    notes: ['Packed binary', 'Suspicious imports'],
    rawResultPath: '/tmp/result.json',
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(async () => {
  await Promise.all([
    db.virtualCaddyJobs.clear(),
    db.standaloneIOCs.clear(),
    db.notes.clear(),
    db.timelineEvents.clear(),
    db.timelines.clear(),
  ]);
  // Suppress console errors in unit tests
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── getInvestigationVirtualJobs ───────────────────────────────────────────────

describe('getInvestigationVirtualJobs', () => {
  it('returns empty array when no jobs exist', async () => {
    const jobs = await getInvestigationVirtualJobs('inv-x');
    expect(jobs).toEqual([]);
  });

  it('returns only jobs for the given investigation, newest first', async () => {
    const earlier = new Date(Date.now() - 1000).toISOString();
    const later = new Date().toISOString();
    await db.virtualCaddyJobs.bulkAdd([
      { id: 'j1', investigationId: 'inv-1', filename: 'a.exe', fileHash: '', status: 'complete', submittedAt: earlier, extractedIocCount: 2 },
      { id: 'j2', investigationId: 'inv-1', filename: 'b.exe', fileHash: '', status: 'queued', submittedAt: later, extractedIocCount: 0 },
      { id: 'j3', investigationId: 'inv-2', filename: 'c.exe', fileHash: '', status: 'complete', submittedAt: later, extractedIocCount: 5 },
    ]);

    const jobs = await getInvestigationVirtualJobs('inv-1');
    expect(jobs).toHaveLength(2);
    // Newest first (later > earlier)
    expect(jobs[0].id).toBe('j2');
    expect(jobs[1].id).toBe('j1');
  });

  it('does not return jobs from other investigations', async () => {
    await db.virtualCaddyJobs.add({
      id: 'j1', investigationId: 'other-inv', filename: 'x.exe', fileHash: '',
      status: 'complete', submittedAt: new Date().toISOString(), extractedIocCount: 0,
    });
    const jobs = await getInvestigationVirtualJobs('inv-1');
    expect(jobs).toHaveLength(0);
  });
});

// ── createVirtualCaddyJob ─────────────────────────────────────────────────────

describe('createVirtualCaddyJob', () => {
  it('inserts a queued job record and returns its id', async () => {
    const id = await createVirtualCaddyJob('inv-1', 'mal.dll', '');
    const job = await db.virtualCaddyJobs.get(id);
    expect(job).toBeDefined();
    expect(job!.status).toBe('queued');
    expect(job!.filename).toBe('mal.dll');
    expect(job!.investigationId).toBe('inv-1');
    expect(job!.extractedIocCount).toBe(0);
  });
});

// ── handleJobComplete ─────────────────────────────────────────────────────────

describe('handleJobComplete', () => {
  beforeEach(async () => {
    // Pre-insert the job record that handleJobComplete will update
    await db.virtualCaddyJobs.add({
      id: 'job-1',
      investigationId: 'inv-1',
      filename: 'sample.exe',
      fileHash: '',
      status: 'running',
      submittedAt: new Date().toISOString(),
      extractedIocCount: 0,
    });
  });

  it('updates the job record to complete', async () => {
    const payload = makeJobPayload();
    await handleJobComplete(payload);
    const job = await db.virtualCaddyJobs.get('job-1');
    expect(job!.status).toBe('complete');
    expect(job!.extractedIocCount).toBe(2);
    expect(job!.completedAt).toBe(payload.completedAt);
  });

  it('creates StandaloneIOC entries for each extracted IOC', async () => {
    await handleJobComplete(makeJobPayload());
    const iocs = await db.standaloneIOCs.where('folderId').equals('inv-1').toArray();
    expect(iocs).toHaveLength(2);
    const types = iocs.map((i) => i.type).sort();
    expect(types).toEqual(['domain', 'ipv4']);
    for (const ioc of iocs) {
      expect(ioc.virtualCaddyJobId).toBe('job-1');
      expect(ioc.tags).toContain('virtualcaddy');
    }
  });

  it('maps ipv4 type correctly (not "ip")', async () => {
    await handleJobComplete(makeJobPayload({ iocs: [{ type: 'ipv4', value: '10.0.0.1' }] }));
    const ioc = await db.standaloneIOCs.where('folderId').equals('inv-1').first();
    expect(ioc!.type).toBe('ipv4');
  });

  it('creates a Note summarising the job', async () => {
    await handleJobComplete(makeJobPayload());
    const notes = await db.notes.where('folderId').equals('inv-1').toArray();
    expect(notes).toHaveLength(1);
    const note = notes[0];
    expect(note.title).toContain('sample.exe');
    expect(note.content).toContain('SHA-256');
    expect(note.content).toContain('1.2.3.4');
    expect(note.virtualCaddyJobId).toBe('job-1');
    expect(note.tags).toContain('virtualcaddy');
  });

  it('creates a TimelineEvent', async () => {
    await handleJobComplete(makeJobPayload());
    const events = await db.timelineEvents.where('folderId').equals('inv-1').toArray();
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.title).toContain('sample.exe');
    expect(ev.title).toContain('2 IOCs');
    expect(ev.source).toBe('VirtualCaddy');
    expect(ev.virtualCaddyJobId).toBe('job-1');
    expect(ev.linkedIOCIds).toHaveLength(2);
    expect(ev.linkedNoteIds).toHaveLength(1);
  });

  it('dispatches virtualcaddy:enrich-iocs CustomEvent when IOCs exist', async () => {
    const dispatched: CustomEvent[] = [];
    const spy = vi.spyOn(window, 'dispatchEvent').mockImplementation((ev) => {
      if (ev instanceof CustomEvent) dispatched.push(ev);
      return true;
    });
    await handleJobComplete(makeJobPayload());
    const enrichEv = dispatched.find((e) => e.type === 'virtualcaddy:enrich-iocs');
    expect(enrichEv).toBeDefined();
    expect(enrichEv!.detail.investigationId).toBe('inv-1');
    expect(enrichEv!.detail.prompt).toMatch(/VirtualCaddy/);
    spy.mockRestore();
  });

  it('does not dispatch enrich event when no IOCs found', async () => {
    const dispatched: Event[] = [];
    const spy = vi.spyOn(window, 'dispatchEvent').mockImplementation((ev) => {
      dispatched.push(ev);
      return true;
    });
    await handleJobComplete(makeJobPayload({ iocs: [] }));
    expect(dispatched.some((e) => e.type === 'virtualcaddy:enrich-iocs')).toBe(false);
    spy.mockRestore();
  });

  it('handles zero-IOC payloads without creating ioc records', async () => {
    await handleJobComplete(makeJobPayload({ iocs: [] }));
    const iocs = await db.standaloneIOCs.where('folderId').equals('inv-1').toArray();
    expect(iocs).toHaveLength(0);
    // Note and timeline event still created
    const notes = await db.notes.where('folderId').equals('inv-1').toArray();
    expect(notes).toHaveLength(1);
    const events = await db.timelineEvents.where('folderId').equals('inv-1').toArray();
    expect(events).toHaveLength(1);
  });
});
