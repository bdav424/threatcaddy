import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { db } from '../db';
import { exportJSON } from '../lib/export';
import { useEmailAccounts } from '../hooks/useEmailAccounts';
import {
  EMAIL_PROVIDER_METADATA,
  applyConnectionTestResult,
  createEmailAccountConfig,
  hasStoredEmailSecretMaterial,
  markEmailAccountConnected,
  markEmailAccountFailed,
  markEmailAccountPending,
  markEmailAccountRevoked,
  sanitizeEmailAccount,
  sanitizeEmailAccounts,
  testEmailAccountConnection,
  type EmailAccountConfig,
  type EmailProviderId,
} from '../lib/email-onboarding';

const providers: EmailProviderId[] = [
  'google-gmail',
  'microsoft-outlook',
  'proton-bridge',
  'generic-imap-smtp',
  'manual-local-bridge',
];

beforeEach(async () => {
  localStorage.clear();
  vi.restoreAllMocks();
  await Promise.all([
    db.notes.clear(),
    db.tasks.clear(),
    db.folders.clear(),
    db.tags.clear(),
    db.timelineEvents.clear(),
    db.timelines.clear(),
    db.whiteboards.clear(),
    db.standaloneIOCs.clear(),
    db.evidenceItems.clear(),
    db.chatThreads.clear(),
    db.noteTemplates.clear(),
    db.playbookTemplates.clear(),
    db.agentActions.clear(),
    db.agentProfiles.clear(),
    db.agentDeployments.clear(),
    db.agentMeetings.clear(),
  ]);
});

function makeAccount(providerId: EmailProviderId, overrides: Partial<EmailAccountConfig> = {}): EmailAccountConfig {
  return {
    ...createEmailAccountConfig({
      id: `${providerId}-account`,
      providerId,
      address: 'analyst@example.test',
      now: 1_700_000_000_000,
    }),
    ...overrides,
  };
}

