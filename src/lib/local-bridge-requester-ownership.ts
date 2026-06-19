import {
  hasConnectorSecretMaterial,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
} from './connector-credential-boundary';
import {
  createLocalBridgeDiscoveryPlan,
  type LocalBridgeKind,
} from './local-bridge-discovery';
import type {
  LocalBridgeInertManualProbePlan,
  LocalBridgeProbeExecutionDecision,
} from './local-bridge-probe-execution-gate';

export type LocalBridgeRequesterReviewState =
  | 'reviewed'
  | 'draft'
  | 'unreviewed'
  | 'stale'
  | 'revoked'
  | 'expired';

export type LocalBridgeRequesterCredentialPolicy =
  | 'none'
  | 'opaque-reference-optional'
  | 'opaque-reference-required';

export interface LocalBridgeRequesterCapabilityFact {
  schemaVersion: 1;
  factKind: 'local-bridge-requester-capability';
  capabilityId: string;
  requesterId: string;
  requesterVersion: string;
  reviewState: LocalBridgeRequesterReviewState;
  ownerSurface: string;
  actionId: string;
  bridgeKind: LocalBridgeKind;
  acceptedEndpoint: string;
  method: LocalBridgeInertManualProbePlan['method'];
  url: string;
  maxTimeoutMs: number;
  credentialPolicy: LocalBridgeRequesterCredentialPolicy;
  credentialReferenceId?: string;
  allowsDirectProbe: false;
  allowsLiveExecution: false;
  reviewedAt?: number;
  expiresAt?: number;
  stale?: boolean;
}

export interface LocalBridgeRequesterTransportRequest {
  method?: string;
  url?: string;
  timeoutMs?: number;
  headers?: unknown;
  body?: unknown;
  credentials?: unknown;
  allowed?: unknown;
  executable?: unknown;
  sideEffects?: unknown;
}

export interface LocalBridgeRequesterOwnershipInput {
  gateDecision?: LocalBridgeProbeExecutionDecision | null;
  probePlan?: LocalBridgeInertManualProbePlan | null;
  requesterCapability?: unknown;
  transportRequest?: (LocalBridgeRequesterTransportRequest & Record<string, unknown>) | null;
  ownerSurface?: string;
  actionId?: string;
  capabilityId?: string;
  credentialReference?: unknown;
  directRequester?: unknown;
  now?: number;
}

export type LocalBridgeRequesterOwnershipStatus = 'owned' | 'blocked';

export type LocalBridgeRequesterOwnershipBlockReason =
  | 'raw_secret_material'
  | 'gate_decision_missing'
  | 'gate_decision_blocked'
  | 'gate_decision_not_inert'
  | 'gate_plan_missing'
  | 'probe_plan_missing'
  | 'probe_plan_mismatch'
  | 'requester_capability_missing'
  | 'requester_capability_invalid'
  | 'requester_capability_not_reviewed'
  | 'requester_capability_stale'
  | 'requester_capability_revoked'
  | 'requester_capability_expired'
  | 'requester_capability_mismatch'
  | 'owner_surface_missing'
  | 'owner_surface_mismatch'
  | 'action_missing'
  | 'action_mismatch'
  | 'capability_id_missing'
  | 'capability_id_mismatch'
  | 'identifier_invalid'
  | 'accepted_endpoint_mismatch'
  | 'accepted_endpoint_revalidation_failed'
  | 'schemeless_url_ambiguous'
  | 'transport_request_missing'
  | 'transport_method_mismatch'
  | 'transport_url_mismatch'
  | 'transport_timeout_mismatch'
  | 'transport_timeout_exceeds_capability'
  | 'transport_headers_forbidden'
  | 'transport_body_forbidden'
  | 'transport_credentials_forbidden'
  | 'transport_live_execution_claim'
  | 'credential_reference_forbidden'
  | 'credential_reference_missing'
  | 'credential_reference_invalid'
  | 'credential_reference_mismatch'
  | 'direct_requester_forbidden';

export interface LocalBridgeRequesterOwnershipBlocker {
  code: LocalBridgeRequesterOwnershipBlockReason;
  detail: string;
  field?: string;
}

