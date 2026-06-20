// src/hooks/useCalendarSync.ts
//
// Two-way calendar sync orchestrator (renderer side). Pulls events from connected accounts,
// merges them into local state, pushes local creates/edits, and pushes deletions. Talks to the
// Electron main process via the preload bridge (window.threatcaddy.calendar.*), which is the only
// place that holds tokens and makes network calls — keeping the browser/standalone build clean.
//
// v1 conflict model: last-write-wins by `updatedAt`. Remote events upsert by `remoteId`. Locally
// created/edited events (syncState 'local' | 'dirty') are pushed to their `syncAccountId` (or the
// chosen primary account). Deletions of previously-synced events are pushed via a tombstone list.
// Recurring-instance edits and remote deletions are intentionally conservative — see CAVEATS in
// CALENDAR-SYNC-BUTTON.md.

import { useCallback, useState } from 'react';
import type { CalendarEvent } from '../types';

export interface CalendarSyncAccount {
  id: string;
  provider: 'google' | 'microsoft' | 'caldav';
  label: string;
  calendarEnabled: boolean;
}

export interface PendingDeletion {
  remoteId: string;
  syncAccountId: string;
}

interface CalendarBridge {
  pull(accountId: string, range: { timeMinISO: string; timeMaxISO: string }): Promise<CalendarEvent[]>;
  create(accountId: string, event: CalendarEvent): Promise<{ remoteId: string; etag?: string }>;
  update(accountId: string, event: CalendarEvent): Promise<{ remoteId: string; etag?: string }>;
  remove(accountId: string, remoteId: string): Promise<{ ok: boolean }>;
}

function getBridge(): CalendarBridge | null {
  const tc = (globalThis as unknown as { threatcaddy?: { calendar?: CalendarBridge } }).threatcaddy;
  return tc?.calendar ?? null;
}

export function mergeRemote(local: CalendarEvent[], remote: CalendarEvent[]): CalendarEvent[] {
  const byRemoteId = new Map(local.filter((e) => e.remoteId).map((e) => [e.remoteId as string, e]));
  const result = [...local];
  for (const r of remote) {
    if (!r.remoteId) continue;
    const existing = byRemoteId.get(r.remoteId);
    if (!existing) {
      result.push(r);
      continue;
    }
    const localNewer = (existing.updatedAt ?? 0) > (r.updatedAt ?? 0) && existing.syncState === 'dirty';
    if (!localNewer) {
      const idx = result.findIndex((e) => e.id === existing.id);
      if (idx >= 0) result[idx] = { ...r, id: existing.id, syncState: 'synced' };
    }
  }
  return result;
}

export function useCalendarSync(
  setEvents: (updater: (current: CalendarEvent[]) => CalendarEvent[]) => void,
  pendingDeletions: PendingDeletion[],
  setPendingDeletions: (next: PendingDeletion[]) => void,
  accounts: CalendarSyncAccount[],
  primaryAccountId: string | null,
) {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError('Calendar sync runs in the desktop app. Open ThreatCaddy Desktop to sync.');
      return;
    }
    const calAccounts = accounts.filter((a) => a.calendarEnabled);
    if (calAccounts.length === 0) {
      setError('No calendar-enabled accounts connected.');
      return;
    }

    setSyncing(true);
    setError(null);
    const now = new Date();
    const timeMinISO = new Date(now.getTime() - 90 * 864e5).toISOString();
    const timeMaxISO = new Date(now.getTime() + 365 * 864e5).toISOString();

    try {
      const remote: CalendarEvent[] = [];
      for (const acct of calAccounts) {
        const pulled = await bridge.pull(acct.id, { timeMinISO, timeMaxISO });
        for (const e of pulled) remote.push({ ...e, syncAccountId: acct.id, syncState: 'synced' });
      }

      setEvents((current) => mergeRemote(current, remote));

      let snapshot: CalendarEvent[] = [];
      setEvents((current) => { snapshot = current; return current; });
      const toPush = snapshot.filter((e) => e.syncState === 'local' || e.syncState === 'dirty');
      for (const e of toPush) {
        const acctId = e.syncAccountId ?? primaryAccountId;
        if (!acctId) continue;
        const res = e.remoteId ? await bridge.update(acctId, e) : await bridge.create(acctId, e);
        setEvents((current) =>
          current.map((x) =>
            x.id === e.id
              ? { ...x, remoteId: res.remoteId, etag: res.etag, syncAccountId: acctId, syncState: 'synced' }
              : x,
          ),
        );
      }

      for (const d of pendingDeletions) {
        try { await bridge.remove(d.syncAccountId, d.remoteId); } catch { /* keep going */ }
      }
      setPendingDeletions([]);

      setLastSyncedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calendar sync failed.');
    } finally {
      setSyncing(false);
    }
  }, [accounts, primaryAccountId, pendingDeletions, setEvents, setPendingDeletions]);

  return { syncing, lastSyncedAt, error, sync };
}
