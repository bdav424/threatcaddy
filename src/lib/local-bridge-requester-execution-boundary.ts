import type {
  LocalBridgeDryRunTransportHarnessDecision,
  LocalBridgeDryRunTransportMetadata,
} from './local-bridge-dry-run-transport-harness';
import type {
  LocalBridgeRequesterOwnershipDecision,
  LocalBridgeRequesterOwnershipDescriptor,
} from './local-bridge-requester-ownership';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractObject,
} from './runtime-trusted-contract-object';

export type LocalBridgeRequesterExecutionBoundaryStatus = 'eligible' | 'blocked';

export type LocalBridgeRequesterExecutionReviewState =
  | 'reviewed'
  | 'draft'
  | 'unreviewed'
  | 'stale'
  | 'revoked'
  | 'expired';

export interface LocalBridgeInjectedRequesterExecutionFact {
  schemaVersion: 1;
  factKind: 'local-bridge-injected-requester-execution';
  capabilityId: string;
  requesterId: string;
  requesterVersion: string;
  reviewState: LocalBridgeRequesterExecutionReviewState;
  ownerSurface: string;
  actionId: string;
  bridgeKind: LocalBridgeRequesterOwnershipDescriptor['bridge']['bridgeKind'];
  acceptedEndpoint: string;
  method: LocalBridgeRequesterOwnershipDescriptor['bridge']['method'];
  url: string;
  timeoutMs: number;
  credentialReferenceId?: string;
  supportsExecution: true;
  executable: false;
  dispatchAllowed: false;
  sideEffects: 'none';
  sideEffectBoundary: 'requester-execution-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
  reviewedAt?: number;
  expiresAt?: number;
  stale?: boolean;
}

export interface LocalBridgeRequesterExecutionBoundaryInput {
  ownershipDecision?: LocalBridgeRequesterOwnershipDecision | null;
  dryRunTransportDecision?: LocalBridgeDryRunTransportHarnessDecision | null;
  requesterExecutionFact?: unknown;
  directRequester?: unknown;
  requesterResult?: unknown;
  now?: number;
}

export type LocalBridgeRequesterExecutionBoundaryBlockReason =
  | 'invalid_input_shape'
  | 'input_extra_field'
  | 'unsafe_input_field'
  | 'ownership_decision_missing'
  | 'ownership_decision_blocked'
  | 'ownership_descriptor_missing'
  | 'ownership_boundary_mismatch'
  | 'dry_run_decision_missing'
  | 'dry_run_decision_blocked'
  | 'dry_run_metadata_missing'
  | 'dry_run_boundary_mismatch'
  | 'dry_run_metadata_mismatch'
  | 'requester_fact_missing'
  | 'requester_fact_invalid'
  | 'requester_fact_not_reviewed'
  | 'requester_fact_stale'
  | 'requester_fact_revoked'
  | 'requester_fact_expired'
  | 'requester_fact_mismatch'
  | 'owner_mismatch'
  | 'capability_mismatch'
  | 'bridge_mismatch'
  | 'transport_mismatch'
  | 'credential_reference_mismatch'
  | 'direct_requester_forbidden'
  | 'requester_result_forbidden'
  | 'forged_live_execution_flag'
  | 'requester_fact_extra_field'
  | 'non_local_endpoint'
  | 'endpoint_binding_mismatch'
  | 'schemeless_url_ambiguous'
  | 'secret_bearing_url'
  | 'token_shaped_identifier'
  | 'raw_secret_material';

export interface LocalBridgeRequesterExecutionBoundaryBlocker {
  code: LocalBridgeRequesterExecutionBoundaryBlockReason;
  detail: string;
  field?: string;
}

type LocalBridgeRequesterExecutionBoundaryTrustedBlocker =
  LocalBridgeRequesterExecutionBoundaryBlocker & RuntimeTrustedContractObject;

export interface LocalBridgeRequesterExecutionBoundaryMetadata {
  schemaVersion: 1;
  metadataKind: 'local-bridge-requester-execution-boundary';
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
    bridgeKind: LocalBridgeRequesterOwnershipDescriptor['bridge']['bridgeKind'];
    acceptedEndpoint: string;
  };
  transport: {
    method: LocalBridgeRequesterOwnershipDescriptor['bridge']['method'];
    url: string;
    timeoutMs: number;
  };
  credentialReferenceId?: string;
  dryRunResultId?: string;
  requesterFactReviewState: 'reviewed';
  executionEligible: true;
  canPrepareFutureRequesterInvocation?: true;
  invocationMode?: 'decision-only';
  requesterCallable?: false;
  willInvokeRequester: false;
  willProbeLocalBridge: false;
  willCallProvider: false;
  willMutateStorage: false;
  willStoreCredential?: false;
  dispatchAllowed: false;
  executable: false;
  sideEffects: 'none';
  requesterInvocationBoundary?:
    'local-bridge-requester-execution-boundary-prepares-decision-only-invocation-no-requester-call';
  sideEffectBoundary: 'requester-execution-boundary-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-callback';
}

