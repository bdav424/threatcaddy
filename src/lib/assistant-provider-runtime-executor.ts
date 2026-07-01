import {
  hasConnectorSecretMaterial,
  isSecretLikeFieldName,
  type ConnectorCredentialReference,
} from './connector-credential-boundary';
import {
  evaluateAssistantProviderExecutionGate,
  type AssistantProviderExecutionDecision,
  type AssistantProviderExecutionGateInput,
} from './assistant-provider-execution-gate';
import type { AssistantProviderRoute } from './assistant-provider-readiness';
import {
  evaluateLocalBridgeProbeExecutionGate,
  type LocalBridgeInertManualProbePlan,
  type LocalBridgeProbeExecutionGateInput,
} from './local-bridge-probe-execution-gate';
import type { LocalBridgeKind } from './local-bridge-discovery';
import type { LlmProviderLiveActivationDecision } from './llm-provider-live-activation-gate';
import type { LlmRuntimeActivationPlanDecision } from './llm-runtime-activation-plan';
import type {
  LlmRuntimeInvocationImplementationDecision,
  LlmRuntimeInvocationTransportIdentity,
} from './llm-runtime-invocation-implementation-boundary';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type AssistantProviderRuntimeResultStatus = 'block' | 'fake_executed';

export type AssistantProviderRuntimeBlockReason =
  | 'raw_secret_material'
  | 'assistant_provider_runtime_input_shape_forbidden'
  | 'assistant_provider_runtime_prompt_or_payload_echo_forbidden'
  | 'assistant_provider_runtime_secret_material'
  | 'assistant_provider_runtime_live_claim_forbidden'
  | 'assistant_provider_runtime_provenance_missing'
  | 'assistant_provider_runtime_provenance_invalid'
  | 'assistant_provider_runtime_provenance_mismatch'
  | 'assistant_provider_runtime_result_forbidden'
  | 'assistant_provider_gate_blocked'
  | 'assistant_provider_gate_not_executable'
  | 'assistant_provider_adapter_missing'
  | 'assistant_provider_adapter_contract_unreviewed'
  | 'local_bridge_probe_gate_blocked'
  | 'local_bridge_probe_plan_missing'
  | 'local_bridge_probe_plan_mismatch'
  | 'local_bridge_transport_request_mismatch'
  | 'local_bridge_transport_method_not_allowed'
  | 'local_bridge_transport_url_not_allowed'
  | 'local_bridge_transport_secret_bearing_url'
  | 'local_bridge_transport_timeout_mismatch'
  | 'local_bridge_transport_headers_forbidden'
  | 'local_bridge_transport_body_forbidden'
  | 'local_bridge_transport_credentials_forbidden'
  | 'local_bridge_runtime_input_shape_forbidden'
  | 'local_bridge_requester_missing'
  | 'local_bridge_requester_execution_disabled'
  | 'local_bridge_requester_failed'
  | 'local_bridge_response_secret_material';

export interface AssistantProviderRuntimeAdapterRequest {
  action: AssistantProviderExecutionDecision['action'];
  provider?: AssistantProviderRoute;
  model?: string;
  localEndpoint?: string;
  credentialReference: Pick<
    ConnectorCredentialReference,
    'schemaVersion' | 'kind' | 'id' | 'storageOwner' | 'providerId' | 'connectorId' | 'accountId'
  >;
  promptEstimateChars?: number;
}

export interface AssistantProviderRuntimeAdapter {
  contract: 'assistant-provider-runtime-adapter-v1-reviewed';
  execute: (request: AssistantProviderRuntimeAdapterRequest) => Promise<unknown>;
}

export interface AssistantProviderRuntimeFakeStreamAdapter {
  contract: 'assistant-provider-runtime-fake-stream-adapter-v1-reviewed';
  adapterKind: 'deterministic-local-fake-llm';
  provider: 'local';
  model: string;
  requestId: string;
  localEndpoint: string;
  transportIdentity: LlmRuntimeInvocationTransportIdentity;
  promptRedaction: 'prompt-omitted';
  bodyRedaction: 'body-omitted';
  headersRedaction: 'headers-omitted';
  deterministicOutput: true;
  supportsAbortSignal: true;
  injectedTestDoubleOnly: true;
  dispatchAllowed: false;
  liveProviderDispatchAllowed: false;
  willCallProvider: false;
  willCallLocalBridge: false;
  willFetch: false;
  willOpenSocket: false;
  willStream: false;
  willMutateStorage: false;
  sideEffectBoundary: 'assistant-provider-runtime-fake-stream-adapter-no-fetch-no-socket-no-storage-no-provider-no-local-bridge-no-secret';
}

export interface AssistantProviderRuntimeExecutorInput {
  gateInput: AssistantProviderExecutionGateInput;
  adapter?: AssistantProviderRuntimeAdapter | null;
  fakeAdapter?: AssistantProviderRuntimeFakeStreamAdapter | null;
  providerActivation?: LlmProviderLiveActivationDecision | null;
  runtimeActivationPlan?: LlmRuntimeActivationPlanDecision | null;
  invocationBoundary?: LlmRuntimeInvocationImplementationDecision | null;
  runtimeResult?: unknown;
}

export interface AssistantProviderRuntimeResult {
  status: AssistantProviderRuntimeResultStatus;
  executed: boolean;
  action: AssistantProviderExecutionDecision['action'];
  provider?: AssistantProviderRoute;
  model?: string;
  localEndpoint?: string;
  credentialReferenceId?: string;
  promptEstimateChars?: number;
  blockReasons: readonly AssistantProviderRuntimeBlockReason[];
  gateBlockReasons: AssistantProviderExecutionDecision['blockReasons'];
  safeDetail?: string;
  promptRedaction?: 'prompt-omitted';
  bodyRedaction?: 'body-omitted';
  headersRedaction?: 'headers-omitted';
  fakeStreamChunks?: readonly string[];
  cancellationContract?: 'abort-signal-before-or-between-fake-chunks';
  sideEffectBoundary:
    | 'fail-closed-runtime-facade-no-fetch-no-socket-no-storage-no-llm'
    | 'fake-local-runtime-facade-no-fetch-no-socket-no-storage-no-provider-no-local-bridge-no-secret';
}

export interface LocalBridgeProbeTransportRequest {
  method: 'GET';
  url: string;
  timeoutMs: number;
}

export interface LocalBridgeProbeTransportResponse {
  ok: boolean;
  status?: number;
  statusText?: string;
  elapsedMs?: number;
}

export type LocalBridgeProbeRequester = (
  request: LocalBridgeProbeTransportRequest,
) => Promise<LocalBridgeProbeTransportResponse>;

export interface LocalBridgeProbeInjectedRequesterContract {
  contract: 'local-bridge-probe-runtime-injected-requester-v1-reviewed';
  injectionMode: 'explicit-reviewed-injected-requester';
  requesterKind: 'local-bridge-loopback-health-probe';
  acceptedEndpoint: string;
  method: 'GET';
  url: string;
  timeoutMs: number;
  request: LocalBridgeProbeRequester;
  allowsHeaders: false;
  allowsBody: false;
  allowsCredentials: false;
  allowsProviderCall: false;
  allowsStorageMutation: false;
  sideEffectBoundary: 'runtime-facade-reviewed-injected-requester-loopback-probe-only-no-direct-fetch-no-socket-no-storage-no-provider-no-credentials';
}

export interface LocalBridgeProbeRuntimeExecutorInput {
  gateInput: LocalBridgeProbeExecutionGateInput;
  probePlan?: LocalBridgeInertManualProbePlan | null;
  transportRequest?: (Partial<LocalBridgeProbeTransportRequest> & Record<string, unknown>) | null;
  requester?: LocalBridgeProbeInjectedRequesterContract | null;
}