describe('email onboarding provider contract', () => {
  it('defines every required provider with safe no-send defaults', () => {
    for (const providerId of providers) {
      const metadata = EMAIL_PROVIDER_METADATA[providerId];
      expect(metadata.id).toBe(providerId);
      expect(metadata.capabilities.canDraft).toBe(true);
      expect(metadata.capabilities.sendEnabledByDefault).toBe(false);
      expect(metadata.notes.length).toBeGreaterThan(0);
    }

    expect(EMAIL_PROVIDER_METADATA['google-gmail'].capabilities.requiresOAuth).toBe(true);
    expect(EMAIL_PROVIDER_METADATA['microsoft-outlook'].capabilities.requiresOAuth).toBe(true);
    expect(EMAIL_PROVIDER_METADATA['proton-bridge'].capabilities.requiresLocalBridge).toBe(true);
    expect(EMAIL_PROVIDER_METADATA['generic-imap-smtp'].capabilities.requiresLocalBridge).toBe(true);
    expect(EMAIL_PROVIDER_METADATA['manual-local-bridge'].setupMode).toBe('manual-local-proxy');
  });

  it('sanitizes account metadata and strips plaintext secret material', () => {
    const raw = {
      id: 'acct-1',
      providerId: 'google-gmail',
      label: 'Gmail',
      address: 'analyst@example.test',
      status: 'connected',
      sendPolicy: 'manual_confirm',
      accessToken: 'plain-access-token',
      refresh_token: 'plain-refresh-token',
      password: 'plain-password',
      credentialRef: {
        kind: 'oauth-token',
        id: 'oauth-ref-1',
        label: 'External OAuth reference',
        storedBy: 'external-provider',
        accessToken: 'nested-token',
      },
      createdAt: 10,
      updatedAt: 20,
    };

    expect(hasStoredEmailSecretMaterial(raw)).toBe(true);
    const sanitized = sanitizeEmailAccount(raw);

    expect(sanitized).toMatchObject({
      schemaVersion: 1,
      id: 'acct-1',
      providerId: 'google-gmail',
      status: 'connected',
      sendPolicy: 'manual_confirm',
      credentialRef: {
        kind: 'oauth-token',
        id: 'oauth-ref-1',
        label: 'External OAuth reference',
        storedBy: 'external-provider',
      },
    });
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain('plain-access-token');
    expect(serialized).not.toContain('plain-refresh-token');
    expect(serialized).not.toContain('plain-password');
    expect(serialized).not.toContain('nested-token');
    expect(hasStoredEmailSecretMaterial(sanitized)).toBe(false);
  });

  it('checks secret material without JSON serialization', () => {
    const safeReference: Record<string, unknown> = {
      kind: 'external-secret',
      id: 'oauth-ref-1',
      label: 'External OAuth reference',
      storedBy: 'secret-store',
    };
    safeReference.self = safeReference;
    safeReference.tags = new Set(['safe-reference']);

    expect(() => hasStoredEmailSecretMaterial(safeReference)).not.toThrow();
    expect(hasStoredEmailSecretMaterial(safeReference)).toBe(false);

    const secretCarrier: Record<string, unknown> = { id: 'acct-1' };
    secretCarrier.self = secretCarrier;
    secretCarrier.nested = new Map<unknown, unknown>([['app-password', 'plain-mailbox-secret']]);

    expect(() => hasStoredEmailSecretMaterial(secretCarrier)).not.toThrow();
    expect(hasStoredEmailSecretMaterial(secretCarrier)).toBe(true);
  });

  it('drops invalid providers and coerces invalid states to not_configured', () => {
    expect(sanitizeEmailAccount({ id: 'bad', providerId: 'unknown' })).toBeNull();
    expect(sanitizeEmailAccounts([
      { id: 'bad', providerId: 'unknown' },
      { id: 'ok', providerId: 'proton-bridge', status: 'surprise' },
    ])).toEqual([
      expect.objectContaining({
        id: 'ok',
        providerId: 'proton-bridge',
        status: 'not_configured',
      }),
    ]);
  });

  it('deduplicates account ids and keeps the newest safe metadata', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234);

    const sanitized = sanitizeEmailAccounts([
      { id: 'dup-account', providerId: 'google-gmail', label: 'Older', createdAt: 10, updatedAt: 20 },
      { id: 'dup-account', providerId: 'google-gmail', label: 'Newer', createdAt: 10, updatedAt: 30, status: 'connected' },
      { id: 'fresh-account', providerId: 'manual-local-bridge', createdAt: -1, updatedAt: Number.POSITIVE_INFINITY },
      'not-an-account',
    ]);

    expect(sanitized).toEqual([
      expect.objectContaining({
        id: 'dup-account',
        label: 'Newer',
        status: 'connected',
        updatedAt: 30,
      }),
      expect.objectContaining({
        id: 'fresh-account',
        createdAt: 1_234,
        updatedAt: 1_234,
      }),
    ]);
  });

  it('drops malformed credential references and secret-looking allowed fields', () => {
    const sanitized = sanitizeEmailAccount({
      id: 'acct-1',
      providerId: 'generic-imap-smtp',
      label: 'Mailbox Password',
      address: 'apiToken@example.test',
      credentialRef: {
        kind: 'local-bridge',
        id: 'bridge-ref',
        label: 'Bridge App Password',
        storedBy: 'secret-store',
      },
      lastError: 'SMTP password rejected by upstream',
      createdAt: 10,
      updatedAt: 5,
    });

    expect(sanitized).toMatchObject({
      id: 'acct-1',
      providerId: 'generic-imap-smtp',
      label: 'Generic IMAP/SMTP',
      address: undefined,
      credentialRef: undefined,
      lastError: 'Connection test failed. Sensitive error details were removed.',
      createdAt: 10,
      updatedAt: 10,
    });
    expect(sanitizeEmailAccount({
      id: 'acct-password',
      providerId: 'google-gmail',
    })).toBeNull();
  });

  it('drops unsafe timestamps and malformed credential identifiers', () => {
    vi.spyOn(Date, 'now').mockReturnValue(4_321);

    const sanitized = sanitizeEmailAccount({
      id: 'acct-1',
      providerId: 'microsoft-outlook',
      credentialRef: {
        kind: 'oauth-token',
        id: 'token-password-ref',
        storedBy: 'external-provider',
      },
      lastTestedAt: -1,
      revokedAt: 9_000_000_000_000_001,
      createdAt: 0.5,
      updatedAt: Number.NaN,
    });

    expect(sanitized).toMatchObject({
      id: 'acct-1',
      credentialRef: undefined,
      lastTestedAt: undefined,
      revokedAt: undefined,
      createdAt: 4_321,
      updatedAt: 4_321,
    });
  });
});

