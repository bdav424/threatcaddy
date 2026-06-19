import type {
  LocalBridgeRequesterOwnershipDecision,
  LocalBridgeRequesterOwnershipDescriptor,
} from './local-bridge-requester-ownership';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type LocalBridgeDryRunTransportHarnessStatus = 'accepted' | 'blocked';

export type LocalBridgeDryRunTransportHarnessBlockReason =
  | 'input_shape_forbidden'
  | 'ownership_decision_missing'
  | 'ownership_decision_blocked'
  | 'ownership_descriptor_missing'
  | 'ownership_boundary_mismatch'
  | 'dry_run_result_missing'
  | 'dry_run_result_invalid'
  | 'owner_mismatch'
  | 'capability_mismatch'
  | 'bridge_mismatch'
  | 'transport_method_mismatch'
  | 'transport_url_mismatch'
  | 'transport_timeout_mismatch'
  | 'credential_reference_mismatch'
  | 'dispatch_boundary_mismatch'
  | 'forged_live_execution_flag'
  | 'schemeless_url_ambiguous'
  | 'secret_bearing_url'
  | 'token_shaped_identifier'
  | 'headers_forbidden'
  | 'body_forbidden'
  | 'raw_secret_material'
  | 'direct_requester_forbidden';

export interface LocalBridgeDryRunTransportHarnessBlocker {
  code: LocalBridgeDryRunTransportHarnessBlockReason;
  detail: string;
  field?: string;
}

export interface LocalBridgeDryRunTransportResultInput {
  resultKind?: unknown;
  dryRun?: unknown;
  capabilityId?: unknown;
  requesterId?: unknown;
  requesterVersion?: unknown;
  ownerSurface?: unknown;
  actionId?: unknown;
  bridgeKind?: unknown;
  acceptedEndpoint?: unknown;
  method?: unknown;
  url?: unknown;
  timeoutMs?: unknown;
  credentialReferenceId?: unknown;
  dispatchAllowed?: unknown;
  executable?: unknown;
  sideEffects?: unknown;
  sideEffectBoundary?: unknown;
  resultId?: unknown;
  runId?: unknown;
  transportId?: unknown;
  traceId?: unknown;
  headers?: unknown;
  body?: unknown;
  responseText?: unknown;
  resultText?: unknown;
  text?: unknown;
  executed?: unknown;
  probed?: unknown;
  live?: unknown;
  liveExecution?: unknown;
  probeAllowed?: unknown;
  request?: unknown;
  directRequester?: unknown;
}

export interface LocalBridgeDryRunTransportMetadata {
  schemaVersion: 1;
  metadataKind: 'local-bridge-dry-run-transport';
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
  resultId?: string;
  dispatchAllowed: false;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'dry-run-transport-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
}

export interface LocalBridgeDryRunTransportHarnessDecision {
  status: LocalBridgeDryRunTransportHarnessStatus;
  accepted: boolean;
  metadata?: LocalBridgeDryRunTransportMetadata;
  blockers: readonly LocalBridgeDryRunTransportHarnessBlocker[];
  sideEffectBoundary: 'dry-run-transport-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
}

export interface LocalBridgeDryRunTransportHarnessInput {
  ownershipDecision?: LocalBridgeRequesterOwnershipDecision | null;
  dryRunResult?: LocalBridgeDryRunTransportResultInput | null;
}

