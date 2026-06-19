import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmailAccountConfig,
  type EmailAccountConfig,
  type EmailProviderId,
} from '../lib/email-onboarding';
import {
  createEmailConnectionConsentContract,
  reviewEmailConnectionConsent,
  type EmailConnectionConsentContract,
} from '../lib/email-connection-policy';
import { evaluateEmailConnectorRuntimeReadiness } from '../lib/email-connector-readiness';
import { createLocalBridgeDiscoveryPlan } from '../lib/local-bridge-discovery';

function makeAccount(
  providerId: EmailProviderId = 'google-gmail',
  overrides: Partial<EmailAccountConfig> = {},
): EmailAccountConfig {
  return {
    ...createEmailAccountConfig({
      id: `${providerId}-account`,
      providerId,
      address: 'analyst@example.test',
      credentialRef: providerId === 'google-gmail' || providerId === 'microsoft-outlook'
        ? { kind: 'oauth-token', id: `${providerId}-oauth-ref`, storedBy: 'external-provider' }
        : { kind: 'local-bridge', id: `${providerId}-bridge-ref`, storedBy: 'local-bridge' },
      now: 1_700_000_000_000,
    }),
    status: 'pending',
    ...overrides,
  };
}

function reviewedContract(
  account: EmailAccountConfig,
  overrides: Partial<EmailConnectionConsentContract> = {},
): EmailConnectionConsentContract {
  return {
    ...reviewEmailConnectionConsent(
      createEmailConnectionConsentContract(account, 1_700_000_000_010),
      {
        allowRead: true,
        allowDraft: true,
        allowSend: false,
        reviewedAt: 1_700_000_000_020,
      },
    ),
    ...overrides,
  };
}