describe('email onboarding status and connection tests', () => {
  it('transitions through pending, connected, failed, and revoked states', () => {
    const account = makeAccount('google-gmail', { status: 'not_configured' });
    const pending = markEmailAccountPending(account, 100);
    const connected = markEmailAccountConnected(pending, 200);
    const failed = markEmailAccountFailed(connected, 'OAuth consent missing', 300);
    const revoked = markEmailAccountRevoked(failed, 400);

    expect(pending.status).toBe('pending');
    expect(connected.status).toBe('connected');
    expect(connected.lastTestedAt).toBe(200);
    expect(failed.status).toBe('failed');
    expect(failed.lastError).toBe('OAuth consent missing');
    expect(revoked.status).toBe('revoked');
    expect(revoked.credentialRef).toBeUndefined();
    expect(revoked.revokedAt).toBe(400);
  });

  it('fails closed for provider OAuth without storing or fetching credentials', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const account = makeAccount('google-gmail', { status: 'pending', credentialRef: undefined });

    const result = await testEmailAccountConnection(account, { now: 500 });
    const next = applyConnectionTestResult(account, result);

    expect(result).toMatchObject({
      ok: false,
      status: 'failed',
      code: 'needs_provider_oauth',
    });
    expect(next.status).toBe('failed');
    expect(next.lastError).toContain('OAuth');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed when a local bridge is required but unavailable', async () => {
    const account = makeAccount('generic-imap-smtp', {
      status: 'pending',
      credentialRef: {
        kind: 'local-bridge',
        id: 'bridge-ref',
        storedBy: 'local-bridge',
      },
    });

    const result = await testEmailAccountConnection(account, { now: 600, localBridgeAvailable: false });

    expect(result).toMatchObject({
      ok: false,
      status: 'failed',
      code: 'local_bridge_unavailable',
    });
    expect(result.message).toContain('did not attempt IMAP/SMTP');
  });

  it('supports explicit mock-only connection success without provider calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const account = makeAccount('manual-local-bridge', { status: 'design_only/mock_only' });

    const result = await testEmailAccountConnection(account, { now: 700, allowMockConnected: true });
    const next = applyConnectionTestResult(account, result);

    expect(result).toMatchObject({
      ok: true,
      status: 'connected',
      code: 'mock_connected',
    });
    expect(next.status).toBe('connected');
    expect(next.sendPolicy).toBe('draft_only');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps revoked accounts revoked and blocks connection tests', async () => {
    const account = makeAccount('microsoft-outlook', { status: 'revoked', revokedAt: 10 });

    const result = await testEmailAccountConnection(account, { now: 800 });
    const next = applyConnectionTestResult(account, result);

    expect(result).toMatchObject({
      ok: false,
      status: 'revoked',
      code: 'revoked',
    });
    expect(next.status).toBe('revoked');
    expect(next.credentialRef).toBeUndefined();
  });
});

describe('email onboarding storage boundaries', () => {
  it('persists only sanitized account metadata through useEmailAccounts', () => {
    const { result } = renderHook(() => useEmailAccounts());

    act(() => {
      result.current.addAccount({
        id: 'gmail-account',
        providerId: 'google-gmail',
        address: 'analyst@example.test',
        now: 900,
      });
    });

    const stored = JSON.parse(localStorage.getItem('threatcaddy-settings') || '{}');
    expect(stored.emailAccounts).toEqual([
      expect.objectContaining({
        id: 'gmail-account',
        providerId: 'google-gmail',
        status: 'pending',
        sendPolicy: 'draft_only',
      }),
    ]);
    expect(JSON.stringify(stored)).not.toContain('accessToken');
    expect(JSON.stringify(stored)).not.toContain('password');
  });

  it('does not include email account metadata or secrets in JSON export', async () => {
    localStorage.setItem('threatcaddy-settings', JSON.stringify({
      emailAccounts: [{
        id: 'acct-1',
        providerId: 'google-gmail',
        status: 'pending',
        accessToken: 'plain-access-token',
        credentialRef: { kind: 'oauth-token', id: 'oauth-ref', storedBy: 'external-provider' },
      }],
      quickLinks: [{ id: 'ql', title: 'Safe', url: 'https://example.test' }],
    }));

    const exported = await exportJSON();
    const parsed = JSON.parse(exported);

    expect(parsed.quickLinks).toHaveLength(1);
    expect(parsed.emailAccounts).toBeUndefined();
    expect(exported).not.toContain('plain-access-token');
    expect(exported).not.toContain('oauth-ref');
  });
});
