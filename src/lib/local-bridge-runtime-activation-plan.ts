import type {
  LocalBridgeLiveActivationGateDecision,
  LocalBridgeLiveActivationPlan,
} from './local-bridge-live-activation-gate';
import type {
  LocalBridgeRequesterExecutionBoundaryDecision,
  LocalBridgeRequesterExecutionBoundaryMetadata,
} from './local-bridge-requester-execution-boundary';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type LocalBridgeRuntimeActivationPlanStatus = 'ready' | 'blocked';

export type LocalBridgeRuntimeActivationPlanReason =
  | 'local_bridge_runtime_activation_plan_ready'
  | 'invalid_root_shape'
  | 'raw_secret_material'
  | 'live_activation_missing'
  | 'live_activation_not_ready'
  | 'live_activation_invalid'
  | 'execution_boundary_missing'
  | 'execution_boundary_not_ready'
  | 'execution_boundary_invalid'
  | 'endpoint_count_invalid'
  | 'endpoint_provenance_invalid'
  | 'endpoint_drift_detected'
  | 'requester_owner_invalid'
  | 'operation_intent_invalid'
  | 'transport_binding_invalid'
  | 'user_approval_invalid'
  | 'requester_injection_forbidden'
  | 'transport_shape_forbidden'
  | 'runtime_result_forbidden';

export interface LocalBridgeRuntimeActivationImplementationPlan {
  contract: 'local-bridge-runtime-activation-plan-v1';
  acceptedLiveActivationBoundary: 'local-bridge-live-activation-gate-plan-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials';
  acceptedExecutionBoundary: 'requester-execution-boundary-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-callback';
  capability: {
    id: string;
    requesterId: string;
    requesterVersion: string;
  };
  owner: {
    ownerSurface: string;
    actionId: 'probe_local_bridge';
  };
  bridge: {
    bridgeKind: string;
    acceptedEndpoint: string;
  };
  operation: {
    kind: 'probe-local-bridge-health-read';
    method: 'GET';
    url: string;
    timeoutMs: number;
  };
  credentialReferenceId?: string;
  dryRunResultId?: string;
  requesterImplementationId: string;
  requesterPackageVersion: string;
  reviewedRequesterOwner: true;
  requiresUserApprovalBeforeRequest: true;
  requiresExplicitRequesterInjection: true;
  executable: false;
  requesterCallable: false;
  dispatchAllowed: false;
  willInvokeRequester: false;
  willProbeLocalBridge: false;
  willCallProvider: false;
  willMutateStorage: false;
  willStoreCredential: false;
  sideEffects: 'none';
  sideEffectBoundary: 'local-bridge-runtime-activation-plan-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials';
}

export interface LocalBridgeRuntimeActivationPlanDecision {
  status: LocalBridgeRuntimeActivationPlanStatus;
  ready: boolean;
  reason: LocalBridgeRuntimeActivationPlanReason;
  plan?: LocalBridgeRuntimeActivationImplementationPlan;
  canPrepareFutureLocalBridgeRuntimeActivation: boolean;
  requiresUserApprovalBeforeRequest: true;
  requiresExplicitRequesterInjection: true;
  executable: false;
  requesterCallable: false;
  dispatchAllowed: false;
  willInvokeRequester: false;
  willProbeLocalBridge: false;
  willCallProvider: false;
  willMutateStorage: false;
  willStoreCredential: false;
  sideEffects: 'none';
  sideEffectBoundary: 'local-bridge-runtime-activation-plan-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials';
}

export interface LocalBridgeRuntimeActivationPlanInput {
  liveActivationDecision?: LocalBridgeLiveActivationGateDecision | null;
  executionBoundary?: LocalBridgeRequesterExecutionBoundaryDecision | null;
  requester?: unknown;
  transport?: unknown;
  transportRequest?: unknown;
  requesterResult?: unknown;
}

const LIVE_ACTIVATION_BOUNDARY =
  'local-bridge-live-activation-gate-plan-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials' as const;
const EXECUTION_BOUNDARY =
  'requester-execution-boundary-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-callback' as const;
