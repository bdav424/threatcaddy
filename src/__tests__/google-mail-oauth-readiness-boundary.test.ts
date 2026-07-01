import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateGoogleMailOAuthReadinessBoundary,
  type GoogleMailOAuthConsentEvidence,
  type GoogleMailOAuthReadinessInput,
  type GoogleMailOAuthRedirectPlan,
  type GoogleMailOAuthReviewedScope,
} from '../lib/google-mail-oauth-readiness-boundary';

const NOW = 1_800_000_000_000;

function reviewedScope(
  overrides: Partial<GoogleMailOAuthReviewedScope> = {},
): GoogleMailOAuthReviewedScope {
  return Object.freeze({
    schemaVersion: 1,
    scopeKind: 'google-mail-oauth-reviewed-scope',
    id: 'https://www.googleapis.com/auth/gmail.readonly',
    label: 'Gmail readonly access',
    reviewed: true,
    ...overrides,
  });
}

function consentEvidence(
  overrides: Partial<GoogleMailOAuthConsentEvidence> = {},
): GoogleMailOAuthConsentEvidence {
  return Object.freeze({
    schemaVersion: 1,
    consentKind: 'google-mail-oauth-reviewed-consent',
    providerId: 'google-gmail',
    accountId: 'analyst@example.test',
    accountIntent: 'workspace-mailbox',
    scopeIds: Object.freeze([
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.labels',
    ]),
    granted: true,
    reviewed: true,
    issuedAt: NOW - 1_000,
    expiresAt: NOW + 60_000,
    ...overrides,
  });
}

function redirectPlan(
  overrides: Partial<GoogleMailOAuthRedirectPlan> = {},
): GoogleMailOAuthRedirectPlan {
  return Object.freeze({
    schemaVersion: 1,
    planKind: 'google-mail-oauth-reviewed-redirect-plan',
    providerId: 'google-gmail',
    accountId: 'analyst@example.test',
    accountIntent: 'workspace-mailbox',
    flow: 'external-browser-oauth',
    redirectOrigin: 'https://threatcaddy.example.test',
    redirectPath: '/oauth/google-mail/callback',
    reviewed: true,
    reviewedAt: NOW - 1_000,
    expiresAt: NOW + 60_000,
    ...overrides,
  });
}

