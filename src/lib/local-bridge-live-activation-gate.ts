import type {
  LocalBridgeRequesterExecutionBoundaryDecision,
  LocalBridgeRequesterExecutionBoundaryMetadata,
} from './local-bridge-requester-execution-boundary';
import type {
  LocalBridgeRequesterInvocationImplementationDecision,
} from './local-bridge-requester-invocation-implementation-boundary';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractObject,
} from './runtime-trusted-contract-object';

export type LocalBridgeLiveActivationGateStatus = 'ready' | 'blocked';

export type LocalBridgeLiveActivationGateReason =
  | 'live_activation_gate_ready'
  | 'execution_boundary_missing'
  | 'execution_boundary_not_ready'
  | 'execution_boundary_invalid'
  | 'invocation_boundary_missing'
  | 'invocation_boundary_not_ready'
  | 'invocation_boundary_invalid'
  | 'invocation_executable_contract_missing'
  | 'invocation_executable_contract_invalid'
  | 'invocation_executable_contract_mismatch'
  | 'boundary_identity_mismatch'
  | 'activation_facts_missing'
  | 'activation_facts_invalid'
  | 'endpoint_count_invalid'
  | 'endpoint_provenance_invalid'
  | 'endpoint_drift_detected'
  | 'operation_kind_invalid'
  | 'transport_request_missing'
  | 'transport_request_invalid'
  | 'transport_request_mismatch'
  | 'user_approval_missing'
  | 'user_approval_invalid'
  | 'user_approval_not_granted'
  | 'dry_run_proof_missing'
  | 'direct_requester_forbidden'
  | 'live_transport_forbidden'
  | 'live_result_forbidden'
  | 'raw_secret_material';

export type LocalBridgeLiveActivationOperationKind = 'probe-local-bridge-health-read';

export interface LocalBridgeLiveActivationApprovalFact {
  scope: 'activate-reviewed-local-bridge-requester';
  granted: boolean;
  acknowledgedPlanOnly: boolean;
}

export interface LocalBridgeLiveActivationFacts {
  contract: 'local-bridge-live-activation-facts-v1';
  capabilityId: string;
  requesterId: string;
  requesterVersion: string;
  ownerSurface: string;
  actionId: string;
  bridgeKind: string;
  reviewedAcceptedEndpoints: readonly string[];
  operationKind: LocalBridgeLiveActivationOperationKind;
  credentialReferenceId?: string;
  dryRunResultId?: string;
  requesterImplementationId: string;
  requesterPackageVersion: string;
  reviewState: 'reviewed';
  userApproval: LocalBridgeLiveActivationApprovalFact;
  executable: false;
  requesterCallable: false;
  dispatchAllowed: false;
  willInvokeRequester: false;
  willProbeLocalBridge: false;
  willCallProvider: false;
  willMutateStorage: false;
  willStoreCredential: false;
  sideEffects: 'none';
  sideEffectBoundary: 'local-bridge-live-activation-facts-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials';
}

export interface LocalBridgeLiveActivationTransportRequest {
  method: 'GET';
  url: string;
  timeoutMs: number;
}

export interface LocalBridgeLiveActivationGateInput {
  executionBoundary?: LocalBridgeRequesterExecutionBoundaryDecision | null;
  invocationBoundary?: LocalBridgeRequesterInvocationImplementationDecision | null;
  activationFacts?: unknown;
  transportRequest?: unknown;
  requester?: unknown;
  transport?: unknown;
  requesterResult?: unknown;
}

export interface LocalBridgeLiveActivationPlan {
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
    bridgeKind: string;
    acceptedEndpoint: string;
  };
  operation: {
    kind: LocalBridgeLiveActivationOperationKind;
    method: 'GET';
    url: string;
    timeoutMs: number;
  };
  credentialReferenceId?: string;
  dryRunResultId?: string;
  requesterImplementationId: string;
  requesterPackageVersion: string;
  requiresUserApprovalBeforeRequest: true;
  executable: false;
  requesterCallable: false;
  dispatchAllowed: false;
  willInvokeRequester: false;
  willProbeLocalBridge: false;
  willCallProvider: false;
  willMutateStorage: false;
  willStoreCredential: false;
  sideEffects: 'none';
  sideEffectBoundary: 'local-bridge-live-activation-gate-plan-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials';
}

export interface LocalBridgeLiveActivationGateDecision {
  status: LocalBridgeLiveActivationGateStatus;
  ready: boolean;
  reason: LocalBridgeLiveActivationGateReason;
  plan?: LocalBridgeLiveActivationPlan;
  requiresUserApprovalBeforeRequest: true;
  executable: false;
  requesterCallable: false;
  dispatchAllowed: false;
  willInvokeRequester: false;
  willProbeLocalBridge: false;
  willCallProvider: false;
  willMutateStorage: false;
  willStoreCredential: false;
  sideEffects: 'none';
  sideEffectBoundary: 'local-bridge-live-activation-gate-plan-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials';
}