export interface LocalBridgeRequesterExecutionBoundaryDecision {
  status: LocalBridgeRequesterExecutionBoundaryStatus;
  eligible: boolean;
  metadata?: LocalBridgeRequesterExecutionBoundaryMetadata;
  blockers: readonly LocalBridgeRequesterExecutionBoundaryBlocker[];
  sideEffectBoundary: 'requester-execution-boundary-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-callback';
}

const OWNERSHIP_BOUNDARY = 'ownership-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
const DRY_RUN_BOUNDARY = 'dry-run-transport-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
const REQUESTER_FACT_BOUNDARY = 'requester-execution-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
const EXECUTION_BOUNDARY = 'requester-execution-boundary-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-callback';
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_TIMEOUT_MS = 30_000;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:@/+~-]+$/;
const CREDENTIAL_REFERENCE_PREFIX = 'local-bridge:';
const URL_OR_SCHEME_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const TOKEN_SHAPED_IDENTIFIER_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^gh[pousr]_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^(?:sk|pk|rk)-[a-z0-9_-]{8,}$/i,
  /^eyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}$/i,
] as const;
const SECRET_VALUE_PATTERNS = [
  ...TOKEN_SHAPED_IDENTIFIER_PATTERNS,
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /basic\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:api|app|client|refresh|access|session)[_-]?(?:key|token|secret)\s*[:=]\s*\S+/i,
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
  'session',
  'token',
] as const;
const VALID_REVIEW_STATES = new Set<LocalBridgeRequesterExecutionReviewState>([
  'reviewed',
  'draft',
  'unreviewed',
  'stale',
  'revoked',
  'expired',
]);
const ROOT_INPUT_KEYS = new Set([
  'directRequester',
  'dryRunTransportDecision',
  'now',
  'ownershipDecision',
  'requesterExecutionFact',
  'requesterResult',
]);
const UNSAFE_INPUT_FIELD_PATTERNS = [
  /callback/i,
  /fetch/i,
  /httpclient/i,
  /indexeddb/i,
  /invoke/i,
  /liveaction/i,
  /liveexecution/i,
  /localstorage/i,
  /onresult/i,
  /requester/i,
  /request\b/i,
  /result/i,
  /sessionstorage/i,
  /socket/i,
  /storage/i,
  /transport/i,
  /websocket/i,
  /xhr/i,
] as const;
const OWNERSHIP_DECISION_KEYS = new Set([
  'blockers',
  'descriptor',
  'owned',
  'sideEffectBoundary',
  'status',
]);
const OWNERSHIP_DESCRIPTOR_KEYS = new Set([
  'bridge',
  'capability',
  'credentialReference',
  'descriptorKind',
  'dispatchAllowed',
  'executable',
  'owner',
  'schemaVersion',
  'sideEffectBoundary',
  'sideEffects',
]);
const OWNERSHIP_BRIDGE_KEYS = new Set(['acceptedEndpoint', 'bridgeKind', 'method', 'timeoutMs', 'url']);
const DRY_RUN_DECISION_KEYS = new Set([
  'accepted',
  'blockers',
  'metadata',
  'sideEffectBoundary',
  'status',
]);
const DRY_RUN_METADATA_KEYS = new Set([
  'bridge',
  'capability',
  'credentialReferenceId',
  'dispatchAllowed',
  'executable',
  'metadataKind',
  'owner',
  'resultId',
  'schemaVersion',
  'sideEffectBoundary',
  'sideEffects',
  'transport',
]);
const CAPABILITY_KEYS = new Set(['id', 'requesterId', 'requesterVersion']);
const OWNER_KEYS = new Set(['actionId', 'ownerSurface']);
const DRY_RUN_BRIDGE_KEYS = new Set(['acceptedEndpoint', 'bridgeKind']);
const TRANSPORT_KEYS = new Set(['method', 'timeoutMs', 'url']);
const CREDENTIAL_REFERENCE_KEYS = new Set([
  'accountId',
  'connectorId',
  'id',
  'kind',
  'providerId',
  'schemaVersion',
  'storageOwner',
]);
const REQUESTER_EXECUTION_FACT_KEYS = new Set([
  'schemaVersion',
  'factKind',
  'capabilityId',
  'requesterId',
  'requesterVersion',
  'reviewState',
  'ownerSurface',
  'actionId',
  'bridgeKind',
  'acceptedEndpoint',
  'method',
  'url',
  'timeoutMs',
  'credentialReferenceId',
  'supportsExecution',
  'executable',
  'dispatchAllowed',
  'sideEffects',
  'sideEffectBoundary',
  'reviewedAt',
  'expiresAt',
  'stale',
]);

function blocker(
  code: LocalBridgeRequesterExecutionBoundaryBlockReason,
  detail: string,
  field?: string,
): LocalBridgeRequesterExecutionBoundaryTrustedBlocker {
  return createRuntimeTrustedContractObject([
    ['code', code],
    ['detail', detail],
    ['field', field],
  ]) as LocalBridgeRequesterExecutionBoundaryTrustedBlocker;
}

function isRecord(value: unknown): value is RuntimeTrustedContractObject & Record<string, unknown> {
  return isRuntimeTrustedContractObject(value);
}

