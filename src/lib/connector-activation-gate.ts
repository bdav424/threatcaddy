import {
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
  type ConnectorCredentialReferenceRejectReason,
} from './connector-credential-boundary';
import { isKnownIntegrationNextActionTarget, resolveIntegrationNextActionPlan } from './integration-next-actions';
import type {
  IntegrationCatalogProvider,
  IntegrationCatalogProviderNextActionSurface,
  IntegrationCatalogProviderStatus,
} from '../types/integration-types';

export type ConnectorActivationConsentScope = 'activate-generic-connector';

export interface ConnectorActivationConsentFact {
  granted: boolean;
  scope: ConnectorActivationConsentScope;
  providerId: string;
  targetSurface: IntegrationCatalogProviderNextActionSurface;
  targetId: string;
  acknowledgedNoProviderCalls: boolean;
}

export interface ConnectorRuntimeOwnershipFact {
  owner: 'connector-runtime';
  providerId: string;
  connectorId: string;
  targetSurface: IntegrationCatalogProviderNextActionSurface;
  targetId: string;
}

export interface ConnectorActivationGateInput {
  provider?: Pick<
    IntegrationCatalogProvider,
    'id' | 'name' | 'status' | 'configurationStatus' | 'nextAction'
  >;
  credentialReference?: unknown;
  consent?: ConnectorActivationConsentFact;
  runtime?: ConnectorRuntimeOwnershipFact;
}

export type ConnectorActivationBlockerCode =
  | 'provider_missing'
  | 'catalog_status_not_live'
  | 'next_action_rejected'
  | 'next_action_symbolic'
  | 'next_action_target_unknown'
  | 'credential_reference_missing'
  | 'credential_reference_invalid'
  | 'credential_provider_mismatch'
  | 'credential_connector_missing'
  | 'credential_connector_mismatch'
  | 'consent_missing'
  | 'consent_scope_invalid'
  | 'consent_not_granted'
  | 'consent_provider_mismatch'
  | 'consent_target_mismatch'
  | 'consent_no_provider_calls_not_acknowledged'
  | 'runtime_owner_missing'
  | 'runtime_owner_ambiguous'
  | 'runtime_provider_mismatch'
  | 'runtime_target_mismatch';

export interface ConnectorActivationBlocker {
  code: ConnectorActivationBlockerCode;
  detail: string;
  field?: string;
}

export type ConnectorActivationDecisionStatus = 'blocked' | 'activation-ready';

export interface ConnectorActivationDecision {
  status: ConnectorActivationDecisionStatus;
  providerId: string;
  providerName: string;
  targetSurface: IntegrationCatalogProviderNextActionSurface | 'unknown';
  targetId: string;
  active: false;
  executable: false;
  sideEffects: 'none';
  credentialReference?: ConnectorCredentialReference;
  blockers: readonly ConnectorActivationBlocker[];
}

const NON_LIVE_CATALOG_STATUSES = new Set<IntegrationCatalogProviderStatus>([
  'catalog-only',
  'design-only',
  'builtin-template',
]);

function blocker(
  code: ConnectorActivationBlockerCode,
  detail: string,
  field?: string,
): ConnectorActivationBlocker {
  return Object.freeze({ code, detail, field });
}

function credentialBlockerReason(
  reason: ConnectorCredentialReferenceRejectReason,
): string {
  return `Credential reference rejected by connector credential boundary: ${reason}.`;
}

function providerLabel(
  provider: ConnectorActivationGateInput['provider'],
): Pick<ConnectorActivationDecision, 'providerId' | 'providerName'> {
  return {
    providerId: provider?.id ?? '',
    providerName: provider?.name ?? '',
  };
}

function isActivationConsentFact(value: unknown): value is ConnectorActivationConsentFact {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const source = value as Partial<ConnectorActivationConsentFact>;
  return (
    typeof source.granted === 'boolean'
    && source.scope === 'activate-generic-connector'
    && typeof source.providerId === 'string'
    && typeof source.targetSurface === 'string'
    && typeof source.targetId === 'string'
    && typeof source.acknowledgedNoProviderCalls === 'boolean'
  );
}

function isRuntimeOwnershipFact(value: unknown): value is ConnectorRuntimeOwnershipFact {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const source = value as Partial<ConnectorRuntimeOwnershipFact>;
  return (
    source.owner === 'connector-runtime'
    && typeof source.providerId === 'string'
    && typeof source.connectorId === 'string'
    && typeof source.targetSurface === 'string'
    && typeof source.targetId === 'string'
  );
}

