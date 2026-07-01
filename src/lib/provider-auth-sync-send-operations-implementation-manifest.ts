import { hasConnectorSecretMaterial, validateConnectorCredentialReference } from './connector-credential-boundary';
import {
  type EmailProviderExecutionAction,
  type EmailProviderExecutionGateDecision,
} from './email-provider-execution-gate';
import {
  hasStoredEmailSecretMaterial,
  type EmailProviderId,
} from './email-onboarding';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type ProviderAuthSyncSendOperationsImplementationManifestStatus =
  | 'implementation-manifest-ready'
  | 'blocked';

export type ProviderAuthSyncSendOperationsImplementationManifestReason =
  | 'implementation_manifest_ready'
  | 'operation_plan_missing'
  | 'operation_plan_invalid'
  | 'operation_order_invalid'
  | 'credential_owner_invalid'
  | 'future_write_set_invalid'
  | 'forged_executable_claim'
  | 'raw_secret_material';

export type ProviderAuthSyncSendOperation =
  | 'auth'
  | 'test_connection'
  | 'sync_mail'
  | 'send_mail';

export type ProviderAuthSyncSendBlockedPathClass =
  | 'docs'
  | 'generated-artifacts'
  | 'package-files'
  | 'schema-db-export-backup'
  | 'standalone'
  | 'ui';

export interface ProviderAuthSyncSendOperationPlan {
  operation: ProviderAuthSyncSendOperation;
  action: EmailProviderExecutionAction;
  gateDecision: EmailProviderExecutionGateDecision;
  checkpointRequired: true;
  rollbackRequired: true;
}

export interface ProviderAuthSyncSendOperationsImplementationManifestInput {
  accountId?: string;
  providerId?: EmailProviderId;
  credentialReference?: unknown;
  operationPlan?: readonly ProviderAuthSyncSendOperationPlan[];
  futureWriteSet?: readonly string[];
}

export interface ProviderAuthSyncSendOperationsImplementationManifest {
  schemaVersion: 1;
  contract: 'provider-auth-sync-send-operations-implementation-manifest-v1';
  manifestOwner: 'assistantcaddy-head-chat-provider-auth-sync-send';
  manifestId: 'assistantcaddy-head-chat-provider-auth-sync-send-manifest';
  manifestVersion: '2026.06.12';
  integrationOwner: 'head-chat';
  integrationScope: 'provider-auth-sync-send-implementation';
  providerId?: EmailProviderId;
  accountId?: string;
  credentialReference?: {
    id: string;
    kind: string;
    storageOwner?: string;
    providerId?: string;
    connectorId?: string;
    accountId?: string;
  };
  operations: readonly ProviderAuthSyncSendOperation[];
  operationOrder: readonly ProviderAuthSyncSendOperation[];
  highRiskWriteSet: readonly string[];
  blockedPathClasses: readonly ProviderAuthSyncSendBlockedPathClass[];
  checkpointRequired: true;
  rollbackRequired: true;
  headChatReviewRequired: true;
  readyForImplementation: false;
  implementationMode: 'manifest-only';
}

export interface ProviderAuthSyncSendOperationsImplementationManifestDecision {
  status: ProviderAuthSyncSendOperationsImplementationManifestStatus;
  manifestReady: boolean;
  reason: ProviderAuthSyncSendOperationsImplementationManifestReason;
  manifest: ProviderAuthSyncSendOperationsImplementationManifest;
  canPrepareHeadChatProviderImplementation: boolean;
  readyForProviderAuthSyncSendImplementation: false;
  mayOpenOAuthWindow: false;
  mayCallProviderSdk: false;
  mayFetch: false;
  mayOpenSocket: false;
  mayStoreCredential: false;
  maySyncMail: false;
  maySendMail: false;
  mayModifySchema: false;
  mayExportOrBackup: false;
  willPromoteStandalone: false;
  sideEffects: 'none';
  sideEffectBoundary: 'provider-auth-sync-send-implementation-manifest-no-provider-no-network-no-storage-no-oauth-no-sync-no-send';
}

