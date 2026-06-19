import {
  hasConnectorSecretMaterial,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
} from './connector-credential-boundary';
import {
  hasMessagingSecretMaterial,
  type MessagingConnectorEventClass,
  type MessagingConnectorKind,
} from './messaging-connector-policy';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type SlackLiveDeliveryTargetKind =
  | 'workspace-channel'
  | 'direct-message'
  | 'thread-reply'
  | 'webhook-reference';

export type SlackLiveDeliveryMessageClass =
  | 'ioc-alert'
  | 'case-update'
  | 'analyst-routing';

export type SlackLiveDeliveryActionIntent =
  | 'post-message'
  | 'post-thread-reply'
  | 'webhook-delivery';

export type SlackLiveDeliveryActivationGateStatus = 'ready' | 'blocked';

export type SlackLiveDeliveryActivationGateReason =
  | 'slack_live_delivery_activation_gate_ready'
  | 'invalid_root_shape'
  | 'raw_secret_material'
  | 'runtime_shape_forbidden'
  | 'VENDOR_or_employer_branding_forbidden'
  | 'target_missing'
  | 'target_invalid'
  | 'target_unreviewed'
  | 'target_scope_invalid'
  | 'target_provenance_invalid'
  | 'consent_missing'
  | 'consent_invalid'
  | 'consent_unreviewed'
  | 'consent_expired'
  | 'consent_binding_invalid'
  | 'credential_reference_missing'
  | 'credential_reference_invalid'
  | 'credential_reference_owner_invalid'
  | 'noise_policy_missing'
  | 'noise_policy_invalid'
  | 'delivery_intent_missing'
  | 'delivery_intent_invalid'
  | 'delivery_intent_unreviewed'
  | 'delivery_intent_binding_invalid'
  | 'delivery_intent_no_auto_post_required';

export interface SlackLiveDeliveryReviewedTarget {
  contract: 'slack-live-delivery-reviewed-target-v1';
  connectorKind: MessagingConnectorKind;
  workspaceId?: string;
  workspaceLabel?: string;
  targetKind: SlackLiveDeliveryTargetKind;
  eventScope: MessagingConnectorEventClass;
  targetId: string;
  targetLabel: string;
  threadRootId?: string;
  targetProvenance: 'reviewed-workspace-target' | 'reviewed-webhook-reference';
  reviewState: 'reviewed';
  targetReviewed: true;
}

export interface SlackLiveDeliveryReviewedConsent {
  contract: 'slack-live-delivery-reviewed-consent-v1';
  connectorKind: MessagingConnectorKind;
  workspaceId?: string;
  targetId: string;
  eventScope: MessagingConnectorEventClass;
  messageClass: SlackLiveDeliveryMessageClass;
  explicitUserConsent: true;
  granted: true;
  reviewed: true;
  noAutoPost: true;
  requiresUserApprovalBeforePost: true;
  issuedAt: number;
  expiresAt: number;
}

export interface SlackLiveDeliveryNoisePolicy {
  contract: 'slack-live-delivery-noise-policy-v1';
  connectorKind: MessagingConnectorKind;
  eventScope: MessagingConnectorEventClass;
  reviewState: 'reviewed';
  rateLimitReviewed: true;
  quietHoursReviewed: true;
  maxDeliveriesPerHour: number;
  maxRecipientsPerDelivery: number;
  suppressDuplicateThreadReplies: boolean;
  requireExplicitCaseMentionForChannels: boolean;
  noBurstDelivery: true;
}

export interface SlackLiveDeliveryIntent {
  contract: 'slack-live-delivery-intent-v1';
  connectorKind: MessagingConnectorKind;
  workspaceId?: string;
  targetId: string;
  eventScope: MessagingConnectorEventClass;
  messageClass: SlackLiveDeliveryMessageClass;
  actionIntent: SlackLiveDeliveryActionIntent;
  reviewed: true;
  notificationOnly: true;
  noAutoPost: true;
  requiresUserApprovalBeforePost: true;
}

export interface SlackLiveDeliveryActivationGateInput {
  reviewedTarget?: unknown;
  reviewedConsent?: unknown;
  credentialReference?: unknown;
  noisePolicy?: unknown;
  deliveryIntent?: unknown;
  now?: number;
}