const EMPTY_RECORD: Readonly<Record<string, unknown>> = Object.freeze(Object.create(null) as Record<string, unknown>);

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: Set<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringLooksSecretBearing(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function tokenShapedIdentifier(value: string): boolean {
  return TOKEN_SHAPED_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value));
}

function identifierLooksUrlOrSchemeShaped(value: string): boolean {
  return URL_OR_SCHEME_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function safeBaseIdentifier(value: unknown): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) return undefined;
  if (
    normalized.length > MAX_IDENTIFIER_LENGTH
    || !SAFE_IDENTIFIER_PATTERN.test(normalized)
    || tokenShapedIdentifier(normalized)
    || stringLooksSecretBearing(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function safeIdentifier(value: unknown): string | undefined {
  const normalized = safeBaseIdentifier(value);
  if (!normalized || identifierLooksUrlOrSchemeShaped(normalized)) return undefined;
  return normalized;
}

function safeCredentialReferenceIdentifier(value: unknown): string | undefined {
  const normalized = safeBaseIdentifier(value);
  if (!normalized) return undefined;
  if (identifierLooksUrlOrSchemeShaped(normalized) && !normalized.startsWith(CREDENTIAL_REFERENCE_PREFIX)) {
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

function absoluteHttpUrl(value: unknown): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized === '::1' || normalized === '[::1]') return true;
  const parts = normalized.split('.');
  return parts.length === 4
    && parts[0] === '127'
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function localBridgeHttpUrl(value: unknown): string | undefined {
  const normalized = absoluteHttpUrl(value);
  if (!normalized) return undefined;
  const url = new URL(normalized);
  if (!isLoopbackHostname(url.hostname)) return undefined;
  return normalized;
}

function exactLoopbackHttpUrl(value: unknown): string | undefined {
  const normalized = localBridgeHttpUrl(value);
  if (!normalized) return undefined;
  const url = new URL(normalized);
  if (url.username || url.password || url.search || url.hash) return undefined;
  return normalized;
}

function sameOriginHealthProbe(endpoint: string, probeUrl: string): boolean {
  try {
    const endpointUrl = new URL(endpoint);
    const probe = new URL(probeUrl);
    return endpointUrl.origin === probe.origin
      && probe.pathname === '/health'
      && !probe.search
      && !probe.hash
      && !probe.username
      && !probe.password;
  } catch {
    return false;
  }
}

function endpointAndProbeAreBound(endpoint: unknown, probeUrl: unknown): boolean {
  const acceptedEndpoint = exactLoopbackHttpUrl(endpoint);
  const transportUrl = exactLoopbackHttpUrl(probeUrl);
  return acceptedEndpoint !== undefined
    && transportUrl !== undefined
    && sameOriginHealthProbe(acceptedEndpoint, transportUrl);
}

function urlHasSecretMaterial(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return true;
    for (const [key, paramValue] of url.searchParams.entries()) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (SECRET_URL_PARAM_MARKERS.some((marker) => normalizedKey.includes(marker))) return true;
      if (stringLooksSecretBearing(paramValue)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function valueHasSecretMaterial(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') {
    const maybeUrl = absoluteHttpUrl(value);
    return stringLooksSecretBearing(value) || (maybeUrl !== undefined && urlHasSecretMaterial(maybeUrl));
  }
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => valueHasSecretMaterial(item, seen));
  if (!isRuntimeTrustedContractObject(value)) return true;
  if (seen.has(value)) return false;
  seen.add(value);

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (SECRET_URL_PARAM_MARKERS.some((marker) => normalizedKey === marker || normalizedKey.endsWith(marker))) {
      return true;
    }
    if (valueHasSecretMaterial(nestedValue, seen)) return true;
  }
  return false;
}

function identifiersAreSafe(values: readonly unknown[]): boolean {
  return values.every((value) => value === undefined || safeIdentifier(value) === value);
}

function credentialReferenceIdentifiersAreSafe(values: readonly unknown[]): boolean {
  return values.every((value) => value === undefined || safeCredentialReferenceIdentifier(value) === value);
}

function objectHasUnsafeInputField(value: Record<string, unknown>, allowedKeys: Set<string>): boolean {
  return Object.keys(value).some((key) => {
    if (allowedKeys.has(key)) return false;
    return UNSAFE_INPUT_FIELD_PATTERNS.some((pattern) => pattern.test(key));
  });
}

function emptyBlockers(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function addInputShapeBlockers(
  value: unknown,
  blockers: LocalBridgeRequesterExecutionBoundaryTrustedBlocker[],
): value is LocalBridgeRequesterExecutionBoundaryInput {
  if (!isRecord(value)) {
    blockers.push(blocker('invalid_input_shape', 'Requester execution boundary input must be a bounded metadata object.', 'input'));
    return false;
  }
  if (objectHasUnsafeInputField(value, ROOT_INPUT_KEYS)) {
    blockers.push(blocker('unsafe_input_field', 'Requester execution boundary input cannot carry callback, requester, fetch, socket, storage, transport, or live-action fields.', 'input'));
  }
  if (!hasOnlyKeys(value, ROOT_INPUT_KEYS)) {
    blockers.push(blocker('input_extra_field', 'Requester execution boundary input must use exact root metadata keys only.', 'input'));
  }
  return true;
}

function exactCapabilityShape(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, CAPABILITY_KEYS)
    && identifiersAreSafe([value.id, value.requesterId, value.requesterVersion]);
}

function exactOwnerShape(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, OWNER_KEYS)
    && identifiersAreSafe([value.ownerSurface, value.actionId])
    && value.actionId === 'probe_local_bridge';
}

function exactCredentialReferenceShape(value: unknown): boolean {
  if (value === undefined) return true;
  return isRecord(value)
    && hasOnlyKeys(value, CREDENTIAL_REFERENCE_KEYS)
    && value.schemaVersion === 1
    && value.kind === 'local-bridge'
    && value.storageOwner === 'local-bridge'
    && credentialReferenceIdentifiersAreSafe([
      value.id,
    ])
    && identifiersAreSafe([
      value.storageOwner,
      value.providerId,
      value.connectorId,
      value.accountId,
    ]);
}

function exactOwnershipDescriptorShape(value: unknown): value is LocalBridgeRequesterOwnershipDescriptor {
  if (!isRecord(value) || !hasOnlyKeys(value, OWNERSHIP_DESCRIPTOR_KEYS)) return false;
  const bridge = value.bridge;
  return value.schemaVersion === 1
    && value.descriptorKind === 'local-bridge-requester-ownership'
    && exactCapabilityShape(value.capability)
    && exactOwnerShape(value.owner)
    && isRecord(bridge)
    && hasOnlyKeys(bridge, OWNERSHIP_BRIDGE_KEYS)
    && identifiersAreSafe([bridge.bridgeKind])
    && typeof bridge.acceptedEndpoint === 'string'
    && typeof bridge.url === 'string'
    && bridge.method === 'GET'
    && isSafeTimeout(bridge.timeoutMs)
    && endpointAndProbeAreBound(bridge.acceptedEndpoint, bridge.url)
    && exactLoopbackHttpUrl(bridge.acceptedEndpoint) === bridge.acceptedEndpoint
    && exactLoopbackHttpUrl(bridge.url) === bridge.url
    && !urlHasSecretMaterial(bridge.acceptedEndpoint)
    && !urlHasSecretMaterial(bridge.url)
    && exactCredentialReferenceShape(value.credentialReference)
    && value.executable === false
    && value.dispatchAllowed === false
    && value.sideEffects === 'none'
    && value.sideEffectBoundary === OWNERSHIP_BOUNDARY;
}

function exactDryRunMetadataShape(value: unknown): value is LocalBridgeDryRunTransportMetadata {
  if (!isRecord(value) || !hasOnlyKeys(value, DRY_RUN_METADATA_KEYS)) return false;
  const bridge = value.bridge;
  const transport = value.transport;
  return value.schemaVersion === 1
    && value.metadataKind === 'local-bridge-dry-run-transport'
    && exactCapabilityShape(value.capability)
    && exactOwnerShape(value.owner)
    && isRecord(bridge)
    && hasOnlyKeys(bridge, DRY_RUN_BRIDGE_KEYS)
    && identifiersAreSafe([bridge.bridgeKind])
    && isRecord(transport)
    && hasOnlyKeys(transport, TRANSPORT_KEYS)
    && typeof bridge.acceptedEndpoint === 'string'
    && typeof transport.url === 'string'
    && transport.method === 'GET'
    && isSafeTimeout(transport.timeoutMs)
    && endpointAndProbeAreBound(bridge.acceptedEndpoint, transport.url)
    && exactLoopbackHttpUrl(bridge.acceptedEndpoint) === bridge.acceptedEndpoint
    && exactLoopbackHttpUrl(transport.url) === transport.url
    && !urlHasSecretMaterial(bridge.acceptedEndpoint)
    && !urlHasSecretMaterial(transport.url)
    && credentialReferenceIdentifiersAreSafe([value.credentialReferenceId])
    && identifiersAreSafe([value.resultId])
    && value.dispatchAllowed === false
    && value.executable === false
    && value.sideEffects === 'none'
    && value.sideEffectBoundary === DRY_RUN_BOUNDARY;
}

function isRequesterExecutionFact(value: unknown): value is LocalBridgeInjectedRequesterExecutionFact {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => !REQUESTER_EXECUTION_FACT_KEYS.has(key))) return false;
  return value.schemaVersion === 1
    && value.factKind === 'local-bridge-injected-requester-execution'
    && typeof value.capabilityId === 'string'
    && typeof value.requesterId === 'string'
    && typeof value.requesterVersion === 'string'
    && typeof value.reviewState === 'string'
    && VALID_REVIEW_STATES.has(value.reviewState as LocalBridgeRequesterExecutionReviewState)
    && typeof value.ownerSurface === 'string'
    && typeof value.actionId === 'string'
    && typeof value.bridgeKind === 'string'
    && typeof value.acceptedEndpoint === 'string'
    && value.method === 'GET'
    && typeof value.url === 'string'
    && isSafeTimeout(value.timeoutMs)
    && (value.credentialReferenceId === undefined || typeof value.credentialReferenceId === 'string')
    && value.supportsExecution === true
    && value.executable === false
    && value.dispatchAllowed === false
    && value.sideEffects === 'none'
    && value.sideEffectBoundary === REQUESTER_FACT_BOUNDARY
    && isOptionalTimestamp(value.reviewedAt)
    && isOptionalTimestamp(value.expiresAt)
    && (value.stale === undefined || typeof value.stale === 'boolean');
}

