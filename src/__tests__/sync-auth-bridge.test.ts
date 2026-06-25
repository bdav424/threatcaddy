import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncAuthBridge } from '../lib/sync-auth-bridge';

// ─── Mock bridge shape ────────────────────────────────────────────────────────

const mockSaveTotp     = vi.fn();
const mockGetTotp      = vi.fn();
const mockSavePasskey  = vi.fn();
const mockGetPasskey   = vi.fn();
const mockClear        = vi.fn();

const mockBridge = {
  saveTotp:    mockSaveTotp,
  getTotp:     mockGetTotp,
  savePasskey: mockSavePasskey,
  getPasskey:  mockGetPasskey,
  clear:       mockClear,
};

function installBridge() {
  (globalThis as Record<string, unknown>).threatcaddySyncAuth = mockBridge;
}

function removeBridge() {
  delete (globalThis as Record<string, unknown>).threatcaddySyncAuth;
}

// ─── Desktop mode ─────────────────────────────────────────────────────────────

describe('syncAuthBridge — desktop mode', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installBridge();
  });
  afterEach(removeBridge);

  it('isAvailable() returns true when bridge is present', () => {
    expect(syncAuthBridge.isAvailable()).toBe(true);
  });

  it('saveTotpSecret() calls bridge.saveTotp with the secret', async () => {
    mockSaveTotp.mockResolvedValue(undefined);
    await syncAuthBridge.saveTotpSecret('MYSECRET');
    expect(mockSaveTotp).toHaveBeenCalledWith('MYSECRET');
  });

  it('getTotpSecret() returns the secret from bridge.getTotp', async () => {
    mockGetTotp.mockResolvedValue('MYSECRET');
    const result = await syncAuthBridge.getTotpSecret();
    expect(result).toBe('MYSECRET');
  });

  it('getTotpSecret() returns null when bridge.getTotp returns null', async () => {
    mockGetTotp.mockResolvedValue(null);
    const result = await syncAuthBridge.getTotpSecret();
    expect(result).toBeNull();
  });

  it('savePasskeyCredential() calls bridge.savePasskey with id and publicKey', async () => {
    mockSavePasskey.mockResolvedValue(undefined);
    await syncAuthBridge.savePasskeyCredential('cred-id-abc', 'pubkey-xyz');
    expect(mockSavePasskey).toHaveBeenCalledWith('cred-id-abc', 'pubkey-xyz');
  });

  it('getPasskeyCredential() returns the credential object', async () => {
    mockGetPasskey.mockResolvedValue({ credentialId: 'cred-id-abc', publicKey: 'pubkey-xyz' });
    const result = await syncAuthBridge.getPasskeyCredential();
    expect(result).toEqual({ credentialId: 'cred-id-abc', publicKey: 'pubkey-xyz' });
  });

  it('getPasskeyCredential() returns null when no passkey is stored', async () => {
    mockGetPasskey.mockResolvedValue(null);
    const result = await syncAuthBridge.getPasskeyCredential();
    expect(result).toBeNull();
  });

  it('clearSyncAuth() calls bridge.clear', async () => {
    mockClear.mockResolvedValue(undefined);
    await syncAuthBridge.clearSyncAuth();
    expect(mockClear).toHaveBeenCalled();
  });
});

// ─── Web / SPA mode (no bridge) ───────────────────────────────────────────────

describe('syncAuthBridge — web/SPA mode (no bridge)', () => {
  beforeEach(removeBridge);

  it('isAvailable() returns false when bridge is absent', () => {
    expect(syncAuthBridge.isAvailable()).toBe(false);
  });

  it('saveTotpSecret() is a no-op (does not throw)', async () => {
    await expect(syncAuthBridge.saveTotpSecret('SECRET')).resolves.toBeUndefined();
  });

  it('getTotpSecret() returns null', async () => {
    expect(await syncAuthBridge.getTotpSecret()).toBeNull();
  });

  it('savePasskeyCredential() is a no-op (does not throw)', async () => {
    await expect(syncAuthBridge.savePasskeyCredential('id', 'key')).resolves.toBeUndefined();
  });

  it('getPasskeyCredential() returns null', async () => {
    expect(await syncAuthBridge.getPasskeyCredential()).toBeNull();
  });

  it('clearSyncAuth() is a no-op (does not throw)', async () => {
    await expect(syncAuthBridge.clearSyncAuth()).resolves.toBeUndefined();
  });
});
