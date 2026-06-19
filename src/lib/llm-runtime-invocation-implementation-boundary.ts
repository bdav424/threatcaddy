import {
  hasConnectorSecretMaterial,
  validateConnectorCredentialReference,
} from './connector-credential-boundary';
import type { AssistantProviderExecutionDecision } from './assistant-provider-execution-gate';
import type { AssistantProviderRuntimeResult } from './assistant-provider-runtime-executor';
import type { AssistantProviderRoute } from './assistant-provider-readiness';
import type { LlmProviderLiveActivationDecision } from './llm-provider-live-activation-gate';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from './runtime-trusted-contract-object';

export type LlmRuntimeInvocationImplementationStatus = 'blocked';

export type LlmRuntimeInvocationInjectedTransportExecutionStatus = 'blocked';

export type LlmRuntimeInvocationImplementationReason =
  | 'executable_llm_transport_contract_missing'
  | 'provider_execution_missing'
  | 'provider_execution_not_ready'
  | 'provider_execution_invalid'
  | 'runtime_result_missing'
  | 'runtime_result_invalid'
  | 'transport_facts_missing'
  | 'transport_facts_invalid'
  | 'invocation_plan_missing'
  | 'invocation_plan_invalid'
  | 'live_activation_missing'
  | 'live_activation_not_ready'
  | 'live_activation_invalid'
  | 'live_activation_binding_mismatch'
  | 'provider_owner_mismatch'
  | 'transport_identity_mismatch'
  | 'transport_shape_forbidden'
  | 'transport_result_forbidden'
  | 'transport_result_live_claim'
  | 'raw_secret_material'
  | 'prompt_or_payload_echo_forbidden';

export type LlmRuntimeInvocationInjectedTransportExecutionReason =
  | LlmRuntimeInvocationImplementationReason
  | 'input_shape_invalid'
  | 'implementation_boundary_not_ready'
  | 'injected_transport_missing'
  | 'injected_transport_invalid'
  | 'injected_transport_callback_forbidden'
  | 'injected_transport_provenance_mismatch'
  | 'injected_transport_execution_disabled';

export interface LlmRuntimeInvocationTransportIdentity {
  kind: 'future-reviewed-injected-llm-transport';
  id: string;
  version: string;
  owner: 'assistantcaddy-llm-runtime';
}

export interface LlmRuntimeInvocationTransportFacts {
  contract: 'llm-runtime-invocation-transport-facts-v1';
  provider: Extract<AssistantProviderRoute, 'local' | 'openai'>;
  model: string;
  action: 'send_prompt' | 'test_provider' | 'list_models';
  credentialReferenceId: string;
  requestId: string;
  localEndpoint?: string;
  promptEstimateChars?: number;
  transportIdentity: LlmRuntimeInvocationTransportIdentity;
  promptRedaction: 'prompt-omitted';
  bodyRedaction: 'body-omitted';
  headersRedaction: 'headers-omitted';
  streamingSupported: false;
  executable: false;
  dispatchAllowed: false;
  willCallProvider: false;
  willCallLocalBridge: false;
  willFetch: false;
  willOpenSocket: false;
  willStream: false;
  willMutateStorage: false;
  sideEffectBoundary: 'llm-transport-facts-only-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call';
}

export interface LlmRuntimeInvocationPlan {
  contract: 'llm-runtime-invocation-plan-v1';
  provider: Extract<AssistantProviderRoute, 'local' | 'openai'>;
  model: string;
  action: 'send_prompt' | 'test_provider' | 'list_models';
  credentialReferenceId: string;
  requestId: string;
  localEndpoint?: string;
  promptEstimateChars?: number;
  transportIdentity: LlmRuntimeInvocationTransportIdentity;
  acceptedProviderExecutionBoundary: 'decision-only-no-fetch-no-socket-no-storage-no-llm';
  acceptedRuntimeBoundary: 'fail-closed-runtime-facade-no-fetch-no-socket-no-storage-no-llm';
  promptRedaction: 'prompt-omitted';
  acknowledgedNoPromptEcho: true;
  acknowledgedNoBodyEcho: true;
  acknowledgedNoHeaderEcho: true;
  acknowledgedNoCredentialMaterial: true;
  acknowledgedNoNetwork: true;
  acknowledgedNoStorage: true;
  acknowledgedNoStreaming: true;
  executable: false;
  dispatchAllowed: false;
  sideEffectBoundary: 'llm-invocation-plan-only-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call';
}

export interface LlmRuntimeInvocationImplementationInput {
  liveActivation?: LlmProviderLiveActivationDecision | null;
  providerExecution?: AssistantProviderExecutionDecision | null;
  runtimeResult?: AssistantProviderRuntimeResult | null;
  transportFacts?: unknown;
  invocationPlan?: unknown;
  transport?: unknown;
  transportResult?: unknown;
}

export interface LlmRuntimeInvocationImplementationDecision {
  status: LlmRuntimeInvocationImplementationStatus;
  implementationBoundaryReady: boolean;
  reason: LlmRuntimeInvocationImplementationReason;
  provider?: Extract<AssistantProviderRoute, 'local' | 'openai'>;
  model?: string;
  action?: 'send_prompt' | 'test_provider' | 'list_models';
  credentialReferenceId?: string;
  requestId?: string;
  localEndpoint?: string;
  promptEstimateChars?: number;
  transportIdentity?: LlmRuntimeInvocationTransportIdentity;
  promptRedaction: 'prompt-omitted';
  canPrepareFutureLlmInvocation: boolean;
  executable: false;
  dispatchAllowed: false;
  willCallProvider: false;
  willCallLocalBridge: false;
  willFetch: false;
  willOpenSocket: false;
  willStream: false;
  willMutateStorage: false;
  sideEffectBoundary: 'llm-runtime-invocation-implementation-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call';
}

export interface LlmRuntimeInvocationInjectedTransportRequest {
  contract: 'llm-runtime-invocation-injected-test-double-request-v1';
  provider: Extract<AssistantProviderRoute, 'local' | 'openai'>;
  model: string;
  action: 'send_prompt' | 'test_provider' | 'list_models';
  credentialReferenceId: string;
  requestId: string;
  localEndpoint?: string;
  promptEstimateChars?: number;
  transportIdentity: LlmRuntimeInvocationTransportIdentity;
  promptRedaction: 'prompt-omitted';
  bodyRedaction: 'body-omitted';
  headersRedaction: 'headers-omitted';
  injectedTestDoubleOnly: true;
  injectedTestDoubleExecutable: false;
  dispatchAllowed: false;
  liveProviderDispatchAllowed: false;
  willCallProvider: false;
  willCallLocalBridge: false;
  willFetch: false;
  willOpenSocket: false;
  willStream: false;
  willMutateStorage: false;
  sideEffectBoundary: 'llm-runtime-invocation-injected-test-double-request-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call';
}

