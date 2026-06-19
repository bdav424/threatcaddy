import {
  hasConnectorSecretMaterial,
  validateConnectorCredentialReference,
} from './connector-credential-boundary';
import {
  type MessagingExecutionAction,
  type MessagingExecutionGateDecision,
} from './messaging-execution-gate';
import {
  hasMessagingSecretMaterial,
  type MessagingConnectorEventClass,
  type MessagingConnectorKind,
} from './messaging-connector-policy';
import {
  type MessagingRuntimeReadinessDecision,
} from './messaging-runtime-readiness';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type MessagingLiveDeliveryOperationsImplementationManifestStatus =
  | 'implementation-manifest-ready'
  | 'blocked';

export type MessagingLiveDeliveryOperationsImplementationManifestReason =
  | 'implementation_manifest_ready'
  | 'operation_plan_missing'
  | 'operation_plan_invalid'
  | 'operation_order_invalid'
  | 'input_untrusted'
  | 'runtime_provenance_invalid'
  | 'target_provenance_invalid'
  | 'credential_owner_invalid'
  | 'future_write_set_invalid'
  | 'forged_executable_claim'
  | 'raw_secret_material';

export type MessagingLiveDeliveryOperation =
  | 'dry_run_notification'
  | 'post_message'
  | 'post_thread_reply'
  | 'webhook_delivery';

export type MessagingLiveDeliveryBlockedPathClass =
  | 'docs'
  | 'generated-artifacts'
  | 'package-files'
  | 'schema-db-export-backup'
  | 'standalone'
  | 'ui';

export interface MessagingLiveDeliveryTargetProvenance {
  kind: 'slack-channel' | 'webhook-reference';
  id: string;
  workspaceId?: string;
  connectorKind: MessagingConnectorKind;
  eventScope: MessagingConnectorEventClass;
}

export interface MessagingLiveDeliveryOperationPlan {
  operation: MessagingLiveDeliveryOperation;
  action: MessagingExecutionAction;
  gateDecision: MessagingExecutionGateDecision;
  checkpointRequired: true;
  rollbackRequired: true;
}

export interface MessagingLiveDeliveryOperationsImplementationManifestInput {
  connectorKind?: MessagingConnectorKind;
  eventScope?: MessagingConnectorEventClass;
  credentialReference?: unknown;
  target?: unknown;
  runtimeReadiness?: MessagingRuntimeReadinessDecision;
  operationPlan?: readonly MessagingLiveDeliveryOperationPlan[];
  futureWriteSet?: readonly string[];
}

export interface MessagingLiveDeliveryOperationsImplementationManifest {
  schemaVersion: 1;
  contract: 'messaging-live-delivery-operations-implementation-manifest-v1';
  manifestOwner: 'assistantcaddy-head-chat-messaging-live-delivery';
  manifestId: 'assistantcaddy-head-chat-messaging-live-delivery-manifest';
  manifestVersion: '2026.06.12';
  integrationOwner: 'head-chat';
  integrationScope: 'messaging-live-delivery-implementation';
  connectorKind?: MessagingConnectorKind;
  eventScope?: MessagingConnectorEventClass;
  credentialReference?: {
    id: string;
    kind: string;
    storageOwner?: string;
    providerId?: string;
    connectorId?: string;
    accountId?: string;
  };
  target?: MessagingLiveDeliveryTargetProvenance;
  operations: readonly MessagingLiveDeliveryOperation[];
  operationOrder: readonly MessagingLiveDeliveryOperation[];
  highRiskWriteSet: readonly string[];
  blockedPathClasses: readonly MessagingLiveDeliveryBlockedPathClass[];
  checkpointRequired: true;
  rollbackRequired: true;
  headChatReviewRequired: true;
  readyForImplementation: false;
  implementationMode: 'manifest-only';
}

