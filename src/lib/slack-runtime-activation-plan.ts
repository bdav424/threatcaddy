import { hasConnectorSecretMaterial, type ConnectorCredentialReference } from './connector-credential-boundary';
import {
  hasMessagingSecretMaterial,
  type MessagingConnectorEventClass,
  type MessagingConnectorKind,
} from './messaging-connector-policy';
import type { MessagingDeliveryTargetKind } from './messaging-delivery-adapter-plan';
import type { MessagingAdapterInvocationImplementationDecision } from './messaging-adapter-invocation-implementation-boundary';
import type {
  SlackLiveDeliveryActivationGateDecision,
  SlackLiveDeliveryActionIntent,
  SlackLiveDeliveryMessageClass,
  SlackLiveDeliveryTargetKind,
} from './slack-live-delivery-activation-gate';

export type SlackRuntimeActivationPlanStatus = 'ready' | 'blocked';

export type SlackRuntimeActivationPlanReason =
  | 'slack_runtime_activation_plan_ready'
  | 'invalid_root_shape'
  | 'raw_secret_material'
  | 'VENDOR_or_employer_branding_forbidden'
  | 'activation_gate_missing'
  | 'activation_gate_not_ready'
  | 'activation_gate_invalid'
  | 'invocation_boundary_missing'
  | 'invocation_boundary_not_ready'
  | 'invocation_boundary_invalid'
  | 'connector_kind_mismatch'
  | 'event_scope_mismatch'
  | 'credential_reference_mismatch'
  | 'workspace_binding_invalid'
  | 'target_binding_invalid'
  | 'consent_window_invalid'
  | 'requires_explicit_send_approval'
  | 'no_auto_post_required'
  | 'notification_only_required';

export interface SlackRuntimeActivationPlan {
  contract: 'slack-runtime-activation-plan-v1';
  connectorKind: MessagingConnectorKind;
  workspaceId?: string;
  notificationScope: MessagingConnectorEventClass;
  messageClass: SlackLiveDeliveryMessageClass;
  actionIntent: SlackLiveDeliveryActionIntent;
  target: {
    kind: SlackLiveDeliveryTargetKind;
    runtimeTargetKind: MessagingDeliveryTargetKind;
    id: string;
    label: string;
    threadRootId?: string;
  };
  credentialReference: {
    id: string;
    kind: ConnectorCredentialReference['kind'];
    storageOwner: ConnectorCredentialReference['storageOwner'];
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
    sourceAction: 'dry-run-notification';
    adapterImplementationId: string;
    adapterVersion: string;
    invocationMode: 'decision-only';
    targetRedaction: 'target-id-omitted';
    runtimePlanExpiresAt: number;
  };
  reviewedTarget: true;
  reviewedConsent: true;
  reviewedNoisePolicy: true;
  reviewedDeliveryIntent: true;
  noAutoPost: true;
  notificationOnly: true;
  requiresUserApprovalBeforePost: true;
  requiresExplicitSendApproval: true;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'slack-runtime-activation-plan-only-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send';
}

export interface SlackRuntimeActivationPlanDecision {
  status: SlackRuntimeActivationPlanStatus;
  ready: boolean;
  reason: SlackRuntimeActivationPlanReason;
  plan?: SlackRuntimeActivationPlan;
  canPrepareFutureSlackRuntimeActivation: boolean;
  executable: false;
  sideEffects: 'none';
  requiresExplicitSendApproval: true;
  willCallSlackApi: false;
  willCallWebhook: false;
  willFetch: false;
  willOpenSocket: false;
  willMutateStorage: false;
  willStoreCredential: false;
  willPostMessage: false;
  willPostThreadReply: false;
  sideEffectBoundary: 'slack-runtime-activation-plan-binding-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send';
}

export interface SlackRuntimeActivationPlanInput {
  activationGate?: unknown;
  invocationBoundary?: unknown;
  now?: number;
}

const DECISION_BOUNDARY =
  'slack-runtime-activation-plan-binding-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send' as const;