export interface LlmRuntimeInvocationInjectedTestDoubleTransport {
  contract: 'llm-runtime-invocation-injected-test-double-transport-v1-reviewed';
  kind: 'injected-test-double-only';
  provider: Extract<AssistantProviderRoute, 'local' | 'openai'>;
  model: string;
  action: 'send_prompt' | 'test_provider' | 'list_models';
  credentialReferenceId: string;
  requestId: string;
  localEndpoint?: string;
  promptEstimateChars?: number;
  transportIdentity: LlmRuntimeInvocationTransportIdentity;
  promptRedaction: 'prompt-omitted';
  bodyRedaction: 'body-omitted';
  headersRedaction: 'headers-omitted';
  injectedTestDoubleOnly: true;
  injectedTestDoubleExecutable: false;
  dispatchAllowed: false;
  liveProviderDispatchAllowed: false;
  willCallProvider: false;
  willCallLocalBridge: false;
  willFetch: false;
  willOpenSocket: false;
  willStream: false;
  willMutateStorage: false;
  sideEffectBoundary: 'llm-runtime-invocation-injected-test-double-transport-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call';
}

export interface LlmRuntimeInvocationInjectedTransportExecutionInput {
  liveActivation?: LlmProviderLiveActivationDecision | null;
  providerExecution?: AssistantProviderExecutionDecision | null;
  runtimeResult?: AssistantProviderRuntimeResult | null;
  transportFacts?: unknown;
  invocationPlan?: unknown;
  injectedTransport?: unknown;
  executeInjectedTestDouble?: true;
}

export interface LlmRuntimeInvocationInjectedTransportExecutionDecision {
  status: LlmRuntimeInvocationInjectedTransportExecutionStatus;
  reason: LlmRuntimeInvocationInjectedTransportExecutionReason;
  provider?: Extract<AssistantProviderRoute, 'local' | 'openai'>;
  model?: string;
  action?: 'send_prompt' | 'test_provider' | 'list_models';
  credentialReferenceId?: string;
  requestId?: string;
  localEndpoint?: string;
  promptEstimateChars?: number;
  transportIdentity?: LlmRuntimeInvocationTransportIdentity;
  request?: LlmRuntimeInvocationInjectedTransportRequest;
  safeResult?: undefined;
  promptRedaction: 'prompt-omitted';
  injectedTestDoubleExecuted: boolean;
  executable: false;
  dispatchAllowed: false;
  liveProviderDispatchAllowed: false;
  willCallProvider: false;
  willCallLocalBridge: false;
  willFetch: false;
  willOpenSocket: false;
  willStream: false;
  willMutateStorage: false;
  sideEffectBoundary: 'llm-runtime-invocation-injected-test-double-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call';
}

const PROVIDER_EXECUTION_BOUNDARY = 'decision-only-no-fetch-no-socket-no-storage-no-llm' as const;
const RUNTIME_BOUNDARY = 'fail-closed-runtime-facade-no-fetch-no-socket-no-storage-no-llm' as const;
const FACTS_BOUNDARY =
  'llm-transport-facts-only-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const PLAN_BOUNDARY =
  'llm-invocation-plan-only-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const DECISION_BOUNDARY =
  'llm-runtime-invocation-implementation-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const INJECTED_REQUEST_BOUNDARY =
  'llm-runtime-invocation-injected-test-double-request-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const INJECTED_TRANSPORT_BOUNDARY =
  'llm-runtime-invocation-injected-test-double-transport-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const INJECTED_DECISION_BOUNDARY =
  'llm-runtime-invocation-injected-test-double-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const LIVE_ACTIVATION_PLAN_BOUNDARY =
  'plan-only-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call' as const;
const LIVE_ACTIVATION_DECISION_BOUNDARY =
  'pure-local-llm-provider-live-activation-gate-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call' as const;
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_PROMPT_ESTIMATE_CHARS = 200_000;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
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
const PAYLOAD_ECHO_KEYS = new Set([
  'authorization',
  'body',
  'content',
  'headers',
  'messages',
  'prompt',
  'promptbody',
  'requestbody',
  'systemprompt',
]);
const PROMPT_OR_PAYLOAD_ECHO_TEXT_PATTERN =
  /\b(?:prompt|system\s*prompt|body|headers?|payload|message|messages|content)\s*[:=]/i;