export interface LocalBridgeProbeRuntimeResult {
  status: AssistantProviderRuntimeResultStatus;
  executed: boolean;
  bridgeKind?: LocalBridgeKind;
  acceptedEndpoint?: string;
  request?: LocalBridgeProbeTransportRequest;
  response?: LocalBridgeProbeTransportResponse;
  blockReasons: readonly AssistantProviderRuntimeBlockReason[];
  gateBlockReasons: readonly string[];
  safeDetail?: string;
  sideEffectBoundary: 'runtime-facade-plan-only-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-callback';
}

const PROBE_PLAN_KEYS = new Set([
  'acceptedEndpoint',
  'bridgeKind',
  'executable',
  'method',
  'sideEffectBoundary',
  'sideEffects',
  'timeoutMs',
  'url',
]);

const TRANSPORT_REQUEST_KEYS = new Set([
  'body',
  'credentials',
  'headers',
  'method',
  'timeoutMs',
  'url',
]);
const MAX_LOCAL_BRIDGE_TIMEOUT_MS = 30_000;
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_PROMPT_CHARS = 200_000;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const ASSISTANT_PROVIDER_INPUT_KEYS = new Set([
  'adapter',
  'fakeAdapter',
  'gateInput',
  'invocationBoundary',
  'providerActivation',
  'runtimeActivationPlan',
  'runtimeResult',
]);
const ADAPTER_KEYS = new Set(['contract', 'execute']);
const FAKE_STREAM_ADAPTER_KEYS = new Set([
  'adapterKind',
  'bodyRedaction',
  'contract',
  'deterministicOutput',
  'dispatchAllowed',
  'headersRedaction',
  'injectedTestDoubleOnly',
  'liveProviderDispatchAllowed',
  'localEndpoint',
  'model',
  'promptRedaction',
  'provider',
  'requestId',
  'sideEffectBoundary',
  'supportsAbortSignal',
  'transportIdentity',
  'willCallLocalBridge',
  'willCallProvider',
  'willFetch',
  'willMutateStorage',
  'willOpenSocket',
  'willStream',
]);
const PROVIDER_ACTIVATION_DECISION_KEYS = new Set([
  'activationPlan',
  'blockers',
  'executable',
  'mayPrepareLiveActivation',
  'requiresUserApprovalBeforeCall',
  'sideEffectBoundary',
  'sideEffects',
  'status',
  'willCallLlm',
  'willCallProvider',
  'willFetch',
  'willMutateStorage',
  'willOpenSocket',
  'willPersistPrompt',
  'willResolveCredentialSecrets',
  'willStream',
]);
const PROVIDER_ACTIVATION_PLAN_KEYS = new Set([
  'acceptedEndpoint',
  'contract',
  'credentialReference',
  'endpointId',
  'endpointProvenanceReviewed',
  'estimatedPromptChars',
  'executable',
  'maxPromptChars',
  'modelId',
  'noPromptPersistenceReviewed',
  'promptBudgetId',
  'promptBudgetReviewed',
  'promptOmitted',
  'promptPersistence',
  'providerId',
  'providerModelReviewed',
  'requiresUserApprovalBeforeCall',
  'runtimeId',
  'runtimeOwner',
  'runtimeOwnershipReviewed',
  'sideEffectBoundary',
  'sideEffects',
  'userApprovalReviewed',
  'willCallLlm',
  'willCallProvider',
  'willFetch',
  'willOpenSocket',
  'willPersistPrompt',
  'willStream',
]);
const CREDENTIAL_REFERENCE_KEYS = new Set([
  'accountId',
  'connectorId',
  'createdAt',
  'displayName',
  'id',
  'kind',
  'providerId',
  'schemaVersion',
  'storageOwner',
]);
const RUNTIME_ACTIVATION_DECISION_KEYS = new Set([
  'dispatchAllowed',
  'executable',
  'implementationPlan',
  'ready',
  'reason',
  'requiresUserApprovalBeforeCall',
  'sideEffectBoundary',
  'sideEffects',
  'status',
  'willCallLlm',
  'willCallLocalBridge',
  'willCallProvider',
  'willFetch',
  'willMutateStorage',
  'willOpenSocket',
  'willPersistPrompt',
  'willStream',
]);
const RUNTIME_IMPLEMENTATION_PLAN_KEYS = new Set([
  'acceptedEndpoint',
  'acceptedProviderActivationContract',
  'acceptedRuntimeBoundaryContract',
  'acceptedRuntimeBoundaryReason',
  'contract',
  'credentialReference',
  'credentialReferenceId',
  'dispatchAllowed',
  'endpointId',
  'endpointProvenanceReviewed',
  'estimatedPromptChars',
  'executable',
  'maxPromptChars',
  'modelId',
  'noPromptPersistenceReviewed',
  'promptBudgetId',
  'promptBudgetReviewed',
  'promptOmitted',
  'promptPersistence',
  'providerId',
  'providerModelReviewed',
  'requestId',
  'requiresUserApprovalBeforeCall',
  'runtimeId',
  'runtimeOwner',
  'runtimeOwnershipReviewed',
  'sideEffectBoundary',
  'sideEffects',
  'transportIdentity',
  'userApprovalReviewed',
  'willCallLlm',
  'willCallLocalBridge',
  'willCallProvider',
  'willFetch',
  'willMutateStorage',
  'willOpenSocket',
  'willPersistPrompt',
  'willStream',
]);
const INVOCATION_BOUNDARY_KEYS = new Set([
  'action',
  'canPrepareFutureLlmInvocation',
  'credentialReferenceId',
  'dispatchAllowed',
  'executable',
  'implementationBoundaryReady',
  'localEndpoint',
  'model',
  'promptEstimateChars',
  'promptRedaction',
  'provider',
  'reason',
  'requestId',
  'sideEffectBoundary',
  'status',
  'transportIdentity',
  'willCallLocalBridge',
  'willCallProvider',
  'willFetch',
  'willMutateStorage',
  'willOpenSocket',
  'willStream',
]);
const TRANSPORT_IDENTITY_KEYS = new Set(['id', 'kind', 'owner', 'version']);
const LOCAL_BRIDGE_RUNTIME_INPUT_KEYS = new Set([
  'gateInput',
  'probePlan',
  'requester',
  'transportRequest',
]);
const LOCAL_BRIDGE_REQUESTER_CONTRACT_KEYS = new Set([
  'acceptedEndpoint',
  'allowsBody',
  'allowsCredentials',
  'allowsHeaders',
  'allowsProviderCall',
  'allowsStorageMutation',
  'contract',
  'injectionMode',
  'method',
  'request',
  'requesterKind',
  'sideEffectBoundary',
  'timeoutMs',
  'url',
]);
const SECRET_VALUE_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^gh[pousr]_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^(?:sk|pk|rk)-[a-z0-9_-]{8,}$/i,
  /^ya29\.[a-z0-9._-]{8,}$/i,
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
const PROMPT_PAYLOAD_KEY_MARKERS = [
  'authorization',
  'body',
  'content',
  'header',
  'message',
  'payload',
  'prompt',
  'requestbody',
  'systemprompt',
] as const;
const LIVE_CLAIM_KEYS = new Set([
  'adapterready',
  'dispatchallowed',
  'executed',
  'executable',
  'fetchcalled',
  'localbridgecalled',
  'providercall',
  'providercalled',
  'ready',
  'runtimeexecuted',
  'runtimeresult',
  'socketopened',
  'streamed',
  'toolsinvoked',
  'willcallllm',
  'willcalllocalbridge',
  'willcallprovider',
  'willfetch',
  'willmutatestorage',
  'willopensocket',
  'willstream',
]);
const UNSAFE_RUNTIME_KEY_MARKERS = [
  'callback',
  'eventsource',
  'fetch',
  'httpclient',
  'indexeddb',
  'invoke',
  'liveaction',
  'liveprovider',
  'localbridge',
  'onresult',
  'providercall',
  'requester',
  'socket',
  'storage',
  'stream',
  'tool',
  'websocket',
  'xhr',
] as const;
const ALLOWED_INERT_METADATA_KEYS = new Set([
  'acceptedProviderActivationContract',
  'acceptedRuntimeBoundaryContract',
  'acceptedRuntimeBoundaryReason',
  'blockers',
  'canPrepareFutureLlmInvocation',
  'dispatchAllowed',
  'executable',
  'implementationBoundaryReady',
  'liveProviderDispatchAllowed',
  'mayPrepareLiveActivation',
  'promptRedaction',
  'ready',
  'requiresUserApprovalBeforeCall',
  'sideEffectBoundary',
  'sideEffects',
  'storageOwner',
  'supportsAbortSignal',
  'transportIdentity',
  'willCallLlm',
  'willCallLocalBridge',
  'willCallProvider',
  'willFetch',
  'willMutateStorage',
  'willOpenSocket',
  'willPersistPrompt',
  'willResolveCredentialSecrets',
  'willStream',
]);
const ALLOWED_TRUE_READINESS_KEYS = new Set([
  'canPrepareFutureLlmInvocation',
  'implementationBoundaryReady',
  'mayPrepareLiveActivation',
  'ready',
  'requiresUserApprovalBeforeCall',
]);

