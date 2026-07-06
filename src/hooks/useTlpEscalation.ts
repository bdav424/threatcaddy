import { useEffect } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db';
import { clsLevelIndex } from '../lib/tlp-inspector';

/**
 * Reactively auto-escalates an investigation's folder TLP when any child
 * entity carries a more restrictive classification.
 *
 * Rules:
 * - Only raises, never lowers (a less-restrictive entity does nothing).
 * - Escalation is written directly to db.folders.clsLevel.
 * - Because useFolders now uses liveQuery, the write propagates to all
 *   consumers of selectedFolder (Sidebar, AppWorkspaceShell, hub cards)
 *   without a manual reload.
 *
 * Mount once per active investigation (pass selectedFolderId).
 */
export function useTlpEscalation(folderId: string | undefined): void {
  useEffect(() => {
    if (!folderId) return;

    const subscription = liveQuery(async () => {
      const [folder, notes, iocs, events, tasks] = await Promise.all([
        db.folders.get(folderId),
        db.notes
          .where('folderId').equals(folderId)
          .filter((n) => !n.trashed && !n.archived)
          .toArray(),
        db.standaloneIOCs
          .where('folderId').equals(folderId)
          .filter((i) => !i.trashed && !i.archived)
          .toArray(),
        db.timelineEvents
          .where('folderId').equals(folderId)
          .filter((e) => !e.trashed && !e.archived)
          .toArray(),
        db.tasks
          .where('folderId').equals(folderId)
          .filter((t) => !t.trashed && !t.archived)
          .toArray(),
      ]);
      return { folder, entities: [...notes, ...iocs, ...events, ...tasks] };
    }).subscribe({
      next: async ({ folder, entities }) => {
        if (!folder) return;

        // Find the highest entity TLP index
        let maxEntityIdx = -1;
        let maxEntityCls: string | undefined;
        for (const e of entities) {
          if (!e.clsLevel) continue;
          const idx = clsLevelIndex(e.clsLevel);
          if (idx > maxEntityIdx) {
            maxEntityIdx = idx;
            maxEntityCls = e.clsLevel;
          }
        }

        if (!maxEntityCls) return; // no entity has a TLP

        const folderIdx = clsLevelIndex(folder.clsLevel);
        if (maxEntityIdx > folderIdx) {
          // Escalate — write new level to folder. useFolders' liveQuery
          // subscription will pick this up and update selectedFolder everywhere.
          await db.folders.update(folderId, {
            clsLevel: maxEntityCls,
            updatedAt: Date.now(),
          });
        }
      },
      error: () => {
        // Escalation is best-effort; swallow errors silently.
      },
    });

    return () => subscription.unsubscribe();
  }, [folderId]);
}