const EXPECTED_OPERATION_ORDER = Object.freeze([
  'auth',
  'test_connection',
  'sync_mail',
  'send_mail',
] as const);
const EXPECTED_ACTION_BY_OPERATION: Record<ProviderAuthSyncSendOperation, EmailProviderExecutionAction> = Object.freeze({
  auth: 'start_oauth',
  test_connection: 'test_connection',
  sync_mail: 'sync_mail',
  send_mail: 'send_mail',
});
const DEFAULT_HIGH_RISK_WRITE_SET = Object.freeze([
  'src/lib/email-provider-execution-gate.ts',
  'src/lib/email-provider-runtime-executor.ts',
  'src/lib/email-connector-readiness.ts',
  'src/lib/email-connection-policy.ts',
  'src/lib/email-onboarding.ts',
  'src/lib/connector-credential-boundary.ts',
  'src/__tests__/email-provider-execution-gate.test.ts',
  'src/__tests__/email-provider-runtime-executor.test.ts',
  'src/__tests__/email-connector-readiness.test.ts',
  'src/__tests__/email-connection-policy.test.ts',
] as const);
const BLOCKED_PATH_CLASSES = Object.freeze([
  'docs',
  'generated-artifacts',
  'package-files',
  'schema-db-export-backup',
  'standalone',
  'ui',
] as const);
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const OPAQUE_PROVIDER_REFERENCE_PATTERN = /^[A-Za-z0-9]+-[A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._:@/+~-]{1,179}$/;
const URL_LIKE_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const TOKEN_VALUE_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^gh[pousr]_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^(?:sk|pk|rk)-[a-z0-9_-]{8,}$/i,
  /^eyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}$/i,
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:api|app|bot|client|refresh|access|session)[_-]?(?:key|token|secret)\s*[:=]\s*\S+/i,
  /(?:oauth|authorization)[\s_-]?code\s*[:=]\s*\S+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/i,
] as const;
const DISALLOWED_WRITE_PATHS: readonly { pattern: RegExp; kind: ProviderAuthSyncSendBlockedPathClass }[] = Object.freeze([
  { pattern: /(^|\/)docs($|\/)/, kind: 'docs' },
  { pattern: /(^|\/)(dist|dist-single|node_modules|public|coverage|test-results)($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|yarn\.lock|\.npmrc)$/i, kind: 'package-files' },
  { pattern: /(^|\/)(src\/)?(db|schema|export|backup)(-|\/|\.|$)/i, kind: 'schema-db-export-backup' },
  { pattern: /(^|\/)(src\/lib\/)?(db|db-migration|export|backup-data|backup-restore|storage-migration)\.ts$/i, kind: 'schema-db-export-backup' },
  { pattern: /standalone|\.html$/i, kind: 'standalone' },
  { pattern: /(^|\/)src\/(components|hooks|pages|styles|types)($|\/)/, kind: 'ui' },
  { pattern: /\.tsx$/i, kind: 'ui' },
]);
const OPERATION_PLAN_ENTRY_KEYS = new Set([
  'action',
  'checkpointRequired',
  'gateDecision',
  'operation',
  'rollbackRequired',
]);
const ROOT_INPUT_KEYS = new Set([
  'accountId',
  'credentialReference',
  'futureWriteSet',
  'operationPlan',
  'providerId',
]);
const GATE_DECISION_KEYS = new Set([
  'accountId',
  'action',
  'allowed',
  'credentialReference',
  'providerId',
  'reason',
  'sideEffectBoundary',
  'status',
  'willSend',
]);
const FORBIDDEN_METADATA_KEY_PATTERN =
  /(?:callback|client|executable|fetch|oauth|providerclient|requester|sdk|socket|sync|token|transport|will|may)/i;

export const PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET = DEFAULT_HIGH_RISK_WRITE_SET;
export const PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER = EXPECTED_OPERATION_ORDER;
export const PROVIDER_AUTH_SYNC_SEND_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES = BLOCKED_PATH_CLASSES;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stringLooksTokenShaped(value: string): boolean {
  return TOKEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || !SAFE_ID_PATTERN.test(trimmed) || stringLooksTokenShaped(trimmed)) return undefined;
  if (!OPAQUE_PROVIDER_REFERENCE_PATTERN.test(trimmed) && URL_LIKE_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return undefined;
  }
  return trimmed;
}

