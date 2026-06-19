import { isSecretLikeFieldName } from './connector-credential-boundary';
import type {
  LocalBridgeRequesterInvocationImplementationDecision,
} from './local-bridge-requester-invocation-implementation-boundary';

export type LocalBridgeUserExecutionOperationsImplementationManifestStatus =
  | 'operations-manifest-ready'
  | 'blocked';

export type LocalBridgeUserExecutionOperationsImplementationManifestReason =
  | 'operations_manifest_ready'
  | 'invocation_boundary_missing'
  | 'invocation_boundary_not_ready'
  | 'invocation_boundary_invalid'
  | 'requester_owner_invalid'
  | 'endpoint_provenance_invalid'
  | 'high_risk_write_set_invalid'
  | 'checkpoint_requirements_invalid'
  | 'rollback_requirements_invalid'
  | 'raw_secret_material';

export type LocalBridgeUserExecutionOperationsImplementationBlockedPathClass =
  | 'generated-artifacts'
  | 'docs'
  | 'standalone'
  | 'package-files'
  | 'ui'
  | 'schema-db-export-backup'
  | 'credentials-or-secrets';

export type LocalBridgeUserExecutionOperationsImplementationCheckpointRequirement =
  | 'source-sanity'
  | 'typescript-noemit'
  | 'typescript-build'
  | 'focused-vitest'
  | 'static-no-live-call-scan'
  | 'git-diff-check'
  | 'recovery-checkpoint'
  | 'ledger-handoff-update';

export type LocalBridgeUserExecutionOperationsImplementationRollbackRequirement =
  | 'head-chat-owned-revert-plan'
  | 'checkpoint-restore-path'
  | 'standalone-promotion-hold'
  | 'smoke-server-cleanup-proof';

export interface LocalBridgeUserExecutionOperationsImplementationManifest {
  schemaVersion: 1;
  contract: 'local-bridge-user-execution-operations-implementation-manifest-v1';
  manifestOwner: 'assistantcaddy-head-chat-local-bridge-user-execution';
  manifestId: 'assistantcaddy-head-chat-local-bridge-user-execution-operations-manifest';
  manifestVersion: '2026.06.12';
  integrationOwner: 'head-chat';
  integrationScope: 'local-bridge-user-execution-operations-implementation';
  sourceInvocationBoundaryContract: 'local-bridge-requester-invocation-implementation-boundary-v1';
  sourceInvocationBoundaryDirective: 'decision-only-no-requester-call-no-fetch-no-socket-no-storage';
  capabilityId?: string;
  requesterId?: string;
  requesterVersion?: string;
  ownerSurface?: string;
  actionId?: string;
  bridgeKind?: string;
  acceptedEndpoint?: string;
  method?: 'GET';
  url?: string;
  timeoutMs?: number;
  credentialReferenceId?: string;
  dryRunResultId?: string;
  requesterImplementationId?: string;
  requesterPackageVersion?: string;
  highRiskWriteSet: readonly string[];
  blockedPathClasses: readonly LocalBridgeUserExecutionOperationsImplementationBlockedPathClass[];
  checkpointRequirements: readonly LocalBridgeUserExecutionOperationsImplementationCheckpointRequirement[];
  rollbackRequirements: readonly LocalBridgeUserExecutionOperationsImplementationRollbackRequirement[];
  promotedFromInvocationBoundary: true;
  headChatReviewRequired: true;
  readyForImplementation: false;
  implementationMode: 'manifest-only';
}