interface ParsedActivationFacts {
  capabilityId: string;
  requesterId: string;
  requesterVersion: string;
  ownerSurface: string;
  actionId: string;
  bridgeKind: string;
  reviewedAcceptedEndpoint: string;
  operationKind: LocalBridgeLiveActivationOperationKind;
  credentialReferenceId?: string;
  dryRunResultId?: string;
  requesterImplementationId: string;
  requesterPackageVersion: string;
}

type PreparedRequesterInvocationExecutableContract =
  NonNullable<LocalBridgeRequesterInvocationImplementationDecision['executableContract']>;

const EXECUTION_BOUNDARY =
  'requester-execution-boundary-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-callback' as const;
const INVOCATION_BOUNDARY =
  'pure-local-requester-invocation-implementation-boundary-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call' as const;
const EXECUTABLE_CONTRACT_BOUNDARY =
  'reviewed-injected-local-bridge-requester-executable-contract-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call' as const;
const REQUESTER_INVOCATION_BOUNDARY =
  'local-bridge-requester-execution-boundary-prepares-decision-only-invocation-no-requester-call' as const;
const FACTS_BOUNDARY =
  'local-bridge-live-activation-facts-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials' as const;
const DECISION_BOUNDARY =
  'local-bridge-live-activation-gate-plan-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials' as const;
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_TIMEOUT_MS = 30_000;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const CREDENTIAL_REFERENCE_PREFIX = 'local-bridge:';
const URL_OR_SCHEME_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const TOKEN_VALUE_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^gh[pousr]_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^(?:sk|pk|rk)-[a-z0-9_-]{8,}$/i,
  /^eyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}$/i,
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /basic\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:api|app|bot|client|refresh|access|session)[_-]?(?:key|token|secret)\s*[:=]\s*\S+/i,
  /(?:oauth|authorization)[\s_-]?code\s*[:=]\s*\S+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/i,
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
const ROOT_KEYS = new Set([
  'activationFacts',
  'executionBoundary',
  'invocationBoundary',
  'requester',
  'requesterResult',
  'transport',
  'transportRequest',
]);
const UNSAFE_ROOT_FIELD_PATTERNS = [
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
  /sessionstorage/i,
  /socket/i,
  /storage/i,
  /transport/i,
  /websocket/i,
  /xhr/i,
] as const;
const EXECUTION_DECISION_KEYS = new Set([
  'blockers',
  'eligible',
  'metadata',
  'sideEffectBoundary',
  'status',
]);
const EXECUTION_METADATA_KEYS = new Set([
  'bridge',
  'canPrepareFutureRequesterInvocation',
  'capability',
  'credentialReferenceId',
  'dispatchAllowed',
  'dryRunResultId',
  'executable',
  'executionEligible',
  'invocationMode',
  'metadataKind',
  'owner',
  'requesterCallable',
  'requesterFactReviewState',
  'requesterInvocationBoundary',
  'schemaVersion',
  'sideEffectBoundary',
  'sideEffects',
  'transport',
  'willCallProvider',
  'willInvokeRequester',
  'willMutateStorage',
  'willProbeLocalBridge',
  'willStoreCredential',
]);
const INVOCATION_DECISION_KEYS = new Set([
  'bridge',
  'canPrepareFutureRequesterInvocation',
  'capability',
  'credentialReferenceId',
  'dryRunResultId',
  'executable',
  'executableContract',
  'invocationMode',
  'owner',
  'ready',
  'reason',
  'requesterCallable',
  'requesterImplementationId',
  'requesterPackageVersion',
  'sideEffectBoundary',
  'status',
  'transport',
  'willCallProvider',
  'willInvokeRequester',
  'willMutateStorage',
  'willProbeLocalBridge',
  'willStoreCredential',
]);
const CAPABILITY_KEYS = new Set(['id', 'requesterId', 'requesterVersion']);
const OWNER_KEYS = new Set(['actionId', 'ownerSurface']);
const BRIDGE_KEYS = new Set(['acceptedEndpoint', 'bridgeKind']);
const TRANSPORT_KEYS = new Set(['method', 'timeoutMs', 'url']);
const PREPARED_EXECUTABLE_CONTRACT_KEYS = new Set([
  'bodyRedaction',
  'bridge',
  'capability',
  'contract',
  'credentialReferenceId',
  'dispatchAllowed',
  'dryRunResultId',
  'executable',
  'headersRedaction',
  'injectionMode',
  'owner',
  'requesterCallable',
  'requesterContractId',
  'requesterContractVersion',
  'requesterImplementationId',
  'requesterPackageVersion',
  'requiresExplicitUserApprovalBeforeRequest',
  'resultRedaction',
  'sideEffectBoundary',
  'sideEffects',
  'supportsExecution',
  'transport',
  'willCallProvider',
  'willInvokeRequester',
  'willMutateStorage',
  'willProbeLocalBridge',
  'willStoreCredential',
]);
const FACT_KEYS = new Set([
  'actionId',
  'bridgeKind',
  'capabilityId',
  'contract',
  'credentialReferenceId',
  'dispatchAllowed',
  'dryRunResultId',
  'executable',
  'operationKind',
  'ownerSurface',
  'requesterCallable',
  'requesterId',
  'requesterImplementationId',
  'requesterPackageVersion',
  'requesterVersion',
  'reviewState',
  'reviewedAcceptedEndpoints',
  'sideEffectBoundary',
  'sideEffects',
  'userApproval',
  'willCallProvider',
  'willInvokeRequester',
  'willMutateStorage',
  'willProbeLocalBridge',
  'willStoreCredential',
]);
const APPROVAL_KEYS = new Set(['acknowledgedPlanOnly', 'granted', 'scope']);
const TRANSPORT_REQUEST_KEYS = new Set(['method', 'timeoutMs', 'url']);

