import { hasConnectorSecretMaterial } from './connector-credential-boundary';
import {
  evaluateMessagingExecutionGate,
  type MessagingExecutionAction,
  type MessagingExecutionGateDecision,
  type MessagingExecutionGateInput,
  type MessagingExecutionGateReason,
} from './messaging-execution-gate';
import {
  evaluateMessagingRuntimeReadiness,
  type MessagingRuntimeReadinessDecision,
} from './messaging-runtime-readiness';
import {
  hasMessagingSecretMaterial,
  type MessagingConnectorEventClass,
  type MessagingConnectorKind,
} from './messaging-connector-policy';
import type { MessagingDeliveryTargetKind } from './messaging-delivery-adapter-plan';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type MessagingRuntimeExecutionStatus = 'executed' | 'blocked';

export type MessagingRuntimeExecutionReason =
  | 'executed'
  | 'gate_blocked'
  | 'gate_decision_invalid'
  | 'gate_decision_missing_context'
  | 'raw_secret_material'
  | 'unsafe_runtime_shape'
  | 'missing_runtime_context'
  | 'runtime_not_ready'
  | 'runtime_activation_plan_missing'
  | 'runtime_activation_plan_invalid'
  | 'runtime_activation_plan_mismatch'
  | 'connector_kind_mismatch'
  | 'event_scope_mismatch'
  | 'credential_reference_mismatch'
  | 'credential_ownership_mismatch'
  | 'missing_adapter'
  | 'adapter_execution_not_enabled'
  | 'adapter_shape_invalid'
  | 'missing_adapter_action'
  | 'adapter_result_invalid'
  | 'adapter_result_ownership_mismatch'
  | 'adapter_result_live_claim'
  | 'adapter_failed'
  | 'live_delivery_disabled_by_no_auto_post_contract';

export interface MessagingRuntimeCredentialExpectation {
  id?: string;
  kind?: string;
  storageOwner?: string;
  providerId?: string;
  connectorId?: string;
  accountId?: string;
}

export interface MessagingRuntimeExecutionExpectation {
  connectorKind?: MessagingConnectorKind;
  eventScope?: MessagingConnectorEventClass;
  credentialReference?: MessagingRuntimeCredentialExpectation;
}

export interface MessagingRuntimeExecutionAdapter {
  adapterCallableBoundary?: 'source-gated-no-callable-adapter-facade';
  adapterKind?: 'fake-local-test-delivery-adapter';
  adapterId?: string;
  runtimeOwner?: string;
  adapterImplementationId?: string;
  adapterVersion?: string;
  deliveryMode?: 'fake-local-test-only';
  resultMode?: 'metadata-only';
  sideEffects?: 'none';
  sideEffectBoundary?: 'adapter-injected-no-fetch-no-sdk-no-webhook-no-storage-by-facade';
}

export interface MessagingRuntimeExecutorInput {
  gateInput?: MessagingExecutionGateInput;
  gateDecision?: MessagingExecutionGateDecision;
  runtimeActivationPlan?: unknown;
  adapter?: MessagingRuntimeExecutionAdapter;
  expectation?: MessagingRuntimeExecutionExpectation;
  payload?: unknown;
  now?: number;
}

export interface MessagingRuntimeExecutionResult {
  status: MessagingRuntimeExecutionStatus;
  reason: MessagingRuntimeExecutionReason;
  action: MessagingExecutionAction | 'unsupported';
  gateReason?: MessagingExecutionGateReason;
  connectorKind?: MessagingConnectorKind;
  eventScope?: MessagingConnectorEventClass;
  target?: {
    kind: 'workspace-channel' | 'direct-message' | 'thread-reply' | 'webhook-reference';
    runtimeTargetKind: MessagingDeliveryTargetKind;
    redaction: 'target-id-omitted';
    workspaceId?: string;
  };
  credentialReference?: {
    id: string;
    kind: string;
    storageOwner?: string;
    providerId?: string;
    connectorId?: string;
    accountId?: string;
  };
  adapterRunId?: string;
  safeDetails?: Record<string, unknown>;
  sideEffectBoundary: 'adapter-injected-no-fetch-no-sdk-no-webhook-no-storage-by-facade';
}

const LIVE_DELIVERY_ACTIONS: readonly MessagingExecutionAction[] = [
  'post-message',
  'post-thread-reply',
  'webhook-delivery',
];
const FAKE_LOCAL_TEST_ADAPTER_BOUNDARY =
  'adapter-injected-no-fetch-no-sdk-no-webhook-no-storage-by-facade' as const;
