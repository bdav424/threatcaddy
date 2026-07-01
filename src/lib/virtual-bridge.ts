// src/lib/virtual-bridge.ts
//
// Renderer-side handler for VirtualCaddy IPC events.
// Constraints (mirroring the desktop-side air-gap invariants):
//   - NO fetch, WebSocket, exec, or postMessage to external origins
//   - NO direct AI API calls — enrichment is triggered by dispatching a
//     CustomEvent that the ChatView/App.tsx pendingDraft system picks up
//   - All DB writes go through the Dexie layer (db.ts)

import { db } from '../db';
import { getVirtualCaddyBridge } from './bridges';
import type { VirtualCaddyJobCompletePayload, VirtualCaddyJobErrorPayload, VirtualCaddyJobStatusPayload } from './bridges';
import type { StandaloneIOC, TimelineEvent, Note, IOCType } from '../types';
import { nanoid } from 'nanoid';

// Re-export for convenience
export type { VirtualCaddyJobCompletePayload };

// ── IOC type mapping ─────────────────────────────────────────────────────────

const STATIC_IOC_TYPE_MAP: Record<string, IOCType> = {
  ipv4:   'ipv4',
  domain: 'domain',
  url:    'url',
  email:  'email',
  md5:    'md5',
  sha1:   'sha1',
  sha256: 'sha256',
  cve:    'cve',
};

function mapIocType(raw: string): IOCType {
  return STATIC_IOC_TYPE_MAP[raw.toLowerCase()] ?? 'domain';
}

// ── Job-complete handler ─────────────────────────────────────────────────────

