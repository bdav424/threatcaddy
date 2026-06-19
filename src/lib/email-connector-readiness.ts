import {
  EMAIL_PROVIDER_METADATA,
  hasStoredEmailSecretMaterial,
  type EmailAccountConfig,
  type EmailCredentialReference,
} from './email-onboarding';
import {
  type EmailConnectionConsentContract,
} from './email-connection-policy';
import {
  hasConnectorSecretMaterial,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
  type ConnectorCredentialReferenceRejectReason,
} from './connector-credential-boundary';
import {
  type LocalBridgeDiscoveryPlan,
} from './local-bridge-discovery';

export type EmailConnectorRuntimeReadinessStatus = 'ready' | 'blocked' | 'unavailable';

export type EmailConnectorRuntimeReadinessReason =
  | 'ready_for_manual_connector_test'
  | 'no_account'
  | 'missing_account_identity'
  | 'unknown_provider'
  | 'provider_unavailable'
  | 'account_not_configured'
  | 'account_revoked'
  | 'account_design_only'
  | 'raw_secret_material'
  | 'missing_consent_contract'
  | 'consent_contract_mismatch'
  | 'consent_not_reviewed'
  | 'read_consent_not_granted'
  | 'draft_consent_not_granted'
  | 'connection_consent_revoked'
  | 'connection_consent_disconnected'
  | 'connection_prerequisite_blocked'
  | 'provider_read_unsupported'
  | 'provider_draft_unsupported'
  | 'unsupported_send_policy'
  | 'provider_send_enabled_by_default'
  | 'missing_credential_reference'
  | 'credential_kind_mismatch'
  | 'credential_storage_mismatch'
  | 'invalid_connector_credential_reference'
  | 'connector_credential_provider_mismatch'
  | 'connector_credential_account_mismatch'
  | 'local_bridge_prerequisite_missing'
  | 'local_bridge_prerequisite_blocked';

export interface EmailConnectorRuntimeReadinessInput {
  account?: EmailAccountConfig | null;
  consentContract?: EmailConnectionConsentContract | null;
  connectorCredentialReference?: unknown;
  localBridgePlan?: LocalBridgeDiscoveryPlan | null;
}

export interface EmailConnectorRuntimeReadinessDecision {
  status: EmailConnectorRuntimeReadinessStatus;
  ready: boolean;
  reason: EmailConnectorRuntimeReadinessReason;
  accountId?: string;
  providerId?: string;
  credentialReference?: ConnectorCredentialReference;
  connectorCredentialRejectReason?: ConnectorCredentialReferenceRejectReason;
  sideEffectBoundary: 'pure-local-no-fetch-no-socket-no-storage-no-send';
}

function decision(
  status: EmailConnectorRuntimeReadinessStatus,
  reason: EmailConnectorRuntimeReadinessReason,
  input: EmailConnectorRuntimeReadinessInput,
  extra: Partial<EmailConnectorRuntimeReadinessDecision> = {},
): EmailConnectorRuntimeReadinessDecision {
  return {
    status,
    ready: status === 'ready',
    reason,
    accountId: input.account?.id,
    providerId: input.account?.providerId,
    sideEffectBoundary: 'pure-local-no-fetch-no-socket-no-storage-no-send',
    ...extra,
  };
}

function credentialMatchesProvider(
  providerRequiresLocalBridge: boolean,
  credentialRef: EmailCredentialReference,
): boolean {
  return providerRequiresLocalBridge
    ? credentialRef.kind === 'local-bridge' && credentialRef.storedBy === 'local-bridge'
    : credentialRef.kind === 'oauth-token' && (
      credentialRef.storedBy === 'external-provider' || credentialRef.storedBy === 'secret-store'
    );
}

function credentialStorageMatchesKind(credentialRef: EmailCredentialReference): boolean {
  if (credentialRef.kind === 'local-bridge') return credentialRef.storedBy === 'local-bridge';
  if (credentialRef.kind === 'oauth-token') {
    return credentialRef.storedBy === 'external-provider' || credentialRef.storedBy === 'secret-store';
  }
  return credentialRef.storedBy === 'secret-store';
}

