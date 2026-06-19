import type {
  LocalBridgeRequesterExecutionBoundaryDecision,
  LocalBridgeRequesterExecutionBoundaryMetadata,
} from './local-bridge-requester-execution-boundary';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractObject,
} from './runtime-trusted-contract-object';

export type LocalBridgeRequesterInvocationImplementationStatus = 'ready' | 'blocked';

export type LocalBridgeRequesterInvocationImplementationReason =
  | 'requester_invocation_boundary_ready'
  | 'execution_boundary_missing'
  | 'execution_boundary_not_ready'
  | 'execution_boundary_invalid'
  | 'requester_facts_missing'
  | 'requester_facts_unreviewed'
  | 'requester_owner_mismatch'
  | 'requester_identity_unsafe'
  | 'requester_side_effect_boundary_invalid'
  | 'requester_executable_contract_missing'
  | 'requester_executable_contract_invalid'
  | 'requester_executable_contract_unreviewed'
  | 'requester_executable_contract_mismatch'
  | 'requester_shape_forbidden'
  | 'requester_result_forbidden'
  | 'requester_result_live_claim'
  | 'raw_secret_material';

export interface LocalBridgeRequesterInvocationFacts {
  contract: 'local-bridge-requester-invocation-implementation-facts-v1';
  capabilityId: string;
  requesterId: string;
  requesterVersion: string;
  ownerSurface: string;
  actionId: string;
  bridgeKind: string;
  acceptedEndpoint: string;
  method: 'GET';
  url: string;
  timeoutMs: number;
  credentialReferenceId?: string;
  dryRunResultId?: string;
  requesterImplementationId: string;
  requesterPackageVersion: string;
  reviewState: 'reviewed';
  invocationMode: 'decision-only';
  executable: false;
  requesterCallable: false;
  willInvokeRequester: false;
  willProbeLocalBridge: false;
  willCallProvider: false;
  willMutateStorage: false;
  willStoreCredential: false;
  sideEffectBoundary: 'requester-invocation-facts-only-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call';
}

export type LocalBridgeRequesterInvocationExecutableContractReviewState =
  | 'reviewed'
  | 'draft'
  | 'unreviewed'
  | 'stale'
  | 'revoked'
  | 'expired';

export interface LocalBridgeRequesterInvocationExecutableContract {
  contract: 'local-bridge-requester-invocation-executable-contract-v1';
  contractKind: 'reviewed-injected-local-bridge-requester-executable-contract';
  capabilityId: string;
  requesterId: string;
  requesterVersion: string;
  ownerSurface: string;
  actionId: string;
  bridgeKind: string;
  acceptedEndpoint: string;
  method: 'GET';
  url: string;
  timeoutMs: number;
  credentialReferenceId?: string;
  dryRunResultId?: string;
  requesterImplementationId: string;
  requesterPackageVersion: string;
  requesterContractId: string;
  requesterContractVersion: string;
  reviewState: LocalBridgeRequesterInvocationExecutableContractReviewState;
  injectionMode: 'explicit-reviewed-injected-requester';
  resultRedaction: 'result-body-omitted';
  headersRedaction: 'headers-omitted';
  bodyRedaction: 'body-omitted';
  supportsExecution: true;
  requiresExplicitUserApprovalBeforeRequest: true;
  executable: false;
  requesterCallable: false;
  dispatchAllowed: false;
  willInvokeRequester: false;
  willProbeLocalBridge: false;
  willCallProvider: false;
  willMutateStorage: false;
  willStoreCredential: false;
  sideEffects: 'none';
  sideEffectBoundary: 'reviewed-injected-local-bridge-requester-executable-contract-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call';
}

export interface LocalBridgeRequesterInvocationImplementationInput {
  executionBoundary?: LocalBridgeRequesterExecutionBoundaryDecision | null;
  requesterFacts?: unknown;
  executableContract?: unknown;
  requester?: unknown;
  requesterResult?: unknown;
}