function requesterFactIdentifiersAreSafe(fact: LocalBridgeInjectedRequesterExecutionFact): boolean {
  return identifiersAreSafe([
    fact.capabilityId,
    fact.requesterId,
    fact.requesterVersion,
    fact.ownerSurface,
    fact.actionId,
    fact.bridgeKind,
  ])
    && credentialReferenceIdentifiersAreSafe([fact.credentialReferenceId])
    && fact.actionId === 'probe_local_bridge';
}

function requesterFactUrlsAreSafe(fact: LocalBridgeInjectedRequesterExecutionFact): boolean {
  const endpoint = exactLoopbackHttpUrl(fact.acceptedEndpoint);
  const url = exactLoopbackHttpUrl(fact.url);
  return endpoint === fact.acceptedEndpoint
    && url === fact.url
    && endpointAndProbeAreBound(endpoint, url)
    && !urlHasSecretMaterial(fact.acceptedEndpoint)
    && !urlHasSecretMaterial(fact.url);
}

function addOwnershipBlockers(
  decision: LocalBridgeRequesterOwnershipDecision | null | undefined,
  blockers: LocalBridgeRequesterExecutionBoundaryTrustedBlocker[],
): LocalBridgeRequesterOwnershipDescriptor | undefined {
  if (!decision) {
    blockers.push(blocker('ownership_decision_missing', 'Requester execution boundary requires an ownership decision.', 'ownershipDecision'));
    return undefined;
  }
  if (!isRecord(decision) || !hasOnlyKeys(decision, OWNERSHIP_DECISION_KEYS)) {
    blockers.push(blocker('ownership_boundary_mismatch', 'Ownership decision must be exact-shape metadata built by the trusted contract object boundary.', 'ownershipDecision'));
    return undefined;
  }
  if (decision.status !== 'owned' || decision.owned !== true) {
    blockers.push(blocker('ownership_decision_blocked', 'Only owned requester decisions can reach the execution boundary.', 'ownershipDecision.status'));
  }
  if (!emptyBlockers(decision.blockers)) {
    blockers.push(blocker('ownership_decision_blocked', 'Ownership decision must not carry blockers into the execution boundary.', 'ownershipDecision.blockers'));
  }
  if (decision.sideEffectBoundary !== OWNERSHIP_BOUNDARY) {
    blockers.push(blocker('ownership_boundary_mismatch', 'Ownership decision must remain metadata-only and no-side-effect.', 'ownershipDecision.sideEffectBoundary'));
  }
  if (!decision.descriptor) {
    blockers.push(blocker('ownership_descriptor_missing', 'Requester execution boundary requires an ownership descriptor.', 'ownershipDecision.descriptor'));
    return undefined;
  }
  const descriptor = decision.descriptor;
  if (
    !exactOwnershipDescriptorShape(descriptor)
  ) {
    blockers.push(blocker('ownership_boundary_mismatch', 'Ownership descriptor must remain exact-shape inert loopback health-probe metadata.', 'ownershipDecision.descriptor'));
  }
  return descriptor;
}