export interface MessagingLiveDeliveryOperationsImplementationManifestDecision {
  status: MessagingLiveDeliveryOperationsImplementationManifestStatus;
  manifestReady: boolean;
  reason: MessagingLiveDeliveryOperationsImplementationManifestReason;
  manifest: MessagingLiveDeliveryOperationsImplementationManifest;
  canPrepareHeadChatMessagingLiveDeliveryImplementation: boolean;
  readyForMessagingLiveDeliveryImplementation: false;
  mayImportSlackSdk: false;
  mayCallSlackApi: false;
  mayCallWebhook: false;
  mayFetch: false;
  mayOpenSocket: false;
  mayStoreCredential: false;
  mayPostMessage: false;
  mayPostThreadReply: false;
  mayDeliverWebhook: false;
  mayModifySchema: false;
  mayExportOrBackup: false;
  willPromoteStandalone: false;
  sideEffects: 'none';
  sideEffectBoundary: 'messaging-live-delivery-implementation-manifest-no-slack-api-no-webhook-no-network-no-storage-no-send';
}

const EXPECTED_OPERATION_ORDER = Object.freeze([
  'dry_run_notification',
  'post_message',
  'post_thread_reply',
  'webhook_delivery',
] as const);

const EXPECTED_ACTION_BY_OPERATION: Record<MessagingLiveDeliveryOperation, MessagingExecutionAction> = Object.freeze({
  dry_run_notification: 'dry-run-notification',
  post_message: 'post-message',
  post_thread_reply: 'post-thread-reply',
  webhook_delivery: 'webhook-delivery',
});

const DEFAULT_HIGH_RISK_WRITE_SET = Object.freeze([
  'src/lib/messaging-connector-policy.ts',
  'src/lib/messaging-runtime-readiness.ts',
  'src/lib/messaging-execution-gate.ts',
  'src/lib/messaging-runtime-executor.ts',
  'src/lib/connector-credential-boundary.ts',
  'src/__tests__/messaging-connector-policy.test.ts',
  'src/__tests__/messaging-runtime-readiness.test.ts',
  'src/__tests__/messaging-execution-gate.test.ts',
  'src/__tests__/messaging-runtime-executor.test.ts',
] as const);

const BLOCKED_PATH_CLASSES = Object.freeze([
  'docs',
  'generated-artifacts',
  'package-files',
  'schema-db-export-backup',
  'standalone',
  'ui',
] as const);

const SUPPORTED_CONNECTOR_KINDS: readonly MessagingConnectorKind[] = ['slack', 'generic-webhook'];
const SUPPORTED_EVENT_SCOPES: readonly MessagingConnectorEventClass[] = [
  'direct-mention',
  'one-to-one-dm',
  'group-dm',
  'thread-reply-after-user-post',
  'channel-follow-up',
  'webhook-alert',
];
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+_~-]{0,179}$/;
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
  /hooks\.slack(?:-gov)?\.com\/services\//i,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/i,
] as const;
const DISALLOWED_WRITE_PATHS: readonly { pattern: RegExp; kind: MessagingLiveDeliveryBlockedPathClass }[] = Object.freeze([
  { pattern: /(^|\/)docs($|\/)/, kind: 'docs' },
  { pattern: /(^|\/)(dist|dist-single|node_modules|public|coverage|test-results)($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|yarn\.lock|\.npmrc)$/i, kind: 'package-files' },
  { pattern: /(^|\/)(src\/)?(db|schema|export|backup)(-|\/|\.|$)/i, kind: 'schema-db-export-backup' },
  { pattern: /(^|\/)(src\/lib\/)?(db|db-migration|export|backup-data|backup-restore|storage-migration)\.ts$/i, kind: 'schema-db-export-backup' },
  { pattern: /standalone|\.html$/i, kind: 'standalone' },
  { pattern: /(^|\/)src\/(components|hooks|pages|styles|types)($|\/)/, kind: 'ui' },
  { pattern: /\.tsx$/i, kind: 'ui' },
]);
const TARGET_PROVENANCE_KEYS = new Set([
  'connectorKind',
  'eventScope',
  'id',
  'kind',
  'workspaceId',
]);
const OPERATION_PLAN_ENTRY_KEYS = new Set([
  'action',
  'checkpointRequired',
  'gateDecision',
  'operation',
  'rollbackRequired',
]);
const GATE_DECISION_KEYS = new Set([
  'action',
  'decision',
  'eventScope',
  'executesProviderCall',
  'inert',
  'noAutoPost',
  'reason',
  'runtimeReason',
  'runtimeStatus',
  'sideEffectBoundary',
]);
const FORBIDDEN_ECHO_KEYS = new Set([
  'adaptermetadata',
  'authorization',
  'body',
  'content',
  'headers',
  'payload',
  'requestbody',
  'safedetails',
]);