export interface LocalBridgeRequesterInvocationImplementationDecision {
  status: LocalBridgeRequesterInvocationImplementationStatus;
  ready: boolean;
  reason: LocalBridgeRequesterInvocationImplementationReason;
  capability?: {
    id: string;
    requesterId: string;
    requesterVersion: string;
  };
  owner?: {
    ownerSurface: string;
    actionId: string;
  };
  bridge?: {
    bridgeKind: string;
    acceptedEndpoint: string;
  };
  transport?: {
    method: 'GET';
    url: string;
    timeoutMs: number;
  };
  credentialReferenceId?: string;
  dryRunResultId?: string;
  requesterImplementationId?: string;
  requesterPackageVersion?: string;
  canPrepareFutureRequesterInvocation: boolean;
  executableContract?: {
    contract: 'local-bridge-requester-invocation-prepared-executable-contract-v1';
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
    transport: {
      method: 'GET';
      url: string;
      timeoutMs: number;
    };
    credentialReferenceId?: string;
    dryRunResultId?: string;
    requesterImplementationId: string;
    requesterPackageVersion: string;
    requesterContractId: string;
    requesterContractVersion: string;
    injectionMode: 'explicit-reviewed-injected-requester';
    resultRedaction: 'result-body-omitted';
    headersRedaction: 'headers-omitted';
    bodyRedaction: 'body-omitted';
    supportsExecution: true;
    requiresExplicitUserApprovalBeforeRequest: true;
    dispatchAllowed: false;
    executable: false;
    requesterCallable: false;
    willInvokeRequester: false;
    willProbeLocalBridge: false;
    willCallProvider: false;
    willMutateStorage: false;
    willStoreCredential: false;
    sideEffects: 'none';
    sideEffectBoundary: 'reviewed-injected-local-bridge-requester-executable-contract-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call';
  };
  invocationMode: 'decision-only';
  executable: false;
  requesterCallable: false;
  willInvokeRequester: false;
  willProbeLocalBridge: false;
  willCallProvider: false;
  willMutateStorage: false;
  willStoreCredential: false;
  sideEffectBoundary: 'pure-local-requester-invocation-implementation-boundary-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call';
}

const FACTS_BOUNDARY =
  'requester-invocation-facts-only-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call' as const;
const EXECUTABLE_CONTRACT_BOUNDARY =
  'reviewed-injected-local-bridge-requester-executable-contract-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call' as const;
const DECISION_BOUNDARY =
  'pure-local-requester-invocation-implementation-boundary-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call' as const;
const EXECUTION_BOUNDARY =
  'requester-execution-boundary-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-callback' as const;
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_TIMEOUT_MS = 30_000;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{1,179}$/;
const CREDENTIAL_REFERENCE_PREFIX = 'local-bridge:';
const URL_OR_SCHEME_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const TOKEN_OR_URL_PATTERN =
  /(?:https?:\/\/|wss?:\/\/|xox[abprs]-|bearer\s+[a-z0-9._~+/=-]{8,}|(?:api|app|bot|client|refresh|access|session)[_-]?(?:key|token|secret)[=:]\s*\S+|-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----)/i;