interface ParsedProviderActivation {
  providerId: string;
  modelId: string;
  runtimeId: string;
  credentialReference: ConnectorCredentialReference;
  endpointId: string;
  acceptedEndpoint: string;
  promptBudgetId: string;
  estimatedPromptChars: number;
  maxPromptChars: number;
}

interface ParsedInvocationBoundary {
  provider: AssistantProviderRoute;
  model: string;
  action: AssistantProviderExecutionDecision['action'];
  credentialReferenceId: string;
  requestId: string;
  localEndpoint?: string;
  promptEstimateChars?: number;
  transportIdentity: LlmRuntimeInvocationTransportIdentity;
}

interface ParsedRuntimeActivationPlan extends ParsedProviderActivation {
  credentialReferenceId: string;
  requestId: string;
  transportIdentity: LlmRuntimeInvocationTransportIdentity;
}

interface ParsedFakeStreamAdapter {
  provider: 'local';
  model: string;
  requestId: string;
  localEndpoint: string;
  transportIdentity: LlmRuntimeInvocationTransportIdentity;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function stringLooksTokenShaped(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function stringLooksUnsafeSchemeIdentifier(value: string): boolean {
  const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(value);
  if (!scheme) return false;
  if (value.startsWith('assistantcaddy-') || value.startsWith('local-bridge:') || value.startsWith('macos-login:')) {
    return false;
  }
  return true;
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringLooksUrlShapedIdentifier(value: string): boolean {
  return stringLooksUnsafeSchemeIdentifier(value)
    || /^www\./i.test(value)
    || /^(?:localhost|127(?:\.\d{1,3}){3}|\d{1,3}(?:\.\d{1,3}){3}|[a-z0-9-]+\.[a-z0-9.-]+)(?::\d+)?\//i.test(value);
}

function safeIdentifier(value: unknown): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) return undefined;
  if (
    normalized.length > MAX_IDENTIFIER_LENGTH
    || !SAFE_IDENTIFIER_PATTERN.test(normalized)
    || stringLooksUrlShapedIdentifier(normalized)
    || isSecretLikeFieldName(normalized)
    || stringLooksTokenShaped(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function safePromptEstimate(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 0
    || value > MAX_PROMPT_CHARS
  ) {
    return undefined;
  }
  return value;
}

function endpointHasSecretMaterial(url: URL): boolean {
  if (url.username || url.password || url.hash) return true;
  for (const [key, paramValue] of url.searchParams.entries()) {
    const normalized = normalizeKey(key);
    if (SECRET_URL_PARAM_MARKERS.some((marker) => normalized.includes(marker))) return true;
    if (stringLooksTokenShaped(paramValue)) return true;
  }
  return false;
}

function endpointHasPromptPayloadEcho(url: URL): boolean {
  const normalizedPath = normalizeKey(url.pathname);
  if (PROMPT_PAYLOAD_KEY_MARKERS.some((marker) => normalizedPath.includes(marker))) return true;
  for (const key of url.searchParams.keys()) {
    const normalized = normalizeKey(key);
    if (PROMPT_PAYLOAD_KEY_MARKERS.some((marker) => normalized.includes(marker))) return true;
  }
  return false;
}

function safeHttpEndpoint(value: unknown): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (endpointHasSecretMaterial(url) || endpointHasPromptPayloadEcho(url)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function safeProviderRoute(value: unknown): AssistantProviderRoute | undefined {
  return value === 'anthropic'
    || value === 'openai'
    || value === 'gemini'
    || value === 'mistral'
    || value === 'local'
    ? value
    : undefined;
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function valueHasTokenOrSecretMaterial(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  if (currentKey && isSecretLikeFieldName(currentKey)) return true;
  if (typeof value === 'string') {
    if (stringLooksTokenShaped(value)) return true;
    if (!value.includes('://')) return false;
    try {
      const url = new URL(value);
      return endpointHasSecretMaterial(url);
    } catch {
      return true;
    }
  }
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasTokenOrSecretMaterial(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (valueHasTokenOrSecretMaterial(key, seen) || valueHasTokenOrSecretMaterial(nestedValue, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasTokenOrSecretMaterial(nestedValue, seen)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => (
    valueHasTokenOrSecretMaterial(nestedValue, seen, key)
  ));
}

function valueHasPromptOrPayloadEcho(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  const normalizedKey = currentKey ? normalizeKey(currentKey) : '';
  if (
    normalizedKey
    && PROMPT_PAYLOAD_KEY_MARKERS.some((marker) => normalizedKey === marker || normalizedKey.endsWith(marker))
    && !ALLOWED_INERT_METADATA_KEYS.has(currentKey ?? '')
  ) {
    return true;
  }
  if (typeof value === 'string') {
    if (/\b(?:authorization|body|headers?|message|payload|prompt|system\s*prompt)\s*[:=]/i.test(value)) {
      return true;
    }
    if (value.includes('://')) {
      try {
        return endpointHasPromptPayloadEcho(new URL(value));
      } catch {
        return false;
      }
    }
    return false;
  }
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasPromptOrPayloadEcho(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (valueHasPromptOrPayloadEcho(nestedValue, seen, typeof key === 'string' ? key : undefined)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasPromptOrPayloadEcho(nestedValue, seen)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => valueHasPromptOrPayloadEcho(nestedValue, seen, key));
}

function valueHasLiveClaim(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  const normalizedKey = currentKey ? normalizeKey(currentKey) : '';
  if (
    LIVE_CLAIM_KEYS.has(normalizedKey)
    && (value === true || typeof value === 'function')
  ) {
    return !ALLOWED_TRUE_READINESS_KEYS.has(currentKey ?? '');
  }
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return true;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasLiveClaim(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (valueHasLiveClaim(nestedValue, seen, typeof key === 'string' ? key : undefined)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasLiveClaim(nestedValue, seen)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => valueHasLiveClaim(nestedValue, seen, key));
}

function valueHasUnsafeRuntimeHook(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  const normalizedKey = currentKey ? normalizeKey(currentKey) : '';
  if (
    normalizedKey
    && UNSAFE_RUNTIME_KEY_MARKERS.some((marker) => normalizedKey.includes(marker))
    && !ALLOWED_INERT_METADATA_KEYS.has(currentKey ?? '')
  ) {
    return true;
  }
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return true;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasUnsafeRuntimeHook(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (valueHasUnsafeRuntimeHook(nestedValue, seen, typeof key === 'string' ? key : undefined)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasUnsafeRuntimeHook(nestedValue, seen)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => valueHasUnsafeRuntimeHook(nestedValue, seen, key));
}

function sanitizeSafeDetail(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizedString(value);
  if (
    !normalized
    || normalized.length > 240
    || stringLooksTokenShaped(normalized)
    || valueHasPromptOrPayloadEcho(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function safeCredentialReferenceId(reference?: ConnectorCredentialReference): string | undefined {
  return safeIdentifier(reference?.id);
}

function freezeCredentialReference(reference: ConnectorCredentialReference): ConnectorCredentialReference {
  return Object.freeze({
    schemaVersion: reference.schemaVersion,
    kind: reference.kind,
    id: reference.id,
    storageOwner: reference.storageOwner,
    providerId: reference.providerId,
    connectorId: reference.connectorId,
    accountId: reference.accountId,
    displayName: reference.displayName,
    createdAt: reference.createdAt,
  });
}

function parseCredentialReference(value: unknown): ConnectorCredentialReference | undefined {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, CREDENTIAL_REFERENCE_KEYS)) return undefined;
  const id = safeIdentifier(value.id);
  const providerId = value.providerId === undefined ? undefined : safeIdentifier(value.providerId);
  const connectorId = value.connectorId === undefined ? undefined : safeIdentifier(value.connectorId);
  const accountId = value.accountId === undefined ? undefined : safeIdentifier(value.accountId);
  const displayName = value.displayName === undefined ? undefined : normalizedString(value.displayName);
  if (
    value.schemaVersion !== 1
    || !id
    || (value.kind !== 'local-bridge'
      && value.kind !== 'os-keychain'
      && value.kind !== 'external-secret-store'
      && value.kind !== 'provider-managed-oauth')
    || (value.storageOwner !== 'local-bridge'
      && value.storageOwner !== 'operating-system'
      && value.storageOwner !== 'external-provider'
      && value.storageOwner !== 'external-secret-store')
    || (value.providerId !== undefined && !providerId)
    || (value.connectorId !== undefined && !connectorId)
    || (value.accountId !== undefined && !accountId)
    || (value.displayName !== undefined && (!displayName || valueHasPromptOrPayloadEcho(displayName)))
    || (value.createdAt !== undefined && (typeof value.createdAt !== 'number' || !Number.isSafeInteger(value.createdAt)))
  ) {
    return undefined;
  }
  return freezeCredentialReference({
    schemaVersion: 1,
    kind: value.kind,
    id,
    storageOwner: value.storageOwner,
    providerId,
    connectorId,
    accountId,
    displayName,
    createdAt: value.createdAt,
  });
}

function parseTransportIdentity(value: unknown): LlmRuntimeInvocationTransportIdentity | undefined {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, TRANSPORT_IDENTITY_KEYS)) return undefined;
  const id = safeIdentifier(value.id);
  const version = safeIdentifier(value.version);
  if (
    value.kind !== 'future-reviewed-injected-llm-transport'
    || !id
    || !version
    || value.owner !== 'assistantcaddy-llm-runtime'
  ) {
    return undefined;
  }
  return Object.freeze({
    kind: 'future-reviewed-injected-llm-transport',
    id,
    version,
    owner: 'assistantcaddy-llm-runtime',
  });
}

function parseProviderActivationPlan(value: unknown): ParsedProviderActivation | undefined {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, PROVIDER_ACTIVATION_PLAN_KEYS)) return undefined;
  const providerId = safeIdentifier(value.providerId);
  const modelId = safeIdentifier(value.modelId);
  const runtimeId = safeIdentifier(value.runtimeId);
  const credentialReference = parseCredentialReference(value.credentialReference);
  const endpointId = safeIdentifier(value.endpointId);
  const acceptedEndpoint = safeHttpEndpoint(value.acceptedEndpoint);
  const promptBudgetId = safeIdentifier(value.promptBudgetId);
  const estimatedPromptChars = safePromptEstimate(value.estimatedPromptChars);
  const maxPromptChars = safePromptEstimate(value.maxPromptChars);

  if (
    value.contract !== 'llm-provider-live-activation-plan-v1'
    || !providerId
    || !modelId
    || value.runtimeOwner !== 'assistantcaddy-llm-provider-runtime'
    || !runtimeId
    || !credentialReference
    || !endpointId
    || !acceptedEndpoint
    || !promptBudgetId
    || estimatedPromptChars === undefined
    || maxPromptChars === undefined
    || estimatedPromptChars > maxPromptChars
    || value.providerModelReviewed !== true
    || value.runtimeOwnershipReviewed !== true
    || value.endpointProvenanceReviewed !== true
    || value.promptBudgetReviewed !== true
    || value.userApprovalReviewed !== true
    || value.noPromptPersistenceReviewed !== true
    || value.promptOmitted !== true
    || value.promptPersistence !== 'none'
    || value.requiresUserApprovalBeforeCall !== true
    || value.executable !== false
    || value.sideEffects !== 'none'
    || value.willCallLlm !== false
    || value.willCallProvider !== false
    || value.willFetch !== false
    || value.willOpenSocket !== false
    || value.willStream !== false
    || value.willPersistPrompt !== false
    || value.sideEffectBoundary !== 'plan-only-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call'
  ) {
    return undefined;
  }

  return Object.freeze({
    providerId,
    modelId,
    runtimeId,
    credentialReference,
    endpointId,
    acceptedEndpoint,
    promptBudgetId,
    estimatedPromptChars,
    maxPromptChars,
  });
}

function parseProviderActivation(value: unknown): ParsedProviderActivation | undefined {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, PROVIDER_ACTIVATION_DECISION_KEYS)) return undefined;
  if (
    value.status !== 'activation-ready'
    || value.mayPrepareLiveActivation !== true
    || !Array.isArray(value.blockers)
    || value.blockers.length !== 0
    || value.executable !== false
    || value.sideEffects !== 'none'
    || value.willCallLlm !== false
    || value.willCallProvider !== false
    || value.willFetch !== false
    || value.willOpenSocket !== false
    || value.willStream !== false
    || value.willMutateStorage !== false
    || value.willResolveCredentialSecrets !== false
    || value.willPersistPrompt !== false
    || value.requiresUserApprovalBeforeCall !== true
    || value.sideEffectBoundary !== 'pure-local-llm-provider-live-activation-gate-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call'
  ) {
    return undefined;
  }
  return parseProviderActivationPlan(value.activationPlan);
}

function parseInvocationBoundary(value: unknown): ParsedInvocationBoundary | undefined {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, INVOCATION_BOUNDARY_KEYS)) return undefined;
  const provider = safeProviderRoute(value.provider);
  const model = safeIdentifier(value.model);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const requestId = safeIdentifier(value.requestId);
  const localEndpoint = value.localEndpoint === undefined ? undefined : safeHttpEndpoint(value.localEndpoint);
  const promptEstimateChars = safePromptEstimate(value.promptEstimateChars);
  const transportIdentity = parseTransportIdentity(value.transportIdentity);
  if (
    value.status !== 'blocked'
    || value.implementationBoundaryReady !== true
    || value.reason !== 'executable_llm_transport_contract_missing'
    || !provider
    || !model
    || (value.action !== 'send_prompt' && value.action !== 'test_provider' && value.action !== 'list_models')
    || !credentialReferenceId
    || !requestId
    || (value.localEndpoint !== undefined && !localEndpoint)
    || (provider === 'local' && !localEndpoint)
    || (provider !== 'local' && value.localEndpoint !== undefined)
    || (value.promptEstimateChars !== undefined && promptEstimateChars === undefined)
    || !transportIdentity
    || value.promptRedaction !== 'prompt-omitted'
    || value.canPrepareFutureLlmInvocation !== true
    || value.executable !== false
    || value.dispatchAllowed !== false
    || value.willCallProvider !== false
    || value.willCallLocalBridge !== false
    || value.willFetch !== false
    || value.willOpenSocket !== false
    || value.willStream !== false
    || value.willMutateStorage !== false
    || value.sideEffectBoundary !== 'llm-runtime-invocation-implementation-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call'
  ) {
    return undefined;
  }
  return Object.freeze({
    provider,
    model,
    action: value.action,
    credentialReferenceId,
    requestId,
    ...(localEndpoint ? { localEndpoint } : {}),
    ...(promptEstimateChars !== undefined ? { promptEstimateChars } : {}),
    transportIdentity,
  });
}

function parseFakeStreamAdapter(value: unknown): ParsedFakeStreamAdapter | undefined {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, FAKE_STREAM_ADAPTER_KEYS)) return undefined;
  const model = safeIdentifier(value.model);
  const requestId = safeIdentifier(value.requestId);
  const localEndpoint = safeHttpEndpoint(value.localEndpoint);
  const transportIdentity = parseTransportIdentity(value.transportIdentity);
  if (
    value.contract !== 'assistant-provider-runtime-fake-stream-adapter-v1-reviewed'
    || value.adapterKind !== 'deterministic-local-fake-llm'
    || value.provider !== 'local'
    || !model
    || !requestId
    || !localEndpoint
    || !transportIdentity
    || value.promptRedaction !== 'prompt-omitted'
    || value.bodyRedaction !== 'body-omitted'
    || value.headersRedaction !== 'headers-omitted'
    || value.deterministicOutput !== true
    || value.supportsAbortSignal !== true
    || value.injectedTestDoubleOnly !== true
    || value.dispatchAllowed !== false
    || value.liveProviderDispatchAllowed !== false
    || value.willCallProvider !== false
    || value.willCallLocalBridge !== false
    || value.willFetch !== false
    || value.willOpenSocket !== false
    || value.willStream !== false
    || value.willMutateStorage !== false
    || value.sideEffectBoundary !== 'assistant-provider-runtime-fake-stream-adapter-no-fetch-no-socket-no-storage-no-provider-no-local-bridge-no-secret'
  ) {
    return undefined;
  }

  return Object.freeze({
    provider: 'local',
    model,
    requestId,
    localEndpoint,
    transportIdentity,
  });
}

function fakeAdapterMatchesInvocation(
  adapter: ParsedFakeStreamAdapter,
  invocation: ParsedInvocationBoundary | undefined,
): boolean {
  return !!invocation
    && invocation.provider === adapter.provider
    && invocation.model === adapter.model
    && invocation.requestId === adapter.requestId
    && invocation.localEndpoint === adapter.localEndpoint
    && invocation.transportIdentity.id === adapter.transportIdentity.id
    && invocation.transportIdentity.version === adapter.transportIdentity.version
    && invocation.transportIdentity.kind === adapter.transportIdentity.kind
    && invocation.transportIdentity.owner === adapter.transportIdentity.owner;
}

function parseRuntimeImplementationPlan(value: unknown): ParsedRuntimeActivationPlan | undefined {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, RUNTIME_IMPLEMENTATION_PLAN_KEYS)) return undefined;
  const providerActivation = parseProviderActivationPlan({
    contract: 'llm-provider-live-activation-plan-v1',
    providerId: value.providerId,
    modelId: value.modelId,
    runtimeOwner: value.runtimeOwner,
    runtimeId: value.runtimeId,
    credentialReference: value.credentialReference,
    endpointId: value.endpointId,
    acceptedEndpoint: value.acceptedEndpoint,
    promptBudgetId: value.promptBudgetId,
    estimatedPromptChars: value.estimatedPromptChars,
    maxPromptChars: value.maxPromptChars,
    providerModelReviewed: value.providerModelReviewed,
    runtimeOwnershipReviewed: value.runtimeOwnershipReviewed,
    endpointProvenanceReviewed: value.endpointProvenanceReviewed,
    promptBudgetReviewed: value.promptBudgetReviewed,
    userApprovalReviewed: value.userApprovalReviewed,
    noPromptPersistenceReviewed: value.noPromptPersistenceReviewed,
    promptOmitted: value.promptOmitted,
    promptPersistence: value.promptPersistence,
    requiresUserApprovalBeforeCall: value.requiresUserApprovalBeforeCall,
    executable: value.executable,
    sideEffects: value.sideEffects,
    willCallLlm: value.willCallLlm,
    willCallProvider: value.willCallProvider,
    willFetch: value.willFetch,
    willOpenSocket: value.willOpenSocket,
    willStream: value.willStream,
    willPersistPrompt: value.willPersistPrompt,
    sideEffectBoundary: 'plan-only-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call',
  });
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const requestId = safeIdentifier(value.requestId);
  const transportIdentity = parseTransportIdentity(value.transportIdentity);
  if (
    !providerActivation
    || value.contract !== 'llm-runtime-activation-implementation-plan-v1'
    || !credentialReferenceId
    || credentialReferenceId !== providerActivation.credentialReference.id
    || !requestId
    || !transportIdentity
    || value.acceptedProviderActivationContract !== 'llm-provider-live-activation-plan-v1'
    || value.acceptedRuntimeBoundaryContract !== 'llm-runtime-invocation-implementation-boundary-v1'
    || value.acceptedRuntimeBoundaryReason !== 'executable_llm_transport_contract_missing'
    || value.dispatchAllowed !== false
    || value.willCallLocalBridge !== false
    || value.willMutateStorage !== false
    || value.sideEffectBoundary !== 'llm-runtime-activation-plan-only-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call'
  ) {
    return undefined;
  }
  return Object.freeze({
    ...providerActivation,
    credentialReferenceId,
    requestId,
    transportIdentity,
  });
}

