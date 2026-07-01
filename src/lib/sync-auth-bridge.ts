// src/lib/sync-auth-bridge.ts
//
// Renderer-side wrapper for the desktop sync-auth IPC bridge.
// All secrets are stored via safeStorage in the main process; the renderer
// receives only opaque success/null responses — secrets never cross this boundary.

interface SyncAuthBridgeGlobal {
  threatcaddySyncAuth?: {
    saveTotp(secret: string): Promise<void>;
    getTotp(): Promise<string | null>;
    savePasskey(credentialId: string, publicKey: string): Promise<void>;
    getPasskey(): Promise<{ credentialId: string; publicKey: string } | null>;
    clear(): Promise<void>;
  };
}

function getBridge() {
  return (globalThis as unknown as SyncAuthBridgeGlobal).threatcaddySyncAuth ?? null;
}

export const syncAuthBridge = {
  async saveTotpSecret(secret: string): Promise<void> {
    const b = getBridge();
    if (!b) return;
    await b.saveTotp(secret);
  },

  async getTotpSecret(): Promise<string | null> {
    const b = getBridge();
    if (!b) return null;
    return b.getTotp();
  },

  async savePasskeyCredential(credentialId: string, publicKey: string): Promise<void> {
    const b = getBridge();
    if (!b) return;
    await b.savePasskey(credentialId, publicKey);
  },

  async getPasskeyCredential(): Promise<{ credentialId: string; publicKey: string } | null> {
    const b = getBridge();
    if (!b) return null;
    return b.getPasskey();
  },

  async clearSyncAuth(): Promise<void> {
    const b = getBridge();
    if (!b) return;
    await b.clear();
  },

  isAvailable(): boolean {
    return getBridge() !== null;
  },
};