const SECRET_VALUE_PATTERNS = [
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
const FACT_KEYS = new Set([
  'acceptedEndpoint',
  'actionId',
  'bridgeKind',
  'capabilityId',
  'contract',
  'credentialReferenceId',
  'dryRunResultId',
  'executable',
  'invocationMode',
  'method',
  'ownerSurface',
  'requesterCallable',
  'requesterId',
  'requesterImplementationId',
  'requesterPackageVersion',
  'requesterVersion',
  'reviewState',
  'sideEffectBoundary',
  'timeoutMs',
  'url',
  'willCallProvider',
  'willInvokeRequester',
  'willMutateStorage',
  'willProbeLocalBridge',
  'willStoreCredential',
]);
const EXECUTABLE_CONTRACT_KEYS = new Set([
  'acceptedEndpoint',
  'actionId',
  'bodyRedaction',
  'bridgeKind',
  'capabilityId',
  'contract',
  'contractKind',
  'credentialReferenceId',
  'dispatchAllowed',
  'dryRunResultId',
  'executable',
  'headersRedaction',
  'injectionMode',
  'method',
  'ownerSurface',
  'requesterCallable',
  'requesterContractId',
  'requesterContractVersion',
  'requesterId',
  'requesterImplementationId',
  'requesterPackageVersion',
  'requesterVersion',
  'requiresExplicitUserApprovalBeforeRequest',
  'resultRedaction',
  'reviewState',
  'sideEffectBoundary',
  'sideEffects',
  'supportsExecution',
  'timeoutMs',
  'url',
  'willCallProvider',
  'willInvokeRequester',
  'willMutateStorage',
  'willProbeLocalBridge',
  'willStoreCredential',
]);
const ROOT_INPUT_KEYS = new Set([
  'executableContract',
  'executionBoundary',
  'requester',
  'requesterFacts',
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
  /provider/i,
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
const LIVE_RESULT_CLAIM_KEYS = new Set([
  'calledprovider',
  'dispatched',
  'executed',
  'fetchcalled',
  'invokedrequester',
  'live',
  'liveaction',
  'liveexecution',
  'mutatedstorage',
  'openedsocket',
  'probed',
  'providercalled',
  'requestercalled',
  'socketopened',
  'stored',
  'storedcredential',
  'willcallprovider',
  'willfetch',
  'willinvokerequester',
  'willmutatestorage',
  'willopensocket',
  'willprobelocalbridge',
  'willstorecredential',
  'executable',
]);
const VALID_EXECUTABLE_CONTRACT_REVIEW_STATES =
  new Set<LocalBridgeRequesterInvocationExecutableContractReviewState>([
    'reviewed',
    'draft',
    'unreviewed',
    'stale',
    'revoked',
    'expired',
  ]);

function isTrustedContractRecord(value: unknown): value is RuntimeTrustedContractObject & Record<string, unknown> {
  return isRuntimeTrustedContractObject(value);
}

function isRecord(value: unknown): value is RuntimeTrustedContractObject & Record<string, unknown> {
  return isTrustedContractRecord(value);
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringLooksSecretBearing(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function identifierLooksUrlOrSchemeShaped(value: string): boolean {
  return URL_OR_SCHEME_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function safeBaseIdentifier(value: unknown): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) return undefined;
  if (
    normalized.length > MAX_IDENTIFIER_LENGTH
    || !SAFE_ID_PATTERN.test(normalized)
    || TOKEN_OR_URL_PATTERN.test(normalized)
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

function unsafeIdentifier(value: unknown): boolean {
  return value !== undefined && safeIdentifier(value) === undefined;
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

function endpointAndProbeAreBound(endpoint: unknown, probeUrl: unknown): boolean {
  const acceptedEndpoint = exactLoopbackHttpUrl(endpoint);
  const transportUrl = exactLoopbackHttpUrl(probeUrl);
  if (!acceptedEndpoint || !transportUrl) return false;
  try {
    const endpointUrl = new URL(acceptedEndpoint);
    const probe = new URL(transportUrl);
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

function executionMetadataHasRequiredShape(
  value: unknown,
): value is LocalBridgeRequesterExecutionBoundaryMetadata {
  if (!isTrustedContractRecord(value)) return false;
  return isRecord(value.capability)
    && isRecord(value.owner)
    && isRecord(value.bridge)
    && isRecord(value.transport);
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
  if (!isTrustedContractRecord(value)) return true;
  if (seen.has(value)) return false;
  seen.add(value);

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (SECRET_URL_PARAM_MARKERS.some((marker) => normalizedKey === marker || normalizedKey.endsWith(marker))) {
      if (typeof nestedValue === 'string' && normalizedString(nestedValue)) return true;
      if (valueHasSecretMaterial(nestedValue, seen)) return true;
      continue;
    }
    if (valueHasSecretMaterial(nestedValue, seen)) return true;
  }
  return false;
}

function metadataValuesHaveSecretMaterial(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') {
    const maybeUrl = absoluteHttpUrl(value);
    return stringLooksSecretBearing(value) || (maybeUrl !== undefined && urlHasSecretMaterial(maybeUrl));
  }
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => metadataValuesHaveSecretMaterial(item, seen));
  if (!isTrustedContractRecord(value)) return true;
  if (seen.has(value)) return false;
  seen.add(value);

  return Object.values(value).some((nestedValue) => metadataValuesHaveSecretMaterial(nestedValue, seen));
}

function isSafeTimeout(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
    && value <= MAX_TIMEOUT_MS;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function hasOnlyAllowedFactKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => FACT_KEYS.has(key));
}

function hasUnsafeExtraInputKey(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => {
    if (ROOT_INPUT_KEYS.has(key)) return false;
    return UNSAFE_INPUT_FIELD_PATTERNS.some((pattern) => pattern.test(key));
  });
}

function parseRequesterFacts(value: unknown): LocalBridgeRequesterInvocationFacts | undefined {
  if (!isTrustedContractRecord(value) || !hasOnlyAllowedFactKeys(value)) return undefined;

  const capabilityId = safeIdentifier(value.capabilityId);
  const requesterId = safeIdentifier(value.requesterId);
  const requesterVersion = safeIdentifier(value.requesterVersion);
  const ownerSurface = safeIdentifier(value.ownerSurface);
  const actionId = safeIdentifier(value.actionId);
  const bridgeKind = safeIdentifier(value.bridgeKind);
  const acceptedEndpoint = exactLoopbackHttpUrl(value.acceptedEndpoint);
  const url = exactLoopbackHttpUrl(value.url);
  const credentialReferenceId = safeCredentialReferenceIdentifier(value.credentialReferenceId);
  const dryRunResultId = safeIdentifier(value.dryRunResultId);
  const requesterImplementationId = safeIdentifier(value.requesterImplementationId);
  const requesterPackageVersion = safeIdentifier(value.requesterPackageVersion);

  if (
    value.contract !== 'local-bridge-requester-invocation-implementation-facts-v1'
    || !capabilityId
    || !requesterId
    || !requesterVersion
    || !ownerSurface
    || !actionId
    || !bridgeKind
    || !acceptedEndpoint
    || value.method !== 'GET'
    || !url
    || !isSafeTimeout(value.timeoutMs)
    || (value.credentialReferenceId !== undefined && !credentialReferenceId)
    || (value.dryRunResultId !== undefined && !dryRunResultId)
    || !requesterImplementationId
    || !requesterPackageVersion
    || value.reviewState !== 'reviewed'
    || value.invocationMode !== 'decision-only'
    || value.sideEffectBoundary !== FACTS_BOUNDARY
    || !endpointAndProbeAreBound(acceptedEndpoint, url)
    || urlHasSecretMaterial(acceptedEndpoint)
    || urlHasSecretMaterial(url)
  ) {
    return undefined;
  }

  return Object.freeze({
    contract: 'local-bridge-requester-invocation-implementation-facts-v1',
    capabilityId,
    requesterId,
    requesterVersion,
    ownerSurface,
    actionId,
    bridgeKind,
    acceptedEndpoint,
    method: 'GET',
    url,
    timeoutMs: value.timeoutMs,
    ...(credentialReferenceId ? { credentialReferenceId } : {}),
    ...(dryRunResultId ? { dryRunResultId } : {}),
    requesterImplementationId,
    requesterPackageVersion,
    reviewState: 'reviewed',
    invocationMode: 'decision-only',
    executable: value.executable,
    requesterCallable: value.requesterCallable,
    willInvokeRequester: value.willInvokeRequester,
    willProbeLocalBridge: value.willProbeLocalBridge,
    willCallProvider: value.willCallProvider,
    willMutateStorage: value.willMutateStorage,
    willStoreCredential: value.willStoreCredential,
    sideEffectBoundary: FACTS_BOUNDARY,
  } as LocalBridgeRequesterInvocationFacts);
}

function parseExecutableContract(value: unknown): LocalBridgeRequesterInvocationExecutableContract | undefined {
  if (!isTrustedContractRecord(value) || !hasOnlyKeys(value, EXECUTABLE_CONTRACT_KEYS)) return undefined;

  const capabilityId = safeIdentifier(value.capabilityId);
  const requesterId = safeIdentifier(value.requesterId);
  const requesterVersion = safeIdentifier(value.requesterVersion);
  const ownerSurface = safeIdentifier(value.ownerSurface);
  const actionId = safeIdentifier(value.actionId);
  const bridgeKind = safeIdentifier(value.bridgeKind);
  const acceptedEndpoint = exactLoopbackHttpUrl(value.acceptedEndpoint);
  const url = exactLoopbackHttpUrl(value.url);
  const credentialReferenceId = safeCredentialReferenceIdentifier(value.credentialReferenceId);
  const dryRunResultId = safeIdentifier(value.dryRunResultId);
  const requesterImplementationId = safeIdentifier(value.requesterImplementationId);
  const requesterPackageVersion = safeIdentifier(value.requesterPackageVersion);
  const requesterContractId = safeIdentifier(value.requesterContractId);
  const requesterContractVersion = safeIdentifier(value.requesterContractVersion);
  const reviewState = typeof value.reviewState === 'string'
    && VALID_EXECUTABLE_CONTRACT_REVIEW_STATES.has(
      value.reviewState as LocalBridgeRequesterInvocationExecutableContractReviewState,
    )
    ? value.reviewState as LocalBridgeRequesterInvocationExecutableContractReviewState
    : undefined;

  if (
    value.contract !== 'local-bridge-requester-invocation-executable-contract-v1'
    || value.contractKind !== 'reviewed-injected-local-bridge-requester-executable-contract'
    || !capabilityId
    || !requesterId
    || !requesterVersion
    || !ownerSurface
    || !actionId
    || !bridgeKind
    || !acceptedEndpoint
    || value.method !== 'GET'
    || !url
    || !isSafeTimeout(value.timeoutMs)
    || (value.credentialReferenceId !== undefined && !credentialReferenceId)
    || (value.dryRunResultId !== undefined && !dryRunResultId)
    || !requesterImplementationId
    || !requesterPackageVersion
    || !requesterContractId
    || !requesterContractVersion
    || !reviewState
    || value.injectionMode !== 'explicit-reviewed-injected-requester'
    || value.resultRedaction !== 'result-body-omitted'
    || value.headersRedaction !== 'headers-omitted'
    || value.bodyRedaction !== 'body-omitted'
    || value.supportsExecution !== true
    || value.requiresExplicitUserApprovalBeforeRequest !== true
    || value.dispatchAllowed !== false
    || value.sideEffects !== 'none'
    || value.sideEffectBoundary !== EXECUTABLE_CONTRACT_BOUNDARY
    || !endpointAndProbeAreBound(acceptedEndpoint, url)
    || urlHasSecretMaterial(acceptedEndpoint)
    || urlHasSecretMaterial(url)
  ) {
    return undefined;
  }

  return Object.freeze({
    contract: 'local-bridge-requester-invocation-executable-contract-v1',
    contractKind: 'reviewed-injected-local-bridge-requester-executable-contract',
    capabilityId,
    requesterId,
    requesterVersion,
    ownerSurface,
    actionId,
    bridgeKind,
    acceptedEndpoint,
    method: 'GET',
    url,
    timeoutMs: value.timeoutMs,
    ...(credentialReferenceId ? { credentialReferenceId } : {}),
    ...(dryRunResultId ? { dryRunResultId } : {}),
    requesterImplementationId,
    requesterPackageVersion,
    requesterContractId,
    requesterContractVersion,
    reviewState,
    injectionMode: 'explicit-reviewed-injected-requester',
    resultRedaction: 'result-body-omitted',
    headersRedaction: 'headers-omitted',
    bodyRedaction: 'body-omitted',
    supportsExecution: true,
    requiresExplicitUserApprovalBeforeRequest: true,
    executable: value.executable,
    requesterCallable: value.requesterCallable,
    dispatchAllowed: false,
    willInvokeRequester: value.willInvokeRequester,
    willProbeLocalBridge: value.willProbeLocalBridge,
    willCallProvider: value.willCallProvider,
    willMutateStorage: value.willMutateStorage,
    willStoreCredential: value.willStoreCredential,
    sideEffects: 'none',
    sideEffectBoundary: EXECUTABLE_CONTRACT_BOUNDARY,
  } as LocalBridgeRequesterInvocationExecutableContract);
}

function executionBoundaryIsReady(
  decision: LocalBridgeRequesterExecutionBoundaryDecision,
): boolean {
  if (!isTrustedContractRecord(decision) || !hasOnlyKeys(decision, new Set([
    'blockers',
    'eligible',
    'metadata',
    'sideEffectBoundary',
    'status',
  ]))) {
    return false;
  }
  const metadata = decision.metadata;
  if (!executionMetadataHasRequiredShape(metadata)) return false;
  return decision.status === 'eligible'
    && decision.eligible === true
    && Array.isArray(decision.blockers)
    && decision.blockers.length === 0
    && decision.sideEffectBoundary === EXECUTION_BOUNDARY
    && metadata !== undefined
    && metadata.metadataKind === 'local-bridge-requester-execution-boundary'
    && metadata.executionEligible === true
    && metadata.willInvokeRequester === false
    && metadata.willProbeLocalBridge === false
    && metadata.willCallProvider === false
    && metadata.willMutateStorage === false
    && metadata.dispatchAllowed === false
    && metadata.executable === false
    && metadata.sideEffects === 'none'
    && metadata.sideEffectBoundary === EXECUTION_BOUNDARY
    && safeIdentifier(metadata.capability.id) !== undefined
    && safeIdentifier(metadata.capability.requesterId) !== undefined
    && safeIdentifier(metadata.capability.requesterVersion) !== undefined
    && safeIdentifier(metadata.owner.ownerSurface) !== undefined
    && safeIdentifier(metadata.owner.actionId) !== undefined
    && safeIdentifier(metadata.bridge.bridgeKind) !== undefined
    && exactLoopbackHttpUrl(metadata.bridge.acceptedEndpoint) === metadata.bridge.acceptedEndpoint
    && metadata.transport.method === 'GET'
    && exactLoopbackHttpUrl(metadata.transport.url) === metadata.transport.url
    && isSafeTimeout(metadata.transport.timeoutMs)
    && endpointAndProbeAreBound(metadata.bridge.acceptedEndpoint, metadata.transport.url)
    && !urlHasSecretMaterial(metadata.bridge.acceptedEndpoint)
    && !urlHasSecretMaterial(metadata.transport.url)
    && (metadata.credentialReferenceId === undefined
      || safeCredentialReferenceIdentifier(metadata.credentialReferenceId) !== undefined)
    && (metadata.dryRunResultId === undefined || safeIdentifier(metadata.dryRunResultId) !== undefined);
}

function requesterFactsAreInert(facts: LocalBridgeRequesterInvocationFacts): boolean {
  return facts.reviewState === 'reviewed'
    && facts.invocationMode === 'decision-only'
    && facts.executable === false
    && facts.requesterCallable === false
    && facts.willInvokeRequester === false
    && facts.willProbeLocalBridge === false
    && facts.willCallProvider === false
    && facts.willMutateStorage === false
    && facts.willStoreCredential === false
    && facts.sideEffectBoundary === FACTS_BOUNDARY;
}

function executableContractIsReviewedAndInert(contract: LocalBridgeRequesterInvocationExecutableContract): boolean {
  return contract.reviewState === 'reviewed'
    && contract.executable === false
    && contract.requesterCallable === false
    && contract.dispatchAllowed === false
    && contract.willInvokeRequester === false
    && contract.willProbeLocalBridge === false
    && contract.willCallProvider === false
    && contract.willMutateStorage === false
    && contract.willStoreCredential === false
    && contract.sideEffects === 'none'
    && contract.sideEffectBoundary === EXECUTABLE_CONTRACT_BOUNDARY;
}

function factsMatchExecutionBoundary(
  metadata: LocalBridgeRequesterExecutionBoundaryMetadata,
  facts: LocalBridgeRequesterInvocationFacts,
): boolean {
  return facts.capabilityId === metadata.capability.id
    && facts.requesterId === metadata.capability.requesterId
    && facts.requesterVersion === metadata.capability.requesterVersion
    && facts.ownerSurface === metadata.owner.ownerSurface
    && facts.actionId === metadata.owner.actionId
    && facts.bridgeKind === metadata.bridge.bridgeKind
    && facts.acceptedEndpoint === metadata.bridge.acceptedEndpoint
    && facts.method === metadata.transport.method
    && facts.url === metadata.transport.url
    && facts.timeoutMs === metadata.transport.timeoutMs
    && facts.credentialReferenceId === metadata.credentialReferenceId
    && facts.dryRunResultId === metadata.dryRunResultId;
}

function executableContractMatchesBoundary(
  metadata: LocalBridgeRequesterExecutionBoundaryMetadata,
  facts: LocalBridgeRequesterInvocationFacts,
  contract: LocalBridgeRequesterInvocationExecutableContract,
): boolean {
  return contract.capabilityId === facts.capabilityId
    && contract.capabilityId === metadata.capability.id
    && contract.requesterId === facts.requesterId
    && contract.requesterId === metadata.capability.requesterId
    && contract.requesterVersion === facts.requesterVersion
    && contract.requesterVersion === metadata.capability.requesterVersion
    && contract.ownerSurface === facts.ownerSurface
    && contract.ownerSurface === metadata.owner.ownerSurface
    && contract.actionId === facts.actionId
    && contract.actionId === metadata.owner.actionId
    && contract.bridgeKind === facts.bridgeKind
    && contract.bridgeKind === metadata.bridge.bridgeKind
    && contract.acceptedEndpoint === facts.acceptedEndpoint
    && contract.acceptedEndpoint === metadata.bridge.acceptedEndpoint
    && contract.method === facts.method
    && contract.method === metadata.transport.method
    && contract.url === facts.url
    && contract.url === metadata.transport.url
    && contract.timeoutMs === facts.timeoutMs
    && contract.timeoutMs === metadata.transport.timeoutMs
    && contract.credentialReferenceId === facts.credentialReferenceId
    && contract.credentialReferenceId === metadata.credentialReferenceId
    && contract.dryRunResultId === facts.dryRunResultId
    && contract.dryRunResultId === metadata.dryRunResultId
    && contract.requesterImplementationId === facts.requesterImplementationId
    && contract.requesterPackageVersion === facts.requesterPackageVersion;
}

function identifiersAreSafe(
  metadata?: LocalBridgeRequesterExecutionBoundaryMetadata,
  facts?: LocalBridgeRequesterInvocationFacts,
): boolean {
  return ![
    metadata?.capability.id,
    metadata?.capability.requesterId,
    metadata?.capability.requesterVersion,
    metadata?.owner.ownerSurface,
    metadata?.owner.actionId,
    metadata?.bridge.bridgeKind,
    metadata?.dryRunResultId,
    facts?.capabilityId,
    facts?.requesterId,
    facts?.requesterVersion,
    facts?.ownerSurface,
    facts?.actionId,
    facts?.bridgeKind,
    facts?.dryRunResultId,
    facts?.requesterImplementationId,
    facts?.requesterPackageVersion,
  ].some(unsafeIdentifier)
    && [
      metadata?.credentialReferenceId,
      facts?.credentialReferenceId,
    ].every((value) => value === undefined || safeCredentialReferenceIdentifier(value) !== undefined);
}

function requesterResultClaimsLiveExecution(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((nested) => requesterResultClaimsLiveExecution(nested, seen));
  if (!isTrustedContractRecord(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value).some(([key, nested]) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (LIVE_RESULT_CLAIM_KEYS.has(normalizedKey) && nested !== false && nested !== undefined && nested !== null) {
      return true;
    }
    return requesterResultClaimsLiveExecution(nested, seen);
  });
}

function freezeDecision(
  reason: LocalBridgeRequesterInvocationImplementationReason,
  execution?: LocalBridgeRequesterExecutionBoundaryDecision | null,
  facts?: LocalBridgeRequesterInvocationFacts,
  executableContract?: LocalBridgeRequesterInvocationExecutableContract,
): Readonly<LocalBridgeRequesterInvocationImplementationDecision> {
  const ready = reason === 'requester_invocation_boundary_ready';
  const metadata = executionMetadataHasRequiredShape(execution?.metadata) ? execution.metadata : undefined;
  const capability = metadata
    ? Object.freeze({
        id: safeIdentifier(metadata.capability.id) ?? 'redacted-unsafe-capability',
        requesterId: safeIdentifier(metadata.capability.requesterId) ?? 'redacted-unsafe-requester',
        requesterVersion: safeIdentifier(metadata.capability.requesterVersion) ?? 'redacted-unsafe-version',
      })
    : undefined;
  const owner = metadata
    ? Object.freeze({
        ownerSurface: safeIdentifier(metadata.owner.ownerSurface) ?? 'redacted-unsafe-owner',
        actionId: safeIdentifier(metadata.owner.actionId) ?? 'redacted-unsafe-action',
      })
    : undefined;
  const hasValidBoundProbe = metadata
    ? endpointAndProbeAreBound(metadata.bridge.acceptedEndpoint, metadata.transport.url)
    : false;
  const bridge = metadata
    && hasValidBoundProbe
    && exactLoopbackHttpUrl(metadata.bridge.acceptedEndpoint) === metadata.bridge.acceptedEndpoint
    ? Object.freeze({
        bridgeKind: safeIdentifier(metadata.bridge.bridgeKind) ?? 'redacted-unsafe-bridge-kind',
        acceptedEndpoint: metadata.bridge.acceptedEndpoint,
      })
    : undefined;
  const transport = metadata
    && hasValidBoundProbe
    && exactLoopbackHttpUrl(metadata.transport.url) === metadata.transport.url
    ? createRuntimeTrustedContractObject([
        ['method', 'GET'],
        ['url', metadata.transport.url],
        ['timeoutMs', isSafeTimeout(metadata.transport.timeoutMs) ? metadata.transport.timeoutMs : 0],
      ])
    : undefined;
  const trustedCapability = capability
    ? createRuntimeTrustedContractObject([
        ['id', capability.id],
        ['requesterId', capability.requesterId],
        ['requesterVersion', capability.requesterVersion],
      ])
    : undefined;
  const trustedOwner = owner
    ? createRuntimeTrustedContractObject([
        ['ownerSurface', owner.ownerSurface],
        ['actionId', owner.actionId],
      ])
    : undefined;
  const trustedBridge = bridge
    ? createRuntimeTrustedContractObject([
        ['bridgeKind', bridge.bridgeKind],
        ['acceptedEndpoint', bridge.acceptedEndpoint],
      ])
    : undefined;
  const preparedExecutableContract = ready && executableContract
    ? createRuntimeTrustedContractObject([
        ['contract', 'local-bridge-requester-invocation-prepared-executable-contract-v1'],
        ['capability', createRuntimeTrustedContractObject([
          ['id', executableContract.capabilityId],
          ['requesterId', executableContract.requesterId],
          ['requesterVersion', executableContract.requesterVersion],
        ])],
        ['owner', createRuntimeTrustedContractObject([
          ['ownerSurface', executableContract.ownerSurface],
          ['actionId', executableContract.actionId],
        ])],
        ['bridge', createRuntimeTrustedContractObject([
          ['bridgeKind', executableContract.bridgeKind],
          ['acceptedEndpoint', executableContract.acceptedEndpoint],
        ])],
        ['transport', createRuntimeTrustedContractObject([
          ['method', 'GET'],
          ['url', executableContract.url],
          ['timeoutMs', executableContract.timeoutMs],
        ])],
        ['credentialReferenceId', executableContract.credentialReferenceId],
        ['dryRunResultId', executableContract.dryRunResultId],
        ['requesterImplementationId', executableContract.requesterImplementationId],
        ['requesterPackageVersion', executableContract.requesterPackageVersion],
        ['requesterContractId', executableContract.requesterContractId],
        ['requesterContractVersion', executableContract.requesterContractVersion],
        ['injectionMode', 'explicit-reviewed-injected-requester'],
        ['resultRedaction', 'result-body-omitted'],
        ['headersRedaction', 'headers-omitted'],
        ['bodyRedaction', 'body-omitted'],
        ['supportsExecution', true],
        ['requiresExplicitUserApprovalBeforeRequest', true],
        ['dispatchAllowed', false],
        ['executable', false],
        ['requesterCallable', false],
        ['willInvokeRequester', false],
        ['willProbeLocalBridge', false],
        ['willCallProvider', false],
        ['willMutateStorage', false],
        ['willStoreCredential', false],
        ['sideEffects', 'none'],
        ['sideEffectBoundary', EXECUTABLE_CONTRACT_BOUNDARY],
      ])
    : undefined;

  const entries: Array<readonly [string, Parameters<typeof createRuntimeTrustedContractObject>[0][number][1]]> = [
    ['status', ready ? 'ready' : 'blocked'],
    ['ready', ready],
    ['reason', reason],
    ['capability', trustedCapability],
    ['owner', trustedOwner],
    ['bridge', trustedBridge],
    ['transport', transport],
    ['credentialReferenceId', safeCredentialReferenceIdentifier(metadata?.credentialReferenceId)],
    ['dryRunResultId', safeIdentifier(metadata?.dryRunResultId)],
    ['requesterImplementationId', safeIdentifier(facts?.requesterImplementationId)],
    ['requesterPackageVersion', safeIdentifier(facts?.requesterPackageVersion)],
    ['canPrepareFutureRequesterInvocation', ready],
    ['invocationMode', 'decision-only'],
    ['executable', false],
    ['requesterCallable', false],
    ['willInvokeRequester', false],
    ['willProbeLocalBridge', false],
    ['willCallProvider', false],
    ['willMutateStorage', false],
    ['willStoreCredential', false],
    ['sideEffectBoundary', DECISION_BOUNDARY],
  ];
  if (preparedExecutableContract) entries.splice(12, 0, ['executableContract', preparedExecutableContract]);

  return createRuntimeTrustedContractObject(entries) as unknown as Readonly<LocalBridgeRequesterInvocationImplementationDecision>;
}

export function evaluateLocalBridgeRequesterInvocationImplementationBoundary(
  input: LocalBridgeRequesterInvocationImplementationInput = {},
): Readonly<LocalBridgeRequesterInvocationImplementationDecision> {
  if (!isTrustedContractRecord(input)) return freezeDecision('requester_shape_forbidden');
  if (hasUnsafeExtraInputKey(input) || !hasOnlyKeys(input, ROOT_INPUT_KEYS)) {
    return freezeDecision('requester_shape_forbidden');
  }
  if (input.requester !== undefined) {
    return freezeDecision('requester_shape_forbidden');
  }
  if (input.requesterResult !== undefined) {
    return freezeDecision(
      requesterResultClaimsLiveExecution(input.requesterResult)
        ? 'requester_result_live_claim'
        : 'requester_result_forbidden',
    );
  }
  const rawExecution = input.executionBoundary;

  if (
    valueHasSecretMaterial(input)
    || metadataValuesHaveSecretMaterial(input.requesterFacts)
    || metadataValuesHaveSecretMaterial(input.executableContract)
    || valueHasSecretMaterial(input.requester)
    || valueHasSecretMaterial(input.requesterResult)
  ) {
    return freezeDecision('raw_secret_material');
  }
  if (!rawExecution) return freezeDecision('execution_boundary_missing');
  if (!isTrustedContractRecord(rawExecution)) return freezeDecision('execution_boundary_invalid');
  const execution = rawExecution as unknown as LocalBridgeRequesterExecutionBoundaryDecision;
  if (execution.status !== 'eligible' || execution.eligible !== true) {
    return freezeDecision('execution_boundary_not_ready', execution);
  }
  if (!executionBoundaryIsReady(execution)) {
    return freezeDecision('execution_boundary_invalid', execution);
  }
  if (!input.requesterFacts) return freezeDecision('requester_facts_missing', execution);

  const facts = parseRequesterFacts(input.requesterFacts);
  if (!facts) return freezeDecision('requester_facts_unreviewed', execution);
  if (!requesterFactsAreInert(facts)) {
    return freezeDecision('requester_side_effect_boundary_invalid', execution, facts);
  }
  const metadata = executionMetadataHasRequiredShape(execution.metadata) ? execution.metadata : undefined;
  if (!metadata || !factsMatchExecutionBoundary(metadata, facts)) {
    return freezeDecision('requester_owner_mismatch', execution, facts);
  }
  if (!identifiersAreSafe(metadata, facts)) {
    return freezeDecision('requester_identity_unsafe', execution, facts);
  }

  if (!input.executableContract) {
    return freezeDecision('requester_executable_contract_missing', execution, facts);
  }
  const executableContract = parseExecutableContract(input.executableContract);
  if (!executableContract) {
    return isRecord(input.executableContract) && input.executableContract.reviewState !== 'reviewed'
      ? freezeDecision('requester_executable_contract_unreviewed', execution, facts)
      : freezeDecision('requester_executable_contract_invalid', execution, facts);
  }
  if (!executableContractIsReviewedAndInert(executableContract)) {
    return executableContract.reviewState !== 'reviewed'
      ? freezeDecision('requester_executable_contract_unreviewed', execution, facts)
      : freezeDecision('requester_executable_contract_invalid', execution, facts);
  }
  if (!executableContractMatchesBoundary(metadata, facts, executableContract)) {
    return freezeDecision('requester_executable_contract_mismatch', execution, facts);
  }

  return freezeDecision('requester_invocation_boundary_ready', execution, facts, executableContract);
}
