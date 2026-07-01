import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmailAccountConfig,
  markEmailAccountConnected,
  type EmailAccountConfig,
  type EmailProviderId,
} from '../lib/email-onboarding';
import {
  createEmailConnectionConsentContract,
  recordEmailConnectionTestPrerequisite,
  reviewEmailConnectionConsent,
  type EmailConnectionConsentContract,
} from '../lib/email-connection-policy';
import {
  evaluateEmailProviderExecutionGate,
  type EmailProviderActionExplicitConsent,
  type EmailProviderExecutionAction,
} from '../lib/email-provider-execution-gate';
import type { EmailConnectorRuntimeReadinessDecision } from '../lib/email-connector-readiness';

const NOW = 1_700_000_000_000;

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
      now: NOW,
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
      createEmailConnectionConsentContract(account, NOW + 10),
      {
        allowRead: true,
        allowDraft: true,
        allowSend: false,
        reviewedAt: NOW + 20,
      },
    ),
    ...overrides,
  };
}

function passedContract(account: EmailAccountConfig): EmailConnectionConsentContract {
  const reviewed = reviewEmailConnectionConsent(
    createEmailConnectionConsentContract(account, NOW + 10),
    {
      allowRead: true,
      allowDraft: true,
      allowSend: true,
      reviewedAt: NOW + 20,
    },
  );
  return recordEmailConnectionTestPrerequisite(reviewed, {
    accountId: account.id,
    providerId: account.providerId,
    ok: true,
    status: 'connected',
    code: 'mock_connected',
    message: 'Mock connection test passed without contacting a provider.',
    testedAt: NOW + 30,
  });
}

function consent(
  action: EmailProviderExecutionAction,
  account: EmailAccountConfig,
  overrides: Partial<EmailProviderActionExplicitConsent> = {},
): EmailProviderActionExplicitConsent {
  return {
    action,
    accountId: account.id,
    providerId: account.providerId,
    granted: true,
    reviewedAt: NOW + 40,
    ...overrides,
  };
}

function providerCredentialReference(account: EmailAccountConfig) {
  return {
    schemaVersion: 1,
    kind: 'provider-managed-oauth',
    id: `${account.providerId}-provider-oauth-reference`,
    storageOwner: 'external-provider',
    providerId: account.providerId,
    accountId: account.id,
    connectorId: 'email',
  } as const;
}

