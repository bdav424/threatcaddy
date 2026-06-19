import {
  hasConnectorSecretMaterial,
  isSecretLikeFieldName,
  type ConnectorCredentialReference,
} from './connector-credential-boundary';
import {
  evaluateLlmProviderLiveActivationGate,
  type LlmProviderLiveActivationDecision,
  type LlmProviderLiveActivationGateInput,
} from './llm-provider-live-activation-gate';
import type {
  LlmRuntimeInvocationImplementationDecision,
  LlmRuntimeInvocationTransportIdentity,
} from './llm-runtime-invocation-implementation-boundary';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from './runtime-trusted-contract-object';

export type LlmRuntimeActivationPlanStatus = 'implementation-plan-ready' | 'blocked';

export type LlmRuntimeActivationPlanReason =
  | 'implementation_plan_ready'
  | 'input_shape_invalid'
  | 'raw_secret_material'
  | 'prompt_or_payload_echo_forbidden'
  | 'runtime_shape_forbidden'
  | 'prompt_persistence_claim_forbidden'
  | 'provider_activation_missing'
  | 'provider_activation_not_ready'
  | 'provider_activation_invalid'
  | 'reviewed_activation_facts_missing'
  | 'reviewed_activation_facts_invalid'
  | 'runtime_boundary_missing'
  | 'runtime_boundary_not_ready'
  | 'runtime_boundary_invalid'
  | 'provider_model_mismatch'
  | 'credential_reference_mismatch'
  | 'endpoint_drift_detected'
  | 'prompt_budget_mismatch'
  | 'transport_identity_invalid'
  | 'forged_executable_claim';

export interface LlmRuntimeActivationPlanInput extends LlmProviderLiveActivationGateInput {
  providerActivation?: LlmProviderLiveActivationDecision | null;
  runtimeBoundary?: LlmRuntimeInvocationImplementationDecision | null;
}

export interface LlmRuntimeActivationImplementationPlan {
  contract: 'llm-runtime-activation-implementation-plan-v1';
  providerId: string;
  modelId: string;
  runtimeOwner: 'assistantcaddy-llm-provider-runtime';
  runtimeId: string;
  credentialReferenceId: string;
  credentialReference: ConnectorCredentialReference;
  endpointId: string;
  acceptedEndpoint: string;
  promptBudgetId: string;
  estimatedPromptChars: number;
  maxPromptChars: number;
  requestId: string;
  transportIdentity: LlmRuntimeInvocationTransportIdentity;
  acceptedProviderActivationContract: 'llm-provider-live-activation-plan-v1';
  acceptedRuntimeBoundaryContract: 'llm-runtime-invocation-implementation-boundary-v1';
  acceptedRuntimeBoundaryReason: 'executable_llm_transport_contract_missing';
  providerModelReviewed: true;
  runtimeOwnershipReviewed: true;
  endpointProvenanceReviewed: true;
  promptBudgetReviewed: true;
  userApprovalReviewed: true;
  noPromptPersistenceReviewed: true;
  promptOmitted: true;
  promptPersistence: 'none';
  requiresUserApprovalBeforeCall: true;
  executable: false;
  dispatchAllowed: false;
  sideEffects: 'none';
  willCallLlm: false;
  willCallProvider: false;
  willCallLocalBridge: false;
  willFetch: false;
  willOpenSocket: false;
  willStream: false;
  willMutateStorage: false;
  willPersistPrompt: false;
  sideEffectBoundary: 'llm-runtime-activation-plan-only-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call';
}

export interface LlmRuntimeActivationPlanDecision {
  status: LlmRuntimeActivationPlanStatus;
  ready: boolean;
  reason: LlmRuntimeActivationPlanReason;
  implementationPlan?: LlmRuntimeActivationImplementationPlan;
  requiresUserApprovalBeforeCall: true;
  executable: false;
  dispatchAllowed: false;
  sideEffects: 'none';
  willCallLlm: false;
  willCallProvider: false;
  willCallLocalBridge: false;
  willFetch: false;
  willOpenSocket: false;
  willStream: false;
  willMutateStorage: false;
  willPersistPrompt: false;
  sideEffectBoundary: 'llm-runtime-activation-plan-gate-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call';
}

const DECISION_BOUNDARY =
  'llm-runtime-activation-plan-gate-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call' as const;
const PLAN_BOUNDARY =
  'llm-runtime-activation-plan-only-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call' as const;