function isRecord(value: unknown): value is RuntimeTrustedContractObject & Record<string, unknown> {
  return isRuntimeTrustedContractObject(value);
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: Set<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function hasUnsafeExtraInputKey(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => {
    if (ROOT_KEYS.has(key)) return false;
    return UNSAFE_ROOT_FIELD_PATTERNS.some((pattern) => pattern.test(key));
  });
}

function stringLooksSecretBearing(value: string): boolean {
  return TOKEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
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
  return normalized === 'localhost'
    || normalized === '::1'
    || normalized === '[::1]'
    || /^127(?:\.\d{1,3}){3}$/.test(normalized);
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
  if (typeof value === 'function') return true;
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => valueHasSecretMaterial(item, seen));
  if (!isRuntimeTrustedContractObject(value)) return true;
  if (seen.has(value)) return false;
  seen.add(value);

  return Object.values(value).some((nestedValue) => valueHasSecretMaterial(nestedValue, seen));
}

function isSafeTimeout(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
    && value <= MAX_TIMEOUT_MS;
}

function emptyBlockers(value: unknown): boolean {
  return Array.isArray(value)
    && value.length === 0
    && Object.isFrozen(value);
}

function executionBoundaryIsReady(
  decision: unknown,
): decision is LocalBridgeRequesterExecutionBoundaryDecision & { metadata: LocalBridgeRequesterExecutionBoundaryMetadata } {
  if (!isRecord(decision) || !hasOnlyKeys(decision, EXECUTION_DECISION_KEYS)) return false;
  const metadata = decision.metadata;
  if (
    decision.status !== 'eligible'
    || decision.eligible !== true
    || !emptyBlockers(decision.blockers)
    || decision.sideEffectBoundary !== EXECUTION_BOUNDARY
    || !isRecord(metadata)
    || !hasOnlyKeys(metadata, EXECUTION_METADATA_KEYS)
  ) {
    return false;
  }
  const capability = metadata.capability;
  const owner = metadata.owner;
  const bridge = metadata.bridge;
  const transport = metadata.transport;
  if (
    !isRecord(capability)
    || !hasOnlyKeys(capability, CAPABILITY_KEYS)
    || !isRecord(owner)
    || !hasOnlyKeys(owner, OWNER_KEYS)
    || !isRecord(bridge)
    || !hasOnlyKeys(bridge, BRIDGE_KEYS)
    || !isRecord(transport)
    || !hasOnlyKeys(transport, TRANSPORT_KEYS)
  ) {
    return false;
  }
  const acceptedEndpoint = exactLoopbackHttpUrl(bridge.acceptedEndpoint);
  const transportUrl = exactLoopbackHttpUrl(transport.url);
  if (!acceptedEndpoint || !transportUrl) return false;
  return metadata.schemaVersion === 1
    && metadata.metadataKind === 'local-bridge-requester-execution-boundary'
    && safeIdentifier(capability.id) !== undefined
    && safeIdentifier(capability.requesterId) !== undefined
    && safeIdentifier(capability.requesterVersion) !== undefined
    && safeIdentifier(owner.ownerSurface) !== undefined
    && safeIdentifier(owner.actionId) !== undefined
    && safeIdentifier(bridge.bridgeKind) !== undefined
    && acceptedEndpoint === bridge.acceptedEndpoint
    && transport.method === 'GET'
    && transportUrl === transport.url
    && isSafeTimeout(transport.timeoutMs)
    && sameOriginHealthProbe(acceptedEndpoint, transportUrl)
    && (metadata.credentialReferenceId === undefined
      || safeCredentialReferenceIdentifier(metadata.credentialReferenceId) !== undefined)
    && (metadata.dryRunResultId === undefined || safeIdentifier(metadata.dryRunResultId) !== undefined)
    && metadata.requesterFactReviewState === 'reviewed'
    && metadata.executionEligible === true
    && (metadata.canPrepareFutureRequesterInvocation === undefined
      || metadata.canPrepareFutureRequesterInvocation === true)
    && (metadata.invocationMode === undefined || metadata.invocationMode === 'decision-only')
    && (metadata.requesterCallable === undefined || metadata.requesterCallable === false)
    && metadata.willInvokeRequester === false
    && metadata.willProbeLocalBridge === false
    && metadata.willCallProvider === false
    && metadata.willMutateStorage === false
    && (metadata.willStoreCredential === undefined || metadata.willStoreCredential === false)
    && metadata.dispatchAllowed === false
    && metadata.executable === false
    && metadata.sideEffects === 'none'
    && (metadata.requesterInvocationBoundary === undefined
      || metadata.requesterInvocationBoundary === REQUESTER_INVOCATION_BOUNDARY)
    && metadata.sideEffectBoundary === EXECUTION_BOUNDARY
    && !urlHasSecretMaterial(acceptedEndpoint)
    && !urlHasSecretMaterial(transportUrl);
}