export async function handleJobComplete(payload: VirtualCaddyJobCompletePayload): Promise<void> {
  const {
    jobId,
    investigationId,
    filename,
    fileHash,
    iocs,
    notes: analysisNotes,
    rawResultPath,
    completedAt,
  } = payload;

  const now = Date.now();

  // 1. Update the VirtualCaddyJob record
  await db.virtualCaddyJobs.update(jobId, {
    status: 'complete',
    completedAt,
    extractedIocCount: iocs.length,
    rawResultPath,
  });

  // 2. Create StandaloneIOC entries for each extracted IOC
  const iocIds: string[] = [];
  if (iocs.length > 0) {
    const iocRecords: StandaloneIOC[] = iocs.map((raw) => {
      const id = nanoid();
      iocIds.push(id);
      return {
        id,
        type: mapIocType(raw.type),
        value: raw.value,
        confidence: 'low',
        folderId: investigationId,
        tags: ['virtualcaddy', `job:${jobId}`],
        trashed: false,
        archived: false,
        virtualCaddyJobId: jobId,
        createdAt: now,
        updatedAt: now,
      };
    });
    await db.standaloneIOCs.bulkAdd(iocRecords);
  }

  // 3. Create a Note summarising the job
  const noteContent = [
    `# VirtualCaddy Analysis: ${filename}`,
    '',
    `**File:** ${filename}`,
    `**SHA-256:** \`${fileHash}\``,
    `**Analyzed:** ${new Date(completedAt).toLocaleString()}`,
    `**IOCs extracted:** ${iocs.length}`,
    '',
    ...analysisNotes.map((n) => `- ${n}`),
    '',
    iocs.length > 0
      ? `## Extracted IOCs\n\n${iocs.slice(0, 50).map((i) => `- \`${i.value}\` (${i.type})`).join('\n')}${iocs.length > 50 ? `\n- … and ${iocs.length - 50} more` : ''}`
      : '_No IOC patterns found in static scan._',
  ].join('\n');

  const noteId = nanoid();
  const note: Note = {
    id: noteId,
    title: `VirtualCaddy: ${filename}`,
    content: noteContent,
    folderId: investigationId,
    tags: ['virtualcaddy', `job:${jobId}`],
    pinned: false,
    archived: false,
    trashed: false,
    virtualCaddyJobId: jobId,
    createdAt: now,
    updatedAt: now,
  };
  await db.notes.add(note);

  // 4. Create a TimelineEvent
  const defaultTimeline = await db.timelines
    .filter((t) => !t.name || t.name === 'Default')
    .first();
  const timelineId = defaultTimeline?.id ?? nanoid();

  const eventId = nanoid();
  const event: TimelineEvent = {
    id: eventId,
    timestamp: now,
    title: `VirtualCaddy analysis complete — ${filename} (${iocs.length} IOC${iocs.length === 1 ? '' : 's'} extracted)`,
    description: `Air-gapped static analysis of ${filename}. SHA-256: ${fileHash}`,
    eventType: 'evidence',
    source: 'VirtualCaddy',
    confidence: 'medium',
    linkedIOCIds: iocIds,
    linkedNoteIds: [noteId],
    linkedTaskIds: [],
    mitreAttackIds: [],
    assets: [],
    tags: ['virtualcaddy', `job:${jobId}`],
    starred: false,
    folderId: investigationId,
    timelineId,
    trashed: false,
    archived: false,
    virtualCaddyJobId: jobId,
    createdAt: now,
    updatedAt: now,
  };
  await db.timelineEvents.add(event);

  // 5. Trigger CaddyAI enrichment via CustomEvent so the React layer can
  //    pipe it into the active pendingDraft / CaddyAI context without this
  //    module needing to call AI APIs directly.
  if (iocs.length > 0) {
    const iocList = iocs
      .slice(0, 30)
      .map((i) => `${i.type}: ${i.value}`)
      .join(', ');
    const enrichPrompt = `New IOCs ingested from VirtualCaddy analysis of ${filename}. Enrich the following: ${iocList}.`;

    window.dispatchEvent(
      new CustomEvent('virtualcaddy:enrich-iocs', {
        detail: { investigationId, jobId, prompt: enrichPrompt, iocs },
      }),
    );
  }
}

// ── Renderer-side IPC registration ──────────────────────────────────────────

type UnsubFn = () => void;

interface VirtualBridgeSubscription {
  unsubscribe: UnsubFn;
}

export function registerVirtualCaddyRendererHandlers(
  onJobStatusChange?: (payload: VirtualCaddyJobStatusPayload) => void,
  onJobCompleteUi?: (payload: VirtualCaddyJobCompletePayload) => void,
  onJobErrorUi?: (payload: VirtualCaddyJobErrorPayload) => void,
): VirtualBridgeSubscription {
  const bridge = getVirtualCaddyBridge();
  if (!bridge) return { unsubscribe: () => {} };

  const unsubComplete = bridge.onJobComplete(async (payload) => {
    try {
      await handleJobComplete(payload);
    } catch (err) {
      console.error('[VirtualCaddy] handleJobComplete error:', err);
    }
    onJobCompleteUi?.(payload);
  });

  const unsubStatus = bridge.onJobStatus((payload) => {
    // Update job status in Dexie
    db.virtualCaddyJobs.update(payload.jobId, { status: payload.status as 'running' }).catch(() => {});
    onJobStatusChange?.(payload);
  });

  const unsubError = bridge.onJobError(async (payload) => {
    await db.virtualCaddyJobs.update(payload.jobId, {
      status: 'error',
      errorMessage: payload.error,
      completedAt: new Date().toISOString(),
    }).catch(() => {});
    onJobErrorUi?.(payload);
  });

  return {
    unsubscribe: () => {
      unsubComplete();
      unsubStatus();
      unsubError();
    },
  };
}

// ── Job query helpers ────────────────────────────────────────────────────────

export async function getInvestigationVirtualJobs(investigationId: string) {
  return db.virtualCaddyJobs
    .where('investigationId')
    .equals(investigationId)
    .sortBy('submittedAt')
    .then((jobs) => jobs.reverse());
}

export async function createVirtualCaddyJob(
  investigationId: string,
  filename: string,
  fileHash: string,
): Promise<string> {
  const id = nanoid();
  await db.virtualCaddyJobs.add({
    id,
    investigationId,
    filename,
    fileHash,
    status: 'queued',
    submittedAt: new Date().toISOString(),
    extractedIocCount: 0,
  });
  return id;
}
