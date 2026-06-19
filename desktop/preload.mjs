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
