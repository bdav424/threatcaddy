// src/hooks/useDmAlerts.ts
//
// Dismissal state for Slack DM alert cards in AlertGlowPanel.
// Dismiss = snooze for N hours. Acknowledge = mark channelId as seen at lastMessageTs;
// re-appears if a newer message arrives.

import { useState, useCallback, useMemo } from 'react';
import type { SlackDmThread, DmAlertItem } from '../types';

interface DmAlertState {
  snoozedUntil: number;
  acknowledgedTs: string;
}

export function useDmAlerts(
  threads: SlackDmThread[],
  enabled: boolean,
  snoozeDurationHours: number,
): {
  visible: DmAlertItem[];
  dismissDm: (channelId: string) => void;
  acknowledgeDm: (channelId: string) => void;
} {
  const [states, setStates] = useState<Record<string, DmAlertState>>({});

  const dismissDm = useCallback((channelId: string) => {
    setStates((prev) => ({
      ...prev,
      [channelId]: {
        snoozedUntil:   Date.now() + snoozeDurationHours * 3_600_000,
        acknowledgedTs: prev[channelId]?.acknowledgedTs ?? '',
      },
    }));
  }, [snoozeDurationHours]);

  const acknowledgeDm = useCallback((channelId: string) => {
    const thread = threads.find((t) => t.channelId === channelId);
    setStates((prev) => ({
      ...prev,
      [channelId]: {
        snoozedUntil:   prev[channelId]?.snoozedUntil ?? 0,
        acknowledgedTs: thread?.lastMessageTs ?? '',
      },
    }));
  }, [threads]);

  const visible = useMemo(() => {
    if (!enabled) return [];
    // eslint-disable-next-line react-hooks/purity -- Date.now() inside useMemo is intentional; snooze comparison needs fresh time per render
    const now = Date.now();
    const result: DmAlertItem[] = [];
    for (const thread of threads) {
      const state = states[thread.channelId];
      if (state?.snoozedUntil && now < state.snoozedUntil) continue;
      if (state?.acknowledgedTs && state.acknowledgedTs >= thread.lastMessageTs) continue;
      result.push({
        id:             thread.channelId,
        senderName:     thread.senderName,
        senderAvatar:   thread.senderAvatar,
        messagePreview: thread.lastMessageText,
        unreadCount:    thread.unreadCount,
        receivedAt:     thread.polledAt,
        slackDeepLink:  thread.slackDeepLink,
        urgency:        0.5,
      });
    }
    return result;
  }, [enabled, threads, states]);

  return { visible, dismissDm, acknowledgeDm };
}