function addDryRunBlockers(
  decision: LocalBridgeDryRunTransportHarnessDecision | null | undefined,
  blockers: LocalBridgeRequesterExecutionBoundaryTrustedBlocker[],
): LocalBridgeDryRunTransportMetadata | undefined {
  if (!decision) {
    blockers.push(blocker('dry_run_decision_missing', 'Requester execution boundary requires an accepted dry-run transport decision.', 'dryRunTransportDecision'));
    return undefined;
  }
  if (!isRecord(decision) || !hasOnlyKeys(decision, DRY_RUN_DECISION_KEYS)) {
    blockers.push(blocker('dry_run_boundary_mismatch', 'Dry-run transport decision must be exact-shape metadata built by the trusted contract object boundary.', 'dryRunTransportDecision'));
    return undefined;
  }
  if (!Array.isArray(decision.blockers)) {
    blockers.push(blocker('dry_run_boundary_mismatch', 'Dry-run transport decision must carry a blockers array before status is trusted.', 'dryRunTransportDecision.blockers'));
    return undefined;
  }
  if (decision.status !== 'accepted' || decision.accepted !== true || decision.blockers.length > 0) {
    blockers.push(blocker('dry_run_decision_blocked', 'Only accepted dry-run transport decisions can reach the execution boundary.', 'dryRunTransportDecision.status'));
  }
  if (!emptyBlockers(decision.blockers)) {
    blockers.push(blocker('dry_run_decision_blocked', 'Dry-run transport decision must not carry blockers into the execution boundary.', 'dryRunTransportDecision.blockers'));
  }
  if (decision.sideEffectBoundary !== DRY_RUN_BOUNDARY) {
    blockers.push(blocker('dry_run_boundary_mismatch', 'Dry-run transport decision must remain metadata-only and no-side-effect.', 'dryRunTransportDecision.sideEffectBoundary'));
  }
  if (!decision.metadata) {
    blockers.push(blocker('dry_run_metadata_missing', 'Requester execution boundary requires dry-run transport metadata.', 'dryRunTransportDecision.metadata'));
    return undefined;
  }
  const metadata = decision.metadata;
  if (
    !exactDryRunMetadataShape(metadata)
  ) {
    blockers.push(blocker('dry_run_boundary_mismatch', 'Dry-run transport metadata must remain exact-shape inert loopback health-probe metadata.', 'dryRunTransportDecision.metadata'));
  }
  return metadata;
}

