import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db';
import { getInheritedClsLevel } from '../lib/classification';

/**
 * Reactively computes the highest TLP/PAP classification inherited from
 * the investigation's notes, IOCs, and timeline events.
 * Returns "TLP:CLEAR" when no classified content exists.
 */
export function useInvestigationClassification(folderId: string | null | undefined): string {
  const [level, setLevel] = useState<string>('TLP:CLEAR');

  useEffect(() => {
    if (!folderId) return;

    const subscription = liveQuery(async () => {
      const [notes, iocs, events] = await Promise.all([
        db.notes.where('folderId').equals(folderId).filter((n) => !n.trashed && !n.archived).toArray(),
        db.standaloneIOCs.where('folderId').equals(folderId).filter((i) => !i.trashed && !i.archived).toArray(),
        db.timelineEvents.where('folderId').equals(folderId).filter((e) => !e.trashed && !e.archived).toArray(),
      ]);
      return [...notes, ...iocs, ...events];
    }).subscribe({
      next(entities) {
        setLevel(getInheritedClsLevel(folderId, entities) ?? 'TLP:CLEAR');
      },
      error() {
        setLevel('TLP:CLEAR');
      },
    });

    return () => {
      subscription.unsubscribe();
      setLevel('TLP:CLEAR');
    };
  }, [folderId]);

  return level;
}
