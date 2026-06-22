// src/hooks/useDmAlerts.ts
//
// Dismissal state for Slack DM alert cards in AlertGlowPanel.
// Dismiss = snooze for N hours. Acknowledge = mark channelId as seen at lastMessageTs;
// re-appears if a newer message arrives.

import { useState, useCallback } from 'react';
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

  if (!enabled) return { visible: [], dismissDm, acknowledgeDm };

  const now = Date.now();
  const visible: DmAlertItem[] = [];

  for (const thread of threads) {
    const state = states[thread.channelId];
    if (state?.snoozedUntil && now < state.snoozedUntil) continue;
    if (state?.acknowledgedTs && state.acknowledgedTs >= thread.lastMessageTs) continue;

    visible.push({
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

  return { visible, dismissDm, acknowledgeDm };
}