export function resolveConnectorActivationGate(
  input: ConnectorActivationGateInput,
): ConnectorActivationDecision {
  const blockers: ConnectorActivationBlocker[] = [];
  const provider = input.provider;
  const label = providerLabel(provider);

  if (!provider) {
    blockers.push(blocker('provider_missing', 'Activation requires a catalog provider fact.', 'provider'));
    return Object.freeze({
      ...label,
      status: 'blocked',
      targetSurface: 'unknown',
      targetId: '',
      active: false,
      executable: false,
      sideEffects: 'none',
      blockers: Object.freeze(blockers),
    });
  }

  const nextActionPlan = resolveIntegrationNextActionPlan(provider);
  const targetSurface = nextActionPlan.targetSurface;
  const targetId = nextActionPlan.targetId;

  if (NON_LIVE_CATALOG_STATUSES.has(provider.status)) {
    blockers.push(blocker(
      'catalog_status_not_live',
      `Catalog status ${provider.status} is not proof of a live connector runtime.`,
      'provider.status',
    ));
  }

  if (nextActionPlan.status === 'rejected') {
    blockers.push(blocker(
      'next_action_rejected',
      nextActionPlan.rejectedReason ?? 'nextAction metadata failed closed.',
      'provider.nextAction',
    ));
  }

  if (!isKnownIntegrationNextActionTarget(targetSurface, targetId)) {
    blockers.push(blocker(
      'next_action_target_unknown',
      `Unknown nextAction target ${targetSurface}:${targetId}.`,
      'provider.nextAction.targetId',
    ));
  }

  if (!nextActionPlan.executable) {
    blockers.push(blocker(
      'next_action_symbolic',
      'Catalog nextAction metadata is symbolic only and must not be executed as connector activation.',
      'provider.nextAction',
    ));
  }

  const credentialValidation = validateConnectorCredentialReference(input.credentialReference);
  let credentialReference: ConnectorCredentialReference | undefined;
  if (input.credentialReference === undefined) {
    blockers.push(blocker(
      'credential_reference_missing',
      'Activation requires an opaque credential reference fact.',
      'credentialReference',
    ));
  } else if (!credentialValidation.ok) {
    blockers.push(blocker(
      'credential_reference_invalid',
      credentialBlockerReason(credentialValidation.reason),
      credentialValidation.field ? `credentialReference.${credentialValidation.field}` : 'credentialReference',
    ));
  } else {
    credentialReference = credentialValidation.reference;
    if (credentialReference.providerId !== provider.id) {
      blockers.push(blocker(
        'credential_provider_mismatch',
        'Credential reference providerId must match the catalog provider id.',
        'credentialReference.providerId',
      ));
    }
    if (!credentialReference.connectorId) {
      blockers.push(blocker(
        'credential_connector_missing',
        'Credential reference must name the connector runtime id.',
        'credentialReference.connectorId',
      ));
    }
  }

  if (!isActivationConsentFact(input.consent)) {
    blockers.push(blocker('consent_missing', 'Activation requires explicit connector consent.', 'consent'));
  } else {
    if (input.consent.scope !== 'activate-generic-connector') {
      blockers.push(blocker('consent_scope_invalid', 'Consent scope is not valid for connector activation.', 'consent.scope'));
    }
    if (!input.consent.granted) {
      blockers.push(blocker('consent_not_granted', 'Connector activation consent was not granted.', 'consent.granted'));
    }
    if (input.consent.providerId !== provider.id) {
      blockers.push(blocker('consent_provider_mismatch', 'Consent providerId must match the catalog provider id.', 'consent.providerId'));
    }
    if (input.consent.targetSurface !== targetSurface || input.consent.targetId !== targetId) {
      blockers.push(blocker('consent_target_mismatch', 'Consent target must match the resolved nextAction target.', 'consent.targetId'));
    }
    if (!input.consent.acknowledgedNoProviderCalls) {
      blockers.push(blocker(
        'consent_no_provider_calls_not_acknowledged',
        'Consent must acknowledge that this gate does not call providers or execute nextActions.',
        'consent.acknowledgedNoProviderCalls',
      ));
    }
  }

  if (!isRuntimeOwnershipFact(input.runtime)) {
    blockers.push(blocker(
      'runtime_owner_missing',
      'Activation requires an explicit connector runtime ownership fact.',
      'runtime',
    ));
  } else {
    if (input.runtime.providerId !== provider.id) {
      blockers.push(blocker('runtime_provider_mismatch', 'Runtime owner providerId must match the catalog provider id.', 'runtime.providerId'));
    }
    if (input.runtime.targetSurface !== targetSurface || input.runtime.targetId !== targetId) {
      blockers.push(blocker('runtime_target_mismatch', 'Runtime owner target must match the resolved nextAction target.', 'runtime.targetId'));
    }
    if (credentialReference?.connectorId && input.runtime.connectorId !== credentialReference.connectorId) {
      blockers.push(blocker('credential_connector_mismatch', 'Runtime connectorId must match the credential reference connectorId.', 'runtime.connectorId'));
    }
    if (credentialReference && !credentialReference.connectorId) {
      blockers.push(blocker('runtime_owner_ambiguous', 'Runtime ownership is ambiguous without a credential connectorId.', 'runtime.connectorId'));
    }
  }

  return Object.freeze({
    ...label,
    status: blockers.length === 0 ? 'activation-ready' : 'blocked',
    targetSurface,
    targetId,
    active: false,
    executable: false,
    sideEffects: 'none',
    credentialReference,
    blockers: Object.freeze(blockers),
  });
}
