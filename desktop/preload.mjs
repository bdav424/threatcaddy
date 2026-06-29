import { contextBridge, ipcRenderer } from 'electron';

// Mail bridge — renderer end. Raw credentials never cross this boundary; the renderer
// holds only a credentialReferenceId. The main process (mail-bridge.mjs) owns all secrets.
contextBridge.exposeInMainWorld('threatcaddyMail', {
  // Encrypt and store host/user/secret in the OS keychain. Returns { ok: true }.
  // `ref` is a random id generated in the renderer and kept as credentialReferenceId.
  saveCredential: (ref, cred) =>
    ipcRenderer.invoke('threatcaddy-mail:save-credential', { ref, cred }),

  // action: 'probe' | 'list' | 'fetch' | 'save-draft' | 'send'
  // For 'send', params MUST include confirmedSend:true (set only after the user confirms
  // the staged-send review in the UI). Everything else is read/draft only — never transmits.
  execute: (action, credentialReferenceId, params = {}) =>
    ipcRenderer.invoke('threatcaddy-mail:execute', { action, credentialReferenceId, params }),

  // Opens the OAuth consent popout for Google ('google-gmail') or Microsoft ('microsoft-outlook').
  // Returns { credRefId, email } — credentials are stored in the OS keychain, never returned here.
  startOAuth: (providerId) =>
    ipcRenderer.invoke('threatcaddy-mail:start-oauth', { providerId }),
});

// Calendar sync bridge — pull/push via main-process IPC (tokens stay in main).
// Credential lifecycle:
//   startOAuth(provider)  — opens PKCE popout, stores tokens in safeStorage,
//                           returns { credRefId, email } (no tokens to renderer)
//   registerAccount(acct) — populates the in-memory accountRegistry in main.mjs
//                           so IPC pull/create/update/remove handlers can resolve it.
//                           Must be called on app start for each saved account.
//
// NOTE: intentionally named 'threatcaddyCalendar' (not 'threatcaddy') to avoid
// colliding with the agent bridge (installAgentBridge) which writes to window.threatcaddy.
// contextBridge.exposeInMainWorld creates an immutable property, so any second write fails.
contextBridge.exposeInMainWorld('threatcaddyCalendar', {
  startOAuth:      (providerId)          => ipcRenderer.invoke('calendar:start-oauth',      { providerId }),
  registerAccount: (account)             => ipcRenderer.invoke('calendar:register-account', account),
  pull:            (accountId, range)    => ipcRenderer.invoke('calendar:pull',              accountId, range),
  create:          (accountId, event)    => ipcRenderer.invoke('calendar:create',            accountId, event),
  update:          (accountId, event)    => ipcRenderer.invoke('calendar:update',            accountId, event),
  remove:          (accountId, remoteId) => ipcRenderer.invoke('calendar:remove',            accountId, remoteId),
});

// Slack DM bridge — pull recent DMs and OAuth connect.
// Token stays in safeStorage in the main process; renderer receives only credRefId.
contextBridge.exposeInMainWorld('threatcaddySlack', {
  // Opens Slack OAuth consent popout. Returns { credRefId, workspaceName, userName, userId }.
  startOAuth: () =>
    ipcRenderer.invoke('slack:start-oauth'),

  // Fetch DM threads with messages newer than sinceTs (Unix seconds string, optional).
  // Returns SlackDmThread[].
  pullDMs: (credRefId, sinceTs) =>
    ipcRenderer.invoke('slack:pull-dms', credRefId, sinceTs),

  // Remove stored credential (disconnect).
  revoke: (credRefId) =>
    ipcRenderer.invoke('slack:revoke', credRefId),

  // Post a Block Kit payload to a Slack incoming webhook URL.
  // webhookUrl must be a hooks.slack.com URL (validated in main process).
  postWebhook: (webhookUrl, payload) =>
    ipcRenderer.invoke('slack:post-webhook', webhookUrl, payload),
});