const ALLOWED_ADAPTER_KEYS = [
  'adapterCallableBoundary',
  'adapterId',
  'adapterImplementationId',
  'adapterKind',
  'adapterVersion',
  'deliveryMode',
  'resultMode',
  'runtimeOwner',
  'sideEffectBoundary',
  'sideEffects',
] as const;
const SOURCE_GATED_CALLABLE_ADAPTER_KEYS = [
  'disableConnector',
  'dryRunNotification',
  'revokeCredentialReference',
] as const;
const ALLOWED_EXECUTOR_INPUT_KEYS = [
  'adapter',
  'expectation',
  'gateDecision',
  'gateInput',
  'now',
  'payload',
  'runtimeActivationPlan',
] as const;
const ALLOWED_GATE_DECISION_KEYS = [
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
] as const;
const RUNTIME_PLAN_DECISION_KEYS = new Set([
  'canPrepareFutureSlackRuntimeActivation',
  'executable',
  'plan',
  'ready',
  'reason',
  'requiresExplicitSendApproval',
  'sideEffectBoundary',
  'sideEffects',
  'status',
  'willCallSlackApi',
  'willCallWebhook',
  'willFetch',
  'willMutateStorage',
  'willOpenSocket',
  'willPostMessage',
  'willPostThreadReply',
  'willStoreCredential',
]);
const RUNTIME_PLAN_KEYS = new Set([
  'actionIntent',
  'connectorKind',
  'consentWindow',
  'contract',
  'credentialReference',
  'executable',
  'messageClass',
  'noAutoPost',
  'notificationOnly',
  'notificationScope',
  'requiresExplicitSendApproval',
  'requiresUserApprovalBeforePost',
  'reviewedConsent',
  'reviewedDeliveryIntent',
  'reviewedNoisePolicy',
  'reviewedTarget',
  'runtimeBinding',
  'sideEffectBoundary',
  'sideEffects',
  'target',
  'workspaceId',
]);
const RUNTIME_PLAN_TARGET_KEYS = new Set(['id', 'kind', 'label', 'runtimeTargetKind', 'threadRootId']);
const RUNTIME_PLAN_CREDENTIAL_KEYS = new Set([
  'accountId',
  'connectorId',
  'id',
  'kind',
  'providerId',
  'storageOwner',
]);
const RUNTIME_PLAN_CONSENT_KEYS = new Set(['expiresAt', 'issuedAt']);
const RUNTIME_PLAN_BINDING_KEYS = new Set([
  'adapterId',
  'adapterImplementationId',
  'adapterVersion',
  'invocationMode',
  'runtimeOwner',
  'runtimePlanExpiresAt',
  'sourceAction',
  'targetRedaction',
]);
const RUNTIME_PLAN_DECISION_BOUNDARY =
  'slack-runtime-activation-plan-binding-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send' as const;
const RUNTIME_PLAN_BOUNDARY =
  'slack-runtime-activation-plan-only-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send' as const;
const MAX_SAFE_DETAIL_STRING = 160;
const SAFE_RUNTIME_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{2,180}$/;
const UNSAFE_DETAIL_TEXT_PATTERN =
  /(?:https?:\/\/|wss?:\/\/|hooks\.slack(?:-gov)?\.com\/services\/|bearer\s+[a-z0-9._~+/=-]{8,}|(?:api|app|bot|client|refresh|access)[_-]?(?:key|token|secret)[=:]\s*\S+)/i;
const FORBIDDEN_RUNTIME_KEY_MARKERS = [
  'adaptercallable',
  'adaptermetadata',
  'adapterresult',
  'calledwebhook',
  'callback',
  'callbackurl',
  'delivered',
  'deliveryresult',
  'executable',
  'fetch',
  'httpclient',
  'indexeddb',
  'liveaction',
  'liveexecution',
  'localstorage',
  'mutatestorage',
  'onresult',
  'posted',
  'postmessage',
  'readstorage',
  'requester',
  'requesterresult',
  'sessionstorage',
  'sent',
  'socket',
  'storageadapter',
  'storageresult',
  'storedcredential',
  'transport',
  'webhookurl',
  'willcallslackapi',
  'willcallwebhook',
  'willfetch',
  'willinvokeadapter',
  'willmutatestorage',
  'willopensocket',
  'willpostmessage',
  'willpostthreadreply',
  'willstorecredential',
  'writestorage',
  'xmlhttprequest',
] as const;
const FORBIDDEN_RUNTIME_EXACT_KEYS = new Set([
  'sent',
]);
interface ParsedRuntimeActivationPlan {
  connectorKind: MessagingConnectorKind;
  eventScope: MessagingConnectorEventClass;
  actionIntent: 'post-message' | 'post-thread-reply' | 'webhook-delivery';
  target: {
    kind: 'workspace-channel' | 'direct-message' | 'thread-reply' | 'webhook-reference';
    runtimeTargetKind: MessagingDeliveryTargetKind;
    id: string;
    redaction: 'target-id-omitted';
    workspaceId?: string;
    threadRootId?: string;
  };
  credentialReference: {
    id: string;
    kind: string;
    storageOwner: string;
    providerId?: string;
    connectorId?: string;
    accountId?: string;
  };
  consentWindow: {
    issuedAt: number;
    expiresAt: number;
  };
  runtimeBinding: {
    adapterId: string;
    runtimeOwner: string;
    adapterImplementationId: string;
    adapterVersion: string;
    runtimePlanExpiresAt: number;
  };
}

interface ParsedFakeLocalTestAdapter {
  adapterId: string;
  runtimeOwner: string;
  adapterImplementationId: string;
  adapterVersion: string;
}