export interface LocalBridgeRequesterOwnershipDescriptor {
  schemaVersion: 1;
  descriptorKind: 'local-bridge-requester-ownership';
  capability: {
    id: string;
    requesterId: string;
    requesterVersion: string;
  };
  owner: {
    ownerSurface: string;
    actionId: string;
  };
  bridge: {
    bridgeKind: LocalBridgeKind;
    acceptedEndpoint: string;
    method: LocalBridgeInertManualProbePlan['method'];
    url: string;
    timeoutMs: number;
  };
  credentialReference?: Pick<
    ConnectorCredentialReference,
    'schemaVersion' | 'kind' | 'id' | 'storageOwner' | 'providerId' | 'connectorId' | 'accountId'
  >;
  executable: false;
  dispatchAllowed: false;
  sideEffects: 'none';
  sideEffectBoundary: 'ownership-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
}

export interface LocalBridgeRequesterOwnershipDecision {
  status: LocalBridgeRequesterOwnershipStatus;
  owned: boolean;
  descriptor?: LocalBridgeRequesterOwnershipDescriptor;
  blockers: readonly LocalBridgeRequesterOwnershipBlocker[];
  sideEffectBoundary: 'ownership-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
}

const GATE_BOUNDARY = 'decision-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
const PROBE_BOUNDARY = 'plan-only-no-fetch-no-socket';
const OWNERSHIP_BOUNDARY = 'ownership-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_TIMEOUT_MS = 30_000;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:@/+~-]+$/;
const VALID_REVIEW_STATES = new Set<LocalBridgeRequesterReviewState>([
  'reviewed',
  'draft',
  'unreviewed',
  'stale',
  'revoked',
  'expired',
]);
const VALID_CREDENTIAL_POLICIES = new Set<LocalBridgeRequesterCredentialPolicy>([
  'none',
  'opaque-reference-optional',
  'opaque-reference-required',
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
const SECRET_URL_PARAM_MARKERS = [
  'accesstoken',
  'apikey',
  'apitoken',
  'authorization',
  'bearer',
  'clientsecret',
  'credential',
  'key',
  'password',
  'refreshtoken',
  'secret',
  'token',
] as const;

function blocker(
  code: LocalBridgeRequesterOwnershipBlockReason,
  detail: string,
  field?: string,
): LocalBridgeRequesterOwnershipBlocker {
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
  missingCode: LocalBridgeRequesterOwnershipBlockReason,
  missingDetail: string,
  field: string,
  blockers: LocalBridgeRequesterOwnershipBlocker[],
): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) {
    blockers.push(blocker(missingCode, missingDetail, field));
    return undefined;
  }
  if (!isSafeIdentifier(normalized)) {
    blockers.push(blocker('identifier_invalid', 'Local bridge requester ownership identifiers must be bounded opaque metadata, not token-like values.', field));
    return undefined;
  }
  return normalized;
}

function isOptionalTimestamp(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}

function isSafeTimeout(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
    && value <= MAX_TIMEOUT_MS;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function urlHasSecretMaterial(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return true;
    for (const [key, paramValue] of url.searchParams.entries()) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (SECRET_URL_PARAM_MARKERS.some((marker) => normalized.includes(marker))) return true;
      if (stringLooksLikeSecret(paramValue)) return true;
    }
    return false;
  } catch {
    return stringLooksLikeSecret(value);
  }
}

function valueHasSecretText(value: unknown): boolean {
  if (typeof value === 'string') return stringLooksLikeSecret(value);
  if (value === null || value === undefined) return false;
  return hasConnectorSecretMaterial(value);
}

function probePlansMatch(
  left: LocalBridgeInertManualProbePlan | null | undefined,
  right: LocalBridgeInertManualProbePlan | null | undefined,
): boolean {
  return !!left
    && !!right
    && left.bridgeKind === right.bridgeKind
    && left.acceptedEndpoint === right.acceptedEndpoint
    && left.method === right.method
    && left.url === right.url
    && left.timeoutMs === right.timeoutMs
    && left.executable === false
    && right.executable === false
    && left.sideEffects === 'none'
    && right.sideEffects === 'none'
    && left.sideEffectBoundary === PROBE_BOUNDARY
    && right.sideEffectBoundary === PROBE_BOUNDARY;
}

function defaultSchemeFor(endpoint: string): 'http' | 'https' | null {
  try {
    const protocol = new URL(endpoint).protocol;
    if (protocol === 'http:') return 'http';
    if (protocol === 'https:') return 'https';
    return null;
  } catch {
    return null;
  }
}

function endpointMatchesProbeOrigin(endpoint: string, probeUrl: string): boolean {
  try {
    return new URL(endpoint).origin === new URL(probeUrl).origin;
  } catch {
    return false;
  }
}