function compareOwnershipAndDryRun(
  descriptor: LocalBridgeRequesterOwnershipDescriptor,
  metadata: LocalBridgeDryRunTransportMetadata,
  blockers: LocalBridgeRequesterExecutionBoundaryTrustedBlocker[],
): void {
  if (
    descriptor.owner.ownerSurface !== metadata.owner.ownerSurface
    || descriptor.owner.actionId !== metadata.owner.actionId
  ) {
    blockers.push(blocker('owner_mismatch', 'Dry-run metadata owner must match requester ownership exactly.', 'dryRunTransportDecision.metadata.owner'));
  }
  if (
    descriptor.capability.id !== metadata.capability.id
    || descriptor.capability.requesterId !== metadata.capability.requesterId
    || descriptor.capability.requesterVersion !== metadata.capability.requesterVersion
  ) {
    blockers.push(blocker('capability_mismatch', 'Dry-run metadata capability must match requester ownership exactly.', 'dryRunTransportDecision.metadata.capability'));
  }
  if (
    descriptor.bridge.bridgeKind !== metadata.bridge.bridgeKind
    || descriptor.bridge.acceptedEndpoint !== metadata.bridge.acceptedEndpoint
  ) {
    blockers.push(blocker('bridge_mismatch', 'Dry-run metadata bridge must match requester ownership exactly.', 'dryRunTransportDecision.metadata.bridge'));
  }
  if (
    descriptor.bridge.method !== metadata.transport.method
    || descriptor.bridge.url !== metadata.transport.url
    || descriptor.bridge.timeoutMs !== metadata.transport.timeoutMs
  ) {
    blockers.push(blocker('transport_mismatch', 'Dry-run metadata transport must match requester ownership exactly.', 'dryRunTransportDecision.metadata.transport'));
  }
  if (descriptor.credentialReference?.id !== metadata.credentialReferenceId) {
    blockers.push(blocker('credential_reference_mismatch', 'Dry-run credential reference id must match requester ownership exactly.', 'dryRunTransportDecision.metadata.credentialReferenceId'));
  }
}