const PLAN_BOUNDARY =
  'slack-runtime-activation-plan-only-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send' as const;
const ACTIVATION_GATE_BOUNDARY =
  'slack-live-delivery-activation-gate-plan-only-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send' as const;
const ACTIVATION_PLAN_BOUNDARY =
  'slack-live-delivery-activation-plan-only-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send' as const;
const INVOCATION_BOUNDARY =
  'pure-local-adapter-invocation-implementation-boundary-no-callback-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send' as const;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{2,180}$/;
const SAFE_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._:@/+()#,&-]{0,159}$/;
const BRAND_MARKERS = ['VENDOR', 'examplecorp', 'Example Organization', 'employer'] as const;
const ROOT_KEYS = new Set(['activationGate', 'invocationBoundary', 'now']);
const ACTIVATION_GATE_KEYS = new Set([
  'blockers',
  'canPrepareFutureSlackLiveDeliveryActivation',
  'executable',
  'plan',
  'ready',
  'reason',
  'requiresUserApprovalBeforePost',
  'sideEffectBoundary',
  'sideEffects',
  'status',
  'willCallSlackApi',
  'willCallWebhook',
  'willFetch',
  'willMutateStorage',
  'willOpenOAuthWindow',
  'willOpenSocket',
  'willPostMessage',
  'willPostThreadReply',
  'willStoreCredential',
]);
const ACTIVATION_PLAN_KEYS = new Set([
  'actionIntent',
  'connectorKind',
  'consentWindow',
  'contract',
  'credentialReference',
  'eventScope',
  'executable',
  'messageClass',
  'noAutoPost',
  'noisePolicy',
  'notificationOnly',
  'requiresUserApprovalBeforePost',
  'reviewedConsent',
  'reviewedDeliveryIntent',
  'reviewedNoisePolicy',
  'reviewedTarget',
  'sideEffectBoundary',
  'sideEffects',
  'target',
  'workspaceId',
]);
const ACTIVATION_TARGET_KEYS = new Set(['id', 'kind', 'label', 'threadRootId']);
const ACTIVATION_CREDENTIAL_KEYS = new Set([
  'accountId',
  'connectorId',
  'id',
  'kind',
  'providerId',
  'storageOwner',
]);
const CONSENT_WINDOW_KEYS = new Set(['expiresAt', 'issuedAt']);
const NOISE_POLICY_KEYS = new Set([
  'maxDeliveriesPerHour',
  'maxRecipientsPerDelivery',
  'noBurstDelivery',
  'requireExplicitCaseMentionForChannels',
  'suppressDuplicateThreadReplies',
]);
const INVOCATION_KEYS = new Set([
  'action',
  'adapterCallable',
  'adapterId',
  'adapterImplementationId',
  'adapterVersion',
  'canPrepareFutureAdapterInvocation',
  'connectorKind',
  'credentialReference',
  'eventScope',
  'executable',
  'invocationMode',
  'planExpiresAt',
  'ready',
  'reason',
  'runtimeOwner',
  'sideEffectBoundary',
  'status',
  'target',
  'willCallWebhook',
  'willInvokeAdapter',
  'willPostMessage',
  'willStoreCredential',
]);
const INVOCATION_TARGET_KEYS = new Set(['kind', 'redaction']);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasForbiddenBranding(value: unknown): boolean {
  const seen = new WeakSet<object>();
  const pending: unknown[] = [value];

  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === 'string') {
      const normalized = normalizedText(current);
      if (BRAND_MARKERS.some((marker) => normalized.includes(marker))) return true;
      continue;
    }
    if (typeof current === 'function') return true;
    if (!current || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);
    if (current instanceof Map) {
      for (const [key, nested] of current.entries()) pending.push(key, nested);
      continue;
    }
    if (current instanceof Set) {
      for (const nested of current.values()) pending.push(nested);
      continue;
    }
    if (Array.isArray(current)) {
      for (const nested of current) pending.push(nested);
      continue;
    }
    for (const [key, nested] of Object.entries(current)) {
      if (typeof nested === 'function') return true;
      pending.push(key, nested);
    }
  }

  return false;
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || !SAFE_ID_PATTERN.test(trimmed)) return undefined;
  if (hasMessagingSecretMaterial({ candidate: trimmed }) || hasConnectorSecretMaterial({ candidate: trimmed })) {
    return undefined;
  }
  return trimmed;
}

function safeLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 160 || !SAFE_LABEL_PATTERN.test(trimmed)) return undefined;
  if (hasMessagingSecretMaterial({ candidate: trimmed }) || hasConnectorSecretMaterial({ candidate: trimmed })) {
    return undefined;
  }
  if (hasForbiddenBranding(trimmed)) return undefined;
  return trimmed;
}

function safeTimestamp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function safeConnectorKind(value: unknown): MessagingConnectorKind | undefined {
  return value === 'slack' || value === 'generic-webhook' ? value : undefined;
}

function safeEventScope(value: unknown): MessagingConnectorEventClass | undefined {
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

function safeMessageClass(value: unknown): SlackLiveDeliveryMessageClass | undefined {
  switch (value) {
    case 'ioc-alert':
    case 'case-update':
    case 'analyst-routing':
      return value;
    default:
      return undefined;
  }
}

function safeActionIntent(value: unknown): SlackLiveDeliveryActionIntent | undefined {
  switch (value) {
    case 'post-message':
    case 'post-thread-reply':
    case 'webhook-delivery':
      return value;
    default:
      return undefined;
  }
}

function safeSlackTargetKind(value: unknown): SlackLiveDeliveryTargetKind | undefined {
  switch (value) {
    case 'workspace-channel':
    case 'direct-message':
    case 'thread-reply':
    case 'webhook-reference':
      return value;
    default:
      return undefined;
  }
}

function runtimeTargetKindForSlackTarget(
  value: SlackLiveDeliveryTargetKind,
): MessagingDeliveryTargetKind {
  switch (value) {
    case 'workspace-channel':
      return 'slack-channel';
    case 'direct-message':
      return 'slack-dm';
    case 'thread-reply':
      return 'slack-thread';
    case 'webhook-reference':
      return 'webhook-handle';
  }
}

function actionMatchesTargetAndScope(
  targetKind: SlackLiveDeliveryTargetKind,
  eventScope: MessagingConnectorEventClass,
  actionIntent: SlackLiveDeliveryActionIntent,
): boolean {
  switch (targetKind) {
    case 'workspace-channel':
      return eventScope === 'channel-follow-up' && actionIntent === 'post-message';
    case 'direct-message':
      return (eventScope === 'one-to-one-dm' || eventScope === 'group-dm') && actionIntent === 'post-message';
    case 'thread-reply':
      return eventScope === 'thread-reply-after-user-post' && actionIntent === 'post-thread-reply';
    case 'webhook-reference':
      return eventScope === 'webhook-alert' && actionIntent === 'webhook-delivery';
  }
}

function safeCredentialReference(
  value: unknown,
): SlackRuntimeActivationPlan['credentialReference'] | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ACTIVATION_CREDENTIAL_KEYS)) return undefined;
  const id = safeIdentifier(value.id);
  const kind = value.kind;
  const storageOwner = value.storageOwner;
  if (!id) return undefined;
  if (
    kind !== 'os-keychain'
    && kind !== 'local-bridge'
    && kind !== 'external-secret-store'
    && kind !== 'provider-managed-oauth'
  ) {
    return undefined;
  }
  if (
    storageOwner !== 'operating-system'
    && storageOwner !== 'local-bridge'
    && storageOwner !== 'external-provider'
    && storageOwner !== 'external-secret-store'
  ) {
    return undefined;
  }
  const providerId = safeIdentifier(value.providerId);
  const connectorId = safeIdentifier(value.connectorId);
  const accountId = safeIdentifier(value.accountId);
  const reference: SlackRuntimeActivationPlan['credentialReference'] = {
    id,
    kind,
    storageOwner,
  };
  if (providerId) reference.providerId = providerId;
  if (connectorId) reference.connectorId = connectorId;
  if (accountId) reference.accountId = accountId;
  return Object.freeze(reference);
}

