declare const __STANDALONE__: boolean | undefined;
declare const __BUILD_TIME__: number | undefined;
/** Per-language deflate-compressed, base64-encoded locale data for standalone builds. */
declare const __STANDALONE_LOCALES_GZ__: Record<string, string> | undefined;

// Allow importing JSON files as modules (used by i18n)
declare module '*.json' {
  const value: Record<string, unknown>;
  export default value;
}

// File Handling API (PWA file_handlers)
interface LaunchParams {
  readonly files: ReadonlyArray<FileSystemFileHandle>;
}
interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

interface ThreatCaddyDesktopGlassConfig {
  transparency: number;
  blur: number;
}

interface ThreatCaddyDesktopAPI {
  isDesktop: true;
  platform: string;
  setWindowGlass: (config: ThreatCaddyDesktopGlassConfig) => Promise<void>;
}

interface ThreatCaddyNotesAPI {
  pickFile: () => Promise<{ ok: boolean; content?: string; name?: string }>;
  saveWhisperEndpoint: (url: string) => Promise<{ ok: boolean }>;
  getWhisperEndpoint: () => Promise<string | null>;
}

interface ThreatCaddyCalendarAPI {
  startOAuth: (providerId: string) => Promise<{ credRefId: string; email: string | null }>;
  registerAccount: (account: unknown) => Promise<unknown>;
  pull: (accountId: string, range: { timeMinISO: string; timeMaxISO: string }) => Promise<unknown>;
  create: (accountId: string, event: unknown) => Promise<unknown>;
  update: (accountId: string, event: unknown) => Promise<unknown>;
  remove: (accountId: string, remoteId: string) => Promise<unknown>;
}

interface Window {
  launchQueue?: LaunchQueue;
  threatcaddyCalendar?: ThreatCaddyCalendarAPI;
  threatcaddyDesktop?: ThreatCaddyDesktopAPI;
  threatcaddyNotes?: ThreatCaddyNotesAPI;
}