function invocationBoundaryIsReady(
  decision: unknown,
): decision is LocalBridgeRequesterInvocationImplementationDecision {
  if (!isRecord(decision) || !hasOnlyKeys(decision, INVOCATION_DECISION_KEYS)) return false;
  const capability = decision.capability;
  const owner = decision.owner;
  const bridge = decision.bridge;
  const transport = decision.transport;
  if (
    decision.status !== 'ready'
    || decision.ready !== true
    || decision.reason !== 'requester_invocation_boundary_ready'
    || decision.canPrepareFutureRequesterInvocation !== true
    || decision.invocationMode !== 'decision-only'
    || decision.executable !== false
    || decision.requesterCallable !== false
    || decision.willInvokeRequester !== false
    || decision.willProbeLocalBridge !== false
    || decision.willCallProvider !== false
    || decision.willMutateStorage !== false
    || decision.willStoreCredential !== false
    || decision.sideEffectBoundary !== INVOCATION_BOUNDARY
    || !isRecord(capability)
    || !hasOnlyKeys(capability, CAPABILITY_KEYS)
    || !isRecord(owner)
    || !hasOnlyKeys(owner, OWNER_KEYS)
    || !isRecord(bridge)
    || !hasOnlyKeys(bridge, BRIDGE_KEYS)
    || !isRecord(transport)
    || !hasOnlyKeys(transport, TRANSPORT_KEYS)
  ) {
    return false;
  }
  const acceptedEndpoint = exactLoopbackHttpUrl(bridge.acceptedEndpoint);
  const transportUrl = exactLoopbackHttpUrl(transport.url);
  if (!acceptedEndpoint || !transportUrl) return false;

  return safeIdentifier(capability.id) !== undefined
    && safeIdentifier(capability.requesterId) !== undefined
    && safeIdentifier(capability.requesterVersion) !== undefined
    && safeIdentifier(owner.ownerSurface) !== undefined
    && safeIdentifier(owner.actionId) !== undefined
    && safeIdentifier(bridge.bridgeKind) !== undefined
    && acceptedEndpoint === bridge.acceptedEndpoint
    && transport.method === 'GET'
    && transportUrl === transport.url
    && isSafeTimeout(transport.timeoutMs)
    && sameOriginHealthProbe(acceptedEndpoint, transportUrl)
    && safeIdentifier(decision.requesterImplementationId) !== undefined
    && safeIdentifier(decision.requesterPackageVersion) !== undefined
    && (decision.credentialReferenceId === undefined
      || safeCredentialReferenceIdentifier(decision.credentialReferenceId) !== undefined)
    && (decision.dryRunResultId === undefined || safeIdentifier(decision.dryRunResultId) !== undefined)
    && !urlHasSecretMaterial(acceptedEndpoint)
    && !urlHasSecretMaterial(transportUrl);
}

