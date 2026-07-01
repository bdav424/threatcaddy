import {
  EMAIL_PROVIDER_METADATA,
  type EmailAccountConfig,
  type EmailConnectionTestResult,
  type EmailProviderId,
} from './email-onboarding';

export type EmailConsentGrantState = 'not_requested' | 'granted' | 'denied' | 'revoked';

export type EmailConsentReviewState = 'unreviewed' | 'reviewed';

export type EmailConnectionPrerequisiteState = 'not_tested' | 'passed' | 'failed' | 'blocked';

export type EmailConnectionLifecycleState = 'active' | 'disconnected' | 'revoked';

export type EmailSendPolicyDecisionCode =
  | 'allowed_manual_confirm'
  | 'no_account'
  | 'missing_consent_contract'
  | 'contract_mismatch'
  | 'provider_send_unsupported'
  | 'account_not_connected'
  | 'account_revoked'
  | 'connection_disconnected'
  | 'connection_revoked'
  | 'send_policy_not_manual_confirm'
  | 'consent_not_reviewed'
  | 'send_consent_not_granted'
  | 'connection_test_not_passed';

export interface EmailConnectionPrerequisite {
  state: EmailConnectionPrerequisiteState;
  testedAt?: number;
  code?: EmailConnectionTestResult['code'];
  mismatch?: 'account' | 'provider' | 'account_provider';
}

export interface EmailConsentReview {
  state: EmailConsentReviewState;
  reviewedAt?: number;
}

export interface EmailConnectionConsentContract {
  schemaVersion: 1;
  accountId: string;
  providerId: EmailProviderId;
  lifecycleState: EmailConnectionLifecycleState;
  readConsent: EmailConsentGrantState;
  draftConsent: EmailConsentGrantState;
  sendConsent: EmailConsentGrantState;
  review: EmailConsentReview;
  connectionPrerequisite: EmailConnectionPrerequisite;
  createdAt: number;
  updatedAt: number;
  disconnectedAt?: number;
  revokedAt?: number;
}

export interface ReviewedEmailConsentInput {
  allowRead?: boolean;
  allowDraft?: boolean;
  allowSend?: boolean;
  reviewedAt?: number;
}

export interface EmailSendPolicyDecision {
  allowed: boolean;
  code: EmailSendPolicyDecisionCode;
  effectivePolicy: EmailAccountConfig['sendPolicy'];
  reason: string;
}

function consentFromBoolean(value?: boolean): EmailConsentGrantState {
  return value === true ? 'granted' : 'denied';
}

function connectionPrerequisiteFromAccount(account: EmailAccountConfig): EmailConnectionPrerequisite {
  if (account.status === 'revoked') {
    return { state: 'blocked' };
  }
  if (account.status === 'connected' && account.lastTestedAt !== undefined) {
    return { state: 'passed', testedAt: account.lastTestedAt };
  }
  return { state: 'not_tested' };
}

function lifecycleFromAccount(account: EmailAccountConfig): EmailConnectionLifecycleState {
  return account.status === 'revoked' ? 'revoked' : 'active';
}

function getConnectionResultMismatch(
  contract: EmailConnectionConsentContract,
  result: EmailConnectionTestResult,
): EmailConnectionPrerequisite['mismatch'] | undefined {
  const accountMismatch = result.accountId !== contract.accountId;
  const providerMismatch = result.providerId !== contract.providerId;
  if (accountMismatch && providerMismatch) return 'account_provider';
  if (accountMismatch) return 'account';
  if (providerMismatch) return 'provider';
  return undefined;
}

export function createEmailConnectionConsentContract(
  account: EmailAccountConfig,
  now = Date.now(),
): EmailConnectionConsentContract {
  const revoked = account.status === 'revoked';
  return {
    schemaVersion: 1,
    accountId: account.id,
    providerId: account.providerId,
    lifecycleState: lifecycleFromAccount(account),
    readConsent: revoked ? 'revoked' : 'not_requested',
    draftConsent: revoked ? 'revoked' : 'not_requested',
    sendConsent: revoked ? 'revoked' : 'not_requested',
    review: { state: 'unreviewed' },
    connectionPrerequisite: connectionPrerequisiteFromAccount(account),
    createdAt: now,
    updatedAt: now,
    revokedAt: revoked ? (account.revokedAt ?? now) : undefined,
  };
}

export function reviewEmailConnectionConsent(
  contract: EmailConnectionConsentContract,
  input: ReviewedEmailConsentInput,
): EmailConnectionConsentContract {
  const reviewedAt = input.reviewedAt ?? Date.now();
  if (contract.lifecycleState === 'revoked') {
    return {
      ...contract,
      readConsent: 'revoked',
      draftConsent: 'revoked',
      sendConsent: 'revoked',
      review: { state: 'reviewed', reviewedAt },
      updatedAt: reviewedAt,
    };
  }

  return {
    ...contract,
    readConsent: consentFromBoolean(input.allowRead),
    draftConsent: consentFromBoolean(input.allowDraft),
    sendConsent: consentFromBoolean(input.allowSend),
    review: { state: 'reviewed', reviewedAt },
    updatedAt: reviewedAt,
  };
}

