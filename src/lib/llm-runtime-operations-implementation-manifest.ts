import {
  hasConnectorSecretMaterial,
  isSecretLikeFieldName,
} from './connector-credential-boundary';
import type {
  LlmRuntimeInvocationImplementationDecision,
  LlmRuntimeInvocationTransportIdentity,
} from './llm-runtime-invocation-implementation-boundary';
import type { AssistantProviderRoute } from './assistant-provider-readiness';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type LlmRuntimeOperationsImplementationManifestStatus =
  | 'implementation-manifest-ready'
  | 'blocked';

export type LlmRuntimeOperationsImplementationManifestReason =
  | 'implementation_manifest_ready'
  | 'source_boundary_missing'
  | 'source_boundary_not_ready'
  | 'source_boundary_invalid'
  | 'provider_provenance_invalid'
  | 'future_write_set_invalid'
  | 'forged_executable_claim'
  | 'raw_secret_material'
  | 'prompt_body_header_echo_forbidden';

export type LlmRuntimeOperationsImplementationManifestBlockedPathClass =
  | 'generated-artifacts'
  | 'docs'
  | 'standalone'
  | 'package-files'
  | 'ui'
  | 'schema-storage-export-backup';

export type LlmRuntimeOperationsImplementationManifestGate =
  | 'source-sanity-caddy-assistant-workspace'
  | 'typescript-no-emit'
  | 'typescript-build'
  | 'focused-vitest'
  | 'static-no-live-scan'
  | 'git-diff-check'
  | 'recovery-checkpoint'
  | 'ledger-handoff-update'
  | 'head-chat-standalone-promotion'
  | 'standalone-parity-and-smoke';

export interface LlmRuntimeOperationsImplementationManifest {
  schemaVersion: 1;
  contract: 'llm-runtime-operations-implementation-manifest-v1';
  manifestOwner: 'assistantcaddy-head-chat-llm-runtime';
  manifestId: 'assistantcaddy-head-chat-llm-runtime-operations-manifest';
  manifestVersion: '2026.06.12';
  implementationOwner: 'head-chat';
  implementationScope: 'llm-runtime-operations-implementation';
  sourceBoundaryContract: 'llm-runtime-invocation-implementation-boundary-v1';
  sourceBoundaryReason: 'executable_llm_transport_contract_missing';
  sourceBoundarySideEffectBoundary: 'llm-runtime-invocation-implementation-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call';
  sourceProvider?: Extract<AssistantProviderRoute, 'local' | 'openai'>;
  sourceModel?: string;
  sourceAction?: 'send_prompt' | 'test_provider' | 'list_models';
  sourceCredentialReferenceId?: string;
  sourceRequestId?: string;
  sourceLocalEndpoint?: string;
  sourcePromptEstimateChars?: number;
  sourceTransportIdentity?: LlmRuntimeInvocationTransportIdentity;
  promptRedactionRequirement: 'prompt-omitted';
  bodyRedactionRequirement: 'body-omitted';
  headersRedactionRequirement: 'headers-omitted';
  promptPersistenceRequirement: 'no-prompt-persistence';
  networkRequirement: 'no-network-until-reviewed-transport-contract';
  storageRequirement: 'no-storage-until-reviewed-secret-and-prompt-store';
  streamingRequirement: 'no-streaming-until-reviewed-stream-contract';
  exactHighRiskWriteSet: readonly string[];
  blockedPathClasses: readonly LlmRuntimeOperationsImplementationManifestBlockedPathClass[];
  requiredPromotionGates: readonly LlmRuntimeOperationsImplementationManifestGate[];
  promotedFromInvocationBoundary: true;
  headChatReviewRequired: true;
  recoveryCheckpointRequired: true;
  rollbackPlanRequired: true;
  standalonePromotionHeadChatOnly: true;
  readyForImplementation: false;
  implementationMode: 'manifest-only';
}

