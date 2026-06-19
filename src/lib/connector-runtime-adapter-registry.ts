import { hasConnectorSecretMaterial } from './connector-credential-boundary';

export type ConnectorRuntimeAdapterSurface = 'email' | 'assistant' | 'messaging';

export type ConnectorRuntimeAdapterReviewState =
  | 'reviewed'
  | 'draft'
  | 'unreviewed'
  | 'stale'
  | 'revoked'
  | 'expired';

export type ConnectorRuntimeAdapterSideEffectClass =
  | 'none'
  | 'provider-read'
  | 'provider-draft'
  | 'provider-live-delivery';

export interface ConnectorRuntimeLiveDeliveryCapabilityFact {
  capabilityKind: 'explicit-live-delivery-capability';
  reviewed: true;
  sideEffectClass: 'provider-live-delivery';
  requiresCredentialHandle: true;
  requiresExplicitConsent: true;
}

export interface ConnectorRuntimeAdapterCapabilityFact {
  schemaVersion: 1;
  factKind: 'connector-runtime-adapter-capability';
  adapterId: string;
  adapterVersion: string;
  surface: ConnectorRuntimeAdapterSurface;
  providerId: string;
  actionId: string;
  sideEffectClass: ConnectorRuntimeAdapterSideEffectClass;
  requiresCredentialHandle: boolean;
  requiresExplicitConsent: boolean;
  allowsLiveDelivery: boolean;
  reviewState: ConnectorRuntimeAdapterReviewState;
  reviewedAt?: number;
  expiresAt?: number;
  stale?: boolean;
  liveDeliveryCapability?: ConnectorRuntimeLiveDeliveryCapabilityFact;
}

export interface ConnectorRuntimeAdapterSelectionRequest {
  capabilities?: readonly unknown[] | null;
  surface?: ConnectorRuntimeAdapterSurface | string;
  providerId?: string;
  actionId?: string;
  adapterId?: string;
  now?: number;
}

export type ConnectorRuntimeAdapterSelectionStatus = 'selected' | 'blocked';

export type ConnectorRuntimeAdapterSelectionBlockerCode =
  | 'raw_secret_material'
  | 'capability_facts_missing'
  | 'capability_fact_invalid'
  | 'surface_missing'
  | 'provider_missing'
  | 'action_missing'
  | 'identifier_invalid'
  | 'capability_mismatch'
  | 'ambiguous_duplicate_capabilities'
  | 'capability_not_reviewed'
  | 'capability_stale'
  | 'capability_revoked'
  | 'capability_expired'
  | 'live_delivery_capability_missing'
  | 'live_delivery_capability_unreviewed'
  | 'live_delivery_capability_mismatch';

export interface ConnectorRuntimeAdapterSelectionBlocker {
  code: ConnectorRuntimeAdapterSelectionBlockerCode;
  detail: string;
  field?: string;
}

export interface ConnectorRuntimeAdapterSelectionDescriptor {
  schemaVersion: 1;
  descriptorKind: 'connector-runtime-adapter-selection';
  adapter: {
    id: string;
    version: string;
  };
  capability: {
    surface: ConnectorRuntimeAdapterSurface;
    providerId: string;
    actionId: string;
    sideEffectClass: ConnectorRuntimeAdapterSideEffectClass;
    requiresCredentialHandle: boolean;
    requiresExplicitConsent: boolean;
    allowsLiveDelivery: boolean;
  };
  review: {
    reviewState: 'reviewed';
    reviewedAt?: number;
    expiresAt?: number;
  };
  executable: false;
  sideEffectBoundary: 'metadata-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-provider-action';
}

export interface ConnectorRuntimeAdapterSelectionDecision {
  status: ConnectorRuntimeAdapterSelectionStatus;
  selected: boolean;
  descriptor?: ConnectorRuntimeAdapterSelectionDescriptor;
  blockers: readonly ConnectorRuntimeAdapterSelectionBlocker[];
  sideEffectBoundary: 'metadata-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-provider-action';
}

