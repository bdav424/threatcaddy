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

// Calendar sync bridge — pull/push via main-process IPC (tokens stay in main)
contextBridge.exposeInMainWorld('threatcaddy', {
  calendar: {
    pull:   (accountId, range)    => ipcRenderer.invoke('calendar:pull',   accountId, range),
    create: (accountId, event)    => ipcRenderer.invoke('calendar:create', accountId, event),
    update: (accountId, event)    => ipcRenderer.invoke('calendar:update', accountId, event),
    remove: (accountId, remoteId) => ipcRenderer.invoke('calendar:remove', accountId, remoteId),
  },
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
