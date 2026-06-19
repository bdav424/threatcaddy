import {
  hasConnectorSecretMaterial,
  isSecretLikeFieldName,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
  type ConnectorCredentialReferenceRejectReason,
} from './connector-credential-boundary';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from './runtime-trusted-contract-object';

export type LlmProviderLiveActivationStatus = 'blocked' | 'activation-ready';

export type LlmProviderLiveActivationBlockerCode =
  | 'root_shape_invalid'
  | 'raw_secret_material'
  | 'runtime_shape_forbidden'
  | 'provider_model_review_missing'
  | 'provider_model_review_invalid'
  | 'provider_model_unreviewed'
  | 'runtime_ownership_missing'
  | 'runtime_ownership_invalid'
  | 'runtime_ownership_unreviewed'
  | 'endpoint_provenance_missing'
  | 'endpoint_provenance_invalid'
  | 'endpoint_provenance_unreviewed'
  | 'multiple_accepted_endpoints'
  | 'prompt_budget_missing'
  | 'prompt_budget_invalid'
  | 'prompt_budget_unreviewed'
  | 'prompt_budget_exceeded'
  | 'credential_reference_missing'
  | 'credential_reference_invalid'
  | 'credential_provider_mismatch'
  | 'credential_reference_mismatch'
  | 'user_approval_missing'
  | 'user_approval_invalid'
  | 'user_approval_unreviewed'
  | 'user_approval_not_granted'
  | 'prompt_persistence_guarantee_missing'
  | 'prompt_persistence_guarantee_invalid'
  | 'prompt_persistence_guarantee_unreviewed'
  | 'prompt_persistence_claim_forbidden'
  | 'provider_mismatch'
  | 'model_mismatch'
  | 'runtime_owner_mismatch'
  | 'endpoint_drift'
  | 'prompt_budget_mismatch';

export interface LlmProviderLiveProviderModelReviewFact {
  contract: 'llm-provider-live-provider-model-review-v1';
  reviewState: 'reviewed';
  providerId: string;
  modelId: string;
  providerModelReviewed: true;
}

export interface LlmProviderLiveRuntimeOwnershipFact {
  contract: 'llm-provider-live-runtime-ownership-v1';
  reviewState: 'reviewed';
  runtimeOwner: 'assistantcaddy-llm-provider-runtime';
  runtimeId: string;
  providerId: string;
  modelId: string;
  credentialReferenceId: string;
  endpointId: string;
  promptBudgetId: string;
  noPromptPersistence: true;
  noStreamingBeforeReviewedTransport: true;
  runtimeOwnershipReviewed: true;
}

export interface LlmProviderLiveEndpointProvenanceFact {
  contract: 'llm-provider-live-endpoint-provenance-v1';
  reviewState: 'reviewed';
  providerId: string;
  modelId: string;
  endpointId: string;
  acceptedEndpoints: readonly [string];
  endpointProvenanceReviewed: true;
}

export interface LlmProviderLivePromptBudgetProofFact {
  contract: 'llm-provider-live-prompt-budget-proof-v1';
  reviewState: 'reviewed';
  providerId: string;
  modelId: string;
  promptBudgetId: string;
  estimatedPromptChars: number;
  maxPromptChars: number;
  promptBudgetReviewed: true;
  promptOmitted: true;
}

export interface LlmProviderLiveUserApprovalFact {
  contract: 'llm-provider-live-user-approval-v1';
  reviewState: 'reviewed';
  providerId: string;
  modelId: string;
  credentialReferenceId: string;
  endpointId: string;
  promptBudgetId: string;
  approvedAction: 'llm_provider_call';
  explicitUserApprovalGranted: true;
  noAutoCallAcknowledged: true;
  approvalReviewed: true;
}

export interface LlmProviderLiveNoPromptPersistenceGuaranteeFact {
  contract: 'llm-provider-live-no-prompt-persistence-v1';
  reviewState: 'reviewed';
  providerId: string;
  modelId: string;
  runtimeId: string;
  promptPersistence: 'none';
  willPersistPrompt: false;
  willLogPrompt: false;
  willStoreConversation: false;
  noPromptPersistenceReviewed: true;
}

export interface LlmProviderLiveActivationGateInput {
  providerModelReview?: unknown;
  runtimeOwnership?: unknown;
  endpointProvenance?: unknown;
  promptBudgetProof?: unknown;
  credentialReference?: unknown;
  userApproval?: unknown;
  noPromptPersistenceGuarantee?: unknown;
}

export interface LlmProviderLiveActivationBlocker {
  code: LlmProviderLiveActivationBlockerCode;
  detail: string;
  field?: string;
  credentialRejectReason?: ConnectorCredentialReferenceRejectReason;
}

export interface LlmProviderLiveActivationPlan {
  contract: 'llm-provider-live-activation-plan-v1';
  providerId: string;
  modelId: string;
  runtimeOwner: 'assistantcaddy-llm-provider-runtime';
  runtimeId: string;
  credentialReference: ConnectorCredentialReference;
  endpointId: string;
  acceptedEndpoint: string;
  promptBudgetId: string;
  estimatedPromptChars: number;
  maxPromptChars: number;
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
  sideEffects: 'none';
  willCallLlm: false;
  willCallProvider: false;
  willFetch: false;
  willOpenSocket: false;
  willStream: false;
  willPersistPrompt: false;
  sideEffectBoundary: 'plan-only-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call';
}

