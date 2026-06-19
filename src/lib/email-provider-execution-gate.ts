import {
  EMAIL_PROVIDER_METADATA,
  hasStoredEmailSecretMaterial,
  type EmailAccountConfig,
} from './email-onboarding';
import {
  evaluateEmailSendPolicy,
  type EmailConnectionConsentContract,
  type EmailSendPolicyDecision,
} from './email-connection-policy';
import {
  evaluateEmailConnectorRuntimeReadiness,
  type EmailConnectorRuntimeReadinessDecision,
  type EmailConnectorRuntimeReadinessInput,
} from './email-connector-readiness';
import {
  hasConnectorSecretMaterial,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
  type ConnectorCredentialReferenceRejectReason,
} from './connector-credential-boundary';
import {
  type LocalBridgeDiscoveryPlan,
} from './local-bridge-discovery';

export type EmailProviderExecutionAction =
  | 'start_oauth'
  | 'test_connection'
  | 'sync_mail'
  | 'send_mail';

export type EmailProviderExecutionDecisionStatus = 'allow' | 'block';

export type EmailProviderExecutionDecisionReason =
  | 'allowed_inert_provider_action_plan'
  | 'no_account'
  | 'missing_account_identity'
  | 'unknown_provider'
  | 'action_provider_mismatch'
  | 'action_account_mismatch'
  | 'action_not_supported_by_provider'
  | 'account_not_ready_for_oauth'
  | 'raw_secret_material'
  | 'missing_explicit_consent'
  | 'explicit_consent_mismatch'
  | 'explicit_consent_not_granted'
  | 'missing_consent_contract'
  | 'consent_contract_mismatch'
  | 'consent_not_reviewed'
  | 'read_consent_not_granted'
  | 'draft_consent_not_granted'
  | 'send_consent_not_granted'
  | 'missing_credential_reference'
  | 'invalid_connector_credential_reference'
  | 'connector_credential_provider_mismatch'
  | 'connector_credential_account_mismatch'
  | 'runtime_readiness_identity_missing'
  | 'runtime_readiness_not_ready'
  | 'send_policy_blocked'
  | 'manual_send_confirmation_missing';

export interface EmailProviderActionExplicitConsent {
  action: EmailProviderExecutionAction;
  accountId: string;
  providerId: string;
  granted: boolean;
  reviewedAt?: number;
}

export interface EmailProviderExecutionGateInput {
  action: EmailProviderExecutionAction;
  account?: EmailAccountConfig | null;
  consentContract?: EmailConnectionConsentContract | null;
  explicitConsent?: EmailProviderActionExplicitConsent | null;
  connectorCredentialReference?: unknown;
  localBridgePlan?: LocalBridgeDiscoveryPlan | null;
  readinessDecision?: EmailConnectorRuntimeReadinessDecision | null;
  manualSendConfirmation?: boolean;
}

export interface EmailProviderExecutionGateDecision {
  status: EmailProviderExecutionDecisionStatus;
  allowed: boolean;
  action: EmailProviderExecutionAction;
  reason: EmailProviderExecutionDecisionReason;
  accountId?: string;
  providerId?: string;
  credentialReference?: ConnectorCredentialReference;
  connectorCredentialRejectReason?: ConnectorCredentialReferenceRejectReason;
  readinessDecision?: EmailConnectorRuntimeReadinessDecision;
  sendPolicyDecision?: EmailSendPolicyDecision;
  willSend: false;
  sideEffectBoundary: 'inert-local-plan-no-fetch-no-oauth-no-sync-no-send-no-storage';
}

const ACTION_CAPABILITIES: Record<EmailProviderExecutionAction, keyof typeof EMAIL_PROVIDER_METADATA[keyof typeof EMAIL_PROVIDER_METADATA]['capabilities'] | null> = {
  start_oauth: null,
  test_connection: null,
  sync_mail: 'canReadMail',
  send_mail: 'canSend',
};

function block(
  input: EmailProviderExecutionGateInput,
  reason: EmailProviderExecutionDecisionReason,
  extra: Partial<EmailProviderExecutionGateDecision> = {},
): EmailProviderExecutionGateDecision {
  return {
    status: 'block',
    allowed: false,
    action: input.action,
    reason,
    accountId: input.account?.id,
    providerId: input.account?.providerId,
    willSend: false,
    sideEffectBoundary: 'inert-local-plan-no-fetch-no-oauth-no-sync-no-send-no-storage',
    ...extra,
  };
}

function allow(
  input: EmailProviderExecutionGateInput,
  extra: Partial<EmailProviderExecutionGateDecision> = {},
): EmailProviderExecutionGateDecision {
  return {
    status: 'allow',
    allowed: true,
    action: input.action,
    reason: 'allowed_inert_provider_action_plan',
    accountId: input.account?.id,
    providerId: input.account?.providerId,
    willSend: false,
    sideEffectBoundary: 'inert-local-plan-no-fetch-no-oauth-no-sync-no-send-no-storage',
    ...extra,
  };
}

function validateExplicitConsent(input: EmailProviderExecutionGateInput): EmailProviderExecutionDecisionReason | null {
  const account = input.account;
  const consent = input.explicitConsent;
  if (!account || !consent) return 'missing_explicit_consent';
  if (consent.action !== input.action || consent.accountId !== account.id || consent.providerId !== account.providerId) {
    return 'explicit_consent_mismatch';
  }
  if (consent.granted !== true) return 'explicit_consent_not_granted';
  return null;
}