function addRequesterFactBlockers(
  value: unknown,
  metadata: LocalBridgeDryRunTransportMetadata | undefined,
  now: number,
  blockers: LocalBridgeRequesterExecutionBoundaryTrustedBlocker[],
): LocalBridgeInjectedRequesterExecutionFact | undefined {
  if (!value) {
    blockers.push(blocker('requester_fact_missing', 'Requester execution boundary requires a reviewed injected requester fact.', 'requesterExecutionFact'));
    return undefined;
  }
  if (!isRequesterExecutionFact(value)) {
    const extraField = isRecord(value) && Object.keys(value).some((key) => !REQUESTER_EXECUTION_FACT_KEYS.has(key));
    blockers.push(blocker(
      extraField ? 'requester_fact_extra_field' : 'requester_fact_invalid',
      extraField
        ? 'Injected requester fact must be exact-shape metadata without callback, fetch, socket, or result fields.'
        : 'Injected requester fact failed the execution-boundary contract.',
      'requesterExecutionFact',
    ));
    return undefined;
  }

  const fact = value;
  if (valueHasSecretMaterial(fact)) {
    blockers.push(blocker('raw_secret_material', 'Injected requester facts must not carry secret-bearing values.', 'requesterExecutionFact'));
  }
  if (!requesterFactIdentifiersAreSafe(fact)) {
    blockers.push(blocker('token_shaped_identifier', 'Injected requester identifiers must be bounded opaque metadata, not token-shaped values.', 'requesterExecutionFact'));
  }
  if (!requesterFactUrlsAreSafe(fact)) {
    const endpoint = absoluteHttpUrl(fact.acceptedEndpoint);
    const url = absoluteHttpUrl(fact.url);
    const localEndpoint = endpoint ? localBridgeHttpUrl(endpoint) : undefined;
    const localUrl = url ? localBridgeHttpUrl(url) : undefined;
    blockers.push(blocker(
      !endpoint || !url
        ? 'schemeless_url_ambiguous'
        : !localEndpoint || !localUrl
          ? 'non_local_endpoint'
          : urlHasSecretMaterial(fact.acceptedEndpoint) || urlHasSecretMaterial(fact.url)
            ? 'secret_bearing_url'
            : 'endpoint_binding_mismatch',
      'Injected requester endpoint and URL must be absolute same-origin loopback health-probe metadata without query, fragment, or secret material.',
      'requesterExecutionFact.url',
    ));
  }
  if (fact.reviewState !== 'reviewed') {
    const code: LocalBridgeRequesterExecutionBoundaryBlockReason =
      fact.reviewState === 'stale' ? 'requester_fact_stale'
        : fact.reviewState === 'revoked' ? 'requester_fact_revoked'
          : fact.reviewState === 'expired' ? 'requester_fact_expired'
            : 'requester_fact_not_reviewed';
    blockers.push(blocker(code, 'Injected requester fact must be reviewed and current.', 'requesterExecutionFact.reviewState'));
  }
  if (fact.stale === true) {
    blockers.push(blocker('requester_fact_stale', 'Injected requester fact is marked stale.', 'requesterExecutionFact.stale'));
  }
  if (fact.expiresAt !== undefined && fact.expiresAt <= now) {
    blockers.push(blocker('requester_fact_expired', 'Injected requester fact is expired.', 'requesterExecutionFact.expiresAt'));
  }
  if (!metadata) return fact;

  if (
    fact.ownerSurface !== metadata.owner.ownerSurface
    || fact.actionId !== metadata.owner.actionId
  ) {
    blockers.push(blocker('owner_mismatch', 'Injected requester fact owner must match accepted dry-run metadata exactly.', 'requesterExecutionFact.owner'));
  }
  if (
    fact.capabilityId !== metadata.capability.id
    || fact.requesterId !== metadata.capability.requesterId
    || fact.requesterVersion !== metadata.capability.requesterVersion
  ) {
    blockers.push(blocker('capability_mismatch', 'Injected requester fact capability must match accepted dry-run metadata exactly.', 'requesterExecutionFact.capability'));
  }
  if (
    fact.bridgeKind !== metadata.bridge.bridgeKind
    || fact.acceptedEndpoint !== metadata.bridge.acceptedEndpoint
  ) {
    blockers.push(blocker('bridge_mismatch', 'Injected requester fact bridge must match accepted dry-run metadata exactly.', 'requesterExecutionFact.bridge'));
  }
  if (
    fact.method !== metadata.transport.method
    || fact.url !== metadata.transport.url
    || fact.timeoutMs !== metadata.transport.timeoutMs
  ) {
    blockers.push(blocker('transport_mismatch', 'Injected requester fact transport must match accepted dry-run metadata exactly.', 'requesterExecutionFact.transport'));
  }
  if (fact.credentialReferenceId !== metadata.credentialReferenceId) {
    blockers.push(blocker('credential_reference_mismatch', 'Injected requester fact credential reference id must match accepted dry-run metadata exactly.', 'requesterExecutionFact.credentialReferenceId'));
  }

  return fact;
}

function addLiveClaimBlockers(
  input: LocalBridgeRequesterExecutionBoundaryInput,
  blockers: LocalBridgeRequesterExecutionBoundaryTrustedBlocker[],
): void {
  if (input.directRequester !== undefined) {
    blockers.push(blocker('direct_requester_forbidden', 'Requester callbacks cannot be passed or invoked by this execution boundary.', 'directRequester'));
  }
  if (input.requesterResult !== undefined) {
    blockers.push(blocker('requester_result_forbidden', 'Requester execution results are forbidden until an executable requester boundary exists.', 'requesterResult'));
  }
  if (valueHasSecretMaterial(input.requesterResult)) {
    blockers.push(blocker('raw_secret_material', 'Requester result payloads must not carry secret-bearing material.', 'requesterResult'));
  }
  const maybeFact: Readonly<Record<string, unknown>> = isRecord(input.requesterExecutionFact)
    ? input.requesterExecutionFact
    : EMPTY_RECORD;
  if (
    maybeFact.executed === true
    || maybeFact.probed === true
    || maybeFact.live === true
    || maybeFact.liveExecution === true
    || maybeFact.fetchAllowed === true
    || maybeFact.socketAllowed === true
  ) {
    blockers.push(blocker('forged_live_execution_flag', 'Injected requester fact cannot claim prior execution, probe, or live network flags.', 'requesterExecutionFact'));
  }
  const maybeResult: Readonly<Record<string, unknown>> = isRecord(input.requesterResult)
    ? input.requesterResult
    : EMPTY_RECORD;
  if (
    maybeResult.executed === true
    || maybeResult.probed === true
    || maybeResult.live === true
    || maybeResult.liveExecution === true
    || maybeResult.requesterCalled === true
    || maybeResult.invokedRequester === true
    || maybeResult.willInvokeRequester === true
    || maybeResult.willProbeLocalBridge === true
    || maybeResult.willCallProvider === true
    || maybeResult.willMutateStorage === true
    || maybeResult.willStoreCredential === true
    || maybeResult.executable === true
  ) {
    blockers.push(blocker('forged_live_execution_flag', 'Requester result cannot claim prior execution, probe, or live side effects.', 'requesterResult'));
  }
}