export interface LlmProviderLiveActivationDecision {
  status: LlmProviderLiveActivationStatus;
  mayPrepareLiveActivation: boolean;
  activationPlan?: LlmProviderLiveActivationPlan;
  blockers: readonly LlmProviderLiveActivationBlocker[];
  executable: false;
  sideEffects: 'none';
  willCallLlm: false;
  willCallProvider: false;
  willFetch: false;
  willOpenSocket: false;
  willStream: false;
  willMutateStorage: false;
  willResolveCredentialSecrets: false;
  willPersistPrompt: false;
  requiresUserApprovalBeforeCall: true;
  sideEffectBoundary: 'pure-local-llm-provider-live-activation-gate-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call';
}

const DECISION_BOUNDARY =
  'pure-local-llm-provider-live-activation-gate-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call' as const;
const PLAN_BOUNDARY =
  'plan-only-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-call' as const;
const RUNTIME_OWNER = 'assistantcaddy-llm-provider-runtime' as const;
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
  'providerModelReview',
  'runtimeOwnership',
  'endpointProvenance',
  'promptBudgetProof',
  'credentialReference',
  'userApproval',
  'noPromptPersistenceGuarantee',
]);
const PROVIDER_MODEL_KEYS = new Set([
  'contract',
  'reviewState',
  'providerId',
  'modelId',
  'providerModelReviewed',
]);
const RUNTIME_OWNERSHIP_KEYS = new Set([
  'contract',
  'reviewState',
  'runtimeOwner',
  'runtimeId',
  'providerId',
  'modelId',
  'credentialReferenceId',
  'endpointId',
  'promptBudgetId',
  'noPromptPersistence',
  'noStreamingBeforeReviewedTransport',
  'runtimeOwnershipReviewed',
]);
const ENDPOINT_PROVENANCE_KEYS = new Set([
  'contract',
  'reviewState',
  'providerId',
  'modelId',
  'endpointId',
  'acceptedEndpoints',
  'endpointProvenanceReviewed',
]);
const PROMPT_BUDGET_KEYS = new Set([
  'contract',
  'reviewState',
  'providerId',
  'modelId',
  'promptBudgetId',
  'estimatedPromptChars',
  'maxPromptChars',
  'promptBudgetReviewed',
  'promptOmitted',
]);
const USER_APPROVAL_KEYS = new Set([
  'contract',
  'reviewState',
  'providerId',
  'modelId',
  'credentialReferenceId',
  'endpointId',
  'promptBudgetId',
  'approvedAction',
  'explicitUserApprovalGranted',
  'noAutoCallAcknowledged',
  'approvalReviewed',
]);
const NO_PROMPT_PERSISTENCE_KEYS = new Set([
  'contract',
  'reviewState',
  'providerId',
  'modelId',
  'runtimeId',
  'promptPersistence',
  'willPersistPrompt',
  'willLogPrompt',
  'willStoreConversation',
  'noPromptPersistenceReviewed',
]);
const FORBIDDEN_RUNTIME_MARKERS = [
  'callback',
  'requester',
  'fetch',
  'socket',
  'storage',
  'execute',
  'executable',
  'liveaction',
  'stream',
  'transport',
  'adapter',
  'requestbody',
  'headers',
  'body',
  'prompt',
  'result',
] as const;
const ALLOWED_PROMPT_MARKER_KEYS = new Set([
  'credentialReference',
  'estimatedPromptChars',
  'maxPromptChars',
  'noPromptPersistence',
  'noPromptPersistenceGuarantee',
  'noPromptPersistenceReviewed',
  'noStreamingBeforeReviewedTransport',
  'promptBudgetId',
  'promptBudgetProof',
  'promptBudgetReviewed',
  'promptOmitted',
  'promptPersistence',
  'storageOwner',
  'willLogPrompt',
  'willPersistPrompt',
  'willStoreConversation',
]);
const FORBIDDEN_ENDPOINT_LEAKAGE_MARKERS = [
  'body',
  'header',
  'message',
  'prompt',
  'requestbody',
  'systemprompt',
] as const;
const PROMPT_PERSISTENCE_MARKERS = [
  'persistprompt',
  'promptpersistence',
  'storeprompt',
  'saveprompt',
  'logprompt',
  'conversationstorage',
  'transcriptstorage',
] as const;

type ParseResult<T> = { ok: true; value: T } | { ok: false; blocker: LlmProviderLiveActivationBlocker };

function trustedContractObject<T>(entries: readonly RuntimeTrustedContractEntry[]): T {
  return createRuntimeTrustedContractObject(entries) as unknown as T;
}

function blocker(
  code: LlmProviderLiveActivationBlockerCode,
  detail: string,
  field?: string,
  credentialRejectReason?: ConnectorCredentialReferenceRejectReason,
): LlmProviderLiveActivationBlocker {
  return trustedContractObject<LlmProviderLiveActivationBlocker>([
    ['code', code],
    ['detail', detail],
    ['field', field],
    ['credentialRejectReason', credentialRejectReason],
  ]);
}