export interface SlackLiveDeliveryActivationPlan {
  contract: 'slack-live-delivery-activation-plan-v1';
  connectorKind: MessagingConnectorKind;
  workspaceId?: string;
  target: {
    kind: SlackLiveDeliveryTargetKind;
    id: string;
    label: string;
    threadRootId?: string;
  };
  eventScope: MessagingConnectorEventClass;
  messageClass: SlackLiveDeliveryMessageClass;
  actionIntent: SlackLiveDeliveryActionIntent;
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
  noisePolicy: {
    maxDeliveriesPerHour: number;
    maxRecipientsPerDelivery: number;
    suppressDuplicateThreadReplies: boolean;
    requireExplicitCaseMentionForChannels: boolean;
    noBurstDelivery: true;
  };
  reviewedTarget: true;
  reviewedConsent: true;
  reviewedNoisePolicy: true;
  reviewedDeliveryIntent: true;
  noAutoPost: true;
  notificationOnly: true;
  requiresUserApprovalBeforePost: true;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'slack-live-delivery-activation-plan-only-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send';
}

export interface SlackLiveDeliveryActivationGateDecision {
  status: SlackLiveDeliveryActivationGateStatus;
  ready: boolean;
  reason: SlackLiveDeliveryActivationGateReason;
  blockers: readonly SlackLiveDeliveryActivationGateReason[];
  plan?: SlackLiveDeliveryActivationPlan;
  canPrepareFutureSlackLiveDeliveryActivation: boolean;
  executable: false;
  sideEffects: 'none';
  requiresUserApprovalBeforePost: true;
  willCallSlackApi: false;
  willCallWebhook: false;
  willFetch: false;
  willOpenSocket: false;
  willMutateStorage: false;
  willStoreCredential: false;
  willOpenOAuthWindow: false;
  willPostMessage: false;
  willPostThreadReply: false;
  sideEffectBoundary: 'slack-live-delivery-activation-gate-plan-only-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send';
}

const DECISION_BOUNDARY =
  'slack-live-delivery-activation-gate-plan-only-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send' as const;
const PLAN_BOUNDARY =
  'slack-live-delivery-activation-plan-only-no-slack-api-no-webhook-no-fetch-no-socket-no-storage-no-send' as const;

const ROOT_KEYS = new Set([
  'reviewedTarget',
  'reviewedConsent',
  'credentialReference',
  'noisePolicy',
  'deliveryIntent',
  'now',
]);

const TARGET_KEYS = new Set([
  'contract',
  'connectorKind',
  'workspaceId',
  'workspaceLabel',
  'targetKind',
  'eventScope',
  'targetId',
  'targetLabel',
  'threadRootId',
  'targetProvenance',
  'reviewState',
  'targetReviewed',
]);

const CONSENT_KEYS = new Set([
  'contract',
  'connectorKind',
  'workspaceId',
  'targetId',
  'eventScope',
  'messageClass',
  'explicitUserConsent',
  'granted',
  'reviewed',
  'noAutoPost',
  'requiresUserApprovalBeforePost',
  'issuedAt',
  'expiresAt',
]);

const NOISE_POLICY_KEYS = new Set([
  'contract',
  'connectorKind',
  'eventScope',
  'reviewState',
  'rateLimitReviewed',
  'quietHoursReviewed',
  'maxDeliveriesPerHour',
  'maxRecipientsPerDelivery',
  'suppressDuplicateThreadReplies',
  'requireExplicitCaseMentionForChannels',
  'noBurstDelivery',
]);

const DELIVERY_INTENT_KEYS = new Set([
  'contract',
  'connectorKind',
  'workspaceId',
  'targetId',
  'eventScope',
  'messageClass',
  'actionIntent',
  'reviewed',
  'notificationOnly',
  'noAutoPost',
  'requiresUserApprovalBeforePost',
]);

const TARGET_KINDS = new Set<SlackLiveDeliveryTargetKind>([
  'workspace-channel',
  'direct-message',
  'thread-reply',
  'webhook-reference',
]);