export interface LocalBridgeUserExecutionOperationsImplementationManifestDecision {
  status: LocalBridgeUserExecutionOperationsImplementationManifestStatus;
  manifestReady: boolean;
  reason: LocalBridgeUserExecutionOperationsImplementationManifestReason;
  manifest: LocalBridgeUserExecutionOperationsImplementationManifest;
  canPrepareHeadChatLocalBridgeUserExecutionImplementation: boolean;
  readyForLocalBridgeUserExecution: false;
  mayInvokeRequester: false;
  mayProbeLocalBridge: false;
  mayCallLocalBridge: false;
  mayCallProvider: false;
  mayUseFetch: false;
  mayOpenSocket: false;
  mayReadStorage: false;
  mayWriteStorage: false;
  willGenerateArtifacts: false;
  willPromoteStandalone: false;
  willMutateSchema: false;
  sideEffects: 'none';
  checkpointDirective: 'checkpoint-required-before-head-chat-implementation';
  rollbackDirective: 'rollback-plan-required-before-head-chat-implementation';
  implementationDirective: 'head-chat-owned-local-bridge-user-execution-implementation-only';
  sideEffectBoundary: 'local-bridge-user-execution-operations-implementation-manifest-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call-no-schema-no-export-no-standalone';
}

export interface LocalBridgeUserExecutionOperationsImplementationManifestInput {
  invocationBoundary?: LocalBridgeRequesterInvocationImplementationDecision | null;
  proposedHighRiskWriteSet?: readonly unknown[] | null;
  checkpointRequirements?: readonly unknown[] | null;
  rollbackRequirements?: readonly unknown[] | null;
}

interface AcceptedInvocationFacts {
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
  requesterImplementationId?: string;
  requesterPackageVersion?: string;
}

const SOURCE_INVOCATION_BOUNDARY_CONTRACT =
  'local-bridge-requester-invocation-implementation-boundary-v1' as const;
const SOURCE_INVOCATION_BOUNDARY_DIRECTIVE =
  'decision-only-no-requester-call-no-fetch-no-socket-no-storage' as const;
const SOURCE_INVOCATION_SIDE_EFFECT_BOUNDARY =
  'pure-local-requester-invocation-implementation-boundary-no-callback-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call' as const;
const MANIFEST_OWNER = 'assistantcaddy-head-chat-local-bridge-user-execution' as const;
const MANIFEST_ID =
  'assistantcaddy-head-chat-local-bridge-user-execution-operations-manifest' as const;
