import {
  createLocalBridgeDiscoveryPlan,
  type LocalBridgeCandidatePlan,
  type LocalBridgeDiscoveryPlan,
  type LocalBridgeKind,
  type LocalBridgeProbePlan,
} from './local-bridge-discovery';

export type LocalBridgeProbeExecutionAction = 'probe_local_bridge';
export type LocalBridgeProbeExecutionDecisionStatus = 'allow' | 'block';

export type LocalBridgeProbeExecutionBlockReason =
  | 'input_shape_forbidden'
  | 'missing_expected_bridge_kind'
  | 'missing_discovery_plan'
  | 'missing_explicit_probe_action'
  | 'explicit_probe_action_mismatch'
  | 'explicit_probe_bridge_kind_mismatch'
  | 'explicit_probe_consent_not_granted'
  | 'explicit_probe_plan_boundary_not_acknowledged'
  | 'discovery_bridge_kind_mismatch'
  | 'discovery_boundary_mismatch'
  | 'discovery_not_ready'
  | 'discovery_not_allowed'
  | 'accepted_endpoint_missing'
  | 'accepted_probe_missing'
  | 'accepted_probe_not_allowed'
  | 'accepted_probe_boundary_mismatch'
  | 'accepted_endpoint_revalidation_failed';

export type LocalBridgeProbeExecutionAllowReason = 'explicit_manual_probe_plan_ready';

export interface LocalBridgeProbeExplicitUserActionFact {
  action: LocalBridgeProbeExecutionAction | string;
  bridgeKind?: LocalBridgeKind;
  granted: boolean;
  acknowledgedPlanOnly: boolean;
}

export interface LocalBridgeProbeExecutionGateInput {
  expectedBridgeKind?: LocalBridgeKind;
  discoveryPlan?: LocalBridgeDiscoveryPlan | null;
  explicitUserAction?: LocalBridgeProbeExplicitUserActionFact | null;
}

export interface LocalBridgeInertManualProbePlan {
  bridgeKind: LocalBridgeKind;
  acceptedEndpoint: string;
  method: LocalBridgeProbePlan['method'];
  url: string;
  timeoutMs: number;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'plan-only-no-fetch-no-socket';
}

export interface LocalBridgeProbeExecutionDecision {
  status: LocalBridgeProbeExecutionDecisionStatus;
  executable: false;
  sideEffects: 'none';
  bridgeKind?: LocalBridgeKind;
  acceptedEndpoint?: string;
  allowReason?: LocalBridgeProbeExecutionAllowReason;
  probePlan?: LocalBridgeInertManualProbePlan;
  blockReasons: readonly LocalBridgeProbeExecutionBlockReason[];
  sideEffectBoundary: 'decision-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
}