function parseRuntimeActivationPlan(value: unknown): ParsedRuntimeActivationPlan | undefined {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, RUNTIME_ACTIVATION_DECISION_KEYS)) return undefined;
  if (
    value.status !== 'implementation-plan-ready'
    || value.ready !== true
    || value.reason !== 'implementation_plan_ready'
    || value.requiresUserApprovalBeforeCall !== true
    || value.executable !== false
    || value.dispatchAllowed !== false
    || value.sideEffects !== 'none'
    || value.willCallLlm !== false
    || value.willCallProvider !== false
    || value.willCallLocalBridge !== false
    || value.willFetch !== false
    || value.willOpenSocket !== false
    || value.willStream !== false
    || value.willMutateStorage !== false
    || value.willPersistPrompt !== false
    || value.sideEffectBoundary !== 'llm-runtime-activation-plan-gate-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call'
  ) {
    return undefined;
  }
  return parseRuntimeImplementationPlan(value.implementationPlan);
}

function activationMatchesDecision(
  activation: ParsedProviderActivation,
  decision: AssistantProviderExecutionDecision,
): boolean {
  return activation.providerId === decision.provider
    && activation.modelId === decision.model
    && activation.credentialReference.id === decision.credentialReference?.id
    && (decision.localEndpoint === undefined || activation.acceptedEndpoint === decision.localEndpoint)
    && (decision.promptEstimateChars === undefined || activation.estimatedPromptChars === decision.promptEstimateChars);
}