function revalidateLocalProbePlan(plan: LocalBridgeInertManualProbePlan): boolean {
  const defaultScheme = defaultSchemeFor(plan.acceptedEndpoint);
  if (!defaultScheme) return false;

  let probePath = '/';
  try {
    probePath = new URL(plan.url).pathname || '/';
  } catch {
    return false;
  }

  const discovery = createLocalBridgeDiscoveryPlan({
    bridgeKind: plan.bridgeKind,
    candidates: [plan.acceptedEndpoint],
    consentGranted: true,
    defaultScheme,
    defaultProbePath: probePath,
    timeoutMs: plan.timeoutMs,
    maxCandidates: 1,
  });
  const candidate = discovery.candidates[0];
  return discovery.allowed === true
    && candidate?.accepted === true
    && candidate.normalizedEndpoint === plan.acceptedEndpoint
    && candidate.probe?.url === plan.url
    && candidate.probe.method === plan.method
    && candidate.probe.timeoutMs === plan.timeoutMs
    && endpointMatchesProbeOrigin(plan.acceptedEndpoint, plan.url);
}

function isRequesterCapabilityFact(value: unknown): value is LocalBridgeRequesterCapabilityFact {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 1
    && value.factKind === 'local-bridge-requester-capability'
    && typeof value.capabilityId === 'string'
    && typeof value.requesterId === 'string'
    && typeof value.requesterVersion === 'string'
    && typeof value.reviewState === 'string'
    && VALID_REVIEW_STATES.has(value.reviewState as LocalBridgeRequesterReviewState)
    && typeof value.ownerSurface === 'string'
    && typeof value.actionId === 'string'
    && typeof value.bridgeKind === 'string'
    && typeof value.acceptedEndpoint === 'string'
    && value.method === 'GET'
    && typeof value.url === 'string'
    && isSafeTimeout(value.maxTimeoutMs)
    && typeof value.credentialPolicy === 'string'
    && VALID_CREDENTIAL_POLICIES.has(value.credentialPolicy as LocalBridgeRequesterCredentialPolicy)
    && (value.credentialReferenceId === undefined || typeof value.credentialReferenceId === 'string')
    && value.allowsDirectProbe === false
    && value.allowsLiveExecution === false
    && isOptionalTimestamp(value.reviewedAt)
    && isOptionalTimestamp(value.expiresAt)
    && (value.stale === undefined || typeof value.stale === 'boolean');
}

function requesterIdentifiersAreSafe(fact: LocalBridgeRequesterCapabilityFact): boolean {
  return [
    fact.capabilityId,
    fact.requesterId,
    fact.requesterVersion,
    fact.ownerSurface,
    fact.actionId,
    fact.acceptedEndpoint,
    fact.url,
    fact.credentialReferenceId,
  ].every((value) => value === undefined || isSafeIdentifier(value) || (typeof value === 'string' && isAbsoluteUrl(value)));
}

function addRequesterFreshnessBlockers(
  fact: LocalBridgeRequesterCapabilityFact,
  now: number,
  blockers: LocalBridgeRequesterOwnershipBlocker[],
): void {
  if (fact.reviewState !== 'reviewed') {
    const code: LocalBridgeRequesterOwnershipBlockReason =
      fact.reviewState === 'stale' ? 'requester_capability_stale'
        : fact.reviewState === 'revoked' ? 'requester_capability_revoked'
          : fact.reviewState === 'expired' ? 'requester_capability_expired'
            : 'requester_capability_not_reviewed';
    blockers.push(blocker(code, 'Local bridge requester capability facts must be reviewed and current.', 'requesterCapability.reviewState'));
  }
  if (fact.stale) {
    blockers.push(blocker('requester_capability_stale', 'Local bridge requester capability fact is marked stale.', 'requesterCapability.stale'));
  }
  if (fact.expiresAt !== undefined && fact.expiresAt <= now) {
    blockers.push(blocker('requester_capability_expired', 'Local bridge requester capability fact is expired.', 'requesterCapability.expiresAt'));
  }
}

