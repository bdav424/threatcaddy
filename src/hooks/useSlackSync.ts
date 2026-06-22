// src/hooks/useSlackSync.ts
//
// Polling loop for Slack DMs. Calls the desktop IPC bridge (Electron only) every
// POLL_INTERVAL_MS, writes results to localStorage so useSlackDMs can pick them up.
// No-ops gracefully in the browser/standalone build where the bridge is absent.

import { useEffect, useRef } from 'react';
import { getSlackBridge } from '../lib/bridges';
import { SLACK_DM_STORAGE_KEY } from './useSlackDMs';

const POLL_INTERVAL_MS = 5 * 60_000; // 5 minutes

export function useSlackSync(credRefId: string | null | undefined) {
  const lastPollTsRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const bridge = getSlackBridge();
    if (!bridge || !credRefId) return;

    async function poll() {
      if (!bridge || !credRefId) return;
      try {
        const threads = await bridge.pullDMs(credRefId, lastPollTsRef.current);
        if (threads.length > 0) {
          // Merge with existing stored threads (deduplicate by channelId, keep newer)
          let existing: typeof threads = [];
          try {
            const raw = localStorage.getItem(SLACK_DM_STORAGE_KEY);
            if (raw) existing = JSON.parse(raw);
          } catch { /* ignore */ }

          const byChannelId = new Map(existing.map((t) => [t.channelId, t]));
          for (const t of threads) {
            const prev = byChannelId.get(t.channelId);
            if (!prev || t.lastMessageTs > prev.lastMessageTs) {
              byChannelId.set(t.channelId, t);
            }
          }
          localStorage.setItem(SLACK_DM_STORAGE_KEY, JSON.stringify([...byChannelId.values()]));
        }
        // Use the newest ts from this batch as next oldest param
        const latestTs = threads.reduce((max, t) => (t.lastMessageTs > max ? t.lastMessageTs : max), '');
        if (latestTs) lastPollTsRef.current = latestTs;
      } catch (err) {
        console.warn('[SlackSync] poll failed', err);
      }
    }

    void poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [credRefId]);
}