function readinessInput(
  overrides: Partial<GoogleMailOAuthReadinessInput> = {},
): GoogleMailOAuthReadinessInput {
  return Object.freeze({
    providerId: 'google-gmail',
    accountId: 'analyst@example.test',
    accountIntent: 'workspace-mailbox',
    reviewedScopes: Object.freeze([
      reviewedScope(),
      reviewedScope({
        id: 'https://www.googleapis.com/auth/gmail.labels',
        label: 'Gmail labels access',
      }),
    ]),
    consentEvidence: consentEvidence(),
    redirectPlan: redirectPlan(),
    now: NOW,
    ...overrides,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('google mail oauth readiness boundary', () => {
  it('returns a frozen plan-only readiness decision for reviewed Gmail or Workspace metadata', () => {
    const decision = evaluateGoogleMailOAuthReadinessBoundary(readinessInput());

    expect(decision).toEqual({
      status: 'ready',
      ready: true,
      reason: 'google_mail_oauth_readiness_ready',
      blockers: [],
      readinessContract: 'google-mail-oauth-readiness-boundary-v1',
      providerId: 'google-gmail',
      account: {
        id: 'analyst@example.test',
        intent: 'workspace-mailbox',
      },
      reviewedScopes: [
        {
          id: 'https://www.googleapis.com/auth/gmail.readonly',
          label: 'Gmail readonly access',
        },
        {
          id: 'https://www.googleapis.com/auth/gmail.labels',
          label: 'Gmail labels access',
        },
      ],
      consentWindow: {
        issuedAt: NOW - 1_000,
        expiresAt: NOW + 60_000,
      },
      redirectPlan: {
        flow: 'external-browser-oauth',
        origin: 'https://threatcaddy.example.test',
        path: '/oauth/google-mail/callback',
        reviewedAt: NOW - 1_000,
        expiresAt: NOW + 60_000,
      },
      executable: false,
      sideEffects: 'none',
      opensBrowserNow: false,
      willFetch: false,
      willOpenSocket: false,
      willMutateStorage: false,
      willStoreCredential: false,
      willCollectCredential: false,
      willCallProvider: false,
      sideEffectBoundary: 'pure-local-google-mail-oauth-readiness-boundary-no-fetch-no-storage-no-oauth-no-window-no-provider-call',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.account)).toBe(true);
    expect(Object.isFrozen(decision.reviewedScopes)).toBe(true);
    expect(Object.isFrozen(decision.reviewedScopes?.[0])).toBe(true);
    expect(Object.isFrozen(decision.redirectPlan)).toBe(true);
  });

  it('requires explicit reviewed scope ids and labels plus account intent before returning ready metadata', () => {
    expect(evaluateGoogleMailOAuthReadinessBoundary({
      ...readinessInput(),
      accountIntent: undefined,
    } as unknown)).toMatchObject({
      status: 'blocked',
      reason: 'missing_account_intent',
      executable: false,
    });

    expect(evaluateGoogleMailOAuthReadinessBoundary({
      ...readinessInput(),
      reviewedScopes: Object.freeze([
        {
          schemaVersion: 1,
          scopeKind: 'google-mail-oauth-reviewed-scope',
          id: 'https://www.googleapis.com/auth/gmail.readonly',
          label: 'Gmail readonly access',
          reviewed: false,
        },
      ]),
    } as unknown)).toMatchObject({
      status: 'blocked',
      reason: 'unreviewed_scope',
      executable: false,
    });

    expect(evaluateGoogleMailOAuthReadinessBoundary({
      ...readinessInput(),
      reviewedScopes: Object.freeze([
        reviewedScope(),
        reviewedScope(),
      ]),
    })).toMatchObject({
      status: 'blocked',
      reason: 'duplicate_scope_id',
      executable: false,
    });
  });

  it('fails closed for secret-shaped token, password, auth-code, and bearer material anywhere in caller input', () => {
    for (const malicious of [
      { accessToken: 'ya29.synthetic-placeholder-token' },
      { refreshToken: 'refresh_token=secret-value' },
      { idToken: 'eyJhbGciOiJIUzI1NiJ9.synthetic.payload' },
      { authorization: 'Bearer synthetic-secret-value' },
      { rawEmailPassword: 'password=hunter2' },
      { oauthCode: 'oauth_code=synthetic-code' },
      { clientSecret: 'client_secret=synthetic-secret' },
    ]) {
      const decision = evaluateGoogleMailOAuthReadinessBoundary({
        ...readinessInput(),
        consentEvidence: {
          ...consentEvidence(),
          ...malicious,
        },
      } as unknown);

      expect(decision).toMatchObject({
        status: 'blocked',
        reason: 'raw_secret_material',
        executable: false,
        sideEffects: 'none',
      });
      expect(JSON.stringify(decision)).not.toContain('synthetic');
    }
  });

  it('rejects callback, requester, fetch, socket, storage, executable, and live-action fields', () => {
    for (const extraField of [
      { callbackUrl: 'https://evil.example.test/callback' },
      { requester: { host: '127.0.0.1' } },
      { fetchPlan: { method: 'POST' } },
      { socketPlan: { host: '127.0.0.1', port: 443 } },
      { storageTarget: 'localStorage' },
      { executable: true },
      { liveAction: 'start_oauth_now' },
    ]) {
      expect(evaluateGoogleMailOAuthReadinessBoundary({
        ...readinessInput(),
        redirectPlan: {
          ...redirectPlan(),
          ...extraField,
        },
      } as unknown)).toMatchObject({
        status: 'blocked',
        reason: 'forbidden_runtime_field',
        executable: false,
      });
    }
  });

	  it('blocks consent and redirect metadata when provider, account, intent, scope, review, expiry, or execution claims drift', () => {
    expect(evaluateGoogleMailOAuthReadinessBoundary({
      ...readinessInput(),
      consentEvidence: consentEvidence({
        providerId: 'google-gmail',
        accountId: 'other@example.test',
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'consent_account_mismatch',
      blockers: expect.arrayContaining(['consent_account_mismatch']),
    });

    expect(evaluateGoogleMailOAuthReadinessBoundary({
      ...readinessInput(),
      consentEvidence: consentEvidence({
        scopeIds: Object.freeze(['https://www.googleapis.com/auth/gmail.send']),
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'consent_scope_mismatch',
      blockers: expect.arrayContaining(['consent_scope_mismatch']),
    });

    const unreviewedRedirectPlan = redirectPlan({
      reviewed: false,
    } as unknown as Partial<GoogleMailOAuthRedirectPlan>);

    expect(evaluateGoogleMailOAuthReadinessBoundary({
      ...readinessInput(),
      redirectPlan: unreviewedRedirectPlan,
    })).toMatchObject({
      status: 'blocked',
      reason: 'redirect_not_reviewed',
    });

    expect(evaluateGoogleMailOAuthReadinessBoundary({
      ...readinessInput(),
      redirectPlan: redirectPlan({
        expiresAt: NOW,
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'redirect_expired',
    });

    expect(evaluateGoogleMailOAuthReadinessBoundary({
      ...readinessInput(),
      redirectPlan: redirectPlan({
        redirectOrigin: 'ftp://localhost',
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'invalid_redirect_plan',
      opensBrowserNow: false,
      willCallProvider: false,
    });

    expect(evaluateGoogleMailOAuthReadinessBoundary({
      ...readinessInput(),
      redirectPlan: redirectPlan({
        redirectOrigin: 'http://localhost',
      }),
    })).toMatchObject({
      status: 'ready',
      redirectPlan: {
        origin: 'http://localhost',
      },
      executable: false,
      sideEffects: 'none',
    });

    expect(evaluateGoogleMailOAuthReadinessBoundary({
      ...readinessInput(),
      redirectPlan: redirectPlan({
        executable: true,
      } as unknown as Partial<GoogleMailOAuthRedirectPlan>),
    })).toMatchObject({
      status: 'blocked',
      reason: 'forbidden_runtime_field',
      executable: false,
      opensBrowserNow: false,
      willFetch: false,
      willMutateStorage: false,
    });
  });

  it('supports personal and delegated workspace account intent without hard-coded employer assumptions', () => {
    const personal = evaluateGoogleMailOAuthReadinessBoundary(readinessInput({
      accountId: 'person@gmail.test',
      accountIntent: 'personal-mailbox',
      consentEvidence: consentEvidence({
        accountId: 'person@gmail.test',
        accountIntent: 'personal-mailbox',
      }),
      redirectPlan: redirectPlan({
        accountId: 'person@gmail.test',
        accountIntent: 'personal-mailbox',
      }),
    }));

    const delegated = evaluateGoogleMailOAuthReadinessBoundary(readinessInput({
      accountId: 'shared-mailbox@example.test',
      accountIntent: 'delegated-workspace-mailbox',
      consentEvidence: consentEvidence({
        accountId: 'shared-mailbox@example.test',
        accountIntent: 'delegated-workspace-mailbox',
      }),
      redirectPlan: redirectPlan({
        accountId: 'shared-mailbox@example.test',
        accountIntent: 'delegated-workspace-mailbox',
      }),
    }));

    expect(personal).toMatchObject({
      status: 'ready',
      account: {
        id: 'person@gmail.test',
        intent: 'personal-mailbox',
      },
      executable: false,
    });
    expect(delegated).toMatchObject({
      status: 'ready',
      account: {
        id: 'shared-mailbox@example.test',
        intent: 'delegated-workspace-mailbox',
      },
      executable: false,
    });
  });
});