function hasExecutableClaim(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (typeof value !== 'object' || value === null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => hasExecutableClaim(entry, seen));
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      entry === true
      && (
        normalizedKey === 'executable'
        || normalizedKey.startsWith('will')
        || normalizedKey.startsWith('may')
        || normalizedKey.startsWith('can')
        || normalizedKey.includes('send')
        || normalizedKey.includes('sync')
        || normalizedKey.includes('fetch')
        || normalizedKey.includes('oauth')
        || normalizedKey.includes('provider')
        || normalizedKey.includes('socket')
        || normalizedKey.includes('storage')
      )
    ) {
      return true;
    }
    if (FORBIDDEN_METADATA_KEY_PATTERN.test(normalizedKey) && typeof entry === 'function') return true;
    if (hasExecutableClaim(entry, seen)) return true;
  }
  return false;
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function safeWritePath(value: unknown): value is string {
  const normalized = safeIdentifier(value);
  if (!normalized) return false;
  if (normalized.startsWith('/') || normalized.includes('..') || normalized.includes('\\')) return false;
  return !DISALLOWED_WRITE_PATHS.some(({ pattern }) => pattern.test(normalized));
}

function writeSetIsExact(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) return false;
  if (!value.every(safeWritePath)) return false;
  return sameStringList([...value].sort(), [...DEFAULT_HIGH_RISK_WRITE_SET].sort());
}

function gateDecisionValid(
  decision: EmailProviderExecutionGateDecision,
  operation: ProviderAuthSyncSendOperation,
  accountId: string,
  providerId: EmailProviderId,
  credentialReference: ProviderAuthSyncSendOperationsImplementationManifest['credentialReference'],
): boolean {
  const gateCredential = summarizeCredentialReference(
    isRecord(decision) ? decision.credentialReference : undefined,
    accountId,
    providerId,
  );
  return isRecord(decision)
    && hasOnlyAllowedKeys(decision, GATE_DECISION_KEYS)
    && decision.status === 'allow'
    && decision.allowed === true
    && decision.action === EXPECTED_ACTION_BY_OPERATION[operation]
    && decision.reason === 'allowed_inert_provider_action_plan'
    && decision.accountId === accountId
    && decision.providerId === providerId
    && credentialReference !== undefined
    && (
      (operation === 'auth' && decision.credentialReference === undefined)
      || (
        gateCredential !== undefined
        && gateCredential.id === credentialReference.id
        && gateCredential.kind === credentialReference.kind
        && gateCredential.storageOwner === credentialReference.storageOwner
        && gateCredential.providerId === credentialReference.providerId
        && gateCredential.connectorId === credentialReference.connectorId
        && gateCredential.accountId === credentialReference.accountId
      )
    )
    && decision.willSend === false
    && decision.sideEffectBoundary === 'inert-local-plan-no-fetch-no-oauth-no-sync-no-send-no-storage';
}

function operationPlanValid(
  plan: readonly ProviderAuthSyncSendOperationPlan[],
  accountId: string,
  providerId: EmailProviderId,
  credentialReference: ProviderAuthSyncSendOperationsImplementationManifest['credentialReference'],
): boolean {
  if (plan.length !== EXPECTED_OPERATION_ORDER.length) return false;
  return plan.every((entry, index) => {
    const operation = EXPECTED_OPERATION_ORDER[index];
    return isRecord(entry)
      && hasOnlyAllowedKeys(entry, OPERATION_PLAN_ENTRY_KEYS)
      && entry.operation === operation
      && entry.action === EXPECTED_ACTION_BY_OPERATION[operation]
      && entry.checkpointRequired === true
      && entry.rollbackRequired === true
      && gateDecisionValid(entry.gateDecision, operation, accountId, providerId, credentialReference);
  });
}

function summarizeCredentialReference(
  reference: unknown,
  accountId: string,
  providerId: EmailProviderId,
): ProviderAuthSyncSendOperationsImplementationManifest['credentialReference'] | undefined {
  const validation = validateConnectorCredentialReference(reference);
  if (!validation.ok) return undefined;
  if (validation.reference.accountId !== accountId) return undefined;
  if (validation.reference.providerId !== providerId) return undefined;
  return Object.freeze({
    id: validation.reference.id,
    kind: validation.reference.kind,
    storageOwner: validation.reference.storageOwner,
    providerId: validation.reference.providerId,
    connectorId: validation.reference.connectorId,
    accountId: validation.reference.accountId,
  });
}