function runtimePlanMatchesActivationAndDecision(
  runtimePlan: ParsedRuntimeActivationPlan,
  activation: ParsedProviderActivation | undefined,
  decision: AssistantProviderExecutionDecision,
): boolean {
  const matchesDecision = runtimePlan.providerId === decision.provider
    && runtimePlan.modelId === decision.model
    && runtimePlan.credentialReferenceId === decision.credentialReference?.id
    && (decision.localEndpoint === undefined || runtimePlan.acceptedEndpoint === decision.localEndpoint)
    && (decision.promptEstimateChars === undefined || runtimePlan.estimatedPromptChars === decision.promptEstimateChars);
  const matchesActivation = !activation
    || (
      runtimePlan.providerId === activation.providerId
      && runtimePlan.modelId === activation.modelId
      && runtimePlan.runtimeId === activation.runtimeId
      && runtimePlan.credentialReferenceId === activation.credentialReference.id
      && runtimePlan.endpointId === activation.endpointId
      && runtimePlan.acceptedEndpoint === activation.acceptedEndpoint
      && runtimePlan.promptBudgetId === activation.promptBudgetId
      && runtimePlan.estimatedPromptChars === activation.estimatedPromptChars
      && runtimePlan.maxPromptChars === activation.maxPromptChars
    );
  return matchesDecision && matchesActivation;
}