// Virtual file-watch bridge — read-only ingest from a VM-shared directory.
// No network calls cross this boundary; the renderer holds only file snapshots.
contextBridge.exposeInMainWorld('threatcaddyVirtual', {
  setWatchDir: (dirPath) => ipcRenderer.invoke('virtual:set-watch-dir', { dirPath }),
  getWatchDir: () => ipcRenderer.invoke('virtual:get-watch-dir'),
  listFiles: () => ipcRenderer.invoke('virtual:list-files'),
  readFile: (relativePath) => ipcRenderer.invoke('virtual:read-file', { relativePath }),
  stopWatch: () => ipcRenderer.invoke('virtual:stop-watch'),
  getStatus: () => ipcRenderer.invoke('virtual:get-status'),
  onFileChanged: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('virtual:file-changed', listener);
    return () => ipcRenderer.removeListener('virtual:file-changed', listener);
  },
  onWatchError: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('virtual:watch-error', listener);
    return () => ipcRenderer.removeListener('virtual:watch-error', listener);
  },
});

// VirtualCaddy IOC-ingest bridge — submits files for air-gapped static analysis.
// The desktop process (vm-ingest.mjs) owns the analysis; the renderer receives
// structured IOC results and creates investigation artifacts.
contextBridge.exposeInMainWorld('threatcaddyVirtualCaddy', {
  // Submit a file for analysis. Returns { ok, jobId? } — analysis runs async.
  submitJob: (params) => ipcRenderer.invoke('virtualcaddy:submit', params),

  // Get the default ingest directory path.
  getIngestDir: () => ipcRenderer.invoke('virtualcaddy:get-ingest-dir'),

  // Change the watched ingest directory.
  setIngestDir: (dirPath) => ipcRenderer.invoke('virtualcaddy:set-ingest-dir', { dirPath }),

  // Get currently-running job IDs.
  getJobsStatus: () => ipcRenderer.invoke('virtualcaddy:get-jobs-status'),

  // Desktop → renderer: analysis complete with extracted IOCs
  onJobComplete: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('virtualcaddy:job-complete', listener);
    return () => ipcRenderer.removeListener('virtualcaddy:job-complete', listener);
  },

  // Desktop → renderer: job entered running state
  onJobStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('virtualcaddy:job-status', listener);
    return () => ipcRenderer.removeListener('virtualcaddy:job-status', listener);
  },

  // Desktop → renderer: analysis failed
  onJobError: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('virtualcaddy:job-error', listener);
    return () => ipcRenderer.removeListener('virtualcaddy:job-error', listener);
  },

  // Desktop → renderer: new file dropped in the ingest dir
  onFileDetected: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('virtualcaddy:file-detected', listener);
    return () => ipcRenderer.removeListener('virtualcaddy:file-detected', listener);
  },

  // Desktop → renderer: watcher error
  onWatchError: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('virtualcaddy:watch-error', listener);
    return () => ipcRenderer.removeListener('virtualcaddy:watch-error', listener);
  },
});

// Network map bridge — subnet ARP/ping scan. Only available in desktop app.
// Scans local /24 subnets only; no internet-routable probes.
contextBridge.exposeInMainWorld('threatcaddyNetmap', {
  // Legacy batch methods (NetMapWorkspace)
  scan: () => ipcRenderer.invoke('netmap:scan'),
  arpOnly: () => ipcRenderer.invoke('netmap:arp-only'),
  ping: (ip) => ipcRenderer.invoke('netmap:ping', { ip }),

  // Streaming scan (NetworkMapPanel) — start returns immediately; devices arrive via events
  startScan: (params) => ipcRenderer.invoke('netmap:start-scan', params),
  detectSubnet: () => ipcRenderer.invoke('netmap:detect-subnet'),

  // Desktop → renderer: a device was discovered mid-scan
  onDeviceFound: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('netmap:device-found', listener);
    return () => ipcRenderer.removeListener('netmap:device-found', listener);
  },

  // Desktop → renderer: scan finished (or failed)
  onScanComplete: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('netmap:scan-complete', listener);
    return () => ipcRenderer.removeListener('netmap:scan-complete', listener);
  },
});