export const MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET =
  DEFAULT_HIGH_RISK_WRITE_SET;
export const MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER =
  EXPECTED_OPERATION_ORDER;
export const MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES =
  BLOCKED_PATH_CLASSES;

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
  return trimmed;
}

function isMessagingConnectorKind(value: unknown): value is MessagingConnectorKind {
  return typeof value === 'string' && SUPPORTED_CONNECTOR_KINDS.includes(value as MessagingConnectorKind);
}

function isMessagingEventScope(value: unknown): value is MessagingConnectorEventClass {
  return typeof value === 'string' && SUPPORTED_EVENT_SCOPES.includes(value as MessagingConnectorEventClass);
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
      && normalizedKey !== 'noautopost'
      && (
        normalizedKey === 'executable'
        || normalizedKey.startsWith('will')
        || normalizedKey.startsWith('may')
        || normalizedKey.startsWith('can')
        || normalizedKey.startsWith('called')
        || normalizedKey.includes('api')
        || normalizedKey.includes('deliver')
        || normalizedKey.includes('fetch')
        || normalizedKey.includes('post')
        || normalizedKey.includes('send')
        || normalizedKey.includes('slack')
        || normalizedKey.includes('socket')
        || normalizedKey.includes('storage')
        || normalizedKey.includes('webhook')
      )
    ) {
      return true;
    }
    if (hasExecutableClaim(entry, seen)) return true;
  }
  return false;
}

function hasForbiddenEchoMetadata(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  if (currentKey) {
    const normalizedKey = currentKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (FORBIDDEN_ECHO_KEYS.has(normalizedKey)) return true;
  }
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return true;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => hasForbiddenEchoMetadata(entry, seen));
  return Object.entries(value).some(([key, nested]) => hasForbiddenEchoMetadata(nested, seen, key));
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

function summarizeCredentialReference(
  reference: unknown,
  connectorKind: MessagingConnectorKind,
): MessagingLiveDeliveryOperationsImplementationManifest['credentialReference'] | undefined {
  const validation = validateConnectorCredentialReference(reference);
  if (!validation.ok) return undefined;
  if (validation.reference.providerId !== undefined && validation.reference.providerId !== connectorKind) return undefined;
  if (validation.reference.connectorId !== undefined && validation.reference.connectorId !== 'messaging') return undefined;
  return Object.freeze({
    id: validation.reference.id,
    kind: validation.reference.kind,
    storageOwner: validation.reference.storageOwner,
    providerId: validation.reference.providerId,
    connectorId: validation.reference.connectorId,
    accountId: validation.reference.accountId,
  });
}

function targetProvenanceValid(
  value: unknown,
  connectorKind: MessagingConnectorKind,
  eventScope: MessagingConnectorEventClass,
): MessagingLiveDeliveryTargetProvenance | undefined {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, TARGET_PROVENANCE_KEYS)) return undefined;
  const kind = value.kind;
  if (kind !== 'slack-channel' && kind !== 'webhook-reference') return undefined;
  if (kind === 'slack-channel' && connectorKind !== 'slack') return undefined;
  if (kind === 'webhook-reference' && (connectorKind !== 'generic-webhook' || eventScope !== 'webhook-alert')) {
    return undefined;
  }
  const id = safeIdentifier(value.id);
  if (!id) return undefined;
  const workspaceId = safeIdentifier(value.workspaceId);
  if (value.workspaceId !== undefined && !workspaceId) return undefined;
  if (value.connectorKind !== connectorKind || value.eventScope !== eventScope) return undefined;
  return Object.freeze({
    kind,
    id,
    workspaceId,
    connectorKind,
    eventScope,
  });
}