function isTrustedContractRecord(value: unknown): value is RuntimeTrustedContractObject {
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

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isTokenShaped(value: string): boolean {
  return TOKEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
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
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_IDENTIFIER_LENGTH) return undefined;
  if (!SAFE_IDENTIFIER_PATTERN.test(trimmed)) return undefined;
  if (stringLooksUnsafeSchemeIdentifier(trimmed)) return undefined;
  if (isSecretLikeFieldName(trimmed) || isTokenShaped(trimmed)) return undefined;
  return trimmed;
}

function safeRuntimeInvocationProviderId(value: unknown): 'local' | undefined {
  return value === 'local' ? 'local' : undefined;
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
    if (FORBIDDEN_ENDPOINT_LEAKAGE_MARKERS.some((marker) => normalizedPath.includes(marker))) return undefined;
    for (const [key, paramValue] of url.searchParams.entries()) {
      const normalizedKey = normalizeKey(key);
      if (SECRET_URL_PARAM_MARKERS.some((marker) => normalizedKey.includes(marker))) return undefined;
      if (FORBIDDEN_ENDPOINT_LEAKAGE_MARKERS.some((marker) => normalizedKey.includes(marker))) return undefined;
      if (isTokenShaped(paramValue)) return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost'
    || normalized === '[::1]'
    || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

function safeRuntimeInvocationEndpoint(value: unknown): string | undefined {
  const endpoint = safeEndpoint(value);
  if (!endpoint) return undefined;
  const url = new URL(endpoint);
  return isLoopbackHostname(url.hostname) ? endpoint : undefined;
}

function safeCredentialDisplayName(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = normalizeKey(trimmed);
  if (FORBIDDEN_ENDPOINT_LEAKAGE_MARKERS.some((marker) => normalized.includes(marker))) return undefined;
  return trimmed;
}

function hasTokenOrSecretMaterial(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  if (currentKey && isSecretLikeFieldName(currentKey)) return true;
  if (typeof value === 'string') {
    if (isTokenShaped(value)) return true;
    const endpoint = safeEndpoint(value);
    return value.includes('://') && endpoint === undefined;
  }
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasTokenOrSecretMaterial(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (hasTokenOrSecretMaterial(key, seen) || hasTokenOrSecretMaterial(nestedValue, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (hasTokenOrSecretMaterial(nestedValue, seen)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => hasTokenOrSecretMaterial(nestedValue, seen, key));
}

function hasForbiddenRuntimeShape(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  if (typeof value === 'function') return true;
  const normalizedKey = currentKey ? normalizeKey(currentKey) : '';
  if (
    normalizedKey
    && FORBIDDEN_RUNTIME_MARKERS.some((marker) => normalizedKey.includes(marker))
    && !ALLOWED_PROMPT_MARKER_KEYS.has(currentKey ?? '')
  ) {
    return true;
  }
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasForbiddenRuntimeShape(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (hasForbiddenRuntimeShape(nestedValue, seen, typeof key === 'string' ? key : undefined)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (hasForbiddenRuntimeShape(nestedValue, seen)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => hasForbiddenRuntimeShape(nestedValue, seen, key));
}

function hasForbiddenPromptPersistenceClaim(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
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
  if (Array.isArray(value)) return value.some((item) => hasForbiddenPromptPersistenceClaim(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (hasForbiddenPromptPersistenceClaim(
        nestedValue,
        seen,
        typeof key === 'string' ? key : undefined,
      )) {
        return true;
      }
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (hasForbiddenPromptPersistenceClaim(nestedValue, seen)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => (
    hasForbiddenPromptPersistenceClaim(nestedValue, seen, key)
  ));
}

function freezeCredentialReference(reference: ConnectorCredentialReference): ConnectorCredentialReference {
  const displayName = safeCredentialDisplayName(reference.displayName);
  const entries: RuntimeTrustedContractEntry[] = [
    ['schemaVersion', reference.schemaVersion],
    ['kind', reference.kind],
    ['id', reference.id],
    ['storageOwner', reference.storageOwner],
    ['providerId', reference.providerId],
    ['connectorId', reference.connectorId],
    ['accountId', reference.accountId],
    ['createdAt', reference.createdAt],
  ];
  if (displayName) entries.splice(7, 0, ['displayName', displayName]);
  return trustedContractObject<ConnectorCredentialReference>(entries);
}

function blocked(blockers: readonly LlmProviderLiveActivationBlocker[]): Readonly<LlmProviderLiveActivationDecision> {
  return trustedContractObject<LlmProviderLiveActivationDecision>([
    ['status', 'blocked'],
    ['mayPrepareLiveActivation', false],
    ['blockers', blockers as unknown as readonly RuntimeTrustedContractValue[]],
    ['executable', false],
    ['sideEffects', 'none'],
    ['willCallLlm', false],
    ['willCallProvider', false],
    ['willFetch', false],
    ['willOpenSocket', false],
    ['willStream', false],
    ['willMutateStorage', false],
    ['willResolveCredentialSecrets', false],
    ['willPersistPrompt', false],
    ['requiresUserApprovalBeforeCall', true],
    ['sideEffectBoundary', DECISION_BOUNDARY],
  ]);
}

function parseProviderModelReview(value: unknown): ParseResult<LlmProviderLiveProviderModelReviewFact> {
  if (!isTrustedContractRecord(value) || !hasOnlyKeys(value, PROVIDER_MODEL_KEYS)) {
    return { ok: false, blocker: blocker('provider_model_review_invalid', 'Provider/model review must be exact reviewed metadata.', 'providerModelReview') };
  }
  const providerId = safeRuntimeInvocationProviderId(value.providerId);
  const modelId = safeIdentifier(value.modelId);
  if (
    value.contract !== 'llm-provider-live-provider-model-review-v1'
    || !providerId
    || !modelId
    || value.providerModelReviewed !== true
  ) {
    return { ok: false, blocker: blocker('provider_model_review_invalid', 'Provider/model review is malformed or secret-shaped.', 'providerModelReview') };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, blocker: blocker('provider_model_unreviewed', 'Provider/model ownership must be reviewed before activation planning.', 'providerModelReview.reviewState') };
  }
  return {
    ok: true,
    value: Object.freeze({
      contract: 'llm-provider-live-provider-model-review-v1',
      reviewState: 'reviewed',
      providerId,
      modelId,
      providerModelReviewed: true,
    }),
  };
}

function parseRuntimeOwnership(value: unknown): ParseResult<LlmProviderLiveRuntimeOwnershipFact> {
  if (!isTrustedContractRecord(value) || !hasOnlyKeys(value, RUNTIME_OWNERSHIP_KEYS)) {
    return { ok: false, blocker: blocker('runtime_ownership_invalid', 'Runtime ownership must be exact reviewed metadata.', 'runtimeOwnership') };
  }
  const runtimeId = safeIdentifier(value.runtimeId);
  const providerId = safeRuntimeInvocationProviderId(value.providerId);
  const modelId = safeIdentifier(value.modelId);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const endpointId = safeIdentifier(value.endpointId);
  const promptBudgetId = safeIdentifier(value.promptBudgetId);
  if (
    value.contract !== 'llm-provider-live-runtime-ownership-v1'
    || value.runtimeOwner !== RUNTIME_OWNER
    || !runtimeId
    || !providerId
    || !modelId
    || !credentialReferenceId
    || !endpointId
    || !promptBudgetId
    || value.noPromptPersistence !== true
    || value.noStreamingBeforeReviewedTransport !== true
    || value.runtimeOwnershipReviewed !== true
  ) {
    return { ok: false, blocker: blocker('runtime_ownership_invalid', 'Runtime ownership is malformed or not fail-closed.', 'runtimeOwnership') };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, blocker: blocker('runtime_ownership_unreviewed', 'Runtime ownership must be reviewed before activation planning.', 'runtimeOwnership.reviewState') };
  }
  return {
    ok: true,
    value: Object.freeze({
      contract: 'llm-provider-live-runtime-ownership-v1',
      reviewState: 'reviewed',
      runtimeOwner: RUNTIME_OWNER,
      runtimeId,
      providerId,
      modelId,
      credentialReferenceId,
      endpointId,
      promptBudgetId,
      noPromptPersistence: true,
      noStreamingBeforeReviewedTransport: true,
      runtimeOwnershipReviewed: true,
    }),
  };
}

function parseEndpointProvenance(value: unknown): ParseResult<LlmProviderLiveEndpointProvenanceFact> {
  if (!isTrustedContractRecord(value) || !hasOnlyKeys(value, ENDPOINT_PROVENANCE_KEYS)) {
    return { ok: false, blocker: blocker('endpoint_provenance_invalid', 'Endpoint provenance must be exact reviewed metadata.', 'endpointProvenance') };
  }
  const providerId = safeRuntimeInvocationProviderId(value.providerId);
  const modelId = safeIdentifier(value.modelId);
  const endpointId = safeIdentifier(value.endpointId);
  if (!Array.isArray(value.acceptedEndpoints)) {
    return { ok: false, blocker: blocker('endpoint_provenance_invalid', 'Endpoint provenance requires an accepted endpoint array.', 'endpointProvenance.acceptedEndpoints') };
  }
  if (value.acceptedEndpoints.length !== 1) {
    return { ok: false, blocker: blocker('multiple_accepted_endpoints', 'Exactly one accepted endpoint must be bound before future LLM transport can be considered.', 'endpointProvenance.acceptedEndpoints') };
  }
  const acceptedEndpoint = safeRuntimeInvocationEndpoint(value.acceptedEndpoints[0]);
  if (
    value.contract !== 'llm-provider-live-endpoint-provenance-v1'
    || !providerId
    || !modelId
    || !endpointId
    || !acceptedEndpoint
    || value.endpointProvenanceReviewed !== true
  ) {
    return { ok: false, blocker: blocker('endpoint_provenance_invalid', 'Endpoint provenance is malformed, secret-bearing, non-HTTP(S), or outside the loopback runtime domain.', 'endpointProvenance') };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, blocker: blocker('endpoint_provenance_unreviewed', 'Endpoint provenance must be reviewed before activation planning.', 'endpointProvenance.reviewState') };
  }
  return {
    ok: true,
    value: Object.freeze({
      contract: 'llm-provider-live-endpoint-provenance-v1',
      reviewState: 'reviewed',
      providerId,
      modelId,
      endpointId,
      acceptedEndpoints: Object.freeze([acceptedEndpoint]) as readonly [string],
      endpointProvenanceReviewed: true,
    }),
  };
}

function parsePromptBudgetProof(value: unknown): ParseResult<LlmProviderLivePromptBudgetProofFact> {
  if (!isTrustedContractRecord(value) || !hasOnlyKeys(value, PROMPT_BUDGET_KEYS)) {
    return { ok: false, blocker: blocker('prompt_budget_invalid', 'Prompt budget proof must be exact reviewed metadata.', 'promptBudgetProof') };
  }
  const providerId = safeRuntimeInvocationProviderId(value.providerId);
  const modelId = safeIdentifier(value.modelId);
  const promptBudgetId = safeIdentifier(value.promptBudgetId);
  const estimatedPromptChars = safePromptChars(value.estimatedPromptChars);
  const maxPromptChars = safePromptChars(value.maxPromptChars);
  if (
    value.contract !== 'llm-provider-live-prompt-budget-proof-v1'
    || !providerId
    || !modelId
    || !promptBudgetId
    || estimatedPromptChars === undefined
    || maxPromptChars === undefined
    || maxPromptChars === 0
    || value.promptBudgetReviewed !== true
    || value.promptOmitted !== true
  ) {
    return { ok: false, blocker: blocker('prompt_budget_invalid', 'Prompt budget proof is malformed or secret-shaped.', 'promptBudgetProof') };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, blocker: blocker('prompt_budget_unreviewed', 'Prompt budget proof must be reviewed before activation planning.', 'promptBudgetProof.reviewState') };
  }
  if (estimatedPromptChars > maxPromptChars) {
    return { ok: false, blocker: blocker('prompt_budget_exceeded', 'Estimated prompt size must fit within the reviewed prompt budget.', 'promptBudgetProof.estimatedPromptChars') };
  }
  return {
    ok: true,
    value: Object.freeze({
      contract: 'llm-provider-live-prompt-budget-proof-v1',
      reviewState: 'reviewed',
      providerId,
      modelId,
      promptBudgetId,
      estimatedPromptChars,
      maxPromptChars,
      promptBudgetReviewed: true,
      promptOmitted: true,
    }),
  };
}

function parseUserApproval(value: unknown): ParseResult<LlmProviderLiveUserApprovalFact> {
  if (!isTrustedContractRecord(value) || !hasOnlyKeys(value, USER_APPROVAL_KEYS)) {
    return { ok: false, blocker: blocker('user_approval_invalid', 'User approval must be exact reviewed metadata.', 'userApproval') };
  }
  const providerId = safeRuntimeInvocationProviderId(value.providerId);
  const modelId = safeIdentifier(value.modelId);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const endpointId = safeIdentifier(value.endpointId);
  const promptBudgetId = safeIdentifier(value.promptBudgetId);
  if (
    value.contract !== 'llm-provider-live-user-approval-v1'
    || !providerId
    || !modelId
    || !credentialReferenceId
    || !endpointId
    || !promptBudgetId
    || value.approvedAction !== 'llm_provider_call'
    || value.explicitUserApprovalGranted !== true
    || value.noAutoCallAcknowledged !== true
    || value.approvalReviewed !== true
  ) {
    return { ok: false, blocker: blocker('user_approval_invalid', 'User approval is malformed or does not grant the exact future LLM call action.', 'userApproval') };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, blocker: blocker('user_approval_unreviewed', 'User approval must be reviewed before activation planning.', 'userApproval.reviewState') };
  }
  return {
    ok: true,
    value: Object.freeze({
      contract: 'llm-provider-live-user-approval-v1',
      reviewState: 'reviewed',
      providerId,
      modelId,
      credentialReferenceId,
      endpointId,
      promptBudgetId,
      approvedAction: 'llm_provider_call',
      explicitUserApprovalGranted: true,
      noAutoCallAcknowledged: true,
      approvalReviewed: true,
    }),
  };
}

function parseNoPromptPersistenceGuarantee(
  value: unknown,
): ParseResult<LlmProviderLiveNoPromptPersistenceGuaranteeFact> {
  if (!isTrustedContractRecord(value) || !hasOnlyKeys(value, NO_PROMPT_PERSISTENCE_KEYS)) {
    return { ok: false, blocker: blocker('prompt_persistence_guarantee_invalid', 'No-prompt-persistence guarantee must be exact reviewed metadata.', 'noPromptPersistenceGuarantee') };
  }
  const providerId = safeRuntimeInvocationProviderId(value.providerId);
  const modelId = safeIdentifier(value.modelId);
  const runtimeId = safeIdentifier(value.runtimeId);
  if (
    value.contract !== 'llm-provider-live-no-prompt-persistence-v1'
    || !providerId
    || !modelId
    || !runtimeId
    || value.promptPersistence !== 'none'
    || value.willPersistPrompt !== false
    || value.willLogPrompt !== false
    || value.willStoreConversation !== false
    || value.noPromptPersistenceReviewed !== true
  ) {
    return { ok: false, blocker: blocker('prompt_persistence_guarantee_invalid', 'No-prompt-persistence guarantee is malformed or permits prompt storage.', 'noPromptPersistenceGuarantee') };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, blocker: blocker('prompt_persistence_guarantee_unreviewed', 'No-prompt-persistence guarantee must be reviewed before activation planning.', 'noPromptPersistenceGuarantee.reviewState') };
  }
  return {
    ok: true,
    value: Object.freeze({
      contract: 'llm-provider-live-no-prompt-persistence-v1',
      reviewState: 'reviewed',
      providerId,
      modelId,
      runtimeId,
      promptPersistence: 'none',
      willPersistPrompt: false,
      willLogPrompt: false,
      willStoreConversation: false,
      noPromptPersistenceReviewed: true,
    }),
  };
}

function buildPlan(
  providerModelReview: LlmProviderLiveProviderModelReviewFact,
  runtimeOwnership: LlmProviderLiveRuntimeOwnershipFact,
  endpointProvenance: LlmProviderLiveEndpointProvenanceFact,
  promptBudgetProof: LlmProviderLivePromptBudgetProofFact,
  credentialReference: ConnectorCredentialReference,
): LlmProviderLiveActivationPlan {
  return trustedContractObject<LlmProviderLiveActivationPlan>([
    ['contract', 'llm-provider-live-activation-plan-v1'],
    ['providerId', providerModelReview.providerId],
    ['modelId', providerModelReview.modelId],
    ['runtimeOwner', RUNTIME_OWNER],
    ['runtimeId', runtimeOwnership.runtimeId],
    ['credentialReference', freezeCredentialReference(credentialReference) as unknown as RuntimeTrustedContractObject],
    ['endpointId', endpointProvenance.endpointId],
    ['acceptedEndpoint', endpointProvenance.acceptedEndpoints[0]],
    ['promptBudgetId', promptBudgetProof.promptBudgetId],
    ['estimatedPromptChars', promptBudgetProof.estimatedPromptChars],
    ['maxPromptChars', promptBudgetProof.maxPromptChars],
    ['providerModelReviewed', true],
    ['runtimeOwnershipReviewed', true],
    ['endpointProvenanceReviewed', true],
    ['promptBudgetReviewed', true],
    ['userApprovalReviewed', true],
    ['noPromptPersistenceReviewed', true],
    ['promptOmitted', true],
    ['promptPersistence', 'none'],
    ['requiresUserApprovalBeforeCall', true],
    ['executable', false],
    ['sideEffects', 'none'],
    ['willCallLlm', false],
    ['willCallProvider', false],
    ['willFetch', false],
    ['willOpenSocket', false],
    ['willStream', false],
    ['willPersistPrompt', false],
    ['sideEffectBoundary', PLAN_BOUNDARY],
  ]);
}

export function evaluateLlmProviderLiveActivationGate(
  input: LlmProviderLiveActivationGateInput,
): Readonly<LlmProviderLiveActivationDecision> {
  if (!isTrustedContractRecord(input)) {
    return blocked([blocker('root_shape_invalid', 'LLM provider live activation input must contain only reviewed local gate fields.', 'input')]);
  }
  if (hasUnsafeExtraField(input, ROOT_KEYS)) {
    return blocked([blocker('runtime_shape_forbidden', 'Callback, requester, fetch, socket, storage, executable, live-action, result, prompt, header, body, or stream fields are forbidden.', 'input')]);
  }
  if (!hasOnlyKeys(input, ROOT_KEYS)) {
    return blocked([blocker('root_shape_invalid', 'LLM provider live activation input must contain only reviewed local gate fields.', 'input')]);
  }
  if (hasConnectorSecretMaterial(input) || hasTokenOrSecretMaterial(input)) {
    return blocked([blocker('raw_secret_material', 'Raw secret or token-shaped material is forbidden anywhere in LLM provider live activation inputs.', 'input')]);
  }
  if (hasForbiddenRuntimeShape(input)) {
    return blocked([blocker('runtime_shape_forbidden', 'Callback, requester, fetch, socket, storage, executable, live-action, result, prompt, header, body, or stream fields are forbidden.', 'input')]);
  }
  if (hasForbiddenPromptPersistenceClaim(input)) {
    return blocked([blocker('prompt_persistence_claim_forbidden', 'Prompt persistence claims must be exact reviewed no-persistence guarantees.', 'input')]);
  }

  const blockers: LlmProviderLiveActivationBlocker[] = [];
  if (input.providerModelReview === undefined) {
    blockers.push(blocker('provider_model_review_missing', 'Reviewed provider/model ownership is required.', 'providerModelReview'));
  }
  if (input.runtimeOwnership === undefined) {
    blockers.push(blocker('runtime_ownership_missing', 'Reviewed runtime ownership is required.', 'runtimeOwnership'));
  }
  if (input.endpointProvenance === undefined) {
    blockers.push(blocker('endpoint_provenance_missing', 'Reviewed endpoint provenance is required.', 'endpointProvenance'));
  }
  if (input.promptBudgetProof === undefined) {
    blockers.push(blocker('prompt_budget_missing', 'Reviewed prompt budget proof is required.', 'promptBudgetProof'));
  }
  if (input.credentialReference === undefined) {
    blockers.push(blocker('credential_reference_missing', 'Opaque credential reference is required.', 'credentialReference'));
  }
  if (input.userApproval === undefined) {
    blockers.push(blocker('user_approval_missing', 'Explicit reviewed user approval is required.', 'userApproval'));
  }
  if (input.noPromptPersistenceGuarantee === undefined) {
    blockers.push(blocker('prompt_persistence_guarantee_missing', 'Reviewed no-prompt-persistence guarantee is required.', 'noPromptPersistenceGuarantee'));
  }
  if (blockers.length > 0) return blocked(blockers);

  const providerModelReview = parseProviderModelReview(input.providerModelReview);
  if (!providerModelReview.ok) blockers.push(providerModelReview.blocker);
  const runtimeOwnership = parseRuntimeOwnership(input.runtimeOwnership);
  if (!runtimeOwnership.ok) blockers.push(runtimeOwnership.blocker);
  const endpointProvenance = parseEndpointProvenance(input.endpointProvenance);
  if (!endpointProvenance.ok) blockers.push(endpointProvenance.blocker);
  const promptBudgetProof = parsePromptBudgetProof(input.promptBudgetProof);
  if (!promptBudgetProof.ok) blockers.push(promptBudgetProof.blocker);
  const userApproval = parseUserApproval(input.userApproval);
  if (!userApproval.ok) blockers.push(userApproval.blocker);
  const noPromptPersistenceGuarantee = parseNoPromptPersistenceGuarantee(input.noPromptPersistenceGuarantee);
  if (!noPromptPersistenceGuarantee.ok) blockers.push(noPromptPersistenceGuarantee.blocker);

  if (!isTrustedContractRecord(input.credentialReference)) {
    blockers.push(blocker(
      'credential_reference_invalid',
      'Credential reference must be a trusted contract object.',
      'credentialReference',
    ));
  }
  const credentialValidation = isTrustedContractRecord(input.credentialReference)
    ? validateConnectorCredentialReference(input.credentialReference)
    : undefined;
  let credentialReference: ConnectorCredentialReference | undefined;
  if (credentialValidation && !credentialValidation.ok) {
    blockers.push(blocker(
      'credential_reference_invalid',
      'Credential reference rejected by the connector credential boundary.',
      credentialValidation.field ? `credentialReference.${credentialValidation.field}` : 'credentialReference',
      credentialValidation.reason,
    ));
  } else if (credentialValidation?.ok) {
    credentialReference = credentialValidation.reference;
    if (credentialReference.displayName !== undefined && !safeCredentialDisplayName(credentialReference.displayName)) {
      blockers.push(blocker(
        'credential_reference_invalid',
        'Credential reference display metadata must not contain prompt, header, or body material.',
        'credentialReference.displayName',
      ));
    }
  }

  if (providerModelReview.ok && credentialReference) {
    if (credentialReference.providerId !== providerModelReview.value.providerId) {
      blockers.push(blocker('credential_provider_mismatch', 'Credential reference providerId must match the reviewed provider.', 'credentialReference.providerId'));
    }
  }

  if (providerModelReview.ok && runtimeOwnership.ok) {
    if (runtimeOwnership.value.providerId !== providerModelReview.value.providerId) {
      blockers.push(blocker('provider_mismatch', 'Runtime ownership providerId must match the reviewed provider.', 'runtimeOwnership.providerId'));
    }
    if (runtimeOwnership.value.modelId !== providerModelReview.value.modelId) {
      blockers.push(blocker('model_mismatch', 'Runtime ownership modelId must match the reviewed model.', 'runtimeOwnership.modelId'));
    }
    if (runtimeOwnership.value.runtimeOwner !== RUNTIME_OWNER) {
      blockers.push(blocker('runtime_owner_mismatch', 'Runtime owner must match the reviewed LLM provider runtime owner.', 'runtimeOwnership.runtimeOwner'));
    }
  }

  if (providerModelReview.ok && endpointProvenance.ok) {
    if (endpointProvenance.value.providerId !== providerModelReview.value.providerId) {
      blockers.push(blocker('provider_mismatch', 'Endpoint provenance providerId must match the reviewed provider.', 'endpointProvenance.providerId'));
    }
    if (endpointProvenance.value.modelId !== providerModelReview.value.modelId) {
      blockers.push(blocker('model_mismatch', 'Endpoint provenance modelId must match the reviewed model.', 'endpointProvenance.modelId'));
    }
  }

  if (providerModelReview.ok && promptBudgetProof.ok) {
    if (promptBudgetProof.value.providerId !== providerModelReview.value.providerId) {
      blockers.push(blocker('provider_mismatch', 'Prompt budget providerId must match the reviewed provider.', 'promptBudgetProof.providerId'));
    }
    if (promptBudgetProof.value.modelId !== providerModelReview.value.modelId) {
      blockers.push(blocker('model_mismatch', 'Prompt budget modelId must match the reviewed model.', 'promptBudgetProof.modelId'));
    }
  }

  if (providerModelReview.ok && userApproval.ok) {
    if (userApproval.value.providerId !== providerModelReview.value.providerId) {
      blockers.push(blocker('provider_mismatch', 'User approval providerId must match the reviewed provider.', 'userApproval.providerId'));
    }
    if (userApproval.value.modelId !== providerModelReview.value.modelId) {
      blockers.push(blocker('model_mismatch', 'User approval modelId must match the reviewed model.', 'userApproval.modelId'));
    }
  }

  if (providerModelReview.ok && noPromptPersistenceGuarantee.ok) {
    if (noPromptPersistenceGuarantee.value.providerId !== providerModelReview.value.providerId) {
      blockers.push(blocker('provider_mismatch', 'No-prompt-persistence providerId must match the reviewed provider.', 'noPromptPersistenceGuarantee.providerId'));
    }
    if (noPromptPersistenceGuarantee.value.modelId !== providerModelReview.value.modelId) {
      blockers.push(blocker('model_mismatch', 'No-prompt-persistence modelId must match the reviewed model.', 'noPromptPersistenceGuarantee.modelId'));
    }
  }

  if (runtimeOwnership.ok && credentialReference && runtimeOwnership.value.credentialReferenceId !== credentialReference.id) {
    blockers.push(blocker('credential_reference_mismatch', 'Runtime ownership credentialReferenceId must match the opaque credential reference id.', 'runtimeOwnership.credentialReferenceId'));
  }
  if (userApproval.ok && credentialReference && userApproval.value.credentialReferenceId !== credentialReference.id) {
    blockers.push(blocker('credential_reference_mismatch', 'User approval credentialReferenceId must match the opaque credential reference id.', 'userApproval.credentialReferenceId'));
  }
  if (runtimeOwnership.ok && endpointProvenance.ok && runtimeOwnership.value.endpointId !== endpointProvenance.value.endpointId) {
    blockers.push(blocker('endpoint_drift', 'Runtime ownership endpointId must match reviewed endpoint provenance.', 'runtimeOwnership.endpointId'));
  }
  if (userApproval.ok && endpointProvenance.ok && userApproval.value.endpointId !== endpointProvenance.value.endpointId) {
    blockers.push(blocker('endpoint_drift', 'User approval endpointId must match reviewed endpoint provenance.', 'userApproval.endpointId'));
  }
  if (runtimeOwnership.ok && promptBudgetProof.ok && runtimeOwnership.value.promptBudgetId !== promptBudgetProof.value.promptBudgetId) {
    blockers.push(blocker('prompt_budget_mismatch', 'Runtime ownership promptBudgetId must match reviewed prompt budget proof.', 'runtimeOwnership.promptBudgetId'));
  }
  if (userApproval.ok && promptBudgetProof.ok && userApproval.value.promptBudgetId !== promptBudgetProof.value.promptBudgetId) {
    blockers.push(blocker('prompt_budget_mismatch', 'User approval promptBudgetId must match reviewed prompt budget proof.', 'userApproval.promptBudgetId'));
  }
  if (
    runtimeOwnership.ok
    && noPromptPersistenceGuarantee.ok
    && runtimeOwnership.value.runtimeId !== noPromptPersistenceGuarantee.value.runtimeId
  ) {
    blockers.push(blocker('runtime_owner_mismatch', 'No-prompt-persistence guarantee runtimeId must match reviewed runtime ownership.', 'noPromptPersistenceGuarantee.runtimeId'));
  }

  if (
    blockers.length > 0
    || !providerModelReview.ok
    || !runtimeOwnership.ok
    || !endpointProvenance.ok
    || !promptBudgetProof.ok
    || !userApproval.ok
    || !noPromptPersistenceGuarantee.ok
    || !credentialReference
  ) {
    return blocked(blockers);
  }

  const activationPlan = buildPlan(
    providerModelReview.value,
    runtimeOwnership.value,
    endpointProvenance.value,
    promptBudgetProof.value,
    credentialReference!,
  );

  return trustedContractObject<LlmProviderLiveActivationDecision>([
    ['status', 'activation-ready'],
    ['mayPrepareLiveActivation', true],
    ['activationPlan', activationPlan as unknown as RuntimeTrustedContractObject],
    ['blockers', []],
    ['executable', false],
    ['sideEffects', 'none'],
    ['willCallLlm', false],
    ['willCallProvider', false],
    ['willFetch', false],
    ['willOpenSocket', false],
    ['willStream', false],
    ['willMutateStorage', false],
    ['willResolveCredentialSecrets', false],
    ['willPersistPrompt', false],
    ['requiresUserApprovalBeforeCall', true],
    ['sideEffectBoundary', DECISION_BOUNDARY],
  ]);
}
