import { useEffect, useState } from 'react';

export type UpdaterStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string };

declare global {
  interface Window {
    threatcaddyUpdater?: {
      onStatus: (cb: (channel: string, payload: unknown) => void) => () => void;
      checkForUpdates: () => void;
      installAndQuit: () => void;
    };
  }
}

export function useAutoUpdater() {
  const [status, setStatus] = useState<UpdaterStatus>({ state: 'idle' });

  useEffect(() => {
    if (!window.threatcaddyUpdater) return;

    const unsub = window.threatcaddyUpdater.onStatus((channel, payload) => {
      const p = payload as Record<string, unknown> | null;
      switch (channel) {
        case 'updater:checking':
          setStatus({ state: 'checking' });
          break;
        case 'updater:available':
          setStatus({ state: 'available', version: String(p?.version ?? '') });
          break;
        case 'updater:not-available':
          setStatus({ state: 'not-available' });
          break;
        case 'updater:progress':
          setStatus({ state: 'downloading', percent: Number(p?.percent ?? 0) });
          break;
        case 'updater:downloaded':
          setStatus({ state: 'downloaded', version: String(p?.version ?? '') });
          break;
        case 'updater:error':
          setStatus({ state: 'error', message: String(p?.message ?? 'Unknown error') });
          break;
      }
    });

    return unsub;
  }, []);

  const checkForUpdates = () => window.threatcaddyUpdater?.checkForUpdates();
  const installAndQuit = () => window.threatcaddyUpdater?.installAndQuit();

  return { status, checkForUpdates, installAndQuit };
}