const DECISION_BOUNDARY =
  'local-bridge-runtime-activation-plan-only-no-requester-call-no-fetch-no-socket-no-storage-no-provider-no-credentials' as const;
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_TIMEOUT_MS = 30_000;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
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
  'executionBoundary',
  'liveActivationDecision',
  'requester',
  'requesterResult',
  'transport',
  'transportRequest',
]);
const LIVE_GATE_KEYS = new Set([
  'dispatchAllowed',
  'executable',
  'plan',
  'ready',
  'reason',
  'requesterCallable',
  'requiresUserApprovalBeforeRequest',
  'sideEffectBoundary',
  'sideEffects',
  'status',
  'willCallProvider',
  'willInvokeRequester',
  'willMutateStorage',
  'willProbeLocalBridge',
  'willStoreCredential',
]);
const LIVE_PLAN_KEYS = new Set([
  'bridge',
  'capability',
  'credentialReferenceId',
  'dryRunResultId',
  'dispatchAllowed',
  'executable',
  'operation',
  'owner',
  'requesterCallable',
  'requesterImplementationId',
  'requesterPackageVersion',
  'requiresUserApprovalBeforeRequest',
  'sideEffectBoundary',
  'sideEffects',
  'willCallProvider',
  'willInvokeRequester',
  'willMutateStorage',
  'willProbeLocalBridge',
  'willStoreCredential',
]);
const EXECUTION_DECISION_KEYS = new Set([
  'blockers',
  'eligible',
  'metadata',
  'sideEffectBoundary',
  'status',
]);
const EXECUTION_METADATA_KEYS = new Set([
  'bridge',
  'capability',
  'credentialReferenceId',
  'dispatchAllowed',
  'dryRunResultId',
  'executable',
  'executionEligible',
  'metadataKind',
  'owner',
  'requesterFactReviewState',
  'schemaVersion',
  'sideEffectBoundary',
  'sideEffects',
  'transport',
  'willCallProvider',
  'willInvokeRequester',
  'willMutateStorage',
  'willProbeLocalBridge',
]);
const CAPABILITY_KEYS = new Set(['id', 'requesterId', 'requesterVersion']);
const OWNER_KEYS = new Set(['actionId', 'ownerSurface']);
const BRIDGE_KEYS = new Set(['acceptedEndpoint', 'bridgeKind']);
const OPERATION_KEYS = new Set(['kind', 'method', 'timeoutMs', 'url']);
const TRANSPORT_KEYS = new Set(['method', 'timeoutMs', 'url']);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isTrustedRootInput(value: unknown): value is LocalBridgeRuntimeActivationPlanInput & Record<string, unknown> {
  return isRuntimeTrustedContractObject(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: Set<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringLooksSecretBearing(value: string): boolean {
  return TOKEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function safeIdentifier(value: unknown): string | undefined {
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
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasSecretMaterial(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (valueHasSecretMaterial(key, seen) || valueHasSecretMaterial(nestedValue, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasSecretMaterial(nestedValue, seen)) return true;
    }
    return false;
  }

  return Object.values(value).some((nestedValue) => valueHasSecretMaterial(nestedValue, seen));
}

function isSafeTimeout(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
    && value <= MAX_TIMEOUT_MS;
}

function sameOriginHealthProbe(endpoint: string, probeUrl: string): boolean {
  try {
    const endpointUrl = new URL(endpoint);
    const probe = new URL(probeUrl);
    return endpointUrl.origin === probe.origin
      && probe.pathname === '/health'
      && !probe.search
      && !probe.hash;
  } catch {
    return false;
  }
}

function emptyBlockers(value: unknown): boolean {
  return Array.isArray(value)
    && value.length === 0
    && Object.isFrozen(value);
}

function endpointCountIssue(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const plan = value.plan;
  if (isRecord(plan) && Array.isArray(plan.acceptedEndpoints)) {
    return plan.acceptedEndpoints.length !== 1;
  }
  const bridge = isRecord(plan) ? plan.bridge : undefined;
  if (isRecord(bridge) && Array.isArray(bridge.acceptedEndpoint)) {
    return bridge.acceptedEndpoint.length !== 1;
  }
  return false;
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

  const acceptedEndpoint = localBridgeHttpUrl(bridge.acceptedEndpoint);
  const transportUrl = localBridgeHttpUrl(transport.url);
  return !!acceptedEndpoint
    && !!transportUrl
    && metadata.schemaVersion === 1
    && metadata.metadataKind === 'local-bridge-requester-execution-boundary'
    && safeIdentifier(capability.id) !== undefined
    && safeIdentifier(capability.requesterId) !== undefined
    && safeIdentifier(capability.requesterVersion) !== undefined
    && safeIdentifier(owner.ownerSurface) !== undefined
    && owner.actionId === 'probe_local_bridge'
    && safeIdentifier(bridge.bridgeKind) !== undefined
    && acceptedEndpoint === bridge.acceptedEndpoint
    && transport.method === 'GET'
    && transportUrl === transport.url
    && isSafeTimeout(transport.timeoutMs)
    && sameOriginHealthProbe(acceptedEndpoint, transportUrl)
    && !urlHasSecretMaterial(acceptedEndpoint)
    && !urlHasSecretMaterial(transportUrl)
    && (metadata.credentialReferenceId === undefined || safeIdentifier(metadata.credentialReferenceId) !== undefined)
    && (metadata.dryRunResultId === undefined || safeIdentifier(metadata.dryRunResultId) !== undefined)
    && metadata.requesterFactReviewState === 'reviewed'
    && metadata.executionEligible === true
    && metadata.willInvokeRequester === false
    && metadata.willProbeLocalBridge === false
    && metadata.willCallProvider === false
    && metadata.willMutateStorage === false
    && metadata.dispatchAllowed === false
    && metadata.executable === false
    && metadata.sideEffects === 'none'
    && metadata.sideEffectBoundary === EXECUTION_BOUNDARY;
}

function liveActivationDecisionIsReady(
  decision: unknown,
): decision is LocalBridgeLiveActivationGateDecision & { plan: LocalBridgeLiveActivationPlan } {
  if (!isRecord(decision) || !hasOnlyKeys(decision, LIVE_GATE_KEYS)) return false;
  const plan = decision.plan;
  if (
    decision.status !== 'ready'
    || decision.ready !== true
    || decision.reason !== 'live_activation_gate_ready'
    || decision.requiresUserApprovalBeforeRequest !== true
    || decision.executable !== false
    || decision.requesterCallable !== false
    || decision.dispatchAllowed !== false
    || decision.willInvokeRequester !== false
    || decision.willProbeLocalBridge !== false
    || decision.willCallProvider !== false
    || decision.willMutateStorage !== false
    || decision.willStoreCredential !== false
    || decision.sideEffects !== 'none'
    || decision.sideEffectBoundary !== LIVE_ACTIVATION_BOUNDARY
    || !isRecord(plan)
    || !hasOnlyKeys(plan, LIVE_PLAN_KEYS)
  ) {
    return false;
  }

  const capability = plan.capability;
  const owner = plan.owner;
  const bridge = plan.bridge;
  const operation = plan.operation;
  if (
    !isRecord(capability)
    || !hasOnlyKeys(capability, CAPABILITY_KEYS)
    || !isRecord(owner)
    || !hasOnlyKeys(owner, OWNER_KEYS)
    || !isRecord(bridge)
    || !hasOnlyKeys(bridge, BRIDGE_KEYS)
    || !isRecord(operation)
    || !hasOnlyKeys(operation, OPERATION_KEYS)
  ) {
    return false;
  }

  const acceptedEndpoint = localBridgeHttpUrl(bridge.acceptedEndpoint);
  const operationUrl = localBridgeHttpUrl(operation.url);
  return !!acceptedEndpoint
    && !!operationUrl
    && safeIdentifier(capability.id) !== undefined
    && safeIdentifier(capability.requesterId) !== undefined
    && safeIdentifier(capability.requesterVersion) !== undefined
    && safeIdentifier(owner.ownerSurface) !== undefined
    && owner.actionId === 'probe_local_bridge'
    && safeIdentifier(bridge.bridgeKind) !== undefined
    && acceptedEndpoint === bridge.acceptedEndpoint
    && operation.kind === 'probe-local-bridge-health-read'
    && operation.method === 'GET'
    && operationUrl === operation.url
    && isSafeTimeout(operation.timeoutMs)
    && sameOriginHealthProbe(acceptedEndpoint, operationUrl)
    && !urlHasSecretMaterial(acceptedEndpoint)
    && !urlHasSecretMaterial(operationUrl)
    && (plan.credentialReferenceId === undefined || safeIdentifier(plan.credentialReferenceId) !== undefined)
    && (plan.dryRunResultId === undefined || safeIdentifier(plan.dryRunResultId) !== undefined)
    && safeIdentifier(plan.requesterImplementationId) !== undefined
    && safeIdentifier(plan.requesterPackageVersion) !== undefined
    && plan.requiresUserApprovalBeforeRequest === true
    && plan.executable === false
    && plan.requesterCallable === false
    && plan.dispatchAllowed === false
    && plan.willInvokeRequester === false
    && plan.willProbeLocalBridge === false
    && plan.willCallProvider === false
    && plan.willMutateStorage === false
    && plan.willStoreCredential === false
    && plan.sideEffects === 'none'
    && plan.sideEffectBoundary === LIVE_ACTIVATION_BOUNDARY;
}

function bindingMatches(
  livePlan: LocalBridgeLiveActivationPlan,
  execution: LocalBridgeRequesterExecutionBoundaryMetadata,
): boolean {
  return livePlan.capability.id === execution.capability.id
    && livePlan.capability.requesterId === execution.capability.requesterId
    && livePlan.capability.requesterVersion === execution.capability.requesterVersion
    && livePlan.owner.ownerSurface === execution.owner.ownerSurface
    && livePlan.owner.actionId === execution.owner.actionId
    && livePlan.bridge.bridgeKind === execution.bridge.bridgeKind
    && livePlan.bridge.acceptedEndpoint === execution.bridge.acceptedEndpoint
    && livePlan.operation.method === execution.transport.method
    && livePlan.operation.url === execution.transport.url
    && livePlan.operation.timeoutMs === execution.transport.timeoutMs
    && livePlan.credentialReferenceId === execution.credentialReferenceId
    && livePlan.dryRunResultId === execution.dryRunResultId;
}

function freezeDecision(
  reason: LocalBridgeRuntimeActivationPlanReason,
  livePlan?: LocalBridgeLiveActivationPlan,
  execution?: LocalBridgeRequesterExecutionBoundaryMetadata,
): Readonly<LocalBridgeRuntimeActivationPlanDecision> {
  const ready = reason === 'local_bridge_runtime_activation_plan_ready'
    && livePlan !== undefined
    && execution !== undefined;

  const plan = ready && livePlan && execution
    ? Object.freeze({
        contract: 'local-bridge-runtime-activation-plan-v1',
        acceptedLiveActivationBoundary: LIVE_ACTIVATION_BOUNDARY,
        acceptedExecutionBoundary: EXECUTION_BOUNDARY,
        capability: Object.freeze({
          id: execution.capability.id,
          requesterId: execution.capability.requesterId,
          requesterVersion: execution.capability.requesterVersion,
        }),
        owner: Object.freeze({
          ownerSurface: execution.owner.ownerSurface,
          actionId: 'probe_local_bridge' as const,
        }),
        bridge: Object.freeze({
          bridgeKind: execution.bridge.bridgeKind,
          acceptedEndpoint: execution.bridge.acceptedEndpoint,
        }),
        operation: Object.freeze({
          kind: 'probe-local-bridge-health-read' as const,
          method: execution.transport.method,
          url: execution.transport.url,
          timeoutMs: execution.transport.timeoutMs,
        }),
        ...(execution.credentialReferenceId ? { credentialReferenceId: execution.credentialReferenceId } : {}),
        ...(execution.dryRunResultId ? { dryRunResultId: execution.dryRunResultId } : {}),
        requesterImplementationId: livePlan.requesterImplementationId,
        requesterPackageVersion: livePlan.requesterPackageVersion,
        reviewedRequesterOwner: true as const,
        requiresUserApprovalBeforeRequest: true as const,
        requiresExplicitRequesterInjection: true as const,
        executable: false as const,
        requesterCallable: false as const,
        dispatchAllowed: false as const,
        willInvokeRequester: false as const,
        willProbeLocalBridge: false as const,
        willCallProvider: false as const,
        willMutateStorage: false as const,
        willStoreCredential: false as const,
        sideEffects: 'none' as const,
        sideEffectBoundary: DECISION_BOUNDARY,
      } satisfies LocalBridgeRuntimeActivationImplementationPlan)
    : undefined;

  return Object.freeze({
    status: ready ? 'ready' : 'blocked',
    ready,
    reason,
    plan,
    canPrepareFutureLocalBridgeRuntimeActivation: ready,
    requiresUserApprovalBeforeRequest: true,
    requiresExplicitRequesterInjection: true,
    executable: false,
    requesterCallable: false,
    dispatchAllowed: false,
    willInvokeRequester: false,
    willProbeLocalBridge: false,
    willCallProvider: false,
    willMutateStorage: false,
    willStoreCredential: false,
    sideEffects: 'none',
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}

export function evaluateLocalBridgeRuntimeActivationPlan(
  input: LocalBridgeRuntimeActivationPlanInput = {},
): Readonly<LocalBridgeRuntimeActivationPlanDecision> {
  if (!isTrustedRootInput(input) || !hasOnlyKeys(input, ROOT_KEYS)) {
    return freezeDecision('invalid_root_shape');
  }
  if (input.requester !== undefined) return freezeDecision('requester_injection_forbidden');
  if (input.transport !== undefined || input.transportRequest !== undefined) {
    return freezeDecision('transport_shape_forbidden');
  }
  if (input.requesterResult !== undefined) return freezeDecision('runtime_result_forbidden');
  if (
    valueHasSecretMaterial(input.liveActivationDecision)
    || valueHasSecretMaterial(input.executionBoundary)
  ) {
    return freezeDecision('raw_secret_material');
  }

  const rawLiveActivation = input.liveActivationDecision;
  if (!rawLiveActivation) return freezeDecision('live_activation_missing');
  if (endpointCountIssue(rawLiveActivation)) return freezeDecision('endpoint_count_invalid');
  if (!isRecord(rawLiveActivation)) return freezeDecision('live_activation_invalid');
  if (rawLiveActivation.status !== 'ready' || rawLiveActivation.ready !== true) {
    return freezeDecision('live_activation_not_ready');
  }
  if (!liveActivationDecisionIsReady(rawLiveActivation)) {
    const livePlan = isRecord(rawLiveActivation.plan) ? rawLiveActivation.plan : undefined;
    if (
      livePlan
      && isRecord(livePlan.bridge)
      && localBridgeHttpUrl(livePlan.bridge.acceptedEndpoint) === undefined
    ) {
      return freezeDecision('endpoint_provenance_invalid');
    }
    if (rawLiveActivation.requiresUserApprovalBeforeRequest !== true || livePlan?.requiresUserApprovalBeforeRequest !== true) {
      return freezeDecision('user_approval_invalid');
    }
    if (
      livePlan
      && isRecord(livePlan.operation)
      && livePlan.operation.kind !== undefined
      && livePlan.operation.kind !== 'probe-local-bridge-health-read'
    ) {
      return freezeDecision('operation_intent_invalid');
    }
    return freezeDecision('live_activation_invalid');
  }
  const liveActivation = rawLiveActivation;

  const rawExecution = input.executionBoundary;
  if (!rawExecution) return freezeDecision('execution_boundary_missing', liveActivation.plan);
  if (!isRecord(rawExecution)) return freezeDecision('execution_boundary_invalid', liveActivation.plan);
  if (rawExecution.status !== 'eligible' || rawExecution.eligible !== true) {
    return freezeDecision('execution_boundary_not_ready', liveActivation.plan);
  }
  if (!executionBoundaryIsReady(rawExecution)) {
    if (
      isRecord(rawExecution.metadata)
      && isRecord(rawExecution.metadata.bridge)
      && localBridgeHttpUrl(rawExecution.metadata.bridge.acceptedEndpoint) === undefined
    ) {
      return freezeDecision('endpoint_provenance_invalid', liveActivation.plan);
    }
    return freezeDecision('execution_boundary_invalid', liveActivation.plan);
  }
  const execution = rawExecution;

  if (liveActivation.plan.requiresUserApprovalBeforeRequest !== true || liveActivation.requiresUserApprovalBeforeRequest !== true) {
    return freezeDecision('user_approval_invalid', liveActivation.plan, execution.metadata);
  }
  if (liveActivation.plan.operation.kind !== 'probe-local-bridge-health-read' || execution.metadata.owner.actionId !== 'probe_local_bridge') {
    return freezeDecision('operation_intent_invalid', liveActivation.plan, execution.metadata);
  }
  if (liveActivation.plan.bridge.acceptedEndpoint !== execution.metadata.bridge.acceptedEndpoint) {
    return freezeDecision('endpoint_drift_detected', liveActivation.plan, execution.metadata);
  }
  if (
    liveActivation.plan.bridge.bridgeKind !== execution.metadata.bridge.bridgeKind
    || liveActivation.plan.capability.id !== execution.metadata.capability.id
    || liveActivation.plan.capability.requesterId !== execution.metadata.capability.requesterId
    || liveActivation.plan.capability.requesterVersion !== execution.metadata.capability.requesterVersion
    || liveActivation.plan.owner.ownerSurface !== execution.metadata.owner.ownerSurface
    || liveActivation.plan.owner.actionId !== execution.metadata.owner.actionId
  ) {
    return freezeDecision('requester_owner_invalid', liveActivation.plan, execution.metadata);
  }
  if (!bindingMatches(liveActivation.plan, execution.metadata)) {
    return freezeDecision('transport_binding_invalid', liveActivation.plan, execution.metadata);
  }

  return freezeDecision('local_bridge_runtime_activation_plan_ready', liveActivation.plan, execution.metadata);
}