function addGateBlockers(
  gateDecision: LocalBridgeProbeExecutionDecision | null | undefined,
  blockers: LocalBridgeRequesterOwnershipBlocker[],
): LocalBridgeInertManualProbePlan | undefined {
  if (!gateDecision) {
    blockers.push(blocker('gate_decision_missing', 'Local bridge requester ownership requires a reviewed probe execution gate decision.', 'gateDecision'));
    return undefined;
  }
  if (gateDecision.status !== 'allow') {
    blockers.push(blocker('gate_decision_blocked', 'Local bridge requester ownership requires an allowed inert probe gate decision.', 'gateDecision.status'));
  }
  if (
    gateDecision.executable !== false
    || gateDecision.sideEffects !== 'none'
    || gateDecision.sideEffectBoundary !== GATE_BOUNDARY
    || gateDecision.allowReason !== 'explicit_manual_probe_plan_ready'
  ) {
    blockers.push(blocker('gate_decision_not_inert', 'Local bridge requester ownership accepts only inert plan-only probe gate decisions.', 'gateDecision'));
  }

  const rawGate = gateDecision as unknown as Record<string, unknown>;
  if (
    rawGate.allowed === true
    || rawGate.executed === true
    || rawGate.dispatchAllowed === true
    || rawGate.liveExecution === true
  ) {
    blockers.push(blocker('transport_live_execution_claim', 'Forged live execution or allowed flags are not accepted by requester ownership.', 'gateDecision'));
  }

  if (!gateDecision.probePlan) {
    blockers.push(blocker('gate_plan_missing', 'Local bridge requester ownership requires the exact inert probe plan from the gate decision.', 'gateDecision.probePlan'));
  }
  return gateDecision.probePlan;
}

function addTransportBlockers(
  transportRequest: (LocalBridgeRequesterTransportRequest & Record<string, unknown>) | null | undefined,
  plan: LocalBridgeInertManualProbePlan | undefined,
  capability: LocalBridgeRequesterCapabilityFact | undefined,
  blockers: LocalBridgeRequesterOwnershipBlocker[],
): void {
  if (!transportRequest) {
    blockers.push(blocker('transport_request_missing', 'Local bridge requester ownership requires inert transport metadata for exact plan binding.', 'transportRequest'));
    return;
  }
  if (!plan) return;

  const requestUrl = normalizedString(transportRequest.url);
  if (!requestUrl || !isAbsoluteUrl(requestUrl)) {
    blockers.push(blocker('schemeless_url_ambiguous', 'Transport URL must include an explicit http or https scheme and match the inert plan exactly.', 'transportRequest.url'));
  }
  if (urlHasSecretMaterial(requestUrl)) {
    blockers.push(blocker('raw_secret_material', 'Transport URL must not contain credentials, fragments, token parameters, or secret-like values.', 'transportRequest.url'));
  }
  if (transportRequest.method !== plan.method) {
    blockers.push(blocker('transport_method_mismatch', 'Transport method must match the inert local bridge plan exactly.', 'transportRequest.method'));
  }
  if (requestUrl !== plan.url) {
    blockers.push(blocker('transport_url_mismatch', 'Transport URL must match the inert local bridge plan exactly.', 'transportRequest.url'));
  }
  if (transportRequest.timeoutMs !== plan.timeoutMs) {
    blockers.push(blocker('transport_timeout_mismatch', 'Transport timeout must match the inert local bridge plan exactly.', 'transportRequest.timeoutMs'));
  }
  if (capability && typeof transportRequest.timeoutMs === 'number' && transportRequest.timeoutMs > capability.maxTimeoutMs) {
    blockers.push(blocker('transport_timeout_exceeds_capability', 'Transport timeout cannot exceed the reviewed requester capability ceiling.', 'transportRequest.timeoutMs'));
  }
  if (transportRequest.headers !== undefined) {
    blockers.push(blocker('transport_headers_forbidden', 'Local bridge requester ownership forbids caller-supplied headers.', 'transportRequest.headers'));
  }
  if (transportRequest.body !== undefined) {
    blockers.push(blocker('transport_body_forbidden', 'Local bridge requester ownership forbids caller-supplied bodies.', 'transportRequest.body'));
  }
  if (transportRequest.credentials !== undefined) {
    blockers.push(blocker('transport_credentials_forbidden', 'Local bridge requester ownership forbids caller-supplied credentials.', 'transportRequest.credentials'));
  }
  if (
    transportRequest.allowed === true
    || transportRequest.executable === true
    || transportRequest.sideEffects !== undefined
  ) {
    blockers.push(blocker('transport_live_execution_claim', 'Transport metadata cannot claim live execution, allowed dispatch, or side effects.', 'transportRequest'));
  }
  if (
    valueHasSecretText(transportRequest.headers)
    || valueHasSecretText(transportRequest.body)
    || valueHasSecretText(transportRequest.credentials)
  ) {
    blockers.push(blocker('raw_secret_material', 'Transport headers, bodies, and credentials must not carry secret-like material.', 'transportRequest'));
  }
}