const CONNECTOR_KINDS = new Set<MessagingConnectorKind>(['slack', 'generic-webhook']);
const EVENT_SCOPES = new Set<MessagingConnectorEventClass>([
  'direct-mention',
  'one-to-one-dm',
  'group-dm',
  'thread-reply-after-user-post',
  'channel-follow-up',
  'webhook-alert',
]);
const MESSAGE_CLASSES = new Set<SlackLiveDeliveryMessageClass>([
  'ioc-alert',
  'case-update',
  'analyst-routing',
]);
const ACTIONS = new Set<SlackLiveDeliveryActionIntent>([
  'post-message',
  'post-thread-reply',
  'webhook-delivery',
]);
const BRAND_MARKERS = ['VENDOR', 'employer', 'corporate', 'internalit', 'examplecorp'] as const;
const RUNTIME_FIELD_MARKERS = [
  'callback',
  'requester',
  'fetch',
  'socket',
  'storageadapter',
  'storageresult',
  'localstorage',
  'sessionstorage',
  'indexeddb',
  'mutatestorage',
  'readstorage',
  'writestorage',
  'execute',
  'executable',
  'liveaction',
  'redirectnow',
  'openoauthwindow',
  'willfetch',
  'willopensocket',
  'willmutatestorage',
  'willstorecredential',
  'willcallslackapi',
  'willcallwebhook',
  'willpostmessage',
  'willpostthreadreply',
  'slackapi',
  'transport',
  'adapterresult',
  'adaptermetadata',
] as const;

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const SAFE_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .,:/@_+()~-]{0,179}$/;
const MAX_TIMESTAMP = 8_640_000_000_000_000;
const RAW_SECRET_PATTERN =
  /(?:https?:\/\/|hooks\.slack(?:-gov)?\.com\/services\/|xox[abprs]-|Bearer\s+[A-Za-z0-9._~+/=-]{8,}|(?:oauth|authorization)[\s_-]?code\s*[:=]\s*\S+|(?:api|app|bot|client|refresh|access|id)[_-]?(?:key|token|secret)\s*[:=]\s*\S+|-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----)/i;
const URL_LIKE_IDENTIFIER_PATTERN =
  /(?:^[a-z][a-z0-9+.-]*:|^\/\/\S+|^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\/|^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+)/i;

type ParsedTarget = SlackLiveDeliveryReviewedTarget;
type ParsedConsent = SlackLiveDeliveryReviewedConsent;
type ParsedNoisePolicy = SlackLiveDeliveryNoisePolicy;
type ParsedIntent = SlackLiveDeliveryIntent;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasForbiddenBranding(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') {
    const normalized = normalize(value);
    return BRAND_MARKERS.some((marker) => normalized.includes(marker));
  }
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => hasForbiddenBranding(entry, seen));
  return Object.entries(value).some(([key, nested]) => hasForbiddenBranding(key, seen) || hasForbiddenBranding(nested, seen));
}

function hasForbiddenRuntimeField(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => hasForbiddenRuntimeField(entry, seen));
  return Object.entries(value).some(([key, nested]) => {
    const normalized = normalize(key);
    return RUNTIME_FIELD_MARKERS.some((marker) => normalized.includes(marker))
      || hasForbiddenRuntimeField(nested, seen);
  });
}

function hasRawSecretMaterial(value: unknown): boolean {
  if (hasConnectorSecretMaterial(value) || hasMessagingSecretMaterial(value)) return true;
  const seen = new WeakSet<object>();
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === 'string') {
      if (RAW_SECRET_PATTERN.test(current)) return true;
      continue;
    }
    if (current === null || current === undefined || typeof current !== 'object') continue;
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
    for (const [key, nested] of Object.entries(current)) {
      if (RAW_SECRET_PATTERN.test(key)) return true;
      pending.push(nested);
    }
  }
  return false;
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (
    !trimmed
    || !SAFE_ID_PATTERN.test(trimmed)
    || RAW_SECRET_PATTERN.test(trimmed)
    || URL_LIKE_IDENTIFIER_PATTERN.test(trimmed)
    || hasForbiddenBranding(trimmed)
  ) {
    return undefined;
  }
  return trimmed;
}

function safeLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (
    !trimmed
    || !SAFE_LABEL_PATTERN.test(trimmed)
    || RAW_SECRET_PATTERN.test(trimmed)
    || URL_LIKE_IDENTIFIER_PATTERN.test(trimmed)
    || hasForbiddenBranding(trimmed)
  ) {
    return undefined;
  }
  return trimmed;
}