const HARNESS_BOUNDARY = 'dry-run-transport-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
const OWNERSHIP_BOUNDARY = 'ownership-metadata-only-no-fetch-no-socket-no-storage-no-provider-no-credentials';
const MAX_IDENTIFIER_LENGTH = 180;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:@/+~-]+$/;
const CREDENTIAL_REFERENCE_PREFIX = 'local-bridge:';
const URL_OR_SCHEME_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const ROOT_KEYS = new Set(['dryRunResult', 'ownershipDecision']);
const DRY_RUN_RESULT_KEYS = new Set([
  'acceptedEndpoint',
  'actionId',
  'body',
  'bridgeKind',
  'capabilityId',
  'credentialReferenceId',
  'directRequester',
  'dispatchAllowed',
  'dryRun',
  'executable',
  'executed',
  'headers',
  'live',
  'liveExecution',
  'method',
  'ownerSurface',
  'probeAllowed',
  'probed',
  'request',
  'requesterId',
  'requesterVersion',
  'responseText',
  'resultId',
  'resultKind',
  'resultText',
  'runId',
  'sideEffectBoundary',
  'sideEffects',
  'text',
  'timeoutMs',
  'traceId',
  'transportId',
  'url',
]);
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
const SECRET_VALUE_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^ghp_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^sk-[a-z0-9_-]{8,}$/i,
  /^pk-[a-z0-9_-]{8,}$/i,
  /^rk-[a-z0-9_-]{8,}$/i,
  /^eyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}$/i,
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /basic\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:api|app|client|refresh|access|session)[_-]?(?:key|token|secret)\s*[:=]\s*\S+/i,
  /(?:oauth|authorization)[\s_-]?code\s*[:=]\s*\S+/i,
] as const;
const TOKEN_SHAPED_IDENTIFIER_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^gh[pousr]_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^(?:sk|pk|rk)-[a-z0-9_-]{8,}$/i,
  /^eyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}$/i,
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

function blocker(
  code: LocalBridgeDryRunTransportHarnessBlockReason,
  detail: string,
  field?: string,
): LocalBridgeDryRunTransportHarnessBlocker {
  return Object.freeze({ code, detail, field });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasUnsafeUnsupportedField(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  seen = new WeakSet<object>(),
): boolean {
  if (seen.has(value)) return false;
  seen.add(value);

  return Object.entries(value).some(([key, nestedValue]) => {
    if (allowedKeys.has(key)) return false;
    const normalized = normalizedKey(key);
    return UNSAFE_FIELD_MARKERS.some((marker) => normalized.includes(marker))
      || valueContainsFunction(nestedValue, seen);
  });
}

function valueContainsFunction(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((entry) => valueContainsFunction(entry, seen));
  return Object.entries(value).some(([key, nestedValue]) => {
    const normalized = normalizedKey(key);
    return UNSAFE_FIELD_MARKERS.some((marker) => normalized.includes(marker))
      || valueContainsFunction(nestedValue, seen);
  });
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
  if (typeof value === 'string') return stringLooksSecretBearing(value);
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasSecretMaterial(item, seen));

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (SECRET_URL_PARAM_MARKERS.some((marker) => normalizedKey.includes(marker))) return true;
    if (valueHasSecretMaterial(nestedValue, seen)) return true;
  }
  return false;
}

function sameString(left: unknown, right: string): boolean {
  return normalizedString(left) === right;
}

function credentialId(descriptor: LocalBridgeRequesterOwnershipDescriptor): string | undefined {
  return descriptor.credentialReference?.id;
}

function resultIdentifier(result: LocalBridgeDryRunTransportResultInput): string | undefined {
  return safeIdentifier(result.resultId ?? result.transportId ?? result.traceId);
}

function addOwnershipBlockers(
  decision: LocalBridgeRequesterOwnershipDecision | null | undefined,
  blockers: LocalBridgeDryRunTransportHarnessBlocker[],
): LocalBridgeRequesterOwnershipDescriptor | undefined {
  if (!decision) {
    blockers.push(blocker('ownership_decision_missing', 'Dry-run transport metadata requires an ownership decision.', 'ownershipDecision'));
    return undefined;
  }
  if (decision.status !== 'owned' || decision.owned !== true) {
    blockers.push(blocker('ownership_decision_blocked', 'Only owned local bridge requester decisions can bind dry-run transport metadata.', 'ownershipDecision.status'));
  }
  if (decision.sideEffectBoundary !== OWNERSHIP_BOUNDARY) {
    blockers.push(blocker('ownership_boundary_mismatch', 'Ownership decision boundary must remain metadata-only.', 'ownershipDecision.sideEffectBoundary'));
  }
  if (!decision.descriptor) {
    blockers.push(blocker('ownership_descriptor_missing', 'Owned dry-run transport metadata requires an ownership descriptor.', 'ownershipDecision.descriptor'));
    return undefined;
  }
  const descriptor = decision.descriptor;
  if (
    descriptor.descriptorKind !== 'local-bridge-requester-ownership'
    || descriptor.executable !== false
    || descriptor.dispatchAllowed !== false
    || descriptor.sideEffects !== 'none'
    || descriptor.sideEffectBoundary !== OWNERSHIP_BOUNDARY
  ) {
    blockers.push(blocker('ownership_boundary_mismatch', 'Ownership descriptor must be inert and dispatch-blocked.', 'ownershipDecision.descriptor'));
  }
  return descriptor;
}

