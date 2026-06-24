// TODO: Full Capacitor implementation in S-mobile.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.threatcaddy.app',
  appName: 'ThreatCaddy',
  webDir: 'dist-mobile',
  server: {
    // Use https scheme on Android so WebCrypto, IndexedDB, and
    // service workers run in a secure context (required for AES-256-GCM sync encryption).
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#0f1117',
    },
  },
};

export default config;