function addCredentialBlockers(
  credentialReference: unknown,
  capability: LocalBridgeRequesterCapabilityFact | undefined,
  blockers: LocalBridgeRequesterOwnershipBlocker[],
): ConnectorCredentialReference | undefined {
  if (!capability) return undefined;

  if (capability.credentialPolicy === 'none') {
    if (credentialReference !== undefined && credentialReference !== null) {
      blockers.push(blocker('credential_reference_forbidden', 'This requester capability does not accept a credential reference.', 'credentialReference'));
    }
    return undefined;
  }

  if (credentialReference === undefined || credentialReference === null) {
    if (capability.credentialPolicy === 'opaque-reference-required') {
      blockers.push(blocker('credential_reference_missing', 'This requester capability requires an opaque credential reference.', 'credentialReference'));
    }
    return undefined;
  }

  const validation = validateConnectorCredentialReference(credentialReference);
  if (!validation.ok) {
    blockers.push(blocker('credential_reference_invalid', 'Credential reference failed the connector credential boundary contract.', 'credentialReference'));
    return undefined;
  }

  if (capability.credentialReferenceId && validation.reference.id !== capability.credentialReferenceId) {
    blockers.push(blocker('credential_reference_mismatch', 'Credential reference id must match the reviewed requester capability.', 'credentialReference.id'));
  }
  return validation.reference;
}

function credentialSummary(
  reference: ConnectorCredentialReference | undefined,
): LocalBridgeRequesterOwnershipDescriptor['credentialReference'] {
  if (!reference) return undefined;
  return Object.freeze({
    schemaVersion: reference.schemaVersion,
    kind: reference.kind,
    id: reference.id,
    storageOwner: reference.storageOwner,
    providerId: reference.providerId,
    connectorId: reference.connectorId,
    accountId: reference.accountId,
  });
}

function buildDescriptor(
  capability: LocalBridgeRequesterCapabilityFact,
  plan: LocalBridgeInertManualProbePlan,
  credentialReference: ConnectorCredentialReference | undefined,
): LocalBridgeRequesterOwnershipDescriptor {
  const credential = credentialSummary(credentialReference);
  return Object.freeze({
    schemaVersion: 1,
    descriptorKind: 'local-bridge-requester-ownership',
    capability: Object.freeze({
      id: capability.capabilityId,
      requesterId: capability.requesterId,
      requesterVersion: capability.requesterVersion,
    }),
    owner: Object.freeze({
      ownerSurface: capability.ownerSurface,
      actionId: capability.actionId,
    }),
    bridge: Object.freeze({
      bridgeKind: plan.bridgeKind,
      acceptedEndpoint: plan.acceptedEndpoint,
      method: plan.method,
      url: plan.url,
      timeoutMs: plan.timeoutMs,
    }),
    credentialReference: credential,
    executable: false,
    dispatchAllowed: false,
    sideEffects: 'none',
    sideEffectBoundary: OWNERSHIP_BOUNDARY,
  });
}