export function recordEmailConnectionTestPrerequisite(
  contract: EmailConnectionConsentContract,
  result: EmailConnectionTestResult,
): EmailConnectionConsentContract {
  const mismatch = getConnectionResultMismatch(contract, result);
  if (mismatch) {
    return {
      ...contract,
      connectionPrerequisite: {
        state: 'blocked',
        testedAt: result.testedAt,
        code: result.code,
        mismatch,
      },
      updatedAt: result.testedAt,
    };
  }

  const blocked = result.status === 'revoked' || result.status === 'not_configured' || result.status === 'design_only/mock_only';
  const state: EmailConnectionPrerequisiteState = result.ok ? 'passed' : blocked ? 'blocked' : 'failed';
  return {
    ...contract,
    connectionPrerequisite: {
      state,
      testedAt: result.testedAt,
      code: result.code,
    },
    updatedAt: result.testedAt,
  };
}

export function markEmailConnectionDisconnected(
  contract: EmailConnectionConsentContract,
  now = Date.now(),
): EmailConnectionConsentContract {
  return {
    ...contract,
    lifecycleState: contract.lifecycleState === 'revoked' ? 'revoked' : 'disconnected',
    connectionPrerequisite: { state: 'blocked' },
    disconnectedAt: now,
    updatedAt: now,
  };
}

export function markEmailConnectionConsentRevoked(
  contract: EmailConnectionConsentContract,
  now = Date.now(),
): EmailConnectionConsentContract {
  return {
    ...contract,
    lifecycleState: 'revoked',
    readConsent: 'revoked',
    draftConsent: 'revoked',
    sendConsent: 'revoked',
    connectionPrerequisite: { state: 'blocked' },
    disconnectedAt: contract.disconnectedAt,
    revokedAt: now,
    updatedAt: now,
  };
}

export function evaluateEmailSendPolicy(
  account: EmailAccountConfig | null | undefined,
  contract: EmailConnectionConsentContract | null | undefined,
): EmailSendPolicyDecision {
  if (!account) {
    return {
      allowed: false,
      code: 'no_account',
      effectivePolicy: 'disabled',
      reason: 'No email account is available for send evaluation.',
    };
  }

  if (!contract) {
    return {
      allowed: false,
      code: 'missing_consent_contract',
      effectivePolicy: account.sendPolicy,
      reason: 'No reviewed email consent contract is available.',
    };
  }

  if (contract.accountId !== account.id || contract.providerId !== account.providerId) {
    return {
      allowed: false,
      code: 'contract_mismatch',
      effectivePolicy: account.sendPolicy,
      reason: 'Email consent contract does not match the account under review.',
    };
  }

  if (!EMAIL_PROVIDER_METADATA[account.providerId].capabilities.canSend) {
    return {
      allowed: false,
      code: 'provider_send_unsupported',
      effectivePolicy: account.sendPolicy,
      reason: 'Provider metadata does not support send capability.',
    };
  }

  if (account.status === 'revoked') {
    return {
      allowed: false,
      code: 'account_revoked',
      effectivePolicy: 'disabled',
      reason: 'Email account has been revoked.',
    };
  }

  if (contract.lifecycleState === 'revoked') {
    return {
      allowed: false,
      code: 'connection_revoked',
      effectivePolicy: 'disabled',
      reason: 'Email consent has been revoked.',
    };
  }

  if (contract.lifecycleState === 'disconnected') {
    return {
      allowed: false,
      code: 'connection_disconnected',
      effectivePolicy: 'disabled',
      reason: 'Email connector is disconnected.',
    };
  }

  if (account.status !== 'connected') {
    return {
      allowed: false,
      code: 'account_not_connected',
      effectivePolicy: account.sendPolicy,
      reason: 'Email account is not connected.',
    };
  }

  if (account.sendPolicy !== 'manual_confirm') {
    return {
      allowed: false,
      code: 'send_policy_not_manual_confirm',
      effectivePolicy: account.sendPolicy,
      reason: 'Email send policy is not set to manual_confirm.',
    };
  }

  if (contract.review.state !== 'reviewed') {
    return {
      allowed: false,
      code: 'consent_not_reviewed',
      effectivePolicy: account.sendPolicy,
      reason: 'Email send consent has not been reviewed.',
    };
  }

  if (contract.sendConsent !== 'granted') {
    return {
      allowed: false,
      code: 'send_consent_not_granted',
      effectivePolicy: account.sendPolicy,
      reason: 'Email send consent is not granted.',
    };
  }

  if (contract.connectionPrerequisite.state !== 'passed') {
    return {
      allowed: false,
      code: 'connection_test_not_passed',
      effectivePolicy: account.sendPolicy,
      reason: 'Email connection prerequisite test has not passed.',
    };
  }

  return {
    allowed: true,
    code: 'allowed_manual_confirm',
    effectivePolicy: 'manual_confirm',
    reason: 'Manual confirmation is required before any future connector send action.',
  };
}