const DISCOVERY_SIDE_EFFECT_BOUNDARY = 'plan-only-no-fetch-no-socket-no-storage';
const PROBE_SIDE_EFFECT_BOUNDARY = 'plan-only-no-fetch-no-socket';
const DECISION_SIDE_EFFECT_BOUNDARY = 'decision-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
type LocalBridgeDefaultScheme = 'http' | 'https';
const INPUT_KEYS = new Set(['discoveryPlan', 'expectedBridgeKind', 'explicitUserAction']);
const EXPLICIT_ACTION_KEYS = new Set(['acknowledgedPlanOnly', 'action', 'bridgeKind', 'granted']);
const UNSAFE_FIELD_MARKERS = [
  'callback',
  'credentialresolver',
  'fetch',
  'liveaction',
  'provider',
  'requester',
  'secret',
  'socket',
  'storage',
  'token',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function hasUnsafeRuntimeField(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((entry) => hasUnsafeRuntimeField(entry, seen));
  return Object.entries(value).some(([key, nestedValue]) => {
    const normalized = normalizedKey(key);
    return UNSAFE_FIELD_MARKERS.some((marker) => normalized.includes(marker))
      || hasUnsafeRuntimeField(nestedValue, seen);
  });
}

function validateExplicitUserAction(
    action: LocalBridgeProbeExplicitUserActionFact | null | undefined,
    expectedBridgeKind?: LocalBridgeKind,
): LocalBridgeProbeExecutionBlockReason[] {
  const blockReasons: LocalBridgeProbeExecutionBlockReason[] = [];
  if (!action) return ['missing_explicit_probe_action'];
  if (!isRecord(action) || !hasOnlyAllowedKeys(action, EXPLICIT_ACTION_KEYS) || hasUnsafeRuntimeField(action)) {
    blockReasons.push('input_shape_forbidden');
  }
  if (action.action !== 'probe_local_bridge') blockReasons.push('explicit_probe_action_mismatch');
  if (action.bridgeKind !== expectedBridgeKind) blockReasons.push('explicit_probe_bridge_kind_mismatch');
  if (action.granted !== true) blockReasons.push('explicit_probe_consent_not_granted');
  if (action.acknowledgedPlanOnly !== true) blockReasons.push('explicit_probe_plan_boundary_not_acknowledged');
  return blockReasons;
}

function defaultSchemeFor(endpoint: string): LocalBridgeDefaultScheme | null {
  try {
    const protocol = new URL(endpoint).protocol;
    if (protocol === 'http:') return 'http';
    if (protocol === 'https:') return 'https';
    return null;
  } catch {
    return null;
  }
}

function revalidateClaimedUrl(
  value: string,
  expectedBridgeKind: LocalBridgeKind,
  defaultScheme: LocalBridgeDefaultScheme = 'http',
): string | null {
  const plan = createLocalBridgeDiscoveryPlan({
    bridgeKind: expectedBridgeKind,
    candidates: [value],
    consentGranted: true,
    defaultScheme,
    maxCandidates: 1,
  });
  const candidate = plan.candidates[0];
  return plan.allowed
    && candidate?.accepted === true
    && typeof candidate.normalizedEndpoint === 'string'
    ? candidate.normalizedEndpoint
    : null;
}

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

function validateAcceptedCandidate(
  candidate: LocalBridgeCandidatePlan,
  expectedBridgeKind: LocalBridgeKind,
): LocalBridgeProbeExecutionBlockReason[] {
  const blockReasons: LocalBridgeProbeExecutionBlockReason[] = [];
  const acceptedEndpoint = typeof candidate.normalizedEndpoint === 'string'
    ? candidate.normalizedEndpoint.trim()
    : '';

  if (!acceptedEndpoint) blockReasons.push('accepted_endpoint_missing');
  if (!candidate.probe) {
    blockReasons.push('accepted_probe_missing');
  } else {
    if (
      candidate.probe.allowed !== true
      || candidate.probe.consentRequired !== false
      || candidate.probe.method !== 'GET'
    ) {
      blockReasons.push('accepted_probe_not_allowed');
    }
    if (candidate.probe.sideEffectBoundary !== PROBE_SIDE_EFFECT_BOUNDARY) {
      blockReasons.push('accepted_probe_boundary_mismatch');
    }
  }

  if (!acceptedEndpoint || !candidate.probe) return blockReasons;

  const endpointCheck = revalidateClaimedUrl(acceptedEndpoint, expectedBridgeKind);
  const acceptedEndpointScheme = defaultSchemeFor(acceptedEndpoint);
  const inputCheck = acceptedEndpointScheme
    ? revalidateClaimedUrl(candidate.input, expectedBridgeKind, acceptedEndpointScheme)
    : null;
  const probeUrlCheck = revalidateClaimedUrl(candidate.probe.url, expectedBridgeKind);
  if (
    endpointCheck !== acceptedEndpoint
    || inputCheck !== acceptedEndpoint
    || !probeUrlCheck
    || !sameOrigin(probeUrlCheck, acceptedEndpoint)
  ) {
    blockReasons.push('accepted_endpoint_revalidation_failed');
  }

  return blockReasons;
}

function acceptedCandidates(discoveryPlan: LocalBridgeDiscoveryPlan): LocalBridgeCandidatePlan[] {
  return discoveryPlan.candidates.filter((candidate) => candidate.accepted === true);
}

function inertProbePlan(
  candidate: LocalBridgeCandidatePlan,
  expectedBridgeKind: LocalBridgeKind,
): LocalBridgeInertManualProbePlan | undefined {
  if (!candidate.normalizedEndpoint || !candidate.probe) return undefined;
  return {
    bridgeKind: expectedBridgeKind,
    acceptedEndpoint: candidate.normalizedEndpoint,
    method: candidate.probe.method,
    url: candidate.probe.url,
    timeoutMs: candidate.probe.timeoutMs,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: PROBE_SIDE_EFFECT_BOUNDARY,
  };
}

export function evaluateLocalBridgeProbeExecutionGate(
  input: LocalBridgeProbeExecutionGateInput,
): LocalBridgeProbeExecutionDecision {
  const root = input as unknown;
  if (!isRecord(root) || !hasOnlyAllowedKeys(root, INPUT_KEYS) || hasUnsafeRuntimeField(root)) {
    return Object.freeze({
      status: 'block',
      executable: false,
      sideEffects: 'none',
      bridgeKind: undefined,
      acceptedEndpoint: undefined,
      allowReason: undefined,
      probePlan: undefined,
      blockReasons: Object.freeze(['input_shape_forbidden'] satisfies LocalBridgeProbeExecutionBlockReason[]),
      sideEffectBoundary: DECISION_SIDE_EFFECT_BOUNDARY,
    });
  }
  const expectedBridgeKind = input.expectedBridgeKind;
  const discoveryPlan = input.discoveryPlan;
  const blockReasons: LocalBridgeProbeExecutionBlockReason[] = [];

  if (!expectedBridgeKind) blockReasons.push('missing_expected_bridge_kind');
  blockReasons.push(...validateExplicitUserAction(input.explicitUserAction, expectedBridgeKind));

  if (!discoveryPlan) {
    blockReasons.push('missing_discovery_plan');
  } else if (expectedBridgeKind) {
    if (discoveryPlan.bridgeKind !== expectedBridgeKind) blockReasons.push('discovery_bridge_kind_mismatch');
    if (discoveryPlan.sideEffectBoundary !== DISCOVERY_SIDE_EFFECT_BOUNDARY) {
      blockReasons.push('discovery_boundary_mismatch');
    }
    if (discoveryPlan.status !== 'ready') blockReasons.push('discovery_not_ready');
    if (
      discoveryPlan.allowed !== true
      || discoveryPlan.consentGranted !== true
      || discoveryPlan.consentRequired !== false
      || discoveryPlan.acceptedCount < 1
    ) {
      blockReasons.push('discovery_not_allowed');
    }

    const accepted = acceptedCandidates(discoveryPlan);
    if (accepted.length === 0) {
      blockReasons.push('accepted_endpoint_missing');
    } else {
      accepted.forEach((candidate) => {
        blockReasons.push(...validateAcceptedCandidate(candidate, expectedBridgeKind));
      });
    }
  }

  const uniqueBlockReasons = Object.freeze([...new Set(blockReasons)]);
  const status: LocalBridgeProbeExecutionDecisionStatus = uniqueBlockReasons.length === 0 ? 'allow' : 'block';
  const firstAccepted = discoveryPlan ? acceptedCandidates(discoveryPlan)[0] : undefined;
  const probePlan = status === 'allow' && firstAccepted && expectedBridgeKind
    ? inertProbePlan(firstAccepted, expectedBridgeKind)
    : undefined;

  return Object.freeze({
    status,
    executable: false,
    sideEffects: 'none',
    bridgeKind: expectedBridgeKind,
    acceptedEndpoint: status === 'allow' ? probePlan?.acceptedEndpoint : undefined,
    allowReason: status === 'allow' ? 'explicit_manual_probe_plan_ready' : undefined,
    probePlan,
    blockReasons: uniqueBlockReasons,
    sideEffectBoundary: DECISION_SIDE_EFFECT_BOUNDARY,
  });
}