function validateReviewedConsent(
  input: EmailProviderExecutionGateInput,
  needsRead: boolean,
  needsDraft: boolean,
  needsSend: boolean,
): EmailProviderExecutionDecisionReason | null {
  const account = input.account;
  const contract = input.consentContract;
  if (!account || !contract) return 'missing_consent_contract';
  if (contract.accountId !== account.id || contract.providerId !== account.providerId) {
    return 'consent_contract_mismatch';
  }
  if (contract.review.state !== 'reviewed') return 'consent_not_reviewed';
  if (needsRead && contract.readConsent !== 'granted') return 'read_consent_not_granted';
  if (needsDraft && contract.draftConsent !== 'granted') return 'draft_consent_not_granted';
  if (needsSend && contract.sendConsent !== 'granted') return 'send_consent_not_granted';
  return null;
}

function validateCredentialReference(input: EmailProviderExecutionGateInput): {
  reason?: EmailProviderExecutionDecisionReason;
  credentialReference?: ConnectorCredentialReference;
  connectorCredentialRejectReason?: ConnectorCredentialReferenceRejectReason;
} {
  const account = input.account;
  if (!account?.credentialRef && input.connectorCredentialReference === undefined) {
    return { reason: 'missing_credential_reference' };
  }
  if (input.connectorCredentialReference === undefined) return {};

  const validation = validateConnectorCredentialReference(input.connectorCredentialReference);
  if (!validation.ok) {
    return {
      reason: 'invalid_connector_credential_reference',
      connectorCredentialRejectReason: validation.reason,
    };
  }
  if (account && validation.reference.providerId && validation.reference.providerId !== account.providerId) {
    return {
      reason: 'connector_credential_provider_mismatch',
      credentialReference: validation.reference,
    };
  }
  if (account && validation.reference.accountId && validation.reference.accountId !== account.id) {
    return {
      reason: 'connector_credential_account_mismatch',
      credentialReference: validation.reference,
    };
  }
  return { credentialReference: validation.reference };
}

function getReadinessDecision(input: EmailProviderExecutionGateInput): EmailConnectorRuntimeReadinessDecision {
  if (input.readinessDecision) return input.readinessDecision;
  const readinessInput: EmailConnectorRuntimeReadinessInput = {
    account: input.account,
    consentContract: input.consentContract,
    connectorCredentialReference: input.connectorCredentialReference,
    localBridgePlan: input.localBridgePlan,
  };
  return evaluateEmailConnectorRuntimeReadiness(readinessInput);
}

function actionNeedsRead(action: EmailProviderExecutionAction): boolean {
  return action === 'test_connection' || action === 'sync_mail' || action === 'send_mail';
}

function actionNeedsDraft(action: EmailProviderExecutionAction): boolean {
  return action === 'test_connection' || action === 'send_mail';
}

export function evaluateEmailProviderExecutionGate(
  input: EmailProviderExecutionGateInput,
): EmailProviderExecutionGateDecision {
  const account = input.account;
  if (!account) return block(input, 'no_account');
  if (!account.id || !account.providerId || !account.address) return block(input, 'missing_account_identity');
  if (hasStoredEmailSecretMaterial(account) || hasConnectorSecretMaterial(input.connectorCredentialReference)) {
    return block(input, 'raw_secret_material');
  }

  const provider = EMAIL_PROVIDER_METADATA[account.providerId];
  if (!provider) return block(input, 'unknown_provider');

  const explicitConsentFailure = validateExplicitConsent(input);
  if (explicitConsentFailure) return block(input, explicitConsentFailure);

  const capability = ACTION_CAPABILITIES[input.action];
  if (capability && !provider.capabilities[capability]) return block(input, 'action_not_supported_by_provider');

  if (input.action === 'start_oauth') {
    if (!provider.capabilities.requiresOAuth) return block(input, 'action_not_supported_by_provider');
    if (!['pending', 'failed', 'not_configured'].includes(account.status)) return block(input, 'account_not_ready_for_oauth');
    return allow(input);
  }

  const consentFailure = validateReviewedConsent(
    input,
    actionNeedsRead(input.action),
    actionNeedsDraft(input.action),
    input.action === 'send_mail',
  );
  if (consentFailure) return block(input, consentFailure);

  const credentialValidation = validateCredentialReference(input);
  if (credentialValidation.reason) return block(input, credentialValidation.reason, credentialValidation);

  const readinessDecision = getReadinessDecision(input);
  if (input.readinessDecision && (!readinessDecision.accountId || !readinessDecision.providerId)) {
    return block(input, 'runtime_readiness_identity_missing', { readinessDecision });
  }
  if (readinessDecision.accountId && readinessDecision.accountId !== account.id) {
    return block(input, 'action_account_mismatch', { readinessDecision });
  }
  if (readinessDecision.providerId && readinessDecision.providerId !== account.providerId) {
    return block(input, 'action_provider_mismatch', { readinessDecision });
  }
  if (!readinessDecision.ready) {
    return block(input, 'runtime_readiness_not_ready', { readinessDecision });
  }

  if (input.action === 'send_mail') {
    const sendPolicyDecision = evaluateEmailSendPolicy(account, input.consentContract);
    if (!sendPolicyDecision.allowed) {
      return block(input, 'send_policy_blocked', {
        credentialReference: credentialValidation.credentialReference,
        readinessDecision,
        sendPolicyDecision,
      });
    }
    if (input.manualSendConfirmation !== true) {
      return block(input, 'manual_send_confirmation_missing', {
        credentialReference: credentialValidation.credentialReference,
        readinessDecision,
        sendPolicyDecision,
      });
    }
    return allow(input, {
      credentialReference: credentialValidation.credentialReference,
      readinessDecision,
      sendPolicyDecision,
    });
  }

  return allow(input, {
    credentialReference: credentialValidation.credentialReference,
    readinessDecision,
  });
}