function parsedActivationGate(
  value: unknown,
): SlackLiveDeliveryActivationGateDecision | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ACTIVATION_GATE_KEYS)) return undefined;
  if (value.status !== 'ready' || value.ready !== true) return undefined;
  if (value.reason !== 'slack_live_delivery_activation_gate_ready') return undefined;
  if (!Array.isArray(value.blockers) || value.blockers.length !== 0) return undefined;
  if (
    value.canPrepareFutureSlackLiveDeliveryActivation !== true
    || value.executable !== false
    || value.sideEffects !== 'none'
    || value.requiresUserApprovalBeforePost !== true
    || value.willCallSlackApi !== false
    || value.willCallWebhook !== false
    || value.willFetch !== false
    || value.willOpenSocket !== false
    || value.willMutateStorage !== false
    || value.willStoreCredential !== false
    || value.willOpenOAuthWindow !== false
    || value.willPostMessage !== false
    || value.willPostThreadReply !== false
    || value.sideEffectBoundary !== ACTIVATION_GATE_BOUNDARY
  ) {
    return undefined;
  }
  if (!isRecord(value.plan) || !hasOnlyKeys(value.plan, ACTIVATION_PLAN_KEYS)) return undefined;
  return value as unknown as SlackLiveDeliveryActivationGateDecision;
}

function parsedInvocationBoundary(
  value: unknown,
): MessagingAdapterInvocationImplementationDecision | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, INVOCATION_KEYS)) return undefined;
  if (value.status !== 'ready' || value.ready !== true) return undefined;
  if (value.reason !== 'adapter_invocation_boundary_ready') return undefined;
  if (
    value.canPrepareFutureAdapterInvocation !== true
    || value.invocationMode !== 'decision-only'
    || value.executable !== false
    || value.adapterCallable !== false
    || value.willInvokeAdapter !== false
    || value.willPostMessage !== false
    || value.willCallWebhook !== false
    || value.willStoreCredential !== false
    || value.sideEffectBoundary !== INVOCATION_BOUNDARY
  ) {
    return undefined;
  }
  if (value.action !== 'dry-run-notification') return undefined;
  if (!isRecord(value.target) || !hasOnlyKeys(value.target, INVOCATION_TARGET_KEYS)) return undefined;
  if (value.target.redaction !== 'target-id-omitted') return undefined;
  if (!safeIdentifier(value.adapterId) || !safeIdentifier(value.runtimeOwner)) return undefined;
  if (!safeConnectorKind(value.connectorKind) || !safeEventScope(value.eventScope)) return undefined;
  if (!Number.isSafeInteger(value.planExpiresAt)) return undefined;
  if (!safeIdentifier(value.adapterImplementationId) || !safeIdentifier(value.adapterVersion)) return undefined;
  if (!safeCredentialReference(value.credentialReference)) return undefined;
  return value as unknown as MessagingAdapterInvocationImplementationDecision;
}