function preparedExecutableContractIsReady(
  value: unknown,
): value is PreparedRequesterInvocationExecutableContract {
  if (!isRecord(value) || !hasOnlyKeys(value, PREPARED_EXECUTABLE_CONTRACT_KEYS)) return false;
  const capability = value.capability;
  const owner = value.owner;
  const bridge = value.bridge;
  const transport = value.transport;
  if (
    !isRecord(capability)
    || !hasOnlyKeys(capability, CAPABILITY_KEYS)
    || !isRecord(owner)
    || !hasOnlyKeys(owner, OWNER_KEYS)
    || !isRecord(bridge)
    || !hasOnlyKeys(bridge, BRIDGE_KEYS)
    || !isRecord(transport)
    || !hasOnlyKeys(transport, TRANSPORT_KEYS)
  ) {
    return false;
  }
  const acceptedEndpoint = exactLoopbackHttpUrl(bridge.acceptedEndpoint);
  const transportUrl = exactLoopbackHttpUrl(transport.url);
  if (!acceptedEndpoint || !transportUrl) return false;

  return value.contract === 'local-bridge-requester-invocation-prepared-executable-contract-v1'
    && safeIdentifier(capability.id) !== undefined
    && safeIdentifier(capability.requesterId) !== undefined
    && safeIdentifier(capability.requesterVersion) !== undefined
    && safeIdentifier(owner.ownerSurface) !== undefined
    && safeIdentifier(owner.actionId) !== undefined
    && safeIdentifier(bridge.bridgeKind) !== undefined
    && acceptedEndpoint === bridge.acceptedEndpoint
    && transport.method === 'GET'
    && transportUrl === transport.url
    && isSafeTimeout(transport.timeoutMs)
    && sameOriginHealthProbe(acceptedEndpoint, transportUrl)
    && (value.credentialReferenceId === undefined
      || safeCredentialReferenceIdentifier(value.credentialReferenceId) !== undefined)
    && (value.dryRunResultId === undefined || safeIdentifier(value.dryRunResultId) !== undefined)
    && safeIdentifier(value.requesterImplementationId) !== undefined
    && safeIdentifier(value.requesterPackageVersion) !== undefined
    && safeIdentifier(value.requesterContractId) !== undefined
    && safeIdentifier(value.requesterContractVersion) !== undefined
    && value.injectionMode === 'explicit-reviewed-injected-requester'
    && value.resultRedaction === 'result-body-omitted'
    && value.headersRedaction === 'headers-omitted'
    && value.bodyRedaction === 'body-omitted'
    && value.supportsExecution === true
    && value.requiresExplicitUserApprovalBeforeRequest === true
    && value.executable === false
    && value.requesterCallable === false
    && value.dispatchAllowed === false
    && value.willInvokeRequester === false
    && value.willProbeLocalBridge === false
    && value.willCallProvider === false
    && value.willMutateStorage === false
    && value.willStoreCredential === false
    && value.sideEffects === 'none'
    && value.sideEffectBoundary === EXECUTABLE_CONTRACT_BOUNDARY
    && !urlHasSecretMaterial(acceptedEndpoint)
    && !urlHasSecretMaterial(transportUrl);
}

function preparedExecutableContractMatchesBoundaries(
  execution: LocalBridgeRequesterExecutionBoundaryMetadata,
  invocation: LocalBridgeRequesterInvocationImplementationDecision,
  contract: PreparedRequesterInvocationExecutableContract,
): boolean {
  return contract.capability.id === execution.capability.id
    && contract.capability.id === invocation.capability?.id
    && contract.capability.requesterId === execution.capability.requesterId
    && contract.capability.requesterId === invocation.capability?.requesterId
    && contract.capability.requesterVersion === execution.capability.requesterVersion
    && contract.capability.requesterVersion === invocation.capability?.requesterVersion
    && contract.owner.ownerSurface === execution.owner.ownerSurface
    && contract.owner.ownerSurface === invocation.owner?.ownerSurface
    && contract.owner.actionId === execution.owner.actionId
    && contract.owner.actionId === invocation.owner?.actionId
    && contract.bridge.bridgeKind === execution.bridge.bridgeKind
    && contract.bridge.bridgeKind === invocation.bridge?.bridgeKind
    && contract.bridge.acceptedEndpoint === execution.bridge.acceptedEndpoint
    && contract.bridge.acceptedEndpoint === invocation.bridge?.acceptedEndpoint
    && contract.transport.method === execution.transport.method
    && contract.transport.method === invocation.transport?.method
    && contract.transport.url === execution.transport.url
    && contract.transport.url === invocation.transport?.url
    && contract.transport.timeoutMs === execution.transport.timeoutMs
    && contract.transport.timeoutMs === invocation.transport?.timeoutMs
    && contract.credentialReferenceId === execution.credentialReferenceId
    && contract.credentialReferenceId === invocation.credentialReferenceId
    && contract.dryRunResultId === execution.dryRunResultId
    && contract.dryRunResultId === invocation.dryRunResultId
    && contract.requesterImplementationId === invocation.requesterImplementationId
    && contract.requesterPackageVersion === invocation.requesterPackageVersion;
}