export function evaluateEmailConnectorRuntimeReadiness(
  input: EmailConnectorRuntimeReadinessInput,
): EmailConnectorRuntimeReadinessDecision {
  const account = input.account;
  if (!account) return decision('unavailable', 'no_account', input);
  if (!account.id || !account.address) return decision('blocked', 'missing_account_identity', input);
  if (hasStoredEmailSecretMaterial(account) || hasConnectorSecretMaterial(input.connectorCredentialReference)) {
    return decision('blocked', 'raw_secret_material', input);
  }

  const provider = EMAIL_PROVIDER_METADATA[account.providerId];
  if (!provider) return decision('unavailable', 'unknown_provider', input);
  if (!provider.capabilities.canReadMail && !provider.capabilities.canDraft) {
    return decision('unavailable', 'provider_unavailable', input);
  }
  if (account.status === 'not_configured') return decision('unavailable', 'account_not_configured', input);
  if (account.status === 'revoked') return decision('unavailable', 'account_revoked', input);
  if (account.status === 'design_only/mock_only') return decision('unavailable', 'account_design_only', input);

  const contract = input.consentContract;
  if (!contract) return decision('blocked', 'missing_consent_contract', input);
  if (contract.accountId !== account.id || contract.providerId !== account.providerId) {
    return decision('blocked', 'consent_contract_mismatch', input);
  }
  if (contract.lifecycleState === 'revoked') return decision('blocked', 'connection_consent_revoked', input);
  if (contract.lifecycleState === 'disconnected') return decision('blocked', 'connection_consent_disconnected', input);
  if (contract.review.state !== 'reviewed') return decision('blocked', 'consent_not_reviewed', input);
  if (contract.readConsent !== 'granted') return decision('blocked', 'read_consent_not_granted', input);
  if (contract.draftConsent !== 'granted') return decision('blocked', 'draft_consent_not_granted', input);
  if (contract.connectionPrerequisite.state === 'blocked') {
    return decision('blocked', 'connection_prerequisite_blocked', input);
  }

  if (!provider.capabilities.canReadMail) return decision('blocked', 'provider_read_unsupported', input);
  if (!provider.capabilities.canDraft) return decision('blocked', 'provider_draft_unsupported', input);
  if (!['disabled', 'draft_only', 'manual_confirm'].includes(account.sendPolicy)) {
    return decision('blocked', 'unsupported_send_policy', input);
  }
  if (provider.capabilities.sendEnabledByDefault !== false) {
    return decision('blocked', 'provider_send_enabled_by_default', input);
  }

  if (!account.credentialRef) return decision('blocked', 'missing_credential_reference', input);
  if (!credentialStorageMatchesKind(account.credentialRef)) {
    return decision('blocked', 'credential_storage_mismatch', input);
  }
  if (!credentialMatchesProvider(provider.capabilities.requiresLocalBridge, account.credentialRef)) {
    return decision('blocked', 'credential_kind_mismatch', input);
  }

  if (input.connectorCredentialReference !== undefined) {
    const validation = validateConnectorCredentialReference(input.connectorCredentialReference);
    if (!validation.ok) {
      return decision('blocked', 'invalid_connector_credential_reference', input, {
        connectorCredentialRejectReason: validation.reason,
      });
    }
    if (validation.reference.providerId && validation.reference.providerId !== account.providerId) {
      return decision('blocked', 'connector_credential_provider_mismatch', input, {
        credentialReference: validation.reference,
      });
    }
    if (validation.reference.accountId && validation.reference.accountId !== account.id) {
      return decision('blocked', 'connector_credential_account_mismatch', input, {
        credentialReference: validation.reference,
      });
    }
    if (provider.capabilities.requiresLocalBridge && validation.reference.kind !== 'local-bridge') {
      return decision('blocked', 'credential_kind_mismatch', input, {
        credentialReference: validation.reference,
      });
    }
  }

  if (provider.capabilities.requiresLocalBridge) {
    if (!input.localBridgePlan) return decision('blocked', 'local_bridge_prerequisite_missing', input);
    if (
      input.localBridgePlan.bridgeKind !== 'mail'
      || input.localBridgePlan.status !== 'ready'
      || input.localBridgePlan.allowed !== true
      || input.localBridgePlan.acceptedCount < 1
    ) {
      return decision('blocked', 'local_bridge_prerequisite_blocked', input);
    }
  }

  return decision('ready', 'ready_for_manual_connector_test', input);
}