function freezeDecision(
  reason: SlackRuntimeActivationPlanReason,
  plan?: SlackRuntimeActivationPlan,
): Readonly<SlackRuntimeActivationPlanDecision> {
  const ready = reason === 'slack_runtime_activation_plan_ready';
  return Object.freeze({
    status: ready ? 'ready' : 'blocked',
    ready,
    reason,
    plan,
    canPrepareFutureSlackRuntimeActivation: ready,
    executable: false,
    sideEffects: 'none',
    requiresExplicitSendApproval: true,
    willCallSlackApi: false,
    willCallWebhook: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    willStoreCredential: false,
    willPostMessage: false,
    willPostThreadReply: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}

export function evaluateSlackRuntimeActivationPlan(
  input: SlackRuntimeActivationPlanInput = {},
): Readonly<SlackRuntimeActivationPlanDecision> {
  if (!isRecord(input) || !hasOnlyKeys(input, ROOT_KEYS)) {
    return freezeDecision('invalid_root_shape');
  }
  if (
    hasMessagingSecretMaterial(input)
    || hasConnectorSecretMaterial(input)
    || hasForbiddenBranding(input)
  ) {
    return freezeDecision(
      hasForbiddenBranding(input) ? 'VENDOR_or_employer_branding_forbidden' : 'raw_secret_material',
    );
  }

  const activationGate = input.activationGate;
  if (activationGate == null) return freezeDecision('activation_gate_missing');
  if (!isRecord(activationGate) || activationGate.status !== 'ready' || activationGate.ready !== true) {
    return freezeDecision('activation_gate_not_ready');
  }
  const safeActivationGate = parsedActivationGate(activationGate);
  if (!safeActivationGate) return freezeDecision('activation_gate_invalid');

  const invocationBoundary = input.invocationBoundary;
  if (invocationBoundary == null) return freezeDecision('invocation_boundary_missing');
  if (!isRecord(invocationBoundary) || invocationBoundary.status !== 'ready' || invocationBoundary.ready !== true) {
    return freezeDecision('invocation_boundary_not_ready');
  }
  const safeInvocationBoundary = parsedInvocationBoundary(invocationBoundary);
  if (!safeInvocationBoundary) return freezeDecision('invocation_boundary_invalid');

  const plan = safeActivationGate.plan;
  if (!plan || plan.contract !== 'slack-live-delivery-activation-plan-v1') {
    return freezeDecision('activation_gate_invalid');
  }
  if (
    plan.executable !== false
    || plan.sideEffects !== 'none'
    || plan.sideEffectBoundary !== ACTIVATION_PLAN_BOUNDARY
  ) {
    return freezeDecision('activation_gate_invalid');
  }
  if (plan.noAutoPost !== true) return freezeDecision('no_auto_post_required');
  if (plan.notificationOnly !== true) return freezeDecision('notification_only_required');
  if (plan.requiresUserApprovalBeforePost !== true) return freezeDecision('requires_explicit_send_approval');

  const connectorKind = safeConnectorKind(plan.connectorKind);
  const notificationScope = safeEventScope(plan.eventScope);
  const messageClass = safeMessageClass(plan.messageClass);
  const actionIntent = safeActionIntent(plan.actionIntent);
  const workspaceId = safeIdentifier(plan.workspaceId);
  const credentialReference = safeCredentialReference(plan.credentialReference);
  const issuedAt = safeTimestamp(plan.consentWindow?.issuedAt);
  const expiresAt = safeTimestamp(plan.consentWindow?.expiresAt);
  const targetKind = safeSlackTargetKind(plan.target?.kind);
  const targetId = safeIdentifier(plan.target?.id);
  const targetLabel = safeLabel(plan.target?.label);
  const threadRootId = safeIdentifier(plan.target?.threadRootId);

  if (!connectorKind || !notificationScope || !messageClass || !actionIntent || !credentialReference || !targetKind || !targetId || !targetLabel) {
    return freezeDecision('activation_gate_invalid');
  }
  if (
    !isRecord(plan.consentWindow)
    || !hasOnlyKeys(plan.consentWindow, CONSENT_WINDOW_KEYS)
    || !isRecord(plan.noisePolicy)
    || !hasOnlyKeys(plan.noisePolicy, NOISE_POLICY_KEYS)
    || issuedAt === undefined
    || expiresAt === undefined
    || issuedAt >= expiresAt
  ) {
    return freezeDecision('consent_window_invalid');
  }
  if (
    plan.reviewedTarget !== true
    || plan.reviewedConsent !== true
    || plan.reviewedNoisePolicy !== true
    || plan.reviewedDeliveryIntent !== true
  ) {
    return freezeDecision('activation_gate_invalid');
  }
  if (!isRecord(plan.target) || !hasOnlyKeys(plan.target, ACTIVATION_TARGET_KEYS)) {
    return freezeDecision('activation_gate_invalid');
  }
  if (targetKind === 'thread-reply' && !threadRootId) return freezeDecision('target_binding_invalid');
  if (targetKind !== 'thread-reply' && plan.target.threadRootId !== undefined) return freezeDecision('target_binding_invalid');
  if (!actionMatchesTargetAndScope(targetKind, notificationScope, actionIntent)) {
    return freezeDecision('target_binding_invalid');
  }

  const runtimeTargetKind = runtimeTargetKindForSlackTarget(targetKind);
  if (safeInvocationBoundary.connectorKind !== connectorKind) return freezeDecision('connector_kind_mismatch');
  if (safeInvocationBoundary.eventScope !== notificationScope) return freezeDecision('event_scope_mismatch');
  if (safeInvocationBoundary.target?.kind !== runtimeTargetKind) return freezeDecision('target_binding_invalid');
  if (
    safeInvocationBoundary.credentialReference?.id !== credentialReference.id
    || safeInvocationBoundary.credentialReference?.kind !== credentialReference.kind
    || safeInvocationBoundary.credentialReference?.storageOwner !== credentialReference.storageOwner
    || safeInvocationBoundary.credentialReference?.providerId !== credentialReference.providerId
    || safeInvocationBoundary.credentialReference?.connectorId !== credentialReference.connectorId
    || safeInvocationBoundary.credentialReference?.accountId !== credentialReference.accountId
  ) {
    return freezeDecision('credential_reference_mismatch');
  }

  if (connectorKind === 'slack') {
    if (
      !workspaceId
      || targetKind === 'webhook-reference'
      || credentialReference.providerId !== 'slack'
      || credentialReference.accountId !== workspaceId
    ) {
      return freezeDecision('workspace_binding_invalid');
    }
  } else if (
    plan.workspaceId !== undefined
    || targetKind !== 'webhook-reference'
    || credentialReference.providerId !== 'generic-webhook'
  ) {
    return freezeDecision('workspace_binding_invalid');
  }

  const now = safeTimestamp(input.now);
  if (now !== undefined && (now < issuedAt || now >= expiresAt || safeInvocationBoundary.planExpiresAt! <= now)) {
    return freezeDecision('consent_window_invalid');
  }

  const runtimeBinding = Object.freeze({
    adapterId: safeInvocationBoundary.adapterId!,
    runtimeOwner: safeInvocationBoundary.runtimeOwner!,
    sourceAction: 'dry-run-notification' as const,
    adapterImplementationId: safeInvocationBoundary.adapterImplementationId!,
    adapterVersion: safeInvocationBoundary.adapterVersion!,
    invocationMode: 'decision-only' as const,
    targetRedaction: 'target-id-omitted' as const,
    runtimePlanExpiresAt: safeInvocationBoundary.planExpiresAt!,
  });

  const outputPlan = Object.freeze({
    contract: 'slack-runtime-activation-plan-v1' as const,
    connectorKind,
    workspaceId,
    notificationScope,
    messageClass,
    actionIntent,
    target: Object.freeze({
      kind: targetKind,
      runtimeTargetKind,
      id: targetId,
      label: targetLabel,
      ...(threadRootId ? { threadRootId } : {}),
    }),
    credentialReference,
    consentWindow: Object.freeze({
      issuedAt,
      expiresAt,
    }),
    runtimeBinding,
    reviewedTarget: true as const,
    reviewedConsent: true as const,
    reviewedNoisePolicy: true as const,
    reviewedDeliveryIntent: true as const,
    noAutoPost: true as const,
    notificationOnly: true as const,
    requiresUserApprovalBeforePost: true as const,
    requiresExplicitSendApproval: true as const,
    executable: false as const,
    sideEffects: 'none' as const,
    sideEffectBoundary: PLAN_BOUNDARY,
  });

  return freezeDecision('slack_runtime_activation_plan_ready', outputPlan);
}