function parseActivationFacts(value: unknown): ParsedActivationFacts | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, FACT_KEYS)) return undefined;
  if (!isRecord(value.userApproval) || !hasOnlyKeys(value.userApproval, APPROVAL_KEYS)) return undefined;
  if (!Array.isArray(value.reviewedAcceptedEndpoints)) return undefined;

  const capabilityId = safeIdentifier(value.capabilityId);
  const requesterId = safeIdentifier(value.requesterId);
  const requesterVersion = safeIdentifier(value.requesterVersion);
  const ownerSurface = safeIdentifier(value.ownerSurface);
  const actionId = safeIdentifier(value.actionId);
  const bridgeKind = safeIdentifier(value.bridgeKind);
  const credentialReferenceId = safeCredentialReferenceIdentifier(value.credentialReferenceId);
  const dryRunResultId = safeIdentifier(value.dryRunResultId);
  const requesterImplementationId = safeIdentifier(value.requesterImplementationId);
  const requesterPackageVersion = safeIdentifier(value.requesterPackageVersion);

  if (
    value.contract !== 'local-bridge-live-activation-facts-v1'
    || !capabilityId
    || !requesterId
    || !requesterVersion
    || !ownerSurface
    || !actionId
    || !bridgeKind
    || !requesterImplementationId
    || !requesterPackageVersion
    || value.reviewState !== 'reviewed'
    || value.operationKind !== 'probe-local-bridge-health-read'
    || value.sideEffects !== 'none'
    || value.sideEffectBoundary !== FACTS_BOUNDARY
    || value.executable !== false
    || value.requesterCallable !== false
    || value.dispatchAllowed !== false
    || value.willInvokeRequester !== false
    || value.willProbeLocalBridge !== false
    || value.willCallProvider !== false
    || value.willMutateStorage !== false
    || value.willStoreCredential !== false
  ) {
    return undefined;
  }

  if (value.reviewedAcceptedEndpoints.length !== 1) return undefined;
  const reviewedAcceptedEndpoint = exactLoopbackHttpUrl(value.reviewedAcceptedEndpoints[0]);
  if (!reviewedAcceptedEndpoint || urlHasSecretMaterial(reviewedAcceptedEndpoint)) return undefined;

  if (
    value.userApproval.scope !== 'activate-reviewed-local-bridge-requester'
    || typeof value.userApproval.granted !== 'boolean'
    || typeof value.userApproval.acknowledgedPlanOnly !== 'boolean'
    || (value.credentialReferenceId !== undefined && !credentialReferenceId)
    || (value.dryRunResultId !== undefined && !dryRunResultId)
  ) {
    return undefined;
  }

  return Object.freeze({
    capabilityId,
    requesterId,
    requesterVersion,
    ownerSurface,
    actionId,
    bridgeKind,
    reviewedAcceptedEndpoint,
    operationKind: 'probe-local-bridge-health-read',
    ...(credentialReferenceId ? { credentialReferenceId } : {}),
    ...(dryRunResultId ? { dryRunResultId } : {}),
    requesterImplementationId,
    requesterPackageVersion,
  });
}

function parseTransportRequest(value: unknown): LocalBridgeLiveActivationTransportRequest | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, TRANSPORT_REQUEST_KEYS)) return undefined;
  const url = exactLoopbackHttpUrl(value.url);
  if (
    value.method !== 'GET'
    || !url
    || urlHasSecretMaterial(url)
    || !isSafeTimeout(value.timeoutMs)
  ) {
    return undefined;
  }

  return Object.freeze({
    method: 'GET',
    url,
    timeoutMs: value.timeoutMs,
  });
}

function boundariesMatch(
  execution: LocalBridgeRequesterExecutionBoundaryMetadata,
  invocation: LocalBridgeRequesterInvocationImplementationDecision,
): boolean {
  return execution.capability.id === invocation.capability?.id
    && execution.capability.requesterId === invocation.capability?.requesterId
    && execution.capability.requesterVersion === invocation.capability?.requesterVersion
    && execution.owner.ownerSurface === invocation.owner?.ownerSurface
    && execution.owner.actionId === invocation.owner?.actionId
    && execution.bridge.bridgeKind === invocation.bridge?.bridgeKind
    && execution.bridge.acceptedEndpoint === invocation.bridge?.acceptedEndpoint
    && execution.transport.method === invocation.transport?.method
    && execution.transport.url === invocation.transport?.url
    && execution.transport.timeoutMs === invocation.transport?.timeoutMs
    && execution.credentialReferenceId === invocation.credentialReferenceId
    && execution.dryRunResultId === invocation.dryRunResultId;
}

function factsMatchBoundaries(
  facts: ParsedActivationFacts,
  execution: LocalBridgeRequesterExecutionBoundaryMetadata,
  invocation: LocalBridgeRequesterInvocationImplementationDecision,
): boolean {
  return facts.capabilityId === execution.capability.id
    && facts.requesterId === execution.capability.requesterId
    && facts.requesterVersion === execution.capability.requesterVersion
    && facts.ownerSurface === execution.owner.ownerSurface
    && facts.actionId === execution.owner.actionId
    && facts.bridgeKind === execution.bridge.bridgeKind
    && facts.reviewedAcceptedEndpoint === execution.bridge.acceptedEndpoint
    && facts.credentialReferenceId === execution.credentialReferenceId
    && facts.dryRunResultId === execution.dryRunResultId
    && facts.requesterImplementationId === invocation.requesterImplementationId
    && facts.requesterPackageVersion === invocation.requesterPackageVersion;
}

