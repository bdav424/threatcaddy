import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateOauthSsoRedirectHandshakeBoundary,
  type OAuthSsoGenericLabelMetadata,
  type OAuthSsoHandshakeMetadata,
  type OAuthSsoRedirectOriginMetadata,
} from '../lib/oauth-sso-redirect-handshake-boundary';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function redirectMetadata(
  overrides: Partial<OAuthSsoRedirectOriginMetadata> = {},
): OAuthSsoRedirectOriginMetadata {
  return Object.freeze({
    schemaVersion: 1,
    metadataKind: 'oauth-sso-redirect-origin-metadata',
    mode: 'sso',
    surface: 'assistantcaddy',
    providerId: 'generic-sso-provider',
    accountId: 'workspace-account-1',
    redirectOrigin: 'https://login.example.test',
    redirectPath: '/auth/callback',
    reviewed: true,
    reviewedAt: 1_700_000_000_000,
    expiresAt: 1_800_000_000_000,
    ...overrides,
  });
}

function handshakeMetadata(
  overrides: Partial<OAuthSsoHandshakeMetadata> = {},
): OAuthSsoHandshakeMetadata {
  return Object.freeze({
    schemaVersion: 1,
    metadataKind: 'oauth-sso-handshake-metadata',
    mode: 'sso',
    surface: 'assistantcaddy',
    providerId: 'generic-sso-provider',
    accountId: 'workspace-account-1',
    stateHandleId: 'state-handle-1',
    nonceHandleId: 'nonce-handle-1',
    pkceHandleId: 'pkce-handle-1',
    pkceChallengeMethod: 'S256',
    reviewed: true,
    reviewedAt: 1_700_000_000_100,
    expiresAt: 1_800_000_000_000,
    noRawStateValue: true,
    noRawNonceValue: true,
    noRawPkceVerifier: true,
    ...overrides,
  });
}

function labelMetadata(
  overrides: Partial<OAuthSsoGenericLabelMetadata> = {},
): OAuthSsoGenericLabelMetadata {
  return Object.freeze({
    schemaVersion: 1,
    metadataKind: 'oauth-sso-generic-label-metadata',
    primaryLabel: 'Single sign-on',
    secondaryLabel: 'Continue in your browser',
    reviewed: true,
    ...overrides,
  });
}