function safeConnectorKind(value: unknown): MessagingConnectorKind | undefined {
  return typeof value === 'string' && CONNECTOR_KINDS.has(value as MessagingConnectorKind)
    ? value as MessagingConnectorKind
    : undefined;
}

function safeEventScope(value: unknown): MessagingConnectorEventClass | undefined {
  return typeof value === 'string' && EVENT_SCOPES.has(value as MessagingConnectorEventClass)
    ? value as MessagingConnectorEventClass
    : undefined;
}

function safeTargetKind(value: unknown): SlackLiveDeliveryTargetKind | undefined {
  return typeof value === 'string' && TARGET_KINDS.has(value as SlackLiveDeliveryTargetKind)
    ? value as SlackLiveDeliveryTargetKind
    : undefined;
}

function safeMessageClass(value: unknown): SlackLiveDeliveryMessageClass | undefined {
  return typeof value === 'string' && MESSAGE_CLASSES.has(value as SlackLiveDeliveryMessageClass)
    ? value as SlackLiveDeliveryMessageClass
    : undefined;
}

function safeActionIntent(value: unknown): SlackLiveDeliveryActionIntent | undefined {
  return typeof value === 'string' && ACTIONS.has(value as SlackLiveDeliveryActionIntent)
    ? value as SlackLiveDeliveryActionIntent
    : undefined;
}

function safeTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return undefined;
  if (value < 0 || value > MAX_TIMESTAMP) return undefined;
  return value;
}

function validTargetScope(connectorKind: MessagingConnectorKind, targetKind: SlackLiveDeliveryTargetKind, eventScope: MessagingConnectorEventClass): boolean {
  if (targetKind === 'workspace-channel') {
    return connectorKind === 'slack' && (eventScope === 'direct-mention' || eventScope === 'channel-follow-up');
  }
  if (targetKind === 'direct-message') {
    return connectorKind === 'slack' && (eventScope === 'one-to-one-dm' || eventScope === 'group-dm');
  }
  if (targetKind === 'thread-reply') {
    return connectorKind === 'slack' && eventScope === 'thread-reply-after-user-post';
  }
  return connectorKind === 'generic-webhook' && eventScope === 'webhook-alert';
}

function validActionScope(targetKind: SlackLiveDeliveryTargetKind, eventScope: MessagingConnectorEventClass, actionIntent: SlackLiveDeliveryActionIntent): boolean {
  if (actionIntent === 'webhook-delivery') {
    return targetKind === 'webhook-reference' && eventScope === 'webhook-alert';
  }
  if (actionIntent === 'post-thread-reply') {
    return targetKind === 'thread-reply' && eventScope === 'thread-reply-after-user-post';
  }
  return actionIntent === 'post-message'
    && targetKind !== 'webhook-reference'
    && eventScope !== 'thread-reply-after-user-post'
    && eventScope !== 'webhook-alert';
}