const MANIFEST_VERSION = '2026.06.12' as const;
const MANIFEST_SIDE_EFFECT_BOUNDARY =
  'local-bridge-user-execution-operations-implementation-manifest-no-fetch-no-socket-no-storage-no-provider-no-credentials-no-requester-call-no-schema-no-export-no-standalone' as const;
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
const DISALLOWED_WRITE_PATHS: readonly {
  pattern: RegExp;
  kind: LocalBridgeUserExecutionOperationsImplementationBlockedPathClass;
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
  { pattern: /(^|\/)src\/components($|\/)/i, kind: 'ui' },
  { pattern: /(^|\/)src\/pages($|\/)/i, kind: 'ui' },
  { pattern: /(^|\/)src\/ui($|\/)/i, kind: 'ui' },
  { pattern: /(^|\/)(?:db|schema|schemas|export|exports|backup|backups)($|\/)/i, kind: 'schema-db-export-backup' },
  { pattern: /(^|\/)src\/(?:db|schema|schemas|export|exports|backup|backups)($|\/)/i, kind: 'schema-db-export-backup' },
  { pattern: /\.(?:env|pem|key)$/i, kind: 'credentials-or-secrets' },
]);
const SAFE_SECRET_MARKER_FIELDS = new Set([
  'credentialReferenceId',
]);
const INVOCATION_BOUNDARY_KEYS = new Set([
  'bridge',
  'canPrepareFutureRequesterInvocation',
  'capability',
  'credentialReferenceId',
  'dryRunResultId',
  'executable',
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
const MANIFEST_INPUT_KEYS = new Set([
  'checkpointRequirements',
  'invocationBoundary',
  'proposedHighRiskWriteSet',
  'rollbackRequirements',
]);

export const LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET =
  Object.freeze([
    'src/lib/assistant-provider-runtime-executor.ts',
    'src/__tests__/assistant-provider-runtime-executor.test.ts',
    'src/lib/local-bridge-requester-execution-boundary.ts',
    'src/__tests__/local-bridge-requester-execution-boundary.test.ts',
    'src/lib/local-bridge-requester-invocation-implementation-boundary.ts',
    'src/__tests__/local-bridge-requester-invocation-implementation-boundary.test.ts',
  ]) as readonly string[];

export const LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES =
  Object.freeze([
    'generated-artifacts',
    'docs',
    'standalone',
    'package-files',
    'ui',
    'schema-db-export-backup',
    'credentials-or-secrets',
  ]) as readonly LocalBridgeUserExecutionOperationsImplementationBlockedPathClass[];

export const LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_CHECKPOINT_REQUIREMENTS =
  Object.freeze([
    'source-sanity',
    'typescript-noemit',
    'typescript-build',
    'focused-vitest',
    'static-no-live-call-scan',
    'git-diff-check',
    'recovery-checkpoint',
    'ledger-handoff-update',
  ]) as readonly LocalBridgeUserExecutionOperationsImplementationCheckpointRequirement[];

export const LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_ROLLBACK_REQUIREMENTS =
  Object.freeze([
    'head-chat-owned-revert-plan',
    'checkpoint-restore-path',
    'standalone-promotion-hold',
    'smoke-server-cleanup-proof',
  ]) as readonly LocalBridgeUserExecutionOperationsImplementationRollbackRequirement[];

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringLooksTokenShaped(value: string): boolean {
  return TOKEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function safeIdentifier(value: unknown): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) return undefined;
  if (
    normalized.length > MAX_IDENTIFIER_LENGTH
    || !SAFE_IDENTIFIER_PATTERN.test(normalized)
    || isSecretLikeFieldName(normalized)
    || stringLooksTokenShaped(normalized)
    || /https?:\/\//i.test(normalized)
    || /wss?:\/\//i.test(normalized)
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
      if (stringLooksTokenShaped(paramValue)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function unsafeSecretFieldName(key: string): boolean {
  return isSecretLikeFieldName(key) && !SAFE_SECRET_MARKER_FIELDS.has(key);
}

function valueHasTokenOrUrlSecretMaterial(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') {
    const maybeUrl = absoluteHttpUrl(value);
    return stringLooksTokenShaped(value) || (maybeUrl !== undefined && urlHasSecretMaterial(maybeUrl));
  }
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasTokenOrUrlSecretMaterial(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (
        valueHasTokenOrUrlSecretMaterial(key, seen)
        || valueHasTokenOrUrlSecretMaterial(nestedValue, seen)
      ) {
        return true;
      }
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasTokenOrUrlSecretMaterial(nestedValue, seen)) return true;
    }
    return false;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (unsafeSecretFieldName(key)) return true;
    if (valueHasTokenOrUrlSecretMaterial(nestedValue, seen)) return true;
  }
  return false;
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function sameOriginReviewedHealthProbe(left: string, right: string): boolean {
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    return leftUrl.origin === rightUrl.origin
      && rightUrl.pathname === '/health'
      && !rightUrl.search
      && !rightUrl.hash;
  } catch {
    return false;
  }
}

function isSafeTimeout(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
    && value <= MAX_TIMEOUT_MS;
}

function sameStringList(left: readonly unknown[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function safeWriteSetPath(value: unknown): value is string {
  const normalized = normalizedString(value);
  if (!normalized) return false;
  if (normalized.startsWith('/') || normalized.includes('..') || normalized.includes('\\')) return false;
  if (normalized.length > 220) return false;
  if (!/^[A-Za-z0-9._:@/+~-]+$/.test(normalized)) return false;
  if (isSecretLikeFieldName(normalized) || stringLooksTokenShaped(normalized)) return false;
  return !DISALLOWED_WRITE_PATHS.some(({ pattern }) => pattern.test(normalized));
}

function optionalExactStringList(value: readonly unknown[] | null | undefined, expected: readonly string[]): boolean {
  if (value === undefined) return true;
  return Array.isArray(value)
    && value.every(safeWriteSetPath)
    && sameStringList(value, expected);
}

function optionalExactCheckpointRequirementList(
  value: readonly unknown[] | null | undefined,
): boolean {
  if (value === undefined) return true;
  return Array.isArray(value)
    && sameStringList(value, LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_CHECKPOINT_REQUIREMENTS);
}

function optionalExactRollbackRequirementList(
  value: readonly unknown[] | null | undefined,
): boolean {
  if (value === undefined) return true;
  return Array.isArray(value)
    && sameStringList(value, LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_ROLLBACK_REQUIREMENTS);
}

function invocationBoundaryCoreFactsValid(
  boundary: LocalBridgeRequesterInvocationImplementationDecision,
): boolean {
  return boundary.status === 'ready'
    && boundary.ready === true
    && boundary.reason === 'requester_invocation_boundary_ready'
    && boundary.canPrepareFutureRequesterInvocation === true
    && boundary.invocationMode === 'decision-only'
    && boundary.executable === false
    && boundary.requesterCallable === false
    && boundary.willInvokeRequester === false
    && boundary.willProbeLocalBridge === false
    && boundary.willCallProvider === false
    && boundary.willMutateStorage === false
    && boundary.willStoreCredential === false
    && boundary.sideEffectBoundary === SOURCE_INVOCATION_SIDE_EFFECT_BOUNDARY
    && hasOnlyAllowedKeys(boundary as unknown as Record<string, unknown>, INVOCATION_BOUNDARY_KEYS)
    && isRecord(boundary.capability)
    && hasOnlyAllowedKeys(boundary.capability, CAPABILITY_KEYS)
    && isRecord(boundary.owner)
    && hasOnlyAllowedKeys(boundary.owner, OWNER_KEYS)
    && isRecord(boundary.bridge)
    && hasOnlyAllowedKeys(boundary.bridge, BRIDGE_KEYS)
    && isRecord(boundary.transport)
    && hasOnlyAllowedKeys(boundary.transport, TRANSPORT_KEYS);
}

function invocationRequesterOwnerFactsValid(
  boundary: LocalBridgeRequesterInvocationImplementationDecision,
): boolean {
  if (
    !isRecord(boundary.capability)
    || !isRecord(boundary.owner)
    || !isRecord(boundary.bridge)
  ) {
    return false;
  }
  return safeIdentifier(boundary.capability.id) !== undefined
    && safeIdentifier(boundary.capability.requesterId) !== undefined
    && safeIdentifier(boundary.capability.requesterVersion) !== undefined
    && safeIdentifier(boundary.owner.ownerSurface) !== undefined
    && safeIdentifier(boundary.owner.actionId) !== undefined
    && safeIdentifier(boundary.bridge.bridgeKind) !== undefined
    && (boundary.credentialReferenceId === undefined || safeIdentifier(boundary.credentialReferenceId) !== undefined)
    && (boundary.dryRunResultId === undefined || safeIdentifier(boundary.dryRunResultId) !== undefined)
    && (
      boundary.requesterImplementationId === undefined
      || safeIdentifier(boundary.requesterImplementationId) !== undefined
    )
    && (
      boundary.requesterPackageVersion === undefined
      || safeIdentifier(boundary.requesterPackageVersion) !== undefined
    );
}

function invocationEndpointProvenanceValid(
  boundary: LocalBridgeRequesterInvocationImplementationDecision,
): boolean {
  if (!isRecord(boundary.bridge) || !isRecord(boundary.transport)) return false;

  const acceptedEndpoint = localBridgeHttpUrl(boundary.bridge.acceptedEndpoint);
  const transportUrl = localBridgeHttpUrl(boundary.transport.url);
  return !!acceptedEndpoint
    && !!transportUrl
    && boundary.transport.method === 'GET'
    && isSafeTimeout(boundary.transport.timeoutMs)
    && acceptedEndpoint === boundary.bridge.acceptedEndpoint
    && transportUrl === boundary.transport.url
    && sameOriginReviewedHealthProbe(acceptedEndpoint, transportUrl)
    && !urlHasSecretMaterial(acceptedEndpoint)
    && !urlHasSecretMaterial(transportUrl);
}

function acceptedInvocationFacts(
  boundary: LocalBridgeRequesterInvocationImplementationDecision,
): AcceptedInvocationFacts | undefined {
  if (
    !isRecord(boundary.capability)
    || !isRecord(boundary.owner)
    || !isRecord(boundary.bridge)
    || !isRecord(boundary.transport)
  ) {
    return undefined;
  }

  const capabilityId = safeIdentifier(boundary.capability.id);
  const requesterId = safeIdentifier(boundary.capability.requesterId);
  const requesterVersion = safeIdentifier(boundary.capability.requesterVersion);
  const ownerSurface = safeIdentifier(boundary.owner.ownerSurface);
  const actionId = safeIdentifier(boundary.owner.actionId);
  const bridgeKind = safeIdentifier(boundary.bridge.bridgeKind);
  const acceptedEndpoint = localBridgeHttpUrl(boundary.bridge.acceptedEndpoint);
  const url = localBridgeHttpUrl(boundary.transport.url);
  const credentialReferenceId = safeIdentifier(boundary.credentialReferenceId);
  const dryRunResultId = safeIdentifier(boundary.dryRunResultId);
  const requesterImplementationId = safeIdentifier(boundary.requesterImplementationId);
  const requesterPackageVersion = safeIdentifier(boundary.requesterPackageVersion);

  if (
    !capabilityId
    || !requesterId
    || !requesterVersion
    || !ownerSurface
    || !actionId
    || !bridgeKind
    || !acceptedEndpoint
    || boundary.transport.method !== 'GET'
    || !url
    || !isSafeTimeout(boundary.transport.timeoutMs)
    || (boundary.credentialReferenceId !== undefined && !credentialReferenceId)
    || (boundary.dryRunResultId !== undefined && !dryRunResultId)
    || (boundary.requesterImplementationId !== undefined && !requesterImplementationId)
    || (boundary.requesterPackageVersion !== undefined && !requesterPackageVersion)
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
    acceptedEndpoint,
    method: 'GET',
    url,
    timeoutMs: boundary.transport.timeoutMs,
    ...(credentialReferenceId ? { credentialReferenceId } : {}),
    ...(dryRunResultId ? { dryRunResultId } : {}),
    ...(requesterImplementationId ? { requesterImplementationId } : {}),
    ...(requesterPackageVersion ? { requesterPackageVersion } : {}),
  });
}

function freezeManifest(
  facts?: AcceptedInvocationFacts,
): LocalBridgeUserExecutionOperationsImplementationManifest {
  return Object.freeze({
    schemaVersion: 1,
    contract: 'local-bridge-user-execution-operations-implementation-manifest-v1',
    manifestOwner: MANIFEST_OWNER,
    manifestId: MANIFEST_ID,
    manifestVersion: MANIFEST_VERSION,
    integrationOwner: 'head-chat',
    integrationScope: 'local-bridge-user-execution-operations-implementation',
    sourceInvocationBoundaryContract: SOURCE_INVOCATION_BOUNDARY_CONTRACT,
    sourceInvocationBoundaryDirective: SOURCE_INVOCATION_BOUNDARY_DIRECTIVE,
    capabilityId: facts?.capabilityId,
    requesterId: facts?.requesterId,
    requesterVersion: facts?.requesterVersion,
    ownerSurface: facts?.ownerSurface,
    actionId: facts?.actionId,
    bridgeKind: facts?.bridgeKind,
    acceptedEndpoint: facts?.acceptedEndpoint,
    method: facts?.method,
    url: facts?.url,
    timeoutMs: facts?.timeoutMs,
    credentialReferenceId: facts?.credentialReferenceId,
    dryRunResultId: facts?.dryRunResultId,
    requesterImplementationId: facts?.requesterImplementationId,
    requesterPackageVersion: facts?.requesterPackageVersion,
    highRiskWriteSet: Object.freeze([
      ...LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
    ]),
    blockedPathClasses: LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
    checkpointRequirements: LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_CHECKPOINT_REQUIREMENTS,
    rollbackRequirements: LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_ROLLBACK_REQUIREMENTS,
    promotedFromInvocationBoundary: true,
    headChatReviewRequired: true,
    readyForImplementation: false,
    implementationMode: 'manifest-only',
  });
}

function freezeDecision(
  reason: LocalBridgeUserExecutionOperationsImplementationManifestReason,
  facts?: AcceptedInvocationFacts,
): Readonly<LocalBridgeUserExecutionOperationsImplementationManifestDecision> {
  const ready = reason === 'operations_manifest_ready' && facts !== undefined;
  return Object.freeze({
    status: ready ? 'operations-manifest-ready' : 'blocked',
    manifestReady: ready,
    reason,
    manifest: freezeManifest(ready ? facts : undefined),
    canPrepareHeadChatLocalBridgeUserExecutionImplementation: ready,
    readyForLocalBridgeUserExecution: false,
    mayInvokeRequester: false,
    mayProbeLocalBridge: false,
    mayCallLocalBridge: false,
    mayCallProvider: false,
    mayUseFetch: false,
    mayOpenSocket: false,
    mayReadStorage: false,
    mayWriteStorage: false,
    willGenerateArtifacts: false,
    willPromoteStandalone: false,
    willMutateSchema: false,
    sideEffects: 'none',
    checkpointDirective: 'checkpoint-required-before-head-chat-implementation',
    rollbackDirective: 'rollback-plan-required-before-head-chat-implementation',
    implementationDirective: 'head-chat-owned-local-bridge-user-execution-implementation-only',
    sideEffectBoundary: MANIFEST_SIDE_EFFECT_BOUNDARY,
  });
}

export function evaluateLocalBridgeUserExecutionOperationsImplementationManifest(
  input: LocalBridgeUserExecutionOperationsImplementationManifestInput = {},
): Readonly<LocalBridgeUserExecutionOperationsImplementationManifestDecision> {
  if (!isRecord(input) || !hasOnlyAllowedKeys(input, MANIFEST_INPUT_KEYS)) {
    return freezeDecision('invocation_boundary_invalid');
  }
  if (valueHasTokenOrUrlSecretMaterial(input)) {
    return freezeDecision('raw_secret_material');
  }

  const manifestInput = input as LocalBridgeUserExecutionOperationsImplementationManifestInput;
  const boundary = manifestInput.invocationBoundary;
  if (!boundary) return freezeDecision('invocation_boundary_missing');
  if (!isRecord(boundary)) return freezeDecision('invocation_boundary_invalid');
  if (boundary.status !== 'ready' || boundary.ready !== true) {
    return freezeDecision('invocation_boundary_not_ready');
  }
  if (!invocationBoundaryCoreFactsValid(boundary)) {
    return freezeDecision('invocation_boundary_invalid');
  }
  if (!invocationRequesterOwnerFactsValid(boundary)) {
    return freezeDecision('requester_owner_invalid');
  }
  if (!invocationEndpointProvenanceValid(boundary)) {
    return freezeDecision('endpoint_provenance_invalid');
  }
  if (
    !optionalExactStringList(
      manifestInput.proposedHighRiskWriteSet as readonly unknown[] | null | undefined,
      LOCAL_BRIDGE_USER_EXECUTION_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
    )
  ) {
    return freezeDecision('high_risk_write_set_invalid');
  }
  if (!optionalExactCheckpointRequirementList(
    manifestInput.checkpointRequirements as readonly unknown[] | null | undefined,
  )) {
    return freezeDecision('checkpoint_requirements_invalid');
  }
  if (!optionalExactRollbackRequirementList(
    manifestInput.rollbackRequirements as readonly unknown[] | null | undefined,
  )) {
    return freezeDecision('rollback_requirements_invalid');
  }

  const facts = acceptedInvocationFacts(boundary);
  if (!facts) return freezeDecision('invocation_boundary_invalid');

  return freezeDecision('operations_manifest_ready', facts);
}