function transportMatchesExecution(
  transportRequest: LocalBridgeLiveActivationTransportRequest,
  execution: LocalBridgeRequesterExecutionBoundaryMetadata,
): boolean {
  return transportRequest.method === execution.transport.method
    && transportRequest.url === execution.transport.url
    && transportRequest.timeoutMs === execution.transport.timeoutMs;
}

function freezeDecision(
  reason: LocalBridgeLiveActivationGateReason,
  execution?: LocalBridgeRequesterExecutionBoundaryMetadata,
  invocation?: LocalBridgeRequesterInvocationImplementationDecision,
): Readonly<LocalBridgeLiveActivationGateDecision> {
  const ready = reason === 'live_activation_gate_ready'
    && execution !== undefined
    && invocation !== undefined
    && safeIdentifier(invocation.requesterImplementationId) !== undefined
    && safeIdentifier(invocation.requesterPackageVersion) !== undefined;

  const plan = ready && execution && invocation
    ? createRuntimeTrustedContractObject([
        ['capability', createRuntimeTrustedContractObject([
          ['id', execution.capability.id],
          ['requesterId', execution.capability.requesterId],
          ['requesterVersion', execution.capability.requesterVersion],
        ])],
        ['owner', createRuntimeTrustedContractObject([
          ['ownerSurface', execution.owner.ownerSurface],
          ['actionId', execution.owner.actionId],
        ])],
        ['bridge', createRuntimeTrustedContractObject([
          ['bridgeKind', execution.bridge.bridgeKind],
          ['acceptedEndpoint', execution.bridge.acceptedEndpoint],
        ])],
        ['operation', createRuntimeTrustedContractObject([
          ['kind', 'probe-local-bridge-health-read'],
          ['method', execution.transport.method],
          ['url', execution.transport.url],
          ['timeoutMs', execution.transport.timeoutMs],
        ])],
        ['credentialReferenceId', execution.credentialReferenceId],
        ['dryRunResultId', execution.dryRunResultId],
        ['requesterImplementationId', invocation.requesterImplementationId!],
        ['requesterPackageVersion', invocation.requesterPackageVersion!],
        ['requiresUserApprovalBeforeRequest', true],
        ['executable', false],
        ['requesterCallable', false],
        ['dispatchAllowed', false],
        ['willInvokeRequester', false],
        ['willProbeLocalBridge', false],
        ['willCallProvider', false],
        ['willMutateStorage', false],
        ['willStoreCredential', false],
        ['sideEffects', 'none'],
        ['sideEffectBoundary', DECISION_BOUNDARY],
      ]) as unknown as LocalBridgeLiveActivationPlan
    : undefined;

  return createRuntimeTrustedContractObject([
    ['status', ready ? 'ready' : 'blocked'],
    ['ready', ready],
    ['reason', reason],
    ['plan', plan as RuntimeTrustedContractObject | undefined],
    ['requiresUserApprovalBeforeRequest', true],
    ['executable', false],
    ['requesterCallable', false],
    ['dispatchAllowed', false],
    ['willInvokeRequester', false],
    ['willProbeLocalBridge', false],
    ['willCallProvider', false],
    ['willMutateStorage', false],
    ['willStoreCredential', false],
    ['sideEffects', 'none'],
    ['sideEffectBoundary', DECISION_BOUNDARY],
  ]) as unknown as Readonly<LocalBridgeLiveActivationGateDecision>;
}

