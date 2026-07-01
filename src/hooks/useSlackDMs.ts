// src/hooks/useSlackDMs.ts
//
// Reads Slack DM threads from localStorage (written by useSlackSync's polling loop).
// Mirrors useUpcomingMeetings — tick-based re-derivation, storage-event reactivity.

import { useState, useEffect, useMemo } from 'react';
import type { SlackDmThread } from '../types';

export const SLACK_DM_STORAGE_KEY = 'tc-slack-dms-v1';

function readThreadsFromStorage(): SlackDmThread[] {
  try {
    const raw = localStorage.getItem(SLACK_DM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function filterRecent(threads: SlackDmThread[], windowHours: number): SlackDmThread[] {
  const cutoff = Date.now() - windowHours * 3_600_000;
  return threads.filter((t) => new Date(t.polledAt).getTime() > cutoff);
}

/** Returns DM threads polled within the last `windowHours` (default 8). */
export function useSlackDMs(windowHours = 8): SlackDmThread[] {
  const [tick, setTick] = useState(0);

  // Re-tick every 5 min so very stale threads age out naturally
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  // Re-tick when the polling loop writes new data
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === SLACK_DM_STORAGE_KEY || e.key === null) setTick((t) => t + 1);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return useMemo(
    () => filterRecent(readThreadsFromStorage(), windowHours),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, windowHours],
  );
}
