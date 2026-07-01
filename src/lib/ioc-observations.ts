import { nanoid } from 'nanoid';
import { db } from '../db';
import type { ConfidenceLevel, IOCEntry, StandaloneIOC } from '../types';
import { getCurrentUserName } from './utils';

export type IOCObservationSource =
  | { kind: 'note'; id: string; title?: string }
  | { kind: 'evidence'; id: string; title?: string; fileName?: string };

export interface UpsertIOCObservationsOptions {
  folderId?: string;
  clsLevel?: string;
  source: IOCObservationSource;
  defaultConfidence?: ConfidenceLevel;
  tags?: string[];
}

export interface UpsertIOCObservationsResult {
  touched: StandaloneIOC[];
  created: StandaloneIOC[];
  updated: StandaloneIOC[];
}

function iocKey(type: string, value: string): string {
  return `${type}:${value.trim().toLowerCase()}`;
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function sourceTags(source: IOCObservationSource): string[] {
  if (source.kind === 'note') return ['source:note'];
  return ['source:evidence'];
}

function sourceNote(source: IOCObservationSource): string {
  if (source.kind === 'note') {
    return `Auto-observed in note "${source.title || source.id}".`;
  }
  return `Auto-observed in evidence file "${source.fileName || source.title || source.id}".`;
}

function withSourceLinks(
  ioc: StandaloneIOC,
  source: IOCObservationSource,
): Partial<StandaloneIOC> {
  if (source.kind === 'note') {
    return { linkedNoteIds: unique([...(ioc.linkedNoteIds || []), source.id]) };
  }
  return { linkedEvidenceIds: unique([...(ioc.linkedEvidenceIds || []), source.id]) };
}

export async function upsertIOCObservations(
  entries: IOCEntry[],
  options: UpsertIOCObservationsOptions,
): Promise<UpsertIOCObservationsResult> {
  const activeEntries = entries.filter((entry) => !entry.dismissed && entry.value.trim());
  if (activeEntries.length === 0) return { touched: [], created: [], updated: [] };

  const now = Date.now();
  const folderIOCs = options.folderId
    ? await db.standaloneIOCs.where('folderId').equals(options.folderId).toArray()
    : await db.standaloneIOCs.toArray();
  const existingByKey = new Map(
    folderIOCs
      .filter((ioc) => !ioc.trashed)
      .map((ioc) => [iocKey(ioc.type, ioc.value), ioc] as const),
  );

  const touched: StandaloneIOC[] = [];
  const created: StandaloneIOC[] = [];
  const updated: StandaloneIOC[] = [];
  const seen = new Set<string>();

  for (const entry of activeEntries) {
    const key = iocKey(entry.type, entry.value);
    if (seen.has(key)) continue;
    seen.add(key);

    const existing = existingByKey.get(key);
    if (existing) {
      const patch: Partial<StandaloneIOC> = {
        ...withSourceLinks(existing, options.source),
        firstSeen: existing.firstSeen ?? existing.createdAt ?? entry.firstSeen ?? now,
        lastSeen: now,
        clsLevel: existing.clsLevel || options.clsLevel,
        tags: unique([...(existing.tags || []), ...sourceTags(options.source), ...(options.tags || [])]),
        updatedAt: now,
      };
      await db.standaloneIOCs.update(existing.id, patch);
      const next = { ...existing, ...patch };
      touched.push(next);
      updated.push(next);
      continue;
    }

    const ioc: StandaloneIOC = {
      id: nanoid(),
      type: entry.type,
      value: entry.value,
      confidence: entry.confidence || options.defaultConfidence || 'medium',
      analystNotes: entry.analystNotes || sourceNote(options.source),
      attribution: entry.attribution,
      iocSubtype: entry.iocSubtype,
      iocStatus: entry.iocStatus,
      clsLevel: entry.clsLevel || options.clsLevel,
      folderId: options.folderId,
      tags: unique([...sourceTags(options.source), ...(options.tags || [])]),
      relationships: entry.relationships || [],
      ...withSourceLinks({} as StandaloneIOC, options.source),
      firstSeen: entry.firstSeen || now,
      lastSeen: now,
      trashed: false,
      archived: false,
      createdBy: getCurrentUserName(),
      createdAt: now,
      updatedAt: now,
    };
    await db.standaloneIOCs.add(ioc);
    existingByKey.set(key, ioc);
    touched.push(ioc);
    created.push(ioc);
  }

  return { touched, created, updated };
}