function readyShapedReadiness(
  account: EmailAccountConfig,
  overrides: Partial<EmailConnectorRuntimeReadinessDecision> = {},
): EmailConnectorRuntimeReadinessDecision {
  return {
    status: 'ready',
    ready: true,
    reason: 'ready_for_manual_connector_test',
    accountId: account.id,
    providerId: account.providerId,
    sideEffectBoundary: 'pure-local-no-fetch-no-socket-no-storage-no-send',
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('email provider execution gate', () => {
  it('allows only an inert OAuth start plan after explicit matching consent', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const account = makeAccount('google-gmail', { credentialRef: undefined, status: 'not_configured' });

    const decision = evaluateEmailProviderExecutionGate({
      action: 'start_oauth',
      account,
      explicitConsent: consent('start_oauth', account),
    });

    expect(decision).toEqual({
      status: 'allow',
      allowed: true,
      action: 'start_oauth',
      reason: 'allowed_inert_provider_action_plan',
      accountId: 'google-gmail-account',
      providerId: 'google-gmail',
      willSend: false,
      sideEffectBoundary: 'inert-local-plan-no-fetch-no-oauth-no-sync-no-send-no-storage',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
  });

  it('blocks OAuth starts for non-OAuth providers and mismatched consent', () => {
    const account = makeAccount('manual-local-bridge', { status: 'pending' });
    const gmail = makeAccount('google-gmail', { status: 'pending' });

    expect(evaluateEmailProviderExecutionGate({
      action: 'start_oauth',
      account,
      explicitConsent: consent('start_oauth', account),
    })).toMatchObject({
      allowed: false,
      reason: 'action_not_supported_by_provider',
      willSend: false,
    });

    expect(evaluateEmailProviderExecutionGate({
      action: 'start_oauth',
      account: gmail,
      explicitConsent: consent('sync_mail', gmail),
    })).toMatchObject({
      allowed: false,
      reason: 'explicit_consent_mismatch',
    });
  });

  it('allows inert sync planning only when readiness, read consent, identity, and credential references match', () => {
    const account = makeAccount('google-gmail');
    const decision = evaluateEmailProviderExecutionGate({
      action: 'sync_mail',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('sync_mail', account),
      connectorCredentialReference: providerCredentialReference(account),
    });

    expect(decision).toMatchObject({
      status: 'allow',
      allowed: true,
      action: 'sync_mail',
      reason: 'allowed_inert_provider_action_plan',
      accountId: account.id,
      providerId: account.providerId,
      willSend: false,
      sideEffectBoundary: 'inert-local-plan-no-fetch-no-oauth-no-sync-no-send-no-storage',
      readinessDecision: {
        ready: true,
        reason: 'ready_for_manual_connector_test',
      },
    });
  });

  it('blocks sync when reviewed consent, readiness, or connector credential ownership is missing', () => {
    const account = makeAccount('google-gmail');
    const contract = reviewedContract(account);

    expect(evaluateEmailProviderExecutionGate({
      action: 'sync_mail',
      account,
      consentContract: contract,
      explicitConsent: consent('sync_mail', account),
      connectorCredentialReference: { ...providerCredentialReference(account), providerId: 'microsoft-outlook' },
    })).toMatchObject({
      allowed: false,
      reason: 'connector_credential_provider_mismatch',
    });

    expect(evaluateEmailProviderExecutionGate({
      action: 'sync_mail',
      account: { ...account, credentialRef: undefined },
      consentContract: contract,
      explicitConsent: consent('sync_mail', account),
    })).toMatchObject({
      allowed: false,
      reason: 'missing_credential_reference',
    });

    expect(evaluateEmailProviderExecutionGate({
      action: 'sync_mail',
      account,
      consentContract: reviewedContract(account, { readConsent: 'denied' }),
      explicitConsent: consent('sync_mail', account),
      connectorCredentialReference: providerCredentialReference(account),
    })).toMatchObject({
      allowed: false,
      reason: 'read_consent_not_granted',
    });
  });

  it('blocks malformed or secret-bearing credential references before any readiness allow', () => {
    const account = makeAccount('google-gmail');

    expect(evaluateEmailProviderExecutionGate({
      action: 'test_connection',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('test_connection', account),
      connectorCredentialReference: {
        ...providerCredentialReference(account),
        accessToken: 'synthetic-token',
      },
    })).toMatchObject({
      allowed: false,
      reason: 'raw_secret_material',
    });

    expect(evaluateEmailProviderExecutionGate({
      action: 'test_connection',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('test_connection', account),
      connectorCredentialReference: {
        ...providerCredentialReference(account),
        notes: 'unsupported',
      },
    })).toMatchObject({
      allowed: false,
      reason: 'invalid_connector_credential_reference',
      connectorCredentialRejectReason: 'unsupported_field',
    });
  });

  it('keeps send blocked by default even when sync/test readiness is otherwise available', () => {
    const account = makeAccount('microsoft-outlook', { status: 'pending', sendPolicy: 'draft_only' });
    const decision = evaluateEmailProviderExecutionGate({
      action: 'send_mail',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('send_mail', account),
      connectorCredentialReference: providerCredentialReference(account),
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: 'send_consent_not_granted',
      willSend: false,
    });
  });

  it('allows an inert send plan only after readiness, send policy, send consent, and manual confirmation pass', () => {
    const pending = makeAccount('microsoft-outlook', { sendPolicy: 'manual_confirm' });
    const account = markEmailAccountConnected(pending, NOW + 50);
    const contract = passedContract(account);

    const missingConfirmation = evaluateEmailProviderExecutionGate({
      action: 'send_mail',
      account,
      consentContract: contract,
      explicitConsent: consent('send_mail', account),
      connectorCredentialReference: providerCredentialReference(account),
    });

    expect(missingConfirmation).toMatchObject({
      allowed: false,
      reason: 'manual_send_confirmation_missing',
      sendPolicyDecision: {
        allowed: true,
        code: 'allowed_manual_confirm',
      },
      willSend: false,
    });

    const decision = evaluateEmailProviderExecutionGate({
      action: 'send_mail',
      account,
      consentContract: contract,
      explicitConsent: consent('send_mail', account),
      connectorCredentialReference: providerCredentialReference(account),
      manualSendConfirmation: true,
    });

    expect(decision).toMatchObject({
      status: 'allow',
      allowed: true,
      action: 'send_mail',
      reason: 'allowed_inert_provider_action_plan',
      willSend: false,
      readinessDecision: {
        ready: true,
      },
      sendPolicyDecision: {
        allowed: true,
        code: 'allowed_manual_confirm',
      },
    });
  });

  it('rejects caller-provided readiness decisions for the wrong account or provider', () => {
    const account = makeAccount('google-gmail');
    const other = makeAccount('microsoft-outlook');
    const readinessDecision = evaluateEmailProviderExecutionGate({
      action: 'sync_mail',
      account: other,
      consentContract: reviewedContract(other),
      explicitConsent: consent('sync_mail', other),
      connectorCredentialReference: providerCredentialReference(other),
    }).readinessDecision;

    expect(evaluateEmailProviderExecutionGate({
      action: 'sync_mail',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('sync_mail', account),
      connectorCredentialReference: providerCredentialReference(account),
      readinessDecision,
    })).toMatchObject({
      allowed: false,
      reason: 'action_account_mismatch',
    });
  });

  it('rejects caller-provided ready-shaped readiness decisions with missing account or provider identity', () => {
    const account = makeAccount('google-gmail');

    expect(evaluateEmailProviderExecutionGate({
      action: 'test_connection',
      account,
      consentContract: reviewedContract(account),
      explicitConsent: consent('test_connection', account),
      connectorCredentialReference: providerCredentialReference(account),
      readinessDecision: readyShapedReadiness(account, { accountId: undefined }),
    })).toMatchObject({
      allowed: false,
      reason: 'runtime_readiness_identity_missing',
      readinessDecision: {
        ready: true,
        providerId: account.providerId,
      },
    });

    const connectedAccount = markEmailAccountConnected(account, NOW + 50);
    expect(evaluateEmailProviderExecutionGate({
      action: 'send_mail',
      account: connectedAccount,
      consentContract: passedContract(connectedAccount),
      explicitConsent: consent('send_mail', connectedAccount),
      connectorCredentialReference: providerCredentialReference(connectedAccount),
      readinessDecision: readyShapedReadiness(connectedAccount, { providerId: undefined }),
      manualSendConfirmation: true,
    })).toMatchObject({
      allowed: false,
      reason: 'runtime_readiness_identity_missing',
      readinessDecision: {
        ready: true,
        accountId: connectedAccount.id,
      },
    });
  });
});