function readyMailBridgePlan() {
  return createLocalBridgeDiscoveryPlan({
    bridgeKind: 'mail',
    candidates: ['http://127.0.0.1:8765'],
    consentGranted: true,
    defaultProbePath: '/health',
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('email connector runtime readiness', () => {
  it('returns ready for a reviewed OAuth account without provider, storage, socket, or send side effects', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const account = makeAccount('google-gmail', { sendPolicy: 'draft_only' });

    const decision = evaluateEmailConnectorRuntimeReadiness({
      account,
      consentContract: reviewedContract(account),
      connectorCredentialReference: {
        schemaVersion: 1,
        kind: 'provider-managed-oauth',
        id: 'gmail-oauth-reference',
        storageOwner: 'external-provider',
        providerId: 'google-gmail',
        accountId: 'google-gmail-account',
        connectorId: 'email',
      },
    });

    expect(decision).toEqual({
      status: 'ready',
      ready: true,
      reason: 'ready_for_manual_connector_test',
      accountId: 'google-gmail-account',
      providerId: 'google-gmail',
      sideEffectBoundary: 'pure-local-no-fetch-no-socket-no-storage-no-send',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
  });

  it('blocks missing account identity and missing reviewed consent', () => {
    const missingIdentity = makeAccount('microsoft-outlook', { address: undefined });
    const account = makeAccount('microsoft-outlook');
    const unreviewed = createEmailConnectionConsentContract(account, 1_700_000_000_010);

    expect(evaluateEmailConnectorRuntimeReadiness({
      account: missingIdentity,
      consentContract: reviewedContract(missingIdentity),
    })).toMatchObject({
      status: 'blocked',
      ready: false,
      reason: 'missing_account_identity',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({ account })).toMatchObject({
      status: 'blocked',
      reason: 'missing_consent_contract',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({ account, consentContract: unreviewed })).toMatchObject({
      status: 'blocked',
      reason: 'consent_not_reviewed',
    });
  });

  it('fails closed for provider mismatch, missing read consent, and disconnected consent', () => {
    const account = makeAccount('google-gmail');
    const microsoftAccount = makeAccount('microsoft-outlook');
    const mismatchContract = reviewedContract(microsoftAccount);
    const readDenied = reviewedContract(account, { readConsent: 'denied' });
    const disconnected = reviewedContract(account, { lifecycleState: 'disconnected' });

    expect(evaluateEmailConnectorRuntimeReadiness({
      account,
      consentContract: mismatchContract,
    })).toMatchObject({
      status: 'blocked',
      reason: 'consent_contract_mismatch',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account,
      consentContract: readDenied,
    })).toMatchObject({
      status: 'blocked',
      reason: 'read_consent_not_granted',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account,
      consentContract: disconnected,
    })).toMatchObject({
      status: 'blocked',
      reason: 'connection_consent_disconnected',
    });
  });

  it('marks absent, not-configured, revoked, and design-only accounts explicitly unavailable', () => {
    const notConfigured = makeAccount('google-gmail', { status: 'not_configured' });
    const revoked = makeAccount('google-gmail', { status: 'revoked' });
    const designOnly = makeAccount('manual-local-bridge', { status: 'design_only/mock_only' });

    expect(evaluateEmailConnectorRuntimeReadiness({ account: null })).toMatchObject({
      status: 'unavailable',
      reason: 'no_account',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account: notConfigured,
      consentContract: reviewedContract(notConfigured),
    })).toMatchObject({
      status: 'unavailable',
      reason: 'account_not_configured',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account: revoked,
      consentContract: reviewedContract(revoked),
    })).toMatchObject({
      status: 'unavailable',
      reason: 'account_revoked',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account: designOnly,
      consentContract: reviewedContract(designOnly),
      localBridgePlan: readyMailBridgePlan(),
    })).toMatchObject({
      status: 'unavailable',
      reason: 'account_design_only',
    });
  });

  it('blocks raw secret material across account metadata and connector credential references', () => {
    const account = makeAccount('google-gmail');

    expect(evaluateEmailConnectorRuntimeReadiness({
      account: { ...account, lastError: 'refresh token leaked upstream' },
      consentContract: reviewedContract(account),
    })).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account,
      consentContract: reviewedContract(account),
      connectorCredentialReference: {
        schemaVersion: 1,
        kind: 'provider-managed-oauth',
        id: 'gmail-oauth-reference',
        storageOwner: 'external-provider',
        providerId: 'google-gmail',
        accountId: 'google-gmail-account',
        accessToken: 'synthetic-token',
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
  });

  it('blocks invalid or mismatched credential references before a test can be marked ready', () => {
    const account = makeAccount('google-gmail');

    expect(evaluateEmailConnectorRuntimeReadiness({
      account: { ...account, credentialRef: undefined },
      consentContract: reviewedContract(account),
    })).toMatchObject({
      status: 'blocked',
      reason: 'missing_credential_reference',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account: {
        ...account,
        credentialRef: { kind: 'local-bridge', id: 'bridge-ref', storedBy: 'local-bridge' },
      },
      consentContract: reviewedContract(account),
    })).toMatchObject({
      status: 'blocked',
      reason: 'credential_kind_mismatch',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account,
      consentContract: reviewedContract(account),
      connectorCredentialReference: {
        schemaVersion: 1,
        kind: 'provider-managed-oauth',
        id: 'gmail-oauth-reference',
        storageOwner: 'external-provider',
        providerId: 'microsoft-outlook',
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'connector_credential_provider_mismatch',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account,
      consentContract: reviewedContract(account),
      connectorCredentialReference: {
        schemaVersion: 1,
        kind: 'provider-managed-oauth',
        id: 'gmail oauth reference',
        storageOwner: 'external-provider',
      },
    })).toMatchObject({
      status: 'blocked',
      reason: 'invalid_connector_credential_reference',
      connectorCredentialRejectReason: 'invalid_identifier',
    });
  });

  it('requires allowed mail local-bridge prerequisites for bridge-backed providers', () => {
    const account = makeAccount('generic-imap-smtp');
    const blockedPlan = createLocalBridgeDiscoveryPlan({
      bridgeKind: 'mail',
      candidates: ['https://mail.example.test'],
      consentGranted: true,
    });
    const noConsentPlan = createLocalBridgeDiscoveryPlan({
      bridgeKind: 'mail',
      candidates: ['127.0.0.1:8765'],
      consentGranted: false,
    });

    expect(evaluateEmailConnectorRuntimeReadiness({
      account,
      consentContract: reviewedContract(account),
    })).toMatchObject({
      status: 'blocked',
      reason: 'local_bridge_prerequisite_missing',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account,
      consentContract: reviewedContract(account),
      localBridgePlan: blockedPlan,
    })).toMatchObject({
      status: 'blocked',
      reason: 'local_bridge_prerequisite_blocked',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account,
      consentContract: reviewedContract(account),
      localBridgePlan: noConsentPlan,
    })).toMatchObject({
      status: 'blocked',
      reason: 'local_bridge_prerequisite_blocked',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account,
      consentContract: reviewedContract(account),
      connectorCredentialReference: {
        schemaVersion: 1,
        kind: 'local-bridge',
        id: 'mail-bridge-ref',
        storageOwner: 'local-bridge',
        providerId: 'generic-imap-smtp',
        accountId: 'generic-imap-smtp-account',
        connectorId: 'email',
      },
      localBridgePlan: readyMailBridgePlan(),
    })).toMatchObject({
      status: 'ready',
      reason: 'ready_for_manual_connector_test',
    });
  });

  it('blocks unsupported send policies while preserving no-send readiness for denied send consent', () => {
    const account = makeAccount('google-gmail', {
      sendPolicy: 'manual_confirm',
    });
    const unsupported = makeAccount('google-gmail', {
      sendPolicy: 'auto_send' as EmailAccountConfig['sendPolicy'],
    });

    expect(evaluateEmailConnectorRuntimeReadiness({
      account,
      consentContract: reviewedContract(account, { sendConsent: 'denied' }),
    })).toMatchObject({
      status: 'ready',
      reason: 'ready_for_manual_connector_test',
    });
    expect(evaluateEmailConnectorRuntimeReadiness({
      account: unsupported,
      consentContract: reviewedContract(unsupported),
    })).toMatchObject({
      status: 'blocked',
      reason: 'unsupported_send_policy',
    });
  });
});