function invocationBoundaryMatchesDecisionAndPlan(
  invocation: ParsedInvocationBoundary,
  runtimePlan: ParsedRuntimeActivationPlan | undefined,
  decision: AssistantProviderExecutionDecision,
): boolean {
  const matchesDecision = invocation.provider === decision.provider
    && invocation.model === decision.model
    && invocation.action === decision.action
    && invocation.credentialReferenceId === decision.credentialReference?.id
    && invocation.localEndpoint === decision.localEndpoint
    && invocation.promptEstimateChars === decision.promptEstimateChars;
  const matchesPlan = !runtimePlan
    || (
      invocation.provider === runtimePlan.providerId
      && invocation.model === runtimePlan.modelId
      && invocation.credentialReferenceId === runtimePlan.credentialReferenceId
      && invocation.requestId === runtimePlan.requestId
      && invocation.localEndpoint === runtimePlan.acceptedEndpoint
      && invocation.promptEstimateChars === runtimePlan.estimatedPromptChars
      && invocation.transportIdentity.id === runtimePlan.transportIdentity.id
      && invocation.transportIdentity.version === runtimePlan.transportIdentity.version
      && invocation.transportIdentity.kind === runtimePlan.transportIdentity.kind
      && invocation.transportIdentity.owner === runtimePlan.transportIdentity.owner
    );
  return matchesDecision && matchesPlan;
}

function validateAssistantProviderRuntimeInput(
  input: unknown,
  decision: AssistantProviderExecutionDecision,
): readonly AssistantProviderRuntimeBlockReason[] {
  const blockers: AssistantProviderRuntimeBlockReason[] = [];
  if (
    !isTrustedRuntimeInputRoot(input)
    || !hasOnlyAllowedKeys(input, ASSISTANT_PROVIDER_INPUT_KEYS)
    || !isRecord(input.gateInput)
  ) {
    blockers.push('assistant_provider_runtime_input_shape_forbidden');
    return blockers;
  }

  if (input.adapter !== undefined && input.adapter !== null) {
    if (
      !isRecord(input.adapter)
      || !hasOnlyAllowedKeys(input.adapter, ADAPTER_KEYS)
      || typeof input.adapter.execute !== 'function'
    ) {
      blockers.push('assistant_provider_runtime_input_shape_forbidden');
    } else if (input.adapter.contract !== 'assistant-provider-runtime-adapter-v1-reviewed') {
      blockers.push('assistant_provider_adapter_contract_unreviewed');
    }
  }
  if (input.fakeAdapter !== undefined && input.fakeAdapter !== null && !parseFakeStreamAdapter(input.fakeAdapter)) {
    blockers.push('assistant_provider_runtime_input_shape_forbidden');
  }
  if (input.runtimeResult !== undefined) {
    blockers.push('assistant_provider_runtime_result_forbidden');
  }

  const untrustedRuntimeMetadata = {
    fakeAdapter: input.fakeAdapter,
    invocationBoundary: input.invocationBoundary,
    providerActivation: input.providerActivation,
    runtimeActivationPlan: input.runtimeActivationPlan,
    runtimeResult: input.runtimeResult,
  };
  if (valueHasUnsafeRuntimeHook(untrustedRuntimeMetadata)) {
    blockers.push('assistant_provider_runtime_input_shape_forbidden');
  }
  if (hasConnectorSecretMaterial(untrustedRuntimeMetadata) || valueHasTokenOrSecretMaterial(untrustedRuntimeMetadata)) {
    blockers.push('assistant_provider_runtime_secret_material');
  }
  if (valueHasPromptOrPayloadEcho(untrustedRuntimeMetadata)) {
    blockers.push('assistant_provider_runtime_prompt_or_payload_echo_forbidden');
  }
  if (valueHasLiveClaim(untrustedRuntimeMetadata)) {
    blockers.push('assistant_provider_runtime_live_claim_forbidden');
  }

  const fakeAdapterProvided = input.fakeAdapter !== undefined && input.fakeAdapter !== null;
  const providerActivationProvided = input.providerActivation !== undefined && input.providerActivation !== null;
  const runtimeActivationPlanProvided = input.runtimeActivationPlan !== undefined && input.runtimeActivationPlan !== null;
  const invocationBoundaryProvided = input.invocationBoundary !== undefined && input.invocationBoundary !== null;

  const providerActivation = providerActivationProvided
    ? parseProviderActivation(input.providerActivation)
    : undefined;
  if (providerActivationProvided) {
    if (!providerActivation) {
      blockers.push('assistant_provider_runtime_provenance_invalid');
    } else if (!activationMatchesDecision(providerActivation, decision)) {
      blockers.push('assistant_provider_runtime_provenance_mismatch');
    }
  }

  const runtimePlan = runtimeActivationPlanProvided
    ? parseRuntimeActivationPlan(input.runtimeActivationPlan)
    : undefined;
  if (runtimeActivationPlanProvided) {
    if (!runtimePlan) {
      blockers.push('assistant_provider_runtime_provenance_invalid');
    } else if (!runtimePlanMatchesActivationAndDecision(runtimePlan, providerActivation, decision)) {
      blockers.push('assistant_provider_runtime_provenance_mismatch');
    }
  }

  const invocationBoundary = invocationBoundaryProvided
    ? parseInvocationBoundary(input.invocationBoundary)
    : undefined;
  if (invocationBoundaryProvided) {
    if (!invocationBoundary) {
      blockers.push('assistant_provider_runtime_provenance_invalid');
    } else if (!invocationBoundaryMatchesDecisionAndPlan(invocationBoundary, runtimePlan, decision)) {
      blockers.push('assistant_provider_runtime_provenance_mismatch');
    }
  }
  if (fakeAdapterProvided) {
    if (!providerActivationProvided || !runtimeActivationPlanProvided || !invocationBoundaryProvided) {
      blockers.push('assistant_provider_runtime_provenance_missing');
    }
  }

  return Object.freeze([...new Set(blockers)]);
}

function providerResult(
  decision: AssistantProviderExecutionDecision,
  blockReasons: readonly AssistantProviderRuntimeBlockReason[],
  safeDetail?: string,
): AssistantProviderRuntimeResult {
  const provider = safeProviderRoute(decision.provider);
  const model = safeIdentifier(decision.model);
  const localEndpoint = decision.localEndpoint ? safeHttpEndpoint(decision.localEndpoint) : undefined;
  const promptEstimateChars = safePromptEstimate(decision.promptEstimateChars);
  return Object.freeze({
    status: 'block',
    executed: false,
    action: decision.action,
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(localEndpoint ? { localEndpoint } : {}),
    credentialReferenceId: safeCredentialReferenceId(decision.credentialReference),
    ...(promptEstimateChars !== undefined ? { promptEstimateChars } : {}),
    blockReasons: Object.freeze([...new Set(blockReasons)]),
    gateBlockReasons: decision.blockReasons,
    safeDetail: sanitizeSafeDetail(safeDetail),
    sideEffectBoundary: 'fail-closed-runtime-facade-no-fetch-no-socket-no-storage-no-llm',
  });
}