export interface LlmRuntimeOperationsImplementationManifestDecision {
  status: LlmRuntimeOperationsImplementationManifestStatus;
  manifestReady: boolean;
  reason: LlmRuntimeOperationsImplementationManifestReason;
  manifest: LlmRuntimeOperationsImplementationManifest;
  canPrepareHeadChatLlmRuntimeOperationsImplementation: boolean;
  readyForLlmRuntimeOperationsImplementation: false;
  mayCallLlm: false;
  mayCallProvider: false;
  mayCallLocalBridge: false;
  mayFetch: false;
  mayOpenSocket: false;
  mayStream: false;
  mayPersistPrompt: false;
  mayReadStorage: false;
  mayWriteStorage: false;
  willGenerateArtifacts: false;
  willPromoteStandalone: false;
  sideEffects: 'none';
  implementationDirective: 'head-chat-owned-llm-runtime-operations-implementation-only';
  sideEffectBoundary: 'llm-runtime-operations-implementation-manifest-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-no-local-bridge-call-no-provider-sdk';
}

export interface LlmRuntimeOperationsImplementationManifestInput {
  sourceBoundary?: LlmRuntimeInvocationImplementationDecision | null;
  proposedHighRiskWriteSet?: readonly unknown[] | null;
}

interface ParsedSourceBoundary {
  provider: Extract<AssistantProviderRoute, 'local' | 'openai'>;
  model: string;
  action: 'send_prompt' | 'test_provider' | 'list_models';
  credentialReferenceId: string;
  requestId: string;
  localEndpoint?: string;
  promptEstimateChars?: number;
  transportIdentity: LlmRuntimeInvocationTransportIdentity;
}

const SOURCE_BOUNDARY_REASON = 'executable_llm_transport_contract_missing' as const;
const SOURCE_BOUNDARY_SIDE_EFFECT_BOUNDARY =
  'llm-runtime-invocation-implementation-boundary-no-fetch-no-socket-no-stream-no-storage-no-provider-no-local-bridge-call' as const;
const MANIFEST_SIDE_EFFECT_BOUNDARY =
  'llm-runtime-operations-implementation-manifest-no-llm-no-fetch-no-socket-no-stream-no-storage-no-prompt-persistence-no-provider-no-local-bridge-call-no-provider-sdk' as const;