function parseTarget(value: unknown):
  | { ok: true; value: ParsedTarget }
  | { ok: false; reason: SlackLiveDeliveryActivationGateReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, TARGET_KEYS)) {
    return { ok: false, reason: 'target_invalid' };
  }
  const connectorKind = safeConnectorKind(value.connectorKind);
  const workspaceId = safeIdentifier(value.workspaceId);
  const workspaceLabel = safeLabel(value.workspaceLabel);
  const targetKind = safeTargetKind(value.targetKind);
  const eventScope = safeEventScope(value.eventScope);
  const targetId = safeIdentifier(value.targetId);
  const targetLabel = safeLabel(value.targetLabel);
  const threadRootId = safeIdentifier(value.threadRootId);
  const targetProvenance = value.targetProvenance === 'reviewed-workspace-target' || value.targetProvenance === 'reviewed-webhook-reference'
    ? value.targetProvenance
    : undefined;
  if (
    value.contract !== 'slack-live-delivery-reviewed-target-v1'
    || !connectorKind
    || !targetKind
    || !eventScope
    || !targetId
    || !targetLabel
    || !targetProvenance
    || value.targetReviewed !== true
  ) {
    return { ok: false, reason: 'target_invalid' };
  }
  if (value.reviewState !== 'reviewed') return { ok: false, reason: 'target_unreviewed' };
  if (value.workspaceId !== undefined && !workspaceId) return { ok: false, reason: 'target_invalid' };
  if (value.workspaceLabel !== undefined && !workspaceLabel) return { ok: false, reason: 'target_invalid' };
  if (targetKind === 'thread-reply' && !threadRootId) return { ok: false, reason: 'target_scope_invalid' };
  if (targetKind !== 'thread-reply' && value.threadRootId !== undefined) return { ok: false, reason: 'target_scope_invalid' };
  if (!validTargetScope(connectorKind, targetKind, eventScope)) return { ok: false, reason: 'target_scope_invalid' };
  if (
    (targetKind === 'webhook-reference' && targetProvenance !== 'reviewed-webhook-reference')
    || (targetKind !== 'webhook-reference' && targetProvenance !== 'reviewed-workspace-target')
  ) {
    return { ok: false, reason: 'target_provenance_invalid' };
  }
  if ((targetKind === 'webhook-reference') !== (connectorKind === 'generic-webhook')) {
    return { ok: false, reason: 'target_provenance_invalid' };
  }
  if (targetKind !== 'webhook-reference' && !workspaceId) return { ok: false, reason: 'target_scope_invalid' };
  return {
    ok: true,
    value: Object.freeze({
      contract: 'slack-live-delivery-reviewed-target-v1',
      connectorKind,
      ...(workspaceId ? { workspaceId } : {}),
      ...(workspaceLabel ? { workspaceLabel } : {}),
      targetKind,
      eventScope,
      targetId,
      targetLabel,
      ...(threadRootId ? { threadRootId } : {}),
      targetProvenance,
      reviewState: 'reviewed',
      targetReviewed: true,
    }),
  };
}

function parseConsent(value: unknown):
  | { ok: true; value: ParsedConsent }
  | { ok: false; reason: SlackLiveDeliveryActivationGateReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, CONSENT_KEYS)) {
    return { ok: false, reason: 'consent_invalid' };
  }
  const connectorKind = safeConnectorKind(value.connectorKind);
  const workspaceId = safeIdentifier(value.workspaceId);
  const targetId = safeIdentifier(value.targetId);
  const eventScope = safeEventScope(value.eventScope);
  const messageClass = safeMessageClass(value.messageClass);
  const issuedAt = safeTimestamp(value.issuedAt);
  const expiresAt = safeTimestamp(value.expiresAt);
  if (
    value.contract !== 'slack-live-delivery-reviewed-consent-v1'
    || !connectorKind
    || !targetId
    || !eventScope
    || !messageClass
    || issuedAt === undefined
    || expiresAt === undefined
    || issuedAt >= expiresAt
    || value.explicitUserConsent !== true
    || value.granted !== true
    || value.noAutoPost !== true
    || value.requiresUserApprovalBeforePost !== true
  ) {
    return { ok: false, reason: 'consent_invalid' };
  }
  if (value.reviewed !== true) return { ok: false, reason: 'consent_unreviewed' };
  if (value.workspaceId !== undefined && !workspaceId) return { ok: false, reason: 'consent_invalid' };
  return {
    ok: true,
    value: Object.freeze({
      contract: 'slack-live-delivery-reviewed-consent-v1',
      connectorKind,
      ...(workspaceId ? { workspaceId } : {}),
      targetId,
      eventScope,
      messageClass,
      explicitUserConsent: true,
      granted: true,
      reviewed: true,
      noAutoPost: true,
      requiresUserApprovalBeforePost: true,
      issuedAt,
      expiresAt,
    }),
  };
}