function addResultShapeBlockers(
  result: LocalBridgeDryRunTransportResultInput | null | undefined,
  blockers: LocalBridgeDryRunTransportHarnessBlocker[],
): result is LocalBridgeDryRunTransportResultInput {
  if (!result) {
    blockers.push(blocker('dry_run_result_missing', 'Dry-run transport metadata requires an injected result object.', 'dryRunResult'));
    return false;
  }
  if (!isRecord(result)) {
    blockers.push(blocker('dry_run_result_invalid', 'Dry-run transport result must be a bounded metadata object.', 'dryRunResult'));
    return false;
  }
  if (!hasOnlyAllowedKeys(result, DRY_RUN_RESULT_KEYS)) {
    blockers.push(blocker('dry_run_result_invalid', 'Dry-run transport result contained unsupported field(s).', 'dryRunResult'));
  }
  if (hasUnsafeUnsupportedField(result, DRY_RUN_RESULT_KEYS)) {
    blockers.push(blocker('input_shape_forbidden', 'Dry-run transport result cannot carry callback, requester, fetch, socket, storage, provider, live-action, or secret-shaped fields.', 'dryRunResult'));
  }
  if (result.resultKind !== 'local-bridge-dry-run-transport-result' || result.dryRun !== true) {
    blockers.push(blocker('dry_run_result_invalid', 'Dry-run transport result must explicitly identify itself as a dry-run result.', 'dryRunResult.resultKind'));
  }
  return true;
}

function addBoundaryBlockers(
  result: LocalBridgeDryRunTransportResultInput,
  blockers: LocalBridgeDryRunTransportHarnessBlocker[],
): void {
  if (result.dispatchAllowed !== false || result.executable !== false || result.sideEffects !== 'none') {
    blockers.push(blocker('dispatch_boundary_mismatch', 'Dry-run transport result must be dispatchAllowed=false, executable=false, and sideEffects=none.', 'dryRunResult'));
  }
  if (
    result.executed === true
    || result.probed === true
    || result.live === true
    || result.liveExecution === true
    || result.probeAllowed === true
  ) {
    blockers.push(blocker('forged_live_execution_flag', 'Dry-run transport result cannot claim probe, execution, or live flags.', 'dryRunResult'));
  }
}

function addPayloadBlockers(
  result: LocalBridgeDryRunTransportResultInput,
  blockers: LocalBridgeDryRunTransportHarnessBlocker[],
): void {
  if (result.headers !== undefined || (isRecord(result.request) && result.request.headers !== undefined)) {
    blockers.push(blocker('headers_forbidden', 'Dry-run transport metadata never accepts or echoes header payloads.', 'dryRunResult.headers'));
  }
  if (result.body !== undefined || (isRecord(result.request) && result.request.body !== undefined)) {
    blockers.push(blocker('body_forbidden', 'Dry-run transport metadata never accepts or echoes body payloads.', 'dryRunResult.body'));
  }
  if (
    valueHasSecretMaterial(result.headers)
    || valueHasSecretMaterial(result.body)
    || valueHasSecretMaterial(result.request)
    || valueHasSecretMaterial(result.responseText)
    || valueHasSecretMaterial(result.resultText)
    || valueHasSecretMaterial(result.text)
  ) {
    blockers.push(blocker('raw_secret_material', 'Dry-run transport result must not carry secret-bearing payloads or result text.', 'dryRunResult'));
  }
  if (result.directRequester !== undefined) {
    blockers.push(blocker('direct_requester_forbidden', 'Direct requester functions are outside the dry-run transport metadata boundary.', 'dryRunResult.directRequester'));
  }
}