function addDirectRequesterBlocker(
  blockers: LocalBridgeRequesterExecutionBoundaryTrustedBlocker[],
): void {
  blockers.push(blocker(
    'direct_requester_forbidden',
    'Requester callbacks cannot be passed or invoked by this execution boundary.',
    'directRequester',
  ));
}

function buildMetadata(
  metadata: LocalBridgeDryRunTransportMetadata,
): LocalBridgeRequesterExecutionBoundaryMetadata {
  const capability = createRuntimeTrustedContractObject([
    ['id', metadata.capability.id],
    ['requesterId', metadata.capability.requesterId],
    ['requesterVersion', metadata.capability.requesterVersion],
  ]);
  const owner = createRuntimeTrustedContractObject([
    ['ownerSurface', metadata.owner.ownerSurface],
    ['actionId', metadata.owner.actionId],
  ]);
  const bridge = createRuntimeTrustedContractObject([
    ['bridgeKind', metadata.bridge.bridgeKind],
    ['acceptedEndpoint', metadata.bridge.acceptedEndpoint],
  ]);
  const transport = createRuntimeTrustedContractObject([
    ['method', metadata.transport.method],
    ['url', metadata.transport.url],
    ['timeoutMs', metadata.transport.timeoutMs],
  ]);

  return createRuntimeTrustedContractObject([
    ['schemaVersion', 1],
    ['metadataKind', 'local-bridge-requester-execution-boundary'],
    ['capability', capability],
    ['owner', owner],
    ['bridge', bridge],
    ['transport', transport],
    ['credentialReferenceId', metadata.credentialReferenceId],
    ['dryRunResultId', metadata.resultId],
    ['requesterFactReviewState', 'reviewed'],
    ['executionEligible', true],
    ['canPrepareFutureRequesterInvocation', true],
    ['invocationMode', 'decision-only'],
    ['requesterCallable', false],
    ['willInvokeRequester', false],
    ['willProbeLocalBridge', false],
    ['willCallProvider', false],
    ['willMutateStorage', false],
    ['willStoreCredential', false],
    ['dispatchAllowed', false],
    ['executable', false],
    ['sideEffects', 'none'],
    [
      'requesterInvocationBoundary',
      'local-bridge-requester-execution-boundary-prepares-decision-only-invocation-no-requester-call',
    ],
    ['sideEffectBoundary', EXECUTION_BOUNDARY],
  ]) as unknown as LocalBridgeRequesterExecutionBoundaryMetadata;
}

function buildDecision(
  eligible: boolean,
  metadata: LocalBridgeRequesterExecutionBoundaryMetadata | undefined,
  blockers: readonly LocalBridgeRequesterExecutionBoundaryTrustedBlocker[],
): LocalBridgeRequesterExecutionBoundaryDecision {
  return createRuntimeTrustedContractObject([
    ['status', eligible ? 'eligible' : 'blocked'],
    ['eligible', eligible],
    ['metadata', metadata as RuntimeTrustedContractObject | undefined],
    ['blockers', blockers],
    ['sideEffectBoundary', EXECUTION_BOUNDARY],
  ]) as unknown as LocalBridgeRequesterExecutionBoundaryDecision;
}

export function evaluateLocalBridgeRequesterExecutionBoundary(
  input: LocalBridgeRequesterExecutionBoundaryInput = {},
): LocalBridgeRequesterExecutionBoundaryDecision {
  const blockers: LocalBridgeRequesterExecutionBoundaryTrustedBlocker[] = [];
  if (!addInputShapeBlockers(input, blockers)) {
    return buildDecision(false, undefined, blockers);
  }
  if (input.directRequester !== undefined) {
    addDirectRequesterBlocker(blockers);
    return buildDecision(false, undefined, blockers);
  }
  if (valueHasSecretMaterial(input)) {
    blockers.push(blocker('raw_secret_material', 'Requester execution boundary input must not carry secret-bearing values.', 'input'));
  }

  const boundaryInput = input;
  const ownershipDescriptor = addOwnershipBlockers(boundaryInput.ownershipDecision, blockers);
  const dryRunMetadata = addDryRunBlockers(boundaryInput.dryRunTransportDecision, blockers);

  if (ownershipDescriptor && dryRunMetadata) {
    compareOwnershipAndDryRun(ownershipDescriptor, dryRunMetadata, blockers);
  }
  const runtimeNow = Date.now();
  const effectiveNow = typeof boundaryInput.now === 'number' && boundaryInput.now > runtimeNow
    ? boundaryInput.now
    : runtimeNow;
  addRequesterFactBlockers(boundaryInput.requesterExecutionFact, dryRunMetadata, effectiveNow, blockers);
  addLiveClaimBlockers(boundaryInput, blockers);

  const eligible = blockers.length === 0 && dryRunMetadata !== undefined;
  return buildDecision(eligible, eligible ? buildMetadata(dryRunMetadata) : undefined, blockers);
}
