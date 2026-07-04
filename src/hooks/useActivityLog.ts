import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import type { ActivityLogEntry, ActivityCategory, ActivityAction } from '../types';
import { nanoid } from 'nanoid';

const RETENTION_DAYS = 30;

export function useActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);

  // Load entries on mount, prune anything older than 30 days
  useEffect(() => {
    (async () => {
      const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
      // `timestamp` is NOT in ENCRYPTED_FIELDS so the index stores plaintext values —
      // IDBKeyRange queries work correctly even when encryption is enabled.
      //
      // Step 1: delete expired rows via cursor-delete on the timestamp index.
      // This avoids loading+decrypting thousands of rows we're going to throw away.
      await db.activityLog.where('timestamp').below(cutoff).delete();
      //
      // Step 2: load only the retained window through the DBCore query handler so
      // encrypted fields (detail, itemTitle) are decrypted correctly.
      // We intentionally avoid orderBy().reverse() which uses openCursor and can
      // bypass the middleware's query-level decryption path.
      const kept = await db.activityLog.where('timestamp').aboveOrEqual(cutoff).toArray();
      kept.sort((a, b) => b.timestamp - a.timestamp);
      // Cap in-memory entries to prevent excessive state size
      setEntries(kept.length > 5000 ? kept.slice(0, 5000) : kept);
    })();
  }, []);

  const log = useCallback(async (
    category: ActivityCategory,
    action: ActivityAction,
    detail: string,
    itemId?: string,
    itemTitle?: string,
  ) => {
    const entry: ActivityLogEntry = {
      id: nanoid(),
      action,
      category,
      detail,
      itemId,
      itemTitle,
      timestamp: Date.now(),
    };
    await db.activityLog.add(entry);
    setEntries((prev) => [entry, ...prev]);
  }, []);

  const clear = useCallback(async () => {
    await db.activityLog.clear();
    setEntries([]);
  }, []);

  const getFiltered = useCallback((opts: { category?: ActivityCategory; search?: string }) => {
    let filtered = entries;
    if (opts.category) {
      filtered = filtered.filter((e) => e.category === opts.category);
    }
    if (opts.search) {
      const lower = opts.search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          (typeof e.detail === 'string' && e.detail.toLowerCase().includes(lower)) ||
          (typeof e.itemTitle === 'string' && e.itemTitle.toLowerCase().includes(lower))
      );
    }
    return filtered;
  }, [entries]);

  return { entries, log, clear, getFiltered };
}