function addIdentifierBlockers(
  result: LocalBridgeDryRunTransportResultInput,
  blockers: LocalBridgeDryRunTransportHarnessBlocker[],
): void {
  for (const [field, value] of Object.entries({
    capabilityId: result.capabilityId,
    requesterId: result.requesterId,
    requesterVersion: result.requesterVersion,
    ownerSurface: result.ownerSurface,
    actionId: result.actionId,
    resultId: result.resultId,
    runId: result.runId,
    transportId: result.transportId,
    traceId: result.traceId,
  })) {
    if (value === undefined) continue;
    if (!safeIdentifier(value)) {
      blockers.push(blocker('token_shaped_identifier', 'Dry-run transport identifiers must be bounded opaque metadata, not token-shaped values.', `dryRunResult.${field}`));
    }
  }
  if (
    result.credentialReferenceId !== undefined
    && !safeCredentialReferenceIdentifier(result.credentialReferenceId)
  ) {
    blockers.push(blocker('token_shaped_identifier', 'Dry-run transport credential reference must be a bounded opaque handle, not arbitrary URL or token-shaped material.', 'dryRunResult.credentialReferenceId'));
  }
}

function addMatchBlockers(
  descriptor: LocalBridgeRequesterOwnershipDescriptor,
  result: LocalBridgeDryRunTransportResultInput,
  blockers: LocalBridgeDryRunTransportHarnessBlocker[],
): void {
  if (
    !sameString(result.ownerSurface, descriptor.owner.ownerSurface)
    || !sameString(result.actionId, descriptor.owner.actionId)
  ) {
    blockers.push(blocker('owner_mismatch', 'Dry-run transport owner must match requester ownership exactly.', 'dryRunResult.owner'));
  }
  if (
    !sameString(result.capabilityId, descriptor.capability.id)
    || !sameString(result.requesterId, descriptor.capability.requesterId)
    || !sameString(result.requesterVersion, descriptor.capability.requesterVersion)
  ) {
    blockers.push(blocker('capability_mismatch', 'Dry-run transport capability identity must match requester ownership exactly.', 'dryRunResult.capability'));
  }
  if (
    !sameString(result.bridgeKind, descriptor.bridge.bridgeKind)
    || !sameString(result.acceptedEndpoint, descriptor.bridge.acceptedEndpoint)
  ) {
    blockers.push(blocker('bridge_mismatch', 'Dry-run transport bridge kind and accepted endpoint must match requester ownership exactly.', 'dryRunResult.bridge'));
  }
  if (result.method !== descriptor.bridge.method) {
    blockers.push(blocker('transport_method_mismatch', 'Dry-run transport method must match requester ownership exactly.', 'dryRunResult.method'));
  }
  const resultUrl = absoluteHttpUrl(result.url);
  if (!resultUrl) {
    blockers.push(blocker('schemeless_url_ambiguous', 'Dry-run transport URL must include an explicit http or https scheme.', 'dryRunResult.url'));
  } else if (urlHasSecretMaterial(resultUrl)) {
    blockers.push(blocker('secret_bearing_url', 'Dry-run transport URL must not include authority credentials, fragments, token parameters, or secret-like values.', 'dryRunResult.url'));
  } else if (resultUrl !== descriptor.bridge.url) {
    blockers.push(blocker('transport_url_mismatch', 'Dry-run transport URL must match requester ownership exactly.', 'dryRunResult.url'));
  }
  if (result.timeoutMs !== descriptor.bridge.timeoutMs) {
    blockers.push(blocker('transport_timeout_mismatch', 'Dry-run transport timeout must match requester ownership exactly.', 'dryRunResult.timeoutMs'));
  }
  const expectedCredentialId = credentialId(descriptor);
  if (expectedCredentialId !== normalizedString(result.credentialReferenceId)) {
    blockers.push(blocker('credential_reference_mismatch', 'Dry-run transport credential reference id must match requester ownership exactly.', 'dryRunResult.credentialReferenceId'));
  }
}