const MAX_IDENTIFIER_LENGTH = 180;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:@/+~-]+$/;
const VALID_SURFACES = new Set<ConnectorRuntimeAdapterSurface>(['email', 'assistant', 'messaging']);
const VALID_SIDE_EFFECT_CLASSES = new Set<ConnectorRuntimeAdapterSideEffectClass>([
  'none',
  'provider-read',
  'provider-draft',
  'provider-live-delivery',
]);
const VALID_REVIEW_STATES = new Set<ConnectorRuntimeAdapterReviewState>([
  'reviewed',
  'draft',
  'unreviewed',
  'stale',
  'revoked',
  'expired',
]);
const SECRET_VALUE_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^ghp_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^sk-[a-z0-9_-]{8,}$/i,
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /basic\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:api|app|client|refresh|access)[_-]?(?:key|token|secret)\s*[:=]\s*\S+/i,
  /(?:oauth|authorization)[\s_-]?code\s*[:=]\s*\S+/i,
] as const;

function blocker(
  code: ConnectorRuntimeAdapterSelectionBlockerCode,
  detail: string,
  field?: string,
): ConnectorRuntimeAdapterSelectionBlocker {
  return Object.freeze({ code, detail, field });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringLooksLikeSecret(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function isSafeIdentifier(value: string): boolean {
  return value.length <= MAX_IDENTIFIER_LENGTH
    && IDENTIFIER_PATTERN.test(value)
    && !stringLooksLikeSecret(value);
}

function safeRequiredIdentifier(
  value: unknown,
  missingCode: ConnectorRuntimeAdapterSelectionBlockerCode,
  missingDetail: string,
  field: string,
  blockers: ConnectorRuntimeAdapterSelectionBlocker[],
): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) {
    blockers.push(blocker(missingCode, missingDetail, field));
    return undefined;
  }
  if (!isSafeIdentifier(normalized)) {
    blockers.push(blocker('identifier_invalid', 'Runtime adapter registry identifiers must be bounded opaque metadata, not token-like values.', field));
    return undefined;
  }
  return normalized;
}

function isOptionalTimestamp(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}

function isLiveDeliveryCapabilityFact(value: unknown): value is ConnectorRuntimeLiveDeliveryCapabilityFact {
  if (!isRecord(value)) return false;
  return value.capabilityKind === 'explicit-live-delivery-capability'
    && value.reviewed === true
    && value.sideEffectClass === 'provider-live-delivery'
    && value.requiresCredentialHandle === true
    && value.requiresExplicitConsent === true;
}

function isAdapterCapabilityFact(value: unknown): value is ConnectorRuntimeAdapterCapabilityFact {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 1
    && value.factKind === 'connector-runtime-adapter-capability'
    && typeof value.adapterId === 'string'
    && typeof value.adapterVersion === 'string'
    && typeof value.surface === 'string'
    && VALID_SURFACES.has(value.surface as ConnectorRuntimeAdapterSurface)
    && typeof value.providerId === 'string'
    && typeof value.actionId === 'string'
    && typeof value.sideEffectClass === 'string'
    && VALID_SIDE_EFFECT_CLASSES.has(value.sideEffectClass as ConnectorRuntimeAdapterSideEffectClass)
    && typeof value.requiresCredentialHandle === 'boolean'
    && typeof value.requiresExplicitConsent === 'boolean'
    && typeof value.allowsLiveDelivery === 'boolean'
    && typeof value.reviewState === 'string'
    && VALID_REVIEW_STATES.has(value.reviewState as ConnectorRuntimeAdapterReviewState)
    && isOptionalTimestamp(value.reviewedAt)
    && isOptionalTimestamp(value.expiresAt)
    && (value.stale === undefined || typeof value.stale === 'boolean')
    && (value.liveDeliveryCapability === undefined || isLiveDeliveryCapabilityFact(value.liveDeliveryCapability));
}

function capabilityIdentifiersAreSafe(fact: ConnectorRuntimeAdapterCapabilityFact): boolean {
  return [
    fact.adapterId,
    fact.adapterVersion,
    fact.providerId,
    fact.actionId,
  ].every(isSafeIdentifier);
}

