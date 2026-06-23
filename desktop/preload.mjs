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
contextBridge.exposeInMainWorld('threatcaddy', {
  calendar: {
    startOAuth:      (providerId)          => ipcRenderer.invoke('calendar:start-oauth',      { providerId }),
    registerAccount: (account)             => ipcRenderer.invoke('calendar:register-account', account),
    pull:            (accountId, range)    => ipcRenderer.invoke('calendar:pull',              accountId, range),
    create:          (accountId, event)    => ipcRenderer.invoke('calendar:create',            accountId, event),
    update:          (accountId, event)    => ipcRenderer.invoke('calendar:update',            accountId, event),
    remove:          (accountId, remoteId) => ipcRenderer.invoke('calendar:remove',            accountId, remoteId),
  },
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
  scan: () => ipcRenderer.invoke('netmap:scan'),
  arpOnly: () => ipcRenderer.invoke('netmap:arp-only'),
  ping: (ip) => ipcRenderer.invoke('netmap:ping', { ip }),
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
