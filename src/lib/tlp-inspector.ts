import { nanoid } from 'nanoid';
import { db } from '../db';
import { DEFAULT_CLS_LEVELS } from '../types';

export type TlpContributingItemType = 'note' | 'task' | 'timeline-event' | 'ioc' | 'evidence';

export interface TlpContributingItem {
  id: string;
  type: TlpContributingItemType;
  title: string;
  clsLevel: string;
}

const CLS_ORDER = DEFAULT_CLS_LEVELS;

export function clsLevelIndex(level: string | undefined): number {
  if (!level) return -1;
  return CLS_ORDER.indexOf(level);
}

export function isClsLevelAtOrBelow(itemLevel: string | undefined, ceiling: string): boolean {
  if (!itemLevel) return true;
  const itemIdx = clsLevelIndex(itemLevel);
  if (itemIdx === -1) return false;
  const ceilingIdx = clsLevelIndex(ceiling);
  if (ceilingIdx === -1) return false;
  return itemIdx <= ceilingIdx;
}

/** Scans all non-trashed classified items in an investigation folder. */
export async function inspectTlpContributors(folderId: string): Promise<TlpContributingItem[]> {
  const [notes, tasks, events, iocs, evidence] = await Promise.all([
    db.notes.where('folderId').equals(folderId).toArray(),
    db.tasks.where('folderId').equals(folderId).toArray(),
    db.timelineEvents.where('folderId').equals(folderId).toArray(),
    db.standaloneIOCs.where('folderId').equals(folderId).toArray(),
    db.evidenceItems.where('folderId').equals(folderId).toArray(),
  ]);

  const items: TlpContributingItem[] = [];

  for (const note of notes) {
    if (note.clsLevel && !note.trashed)
      items.push({ id: note.id, type: 'note', title: note.title || 'Untitled note', clsLevel: note.clsLevel });
  }
  for (const task of tasks) {
    if (task.clsLevel && !task.trashed)
      items.push({ id: task.id, type: 'task', title: task.title || 'Untitled task', clsLevel: task.clsLevel });
  }
  for (const event of events) {
    if (event.clsLevel && !event.trashed)
      items.push({ id: event.id, type: 'timeline-event', title: event.title || 'Untitled event', clsLevel: event.clsLevel });
  }
  for (const ioc of iocs) {
    if (ioc.clsLevel && !ioc.trashed)
      items.push({ id: ioc.id, type: 'ioc', title: ioc.value || ioc.type, clsLevel: ioc.clsLevel });
  }
  for (const ev of evidence) {
    if (ev.clsLevel && !ev.trashed)
      items.push({ id: ev.id, type: 'evidence', title: ev.title || ev.fileName || 'Evidence', clsLevel: ev.clsLevel });
  }

  items.sort((a, b) => clsLevelIndex(b.clsLevel) - clsLevelIndex(a.clsLevel));
  return items;
}

/**
 * Creates a copy of an investigation, dropping any items classified above `targetClsLevel`.
 * Returns the new folder id.
 */
export async function copyInvestigationAtLowerTlp(
  sourceFolderId: string,
  sourceFolder: { name: string; color?: string; icon?: string; description?: string },
  targetClsLevel: string,
  newName: string,
): Promise<string> {
  const [notes, tasks, events, iocs, evidence] = await Promise.all([
    db.notes.where('folderId').equals(sourceFolderId).toArray(),
    db.tasks.where('folderId').equals(sourceFolderId).toArray(),
    db.timelineEvents.where('folderId').equals(sourceFolderId).toArray(),
    db.standaloneIOCs.where('folderId').equals(sourceFolderId).toArray(),
    db.evidenceItems.where('folderId').equals(sourceFolderId).toArray(),
  ]);

  const allowed = (level: string | undefined) => isClsLevelAtOrBelow(level, targetClsLevel);

  const now = Date.now();
  const newFolderId = nanoid();

  await db.transaction('rw', [db.folders, db.notes, db.tasks, db.timelineEvents, db.standaloneIOCs, db.evidenceItems], async () => {
    const maxOrder = (await db.folders.toArray()).reduce((m, f) => Math.max(m, f.order), 0);
    await db.folders.add({
      id: newFolderId,
      name: newName,
      color: sourceFolder.color,
      icon: sourceFolder.icon,
      description: sourceFolder.description,
      order: maxOrder + 1,
      clsLevel: targetClsLevel,
      createdAt: now,
      updatedAt: now,
      status: 'active',
    });

    if (notes.filter(n => allowed(n.clsLevel)).length > 0)
      await db.notes.bulkAdd(notes.filter(n => allowed(n.clsLevel)).map(n => ({ ...n, id: nanoid(), folderId: newFolderId, createdAt: now, updatedAt: now })));
    if (tasks.filter(t => allowed(t.clsLevel)).length > 0)
      await db.tasks.bulkAdd(tasks.filter(t => allowed(t.clsLevel)).map(t => ({ ...t, id: nanoid(), folderId: newFolderId, createdAt: now, updatedAt: now })));
    if (events.filter(e => allowed(e.clsLevel)).length > 0)
      await db.timelineEvents.bulkAdd(events.filter(e => allowed(e.clsLevel)).map(e => ({ ...e, id: nanoid(), folderId: newFolderId, createdAt: now, updatedAt: now })));
    if (iocs.filter(i => allowed(i.clsLevel)).length > 0)
      await db.standaloneIOCs.bulkAdd(iocs.filter(i => allowed(i.clsLevel)).map(i => ({ ...i, id: nanoid(), folderId: newFolderId, createdAt: now, updatedAt: now })));
    if (evidence.filter(e => allowed(e.clsLevel)).length > 0)
      await db.evidenceItems.bulkAdd(evidence.filter(e => allowed(e.clsLevel)).map(e => ({ ...e, id: nanoid(), folderId: newFolderId, createdAt: now, updatedAt: now })));
  });

  return newFolderId;
}