describe('oauth sso redirect handshake boundary', () => {
  it('returns frozen plan-only metadata for a reviewed future redirect handoff', () => {
    const decision = evaluateOauthSsoRedirectHandshakeBoundary({
      mode: 'sso',
      surface: 'assistantcaddy',
      providerId: 'generic-sso-provider',
      accountId: 'workspace-account-1',
      redirectMetadata: redirectMetadata(),
      handshakeMetadata: handshakeMetadata(),
      labelMetadata: labelMetadata(),
      now: 1_750_000_000_000,
    });

    expect(decision).toMatchObject({
      status: 'ready',
      ready: true,
      reason: 'oauth_sso_redirect_handshake_ready',
      blockReasons: [],
      contract: 'oauth-sso-redirect-handshake-boundary-v1',
      mode: 'sso',
      surface: 'assistantcaddy',
      providerId: 'generic-sso-provider',
      accountId: 'workspace-account-1',
      redirect: {
        origin: 'https://login.example.test',
        path: '/auth/callback',
      },
      handshake: {
        stateHandleId: 'state-handle-1',
        nonceHandleId: 'nonce-handle-1',
        pkceHandleId: 'pkce-handle-1',
        pkceChallengeMethod: 'S256',
      },
      labels: {
        primaryLabel: 'Single sign-on',
        secondaryLabel: 'Continue in your browser',
      },
      executable: false,
      sideEffects: 'none',
      opensWindow: false,
      mayRedirect: false,
      sideEffectBoundary: 'plan-only-no-fetch-no-socket-no-storage-no-oauth-no-window-no-credential-collection',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.redirect)).toBe(true);
    expect(Object.isFrozen(decision.handshake)).toBe(true);
    expect(Object.isFrozen(decision.labels)).toBe(true);
  });

  it('fails closed on secret-bearing input and does not echo auth codes, tokens, or bearer values', () => {
    const decision = evaluateOauthSsoRedirectHandshakeBoundary({
      mode: 'sso',
      surface: 'assistantcaddy',
      providerId: 'generic-sso-provider',
      accountId: 'workspace-account-1',
      redirectMetadata: {
        ...redirectMetadata(),
        authCode: 'code=do-not-echo',
      },
      handshakeMetadata: handshakeMetadata(),
      labelMetadata: labelMetadata(),
    });

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(JSON.stringify(decision).toLowerCase()).not.toContain('do-not-echo');
    expect(JSON.stringify(decision).toLowerCase()).not.toContain('authcode');
  });

  it('blocks unreviewed or stale redirect and handshake provenance', () => {
    expect(evaluateOauthSsoRedirectHandshakeBoundary({
      mode: 'sso',
      surface: 'assistantcaddy',
      providerId: 'generic-sso-provider',
      accountId: 'workspace-account-1',
      redirectMetadata: redirectMetadata({ expiresAt: 1_700_000_000_001 }),
      handshakeMetadata: handshakeMetadata(),
      labelMetadata: labelMetadata(),
      now: 1_700_000_000_010,
    })).toMatchObject({
      status: 'blocked',
      reason: 'redirect_metadata_stale',
    });

    expect(evaluateOauthSsoRedirectHandshakeBoundary({
      mode: 'sso',
      surface: 'assistantcaddy',
      providerId: 'generic-sso-provider',
      accountId: 'workspace-account-1',
      redirectMetadata: redirectMetadata(),
      handshakeMetadata: handshakeMetadata({ expiresAt: 1_700_000_000_001 }),
      labelMetadata: labelMetadata(),
      now: 1_700_000_000_010,
    })).toMatchObject({
      status: 'blocked',
      reason: 'handshake_metadata_stale',
    });
  });

  it('blocks mismatched owner metadata and metadata-only boundary violations', () => {
    expect(evaluateOauthSsoRedirectHandshakeBoundary({
      mode: 'sso',
      surface: 'assistantcaddy',
      providerId: 'generic-sso-provider',
      accountId: 'workspace-account-1',
      redirectMetadata: redirectMetadata({ providerId: 'other-provider' }),
      handshakeMetadata: handshakeMetadata(),
      labelMetadata: labelMetadata(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'redirect_metadata_mismatch',
    });

    expect(evaluateOauthSsoRedirectHandshakeBoundary({
      mode: 'sso',
      surface: 'assistantcaddy',
      providerId: 'generic-sso-provider',
      accountId: 'workspace-account-1',
      redirectMetadata: redirectMetadata(),
      handshakeMetadata: handshakeMetadata({ noRawPkceVerifier: false as true }),
      labelMetadata: labelMetadata(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'handshake_metadata_boundary_invalid',
    });
  });

  it('rejects branded or employer-specific copy and live-action metadata extras', () => {
    expect(evaluateOauthSsoRedirectHandshakeBoundary({
      mode: 'sso',
      surface: 'assistantcaddy',
      providerId: 'generic-sso-provider',
      accountId: 'workspace-account-1',
      redirectMetadata: redirectMetadata(),
      handshakeMetadata: handshakeMetadata(),
      labelMetadata: labelMetadata({ primaryLabel: 'VENDOR Slack SSO' }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'provider_agnostic_copy_required',
    });

    expect(evaluateOauthSsoRedirectHandshakeBoundary({
      mode: 'sso',
      surface: 'assistantcaddy',
      providerId: 'generic-sso-provider',
      accountId: 'workspace-account-1',
      redirectMetadata: {
        ...redirectMetadata(),
        requesterId: 'live-requester-1',
      },
      handshakeMetadata: handshakeMetadata(),
      labelMetadata: labelMetadata(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'forbidden_live_metadata',
    });
  });

  it('does not fetch, open sockets, store state, or open windows', () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const eventSourceSpy = vi.fn();
    const windowOpenSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('EventSource', eventSourceSpy);
    vi.stubGlobal('open', windowOpenSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const keySpy = vi.spyOn(Storage.prototype, 'key');

    evaluateOauthSsoRedirectHandshakeBoundary({
      mode: 'sso',
      surface: 'assistantcaddy',
      providerId: 'generic-sso-provider',
      accountId: 'workspace-account-1',
      redirectMetadata: redirectMetadata(),
      handshakeMetadata: handshakeMetadata(),
      labelMetadata: labelMetadata(),
      now: 1_750_000_000_000,
    });
    evaluateOauthSsoRedirectHandshakeBoundary({
      mode: 'oauth',
      surface: 'emailcaddy',
      providerId: 'generic-oauth-provider',
      redirectMetadata: redirectMetadata({
        mode: 'oauth',
        surface: 'emailcaddy',
        providerId: 'generic-oauth-provider',
        accountId: undefined,
      }),
      handshakeMetadata: handshakeMetadata({
        mode: 'oauth',
        surface: 'emailcaddy',
        providerId: 'generic-oauth-provider',
        accountId: undefined,
      }),
      labelMetadata: labelMetadata(),
      now: 1_750_000_000_000,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
  });
});