function baseResult(
  reason: MessagingRuntimeExecutionReason,
  gate: MessagingExecutionGateDecision,
  runtime?: MessagingRuntimeReadinessDecision,
  extra: Partial<MessagingRuntimeExecutionResult> = {},
): MessagingRuntimeExecutionResult {
  const result: MessagingRuntimeExecutionResult = {
    status: reason === 'executed' ? 'executed' : 'blocked',
    reason,
    action: gate.action,
    gateReason: gate.reason,
    connectorKind: runtime?.connectorKind,
    eventScope: runtime?.eventScope ?? gate.eventScope,
    credentialReference: summarizeCredentialReference(runtime?.credentialReference),
    sideEffectBoundary: 'adapter-injected-no-fetch-no-sdk-no-webhook-no-storage-by-facade',
    ...extra,
  };
  if (result.credentialReference) Object.freeze(result.credentialReference);
  if (result.target) Object.freeze(result.target);
  if (result.safeDetails) Object.freeze(result.safeDetails);
  return Object.freeze(result);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isExecutorRootRecord(value: unknown): value is Record<string, unknown> {
  return isRuntimeTrustedContractObject(value);
}

function hasOnlyKeys<T extends readonly string[]>(value: Record<string, unknown>, allowedKeys: T): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function hasOnlyKeySet(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function rootHasUnsafeRuntimeField(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => (
    !ALLOWED_EXECUTOR_INPUT_KEYS.includes(key as (typeof ALLOWED_EXECUTOR_INPUT_KEYS)[number])
    && keyHasForbiddenRuntimeMarker(key)
  ));
}

function rootHasAccessorDescriptor(value: Record<string, unknown>): boolean {
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return true;
  }
  return Object.values(descriptors).some((descriptor) => (
    !('value' in descriptor)
    || descriptor.get !== undefined
    || descriptor.set !== undefined
  ));
}

function valueHasUnsafeDescriptor(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => valueHasUnsafeDescriptor(entry, seen));
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return true;
  }
  return Object.values(descriptors).some((descriptor) => (
    !('value' in descriptor)
    || descriptor.get !== undefined
    || descriptor.set !== undefined
    || valueHasUnsafeDescriptor(descriptor.value, seen)
  ));
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function keyHasForbiddenRuntimeMarker(key: string): boolean {
  const normalized = normalizedKey(key);
  if (FORBIDDEN_RUNTIME_EXACT_KEYS.has(normalized)) return true;
  return FORBIDDEN_RUNTIME_KEY_MARKERS.some((marker) => (
    !FORBIDDEN_RUNTIME_EXACT_KEYS.has(marker)
    && (normalized === marker || normalized.includes(marker))
  ));
}

function hasUnsafeRuntimeShape(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => hasUnsafeRuntimeShape(entry, seen));
  if (value instanceof Map) {
    for (const [key, nested] of value.entries()) {
      if (typeof key === 'string' && keyHasForbiddenRuntimeMarker(key)) return true;
      if (hasUnsafeRuntimeShape(key, seen) || hasUnsafeRuntimeShape(nested, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nested of value.values()) {
      if (hasUnsafeRuntimeShape(nested, seen)) return true;
    }
    return false;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (keyHasForbiddenRuntimeMarker(key)) return true;
    if (hasUnsafeRuntimeShape(nested, seen)) return true;
  }
  return false;
}

function safeRuntimeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || !SAFE_RUNTIME_ID_PATTERN.test(trimmed)) return undefined;
  if (
    UNSAFE_DETAIL_TEXT_PATTERN.test(trimmed)
    || hasMessagingSecretMaterial({ id: trimmed })
    || hasConnectorSecretMaterial({ id: trimmed })
  ) {
    return undefined;
  }
  return trimmed;
}

function safeRuntimeLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_SAFE_DETAIL_STRING || UNSAFE_DETAIL_TEXT_PATTERN.test(trimmed)) return undefined;
  if (hasMessagingSecretMaterial({ label: trimmed }) || hasConnectorSecretMaterial({ label: trimmed })) {
    return undefined;
  }
  return trimmed;
}

function safeRuntimeTimestamp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function safeRuntimeTargetKind(value: unknown): MessagingDeliveryTargetKind | undefined {
  switch (value) {
    case 'slack-channel':
    case 'slack-dm':
    case 'slack-thread':
    case 'webhook-handle':
      return value;
    default:
      return undefined;
  }
}

function safeRuntimeEventScope(value: unknown): MessagingConnectorEventClass | undefined {
  switch (value) {
    case 'direct-mention':
    case 'one-to-one-dm':
    case 'group-dm':
    case 'thread-reply-after-user-post':
    case 'channel-follow-up':
    case 'webhook-alert':
      return value;
    default:
      return undefined;
  }
}

function safeRuntimeConnectorKind(value: unknown): MessagingConnectorKind | undefined {
  return value === 'slack' || value === 'generic-webhook' ? value : undefined;
}

