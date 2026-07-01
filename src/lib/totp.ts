// src/lib/totp.ts
//
// RFC 6238 TOTP implementation — pure renderer-side, no fetch, no exec.
// Uses an inline SHA-1 / HMAC-SHA1 so functions stay synchronous.

// ─── Inline SHA-1 ────────────────────────────────────────────────────────────
// Standard FIPS 180-4 SHA-1. Safe for HMAC/TOTP; not used for password hashing.

function sha1(data: Uint8Array): Uint8Array {
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;

  const bitLen = data.length * 8;
  const padLen = data.length < 56 ? 64 : 128;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padLen - 4, bitLen >>> 0, false);
  dv.setUint32(padLen - 8, Math.floor(bitLen / 2 ** 32), false);

  for (let off = 0; off < padLen; off += 64) {
    const w = new Uint32Array(80);
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 80; i++) {
      const v = w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16];
      w[i] = (v << 1) | (v >>> 31);
    }
    let [a, b, c, d, e] = [h0, h1, h2, h3, h4];
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if      (i < 20) { f = (b & c) | (~b & d);          k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d;                   k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else             { f = b ^ c ^ d;                   k = 0xca62c1d6; }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h, false));
  return out;
}

function hmacSha1(key: Uint8Array, data: Uint8Array): Uint8Array {
  const B = 64;
  const k = key.length > B ? sha1(key) : key;
  const padded = new Uint8Array(B);
  padded.set(k);
  const ipad = padded.map(b => b ^ 0x36);
  const opad = padded.map(b => b ^ 0x5c);
  const inner = new Uint8Array(B + data.length);
  inner.set(ipad); inner.set(data, B);
  const outer = new Uint8Array(B + 20);
  outer.set(opad); outer.set(sha1(inner), B);
  return sha1(outer);
}

// ─── Base32 ──────────────────────────────────────────────────────────────────

const BASE32_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes: Uint8Array): string {
  let bits = 0, val = 0, out = '';
  for (const byte of bytes) {
    val = (val << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHA[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHA[(val << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0, val = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHA.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid base32 character: ${ch}`);
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Generate a 20-byte random base32 TOTP secret. */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/** Compute the RFC 6238 TOTP code for the given secret and time (ms, default now). */
export function getTotpCode(secret: string, time?: number): string {
  const t = Math.floor((time ?? Date.now()) / 1000 / 30);
  const counter = new Uint8Array(8);
  const dv = new DataView(counter.buffer);
  dv.setUint32(4, t >>> 0, false);
  dv.setUint32(0, Math.floor(t / 2 ** 32), false);
  const key = base32Decode(secret);
  const mac = hmacSha1(key, counter);
  const offset = mac[19] & 0x0f;
  const code = (
    ((mac[offset]     & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8)  |
     (mac[offset + 3] & 0xff)
  ) % 1_000_000;
  return code.toString().padStart(6, '0');
}

/**
 * Verify a 6-digit TOTP code against the secret.
 * Accepts ±drift windows (default 1 = one 30-second window each way).
 */
export function verifyTotpCode(secret: string, code: string, drift = 1): boolean {
  if (!/^\d{6,8}$/.test(code)) return false;
  const now = Date.now();
  for (let d = -drift; d <= drift; d++) {
    if (getTotpCode(secret, now + d * 30_000) === code) return true;
  }
  return false;
}

/** Build an otpauth:// URI for QR code generation or manual authenticator entry. */
export function getTotpUri(secret: string, accountName: string, issuer = 'ThreatCaddy'): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