const PROVIDER_ACTIVATION_PLAN_BOUNDARY =
  'plan-only-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call' as const;
const RUNTIME_BOUNDARY =
  'llm-runtime-invocation-implementation-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_PROMPT_CHARS = 200_000;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const TOKEN_VALUE_PATTERNS = [
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
const ROOT_KEYS = new Set([
  'credentialReference',
  'endpointProvenance',
  'noPromptPersistenceGuarantee',
  'promptBudgetProof',
  'providerActivation',
  'providerModelReview',
  'runtimeBoundary',
  'runtimeOwnership',
  'userApproval',
]);
const ACTIVATION_DECISION_KEYS = new Set([
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
const ACTIVATION_PLAN_KEYS = new Set([
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
const RUNTIME_BOUNDARY_KEYS = new Set([
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
const FORBIDDEN_RUNTIME_MARKERS = [
  'adapter',
  'callback',
  'execute',
  'fetch',
  'liveaction',
  'onresult',
  'requester',
  'socket',
  'storage',
  'stream',
  'tool',
  'transport',
] as const;
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'authorization',
  'body',
  'content',
  'headers',
  'messages',
  'payload',
  'prompt',
  'requestbody',
  'result',
  'systemprompt',
]);
const ALLOWED_METADATA_KEYS = new Set([
  'acceptedProviderActivationContract',
  'acceptedRuntimeBoundaryContract',
  'acceptedRuntimeBoundaryReason',
  'credentialReference',
  'dispatchAllowed',
  'estimatedPromptChars',
  'executable',
  'maxPromptChars',
  'noPromptPersistence',
  'noPromptPersistenceGuarantee',
  'noPromptPersistenceReviewed',
  'noStreamingBeforeReviewedTransport',
  'promptBudgetId',
  'promptBudgetProof',
  'promptBudgetReviewed',
  'promptEstimateChars',
  'promptOmitted',
  'promptPersistence',
  'promptRedaction',
  'storageOwner',
  'transportIdentity',
  'willCallLlm',
  'willCallLocalBridge',
  'willCallProvider',
  'willFetch',
  'willLogPrompt',
  'willMutateStorage',
  'willOpenSocket',
  'willPersistPrompt',
  'willStoreConversation',
  'willStream',
]);
const PROMPT_PERSISTENCE_MARKERS = [
  'conversationstorage',
  'logprompt',
  'persistprompt',
  'promptpersistence',
  'saveprompt',
  'storeprompt',
  'transcriptstorage',
] as const;

interface ParsedActivationPlan {
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

interface ParsedRuntimeBoundary {
  provider: string;
  model: string;
  credentialReferenceId: string;
  requestId: string;
  localEndpoint?: string;
  promptEstimateChars?: number;
  transportIdentity: LlmRuntimeInvocationTransportIdentity;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isRuntimeTrustedContractObject(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function hasUnsafeExtraField(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).some((key) => (
    !allowed.has(key)
    && FORBIDDEN_RUNTIME_MARKERS.some((marker) => normalizeKey(key).includes(marker))
  ));
}

function hasSecretExtraField(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).some((key) => !allowed.has(key) && isSecretLikeFieldName(key));
}

function hasPayloadEchoExtraField(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).some((key) => !allowed.has(key) && FORBIDDEN_PAYLOAD_KEYS.has(normalizeKey(key)));
}

function trustedActivationFactInput(input: LlmRuntimeActivationPlanInput): LlmProviderLiveActivationGateInput {
  return createRuntimeTrustedContractObject([
    ['providerModelReview', input.providerModelReview as unknown as RuntimeTrustedContractObject],
    ['runtimeOwnership', input.runtimeOwnership as unknown as RuntimeTrustedContractObject],
    ['endpointProvenance', input.endpointProvenance as unknown as RuntimeTrustedContractObject],
    ['promptBudgetProof', input.promptBudgetProof as unknown as RuntimeTrustedContractObject],
    ['credentialReference', input.credentialReference as unknown as RuntimeTrustedContractObject],
    ['userApproval', input.userApproval as unknown as RuntimeTrustedContractObject],
    [
      'noPromptPersistenceGuarantee',
      input.noPromptPersistenceGuarantee as unknown as RuntimeTrustedContractObject,
    ],
  ] as readonly [string, RuntimeTrustedContractValue][]) as unknown as LlmProviderLiveActivationGateInput;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function stringLooksTokenShaped(value: string): boolean {
  return TOKEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_IDENTIFIER_LENGTH) return undefined;
  if (!SAFE_IDENTIFIER_PATTERN.test(trimmed)) return undefined;
  if (isSecretLikeFieldName(trimmed) || stringLooksTokenShaped(trimmed)) return undefined;
  return trimmed;
}

function safeLabel(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_IDENTIFIER_LENGTH) return undefined;
  if (stringLooksTokenShaped(trimmed)) return undefined;
  const normalized = normalizeKey(trimmed);
  if (isSecretLikeFieldName(trimmed) || FORBIDDEN_PAYLOAD_KEYS.has(normalized)) return undefined;
  return trimmed;
}

function safePromptChars(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return undefined;
  if (value < 0 || value > MAX_PROMPT_CHARS) return undefined;
  return value;
}

function safeEndpoint(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (url.username || url.password || url.hash) return undefined;
    const normalizedPath = normalizeKey(url.pathname);
    if (FORBIDDEN_PAYLOAD_KEYS.has(normalizedPath)) return undefined;
    for (const [key, paramValue] of url.searchParams.entries()) {
      const normalizedKey = normalizeKey(key);
      if (SECRET_URL_PARAM_MARKERS.some((marker) => normalizedKey.includes(marker))) return undefined;
      if (FORBIDDEN_PAYLOAD_KEYS.has(normalizedKey)) return undefined;
      if (stringLooksTokenShaped(paramValue)) return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function valueHasTokenOrSecretMaterial(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  if (currentKey && isSecretLikeFieldName(currentKey)) return true;
  if (typeof value === 'string') {
    if (stringLooksTokenShaped(value)) return true;
    const endpoint = safeEndpoint(value);
    return value.includes('://') && endpoint === undefined;
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
  if (normalizedKey && FORBIDDEN_PAYLOAD_KEYS.has(normalizedKey) && !ALLOWED_METADATA_KEYS.has(currentKey ?? '')) {
    return true;
  }
  if (typeof value === 'string' && /\b(?:authorization|body|headers?|message|payload|prompt|system\s*prompt)\s*[:=]/i.test(value)) {
    return true;
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

function valueHasForbiddenRuntimeShape(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  if (typeof value === 'function') return true;
  const normalizedKey = currentKey ? normalizeKey(currentKey) : '';
  if (
    normalizedKey
    && FORBIDDEN_RUNTIME_MARKERS.some((marker) => normalizedKey.includes(marker))
    && !ALLOWED_METADATA_KEYS.has(currentKey ?? '')
  ) {
    return true;
  }
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => valueHasForbiddenRuntimeShape(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (valueHasForbiddenRuntimeShape(nestedValue, seen, typeof key === 'string' ? key : undefined)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasForbiddenRuntimeShape(nestedValue, seen)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => valueHasForbiddenRuntimeShape(nestedValue, seen, key));
}

function valueHasPromptPersistenceClaim(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  const normalizedKey = currentKey ? normalizeKey(currentKey) : '';
  if (normalizedKey && PROMPT_PERSISTENCE_MARKERS.some((marker) => normalizedKey.includes(marker))) {
    if (
      currentKey !== 'noPromptPersistence'
      && currentKey !== 'noPromptPersistenceGuarantee'
      && currentKey !== 'noPromptPersistenceReviewed'
      && currentKey !== 'promptPersistence'
      && currentKey !== 'willLogPrompt'
      && currentKey !== 'willPersistPrompt'
      && currentKey !== 'willStoreConversation'
    ) {
      return true;
    }
    if (currentKey === 'promptPersistence' && value !== 'none') return true;
    if (
      (currentKey === 'noPromptPersistence' || currentKey === 'noPromptPersistenceReviewed')
      && value !== true
    ) {
      return true;
    }
    if (
      (currentKey === 'willLogPrompt'
        || currentKey === 'willPersistPrompt'
        || currentKey === 'willStoreConversation')
      && value !== false
    ) {
      return true;
    }
  }
  if (value === true && ['willpersistprompt', 'willlogprompt', 'willstoreconversation'].includes(normalizedKey)) {
    return true;
  }
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return true;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => valueHasPromptPersistenceClaim(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (valueHasPromptPersistenceClaim(nestedValue, seen, typeof key === 'string' ? key : undefined)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasPromptPersistenceClaim(nestedValue, seen)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => valueHasPromptPersistenceClaim(nestedValue, seen, key));
}

function valueHasExecutableClaim(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  const normalizedKey = currentKey ? normalizeKey(currentKey) : '';
  if (
    [
      'dispatchallowed',
      'executable',
      'maycallllm',
      'maycallprovider',
      'mayfetch',
      'mayopensocket',
      'maystream',
      'ready',
      'willcallllm',
      'willcalllocalbridge',
      'willcallprovider',
      'willfetch',
      'willmutatestorage',
      'willopensocket',
      'willstream',
    ].includes(normalizedKey)
  ) {
    return value === true || typeof value === 'function';
  }
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return true;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => valueHasExecutableClaim(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (valueHasExecutableClaim(nestedValue, seen, typeof key === 'string' ? key : undefined)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasExecutableClaim(nestedValue, seen)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => valueHasExecutableClaim(nestedValue, seen, key));
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
  if (!isRecord(value) || !hasOnlyKeys(value, CREDENTIAL_REFERENCE_KEYS)) return undefined;
  const id = safeIdentifier(value.id);
  const providerId = value.providerId === undefined ? undefined : safeIdentifier(value.providerId);
  const connectorId = value.connectorId === undefined ? undefined : safeIdentifier(value.connectorId);
  const accountId = value.accountId === undefined ? undefined : safeIdentifier(value.accountId);
  const displayName = safeLabel(value.displayName);
  if (
    value.schemaVersion !== 1
    || !id
    || (value.kind !== 'local-bridge' && value.kind !== 'os-keychain' && value.kind !== 'external-secret-store' && value.kind !== 'provider-managed-oauth')
    || (value.storageOwner !== 'local-bridge' && value.storageOwner !== 'operating-system' && value.storageOwner !== 'external-provider' && value.storageOwner !== 'external-secret-store')
    || (value.providerId !== undefined && !providerId)
    || (value.connectorId !== undefined && !connectorId)
    || (value.accountId !== undefined && !accountId)
    || (value.displayName !== undefined && !displayName)
    || (value.createdAt !== undefined && (typeof value.createdAt !== 'number' || !Number.isSafeInteger(value.createdAt)))
  ) {
    return undefined;
  }
  return Object.freeze({
    schemaVersion: 1,
    kind: value.kind,
    id,
    storageOwner: value.storageOwner,
    ...(providerId ? { providerId } : {}),
    ...(connectorId ? { connectorId } : {}),
    ...(accountId ? { accountId } : {}),
    ...(displayName ? { displayName } : {}),
    ...(typeof value.createdAt === 'number' ? { createdAt: value.createdAt } : {}),
  }) as ConnectorCredentialReference;
}

function parseActivationPlan(value: unknown): ParsedActivationPlan | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ACTIVATION_PLAN_KEYS)) return undefined;
  const providerId = safeIdentifier(value.providerId);
  const modelId = safeIdentifier(value.modelId);
  const runtimeId = safeIdentifier(value.runtimeId);
  const endpointId = safeIdentifier(value.endpointId);
  const acceptedEndpoint = safeEndpoint(value.acceptedEndpoint);
  const promptBudgetId = safeIdentifier(value.promptBudgetId);
  const estimatedPromptChars = safePromptChars(value.estimatedPromptChars);
  const maxPromptChars = safePromptChars(value.maxPromptChars);
  const credentialReference = parseCredentialReference(value.credentialReference);
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
    || value.sideEffectBoundary !== PROVIDER_ACTIVATION_PLAN_BOUNDARY
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

function parseProviderActivation(value: unknown): ParsedActivationPlan | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ACTIVATION_DECISION_KEYS)) return undefined;
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
  return parseActivationPlan(value.activationPlan);
}

function parseTransportIdentity(value: unknown): LlmRuntimeInvocationTransportIdentity | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, TRANSPORT_IDENTITY_KEYS)) return undefined;
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

function parseRuntimeBoundary(value: unknown): ParsedRuntimeBoundary | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, RUNTIME_BOUNDARY_KEYS)) return undefined;
  const provider = value.provider === 'local' || value.provider === 'openai' ? value.provider : undefined;
  const model = safeIdentifier(value.model);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const requestId = safeIdentifier(value.requestId);
  const localEndpoint = value.localEndpoint === undefined ? undefined : safeEndpoint(value.localEndpoint);
  const promptEstimateChars = value.promptEstimateChars === undefined ? undefined : safePromptChars(value.promptEstimateChars);
  const transportIdentity = parseTransportIdentity(value.transportIdentity);
  if (
    value.status !== 'blocked'
    || value.implementationBoundaryReady !== true
    || value.reason !== 'executable_llm_transport_contract_missing'
    || !provider
    || !model
    || value.action !== 'send_prompt'
    || !credentialReferenceId
    || !requestId
    || (value.localEndpoint !== undefined && !localEndpoint)
    || (provider === 'local' && !localEndpoint)
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
    || value.sideEffectBoundary !== RUNTIME_BOUNDARY
  ) {
    return undefined;
  }
  return Object.freeze({
    provider,
    model,
    credentialReferenceId,
    requestId,
    ...(localEndpoint ? { localEndpoint } : {}),
    ...(promptEstimateChars !== undefined ? { promptEstimateChars } : {}),
    transportIdentity,
  });
}

function activationFactsPresent(input: LlmRuntimeActivationPlanInput): boolean {
  return input.providerModelReview !== undefined
    && input.runtimeOwnership !== undefined
    && input.endpointProvenance !== undefined
    && input.promptBudgetProof !== undefined
    && input.credentialReference !== undefined
    && input.userApproval !== undefined
    && input.noPromptPersistenceGuarantee !== undefined;
}

function activationMatches(left: ParsedActivationPlan, right: ParsedActivationPlan): boolean {
  return left.providerId === right.providerId
    && left.modelId === right.modelId
    && left.runtimeId === right.runtimeId
    && left.credentialReference.id === right.credentialReference.id
    && left.endpointId === right.endpointId
    && left.acceptedEndpoint === right.acceptedEndpoint
    && left.promptBudgetId === right.promptBudgetId
    && left.estimatedPromptChars === right.estimatedPromptChars
    && left.maxPromptChars === right.maxPromptChars;
}

function runtimeMatchesActivation(runtime: ParsedRuntimeBoundary, activation: ParsedActivationPlan): LlmRuntimeActivationPlanReason | null {
  if (runtime.provider !== activation.providerId || runtime.model !== activation.modelId) return 'provider_model_mismatch';
  if (runtime.credentialReferenceId !== activation.credentialReference.id) return 'credential_reference_mismatch';
  if (runtime.localEndpoint !== activation.acceptedEndpoint) return 'endpoint_drift_detected';
  if (runtime.promptEstimateChars !== activation.estimatedPromptChars) return 'prompt_budget_mismatch';
  return null;
}

function freezeBlocked(reason: LlmRuntimeActivationPlanReason): Readonly<LlmRuntimeActivationPlanDecision> {
  return Object.freeze({
    status: 'blocked',
    ready: false,
    reason,
    requiresUserApprovalBeforeCall: true,
    executable: false,
    dispatchAllowed: false,
    sideEffects: 'none',
    willCallLlm: false,
    willCallProvider: false,
    willCallLocalBridge: false,
    willFetch: false,
    willOpenSocket: false,
    willStream: false,
    willMutateStorage: false,
    willPersistPrompt: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}

function freezeReady(
  activation: ParsedActivationPlan,
  runtime: ParsedRuntimeBoundary,
): Readonly<LlmRuntimeActivationPlanDecision> {
  const implementationPlan = Object.freeze({
    contract: 'llm-runtime-activation-implementation-plan-v1',
    providerId: activation.providerId,
    modelId: activation.modelId,
    runtimeOwner: 'assistantcaddy-llm-provider-runtime' as const,
    runtimeId: activation.runtimeId,
    credentialReferenceId: activation.credentialReference.id,
    credentialReference: freezeCredentialReference(activation.credentialReference),
    endpointId: activation.endpointId,
    acceptedEndpoint: activation.acceptedEndpoint,
    promptBudgetId: activation.promptBudgetId,
    estimatedPromptChars: activation.estimatedPromptChars,
    maxPromptChars: activation.maxPromptChars,
    requestId: runtime.requestId,
    transportIdentity: Object.freeze({
      kind: runtime.transportIdentity.kind,
      id: runtime.transportIdentity.id,
      version: runtime.transportIdentity.version,
      owner: runtime.transportIdentity.owner,
    }),
    acceptedProviderActivationContract: 'llm-provider-live-activation-plan-v1' as const,
    acceptedRuntimeBoundaryContract: 'llm-runtime-invocation-implementation-boundary-v1' as const,
    acceptedRuntimeBoundaryReason: 'executable_llm_transport_contract_missing' as const,
    providerModelReviewed: true as const,
    runtimeOwnershipReviewed: true as const,
    endpointProvenanceReviewed: true as const,
    promptBudgetReviewed: true as const,
    userApprovalReviewed: true as const,
    noPromptPersistenceReviewed: true as const,
    promptOmitted: true as const,
    promptPersistence: 'none' as const,
    requiresUserApprovalBeforeCall: true as const,
    executable: false as const,
    dispatchAllowed: false as const,
    sideEffects: 'none' as const,
    willCallLlm: false as const,
    willCallProvider: false as const,
    willCallLocalBridge: false as const,
    willFetch: false as const,
    willOpenSocket: false as const,
    willStream: false as const,
    willMutateStorage: false as const,
    willPersistPrompt: false as const,
    sideEffectBoundary: PLAN_BOUNDARY,
  } satisfies LlmRuntimeActivationImplementationPlan);

  return Object.freeze({
    status: 'implementation-plan-ready',
    ready: true,
    reason: 'implementation_plan_ready',
    implementationPlan,
    requiresUserApprovalBeforeCall: true,
    executable: false,
    dispatchAllowed: false,
    sideEffects: 'none',
    willCallLlm: false,
    willCallProvider: false,
    willCallLocalBridge: false,
    willFetch: false,
    willOpenSocket: false,
    willStream: false,
    willMutateStorage: false,
    willPersistPrompt: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}

export function evaluateLlmRuntimeActivationPlan(
  input: LlmRuntimeActivationPlanInput = {},
): Readonly<LlmRuntimeActivationPlanDecision> {
  if (!isRecord(input)) return freezeBlocked('input_shape_invalid');
  if (hasUnsafeExtraField(input, ROOT_KEYS)) return freezeBlocked('runtime_shape_forbidden');
  if (hasSecretExtraField(input, ROOT_KEYS)) return freezeBlocked('raw_secret_material');
  if (hasPayloadEchoExtraField(input, ROOT_KEYS)) return freezeBlocked('prompt_or_payload_echo_forbidden');
  if (!hasOnlyKeys(input, ROOT_KEYS)) return freezeBlocked('input_shape_invalid');
  if (hasConnectorSecretMaterial(input) || valueHasTokenOrSecretMaterial(input)) {
    return freezeBlocked('raw_secret_material');
  }
  if (valueHasPromptOrPayloadEcho(input)) return freezeBlocked('prompt_or_payload_echo_forbidden');
  if (valueHasForbiddenRuntimeShape(input)) return freezeBlocked('runtime_shape_forbidden');
  if (valueHasPromptPersistenceClaim(input)) return freezeBlocked('prompt_persistence_claim_forbidden');
  if (valueHasExecutableClaim(input)) return freezeBlocked('forged_executable_claim');

  if (!activationFactsPresent(input)) return freezeBlocked('reviewed_activation_facts_missing');
  const reviewedActivation = evaluateLlmProviderLiveActivationGate(trustedActivationFactInput(input));
  if (reviewedActivation.status !== 'activation-ready' || !reviewedActivation.activationPlan) {
    return freezeBlocked('reviewed_activation_facts_invalid');
  }
  const parsedReviewedActivation = parseActivationPlan(reviewedActivation.activationPlan);
  if (!parsedReviewedActivation) return freezeBlocked('reviewed_activation_facts_invalid');

  if (!input.providerActivation) return freezeBlocked('provider_activation_missing');
  if (isRecord(input.providerActivation) && input.providerActivation.status !== 'activation-ready') {
    return freezeBlocked('provider_activation_not_ready');
  }
  const parsedProviderActivation = parseProviderActivation(input.providerActivation);
  if (!parsedProviderActivation) return freezeBlocked('provider_activation_invalid');
  if (!activationMatches(parsedProviderActivation, parsedReviewedActivation)) {
    return freezeBlocked('provider_activation_invalid');
  }

  if (!input.runtimeBoundary) return freezeBlocked('runtime_boundary_missing');
  if (isRecord(input.runtimeBoundary) && input.runtimeBoundary.implementationBoundaryReady !== true) {
    return freezeBlocked('runtime_boundary_not_ready');
  }
  const parsedRuntimeBoundary = parseRuntimeBoundary(input.runtimeBoundary);
  if (!parsedRuntimeBoundary) return freezeBlocked('runtime_boundary_invalid');
  const mismatch = runtimeMatchesActivation(parsedRuntimeBoundary, parsedReviewedActivation);
  if (mismatch) return freezeBlocked(mismatch);

  return freezeReady(parsedReviewedActivation, parsedRuntimeBoundary);
}