function credentialReferenceMatches(
  left: MessagingLiveDeliveryOperationsImplementationManifest['credentialReference'],
  right: unknown,
  connectorKind: MessagingConnectorKind,
): boolean {
  const summarized = summarizeCredentialReference(right, connectorKind);
  if (!left || !summarized) return false;
  return left.id === summarized.id
    && left.kind === summarized.kind
    && left.storageOwner === summarized.storageOwner
    && left.providerId === summarized.providerId
    && left.connectorId === summarized.connectorId
    && left.accountId === summarized.accountId;
}

function runtimeReadinessValid(
  runtime: MessagingRuntimeReadinessDecision | undefined,
  connectorKind: MessagingConnectorKind,
  eventScope: MessagingConnectorEventClass,
  credentialReference: MessagingLiveDeliveryOperationsImplementationManifest['credentialReference'],
): boolean {
  return isRecord(runtime)
    && (runtime.status === 'explicit-user-test-ready' || runtime.status === 'no-auto-post-safe')
    && (runtime.reason === 'explicit_user_test_ready' || runtime.reason === 'no_auto_post_safe')
    && runtime.connectorKind === connectorKind
    && runtime.eventScope === eventScope
    && runtime.noAutoPost === true
    && runtime.sideEffectBoundary === 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send'
    && credentialReferenceMatches(credentialReference, runtime.credentialReference, connectorKind);
}

function gateDecisionValid(
  decision: MessagingExecutionGateDecision,
  operation: MessagingLiveDeliveryOperation,
  eventScope: MessagingConnectorEventClass,
): boolean {
  const action = EXPECTED_ACTION_BY_OPERATION[operation];
 if (
    !isRecord(decision)
    || !hasOnlyAllowedKeys(decision, GATE_DECISION_KEYS)
    || decision.action !== action
    || decision.inert !== true
    || decision.executesProviderCall !== false
    || decision.noAutoPost !== true
    || decision.eventScope !== eventScope
    || (decision.runtimeStatus !== 'explicit-user-test-ready' && decision.runtimeStatus !== 'no-auto-post-safe')
    || (decision.runtimeReason !== 'explicit_user_test_ready' && decision.runtimeReason !== 'no_auto_post_safe')
    || decision.sideEffectBoundary !== 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send'
  ) {
    return false;
  }
  if (operation === 'dry_run_notification') {
    return decision.decision === 'allow' && decision.reason === 'dry_run_notification_allowed';
  }
  return decision.decision === 'block' && decision.reason === 'live_delivery_disabled_by_no_auto_post_contract';
}

function operationPlanValid(
  plan: readonly MessagingLiveDeliveryOperationPlan[],
  eventScope: MessagingConnectorEventClass,
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
      && gateDecisionValid(entry.gateDecision, operation, eventScope);
  });
}