function fakeProviderResult(
  decision: AssistantProviderExecutionDecision,
): AssistantProviderRuntimeResult {
  const provider = safeProviderRoute(decision.provider);
  const model = safeIdentifier(decision.model);
  const localEndpoint = decision.localEndpoint ? safeHttpEndpoint(decision.localEndpoint) : undefined;
  const promptEstimateChars = safePromptEstimate(decision.promptEstimateChars);
  const chunks = Object.freeze([
    'ThreatCaddy fake LLM runtime ',
    'accepted redacted local metadata ',
    'without provider transport.',
  ]);
  return Object.freeze({
    status: 'fake_executed',
    executed: true,
    action: decision.action,
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(localEndpoint ? { localEndpoint } : {}),
    credentialReferenceId: safeCredentialReferenceId(decision.credentialReference),
    ...(promptEstimateChars !== undefined ? { promptEstimateChars } : {}),
    blockReasons: Object.freeze([]),
    gateBlockReasons: decision.blockReasons,
    safeDetail: 'fake local LLM runtime produced deterministic redacted chunks without transport',
    promptRedaction: 'prompt-omitted',
    bodyRedaction: 'body-omitted',
    headersRedaction: 'headers-omitted',
    fakeStreamChunks: chunks,
    cancellationContract: 'abort-signal-before-or-between-fake-chunks',
    sideEffectBoundary: 'fake-local-runtime-facade-no-fetch-no-socket-no-storage-no-provider-no-local-bridge-no-secret',
  });
}

export async function executeAssistantProviderRuntimeAction(
  input: AssistantProviderRuntimeExecutorInput,
): Promise<AssistantProviderRuntimeResult> {
  const rawInput = input as unknown;
  const trustedInput = isTrustedRuntimeInputRoot(rawInput) ? rawInput : undefined;
  const gateInput = trustedInput && isRecord(trustedInput.gateInput)
    ? trustedInput.gateInput as AssistantProviderExecutionGateInput
    : {} as AssistantProviderExecutionGateInput;
  const decision = evaluateAssistantProviderExecutionGate(gateInput);
  const runtimeInputBlockers = validateAssistantProviderRuntimeInput(rawInput, decision);

  if (runtimeInputBlockers.length > 0) {
    return providerResult(
      decision,
      runtimeInputBlockers,
      'runtime input metadata failed exact validation before provider adapter handoff',
    );
  }

  if (hasConnectorSecretMaterial(gateInput)) {
    return providerResult(decision, ['raw_secret_material'], 'raw secret material was rejected before adapter handoff');
  }
  if (decision.status !== 'allow') {
    return providerResult(decision, ['assistant_provider_gate_blocked'], 'assistant provider execution gate blocked the request');
  }
  const runtimeInput = rawInput as AssistantProviderRuntimeExecutorInput;
  const invocationBoundary = parseInvocationBoundary(runtimeInput.invocationBoundary);
  const fakeAdapter = parseFakeStreamAdapter(runtimeInput.fakeAdapter);
  if (runtimeInput.fakeAdapter !== undefined && runtimeInput.fakeAdapter !== null) {
    if (
      decision.provider !== 'local'
      || decision.action !== 'send_prompt'
      || !fakeAdapter
      || !fakeAdapterMatchesInvocation(fakeAdapter, invocationBoundary)
    ) {
      return providerResult(
        decision,
        ['assistant_provider_runtime_provenance_mismatch'],
        'fake local runtime adapter metadata must match the reviewed invocation boundary exactly',
      );
    }
    return fakeProviderResult(decision);
  }
  const executable = decision.executable as boolean;
  if (!executable) {
    return providerResult(decision, ['assistant_provider_gate_not_executable'], 'current gate decision is plan-only and not executable');
  }
  if (!runtimeInput.adapter) {
    return providerResult(decision, ['assistant_provider_adapter_missing'], 'reviewed provider runtime adapter is required');
  }
  if (runtimeInput.adapter.contract !== 'assistant-provider-runtime-adapter-v1-reviewed') {
    return providerResult(decision, ['assistant_provider_adapter_contract_unreviewed'], 'adapter contract is not reviewed');
  }

  return providerResult(decision, ['assistant_provider_gate_not_executable'], 'provider runtime remains disabled until gate contract changes');
}