const UNSAFE_ROOT_FIELD_MARKERS = [
  'adapter',
  'apikey',
  'authorization',
  'callback',
  'client',
  'credential',
  'execute',
  'fetch',
  'headers',
  'http',
  'indexeddb',
  'invoke',
  'liveaction',
  'liveprovider',
  'localbridge',
  'prompt',
  'request',
  'requester',
  'secret',
  'send',
  'socket',
  'storage',
  'stream',
  'token',
  'transport',
  'websocket',
] as const;
const INJECTED_TRANSPORT_UNSAFE_RUNTIME_FIELD_MARKERS = [
  'adapter',
  'callback',
  'execute',
  'fetch',
  'http',
  'indexeddb',
  'invoke',
  'liveaction',
  'liveprovider',
  'localbridge',
  'requester',
  'send',
  'socket',
  'storage',
  'stream',
  'websocket',
] as const;
const FACT_KEYS = new Set([
  'action',
  'bodyRedaction',
  'contract',
  'credentialReferenceId',
  'dispatchAllowed',
  'executable',
  'headersRedaction',
  'localEndpoint',
  'model',
  'promptEstimateChars',
  'promptRedaction',
  'provider',
  'requestId',
  'sideEffectBoundary',
  'streamingSupported',
  'transportIdentity',
  'willCallLocalBridge',
  'willCallProvider',
  'willFetch',
  'willMutateStorage',
  'willOpenSocket',
  'willStream',
]);
const PLAN_KEYS = new Set([
  'acceptedProviderExecutionBoundary',
  'acceptedRuntimeBoundary',
  'acknowledgedNoBodyEcho',
  'acknowledgedNoCredentialMaterial',
  'acknowledgedNoHeaderEcho',
  'acknowledgedNoNetwork',
  'acknowledgedNoPromptEcho',
  'acknowledgedNoStorage',
  'acknowledgedNoStreaming',
  'action',
  'contract',
  'credentialReferenceId',
  'dispatchAllowed',
  'executable',
  'localEndpoint',
  'model',
  'promptEstimateChars',
  'promptRedaction',
  'provider',
  'requestId',
  'sideEffectBoundary',
  'transportIdentity',
]);
const TRANSPORT_IDENTITY_KEYS = new Set(['id', 'kind', 'owner', 'version']);
const PROVIDER_EXECUTION_KEYS = new Set([
  'action',
  'allowReason',
  'blockReasons',
  'credentialReference',
  'credentialRejectReason',
  'executable',
  'localEndpoint',
  'model',
  'promptEstimateChars',
  'provider',
  'sideEffectBoundary',
  'sideEffects',
  'status',
]);
const RUNTIME_RESULT_KEYS = new Set([
  'action',
  'blockReasons',
  'credentialReferenceId',
  'executed',
  'gateBlockReasons',
  'localEndpoint',
  'model',
  'promptEstimateChars',
  'provider',
  'safeDetail',
  'sideEffectBoundary',
  'status',
]);
const IMPLEMENTATION_INPUT_KEYS = new Set([
  'invocationPlan',
  'liveActivation',
  'providerExecution',
  'runtimeResult',
  'transport',
  'transportFacts',
  'transportResult',
]);
const INJECTED_EXECUTION_INPUT_KEYS = new Set([
  'executeInjectedTestDouble',
  'injectedTransport',
  'invocationPlan',
  'liveActivation',
  'providerExecution',
  'runtimeResult',
  'transportFacts',
]);
const INJECTED_TRANSPORT_KEYS = new Set([
  'action',
  'bodyRedaction',
  'contract',
  'credentialReferenceId',
  'dispatchAllowed',
  'headersRedaction',
  'injectedTestDoubleExecutable',
  'injectedTestDoubleOnly',
  'kind',
  'liveProviderDispatchAllowed',
  'localEndpoint',
  'model',
  'promptEstimateChars',
  'promptRedaction',
  'provider',
  'requestId',
  'sideEffectBoundary',
  'transportIdentity',
  'willCallLocalBridge',
  'willCallProvider',
  'willFetch',
  'willMutateStorage',
  'willOpenSocket',
  'willStream',
]);
const LIVE_ACTIVATION_DECISION_KEYS = new Set([
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
const LIVE_ACTIVATION_PLAN_KEYS = new Set([
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
function isTrustedContractRecord(value: unknown): value is RuntimeTrustedContractObject {
  return isRuntimeTrustedContractObject(value);
}

function trustedContractObject<T>(entries: readonly RuntimeTrustedContractEntry[]): T {
  return createRuntimeTrustedContractObject(entries) as unknown as T;
}

function trustedBoundarySubset(
  input: RuntimeTrustedContractObject,
): LlmRuntimeInvocationImplementationInput {
  const entries: RuntimeTrustedContractEntry[] = [];
  for (const key of [
    'liveActivation',
    'providerExecution',
    'runtimeResult',
    'transportFacts',
    'invocationPlan',
  ] as const) {
    if (key in input) {
      entries.push([key, input[key] as RuntimeTrustedContractValue]);
    }
  }
  return trustedContractObject<LlmRuntimeInvocationImplementationInput>(entries);
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function objectHasUnsafeRootField(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).some((key) => (
    !allowed.has(key)
    && UNSAFE_ROOT_FIELD_MARKERS.some((marker) => normalizedKey(key).includes(marker))
  ));
}

function stringLooksSecretBearing(value: string): boolean {
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

function safeIdentifier(value: unknown): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) return undefined;
  if (
    normalized.length > MAX_IDENTIFIER_LENGTH
    || !SAFE_ID_PATTERN.test(normalized)
    || stringLooksUnsafeSchemeIdentifier(normalized)
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

function localLoopbackHttpUrl(value: unknown): string | undefined {
  const normalized = absoluteHttpUrl(value);
  if (!normalized) return undefined;
  const url = new URL(normalized);
  return isLoopbackHostname(url.hostname) ? normalized : undefined;
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

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (SECRET_URL_PARAM_MARKERS.some((marker) => normalizedKey === marker || normalizedKey.endsWith(marker))) {
      return true;
    }
    if (valueHasSecretMaterial(nestedValue, seen)) return true;
  }
  return false;
}

function valueHasPromptOrPayloadEcho(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  if (currentKey) {
    const normalizedKey = currentKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (PAYLOAD_ECHO_KEYS.has(normalizedKey)) return true;
  }
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return PROMPT_OR_PAYLOAD_ECHO_TEXT_PATTERN.test(value);
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
  return Object.entries(value).some(([key, nestedValue]) => (
    valueHasPromptOrPayloadEcho(nestedValue, seen, key)
  ));
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function parseTransportIdentity(value: unknown): LlmRuntimeInvocationTransportIdentity | undefined {
  if (!isTrustedContractRecord(value) || !hasOnlyAllowedKeys(value, TRANSPORT_IDENTITY_KEYS)) return undefined;
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

function parsePromptEstimate(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 0
    || value > MAX_PROMPT_ESTIMATE_CHARS
  ) {
    return undefined;
  }
  return value;
}

function parseSafeDetail(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizedString(value);
  if (
    !normalized
    || normalized.length > 240
    || stringLooksSecretBearing(normalized)
    || PROMPT_OR_PAYLOAD_ECHO_TEXT_PATTERN.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function allowReasonMatchesAction(
  action: AssistantProviderExecutionDecision['action'],
  allowReason: unknown,
): boolean {
  if (action === 'send_prompt') return allowReason === 'explicit_prompt_dispatch_ready';
  if (action === 'test_provider') return allowReason === 'explicit_provider_test_plan_only';
  if (action === 'list_models') return allowReason === 'explicit_model_list_plan_only';
  return false;
}

function parseFacts(value: unknown): LlmRuntimeInvocationTransportFacts | undefined {
  if (!isTrustedContractRecord(value) || !hasOnlyAllowedKeys(value, FACT_KEYS)) return undefined;
  const provider = value.provider === 'local' || value.provider === 'openai' ? value.provider : undefined;
  const model = safeIdentifier(value.model);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const requestId = safeIdentifier(value.requestId);
  const transportIdentity = parseTransportIdentity(value.transportIdentity);
  const localEndpoint = value.localEndpoint === undefined ? undefined : localLoopbackHttpUrl(value.localEndpoint);
  const promptEstimateChars = parsePromptEstimate(value.promptEstimateChars);

  if (
    value.contract !== 'llm-runtime-invocation-transport-facts-v1'
    || !provider
    || !model
    || (value.action !== 'send_prompt' && value.action !== 'test_provider' && value.action !== 'list_models')
    || !credentialReferenceId
    || !requestId
    || !transportIdentity
    || (value.localEndpoint !== undefined && (!localEndpoint || urlHasSecretMaterial(localEndpoint)))
    || (provider === 'local' && !localEndpoint)
    || (provider !== 'local' && value.localEndpoint !== undefined)
    || (value.promptEstimateChars !== undefined && promptEstimateChars === undefined)
    || value.promptRedaction !== 'prompt-omitted'
    || value.bodyRedaction !== 'body-omitted'
    || value.headersRedaction !== 'headers-omitted'
    || value.streamingSupported !== false
    || value.executable !== false
    || value.dispatchAllowed !== false
    || value.willCallProvider !== false
    || value.willCallLocalBridge !== false
    || value.willFetch !== false
    || value.willOpenSocket !== false
    || value.willStream !== false
    || value.willMutateStorage !== false
    || value.sideEffectBoundary !== FACTS_BOUNDARY
  ) {
    return undefined;
  }
  return Object.freeze({
    contract: 'llm-runtime-invocation-transport-facts-v1',
    provider,
    model,
    action: value.action,
    credentialReferenceId,
    requestId,
    ...(localEndpoint ? { localEndpoint } : {}),
    ...(promptEstimateChars !== undefined ? { promptEstimateChars } : {}),
    transportIdentity,
    promptRedaction: 'prompt-omitted',
    bodyRedaction: 'body-omitted',
    headersRedaction: 'headers-omitted',
    streamingSupported: false,
    executable: false,
    dispatchAllowed: false,
    willCallProvider: false,
    willCallLocalBridge: false,
    willFetch: false,
    willOpenSocket: false,
    willStream: false,
    willMutateStorage: false,
    sideEffectBoundary: FACTS_BOUNDARY,
  });
}

function parsePlan(value: unknown): LlmRuntimeInvocationPlan | undefined {
  if (!isTrustedContractRecord(value) || !hasOnlyAllowedKeys(value, PLAN_KEYS)) return undefined;
  const provider = value.provider === 'local' || value.provider === 'openai' ? value.provider : undefined;
  const model = safeIdentifier(value.model);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const requestId = safeIdentifier(value.requestId);
  const transportIdentity = parseTransportIdentity(value.transportIdentity);
  const localEndpoint = value.localEndpoint === undefined ? undefined : localLoopbackHttpUrl(value.localEndpoint);
  const promptEstimateChars = parsePromptEstimate(value.promptEstimateChars);

  if (
    value.contract !== 'llm-runtime-invocation-plan-v1'
    || !provider
    || !model
    || (value.action !== 'send_prompt' && value.action !== 'test_provider' && value.action !== 'list_models')
    || !credentialReferenceId
    || !requestId
    || !transportIdentity
    || (value.localEndpoint !== undefined && (!localEndpoint || urlHasSecretMaterial(localEndpoint)))
    || (provider === 'local' && !localEndpoint)
    || (provider !== 'local' && value.localEndpoint !== undefined)
    || (value.promptEstimateChars !== undefined && promptEstimateChars === undefined)
    || value.acceptedProviderExecutionBoundary !== PROVIDER_EXECUTION_BOUNDARY
    || value.acceptedRuntimeBoundary !== RUNTIME_BOUNDARY
    || value.promptRedaction !== 'prompt-omitted'
    || value.acknowledgedNoPromptEcho !== true
    || value.acknowledgedNoBodyEcho !== true
    || value.acknowledgedNoHeaderEcho !== true
    || value.acknowledgedNoCredentialMaterial !== true
    || value.acknowledgedNoNetwork !== true
    || value.acknowledgedNoStorage !== true
    || value.acknowledgedNoStreaming !== true
    || value.executable !== false
    || value.dispatchAllowed !== false
    || value.sideEffectBoundary !== PLAN_BOUNDARY
  ) {
    return undefined;
  }
  return Object.freeze({
    contract: 'llm-runtime-invocation-plan-v1',
    provider,
    model,
    action: value.action,
    credentialReferenceId,
    requestId,
    ...(localEndpoint ? { localEndpoint } : {}),
    ...(promptEstimateChars !== undefined ? { promptEstimateChars } : {}),
    transportIdentity,
    acceptedProviderExecutionBoundary: PROVIDER_EXECUTION_BOUNDARY,
    acceptedRuntimeBoundary: RUNTIME_BOUNDARY,
    promptRedaction: 'prompt-omitted',
    acknowledgedNoPromptEcho: true,
    acknowledgedNoBodyEcho: true,
    acknowledgedNoHeaderEcho: true,
    acknowledgedNoCredentialMaterial: true,
    acknowledgedNoNetwork: true,
    acknowledgedNoStorage: true,
    acknowledgedNoStreaming: true,
    executable: false,
    dispatchAllowed: false,
    sideEffectBoundary: PLAN_BOUNDARY,
  });
}

function parseProviderExecution(value: unknown): AssistantProviderExecutionDecision | undefined {
  if (!isTrustedContractRecord(value) || !hasOnlyAllowedKeys(value, PROVIDER_EXECUTION_KEYS)) return undefined;
  const provider = value.provider === 'local' || value.provider === 'openai' ? value.provider : undefined;
  const model = safeIdentifier(value.model);
  const promptEstimateChars = parsePromptEstimate(value.promptEstimateChars);
  const localEndpoint = value.localEndpoint === undefined ? undefined : localLoopbackHttpUrl(value.localEndpoint);
  if (!isTrustedContractRecord(value.credentialReference)) return undefined;
  const credentialValidation = validateConnectorCredentialReference(value.credentialReference);
  if (
    value.status !== 'allow'
    || value.executable !== false
    || value.sideEffects !== 'none'
    || value.sideEffectBoundary !== PROVIDER_EXECUTION_BOUNDARY
    || !provider
    || !model
    || (value.action !== 'send_prompt' && value.action !== 'test_provider' && value.action !== 'list_models')
    || !credentialValidation.ok
    || !safeIdentifier(credentialValidation.reference.id)
    || (credentialValidation.reference.providerId && credentialValidation.reference.providerId !== provider)
    || !Array.isArray(value.blockReasons)
    || value.blockReasons.length !== 0
    || value.credentialRejectReason !== undefined
    || !allowReasonMatchesAction(value.action, value.allowReason)
    || (provider === 'local' && (!localEndpoint || urlHasSecretMaterial(localEndpoint)))
    || (provider !== 'local' && value.localEndpoint !== undefined)
    || (value.promptEstimateChars !== undefined && promptEstimateChars === undefined)
    || (value.action === 'send_prompt' && promptEstimateChars === undefined)
  ) {
    return undefined;
  }

  return Object.freeze({
    status: 'allow',
    action: value.action,
    executable: false,
    sideEffects: 'none',
    provider,
    model,
    ...(localEndpoint ? { localEndpoint } : {}),
    credentialReference: credentialValidation.reference,
    ...(promptEstimateChars !== undefined ? { promptEstimateChars } : {}),
    allowReason: value.allowReason as AssistantProviderExecutionDecision['allowReason'],
    blockReasons: Object.freeze([]),
    credentialRejectReason: undefined,
    sideEffectBoundary: PROVIDER_EXECUTION_BOUNDARY,
  });
}

function parseRuntimeResult(
  value: unknown,
  decision: AssistantProviderExecutionDecision,
): AssistantProviderRuntimeResult | undefined {
  if (!isTrustedContractRecord(value) || !hasOnlyAllowedKeys(value, RUNTIME_RESULT_KEYS)) return undefined;
  const provider = value.provider === 'local' || value.provider === 'openai' ? value.provider : undefined;
  const model = safeIdentifier(value.model);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const promptEstimateChars = parsePromptEstimate(value.promptEstimateChars);
  const localEndpoint = value.localEndpoint === undefined ? undefined : localLoopbackHttpUrl(value.localEndpoint);
  const safeDetail = parseSafeDetail(value.safeDetail);
  if (
    value.status !== 'block'
    || value.executed !== false
    || provider !== decision.provider
    || model !== decision.model
    || credentialReferenceId !== decision.credentialReference?.id
    || promptEstimateChars !== decision.promptEstimateChars
    || localEndpoint !== decision.localEndpoint
    || (value.safeDetail !== undefined && safeDetail === undefined)
    || value.action !== decision.action
    || value.sideEffectBoundary !== RUNTIME_BOUNDARY
    || !Array.isArray(value.blockReasons)
    || value.blockReasons.length !== 1
    || value.blockReasons[0] !== 'assistant_provider_gate_not_executable'
    || !Array.isArray(value.gateBlockReasons)
    || value.gateBlockReasons.length !== 0
    || (value.safeDetail !== undefined && safeDetail === undefined)
    || (provider === 'local' && (!localEndpoint || urlHasSecretMaterial(localEndpoint)))
    || (provider !== 'local' && value.localEndpoint !== undefined)
    || (value.promptEstimateChars !== undefined && promptEstimateChars === undefined)
    || (decision.action === 'send_prompt' && promptEstimateChars === undefined)
  ) {
    return undefined;
  }

  return Object.freeze({
    status: 'block',
    executed: false,
    action: decision.action,
    provider: decision.provider,
    model: decision.model,
    ...(decision.localEndpoint ? { localEndpoint: decision.localEndpoint } : {}),
    credentialReferenceId: decision.credentialReference?.id,
    ...(decision.promptEstimateChars !== undefined ? { promptEstimateChars: decision.promptEstimateChars } : {}),
    blockReasons: Object.freeze(['assistant_provider_gate_not_executable'] as const),
    gateBlockReasons: Object.freeze([]),
    ...(safeDetail !== undefined ? { safeDetail } : {}),
    sideEffectBoundary: RUNTIME_BOUNDARY,
  });
}

interface ParsedLiveActivationEvidence {
  provider: Extract<AssistantProviderRoute, 'local' | 'openai'>;
  model: string;
  credentialReferenceId: string;
  acceptedEndpoint: string;
  promptEstimateChars: number;
  maxPromptChars: number;
}

function parseLiveActivationCredentialReferenceId(
  value: unknown,
  provider: Extract<AssistantProviderRoute, 'local' | 'openai'>,
): string | undefined {
  if (!isTrustedContractRecord(value) || !hasOnlyAllowedKeys(value, CREDENTIAL_REFERENCE_KEYS)) return undefined;
  const credentialValidation = validateConnectorCredentialReference(value);
  if (!credentialValidation.ok) return undefined;
  const credentialReferenceId = safeIdentifier(credentialValidation.reference.id);
  if (!credentialReferenceId || credentialValidation.reference.providerId !== provider) return undefined;
  return credentialReferenceId;
}

function parseLiveActivationPlan(value: unknown): ParsedLiveActivationEvidence | undefined {
  if (!isTrustedContractRecord(value) || !hasOnlyAllowedKeys(value, LIVE_ACTIVATION_PLAN_KEYS)) return undefined;
  const provider = value.providerId === 'local' || value.providerId === 'openai' ? value.providerId : undefined;
  const model = safeIdentifier(value.modelId);
  const runtimeId = safeIdentifier(value.runtimeId);
  const endpointId = safeIdentifier(value.endpointId);
  const promptBudgetId = safeIdentifier(value.promptBudgetId);
  const promptEstimateChars = parsePromptEstimate(value.estimatedPromptChars);
  const maxPromptChars = parsePromptEstimate(value.maxPromptChars);
  const acceptedEndpoint = provider === 'local'
    ? localLoopbackHttpUrl(value.acceptedEndpoint)
    : absoluteHttpUrl(value.acceptedEndpoint);
  const credentialReferenceId = provider
    ? parseLiveActivationCredentialReferenceId(value.credentialReference, provider)
    : undefined;

  if (
    value.contract !== 'llm-provider-live-activation-plan-v1'
    || !provider
    || !model
    || value.runtimeOwner !== 'assistantcaddy-llm-provider-runtime'
    || !runtimeId
    || !credentialReferenceId
    || !endpointId
    || !acceptedEndpoint
    || urlHasSecretMaterial(acceptedEndpoint)
    || !promptBudgetId
    || promptEstimateChars === undefined
    || maxPromptChars === undefined
    || maxPromptChars === 0
    || promptEstimateChars > maxPromptChars
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
    || value.sideEffectBoundary !== LIVE_ACTIVATION_PLAN_BOUNDARY
  ) {
    return undefined;
  }

  return Object.freeze({
    provider,
    model,
    credentialReferenceId,
    acceptedEndpoint,
    promptEstimateChars,
    maxPromptChars,
  });
}

function parseLiveActivationDecision(value: unknown): ParsedLiveActivationEvidence | undefined {
  if (!isTrustedContractRecord(value) || !hasOnlyAllowedKeys(value, LIVE_ACTIVATION_DECISION_KEYS)) return undefined;
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
    || value.sideEffectBoundary !== LIVE_ACTIVATION_DECISION_BOUNDARY
  ) {
    return undefined;
  }
  return parseLiveActivationPlan(value.activationPlan);
}

function liveActivationMatchesFacts(
  activation: ParsedLiveActivationEvidence,
  facts: LlmRuntimeInvocationTransportFacts,
): boolean {
  return facts.action === 'send_prompt'
    && activation.provider === facts.provider
    && activation.model === facts.model
    && activation.credentialReferenceId === facts.credentialReferenceId
    && activation.promptEstimateChars === facts.promptEstimateChars
    && facts.provider === 'local'
    && activation.acceptedEndpoint === facts.localEndpoint;
}

function factsMatchProviderAndRuntime(
  facts: LlmRuntimeInvocationTransportFacts,
  decision: AssistantProviderExecutionDecision,
  result: AssistantProviderRuntimeResult,
): boolean {
  return facts.provider === decision.provider
    && facts.provider === result.provider
    && facts.model === decision.model
    && facts.model === result.model
    && facts.action === decision.action
    && facts.action === result.action
    && facts.localEndpoint === decision.localEndpoint
    && facts.localEndpoint === result.localEndpoint
    && facts.credentialReferenceId === decision.credentialReference?.id
    && facts.credentialReferenceId === result.credentialReferenceId
    && facts.promptEstimateChars === decision.promptEstimateChars
    && facts.promptEstimateChars === result.promptEstimateChars
    && (facts.provider !== 'local' || !!facts.localEndpoint);
}

function plansMatchFacts(
  facts: LlmRuntimeInvocationTransportFacts,
  plan: LlmRuntimeInvocationPlan,
): boolean {
  return plan.provider === facts.provider
    && plan.model === facts.model
    && plan.action === facts.action
    && plan.credentialReferenceId === facts.credentialReferenceId
    && plan.requestId === facts.requestId
    && plan.localEndpoint === facts.localEndpoint
    && plan.promptEstimateChars === facts.promptEstimateChars
    && plan.transportIdentity.kind === facts.transportIdentity.kind
    && plan.transportIdentity.id === facts.transportIdentity.id
    && plan.transportIdentity.version === facts.transportIdentity.version
    && plan.transportIdentity.owner === facts.transportIdentity.owner;
}

function valueContainsTransport(value: unknown): boolean {
  if (typeof value === 'function') return true;
  if (!isTrustedContractRecord(value)) return value !== undefined;
  const forbiddenKeys = [
    'adapter',
    'callback',
    'client',
    'execute',
    'fetch',
    'http',
    'invoke',
    'indexeddb',
    'liveaction',
    'liveprovider',
    'localbridge',
    'onDelta',
    'onResult',
    'provider',
    'request',
    'requester',
    'send',
    'socket',
    'storage',
    'stream',
    'transport',
  ];
  return Object.entries(value).some(([key, nested]) => {
    const normalized = key.toLowerCase();
    if (forbiddenKeys.some((forbidden) => normalized.includes(forbidden.toLowerCase()))) return true;
    if (typeof nested === 'function') return true;
    if (isTrustedContractRecord(nested)) return valueContainsTransport(nested);
    return false;
  });
}

function transportResultClaimsLiveExecution(value: unknown): boolean {
  if (!isTrustedContractRecord(value)) return false;
  return value.executed === true
    || value.dispatched === true
    || value.providerCalled === true
    || value.localBridgeCalled === true
    || value.fetchCalled === true
    || value.socketOpened === true
    || value.streamed === true
    || value.stored === true
    || value.requesterCalled === true
    || value.storageMutated === true
    || value.localStorageCalled === true
    || value.sessionStorageCalled === true
    || value.indexedDbCalled === true
    || value.credentialResolved === true
    || value.liveAction === true
    || value.dispatchAllowed === true
    || value.liveProviderDispatchAllowed === true
    || value.willCallProvider === true
    || value.willCallLocalBridge === true
    || value.willFetch === true
    || value.willOpenSocket === true
    || value.willStream === true
    || value.willMutateStorage === true
    || value.executable === true;
}

function injectedTransportContainsCallableField(value: unknown): boolean {
  if (!isTrustedContractRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) => {
    const normalized = normalizedKey(key);
    if (normalized === 'execute') return true;
    if (typeof nested === 'function') return true;
    if (
      INJECTED_TRANSPORT_UNSAFE_RUNTIME_FIELD_MARKERS.some((marker) => normalized.includes(marker))
      && nested !== undefined
      && nested !== false
    ) {
      return true;
    }
    return isTrustedContractRecord(nested) ? injectedTransportContainsCallableField(nested) : false;
  });
}

function freezeTransportIdentity(
  identity: LlmRuntimeInvocationTransportIdentity,
): LlmRuntimeInvocationTransportIdentity {
  return Object.freeze({
    kind: identity.kind,
    id: identity.id,
    version: identity.version,
    owner: identity.owner,
  });
}

function transportIdentitiesMatch(
  left: LlmRuntimeInvocationTransportIdentity,
  right: LlmRuntimeInvocationTransportIdentity,
): boolean {
  return left.kind === right.kind
    && left.id === right.id
    && left.version === right.version
    && left.owner === right.owner;
}

function parseInjectedTransport(
  value: unknown,
): LlmRuntimeInvocationInjectedTestDoubleTransport | undefined {
  if (!isTrustedContractRecord(value) || !hasOnlyAllowedKeys(value, INJECTED_TRANSPORT_KEYS)) return undefined;
  const provider = value.provider === 'local' || value.provider === 'openai' ? value.provider : undefined;
  const model = safeIdentifier(value.model);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const requestId = safeIdentifier(value.requestId);
  const transportIdentity = parseTransportIdentity(value.transportIdentity);
  const localEndpoint = value.localEndpoint === undefined ? undefined : localLoopbackHttpUrl(value.localEndpoint);
  const promptEstimateChars = parsePromptEstimate(value.promptEstimateChars);
  if (
    value.contract !== 'llm-runtime-invocation-injected-test-double-transport-v1-reviewed'
    || value.kind !== 'injected-test-double-only'
    || !provider
    || !model
    || (value.action !== 'send_prompt' && value.action !== 'test_provider' && value.action !== 'list_models')
    || !credentialReferenceId
    || !requestId
    || !transportIdentity
    || (value.localEndpoint !== undefined && (!localEndpoint || urlHasSecretMaterial(localEndpoint)))
    || (provider === 'local' && !localEndpoint)
    || (provider !== 'local' && value.localEndpoint !== undefined)
    || (value.promptEstimateChars !== undefined && promptEstimateChars === undefined)
    || value.promptRedaction !== 'prompt-omitted'
    || value.bodyRedaction !== 'body-omitted'
    || value.headersRedaction !== 'headers-omitted'
    || value.injectedTestDoubleOnly !== true
    || value.injectedTestDoubleExecutable !== false
    || value.dispatchAllowed !== false
    || value.liveProviderDispatchAllowed !== false
    || value.willCallProvider !== false
    || value.willCallLocalBridge !== false
    || value.willFetch !== false
    || value.willOpenSocket !== false
    || value.willStream !== false
    || value.willMutateStorage !== false
    || value.sideEffectBoundary !== INJECTED_TRANSPORT_BOUNDARY
  ) {
    return undefined;
  }
  return Object.freeze({
    contract: 'llm-runtime-invocation-injected-test-double-transport-v1-reviewed',
    kind: 'injected-test-double-only',
    provider,
    model,
    action: value.action,
    credentialReferenceId,
    requestId,
    ...(localEndpoint ? { localEndpoint } : {}),
    ...(promptEstimateChars !== undefined ? { promptEstimateChars } : {}),
    transportIdentity,
    promptRedaction: 'prompt-omitted',
    bodyRedaction: 'body-omitted',
    headersRedaction: 'headers-omitted',
    injectedTestDoubleOnly: true,
    injectedTestDoubleExecutable: false,
    dispatchAllowed: false,
    liveProviderDispatchAllowed: false,
    willCallProvider: false,
    willCallLocalBridge: false,
    willFetch: false,
    willOpenSocket: false,
    willStream: false,
    willMutateStorage: false,
    sideEffectBoundary: INJECTED_TRANSPORT_BOUNDARY,
  });
}

function injectedTransportMatchesFacts(
  transport: LlmRuntimeInvocationInjectedTestDoubleTransport,
  facts: LlmRuntimeInvocationTransportFacts,
): boolean {
  return transport.provider === facts.provider
    && transport.model === facts.model
    && transport.action === facts.action
    && transport.credentialReferenceId === facts.credentialReferenceId
    && transport.requestId === facts.requestId
    && transport.localEndpoint === facts.localEndpoint
    && transport.promptEstimateChars === facts.promptEstimateChars
    && transportIdentitiesMatch(transport.transportIdentity, facts.transportIdentity);
}

function buildInjectedTransportRequest(
  facts: LlmRuntimeInvocationTransportFacts,
): LlmRuntimeInvocationInjectedTransportRequest {
  return Object.freeze({
    contract: 'llm-runtime-invocation-injected-test-double-request-v1',
    provider: facts.provider,
    model: facts.model,
    action: facts.action,
    credentialReferenceId: facts.credentialReferenceId,
    requestId: facts.requestId,
    ...(facts.localEndpoint ? { localEndpoint: facts.localEndpoint } : {}),
    ...(facts.promptEstimateChars !== undefined ? { promptEstimateChars: facts.promptEstimateChars } : {}),
    transportIdentity: freezeTransportIdentity(facts.transportIdentity),
    promptRedaction: 'prompt-omitted',
    bodyRedaction: 'body-omitted',
    headersRedaction: 'headers-omitted',
    injectedTestDoubleOnly: true,
    injectedTestDoubleExecutable: false,
    dispatchAllowed: false,
    liveProviderDispatchAllowed: false,
    willCallProvider: false,
    willCallLocalBridge: false,
    willFetch: false,
    willOpenSocket: false,
    willStream: false,
    willMutateStorage: false,
    sideEffectBoundary: INJECTED_REQUEST_BOUNDARY,
  });
}

function freezeDecision(
  reason: LlmRuntimeInvocationImplementationReason,
  facts?: LlmRuntimeInvocationTransportFacts,
): Readonly<LlmRuntimeInvocationImplementationDecision> {
  const ready = reason === 'executable_llm_transport_contract_missing' && facts !== undefined;
  return Object.freeze({
    status: 'blocked',
    implementationBoundaryReady: ready,
    reason,
    provider: facts?.provider,
    model: facts?.model,
    action: facts?.action,
    credentialReferenceId: facts?.credentialReferenceId,
    requestId: facts?.requestId,
    localEndpoint: facts?.localEndpoint,
    promptEstimateChars: facts?.promptEstimateChars,
    transportIdentity: facts
      ? Object.freeze({
          kind: facts.transportIdentity.kind,
          id: facts.transportIdentity.id,
          version: facts.transportIdentity.version,
          owner: facts.transportIdentity.owner,
        })
      : undefined,
    promptRedaction: 'prompt-omitted',
    canPrepareFutureLlmInvocation: ready,
    executable: false,
    dispatchAllowed: false,
    willCallProvider: false,
    willCallLocalBridge: false,
    willFetch: false,
    willOpenSocket: false,
    willStream: false,
    willMutateStorage: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}

function freezeInjectedTransportDecision(
  reason: LlmRuntimeInvocationInjectedTransportExecutionReason,
  facts?: LlmRuntimeInvocationTransportFacts,
  request?: LlmRuntimeInvocationInjectedTransportRequest,
): Readonly<LlmRuntimeInvocationInjectedTransportExecutionDecision> {
  return Object.freeze({
    status: 'blocked',
    reason,
    provider: facts?.provider,
    model: facts?.model,
    action: facts?.action,
    credentialReferenceId: facts?.credentialReferenceId,
    requestId: facts?.requestId,
    localEndpoint: facts?.localEndpoint,
    promptEstimateChars: facts?.promptEstimateChars,
    transportIdentity: facts ? freezeTransportIdentity(facts.transportIdentity) : undefined,
    request,
    safeResult: undefined,
    promptRedaction: 'prompt-omitted',
    injectedTestDoubleExecuted: false,
    executable: false,
    dispatchAllowed: false,
    liveProviderDispatchAllowed: false,
    willCallProvider: false,
    willCallLocalBridge: false,
    willFetch: false,
    willOpenSocket: false,
    willStream: false,
    willMutateStorage: false,
    sideEffectBoundary: INJECTED_DECISION_BOUNDARY,
  });
}

export function evaluateLlmRuntimeInvocationImplementationBoundary(
  input: LlmRuntimeInvocationImplementationInput = {},
): Readonly<LlmRuntimeInvocationImplementationDecision> {
  const rawInput = input as unknown;
  if (!isTrustedContractRecord(rawInput)) {
    return freezeDecision('transport_shape_forbidden');
  }
  if (objectHasUnsafeRootField(rawInput, IMPLEMENTATION_INPUT_KEYS)) {
    return freezeDecision('transport_shape_forbidden');
  }
  if (!hasOnlyAllowedKeys(rawInput, IMPLEMENTATION_INPUT_KEYS)) {
    return freezeDecision('transport_shape_forbidden');
  }
  if (hasConnectorSecretMaterial(rawInput) || valueHasSecretMaterial(rawInput)) {
    return freezeDecision('raw_secret_material');
  }
  if (valueHasPromptOrPayloadEcho(rawInput)) {
    return freezeDecision('prompt_or_payload_echo_forbidden');
  }
  if (input.transport !== undefined) {
    return freezeDecision(
      valueContainsTransport(input.transport) ? 'transport_shape_forbidden' : 'transport_facts_invalid',
    );
  }
  if (input.transportResult !== undefined) {
    return freezeDecision(
      transportResultClaimsLiveExecution(input.transportResult)
        ? 'transport_result_live_claim'
        : 'transport_result_forbidden',
    );
  }

  const execution = input.providerExecution;
  if (!execution) return freezeDecision('provider_execution_missing');
  if (!isTrustedContractRecord(execution)) return freezeDecision('provider_execution_invalid');
  if (execution.status !== 'allow') return freezeDecision('provider_execution_not_ready');
  const reviewedExecution = parseProviderExecution(execution);
  if (!reviewedExecution) return freezeDecision('provider_execution_invalid');

  const runtimeResult = input.runtimeResult;
  if (!runtimeResult) return freezeDecision('runtime_result_missing');
  const reviewedRuntimeResult = parseRuntimeResult(runtimeResult, reviewedExecution);
  if (!reviewedRuntimeResult) {
    return freezeDecision('runtime_result_invalid');
  }
  if (!input.transportFacts) return freezeDecision('transport_facts_missing');
  const facts = parseFacts(input.transportFacts);
  if (!facts) return freezeDecision('transport_facts_invalid');
  if (!factsMatchProviderAndRuntime(facts, reviewedExecution, reviewedRuntimeResult)) {
    return freezeDecision('provider_owner_mismatch');
  }
  if (!input.invocationPlan) return freezeDecision('invocation_plan_missing', facts);
  const plan = parsePlan(input.invocationPlan);
  if (!plan) return freezeDecision('invocation_plan_invalid', facts);
  if (!plansMatchFacts(facts, plan)) return freezeDecision('transport_identity_mismatch', facts);

  const liveActivation = input.liveActivation;
  if (!liveActivation) return freezeDecision('live_activation_missing', facts);
  if (!isTrustedContractRecord(liveActivation)) return freezeDecision('live_activation_invalid', facts);
  if (liveActivation.status !== 'activation-ready') {
    return freezeDecision('live_activation_not_ready', facts);
  }
  const reviewedLiveActivation = parseLiveActivationDecision(liveActivation);
  if (!reviewedLiveActivation) return freezeDecision('live_activation_invalid', facts);
  if (!liveActivationMatchesFacts(reviewedLiveActivation, facts)) {
    return freezeDecision('live_activation_binding_mismatch', facts);
  }

  return freezeDecision('executable_llm_transport_contract_missing', facts);
}

export async function executeLlmRuntimeInvocationInjectedTestDoubleTransport(
  input: LlmRuntimeInvocationInjectedTransportExecutionInput = {},
): Promise<Readonly<LlmRuntimeInvocationInjectedTransportExecutionDecision>> {
  const rawInput = input as unknown;
  if (!isTrustedContractRecord(rawInput)) {
    return freezeInjectedTransportDecision('input_shape_invalid');
  }
  if (objectHasUnsafeRootField(rawInput, INJECTED_EXECUTION_INPUT_KEYS)) {
    return freezeInjectedTransportDecision('input_shape_invalid');
  }
  if (!hasOnlyAllowedKeys(rawInput, INJECTED_EXECUTION_INPUT_KEYS)) {
    return freezeInjectedTransportDecision('input_shape_invalid');
  }
  if (hasConnectorSecretMaterial(rawInput) || valueHasSecretMaterial(rawInput)) {
    return freezeInjectedTransportDecision('raw_secret_material');
  }
  if (valueHasPromptOrPayloadEcho(rawInput)) {
    return freezeInjectedTransportDecision('prompt_or_payload_echo_forbidden');
  }

  const boundary = evaluateLlmRuntimeInvocationImplementationBoundary(trustedBoundarySubset(rawInput));
  if (
    !boundary.implementationBoundaryReady
    || boundary.reason !== 'executable_llm_transport_contract_missing'
  ) {
    return freezeInjectedTransportDecision(
      boundary.reason ?? 'implementation_boundary_not_ready',
    );
  }

  const facts = parseFacts(rawInput.transportFacts);
  if (!facts) return freezeInjectedTransportDecision('transport_facts_invalid');
  const plan = parsePlan(rawInput.invocationPlan);
  if (!plan) return freezeInjectedTransportDecision('invocation_plan_invalid', facts);
  if (!plansMatchFacts(facts, plan)) return freezeInjectedTransportDecision('transport_identity_mismatch', facts);

  if (rawInput.injectedTransport === undefined || rawInput.injectedTransport === null) {
    return freezeInjectedTransportDecision('injected_transport_missing', facts);
  }
  if (injectedTransportContainsCallableField(rawInput.injectedTransport)) {
    return freezeInjectedTransportDecision('injected_transport_callback_forbidden', facts);
  }
  const injectedTransport = parseInjectedTransport(rawInput.injectedTransport);
  if (!injectedTransport) return freezeInjectedTransportDecision('injected_transport_invalid', facts);
  if (!injectedTransportMatchesFacts(injectedTransport, facts)) {
    return freezeInjectedTransportDecision('injected_transport_provenance_mismatch', facts);
  }

  const request = buildInjectedTransportRequest(facts);
  return freezeInjectedTransportDecision('injected_transport_execution_disabled', facts, request);
}