const MANIFEST_OWNER = 'assistantcaddy-head-chat-llm-runtime' as const;
const MANIFEST_ID = 'assistantcaddy-head-chat-llm-runtime-operations-manifest' as const;
const MANIFEST_VERSION = '2026.06.12' as const;
const SOURCE_TRANSPORT_ID = 'assistantcaddy-llm-runtime-transport' as const;
const SOURCE_TRANSPORT_VERSION = '2026.06.12' as const;
const SOURCE_TRANSPORT_OWNER = 'assistantcaddy-llm-runtime' as const;
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_WRITE_PATH_LENGTH = 240;
const MAX_PROMPT_ESTIMATE_CHARS = 200_000;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const SAFE_WRITE_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/@+~-]{0,239}$/;
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
const PROMPT_BODY_HEADER_ECHO_KEYS = new Set([
  'authorization',
  'body',
  'content',
  'headers',
  'messages',
  'payload',
  'prompt',
  'requestbody',
  'systemprompt',
]);
const PROMPT_BODY_HEADER_ECHO_TEXT_PATTERN =
  /\b(?:authorization|body|content|headers?|message|messages|payload|prompt|system\s*prompt)\s*[:=]/i;
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
const INPUT_KEYS = new Set(['proposedHighRiskWriteSet', 'sourceBoundary']);
const LIVE_CLAIM_KEYS = new Set([
  'dispatchallowed',
  'executable',
  'maycallllm',
  'maycalllocalbridge',
  'maycallprovider',
  'mayfetch',
  'mayopensocket',
  'maypersistprompt',
  'mayreadstorage',
  'maystream',
  'maywritestorage',
  'willcalllocalbridge',
  'willcallprovider',
  'willfetch',
  'willgenerateartifacts',
  'willmutatestorage',
  'willopensocket',
  'willpromotestandalone',
  'willstream',
]);
const UNSAFE_RUNTIME_FIELD_MARKERS = [
  'adapter',
  'callback',
  'eventsource',
  'fetch',
  'httpclient',
  'indexeddb',
  'invoke',
  'liveaction',
  'liveprovider',
  'localbridge',
  'requester',
  'socket',
  'storage',
  'stream',
  'websocket',
  'xhr',
] as const;
const SOURCE_BOUNDARY_KEYS = new Set([
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
const DISALLOWED_WRITE_PATHS: readonly {
  pattern: RegExp;
  kind: LlmRuntimeOperationsImplementationManifestBlockedPathClass;
}[] = Object.freeze([
  { pattern: /(^|\/)dist($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)dist-single($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)node_modules($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)public($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)docs($|\/)/, kind: 'docs' },
  { pattern: /(^|\/)threatcaddy-standalone\.html$/i, kind: 'standalone' },
  { pattern: /\.html$/i, kind: 'standalone' },
  { pattern: /standalone/i, kind: 'standalone' },
  { pattern: /(^|\/)package\.json$/i, kind: 'package-files' },
  { pattern: /(^|\/)package-lock\.json$/i, kind: 'package-files' },
  { pattern: /(^|\/)pnpm-lock\.yaml$/i, kind: 'package-files' },
  { pattern: /(^|\/)pnpm-workspace\.yaml$/i, kind: 'package-files' },
  { pattern: /(^|\/)\.npmrc$/i, kind: 'package-files' },
  { pattern: /(^|\/)yarn\.lock$/i, kind: 'package-files' },
  { pattern: /^src\/components\//, kind: 'ui' },
  { pattern: /^src\/db\.ts$/i, kind: 'schema-storage-export-backup' },
  { pattern: /^src\/types\.ts$/i, kind: 'schema-storage-export-backup' },
  { pattern: /^src\/lib\/(?:backup|export)(?:-|\.|$)/i, kind: 'schema-storage-export-backup' },
  { pattern: /(^|\/)(?:schema|schemas|migration|migrations)(?:\.|\/|$)/i, kind: 'schema-storage-export-backup' },
]);

export const LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET = Object.freeze([
  'src/hooks/useLLM.ts',
  'src/lib/llm-router.ts',
  'src/lib/assistant-provider-execution-gate.ts',
  'src/lib/assistant-provider-runtime-executor.ts',
  'src/lib/llm-runtime-invocation-implementation-boundary.ts',
  'src/lib/llm-runtime-operations-implementation-manifest.ts',
  'src/__tests__/useLLM.test.ts',
  'src/__tests__/assistant-provider-execution-gate.test.ts',
  'src/__tests__/assistant-provider-runtime-executor.test.ts',
  'src/__tests__/llm-runtime-invocation-implementation-boundary.test.ts',
  'src/__tests__/llm-runtime-operations-implementation-manifest.test.ts',
]) as readonly string[];

export const LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES = Object.freeze([
  'generated-artifacts',
  'docs',
  'standalone',
  'package-files',
  'ui',
  'schema-storage-export-backup',
]) as readonly LlmRuntimeOperationsImplementationManifestBlockedPathClass[];

export const LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_REQUIRED_GATES = Object.freeze([
  'source-sanity-caddy-assistant-workspace',
  'typescript-no-emit',
  'typescript-build',
  'focused-vitest',
  'static-no-live-scan',
  'git-diff-check',
  'recovery-checkpoint',
  'ledger-handoff-update',
  'head-chat-standalone-promotion',
  'standalone-parity-and-smoke',
]) as readonly LlmRuntimeOperationsImplementationManifestGate[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return isRuntimeTrustedContractObject(value);
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringLooksTokenShaped(value: string): boolean {
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

function urlHasTokenMaterial(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return true;
    for (const [key, paramValue] of url.searchParams.entries()) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        isSecretLikeFieldName(key)
        || SECRET_URL_PARAM_MARKERS.some((marker) => normalizedKey.includes(marker))
        || stringLooksTokenShaped(paramValue)
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

function stringHasSecretUrlMaterial(value: string): boolean {
  try {
    const url = new URL(value);
    return urlHasTokenMaterial(url.toString());
  } catch {
    return false;
  }
}

function localLoopbackHttpUrl(value: unknown): string | undefined {
  const normalized = absoluteHttpUrl(value);
  if (!normalized) return undefined;
  const url = new URL(normalized);
  if (!isLoopbackHostname(url.hostname) || urlHasTokenMaterial(normalized)) return undefined;
  return normalized;
}

function valueHasTokenOrSecretMaterial(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  if (currentKey && isSecretLikeFieldName(currentKey)) return true;
  if (typeof value === 'string') {
    return stringLooksTokenShaped(value) || stringHasSecretUrlMaterial(value);
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

function valueHasPromptBodyHeaderEcho(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  if (currentKey) {
    const normalizedKey = currentKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (PROMPT_BODY_HEADER_ECHO_KEYS.has(normalizedKey)) return true;
  }
  if (typeof value === 'string' && PROMPT_BODY_HEADER_ECHO_TEXT_PATTERN.test(value)) return true;
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasPromptBodyHeaderEcho(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (valueHasPromptBodyHeaderEcho(
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
      if (valueHasPromptBodyHeaderEcho(nestedValue, seen)) return true;
    }
    return false;
  }

  return Object.entries(value).some(([key, nestedValue]) => (
    valueHasPromptBodyHeaderEcho(nestedValue, seen, key)
  ));
}

function valueHasLiveClaim(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  const normalizedKey = currentKey?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalizedKey && LIVE_CLAIM_KEYS.has(normalizedKey)) {
    return value === true || typeof value === 'function';
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

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function hasUnsafeLiveExtraField(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).some((key) => (
    !allowed.has(key)
    && LIVE_CLAIM_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, ''))
  ));
}

function hasUnsafeRuntimeExtraField(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).some((key) => {
    if (allowed.has(key)) return false;
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    return UNSAFE_RUNTIME_FIELD_MARKERS.some((marker) => normalized.includes(marker));
  });
}

function hasSecretExtraField(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).some((key) => !allowed.has(key) && isSecretLikeFieldName(key));
}

function hasPromptBodyHeaderExtraField(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).some((key) => (
    !allowed.has(key)
    && PROMPT_BODY_HEADER_ECHO_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, ''))
  ));
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

function parseTransportIdentity(value: unknown): LlmRuntimeInvocationTransportIdentity | undefined {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, TRANSPORT_IDENTITY_KEYS)) return undefined;
  const id = safeIdentifier(value.id);
  const version = safeIdentifier(value.version);
  if (
    value.kind !== 'future-reviewed-injected-llm-transport'
    || id !== SOURCE_TRANSPORT_ID
    || version !== SOURCE_TRANSPORT_VERSION
    || value.owner !== SOURCE_TRANSPORT_OWNER
  ) {
    return undefined;
  }

  return Object.freeze({
    kind: 'future-reviewed-injected-llm-transport',
    id,
    version,
    owner: SOURCE_TRANSPORT_OWNER,
  });
}

function sourceBoundaryCoreFactsValid(boundary: Record<string, unknown>): boolean {
  return boundary.status === 'blocked'
    && boundary.implementationBoundaryReady === true
    && boundary.reason === SOURCE_BOUNDARY_REASON
    && boundary.promptRedaction === 'prompt-omitted'
    && boundary.canPrepareFutureLlmInvocation === true
    && boundary.executable === false
    && boundary.dispatchAllowed === false
    && boundary.willCallProvider === false
    && boundary.willCallLocalBridge === false
    && boundary.willFetch === false
    && boundary.willOpenSocket === false
    && boundary.willStream === false
    && boundary.willMutateStorage === false
    && boundary.sideEffectBoundary === SOURCE_BOUNDARY_SIDE_EFFECT_BOUNDARY;
}

function parseSourceBoundary(
  value: LlmRuntimeInvocationImplementationDecision,
): ParsedSourceBoundary | undefined {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, SOURCE_BOUNDARY_KEYS)) return undefined;
  if (!sourceBoundaryCoreFactsValid(value)) return undefined;

  const provider = value.provider === 'local' || value.provider === 'openai' ? value.provider : undefined;
  const model = safeIdentifier(value.model);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const requestId = safeIdentifier(value.requestId);
  const promptEstimateChars = parsePromptEstimate(value.promptEstimateChars);
  const localEndpoint = value.localEndpoint === undefined ? undefined : localLoopbackHttpUrl(value.localEndpoint);
  const transportIdentity = parseTransportIdentity(value.transportIdentity);
  if (
    !provider
    || !model
    || (value.action !== 'send_prompt' && value.action !== 'test_provider' && value.action !== 'list_models')
    || !credentialReferenceId
    || !requestId
    || !transportIdentity
    || (value.promptEstimateChars !== undefined && promptEstimateChars === undefined)
    || (provider === 'local' && !localEndpoint)
    || (provider !== 'local' && value.localEndpoint !== undefined)
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

function safeWriteSetPath(value: unknown): value is string {
  const normalized = normalizedString(value);
  if (!normalized) return false;
  if (
    normalized.length > MAX_WRITE_PATH_LENGTH
    || normalized.startsWith('/')
    || normalized.includes('..')
    || normalized.includes('\\')
    || !SAFE_WRITE_PATH_PATTERN.test(normalized)
    || stringLooksTokenShaped(normalized)
  ) {
    return false;
  }
  return !DISALLOWED_WRITE_PATHS.some(({ pattern }) => pattern.test(normalized));
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sortedStringList(value: readonly string[]): readonly string[] {
  return Object.freeze([...value].sort());
}

function proposedWriteSetMatchesExact(value: readonly unknown[] | null | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (!Array.isArray(value) || !value.every(safeWriteSetPath)) return false;
  return sameStringList(
    sortedStringList(value),
    sortedStringList(LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET),
  );
}

function freezeManifest(parsed?: ParsedSourceBoundary): LlmRuntimeOperationsImplementationManifest {
  return Object.freeze({
    schemaVersion: 1,
    contract: 'llm-runtime-operations-implementation-manifest-v1',
    manifestOwner: MANIFEST_OWNER,
    manifestId: MANIFEST_ID,
    manifestVersion: MANIFEST_VERSION,
    implementationOwner: 'head-chat',
    implementationScope: 'llm-runtime-operations-implementation',
    sourceBoundaryContract: 'llm-runtime-invocation-implementation-boundary-v1',
    sourceBoundaryReason: SOURCE_BOUNDARY_REASON,
    sourceBoundarySideEffectBoundary: SOURCE_BOUNDARY_SIDE_EFFECT_BOUNDARY,
    sourceProvider: parsed?.provider,
    sourceModel: parsed?.model,
    sourceAction: parsed?.action,
    sourceCredentialReferenceId: parsed?.credentialReferenceId,
    sourceRequestId: parsed?.requestId,
    sourceLocalEndpoint: parsed?.localEndpoint,
    sourcePromptEstimateChars: parsed?.promptEstimateChars,
    sourceTransportIdentity: parsed?.transportIdentity
      ? Object.freeze({
          kind: parsed.transportIdentity.kind,
          id: parsed.transportIdentity.id,
          version: parsed.transportIdentity.version,
          owner: parsed.transportIdentity.owner,
        })
      : undefined,
    promptRedactionRequirement: 'prompt-omitted',
    bodyRedactionRequirement: 'body-omitted',
    headersRedactionRequirement: 'headers-omitted',
    promptPersistenceRequirement: 'no-prompt-persistence',
    networkRequirement: 'no-network-until-reviewed-transport-contract',
    storageRequirement: 'no-storage-until-reviewed-secret-and-prompt-store',
    streamingRequirement: 'no-streaming-until-reviewed-stream-contract',
    exactHighRiskWriteSet: Object.freeze(
      parsed ? [...LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET] : [],
    ),
    blockedPathClasses: LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
    requiredPromotionGates: LLM_RUNTIME_OPERATIONS_IMPLEMENTATION_MANIFEST_REQUIRED_GATES,
    promotedFromInvocationBoundary: true,
    headChatReviewRequired: true,
    recoveryCheckpointRequired: true,
    rollbackPlanRequired: true,
    standalonePromotionHeadChatOnly: true,
    readyForImplementation: false,
    implementationMode: 'manifest-only',
  });
}

function freezeDecision(
  reason: LlmRuntimeOperationsImplementationManifestReason,
  parsed?: ParsedSourceBoundary,
): Readonly<LlmRuntimeOperationsImplementationManifestDecision> {
  const ready = reason === 'implementation_manifest_ready' && parsed !== undefined;
  return Object.freeze({
    status: ready ? 'implementation-manifest-ready' : 'blocked',
    manifestReady: ready,
    reason,
    manifest: freezeManifest(ready ? parsed : undefined),
    canPrepareHeadChatLlmRuntimeOperationsImplementation: ready,
    readyForLlmRuntimeOperationsImplementation: false,
    mayCallLlm: false,
    mayCallProvider: false,
    mayCallLocalBridge: false,
    mayFetch: false,
    mayOpenSocket: false,
    mayStream: false,
    mayPersistPrompt: false,
    mayReadStorage: false,
    mayWriteStorage: false,
    willGenerateArtifacts: false,
    willPromoteStandalone: false,
    sideEffects: 'none',
    implementationDirective: 'head-chat-owned-llm-runtime-operations-implementation-only',
    sideEffectBoundary: MANIFEST_SIDE_EFFECT_BOUNDARY,
  });
}

export function evaluateLlmRuntimeOperationsImplementationManifest(
  input?: LlmRuntimeOperationsImplementationManifestInput,
): Readonly<LlmRuntimeOperationsImplementationManifestDecision> {
  if (input === undefined) return freezeDecision('source_boundary_missing');
  if (!isRecord(input)) {
    return freezeDecision('source_boundary_invalid');
  }
  if (hasUnsafeLiveExtraField(input, INPUT_KEYS)) {
    return freezeDecision('forged_executable_claim');
  }
  if (hasUnsafeRuntimeExtraField(input, INPUT_KEYS)) {
    return freezeDecision('forged_executable_claim');
  }
  if (hasSecretExtraField(input, INPUT_KEYS)) {
    return freezeDecision('raw_secret_material');
  }
  if (hasPromptBodyHeaderExtraField(input, INPUT_KEYS)) {
    return freezeDecision('prompt_body_header_echo_forbidden');
  }
  if (!hasOnlyAllowedKeys(input, INPUT_KEYS)) {
    return freezeDecision('source_boundary_invalid');
  }
  if (hasConnectorSecretMaterial(input) || valueHasTokenOrSecretMaterial(input)) {
    return freezeDecision('raw_secret_material');
  }
  if (valueHasPromptBodyHeaderEcho(input)) {
    return freezeDecision('prompt_body_header_echo_forbidden');
  }
  if (valueHasLiveClaim(input)) {
    return freezeDecision('forged_executable_claim');
  }

  const manifestInput = input as LlmRuntimeOperationsImplementationManifestInput;
  const sourceBoundary = manifestInput.sourceBoundary;
  if (!sourceBoundary) return freezeDecision('source_boundary_missing');
  if (!isRecord(sourceBoundary)) return freezeDecision('source_boundary_invalid');
  if (hasUnsafeLiveExtraField(sourceBoundary, SOURCE_BOUNDARY_KEYS)) {
    return freezeDecision('forged_executable_claim');
  }
  if (hasUnsafeRuntimeExtraField(sourceBoundary, SOURCE_BOUNDARY_KEYS)) {
    return freezeDecision('forged_executable_claim');
  }
  if (hasSecretExtraField(sourceBoundary, SOURCE_BOUNDARY_KEYS)) {
    return freezeDecision('raw_secret_material');
  }
  if (hasPromptBodyHeaderExtraField(sourceBoundary, SOURCE_BOUNDARY_KEYS)) {
    return freezeDecision('prompt_body_header_echo_forbidden');
  }
  if (!hasOnlyAllowedKeys(sourceBoundary, SOURCE_BOUNDARY_KEYS)) {
    return freezeDecision('source_boundary_invalid');
  }
  if (sourceBoundary.implementationBoundaryReady !== true || sourceBoundary.canPrepareFutureLlmInvocation !== true) {
    return freezeDecision('source_boundary_not_ready');
  }
  if (!sourceBoundaryCoreFactsValid(sourceBoundary)) {
    return freezeDecision('source_boundary_invalid');
  }

  const parsed = parseSourceBoundary(sourceBoundary as LlmRuntimeInvocationImplementationDecision);
  if (!parsed) return freezeDecision('provider_provenance_invalid');
  if (!proposedWriteSetMatchesExact(manifestInput.proposedHighRiskWriteSet as readonly unknown[] | null | undefined)) {
    return freezeDecision('future_write_set_invalid');
  }

  return freezeDecision('implementation_manifest_ready', parsed);
}
