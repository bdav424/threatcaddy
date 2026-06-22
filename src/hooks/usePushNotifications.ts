import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

interface PushNotificationsConfig {
  serverUrl: string | null;
  connected: boolean;
  getAccessToken: () => Promise<string | null>;
}

/**
 * Registers for push notifications on Capacitor (Android/iOS) when the user is
 * connected to a team server. Sends the FCM/APNs token to the server so it can
 * deliver notifications via the push channel.
 *
 * No-ops on web/desktop — Capacitor.isNativePlatform() guards all calls.
 *
 * Requirements before push actually delivers:
 *  - Android: Firebase project + google-services.json in android/app/
 *  - iOS: Apple Developer push certificate configured in Xcode
 *  - Server: GOOGLE_APPLICATION_CREDENTIALS env var for FCM (or APNs cert for iOS)
 */
export function usePushNotifications({ serverUrl, connected, getAccessToken }: PushNotificationsConfig) {
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !connected || !serverUrl) return;

    let cancelled = false;

    async function register() {
      try {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== 'granted') return;

        await PushNotifications.register();
      } catch {
        // Non-fatal — push is best-effort
      }
    }

    const tokenListener = PushNotifications.addListener('registration', async (token) => {
      if (cancelled || tokenRef.current === token.value) return;
      tokenRef.current = token.value;

      const platform = Capacitor.getPlatform() as 'android' | 'ios';
      const accessToken = await getAccessToken();
      if (!accessToken || cancelled) return;

      try {
        await fetch(`${serverUrl}/api/push-tokens`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ token: token.value, platform }),
        });
      } catch {
        // Non-fatal
      }
    });

    register();

    return () => {
      cancelled = true;
      tokenListener.then((l) => l.remove());
    };
  }, [serverUrl, connected, getAccessToken]);
}
