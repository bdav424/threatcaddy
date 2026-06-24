// src/lib/creds-bridge.ts
//
// Renderer-side wrapper for the desktop credential vault IPC bridge.
// All operations are desktop-only; returns { success: false, error: 'desktop-only' }
// when running in web/SPA mode (window.threatcaddyCreds not present).

interface CredsBridgeGlobal {
  threatcaddyCreds?: {
    export(password: string): Promise<{
      success: boolean;
      filePath?: string;
      base64?: string;
      exportedCount?: number;
      error?: string;
    }>;
    import(opts: {
      filePath?: string;
      base64?: string;
      password: string;
    }): Promise<{
      success: boolean;
      restoredCount?: number;
      error?: string;
    }>;
    openFile(): Promise<{ filePath: string | null }>;
  };
}

function getBridge() {
  return (globalThis as unknown as CredsBridgeGlobal).threatcaddyCreds ?? null;
}

export const credsBridge = {
  async exportCredentials(
    password: string,
    _filePath?: string,
  ): Promise<{ success: boolean; base64?: string; exportedCount?: number; error?: string }> {
    const bridge = getBridge();
    if (!bridge) return { success: false, error: 'desktop-only' };
    return bridge.export(password);
  },

  async importCredentials(opts: {
    filePath?: string;
    base64?: string;
    password: string;
  }): Promise<{ success: boolean; count?: number; error?: string }> {
    const bridge = getBridge();
    if (!bridge) return { success: false, error: 'desktop-only' };
    const result = await bridge.import(opts);
    return { success: result.success, count: result.restoredCount, error: result.error };
  },

  async openCredentialFile(): Promise<string | null> {
    const bridge = getBridge();
    if (!bridge) return null;
    const result = await bridge.openFile();
    return result.filePath;
  },

  isAvailable(): boolean {
    return getBridge() !== null;
  },
};
