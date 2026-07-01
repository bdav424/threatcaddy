import { useState, useCallback } from 'react';
import type { UpcomingMeeting } from './useUpcomingMeetings';

export interface AlertItem {
  meetingId: string;
  event: UpcomingMeeting['event'];
  minutesUntilStart: number;
  /** 0 (far out) → 1 (imminent), used to scale animation speed/intensity */
  urgency: number;
  phase: number;
  totalPhases: number;
}

interface MeetingAlertState {
  dismissedAtPhase: number;
  acknowledged: boolean;
}

/**
 * Compute re-surface checkpoints from the lead time, proportionally:
 * 100%, ~66%, ~33% of lead time, plus a floor at max(2, 10% of lead).
 * Returned sorted DESCENDING (largest first = earliest checkpoint).
 */
export function computeCheckpoints(leadMinutes: number): number[] {
  const floor = Math.max(2, Math.round(leadMinutes * 0.1));
  const raw = [
    leadMinutes,
    Math.round(leadMinutes * 0.66),
    Math.round(leadMinutes * 0.33),
    floor,
  ];
  return [...new Set(raw)]
    .filter((m) => m > 0 && m <= leadMinutes)
    .sort((a, b) => b - a);
}

/**
 * Returns the current phase index for a given minutesUntilStart.
 * Phase -1 = not yet in any checkpoint window (meeting is too far away).
 * Phase N = we've entered the Nth checkpoint window (0-indexed).
 */
function getCurrentPhase(minutesUntilStart: number, checkpoints: number[]): number {
  if (checkpoints.length === 0) return -1;
  if (minutesUntilStart > checkpoints[0]) return -1;
  let count = 0;
  for (const c of checkpoints) {
    if (minutesUntilStart <= c) count++;
  }
  return count - 1;
}

export function useAlertSchedule(
  meetings: UpcomingMeeting[],
  leadMinutes: number,
  enabled: boolean,
): {
  visible: AlertItem[];
  dismiss: (meetingId: string) => void;
  acknowledge: (meetingId: string) => void;
} {
  const [alertStates, setAlertStates] = useState<Record<string, MeetingAlertState>>({});
  const checkpoints = computeCheckpoints(leadMinutes);

  const dismiss = useCallback((meetingId: string) => {
    setAlertStates((prev) => {
      const meeting = meetings.find((m) => m.event.id === meetingId);
      if (!meeting) return prev;
      const phase = getCurrentPhase(meeting.minutesUntilStart, computeCheckpoints(leadMinutes));
      return {
        ...prev,
        [meetingId]: {
          dismissedAtPhase: phase,
          acknowledged: prev[meetingId]?.acknowledged ?? false,
        },
      };
    });
  }, [meetings, leadMinutes]);

  const acknowledge = useCallback((meetingId: string) => {
    setAlertStates((prev) => ({
      ...prev,
      [meetingId]: {
        dismissedAtPhase: prev[meetingId]?.dismissedAtPhase ?? -1,
        acknowledged: true,
      },
    }));
  }, []);

  if (!enabled) {
    return { visible: [], dismiss, acknowledge };
  }

  const visible: AlertItem[] = [];
  for (const { event, minutesUntilStart } of meetings) {
    const state = alertStates[event.id];
    if (state?.acknowledged) continue;

    const phase = getCurrentPhase(minutesUntilStart, checkpoints);
    if (phase < 0) continue; // not yet in alert window

    const dismissedAtPhase = state?.dismissedAtPhase ?? -1;
    if (phase <= dismissedAtPhase) continue; // still within dismissed phase

    const urgency = Math.max(0, Math.min(1, 1 - minutesUntilStart / leadMinutes));

    visible.push({
      meetingId: event.id,
      event,
      minutesUntilStart,
      urgency,
      phase,
      totalPhases: checkpoints.length,
    });
  }

  return { visible, dismiss, acknowledge };
}
