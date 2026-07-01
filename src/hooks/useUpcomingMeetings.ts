import { useState, useEffect, useMemo } from 'react';
import type { CalendarEvent } from '../types';

const STORAGE_KEY = 'tc-calendarcaddy-events-v1';

export interface UpcomingMeeting {
  event: CalendarEvent;
  minutesUntilStart: number;
}

function readEventsFromStorage(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function computeUpcoming(events: CalendarEvent[], leadMinutes: number): UpcomingMeeting[] {
  const now = Date.now();
  const results: UpcomingMeeting[] = [];

  for (const event of events) {
    if (event.allDay) continue;
    const startMs = new Date(event.start).getTime();
    const diffMs = startMs - now;
    const minutesUntilStart = diffMs / 60000;

    if (minutesUntilStart >= 0 && minutesUntilStart <= leadMinutes + 1) {
      // +1 gives a buffer so the first threshold shows immediately when crossed
      results.push({ event, minutesUntilStart });
    } else if (diffMs < 0 && diffMs > -30 * 60 * 1000) {
      // Event started up to 30 min ago — treat as "starting now" so Join still works
      results.push({ event, minutesUntilStart: 0 });
    }
  }

  return results.sort((a, b) => a.minutesUntilStart - b.minutesUntilStart);
}

export function useUpcomingMeetings(leadMinutes: number): UpcomingMeeting[] {
  // Tick increments to trigger re-derivation of upcoming meetings
  const [tick, setTick] = useState(0);

  // Re-tick every 30 seconds so urgency and visibility stay fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Re-tick whenever CalendarCaddy writes new events to localStorage
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY || e.key === null) setTick((t) => t + 1);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Derive upcoming meetings — recomputes whenever tick or leadMinutes changes
  return useMemo(
    () => computeUpcoming(readEventsFromStorage(), leadMinutes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, leadMinutes],
  );
}