function buildMetadata(
  descriptor: LocalBridgeRequesterOwnershipDescriptor,
  result: LocalBridgeDryRunTransportResultInput,
): LocalBridgeDryRunTransportMetadata {
  const safeResultId = resultIdentifier(result);
  return Object.freeze({
    schemaVersion: 1,
    metadataKind: 'local-bridge-dry-run-transport',
    capability: Object.freeze({
      id: descriptor.capability.id,
      requesterId: descriptor.capability.requesterId,
      requesterVersion: descriptor.capability.requesterVersion,
    }),
    owner: Object.freeze({
      ownerSurface: descriptor.owner.ownerSurface,
      actionId: descriptor.owner.actionId,
    }),
    bridge: Object.freeze({
      bridgeKind: descriptor.bridge.bridgeKind,
      acceptedEndpoint: descriptor.bridge.acceptedEndpoint,
    }),
    transport: Object.freeze({
      method: descriptor.bridge.method,
      url: descriptor.bridge.url,
      timeoutMs: descriptor.bridge.timeoutMs,
    }),
    credentialReferenceId: credentialId(descriptor),
    resultId: safeResultId,
    dispatchAllowed: false,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: HARNESS_BOUNDARY,
  });
}

export function bindLocalBridgeDryRunTransportHarness(
  input: LocalBridgeDryRunTransportHarnessInput = {},
): LocalBridgeDryRunTransportHarnessDecision {
  const blockers: LocalBridgeDryRunTransportHarnessBlocker[] = [];
  if (!isRuntimeTrustedContractObject(input)) {
    blockers.push(blocker('input_shape_forbidden', 'Dry-run transport harness input cannot carry callback, requester, fetch, socket, storage, provider, live-action, or secret-shaped fields.', 'input'));
    return Object.freeze({
      status: 'blocked',
      accepted: false,
      metadata: undefined,
      blockers: Object.freeze(blockers),
      sideEffectBoundary: HARNESS_BOUNDARY,
    });
  }
  if (!hasOnlyAllowedKeys(input, ROOT_KEYS) || hasUnsafeUnsupportedField(input, ROOT_KEYS)) {
    blockers.push(blocker('input_shape_forbidden', 'Dry-run transport harness input cannot carry callback, requester, fetch, socket, storage, provider, live-action, or secret-shaped fields.', 'input'));
  }

  const rawOwnershipDecision = input.ownershipDecision;
  const rawDryRunResult = input.dryRunResult;
  if (
    rawOwnershipDecision !== undefined
    && rawOwnershipDecision !== null
    && !isRuntimeTrustedContractObject(rawOwnershipDecision)
  ) {
    blockers.push(blocker('input_shape_forbidden', 'Dry-run transport ownership decision must be supplied through a trusted contract object.', 'ownershipDecision'));
  }
  if (
    rawDryRunResult !== undefined
    && rawDryRunResult !== null
    && !isRuntimeTrustedContractObject(rawDryRunResult)
  ) {
    blockers.push(blocker('input_shape_forbidden', 'Dry-run transport result must be supplied through a trusted contract object.', 'dryRunResult'));
  }
  const ownershipDecision = isRuntimeTrustedContractObject(rawOwnershipDecision) || rawOwnershipDecision === null
    ? rawOwnershipDecision
    : undefined;
  const dryRunResult = isRuntimeTrustedContractObject(rawDryRunResult) || rawDryRunResult === null
    ? rawDryRunResult
    : undefined;
  const descriptor = addOwnershipBlockers(ownershipDecision, blockers);
  const hasResult = addResultShapeBlockers(dryRunResult, blockers);

  if (hasResult) {
    addBoundaryBlockers(dryRunResult, blockers);
    addPayloadBlockers(dryRunResult, blockers);
    addIdentifierBlockers(dryRunResult, blockers);
    if (descriptor) addMatchBlockers(descriptor, dryRunResult, blockers);
  }

  const accepted = blockers.length === 0 && descriptor !== undefined && hasResult;
  return Object.freeze({
    status: accepted ? 'accepted' : 'blocked',
    accepted,
    metadata: accepted ? buildMetadata(descriptor, dryRunResult) : undefined,
    blockers: Object.freeze(blockers),
    sideEffectBoundary: HARNESS_BOUNDARY,
  });
}
