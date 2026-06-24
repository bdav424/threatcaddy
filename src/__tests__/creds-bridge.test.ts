import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { credsBridge } from '../lib/creds-bridge';
import * as nodeCrypto from 'node:crypto';

// ─── Crypto spec implementation (mirrors desktop/creds-bridge.mjs) ──────────
// Tested independently so the spec is the contract, not the implementation.

const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

function deriveKey(password: string, salt: Buffer): Buffer {
  return nodeCrypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
}

interface TckeysEnvelope {
  version: number;
  salt: string;
  iv: string;
  data: string;
}

function encrypt(plaintext: string, password: string): TckeysEnvelope {
  const salt = nodeCrypto.randomBytes(32);
  const iv   = nodeCrypto.randomBytes(GCM_IV_BYTES);
  const key  = deriveKey(password, salt);

  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const data = Buffer.concat([ciphertext, tag]);

  return {
    version: 1,
    salt: salt.toString('base64'),
    iv:   iv.toString('base64'),
    data: data.toString('base64'),
  };
}

function decrypt(envelope: TckeysEnvelope, password: string): string {
  if (envelope.version !== 1) throw new Error('Unsupported .tckeys version');
  const salt = Buffer.from(envelope.salt, 'base64');
  const iv   = Buffer.from(envelope.iv,   'base64');
  const data = Buffer.from(envelope.data, 'base64');

  if (data.length < GCM_TAG_BYTES) throw new Error('Invalid or corrupted file');

  const ciphertext = data.subarray(0, data.length - GCM_TAG_BYTES);
  const tag        = data.subarray(data.length - GCM_TAG_BYTES);
  const key        = deriveKey(password, salt);

  const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

// ─── Crypto round-trip tests ────────────────────────────────────────────────

describe('S-creds crypto spec', () => {
  it('round-trips plaintext through encrypt → decrypt', () => {
    const payload = JSON.stringify({ credentials: { 'mail-credentials/abc.bin': '{"user":"test"}' } });
    const password = 'correct-horse-battery-staple';
    const envelope = encrypt(payload, password);
    const restored = decrypt(envelope, password);
    expect(restored).toBe(payload);
  });

  it('returns envelope matching { version, salt, iv, data } with base64 values', () => {
    const envelope = encrypt('hello', 'pw');
    expect(envelope.version).toBe(1);
    expect(typeof envelope.salt).toBe('string');
    expect(typeof envelope.iv).toBe('string');
    expect(typeof envelope.data).toBe('string');
    // salt must decode to 32 bytes
    expect(Buffer.from(envelope.salt, 'base64').length).toBe(32);
    // iv must decode to 12 bytes
    expect(Buffer.from(envelope.iv, 'base64').length).toBe(GCM_IV_BYTES);
  });

  it('throws on wrong password', () => {
    const envelope = encrypt('secret payload', 'right-password');
    expect(() => decrypt(envelope, 'wrong-password')).toThrow();
  });

  it('throws on tampered data', () => {
    const envelope = encrypt('payload', 'password');
    const tampered = { ...envelope, data: Buffer.alloc(32).toString('base64') };
    expect(() => decrypt(tampered, 'password')).toThrow();
  });

  it('throws on unsupported version', () => {
    const envelope = encrypt('payload', 'password');
    expect(() => decrypt({ ...envelope, version: 99 }, 'password')).toThrow('Unsupported .tckeys version');
  });

  it('each encryption produces a unique ciphertext (random IV + salt)', () => {
    const a = encrypt('same plaintext', 'same password');
    const b = encrypt('same plaintext', 'same password');
    expect(a.iv).not.toBe(b.iv);
    expect(a.salt).not.toBe(b.salt);
    expect(a.data).not.toBe(b.data);
  });

  it('envelope is JSON-serializable (file format)', () => {
    const envelope = encrypt('payload', 'pw');
    const json = JSON.stringify(envelope);
    const parsed = JSON.parse(json) as TckeysEnvelope;
    const restored = decrypt(parsed, 'pw');
    expect(restored).toBe('payload');
  });
});

// ─── Renderer bridge tests ───────────────────────────────────────────────────
// credsBridge reads globalThis.threatcaddyCreds on every call (not at import
// time), so we can switch the global between tests without re-importing.

const mockExport = vi.fn();
const mockImport = vi.fn();
const mockOpenFile = vi.fn();

const mockBridge = {
  export: mockExport,
  import: mockImport,
  openFile: mockOpenFile,
};

function installBridge() {
  (globalThis as Record<string, unknown>).threatcaddyCreds = mockBridge;
}

function removeBridge() {
  delete (globalThis as Record<string, unknown>).threatcaddyCreds;
}

describe('credsBridge — desktop mode', () => {
  beforeEach(() => {
    mockExport.mockReset();
    mockImport.mockReset();
    mockOpenFile.mockReset();
    installBridge();
  });

  afterEach(removeBridge);

  it('isAvailable returns true when bridge is present', () => {
    expect(credsBridge.isAvailable()).toBe(true);
  });

  it('exportCredentials calls bridge.export and returns success', async () => {
    mockExport.mockResolvedValue({ success: true, base64: 'abc=', exportedCount: 3 });
    const result = await credsBridge.exportCredentials('password123');
    expect(mockExport).toHaveBeenCalledWith('password123');
    expect(result.success).toBe(true);
    expect(result.base64).toBe('abc=');
    expect(result.exportedCount).toBe(3);
  });

  it('importCredentials maps restoredCount → count', async () => {
    mockImport.mockResolvedValue({ success: true, restoredCount: 5 });
    const result = await credsBridge.importCredentials({ filePath: '/tmp/t.tckeys', password: 'pw' });
    expect(mockImport).toHaveBeenCalledWith({ filePath: '/tmp/t.tckeys', password: 'pw' });
    expect(result.success).toBe(true);
    expect(result.count).toBe(5);
  });

  it('importCredentials passes error through on failure', async () => {
    mockImport.mockResolvedValue({ success: false, error: 'Invalid password or corrupted file' });
    const result = await credsBridge.importCredentials({ filePath: '/f.tckeys', password: 'bad' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid password/);
  });

  it('openCredentialFile returns filePath from bridge', async () => {
    mockOpenFile.mockResolvedValue({ filePath: '/home/user/creds.tckeys' });
    const fp = await credsBridge.openCredentialFile();
    expect(fp).toBe('/home/user/creds.tckeys');
  });

  it('openCredentialFile returns null on cancel', async () => {
    mockOpenFile.mockResolvedValue({ filePath: null });
    const fp = await credsBridge.openCredentialFile();
    expect(fp).toBeNull();
  });
});

describe('credsBridge — web/SPA mode (no bridge)', () => {
  beforeEach(removeBridge);

  it('isAvailable returns false when bridge is absent', () => {
    expect(credsBridge.isAvailable()).toBe(false);
  });

  it('exportCredentials returns desktop-only error', async () => {
    const result = await credsBridge.exportCredentials('pw');
    expect(result.success).toBe(false);
    expect(result.error).toBe('desktop-only');
  });

  it('importCredentials returns desktop-only error', async () => {
    const result = await credsBridge.importCredentials({ filePath: '/x.tckeys', password: 'pw' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('desktop-only');
  });

  it('openCredentialFile returns null', async () => {
    const fp = await credsBridge.openCredentialFile();
    expect(fp).toBeNull();
  });
});