export function evaluateLocalBridgeLiveActivationGate(
  input: LocalBridgeLiveActivationGateInput = {},
): Readonly<LocalBridgeLiveActivationGateDecision> {
  if (!isRecord(input)) {
    return freezeDecision('activation_facts_invalid');
  }
  if (hasUnsafeExtraInputKey(input) || !hasOnlyKeys(input, ROOT_KEYS)) {
    return freezeDecision('activation_facts_invalid');
  }
  if (input.requester !== undefined) return freezeDecision('direct_requester_forbidden');
  if (input.transport !== undefined) return freezeDecision('live_transport_forbidden');
  if (input.requesterResult !== undefined) return freezeDecision('live_result_forbidden');
  if (
    valueHasSecretMaterial(input.activationFacts)
    || valueHasSecretMaterial(input.transportRequest)
  ) {
    return freezeDecision('raw_secret_material');
  }

  const rawExecution = input.executionBoundary;
  if (!rawExecution) return freezeDecision('execution_boundary_missing');
  if (!isRecord(rawExecution)) return freezeDecision('execution_boundary_invalid');
  if (rawExecution.status !== 'eligible' || rawExecution.eligible !== true) {
    return freezeDecision('execution_boundary_not_ready');
  }
  if (!executionBoundaryIsReady(rawExecution)) {
    return freezeDecision('execution_boundary_invalid');
  }
  const execution = rawExecution;

  const rawInvocation = input.invocationBoundary;
  if (!rawInvocation) return freezeDecision('invocation_boundary_missing', execution.metadata);
  if (!isRecord(rawInvocation)) return freezeDecision('invocation_boundary_invalid', execution.metadata);
  if (rawInvocation.status !== 'ready' || rawInvocation.ready !== true) {
    return freezeDecision('invocation_boundary_not_ready', execution.metadata);
  }
  if (!invocationBoundaryIsReady(rawInvocation)) {
    return freezeDecision('invocation_boundary_invalid', execution.metadata);
  }
  const invocation = rawInvocation;
  if (!boundariesMatch(execution.metadata, invocation)) {
    return freezeDecision('boundary_identity_mismatch', execution.metadata, invocation);
  }
  const executableContract = invocation.executableContract;
  if (!executableContract) {
    return freezeDecision('invocation_executable_contract_missing', execution.metadata, invocation);
  }
  if (!preparedExecutableContractIsReady(executableContract)) {
    return freezeDecision('invocation_executable_contract_invalid', execution.metadata, invocation);
  }
  if (!preparedExecutableContractMatchesBoundaries(execution.metadata, invocation, executableContract)) {
    return freezeDecision('invocation_executable_contract_mismatch', execution.metadata, invocation);
  }
  if (!execution.metadata.dryRunResultId || !invocation.dryRunResultId) {
    return freezeDecision('dry_run_proof_missing', execution.metadata, invocation);
  }

  if (input.activationFacts === undefined) {
    return freezeDecision('activation_facts_missing', execution.metadata, invocation);
  }
  const activationFacts = parseActivationFacts(input.activationFacts);
  if (!activationFacts) {
    if (
      isRecord(input.activationFacts)
      && Array.isArray(input.activationFacts.reviewedAcceptedEndpoints)
      && input.activationFacts.reviewedAcceptedEndpoints.length !== 1
    ) {
      return freezeDecision('endpoint_count_invalid', execution.metadata, invocation);
    }
    if (
      isRecord(input.activationFacts)
      && Array.isArray(input.activationFacts.reviewedAcceptedEndpoints)
      && input.activationFacts.reviewedAcceptedEndpoints.length === 1
      && exactLoopbackHttpUrl(input.activationFacts.reviewedAcceptedEndpoints[0]) === undefined
    ) {
      return freezeDecision('endpoint_provenance_invalid', execution.metadata, invocation);
    }
    if (isRecord(input.activationFacts) && input.activationFacts.operationKind !== 'probe-local-bridge-health-read') {
      return freezeDecision('operation_kind_invalid', execution.metadata, invocation);
    }
    if (!isRecord(input.activationFacts) || !isRecord(input.activationFacts.userApproval)) {
      return freezeDecision('user_approval_missing', execution.metadata, invocation);
    }
    if (input.activationFacts.userApproval.scope !== 'activate-reviewed-local-bridge-requester') {
      return freezeDecision('user_approval_invalid', execution.metadata, invocation);
    }
    if (input.activationFacts.userApproval.granted !== true) {
      return freezeDecision('user_approval_not_granted', execution.metadata, invocation);
    }
    if (input.activationFacts.userApproval.acknowledgedPlanOnly !== true) {
      return freezeDecision('user_approval_invalid', execution.metadata, invocation);
    }
    return freezeDecision('activation_facts_invalid', execution.metadata, invocation);
  }
  if (activationFacts.reviewedAcceptedEndpoint !== execution.metadata.bridge.acceptedEndpoint) {
    return freezeDecision('endpoint_drift_detected', execution.metadata, invocation);
  }
  if (!factsMatchBoundaries(activationFacts, execution.metadata, invocation)) {
    return freezeDecision('boundary_identity_mismatch', execution.metadata, invocation);
  }

  if (!isRecord(input.activationFacts) || !isRecord(input.activationFacts.userApproval)) {
    return freezeDecision('user_approval_missing', execution.metadata, invocation);
  }
  if (input.activationFacts.userApproval.scope !== 'activate-reviewed-local-bridge-requester') {
    return freezeDecision('user_approval_invalid', execution.metadata, invocation);
  }
  if (input.activationFacts.userApproval.granted !== true) {
    return freezeDecision('user_approval_not_granted', execution.metadata, invocation);
  }
  if (input.activationFacts.userApproval.acknowledgedPlanOnly !== true) {
    return freezeDecision('user_approval_invalid', execution.metadata, invocation);
  }

  if (input.transportRequest === undefined) {
    return freezeDecision('transport_request_missing', execution.metadata, invocation);
  }
  const transportRequest = parseTransportRequest(input.transportRequest);
  if (!transportRequest) {
    return freezeDecision('transport_request_invalid', execution.metadata, invocation);
  }
  if (!transportMatchesExecution(transportRequest, execution.metadata)) {
    return freezeDecision('transport_request_mismatch', execution.metadata, invocation);
  }

  return freezeDecision('live_activation_gate_ready', execution.metadata, invocation);
}