function capabilityMatchesRequest(
  fact: ConnectorRuntimeAdapterCapabilityFact,
  request: {
    surface: ConnectorRuntimeAdapterSurface;
    providerId: string;
    actionId: string;
    adapterId?: string;
  },
): boolean {
  return fact.surface === request.surface
    && fact.providerId === request.providerId
    && fact.actionId === request.actionId
    && (request.adapterId === undefined || fact.adapterId === request.adapterId);
}

function addCapabilityFreshnessBlockers(
  fact: ConnectorRuntimeAdapterCapabilityFact,
  now: number,
  blockers: ConnectorRuntimeAdapterSelectionBlocker[],
): void {
  if (fact.reviewState !== 'reviewed') {
    const code: ConnectorRuntimeAdapterSelectionBlockerCode =
      fact.reviewState === 'stale' ? 'capability_stale'
        : fact.reviewState === 'revoked' ? 'capability_revoked'
          : fact.reviewState === 'expired' ? 'capability_expired'
            : 'capability_not_reviewed';
    blockers.push(blocker(code, 'Runtime adapter capability facts must be reviewed and current.', 'capability.reviewState'));
  }
  if (fact.stale) {
    blockers.push(blocker('capability_stale', 'Runtime adapter capability fact is marked stale.', 'capability.stale'));
  }
  if (fact.expiresAt !== undefined && fact.expiresAt <= now) {
    blockers.push(blocker('capability_expired', 'Runtime adapter capability fact is expired.', 'capability.expiresAt'));
  }
}

function addLiveDeliveryBlockers(
  fact: ConnectorRuntimeAdapterCapabilityFact,
  blockers: ConnectorRuntimeAdapterSelectionBlocker[],
): void {
  const claimsLiveSideEffects = fact.allowsLiveDelivery || fact.sideEffectClass === 'provider-live-delivery';
  if (!claimsLiveSideEffects) return;

  if (!fact.liveDeliveryCapability) {
    blockers.push(blocker('live_delivery_capability_missing', 'Live provider side effects require an explicit reviewed live-delivery capability fact.', 'capability.liveDeliveryCapability'));
    return;
  }
  if (fact.liveDeliveryCapability.reviewed !== true) {
    blockers.push(blocker('live_delivery_capability_unreviewed', 'Live provider side effects require a reviewed live-delivery capability fact.', 'capability.liveDeliveryCapability.reviewed'));
  }
  if (
    fact.sideEffectClass !== 'provider-live-delivery'
    || fact.requiresCredentialHandle !== true
    || fact.requiresExplicitConsent !== true
    || fact.liveDeliveryCapability.sideEffectClass !== fact.sideEffectClass
    || fact.liveDeliveryCapability.requiresCredentialHandle !== fact.requiresCredentialHandle
    || fact.liveDeliveryCapability.requiresExplicitConsent !== fact.requiresExplicitConsent
  ) {
    blockers.push(blocker('live_delivery_capability_mismatch', 'Live provider side-effect facts must require credential handles and explicit consent.', 'capability.liveDeliveryCapability'));
  }
}

function buildDescriptor(fact: ConnectorRuntimeAdapterCapabilityFact): ConnectorRuntimeAdapterSelectionDescriptor {
  return Object.freeze({
    schemaVersion: 1,
    descriptorKind: 'connector-runtime-adapter-selection',
    adapter: Object.freeze({
      id: fact.adapterId,
      version: fact.adapterVersion,
    }),
    capability: Object.freeze({
      surface: fact.surface,
      providerId: fact.providerId,
      actionId: fact.actionId,
      sideEffectClass: fact.sideEffectClass,
      requiresCredentialHandle: fact.requiresCredentialHandle,
      requiresExplicitConsent: fact.requiresExplicitConsent,
      allowsLiveDelivery: fact.allowsLiveDelivery,
    }),
    review: Object.freeze({
      reviewState: 'reviewed',
      reviewedAt: fact.reviewedAt,
      expiresAt: fact.expiresAt,
    }),
    executable: false,
    sideEffectBoundary: 'metadata-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-provider-action',
  });
}

