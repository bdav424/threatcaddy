import { contextBridge, ipcRenderer } from 'electron';

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
