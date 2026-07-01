import { describe, it, expect } from 'vitest';
import {
  generateTotpSecret,
  getTotpCode,
  verifyTotpCode,
  getTotpUri,
} from '../lib/totp';

describe('generateTotpSecret', () => {
  it('returns a base32 string of 32 characters (20 bytes)', () => {
    const secret = generateTotpSecret();
    expect(typeof secret).toBe('string');
    // 20 bytes → ceil(20 * 8 / 5) = 32 base32 chars
    expect(secret.length).toBe(32);
  });

  it('uses only uppercase base32 alphabet characters', () => {
    const secret = generateTotpSecret();
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it('generates unique secrets on each call', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
  });
});

describe('getTotpCode', () => {
  // RFC 6238 test vector (SHA-1, seed = base32("12345678901234567890"))
  // The seed in base32 is "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
  // At T=0 (time=0), counter=0: expected TOTP code for SHA-1 is "755224"
  // Source: https://www.rfc-editor.org/rfc/rfc6238#appendix-B
  const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('returns a 6-character string', () => {
    const code = getTotpCode(generateTotpSecret());
    expect(code).toHaveLength(6);
  });

  it('returns only digits', () => {
    const code = getTotpCode(generateTotpSecret());
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('is deterministic for the same secret and time window', () => {
    const secret = generateTotpSecret();
    const t = Date.now();
    // Both calls land in the same 30-second window
    const a = getTotpCode(secret, t);
    const b = getTotpCode(secret, t + 1000);
    expect(a).toBe(b);
  });

  it('produces different codes for adjacent time windows', () => {
    const secret = generateTotpSecret();
    const t = 1_000_000_000_000; // arbitrary epoch ms
    const codeT0 = getTotpCode(secret, t);
    const codeT1 = getTotpCode(secret, t + 30_000); // next window
    // Statistically almost certain to differ (1 in 1,000,000 chance of collision)
    expect(codeT0).not.toBe(codeT1);
  });

  it('passes RFC 6238 test vector (T=59s → counter=1)', () => {
    // T = floor(59 / 30) = 1; RFC 6238 Appendix B: expected "287082" for SHA-1 seed
    const code = getTotpCode(RFC_SECRET, 59_000);
    expect(code).toBe('287082');
  });

  it('passes RFC 6238 test vector (T=1111111109s)', () => {
    // T = floor(1111111109 / 30) = 37037036; RFC expects "081804"
    const code = getTotpCode(RFC_SECRET, 1_111_111_109_000);
    expect(code).toBe('081804');
  });
});

describe('verifyTotpCode', () => {
  it('returns true for a code from the current window', () => {
    const secret = generateTotpSecret();
    const t = Date.now();
    const code = getTotpCode(secret, t);
    // verifyTotpCode uses Date.now() internally; pass a small time offset for test reliability
    // We verify by calling with the SAME secret — if getTotpCode and verifyTotpCode
    // are consistent, the code from "now" should verify now.
    const result = verifyTotpCode(secret, code, 1);
    expect(result).toBe(true);
  });

  it('returns true for a code from the previous window (drift=1)', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const prevCode = getTotpCode(secret, now - 30_000);
    // The previous-window code should pass within drift=1
    expect(verifyTotpCode(secret, prevCode, 1)).toBe(true);
  });

  it('returns false for a code from two windows back (drift=1)', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const oldCode = getTotpCode(secret, now - 60_000);
    // Two windows back is outside drift=1
    // Note: there is a ~0.1% chance this is still valid due to window alignment;
    // we accept this as a probabilistic test.
    const prevCode = getTotpCode(secret, now - 30_000);
    // The two-windows-back code should differ from the previous code
    if (oldCode !== prevCode) {
      expect(verifyTotpCode(secret, oldCode, 1)).toBe(false);
    }
  });

  it('returns false for a wrong code', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, '000000')).toBe(false);
  });

  it('rejects non-numeric input', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, 'abcdef')).toBe(false);
  });

  it('rejects codes shorter than 6 digits', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, '12345')).toBe(false);
  });
});

describe('getTotpUri', () => {
  it('starts with otpauth://totp/', () => {
    const uri = getTotpUri(generateTotpSecret(), 'alice@example.com');
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
  });

  it('contains the secret parameter', () => {
    const secret = generateTotpSecret();
    const uri = getTotpUri(secret, 'alice');
    expect(uri).toContain(`secret=${secret}`);
  });

  it('includes default issuer ThreatCaddy', () => {
    const uri = getTotpUri(generateTotpSecret(), 'alice');
    expect(uri).toContain('issuer=ThreatCaddy');
  });

  it('uses custom issuer when provided', () => {
    const uri = getTotpUri(generateTotpSecret(), 'alice', 'MyApp');
    expect(uri).toContain('issuer=MyApp');
  });

  it('includes SHA1 algorithm and 30s period', () => {
    const uri = getTotpUri(generateTotpSecret(), 'alice');
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('period=30');
    expect(uri).toContain('digits=6');
  });

  it('URL-encodes the account name and issuer in the label', () => {
    const uri = getTotpUri(generateTotpSecret(), 'alice@example.com', 'My App');
    // label = "My%20App:alice%40example.com" or similar
    expect(uri).toContain('alice%40example.com');
  });
});