function targetMatchesActionIntent(
  targetKind: ParsedRuntimeActivationPlan['target']['kind'],
  runtimeTargetKind: MessagingDeliveryTargetKind,
  eventScope: MessagingConnectorEventClass,
  actionIntent: ParsedRuntimeActivationPlan['actionIntent'],
): boolean {
  if (actionIntent === 'post-message') {
    return (
      (targetKind === 'workspace-channel' && runtimeTargetKind === 'slack-channel' && eventScope === 'channel-follow-up')
      || (targetKind === 'direct-message'
        && runtimeTargetKind === 'slack-dm'
        && (eventScope === 'one-to-one-dm' || eventScope === 'group-dm'))
    );
  }
  if (actionIntent === 'post-thread-reply') {
    return targetKind === 'thread-reply'
      && runtimeTargetKind === 'slack-thread'
      && eventScope === 'thread-reply-after-user-post';
  }
  return targetKind === 'webhook-reference'
    && runtimeTargetKind === 'webhook-handle'
    && eventScope === 'webhook-alert';
}

function runtimeCredentialField(
  reference: NonNullable<MessagingRuntimeReadinessDecision['credentialReference']>,
  field: 'storageOwner' | 'providerId' | 'connectorId' | 'accountId',
): string | undefined {
  if (field === 'storageOwner') {
    return 'storageOwner' in reference && typeof reference.storageOwner === 'string'
      ? reference.storageOwner
      : undefined;
  }
  if (field === 'providerId') {
    return 'providerId' in reference && typeof reference.providerId === 'string'
      ? reference.providerId
      : undefined;
  }
  if (field === 'connectorId') {
    return 'connectorId' in reference && typeof reference.connectorId === 'string'
      ? reference.connectorId
      : undefined;
  }
  return 'accountId' in reference && typeof reference.accountId === 'string'
    ? reference.accountId
    : undefined;
}