function freezeManifest(
  input?: MessagingLiveDeliveryOperationsImplementationManifestInput,
  ready = false,
): MessagingLiveDeliveryOperationsImplementationManifest {
  const connectorKind = ready && isMessagingConnectorKind(input?.connectorKind) ? input.connectorKind : undefined;
  const eventScope = ready && isMessagingEventScope(input?.eventScope) ? input.eventScope : undefined;
  const credentialReference = ready && connectorKind
    ? summarizeCredentialReference(input?.credentialReference, connectorKind)
    : undefined;
  const target = ready && connectorKind && eventScope
    ? targetProvenanceValid(input?.target, connectorKind, eventScope)
    : undefined;
  return Object.freeze({
    schemaVersion: 1,
    contract: 'messaging-live-delivery-operations-implementation-manifest-v1',
    manifestOwner: 'assistantcaddy-head-chat-messaging-live-delivery',
    manifestId: 'assistantcaddy-head-chat-messaging-live-delivery-manifest',
    manifestVersion: '2026.06.12',
    integrationOwner: 'head-chat',
    integrationScope: 'messaging-live-delivery-implementation',
    connectorKind,
    eventScope,
    credentialReference,
    target,
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
  reason: MessagingLiveDeliveryOperationsImplementationManifestReason,
  input?: MessagingLiveDeliveryOperationsImplementationManifestInput,
): Readonly<MessagingLiveDeliveryOperationsImplementationManifestDecision> {
  const ready = reason === 'implementation_manifest_ready';
  return Object.freeze({
    status: ready ? 'implementation-manifest-ready' : 'blocked',
    manifestReady: ready,
    reason,
    manifest: freezeManifest(input, ready),
    canPrepareHeadChatMessagingLiveDeliveryImplementation: ready,
    readyForMessagingLiveDeliveryImplementation: false,
    mayImportSlackSdk: false,
    mayCallSlackApi: false,
    mayCallWebhook: false,
    mayFetch: false,
    mayOpenSocket: false,
    mayStoreCredential: false,
    mayPostMessage: false,
    mayPostThreadReply: false,
    mayDeliverWebhook: false,
    mayModifySchema: false,
    mayExportOrBackup: false,
    willPromoteStandalone: false,
    sideEffects: 'none',
    sideEffectBoundary:
      'messaging-live-delivery-implementation-manifest-no-slack-api-no-webhook-no-network-no-storage-no-send',
  });
}

export function evaluateMessagingLiveDeliveryOperationsImplementationManifest(
  input: MessagingLiveDeliveryOperationsImplementationManifestInput = {},
): Readonly<MessagingLiveDeliveryOperationsImplementationManifestDecision> {
  if (!isRuntimeTrustedContractObject(input)) return freezeDecision('input_untrusted');

  const executableClaim = hasExecutableClaim(input);
  if (
    hasMessagingSecretMaterial(input)
    || hasConnectorSecretMaterial(input)
    || executableClaim
    || hasForbiddenEchoMetadata(input)
  ) {
    return freezeDecision(executableClaim ? 'forged_executable_claim' : 'raw_secret_material');
  }

  const connectorKind = input.connectorKind;
  const eventScope = input.eventScope;
  if (!isMessagingConnectorKind(connectorKind) || !isMessagingEventScope(eventScope)) {
    return freezeDecision('runtime_provenance_invalid');
  }

  const credentialReference = summarizeCredentialReference(input.credentialReference, connectorKind);
  if (!credentialReference) return freezeDecision('credential_owner_invalid');

  if (!runtimeReadinessValid(input.runtimeReadiness, connectorKind, eventScope, credentialReference)) {
    return freezeDecision('runtime_provenance_invalid');
  }

  if (!targetProvenanceValid(input.target, connectorKind, eventScope)) {
    return freezeDecision('target_provenance_invalid');
  }

  if (!input.operationPlan || !Array.isArray(input.operationPlan)) return freezeDecision('operation_plan_missing');
  if (!operationPlanValid(input.operationPlan, eventScope)) {
    const observedOrder = input.operationPlan
      .map((entry) => isRecord(entry) ? entry.operation : undefined)
      .filter((operation): operation is MessagingLiveDeliveryOperation => typeof operation === 'string');
    if (!sameStringList(observedOrder, EXPECTED_OPERATION_ORDER)) return freezeDecision('operation_order_invalid');
    return freezeDecision('operation_plan_invalid');
  }

  if (!writeSetIsExact(input.futureWriteSet)) return freezeDecision('future_write_set_invalid');

  return freezeDecision('implementation_manifest_ready', input);
}