export function planLocalBridgeRequesterOwnership(
  input: LocalBridgeRequesterOwnershipInput,
): LocalBridgeRequesterOwnershipDecision {
  const blockers: LocalBridgeRequesterOwnershipBlocker[] = [];

  if (hasConnectorSecretMaterial(input)) {
    blockers.push(blocker(
      'raw_secret_material',
      'Local bridge requester ownership accepts reviewed metadata and opaque references only, never tokens, passwords, API keys, authorization headers, OAuth codes, or provider secrets.',
      'input',
    ));
  }
  if (typeof input.directRequester === 'function') {
    blockers.push(blocker('direct_requester_forbidden', 'Direct requester functions cannot be bound without a separately reviewed ownership contract.', 'directRequester'));
  }

  const ownerSurface = safeRequiredIdentifier(
    input.ownerSurface,
    'owner_surface_missing',
    'Local bridge requester ownership requires an owner surface.',
    'ownerSurface',
    blockers,
  );
  const actionId = safeRequiredIdentifier(
    input.actionId,
    'action_missing',
    'Local bridge requester ownership requires an action id.',
    'actionId',
    blockers,
  );
  const capabilityId = safeRequiredIdentifier(
    input.capabilityId,
    'capability_id_missing',
    'Local bridge requester ownership requires a reviewed capability id.',
    'capabilityId',
    blockers,
  );

  const gatePlan = addGateBlockers(input.gateDecision, blockers);
  const suppliedPlan = input.probePlan;
  if (!suppliedPlan) {
    blockers.push(blocker('probe_plan_missing', 'Local bridge requester ownership requires a supplied inert probe plan for exact match.', 'probePlan'));
  } else if (!probePlansMatch(suppliedPlan, gatePlan)) {
    blockers.push(blocker('probe_plan_mismatch', 'Supplied inert probe plan must match the gate output exactly.', 'probePlan'));
  }
  if (suppliedPlan && !isAbsoluteUrl(suppliedPlan.acceptedEndpoint)) {
    blockers.push(blocker('schemeless_url_ambiguous', 'Accepted endpoint must include an explicit http or https scheme.', 'probePlan.acceptedEndpoint'));
  }
  if (suppliedPlan && (!isAbsoluteUrl(suppliedPlan.url) || urlHasSecretMaterial(suppliedPlan.url))) {
    blockers.push(blocker(urlHasSecretMaterial(suppliedPlan.url) ? 'raw_secret_material' : 'schemeless_url_ambiguous', 'Probe URL must be absolute and must not contain secret-bearing URL material.', 'probePlan.url'));
  }
  if (suppliedPlan && !revalidateLocalProbePlan(suppliedPlan)) {
    blockers.push(blocker('accepted_endpoint_revalidation_failed', 'Accepted endpoint and probe URL must revalidate as the same allowed local bridge plan.', 'probePlan.acceptedEndpoint'));
  }

  let requesterCapability: LocalBridgeRequesterCapabilityFact | undefined;
  if (!input.requesterCapability) {
    blockers.push(blocker('requester_capability_missing', 'Local bridge requester ownership requires an injected reviewed requester capability fact.', 'requesterCapability'));
  } else if (!isRequesterCapabilityFact(input.requesterCapability)) {
    blockers.push(blocker('requester_capability_invalid', 'Requester capability fact failed the local ownership contract.', 'requesterCapability'));
  } else {
    requesterCapability = input.requesterCapability;
    if (hasConnectorSecretMaterial(requesterCapability) || !requesterIdentifiersAreSafe(requesterCapability)) {
      blockers.push(blocker('raw_secret_material', 'Requester capability facts must contain only safe opaque identifiers and URLs.', 'requesterCapability'));
    }
    addRequesterFreshnessBlockers(requesterCapability, input.now ?? Date.now(), blockers);
    if (capabilityId !== undefined && requesterCapability.capabilityId !== capabilityId) {
      blockers.push(blocker('capability_id_mismatch', 'Requester capability id must match the requested reviewed capability id.', 'requesterCapability.capabilityId'));
    }
    if (ownerSurface !== undefined && requesterCapability.ownerSurface !== ownerSurface) {
      blockers.push(blocker('owner_surface_mismatch', 'Requester owner surface must match the requested owner surface.', 'requesterCapability.ownerSurface'));
    }
    if (actionId !== undefined && requesterCapability.actionId !== actionId) {
      blockers.push(blocker('action_mismatch', 'Requester action id must match the requested action id.', 'requesterCapability.actionId'));
    }
    if (
      suppliedPlan
      && (
        requesterCapability.bridgeKind !== suppliedPlan.bridgeKind
        || requesterCapability.acceptedEndpoint !== suppliedPlan.acceptedEndpoint
        || requesterCapability.method !== suppliedPlan.method
        || requesterCapability.url !== suppliedPlan.url
      )
    ) {
      blockers.push(blocker('requester_capability_mismatch', 'Requester capability must bind to the same bridge kind, endpoint, method, and URL as the inert probe plan.', 'requesterCapability'));
    }
    if (suppliedPlan && requesterCapability.acceptedEndpoint !== suppliedPlan.acceptedEndpoint) {
      blockers.push(blocker('accepted_endpoint_mismatch', 'Requester capability accepted endpoint must match the inert probe plan exactly.', 'requesterCapability.acceptedEndpoint'));
    }
  }

  addTransportBlockers(input.transportRequest, suppliedPlan ?? undefined, requesterCapability, blockers);
  const credentialReference = addCredentialBlockers(input.credentialReference, requesterCapability, blockers);

  const owned = blockers.length === 0 && requesterCapability !== undefined && suppliedPlan !== null && suppliedPlan !== undefined;

  return Object.freeze({
    status: owned ? 'owned' : 'blocked',
    owned,
    descriptor: owned && requesterCapability && suppliedPlan
      ? buildDescriptor(requesterCapability, suppliedPlan, credentialReference)
      : undefined,
    blockers: Object.freeze(blockers),
    sideEffectBoundary: OWNERSHIP_BOUNDARY,
  });
}