function parseRuntimeActivationPlan(value: unknown, now: unknown):
  | { ok: true; plan: ParsedRuntimeActivationPlan }
  | { ok: false; reason: 'missing' | 'invalid' } {
  if (value === undefined || value === null) return { ok: false, reason: 'missing' };
  if (!isRecord(value) || !hasOnlyKeySet(value, RUNTIME_PLAN_DECISION_KEYS)) return { ok: false, reason: 'invalid' };
  if (
    value.status !== 'ready'
    || value.ready !== true
    || value.reason !== 'slack_runtime_activation_plan_ready'
    || value.canPrepareFutureSlackRuntimeActivation !== true
    || value.executable !== false
    || value.sideEffects !== 'none'
    || value.requiresExplicitSendApproval !== true
    || value.willCallSlackApi !== false
    || value.willCallWebhook !== false
    || value.willFetch !== false
    || value.willOpenSocket !== false
    || value.willMutateStorage !== false
    || value.willStoreCredential !== false
    || value.willPostMessage !== false
    || value.willPostThreadReply !== false
    || value.sideEffectBoundary !== RUNTIME_PLAN_DECISION_BOUNDARY
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const plan = value.plan;
  if (!isRecord(plan) || !hasOnlyKeySet(plan, RUNTIME_PLAN_KEYS)) return { ok: false, reason: 'invalid' };
  if (
    plan.contract !== 'slack-runtime-activation-plan-v1'
    || plan.reviewedTarget !== true
    || plan.reviewedConsent !== true
    || plan.reviewedNoisePolicy !== true
    || plan.reviewedDeliveryIntent !== true
    || plan.noAutoPost !== true
    || plan.notificationOnly !== true
    || plan.requiresUserApprovalBeforePost !== true
    || plan.requiresExplicitSendApproval !== true
    || plan.executable !== false
    || plan.sideEffects !== 'none'
    || plan.sideEffectBoundary !== RUNTIME_PLAN_BOUNDARY
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const connectorKind = safeRuntimeConnectorKind(plan.connectorKind);
  const eventScope = safeRuntimeEventScope(plan.notificationScope);
  const actionIntent = plan.actionIntent;
  if (
    !connectorKind
    || !eventScope
    || (actionIntent !== 'post-message' && actionIntent !== 'post-thread-reply' && actionIntent !== 'webhook-delivery')
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const target = plan.target;
  const credentialReference = plan.credentialReference;
  const consentWindow = plan.consentWindow;
  const runtimeBinding = plan.runtimeBinding;
  if (
    !isRecord(target)
    || !isRecord(credentialReference)
    || !isRecord(consentWindow)
    || !isRecord(runtimeBinding)
    || !hasOnlyKeySet(target, RUNTIME_PLAN_TARGET_KEYS)
    || !hasOnlyKeySet(credentialReference, RUNTIME_PLAN_CREDENTIAL_KEYS)
    || !hasOnlyKeySet(consentWindow, RUNTIME_PLAN_CONSENT_KEYS)
    || !hasOnlyKeySet(runtimeBinding, RUNTIME_PLAN_BINDING_KEYS)
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const workspaceId = safeRuntimeIdentifier(plan.workspaceId);
  if (plan.workspaceId !== undefined && !workspaceId) return { ok: false, reason: 'invalid' };
  const targetKind = target.kind;
  if (
    targetKind !== 'workspace-channel'
    && targetKind !== 'direct-message'
    && targetKind !== 'thread-reply'
    && targetKind !== 'webhook-reference'
  ) {
    return { ok: false, reason: 'invalid' };
  }
  const runtimeTargetKind = safeRuntimeTargetKind(target.runtimeTargetKind);
  const targetId = safeRuntimeIdentifier(target.id);
  const targetLabel = safeRuntimeLabel(target.label);
  const threadRootId = safeRuntimeIdentifier(target.threadRootId);
  if (!runtimeTargetKind || !targetId || !targetLabel) return { ok: false, reason: 'invalid' };
  if (target.kind === 'thread-reply' && !threadRootId) return { ok: false, reason: 'invalid' };
  if (target.kind !== 'thread-reply' && target.threadRootId !== undefined) return { ok: false, reason: 'invalid' };
  if (!targetMatchesActionIntent(targetKind, runtimeTargetKind, eventScope, actionIntent)) {
    return { ok: false, reason: 'invalid' };
  }

  const credentialId = safeRuntimeIdentifier(credentialReference.id);
  const credentialKind = safeRuntimeIdentifier(credentialReference.kind);
  const credentialStorageOwner = safeRuntimeIdentifier(credentialReference.storageOwner);
  const providerId = safeRuntimeIdentifier(credentialReference.providerId);
  const connectorId = safeRuntimeIdentifier(credentialReference.connectorId);
  const accountId = safeRuntimeIdentifier(credentialReference.accountId);
  if (
    !credentialId
    || !credentialKind
    || !credentialStorageOwner
    || (credentialReference.providerId !== undefined && !providerId)
    || (credentialReference.connectorId !== undefined && !connectorId)
    || (credentialReference.accountId !== undefined && !accountId)
  ) {
    return { ok: false, reason: 'invalid' };
  }
  if (connectorKind === 'slack') {
    if (!workspaceId || targetKind === 'webhook-reference' || providerId !== 'slack' || accountId !== workspaceId) {
      return { ok: false, reason: 'invalid' };
    }
  } else if (workspaceId || targetKind !== 'webhook-reference' || providerId !== 'generic-webhook') {
    return { ok: false, reason: 'invalid' };
  }

  const issuedAt = safeRuntimeTimestamp(consentWindow.issuedAt);
  const expiresAt = safeRuntimeTimestamp(consentWindow.expiresAt);
  const runtimePlanExpiresAt = safeRuntimeTimestamp(runtimeBinding.runtimePlanExpiresAt);
  if (
    issuedAt === undefined
    || expiresAt === undefined
    || runtimePlanExpiresAt === undefined
    || issuedAt >= expiresAt
  ) {
    return { ok: false, reason: 'invalid' };
  }
  const checkedNow = safeRuntimeTimestamp(now);
  if (now !== undefined && (checkedNow === undefined || checkedNow < issuedAt || checkedNow >= expiresAt || checkedNow >= runtimePlanExpiresAt)) {
    return { ok: false, reason: 'invalid' };
  }

  const adapterId = safeRuntimeIdentifier(runtimeBinding.adapterId);
  const runtimeOwner = safeRuntimeIdentifier(runtimeBinding.runtimeOwner);
  const adapterImplementationId = safeRuntimeIdentifier(runtimeBinding.adapterImplementationId);
  const adapterVersion = safeRuntimeIdentifier(runtimeBinding.adapterVersion);
  if (
    runtimeBinding.sourceAction !== 'dry-run-notification'
    || runtimeBinding.invocationMode !== 'decision-only'
    || runtimeBinding.targetRedaction !== 'target-id-omitted'
    || !adapterId
    || !runtimeOwner
    || !adapterImplementationId
    || !adapterVersion
  ) {
    return { ok: false, reason: 'invalid' };
  }

  return {
    ok: true,
    plan: {
      connectorKind,
      eventScope,
      actionIntent,
      target: {
        kind: targetKind,
        runtimeTargetKind,
        id: targetId,
        redaction: 'target-id-omitted',
        ...(workspaceId ? { workspaceId } : {}),
        ...(threadRootId ? { threadRootId } : {}),
      },
      credentialReference: {
        id: credentialId,
        kind: credentialKind,
        storageOwner: credentialStorageOwner,
        ...(providerId ? { providerId } : {}),
        ...(connectorId ? { connectorId } : {}),
        ...(accountId ? { accountId } : {}),
      },
      consentWindow: { issuedAt, expiresAt },
      runtimeBinding: {
        adapterId,
        runtimeOwner,
        adapterImplementationId,
        adapterVersion,
        runtimePlanExpiresAt,
      },
    },
  };
}

function runtimeActivationPlanMatchesRuntime(
  plan: ParsedRuntimeActivationPlan,
  runtime: MessagingRuntimeReadinessDecision,
): boolean {
  const credential = runtime.credentialReference;
  return runtime.connectorKind === plan.connectorKind
    && runtime.eventScope === plan.eventScope
    && !!credential
    && credential.id === plan.credentialReference.id
    && credential.kind === plan.credentialReference.kind
    && runtimeCredentialField(credential, 'storageOwner') === plan.credentialReference.storageOwner
    && runtimeCredentialField(credential, 'providerId') === plan.credentialReference.providerId
    && runtimeCredentialField(credential, 'connectorId') === plan.credentialReference.connectorId
    && runtimeCredentialField(credential, 'accountId') === plan.credentialReference.accountId;
}

function summarizeRuntimeTarget(
  plan: ParsedRuntimeActivationPlan,
): NonNullable<MessagingRuntimeExecutionResult['target']> {
  return Object.freeze({
    kind: plan.target.kind,
    runtimeTargetKind: plan.target.runtimeTargetKind,
    redaction: 'target-id-omitted' as const,
    ...(plan.target.workspaceId ? { workspaceId: plan.target.workspaceId } : {}),
  });
}

function adapterShapeIsExact(adapter: unknown): adapter is MessagingRuntimeExecutionAdapter {
  if (!isRecord(adapter)) return false;
  return Object.keys(adapter).every((key) => ALLOWED_ADAPTER_KEYS.includes(key as (typeof ALLOWED_ADAPTER_KEYS)[number]))
    && (
      adapter.adapterCallableBoundary === undefined
      || adapter.adapterCallableBoundary === 'source-gated-no-callable-adapter-facade'
    )
    && (
      adapter.adapterKind === undefined
      || adapter.adapterKind === 'fake-local-test-delivery-adapter'
    )
    && (
      adapter.deliveryMode === undefined
      || adapter.deliveryMode === 'fake-local-test-only'
    )
    && (
      adapter.resultMode === undefined
      || adapter.resultMode === 'metadata-only'
    )
    && (
      adapter.sideEffects === undefined
      || adapter.sideEffects === 'none'
    )
    && (
      adapter.sideEffectBoundary === undefined
      || adapter.sideEffectBoundary === FAKE_LOCAL_TEST_ADAPTER_BOUNDARY
    );
}

function parseFakeLocalTestAdapter(
  adapter: MessagingRuntimeExecutionAdapter,
  plan: ParsedRuntimeActivationPlan,
): ParsedFakeLocalTestAdapter | undefined {
  if (
    adapter.adapterKind !== 'fake-local-test-delivery-adapter'
    || adapter.deliveryMode !== 'fake-local-test-only'
    || adapter.resultMode !== 'metadata-only'
    || adapter.sideEffects !== 'none'
    || adapter.sideEffectBoundary !== FAKE_LOCAL_TEST_ADAPTER_BOUNDARY
  ) {
    return undefined;
  }
  const adapterId = safeRuntimeIdentifier(adapter.adapterId);
  const runtimeOwner = safeRuntimeIdentifier(adapter.runtimeOwner);
  const adapterImplementationId = safeRuntimeIdentifier(adapter.adapterImplementationId);
  const adapterVersion = safeRuntimeIdentifier(adapter.adapterVersion);
  if (!adapterId || !runtimeOwner || !adapterImplementationId || !adapterVersion) return undefined;
  if (
    adapterId !== plan.runtimeBinding.adapterId
    || runtimeOwner !== plan.runtimeBinding.runtimeOwner
    || adapterImplementationId !== plan.runtimeBinding.adapterImplementationId
    || adapterVersion !== plan.runtimeBinding.adapterVersion
  ) {
    return undefined;
  }
  return Object.freeze({
    adapterId,
    runtimeOwner,
    adapterImplementationId,
    adapterVersion,
  });
}

function adapterHasSourceGatedCallableShape(adapter: unknown): boolean {
  if (!isRecord(adapter)) return false;
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(adapter);
  } catch {
    return false;
  }
  const keys = Object.keys(descriptors);
  return keys.length > 0
    && keys.every((key) => SOURCE_GATED_CALLABLE_ADAPTER_KEYS.includes(key as (typeof SOURCE_GATED_CALLABLE_ADAPTER_KEYS)[number]))
    && keys.some((key) => typeof descriptors[key]?.value === 'function')
    && keys.every((key) => {
      const value = descriptors[key]?.value;
      return value === undefined || typeof value === 'function';
    });
}

function adapterHasAccessorDescriptor(adapter: unknown): boolean {
  if (typeof adapter !== 'object' || adapter === null || Array.isArray(adapter)) return true;
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(adapter);
  } catch {
    return true;
  }
  return Object.values(descriptors).some((descriptor) => (
    !('value' in descriptor)
    || descriptor.get !== undefined
    || descriptor.set !== undefined
  ));
}

function gateDecisionMatchesComputed(
  supplied: MessagingExecutionGateDecision,
  computed: MessagingExecutionGateDecision,
): boolean {
  if (!isRecord(supplied) || !hasOnlyKeys(supplied, ALLOWED_GATE_DECISION_KEYS)) return false;
  return supplied.decision === computed.decision
    && supplied.action === computed.action
    && supplied.reason === computed.reason
    && supplied.inert === true
    && supplied.executesProviderCall === false
    && supplied.noAutoPost === true
    && supplied.runtimeStatus === computed.runtimeStatus
    && supplied.runtimeReason === computed.runtimeReason
    && supplied.eventScope === computed.eventScope
    && supplied.sideEffectBoundary === computed.sideEffectBoundary;
}

function summarizeCredentialReference(reference: MessagingRuntimeReadinessDecision['credentialReference']):
  | MessagingRuntimeExecutionResult['credentialReference']
  | undefined {
  if (!reference) return undefined;
  const summary: NonNullable<MessagingRuntimeExecutionResult['credentialReference']> = {
    id: reference.id,
    kind: reference.kind,
  };
  if ('storageOwner' in reference && reference.storageOwner) summary.storageOwner = reference.storageOwner;
  if ('providerId' in reference && reference.providerId) summary.providerId = reference.providerId;
  if ('connectorId' in reference && reference.connectorId) summary.connectorId = reference.connectorId;
  if ('accountId' in reference && reference.accountId) summary.accountId = reference.accountId;
  return summary;
}

function credentialMatchesExpectation(
  actual: MessagingRuntimeReadinessDecision['credentialReference'],
  expected: MessagingRuntimeCredentialExpectation | undefined,
): 'ok' | 'reference-mismatch' | 'ownership-mismatch' {
  if (!expected) return 'ok';
  if (!actual) return 'reference-mismatch';
  if (expected.id !== undefined && actual.id !== expected.id) return 'reference-mismatch';
  if (expected.kind !== undefined && actual.kind !== expected.kind) return 'reference-mismatch';
  if (expected.storageOwner !== undefined) {
    if (!('storageOwner' in actual) || actual.storageOwner !== expected.storageOwner) return 'ownership-mismatch';
  }
  if (expected.providerId !== undefined) {
    if (!('providerId' in actual) || actual.providerId !== expected.providerId) return 'ownership-mismatch';
  }
  if (expected.connectorId !== undefined) {
    if (!('connectorId' in actual) || actual.connectorId !== expected.connectorId) return 'ownership-mismatch';
  }
  if (expected.accountId !== undefined) {
    if (!('accountId' in actual) || actual.accountId !== expected.accountId) return 'ownership-mismatch';
  }
  return 'ok';
}

export async function executeMessagingRuntimeAction(
  input: MessagingRuntimeExecutorInput = {},
): Promise<MessagingRuntimeExecutionResult> {
  const fallbackGate = evaluateMessagingExecutionGate();
  if (!isExecutorRootRecord(input)) {
    return baseResult('unsafe_runtime_shape', fallbackGate);
  }
  if (rootHasUnsafeRuntimeField(input)) {
    return baseResult('unsafe_runtime_shape', fallbackGate);
  }
  if (!hasOnlyKeys(input, ALLOWED_EXECUTOR_INPUT_KEYS)) {
    return baseResult('unsafe_runtime_shape', fallbackGate);
  }
  if (rootHasAccessorDescriptor(input)) {
    return baseResult('unsafe_runtime_shape', fallbackGate);
  }

  const safeInput = input as MessagingRuntimeExecutorInput;
  if (
    valueHasUnsafeDescriptor(safeInput.gateInput)
    || valueHasUnsafeDescriptor(safeInput.gateDecision)
    || valueHasUnsafeDescriptor(safeInput.payload)
    || valueHasUnsafeDescriptor(safeInput.expectation)
    || valueHasUnsafeDescriptor(safeInput.runtimeActivationPlan)
  ) {
    return baseResult('unsafe_runtime_shape', fallbackGate);
  }

  if (
    hasMessagingSecretMaterial(safeInput.gateInput)
    || hasConnectorSecretMaterial(safeInput.gateInput)
    || hasMessagingSecretMaterial(safeInput.gateDecision)
    || hasConnectorSecretMaterial(safeInput.gateDecision)
    || hasMessagingSecretMaterial(safeInput.payload)
    || hasConnectorSecretMaterial(safeInput.payload)
    || hasMessagingSecretMaterial(safeInput.expectation)
    || hasConnectorSecretMaterial(safeInput.expectation)
    || hasMessagingSecretMaterial(safeInput.runtimeActivationPlan)
    || hasConnectorSecretMaterial(safeInput.runtimeActivationPlan)
  ) {
    return baseResult('raw_secret_material', fallbackGate);
  }

  if (
    hasUnsafeRuntimeShape(safeInput.payload)
    || hasUnsafeRuntimeShape(safeInput.expectation)
    || hasUnsafeRuntimeShape(safeInput.gateDecision)
    || hasUnsafeRuntimeShape(safeInput.gateInput)
  ) {
    return baseResult('unsafe_runtime_shape', fallbackGate);
  }

  const computedGate = evaluateMessagingExecutionGate(safeInput.gateInput);
  const gate = safeInput.gateInput ? (safeInput.gateDecision ?? computedGate) : computedGate;
  const runtime = safeInput.gateInput?.runtime
    ? evaluateMessagingRuntimeReadiness(safeInput.gateInput.runtime)
    : undefined;

  if (safeInput.gateDecision && !safeInput.gateInput) {
    return baseResult('gate_decision_missing_context', computedGate, runtime);
  }

  if (safeInput.gateDecision) {
    if (
      hasMessagingSecretMaterial(safeInput.gateDecision)
      || hasConnectorSecretMaterial(safeInput.gateDecision)
    ) {
      return baseResult('raw_secret_material', computedGate, runtime);
    }
  }

  if (safeInput.gateDecision && safeInput.gateInput && !gateDecisionMatchesComputed(safeInput.gateDecision, computedGate)) {
    return baseResult('gate_decision_invalid', computedGate, runtime);
  }

  if (gate.decision !== 'allow') {
    return baseResult(
      gate.reason === 'live_delivery_disabled_by_no_auto_post_contract'
        ? 'live_delivery_disabled_by_no_auto_post_contract'
        : 'gate_blocked',
      gate,
      runtime,
    );
  }

  if (gate.action === 'unsupported') {
    return baseResult('gate_blocked', gate, runtime);
  }

  if (LIVE_DELIVERY_ACTIONS.includes(gate.action)) {
    return baseResult('live_delivery_disabled_by_no_auto_post_contract', gate, runtime);
  }

  if (!runtime || !runtime.eventScope || !runtime.credentialReference) {
    return baseResult('missing_runtime_context', gate, runtime);
  }

  if (runtime.status !== 'explicit-user-test-ready' && runtime.status !== 'no-auto-post-safe') {
    return baseResult('runtime_not_ready', gate, runtime);
  }

  if (safeInput.expectation?.connectorKind !== undefined && runtime.connectorKind !== safeInput.expectation.connectorKind) {
    return baseResult('connector_kind_mismatch', gate, runtime);
  }

  if (safeInput.expectation?.eventScope !== undefined && runtime.eventScope !== safeInput.expectation.eventScope) {
    return baseResult('event_scope_mismatch', gate, runtime);
  }

  const credentialMatch = credentialMatchesExpectation(runtime.credentialReference, safeInput.expectation?.credentialReference);
  if (credentialMatch === 'reference-mismatch') {
    return baseResult('credential_reference_mismatch', gate, runtime);
  }
  if (credentialMatch === 'ownership-mismatch') {
    return baseResult('credential_ownership_mismatch', gate, runtime);
  }

  const parsedRuntimePlan = gate.action === 'dry-run-notification'
    ? parseRuntimeActivationPlan(safeInput.runtimeActivationPlan, safeInput.now)
    : undefined;
  if (parsedRuntimePlan && !parsedRuntimePlan.ok) {
    return baseResult(
      parsedRuntimePlan.reason === 'missing' ? 'runtime_activation_plan_missing' : 'runtime_activation_plan_invalid',
      gate,
      runtime,
    );
  }
  const runtimeActivationPlan = parsedRuntimePlan?.ok ? parsedRuntimePlan.plan : undefined;
  if (runtimeActivationPlan && !runtimeActivationPlanMatchesRuntime(runtimeActivationPlan, runtime)) {
    return baseResult('runtime_activation_plan_mismatch', gate, runtime, {
      target: summarizeRuntimeTarget(runtimeActivationPlan),
    });
  }

  if (!safeInput.adapter) {
    return baseResult('missing_adapter', gate, runtime);
  }
  if (adapterHasAccessorDescriptor(safeInput.adapter)) {
    return baseResult('adapter_shape_invalid', gate, runtime);
  }
  if (adapterHasSourceGatedCallableShape(safeInput.adapter)) {
    return baseResult('adapter_execution_not_enabled', gate, runtime, {
      target: runtimeActivationPlan ? summarizeRuntimeTarget(runtimeActivationPlan) : undefined,
    });
  }
  if (!adapterShapeIsExact(safeInput.adapter)) {
    return baseResult('adapter_shape_invalid', gate, runtime);
  }

  if (!runtimeActivationPlan) {
    return baseResult('adapter_execution_not_enabled', gate, runtime);
  }
  const fakeLocalTestAdapter = parseFakeLocalTestAdapter(safeInput.adapter, runtimeActivationPlan);
  if (!fakeLocalTestAdapter || gate.action !== 'dry-run-notification') {
    return baseResult('adapter_execution_not_enabled', gate, runtime, {
      target: runtimeActivationPlan ? summarizeRuntimeTarget(runtimeActivationPlan) : undefined,
    });
  }

  return baseResult('executed', gate, runtime, {
    target: summarizeRuntimeTarget(runtimeActivationPlan),
    adapterRunId: `${fakeLocalTestAdapter.adapterId}.fake-local.${runtimeActivationPlan.consentWindow.issuedAt}`,
    safeDetails: {
      adapterImplementationId: fakeLocalTestAdapter.adapterImplementationId,
      adapterVersion: fakeLocalTestAdapter.adapterVersion,
      deliveryMode: 'fake-local-test-only',
      noLiveDelivery: true,
      payloadEcho: false,
      resultMode: 'metadata-only',
      targetRedaction: 'target-id-omitted',
    },
  });
}