function freezeManifest(
  input?: ProviderAuthSyncSendOperationsImplementationManifestInput,
  ready = false,
): ProviderAuthSyncSendOperationsImplementationManifest {
  const accountId = ready ? safeIdentifier(input?.accountId) : undefined;
  const providerId = ready ? input?.providerId : undefined;
  const credentialReference = ready && accountId && providerId
    ? summarizeCredentialReference(input?.credentialReference, accountId, providerId)
    : undefined;
  return Object.freeze({
    schemaVersion: 1,
    contract: 'provider-auth-sync-send-operations-implementation-manifest-v1',
    manifestOwner: 'assistantcaddy-head-chat-provider-auth-sync-send',
    manifestId: 'assistantcaddy-head-chat-provider-auth-sync-send-manifest',
    manifestVersion: '2026.06.12',
    integrationOwner: 'head-chat',
    integrationScope: 'provider-auth-sync-send-implementation',
    providerId,
    accountId,
    credentialReference,
    operations: Object.freeze(ready ? [...EXPECTED_OPERATION_ORDER] : []),
    operationOrder: Object.freeze(ready ? [...EXPECTED_OPERATION_ORDER] : []),
    highRiskWriteSet: Object.freeze(ready ? [...DEFAULT_HIGH_RISK_WRITE_SET] : []),
    blockedPathClasses: BLOCKED_PATH_CLASSES,
    checkpointRequired: true,
    rollbackRequired: true,
    headChatReviewRequired: true,
    readyForImplementation: false,
    implementationMode: 'manifest-only',
  });
}

function freezeDecision(
  reason: ProviderAuthSyncSendOperationsImplementationManifestReason,
  input?: ProviderAuthSyncSendOperationsImplementationManifestInput,
): Readonly<ProviderAuthSyncSendOperationsImplementationManifestDecision> {
  const ready = reason === 'implementation_manifest_ready';
  return Object.freeze({
    status: ready ? 'implementation-manifest-ready' : 'blocked',
    manifestReady: ready,
    reason,
    manifest: freezeManifest(input, ready),
    canPrepareHeadChatProviderImplementation: ready,
    readyForProviderAuthSyncSendImplementation: false,
    mayOpenOAuthWindow: false,
    mayCallProviderSdk: false,
    mayFetch: false,
    mayOpenSocket: false,
    mayStoreCredential: false,
    maySyncMail: false,
    maySendMail: false,
    mayModifySchema: false,
    mayExportOrBackup: false,
    willPromoteStandalone: false,
    sideEffects: 'none',
    sideEffectBoundary: 'provider-auth-sync-send-implementation-manifest-no-provider-no-network-no-storage-no-oauth-no-sync-no-send',
  });
}

export function evaluateProviderAuthSyncSendOperationsImplementationManifest(
  input: ProviderAuthSyncSendOperationsImplementationManifestInput = {},
): Readonly<ProviderAuthSyncSendOperationsImplementationManifestDecision> {
  if (!isRuntimeTrustedContractObject(input) || !hasOnlyAllowedKeys(input, ROOT_INPUT_KEYS)) {
    return freezeDecision('operation_plan_invalid');
  }
  if (
    hasStoredEmailSecretMaterial(input)
    || hasConnectorSecretMaterial(input)
    || hasExecutableClaim(input)
  ) {
    return freezeDecision(hasExecutableClaim(input) ? 'forged_executable_claim' : 'raw_secret_material');
  }

  const accountId = safeIdentifier(input.accountId);
  const providerId = input.providerId;
  if (!accountId || !providerId) return freezeDecision('operation_plan_invalid');

  const credentialReference = summarizeCredentialReference(input.credentialReference, accountId, providerId);
  if (!credentialReference) return freezeDecision('credential_owner_invalid');

  if (!input.operationPlan || !Array.isArray(input.operationPlan)) return freezeDecision('operation_plan_missing');
  if (!operationPlanValid(input.operationPlan, accountId, providerId, credentialReference)) {
    const observedOrder = input.operationPlan
      .map((entry) => isRecord(entry) ? entry.operation : undefined)
      .filter((operation): operation is ProviderAuthSyncSendOperation => typeof operation === 'string');
    if (!sameStringList(observedOrder, EXPECTED_OPERATION_ORDER)) return freezeDecision('operation_order_invalid');
    return freezeDecision('operation_plan_invalid');
  }

  if (!writeSetIsExact(input.futureWriteSet)) return freezeDecision('future_write_set_invalid');

  return freezeDecision('implementation_manifest_ready', input);
}
