import { describe, it, expect } from 'vitest';
import { supportsAuth, defaultAuthMethod, getMailProvider, listMailProviders } from '../lib/mail-providers';

describe('mail provider auth matrix', () => {
  it('Microsoft is OAuth-only (basic auth retired Apr 2026)', () => {
    expect(supportsAuth('microsoft', 'basic')).toBe(false);
    expect(supportsAuth('microsoft', 'oauth')).toBe(true);
  });

  it('Google supports both, prefers OAuth', () => {
    expect(supportsAuth('google', 'basic')).toBe(true);
    expect(supportsAuth('google', 'oauth')).toBe(true);
    expect(defaultAuthMethod('google')).toBe('oauth');
  });

  it('Proton uses the local bridge on loopback', () => {
    const p = getMailProvider('proton');
    expect(p.localBridge).toBe(true);
    expect(p.imap).toMatchObject({ host: '127.0.0.1' });
    expect(supportsAuth('proton', 'oauth')).toBe(false);
    expect(supportsAuth('proton', 'basic')).toBe(true);
  });

  it('generic IMAP/SMTP is basic-only with user-supplied endpoints', () => {
    const p = getMailProvider('generic');
    expect(p.imap).toBe('user');
    expect(p.smtp).toBe('user');
    expect(defaultAuthMethod('generic')).toBe('basic');
  });

  it('all four providers are present in listMailProviders()', () => {
    const ids = listMailProviders().map((p) => p.id);
    expect(ids).toContain('generic');
    expect(ids).toContain('proton');
    expect(ids).toContain('google');
    expect(ids).toContain('microsoft');
  });

  it('OAuth providers have complete config (authUrl, tokenUrl, scopes)', () => {
    for (const id of ['google', 'microsoft'] as const) {
      const p = getMailProvider(id);
      expect(p.oauth?.authUrl).toMatch(/^https:/);
      expect(p.oauth?.tokenUrl).toMatch(/^https:/);
      expect(p.oauth?.scopes.length).toBeGreaterThan(0);
      expect(p.oauth?.clientKind).toBe('desktop-loopback-pkce');
    }
  });
});