function probeResult(
  input: {
    status?: AssistantProviderRuntimeResultStatus;
    executed?: boolean;
    bridgeKind?: LocalBridgeKind;
    acceptedEndpoint?: string;
    request?: LocalBridgeProbeTransportRequest;
    response?: LocalBridgeProbeTransportResponse;
    blockReasons?: readonly AssistantProviderRuntimeBlockReason[];
    gateBlockReasons?: readonly string[];
    safeDetail?: string;
  },
): LocalBridgeProbeRuntimeResult {
  return Object.freeze({
    status: input.status ?? 'block',
    executed: input.executed ?? false,
    bridgeKind: input.bridgeKind,
    acceptedEndpoint: input.acceptedEndpoint,
    request: input.request
      ? Object.freeze({
          method: input.request.method,
          url: input.request.url,
          timeoutMs: input.request.timeoutMs,
        })
      : undefined,
    response: input.response
      ? Object.freeze({
          ok: input.response.ok,
          ...(input.response.status !== undefined ? { status: input.response.status } : {}),
          ...(input.response.statusText !== undefined ? { statusText: input.response.statusText } : {}),
          ...(input.response.elapsedMs !== undefined ? { elapsedMs: input.response.elapsedMs } : {}),
        })
      : undefined,
    blockReasons: Object.freeze([...new Set(input.blockReasons ?? [])]),
    gateBlockReasons: Object.freeze([...(input.gateBlockReasons ?? [])]),
    safeDetail: input.safeDetail,
    sideEffectBoundary: 'runtime-facade-plan-only-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-callback',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isTrustedRuntimeInputRoot(value: unknown): value is Record<string, unknown> {
  return isRuntimeTrustedContractObject(value);
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
    && left.executable === right.executable
    && left.sideEffects === right.sideEffects
    && left.sideEffectBoundary === right.sideEffectBoundary;
}

function planHasOnlyAllowedKeys(plan: LocalBridgeInertManualProbePlan | null | undefined): boolean {
  return !!plan && isRecord(plan) && Object.keys(plan).every((key) => PROBE_PLAN_KEYS.has(key));
}

function secretBearingUrl(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return true;
    for (const key of url.searchParams.keys()) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        normalized.includes('token')
        || normalized.includes('secret')
        || normalized.includes('key')
        || normalized.includes('password')
        || normalized.includes('credential')
        || normalized.includes('authorization')
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost'
    || normalized === '::1'
    || normalized === '[::1]'
    || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

function localLoopbackUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (!isLoopbackHostname(url.hostname)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function safeProbeTimeout(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
    && value <= MAX_LOCAL_BRIDGE_TIMEOUT_MS;
}

function acceptedProbePlanIsSafe(plan: LocalBridgeInertManualProbePlan | null | undefined): boolean {
  if (!planHasOnlyAllowedKeys(plan) || !plan) return false;
  const acceptedEndpoint = localLoopbackUrl(plan.acceptedEndpoint);
  const url = localLoopbackUrl(plan.url);
  return !!acceptedEndpoint
    && !!url
    && !secretBearingUrl(acceptedEndpoint)
    && !secretBearingUrl(url)
    && plan.method === 'GET'
    && safeProbeTimeout(plan.timeoutMs)
    && plan.executable === false
    && plan.sideEffects === 'none'
    && plan.sideEffectBoundary === 'plan-only-no-fetch-no-socket';
}

function validateTransportRequest(
  transportRequest: (Partial<LocalBridgeProbeTransportRequest> & Record<string, unknown>) | null | undefined,
  expected: LocalBridgeInertManualProbePlan,
): readonly AssistantProviderRuntimeBlockReason[] {
  if (!transportRequest) return [];

  const blockReasons: AssistantProviderRuntimeBlockReason[] = [];
  if (!isRecord(transportRequest) || !Object.keys(transportRequest).every((key) => TRANSPORT_REQUEST_KEYS.has(key))) {
    blockReasons.push('local_bridge_transport_request_mismatch');
    return blockReasons;
  }
  if (transportRequest.method !== expected.method) blockReasons.push('local_bridge_transport_method_not_allowed');
  if (transportRequest.url !== expected.url) blockReasons.push('local_bridge_transport_url_not_allowed');
  if (secretBearingUrl(transportRequest.url)) blockReasons.push('local_bridge_transport_secret_bearing_url');
  if (transportRequest.timeoutMs !== expected.timeoutMs) blockReasons.push('local_bridge_transport_timeout_mismatch');
  if (transportRequest.headers !== undefined) blockReasons.push('local_bridge_transport_headers_forbidden');
  if (transportRequest.body !== undefined) blockReasons.push('local_bridge_transport_body_forbidden');
  if (transportRequest.credentials !== undefined) blockReasons.push('local_bridge_transport_credentials_forbidden');
  if (blockReasons.length > 0) blockReasons.push('local_bridge_transport_request_mismatch');
  return blockReasons;
}

function validateLocalBridgeProbeRuntimeInput(
  input: unknown,
): readonly AssistantProviderRuntimeBlockReason[] {
  const blockers: AssistantProviderRuntimeBlockReason[] = [];
  if (
    !isTrustedRuntimeInputRoot(input)
    || !hasOnlyAllowedKeys(input, LOCAL_BRIDGE_RUNTIME_INPUT_KEYS)
    || !isRecord(input.gateInput)
  ) {
    blockers.push('local_bridge_runtime_input_shape_forbidden');
    return Object.freeze(blockers);
  }
  if (input.requester !== undefined && input.requester !== null) {
    if (
      !isRecord(input.requester)
      || !hasOnlyAllowedKeys(input.requester, LOCAL_BRIDGE_REQUESTER_CONTRACT_KEYS)
      || typeof input.requester.request !== 'function'
    ) {
      blockers.push('local_bridge_runtime_input_shape_forbidden');
    }
  }
  return Object.freeze([...new Set(blockers)]);
}

function requesterMetadataMatchesPlan(
  requester: LocalBridgeProbeInjectedRequesterContract | null | undefined,
  expected: LocalBridgeInertManualProbePlan,
): boolean {
  return !!requester
    && isRecord(requester)
    && hasOnlyAllowedKeys(requester, LOCAL_BRIDGE_REQUESTER_CONTRACT_KEYS)
    && requester.contract === 'local-bridge-probe-runtime-injected-requester-v1-reviewed'
    && requester.injectionMode === 'explicit-reviewed-injected-requester'
    && requester.requesterKind === 'local-bridge-loopback-health-probe'
    && requester.acceptedEndpoint === expected.acceptedEndpoint
    && requester.method === expected.method
    && requester.url === expected.url
    && requester.timeoutMs === expected.timeoutMs
    && typeof requester.request === 'function'
    && requester.allowsHeaders === false
    && requester.allowsBody === false
    && requester.allowsCredentials === false
    && requester.allowsProviderCall === false
    && requester.allowsStorageMutation === false
    && requester.sideEffectBoundary === 'runtime-facade-reviewed-injected-requester-loopback-probe-only-no-direct-fetch-no-socket-no-storage-no-provider-no-credentials';
}

export async function executeLocalBridgeProbeRuntimePlan(
  input: LocalBridgeProbeRuntimeExecutorInput,
): Promise<LocalBridgeProbeRuntimeResult> {
  const rawInput = input as unknown;
  const trustedInput = isTrustedRuntimeInputRoot(rawInput) ? rawInput : undefined;
  const gateInput = trustedInput && isRecord(trustedInput.gateInput)
    ? trustedInput.gateInput as LocalBridgeProbeExecutionGateInput
    : {} as LocalBridgeProbeExecutionGateInput;
  const decision = evaluateLocalBridgeProbeExecutionGate(gateInput);
  const gateBlockReasons = decision.blockReasons;
  const runtimeInputBlockers = validateLocalBridgeProbeRuntimeInput(rawInput);

  if (runtimeInputBlockers.length > 0) {
    return probeResult({
      bridgeKind: decision.bridgeKind,
      acceptedEndpoint: decision.acceptedEndpoint,
      blockReasons: runtimeInputBlockers,
      gateBlockReasons,
      safeDetail: 'local bridge runtime input failed exact validation before requester handoff',
    });
  }

  const runtimeInput = rawInput as LocalBridgeProbeRuntimeExecutorInput;
  if (
    hasConnectorSecretMaterial(gateInput)
    || hasConnectorSecretMaterial(runtimeInput.probePlan)
    || hasConnectorSecretMaterial(runtimeInput.transportRequest)
    || hasConnectorSecretMaterial(runtimeInput.requester)
    || valueHasTokenOrSecretMaterial(runtimeInput.transportRequest)
    || valueHasTokenOrSecretMaterial(runtimeInput.requester)
  ) {
    return probeResult({
      bridgeKind: decision.bridgeKind,
      blockReasons: ['raw_secret_material'],
      gateBlockReasons,
      safeDetail: 'raw secret material was rejected before local bridge requester handoff',
    });
  }
  if (decision.status !== 'allow') {
    return probeResult({
      bridgeKind: decision.bridgeKind,
      blockReasons: ['local_bridge_probe_gate_blocked'],
      gateBlockReasons,
      safeDetail: 'local bridge probe execution gate blocked the request',
    });
  }
  if (!decision.probePlan || !runtimeInput.probePlan) {
    return probeResult({
      bridgeKind: decision.bridgeKind,
      acceptedEndpoint: decision.acceptedEndpoint,
      blockReasons: ['local_bridge_probe_plan_missing'],
      gateBlockReasons,
      safeDetail: 'an exact inert probe plan is required',
    });
  }
  if (
    !acceptedProbePlanIsSafe(decision.probePlan)
    || !acceptedProbePlanIsSafe(runtimeInput.probePlan)
    || !probePlansMatch(runtimeInput.probePlan, decision.probePlan)
  ) {
    return probeResult({
      bridgeKind: decision.bridgeKind,
      acceptedEndpoint: decision.acceptedEndpoint,
      blockReasons: ['local_bridge_probe_plan_mismatch'],
      gateBlockReasons,
      safeDetail: 'probe plan must remain exact, loopback-only, inert, and free of secret-bearing URLs',
    });
  }

  const transportBlockers = validateTransportRequest(runtimeInput.transportRequest, decision.probePlan);
  if (transportBlockers.length > 0) {
    return probeResult({
      bridgeKind: decision.bridgeKind,
      acceptedEndpoint: decision.acceptedEndpoint,
      blockReasons: transportBlockers,
      gateBlockReasons,
      safeDetail: 'transport request must match the gate output exactly and cannot carry headers, body, or credentials',
    });
  }
  if (runtimeInput.requester && !requesterMetadataMatchesPlan(runtimeInput.requester, decision.probePlan)) {
    return probeResult({
      bridgeKind: decision.bridgeKind,
      acceptedEndpoint: decision.acceptedEndpoint,
      blockReasons: ['local_bridge_runtime_input_shape_forbidden'],
      gateBlockReasons,
      safeDetail: 'local bridge requester metadata must match the inert probe plan before plan-only handoff',
    });
  }

  const request: LocalBridgeProbeTransportRequest = {
    method: decision.probePlan.method,
    url: decision.probePlan.url,
    timeoutMs: decision.probePlan.timeoutMs,
  };

  return probeResult({
    bridgeKind: decision.bridgeKind,
    acceptedEndpoint: decision.acceptedEndpoint,
    request,
    blockReasons: ['local_bridge_requester_execution_disabled'],
    gateBlockReasons,
    safeDetail: 'local bridge requester execution remains plan-only until a non-forgeable callable boundary exists',
  });
}