function parseNoisePolicy(value: unknown):
  | { ok: true; value: ParsedNoisePolicy }
  | { ok: false; reason: SlackLiveDeliveryActivationGateReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, NOISE_POLICY_KEYS)) {
    return { ok: false, reason: 'noise_policy_invalid' };
  }
  const connectorKind = safeConnectorKind(value.connectorKind);
  const eventScope = safeEventScope(value.eventScope);
  if (
    value.contract !== 'slack-live-delivery-noise-policy-v1'
    || !connectorKind
    || !eventScope
    || value.reviewState !== 'reviewed'
    || value.rateLimitReviewed !== true
    || value.quietHoursReviewed !== true
    || value.noBurstDelivery !== true
    || typeof value.maxDeliveriesPerHour !== 'number'
    || !Number.isSafeInteger(value.maxDeliveriesPerHour)
    || value.maxDeliveriesPerHour < 1
    || value.maxDeliveriesPerHour > 60
    || typeof value.maxRecipientsPerDelivery !== 'number'
    || !Number.isSafeInteger(value.maxRecipientsPerDelivery)
    || value.maxRecipientsPerDelivery < 1
    || value.maxRecipientsPerDelivery > 20
    || typeof value.suppressDuplicateThreadReplies !== 'boolean'
    || typeof value.requireExplicitCaseMentionForChannels !== 'boolean'
  ) {
    return { ok: false, reason: 'noise_policy_invalid' };
  }
  if (eventScope === 'thread-reply-after-user-post' && value.suppressDuplicateThreadReplies !== true) {
    return { ok: false, reason: 'noise_policy_invalid' };
  }
  if ((eventScope === 'channel-follow-up' || eventScope === 'direct-mention') && value.requireExplicitCaseMentionForChannels !== true) {
    return { ok: false, reason: 'noise_policy_invalid' };
  }
  return {
    ok: true,
    value: Object.freeze({
      contract: 'slack-live-delivery-noise-policy-v1',
      connectorKind,
      eventScope,
      reviewState: 'reviewed',
      rateLimitReviewed: true,
      quietHoursReviewed: true,
      maxDeliveriesPerHour: value.maxDeliveriesPerHour,
      maxRecipientsPerDelivery: value.maxRecipientsPerDelivery,
      suppressDuplicateThreadReplies: value.suppressDuplicateThreadReplies,
      requireExplicitCaseMentionForChannels: value.requireExplicitCaseMentionForChannels,
      noBurstDelivery: true,
    }),
  };
}

function parseDeliveryIntent(value: unknown):
  | { ok: true; value: ParsedIntent }
  | { ok: false; reason: SlackLiveDeliveryActivationGateReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, DELIVERY_INTENT_KEYS)) {
    return { ok: false, reason: 'delivery_intent_invalid' };
  }
  const connectorKind = safeConnectorKind(value.connectorKind);
  const workspaceId = safeIdentifier(value.workspaceId);
  const targetId = safeIdentifier(value.targetId);
  const eventScope = safeEventScope(value.eventScope);
  const messageClass = safeMessageClass(value.messageClass);
  const actionIntent = safeActionIntent(value.actionIntent);
  if (
    value.contract !== 'slack-live-delivery-intent-v1'
    || !connectorKind
    || !targetId
    || !eventScope
    || !messageClass
    || !actionIntent
    || value.notificationOnly !== true
    || value.noAutoPost !== true
    || value.requiresUserApprovalBeforePost !== true
  ) {
    return { ok: false, reason: 'delivery_intent_invalid' };
  }
  if (value.reviewed !== true) return { ok: false, reason: 'delivery_intent_unreviewed' };
  if (value.workspaceId !== undefined && !workspaceId) return { ok: false, reason: 'delivery_intent_invalid' };
  return {
    ok: true,
    value: Object.freeze({
      contract: 'slack-live-delivery-intent-v1',
      connectorKind,
      ...(workspaceId ? { workspaceId } : {}),
      targetId,
      eventScope,
      messageClass,
      actionIntent,
      reviewed: true,
      notificationOnly: true,
      noAutoPost: true,
      requiresUserApprovalBeforePost: true,
    }),
  };
}

function safeCredentialReference(value: unknown):
  | { ok: true; value: SlackLiveDeliveryActivationPlan['credentialReference'] }
  | { ok: false } {
  const validation = validateConnectorCredentialReference(value);
  if (!validation.ok) return { ok: false };
  const reference = validation.reference;
  if (
    reference.kind !== 'external-secret-store'
    && reference.kind !== 'os-keychain'
    && reference.kind !== 'provider-managed-oauth'
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    value: Object.freeze({
      id: reference.id,
      kind: reference.kind,
      storageOwner: reference.storageOwner,
      ...(reference.providerId ? { providerId: reference.providerId } : {}),
      ...(reference.connectorId ? { connectorId: reference.connectorId } : {}),
      ...(reference.accountId ? { accountId: reference.accountId } : {}),
    }),
  };
}

