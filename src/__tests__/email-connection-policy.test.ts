import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyConnectionTestResult,
  createEmailAccountConfig,
  type EmailAccountConfig,
  type EmailConnectionTestResult,
  type EmailProviderId,
} from '../lib/email-onboarding';
import {
  createEmailConnectionConsentContract,
  evaluateEmailSendPolicy,
  markEmailConnectionConsentRevoked,
  markEmailConnectionDisconnected,
  recordEmailConnectionTestPrerequisite,
  reviewEmailConnectionConsent,
} from '../lib/email-connection-policy';

function makeAccount(
  providerId: EmailProviderId = 'google-gmail',
  overrides: Partial<EmailAccountConfig> = {},
): EmailAccountConfig {
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

function makeConnectionResult(overrides: Partial<EmailConnectionTestResult> = {}): EmailConnectionTestResult {
  return {
    accountId: 'google-gmail-account',
    providerId: 'google-gmail',
    ok: true,
    status: 'connected',
    code: 'mock_connected',
    message: 'Mock connection test passed without contacting a provider.',
    testedAt: 1_700_000_000_100,
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('email connection consent contract', () => {
  it('starts with no-send defaults and performs no provider or storage side effects', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const account = makeAccount('microsoft-outlook', {
      status: 'connected',
      sendPolicy: 'manual_confirm',
      lastTestedAt: 1_700_000_000_050,
    });

    const contract = createEmailConnectionConsentContract(account, 1_700_000_000_075);
    const decision = evaluateEmailSendPolicy(account, contract);

    expect(contract).toMatchObject({
      schemaVersion: 1,
      accountId: 'microsoft-outlook-account',
      providerId: 'microsoft-outlook',
      lifecycleState: 'active',
      readConsent: 'not_requested',
      draftConsent: 'not_requested',
      sendConsent: 'not_requested',
      review: { state: 'unreviewed' },
      connectionPrerequisite: { state: 'passed', testedAt: 1_700_000_000_050 },
    });
    expect(decision).toMatchObject({
      allowed: false,
      code: 'consent_not_reviewed',
      effectivePolicy: 'manual_confirm',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
  });

  it('fails closed unless manual_confirm, reviewed send consent, and a passed connection prerequisite are all present', () => {
    const connectedAccount = makeAccount('google-gmail', {
      status: 'connected',
      sendPolicy: 'manual_confirm',
      lastTestedAt: 1_700_000_000_050,
    });
    const reviewed = reviewEmailConnectionConsent(
      createEmailConnectionConsentContract(connectedAccount, 1_700_000_000_060),
      { allowRead: true, allowDraft: true, allowSend: true, reviewedAt: 1_700_000_000_070 },
    );

    expect(evaluateEmailSendPolicy(connectedAccount, reviewed)).toMatchObject({
      allowed: true,
      code: 'allowed_manual_confirm',
      effectivePolicy: 'manual_confirm',
    });

    expect(evaluateEmailSendPolicy(
      { ...connectedAccount, sendPolicy: 'draft_only' },
      reviewed,
    )).toMatchObject({
      allowed: false,
      code: 'send_policy_not_manual_confirm',
    });

    expect(evaluateEmailSendPolicy(
      { ...connectedAccount, status: 'pending' },
      reviewed,
    )).toMatchObject({
      allowed: false,
      code: 'account_not_connected',
    });

    const untested = reviewEmailConnectionConsent(
      createEmailConnectionConsentContract({ ...connectedAccount, lastTestedAt: undefined }, 1_700_000_000_080),
      { allowRead: true, allowDraft: true, allowSend: true, reviewedAt: 1_700_000_000_090 },
    );

    expect(evaluateEmailSendPolicy(connectedAccount, untested)).toMatchObject({
      allowed: false,
      code: 'connection_test_not_passed',
    });
  });

  it('requires a reviewed consent state and explicit send grant', () => {
    const account = makeAccount('google-gmail', {
      status: 'connected',
      sendPolicy: 'manual_confirm',
      lastTestedAt: 1_700_000_000_050,
    });
    const contract = createEmailConnectionConsentContract(account, 1_700_000_000_060);
    const denied = reviewEmailConnectionConsent(contract, {
      allowRead: true,
      allowDraft: true,
      allowSend: false,
      reviewedAt: 1_700_000_000_070,
    });

    expect(evaluateEmailSendPolicy(account, contract)).toMatchObject({
      allowed: false,
      code: 'consent_not_reviewed',
    });
    expect(evaluateEmailSendPolicy(account, denied)).toMatchObject({
      allowed: false,
      code: 'send_consent_not_granted',
    });
  });

  it('records connection-test prerequisites without running a connection test', () => {
    const account = makeAccount('google-gmail', { status: 'pending', sendPolicy: 'manual_confirm' });
    const contract = reviewEmailConnectionConsent(
      createEmailConnectionConsentContract(account, 1_700_000_000_000),
      { allowRead: true, allowDraft: true, allowSend: true, reviewedAt: 1_700_000_000_025 },
    );
    const failed = recordEmailConnectionTestPrerequisite(
      contract,
      makeConnectionResult({
        ok: false,
        status: 'failed',
        code: 'needs_provider_oauth',
        message: 'Connection test requires future OAuth consent.',
        testedAt: 1_700_000_000_100,
      }),
    );
    const passed = recordEmailConnectionTestPrerequisite(contract, makeConnectionResult());

    expect(failed.connectionPrerequisite).toEqual({
      state: 'failed',
      testedAt: 1_700_000_000_100,
      code: 'needs_provider_oauth',
    });
    expect(passed.connectionPrerequisite).toEqual({
      state: 'passed',
      testedAt: 1_700_000_000_100,
      code: 'mock_connected',
    });
  });

  it('blocks successful connection-test results for a different account or provider', () => {
    const account = makeAccount('google-gmail', {
      status: 'connected',
      sendPolicy: 'manual_confirm',
      lastTestedAt: 1_700_000_000_050,
    });
    const contract = reviewEmailConnectionConsent(
      createEmailConnectionConsentContract(account, 1_700_000_000_060),
      { allowRead: true, allowDraft: true, allowSend: true, reviewedAt: 1_700_000_000_070 },
    );
    const differentAccount = recordEmailConnectionTestPrerequisite(
      contract,
      makeConnectionResult({ accountId: 'other-account', testedAt: 1_700_000_000_110 }),
    );
    const differentProvider = recordEmailConnectionTestPrerequisite(
      contract,
      makeConnectionResult({ providerId: 'microsoft-outlook', testedAt: 1_700_000_000_120 }),
    );

    expect(differentAccount.connectionPrerequisite).toEqual({
      state: 'blocked',
      testedAt: 1_700_000_000_110,
      code: 'mock_connected',
      mismatch: 'account',
    });
    expect(differentProvider.connectionPrerequisite).toEqual({
      state: 'blocked',
      testedAt: 1_700_000_000_120,
      code: 'mock_connected',
      mismatch: 'provider',
    });
    expect(evaluateEmailSendPolicy(account, differentAccount)).toMatchObject({
      allowed: false,
      code: 'connection_test_not_passed',
    });
    expect(evaluateEmailSendPolicy(account, differentProvider)).toMatchObject({
      allowed: false,
      code: 'connection_test_not_passed',
    });
  });

  it('blocks send decisions for disconnected and revoked consent states', () => {
    const account = makeAccount('manual-local-bridge', {
      status: 'connected',
      sendPolicy: 'manual_confirm',
      lastTestedAt: 1_700_000_000_050,
    });
    const reviewed = reviewEmailConnectionConsent(
      createEmailConnectionConsentContract(account, 1_700_000_000_060),
      { allowRead: true, allowDraft: true, allowSend: true, reviewedAt: 1_700_000_000_070 },
    );
    const disconnected = markEmailConnectionDisconnected(reviewed, 1_700_000_000_080);
    const revoked = markEmailConnectionConsentRevoked(reviewed, 1_700_000_000_090);

    expect(disconnected).toMatchObject({
      lifecycleState: 'disconnected',
      connectionPrerequisite: { state: 'blocked' },
      disconnectedAt: 1_700_000_000_080,
    });
    expect(revoked).toMatchObject({
      lifecycleState: 'revoked',
      readConsent: 'revoked',
      draftConsent: 'revoked',
      sendConsent: 'revoked',
      connectionPrerequisite: { state: 'blocked' },
      revokedAt: 1_700_000_000_090,
    });
    expect(evaluateEmailSendPolicy(account, disconnected)).toMatchObject({
      allowed: false,
      code: 'connection_disconnected',
      effectivePolicy: 'disabled',
    });
    expect(evaluateEmailSendPolicy(account, revoked)).toMatchObject({
      allowed: false,
      code: 'connection_revoked',
      effectivePolicy: 'disabled',
    });
  });

  it('fails closed on account revocation, missing contracts, and account-contract mismatch', () => {
    const account = makeAccount('google-gmail', {
      status: 'connected',
      sendPolicy: 'manual_confirm',
      lastTestedAt: 1_700_000_000_050,
    });
    const contract = reviewEmailConnectionConsent(
      createEmailConnectionConsentContract(account, 1_700_000_000_060),
      { allowRead: true, allowDraft: true, allowSend: true, reviewedAt: 1_700_000_000_070 },
    );

    expect(evaluateEmailSendPolicy(null, contract)).toMatchObject({
      allowed: false,
      code: 'no_account',
      effectivePolicy: 'disabled',
    });
    expect(evaluateEmailSendPolicy(account, null)).toMatchObject({
      allowed: false,
      code: 'missing_consent_contract',
    });
    expect(evaluateEmailSendPolicy(
      { ...account, id: 'different-account' },
      contract,
    )).toMatchObject({
      allowed: false,
      code: 'contract_mismatch',
    });

    const revokedAccount = applyConnectionTestResult(
      { ...account, status: 'revoked', revokedAt: 1_700_000_000_080 },
      makeConnectionResult({
        ok: false,
        status: 'revoked',
        code: 'revoked',
        message: 'Connection test blocked because this account has been revoked.',
        testedAt: 1_700_000_000_090,
      }),
    );

    expect(evaluateEmailSendPolicy(revokedAccount, contract)).toMatchObject({
      allowed: false,
      code: 'account_revoked',
      effectivePolicy: 'disabled',
    });
  });
});