// Credential vault bridge — export/import all safeStorage credentials as an
// AES-256-GCM encrypted .tckeys file. Secrets never cross to the renderer;
// only success/count/filePath are returned.
contextBridge.exposeInMainWorld('threatcaddyCreds', {
  export: (password) =>
    ipcRenderer.invoke('creds:export', { password }),
  import: ({ filePath, base64, password }) =>
    ipcRenderer.invoke('creds:import', { filePath, base64, password }),
  openFile: () =>
    ipcRenderer.invoke('creds:open-file'),
});

// Sync auth bridge — MFA-gated sync auth (TOTP + passkeys).
// Secrets are stored via safeStorage in the main process.
// Renderer receives only success/null; raw secrets never cross this boundary.
contextBridge.exposeInMainWorld('threatcaddySyncAuth', {
  saveTotp: (secret) =>
    ipcRenderer.invoke('sync-auth:save-totp', secret),
  getTotp: () =>
    ipcRenderer.invoke('sync-auth:get-totp'),
  savePasskey: (credentialId, publicKey) =>
    ipcRenderer.invoke('sync-auth:save-passkey', credentialId, publicKey),
  getPasskey: () =>
    ipcRenderer.invoke('sync-auth:get-passkey'),
  clear: () =>
    ipcRenderer.invoke('sync-auth:clear'),
});

// Notes helpers — file import and Whisper transcription endpoint.
contextBridge.exposeInMainWorld('threatcaddyNotes', {
  // Open OS file picker for .txt/.vtt/.md meeting notes. Returns { ok, content, name } | { ok: false }.
  pickFile: () => ipcRenderer.invoke('notes:pick-file'),

  // Store Whisper endpoint URL in OS safeStorage. Returns { ok }.
  saveWhisperEndpoint: (url) => ipcRenderer.invoke('notes:whisper-save-endpoint', url),

  // Retrieve the stored Whisper endpoint URL. Returns string | null.
  getWhisperEndpoint: () => ipcRenderer.invoke('notes:whisper-get-endpoint'),
});

// LAN sync bridge — start/stop HTTP sync server, manage Headscale config.
// Auth key never returns to renderer; only serverUrl is readable after save.
contextBridge.exposeInMainWorld('threatcaddyLanSync', {
  start:          (opts) => ipcRenderer.invoke('lansync:start', opts),
  stop:           ()     => ipcRenderer.invoke('lansync:stop'),
  status:         ()     => ipcRenderer.invoke('lansync:status'),
  saveHeadscale:  (cfg)  => ipcRenderer.invoke('lansync:save-headscale', cfg),
  getHeadscale:   ()     => ipcRenderer.invoke('lansync:get-headscale'),
  clearHeadscale: ()     => ipcRenderer.invoke('lansync:clear-headscale'),
});

contextBridge.exposeInMainWorld('threatcaddyDesktop', {
  isDesktop: true,
  platform: process.platform,
  setWindowGlass: async (config) => {
    try {
      await ipcRenderer.invoke('threatcaddy-desktop:set-window-glass', config);
    } catch (error) {
      console.warn('ThreatCaddy desktop glass update failed:', error);
    }
  },
});

// Auto-updater bridge — renderer receives status events and can trigger actions.
// Never exposes raw GitHub tokens or download URLs to the renderer.
contextBridge.exposeInMainWorld('threatcaddyUpdater', {
  // Subscribe to update lifecycle events. Returns an unsubscribe function.
  onStatus: (callback) => {
    const channels = [
      'updater:checking',
      'updater:available',
      'updater:not-available',
      'updater:progress',
      'updater:downloaded',
      'updater:error',
    ];
    const listeners = channels.map((ch) => {
      const fn = (_event, payload) => callback(ch, payload);
      ipcRenderer.on(ch, fn);
      return { ch, fn };
    });
    return () => listeners.forEach(({ ch, fn }) => ipcRenderer.removeListener(ch, fn));
  },
  checkForUpdates: () => ipcRenderer.send('updater:check'),
  installAndQuit: () => ipcRenderer.send('updater:install-and-quit'),
});