function blocked(
  reason: SlackLiveDeliveryActivationGateReason,
  blockers: readonly SlackLiveDeliveryActivationGateReason[],
): Readonly<SlackLiveDeliveryActivationGateDecision> {
  return Object.freeze({
    status: 'blocked',
    ready: false,
    reason,
    blockers: Object.freeze([...blockers]),
    canPrepareFutureSlackLiveDeliveryActivation: false,
    executable: false,
    sideEffects: 'none',
    requiresUserApprovalBeforePost: true,
    willCallSlackApi: false,
    willCallWebhook: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    willStoreCredential: false,
    willOpenOAuthWindow: false,
    willPostMessage: false,
    willPostThreadReply: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}

export function evaluateSlackLiveDeliveryActivationGate(
  input: unknown,
): Readonly<SlackLiveDeliveryActivationGateDecision> {
  if (!isRuntimeTrustedContractObject(input)) return blocked('invalid_root_shape', ['invalid_root_shape']);
  if (!isRecord(input)) return blocked('invalid_root_shape', ['invalid_root_shape']);
  if (hasForbiddenRuntimeField(input)) return blocked('runtime_shape_forbidden', ['runtime_shape_forbidden']);
  if (hasRawSecretMaterial(input)) return blocked('raw_secret_material', ['raw_secret_material']);
  if (hasForbiddenBranding(input)) return blocked('VENDOR_or_employer_branding_forbidden', ['VENDOR_or_employer_branding_forbidden']);
  if (!hasOnlyKeys(input, ROOT_KEYS)) return blocked('invalid_root_shape', ['invalid_root_shape']);

  const blockers: SlackLiveDeliveryActivationGateReason[] = [];
  const now = input.now === undefined ? Date.now() : safeTimestamp(input.now);
  if (input.now !== undefined && now === undefined) blockers.push('consent_invalid');

  if (input.reviewedTarget === undefined) blockers.push('target_missing');
  if (input.reviewedConsent === undefined) blockers.push('consent_missing');
  if (input.credentialReference === undefined) blockers.push('credential_reference_missing');
  if (input.noisePolicy === undefined) blockers.push('noise_policy_missing');
  if (input.deliveryIntent === undefined) blockers.push('delivery_intent_missing');

  const target = input.reviewedTarget === undefined ? undefined : parseTarget(input.reviewedTarget);
  const consent = input.reviewedConsent === undefined ? undefined : parseConsent(input.reviewedConsent);
  const credentialReference = input.credentialReference === undefined ? undefined : safeCredentialReference(input.credentialReference);
  const noisePolicy = input.noisePolicy === undefined ? undefined : parseNoisePolicy(input.noisePolicy);
  const deliveryIntent = input.deliveryIntent === undefined ? undefined : parseDeliveryIntent(input.deliveryIntent);

  if (target && !target.ok) blockers.push(target.reason);
  if (consent && !consent.ok) blockers.push(consent.reason);
  if (credentialReference && !credentialReference.ok) blockers.push('credential_reference_invalid');
  if (noisePolicy && !noisePolicy.ok) blockers.push(noisePolicy.reason);
  if (deliveryIntent && !deliveryIntent.ok) blockers.push(deliveryIntent.reason);

  if (
    target?.ok
    && consent?.ok
    && noisePolicy?.ok
    && deliveryIntent?.ok
    && credentialReference?.ok
  ) {
    const targetValue = target.value;
    const consentValue = consent.value;
    const noiseValue = noisePolicy.value;
    const intentValue = deliveryIntent.value;
    const credentialValue = credentialReference.value;

    if (
      targetValue.connectorKind !== consentValue.connectorKind
      || targetValue.connectorKind !== noiseValue.connectorKind
      || targetValue.connectorKind !== intentValue.connectorKind
      || targetValue.eventScope !== consentValue.eventScope
      || targetValue.eventScope !== noiseValue.eventScope
      || targetValue.eventScope !== intentValue.eventScope
      || targetValue.targetId !== consentValue.targetId
      || targetValue.targetId !== intentValue.targetId
      || consentValue.messageClass !== intentValue.messageClass
    ) {
      blockers.push('delivery_intent_binding_invalid');
    }

    if (
      (targetValue.workspaceId ?? undefined) !== (consentValue.workspaceId ?? undefined)
      || (targetValue.workspaceId ?? undefined) !== (intentValue.workspaceId ?? undefined)
    ) {
      blockers.push('consent_binding_invalid');
    }

    if (!validActionScope(targetValue.targetKind, targetValue.eventScope, intentValue.actionIntent)) {
      blockers.push('delivery_intent_binding_invalid');
    }

    if (now !== undefined && consentValue.issuedAt > now) blockers.push('consent_invalid');
    if (now !== undefined && consentValue.expiresAt <= now) blockers.push('consent_expired');

    if (
      credentialValue.providerId !== undefined
      && credentialValue.providerId !== targetValue.connectorKind
    ) {
      blockers.push('credential_reference_owner_invalid');
    }
    if (
      credentialValue.connectorId !== undefined
      && credentialValue.connectorId !== 'messaging'
    ) {
      blockers.push('credential_reference_owner_invalid');
    }
    if (
      targetValue.workspaceId
      && credentialValue.accountId !== undefined
      && credentialValue.accountId !== targetValue.workspaceId
    ) {
      blockers.push('credential_reference_owner_invalid');
    }
    if (
      targetValue.targetKind === 'webhook-reference'
      && credentialValue.kind === 'provider-managed-oauth'
    ) {
      blockers.push('credential_reference_owner_invalid');
    }
    if (
      intentValue.noAutoPost !== true
      || intentValue.requiresUserApprovalBeforePost !== true
      || consentValue.noAutoPost !== true
      || consentValue.requiresUserApprovalBeforePost !== true
    ) {
      blockers.push('delivery_intent_no_auto_post_required');
    }
  }

  if (blockers.length > 0) return blocked(blockers[0], blockers);

  const targetValue = (target as { ok: true; value: ParsedTarget }).value;
  const consentValue = (consent as { ok: true; value: ParsedConsent }).value;
  const noiseValue = (noisePolicy as { ok: true; value: ParsedNoisePolicy }).value;
  const intentValue = (deliveryIntent as { ok: true; value: ParsedIntent }).value;
  const credentialValue = (credentialReference as { ok: true; value: SlackLiveDeliveryActivationPlan['credentialReference'] }).value;

  const plan: SlackLiveDeliveryActivationPlan = Object.freeze({
    contract: 'slack-live-delivery-activation-plan-v1',
    connectorKind: targetValue.connectorKind,
    ...(targetValue.workspaceId ? { workspaceId: targetValue.workspaceId } : {}),
    target: Object.freeze({
      kind: targetValue.targetKind,
      id: targetValue.targetId,
      label: targetValue.targetLabel,
      ...(targetValue.threadRootId ? { threadRootId: targetValue.threadRootId } : {}),
    }),
    eventScope: targetValue.eventScope,
    messageClass: consentValue.messageClass,
    actionIntent: intentValue.actionIntent,
    credentialReference: credentialValue,
    consentWindow: Object.freeze({
      issuedAt: consentValue.issuedAt,
      expiresAt: consentValue.expiresAt,
    }),
    noisePolicy: Object.freeze({
      maxDeliveriesPerHour: noiseValue.maxDeliveriesPerHour,
      maxRecipientsPerDelivery: noiseValue.maxRecipientsPerDelivery,
      suppressDuplicateThreadReplies: noiseValue.suppressDuplicateThreadReplies,
      requireExplicitCaseMentionForChannels: noiseValue.requireExplicitCaseMentionForChannels,
      noBurstDelivery: true,
    }),
    reviewedTarget: true,
    reviewedConsent: true,
    reviewedNoisePolicy: true,
    reviewedDeliveryIntent: true,
    noAutoPost: true,
    notificationOnly: true,
    requiresUserApprovalBeforePost: true,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: PLAN_BOUNDARY,
  });

  return Object.freeze({
    status: 'ready',
    ready: true,
    reason: 'slack_live_delivery_activation_gate_ready',
    blockers: Object.freeze([]),
    plan,
    canPrepareFutureSlackLiveDeliveryActivation: true,
    executable: false,
    sideEffects: 'none',
    requiresUserApprovalBeforePost: true,
    willCallSlackApi: false,
    willCallWebhook: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    willStoreCredential: false,
    willOpenOAuthWindow: false,
    willPostMessage: false,
    willPostThreadReply: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}