export function selectConnectorRuntimeAdapterCapability(
  input: ConnectorRuntimeAdapterSelectionRequest,
): ConnectorRuntimeAdapterSelectionDecision {
  const blockers: ConnectorRuntimeAdapterSelectionBlocker[] = [];

  if (hasConnectorSecretMaterial(input)) {
    blockers.push(blocker(
      'raw_secret_material',
      'Runtime adapter registry accepts reviewed metadata facts only, never tokens, passwords, API keys, authorization headers, OAuth codes, webhooks, or provider secrets.',
      'input',
    ));
  }

  const surface = safeRequiredIdentifier(
    input.surface,
    'surface_missing',
    'Runtime adapter selection requires a target surface.',
    'surface',
    blockers,
  );
  if (surface !== undefined && !VALID_SURFACES.has(surface as ConnectorRuntimeAdapterSurface)) {
    blockers.push(blocker('identifier_invalid', 'Runtime adapter surface is not allowed by the local registry contract.', 'surface'));
  }
  const providerId = safeRequiredIdentifier(
    input.providerId,
    'provider_missing',
    'Runtime adapter selection requires a provider id.',
    'providerId',
    blockers,
  );
  const actionId = safeRequiredIdentifier(
    input.actionId,
    'action_missing',
    'Runtime adapter selection requires an action id.',
    'actionId',
    blockers,
  );
  const adapterId = normalizedString(input.adapterId);
  if (adapterId !== undefined && !isSafeIdentifier(adapterId)) {
    blockers.push(blocker('identifier_invalid', 'Runtime adapter id filter must be bounded opaque metadata, not token-like values.', 'adapterId'));
  }

  const rawCapabilities = Array.isArray(input.capabilities) ? input.capabilities : [];
  if (rawCapabilities.length === 0) {
    blockers.push(blocker('capability_facts_missing', 'Runtime adapter selection requires at least one injected capability fact.', 'capabilities'));
  }

  const validCapabilities: ConnectorRuntimeAdapterCapabilityFact[] = [];
  for (const rawCapability of rawCapabilities) {
    if (!isAdapterCapabilityFact(rawCapability)) {
      blockers.push(blocker('capability_fact_invalid', 'Runtime adapter capability fact failed the local metadata contract.', 'capabilities'));
      continue;
    }
    if (hasConnectorSecretMaterial(rawCapability) || !capabilityIdentifiersAreSafe(rawCapability)) {
      blockers.push(blocker('raw_secret_material', 'Runtime adapter capability facts must not contain token-like identifiers or secret material.', 'capabilities'));
      continue;
    }
    validCapabilities.push(rawCapability);
  }

  const canMatch = surface !== undefined
    && VALID_SURFACES.has(surface as ConnectorRuntimeAdapterSurface)
    && providerId !== undefined
    && actionId !== undefined;
  const matches = canMatch
    ? validCapabilities.filter((fact) => capabilityMatchesRequest(fact, {
      surface: surface as ConnectorRuntimeAdapterSurface,
      providerId,
      actionId,
      adapterId,
    }))
    : [];

  if (canMatch && validCapabilities.length > 0 && matches.length === 0) {
    blockers.push(blocker('capability_mismatch', 'No reviewed adapter capability fact matched the requested surface, provider, action, and adapter filter.', 'capabilities'));
  }
  if (matches.length > 1) {
    blockers.push(blocker('ambiguous_duplicate_capabilities', 'Runtime adapter selection requires exactly one matching capability fact.', 'capabilities'));
  }

  const selectedFact = matches.length === 1 ? matches[0] : undefined;
  if (selectedFact) {
    addCapabilityFreshnessBlockers(selectedFact, input.now ?? Date.now(), blockers);
    addLiveDeliveryBlockers(selectedFact, blockers);
  }

  const selected = blockers.length === 0 && selectedFact !== undefined;

  return Object.freeze({
    status: selected ? 'selected' : 'blocked',
    selected,
    descriptor: selectedFact && selected ? buildDescriptor(selectedFact) : undefined,
    blockers: Object.freeze(blockers),
    sideEffectBoundary: 'metadata-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-provider-action',
  });
}
