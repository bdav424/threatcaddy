import { hasConnectorSecretMaterial } from './connector-credential-boundary';
import {
  hasMessagingSecretMaterial,
  type MessagingConnectorEventClass,
  type MessagingConnectorKind,
} from './messaging-connector-policy';
import {
  isTrustedMessagingDeliveryAdapterPlan,
  type MessagingDeliveryAdapterPlan,
  type MessagingDeliveryTargetKind,
} from './messaging-delivery-adapter-plan';
import type { MessagingExecutionAction } from './messaging-execution-gate';
import {
  isTrustedMessagingAdapterDryRunHarnessMetadata,
  type MessagingAdapterDryRunHarnessMetadata,
} from './messaging-adapter-dry-run-harness';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractValue,
} from './runtime-trusted-contract-object';

export type MessagingDeliveryExecutionBoundaryStatus = 'ready' | 'blocked';

export type MessagingDeliveryExecutionBoundaryReason =
  | 'delivery_execution_boundary_ready'
  | 'delivery_shape_forbidden'
  | 'plan_missing'
  | 'plan_not_planned'
  | 'plan_not_inert'
  | 'plan_expired'
  | 'dry_run_harness_missing'
  | 'dry_run_harness_blocked'
  | 'dry_run_harness_boundary_invalid'
  | 'dry_run_harness_mismatch'
  | 'adapter_facts_missing'
  | 'adapter_facts_unreviewed'
  | 'adapter_boundary_invalid'
  | 'adapter_owner_mismatch'
  | 'adapter_target_unredacted'
  | 'delivery_result_forbidden'
  | 'delivery_result_live_claim'
  | 'identifier_unsafe'
  | 'raw_secret_material';

export interface MessagingDeliveryExecutionAdapterFacts {
  contract: 'messaging-delivery-execution-adapter-facts-v1';
  adapterId: string;
  runtimeOwner: string;
  action: MessagingExecutionAction;
  connectorKind: MessagingConnectorKind;
  eventScope: MessagingConnectorEventClass;
  credentialReferenceId: string;
  target: {
    kind: MessagingDeliveryTargetKind;
    redaction: 'target-id-omitted';
  };
  planExpiresAt: number;
  noAutoPost: true;
  deliveryMode: 'dry-run-only';
  executable: false;
  willPostMessage: false;
  willCallWebhook: false;
  willStoreCredential: false;
  sideEffectBoundary: 'adapter-facts-only-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send';
}

export interface MessagingDeliveryExecutionBoundaryInput {
  plan?: MessagingDeliveryAdapterPlan | null;
  dryRunHarness?: MessagingAdapterDryRunHarnessMetadata | null;
  adapterFacts?: unknown;
  deliveryResult?: unknown;
  now?: number;
}

export interface MessagingDeliveryExecutionBoundaryDecision {
  status: MessagingDeliveryExecutionBoundaryStatus;
  ready: boolean;
  reason: MessagingDeliveryExecutionBoundaryReason;
  adapterId?: string;
  runtimeOwner?: string;
  action?: MessagingExecutionAction | 'unsupported';
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
  target?: {
    kind: MessagingDeliveryTargetKind;
    redaction: 'target-id-omitted';
  };
  planExpiresAt?: number;
  canBindInjectedAdapter: boolean;
  deliveryMode: 'dry-run-only';
  executable: false;
  willPostMessage: false;
  willCallWebhook: false;
  willStoreCredential: false;
  sideEffectBoundary: 'pure-local-delivery-execution-boundary-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send';
}

const PLAN_BOUNDARY = 'pure-local-delivery-plan-no-fetch-no-webhook-no-slack-api-no-storage-no-send';
const HARNESS_BOUNDARY = 'pure-local-dry-run-harness-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send';
const ADAPTER_FACTS_BOUNDARY = 'adapter-facts-only-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send';
const DECISION_BOUNDARY = 'pure-local-delivery-execution-boundary-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send' as const;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{2,180}$/;
const TOKEN_OR_URL_PATTERN =
  /(?:^(?!vault:)[a-z][a-z0-9+.-]*:[^/]|[a-z][a-z0-9+.-]*:\/\/|\/\/\S+|(?:^|[/:@])hooks\.slack(?:-gov)?\.com\/services\/|(?:^|[/:@])(?:api|auth|oauth|login|graph|mail|smtp|imap|accounts|webhook|hooks)\.[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)|(?:^|[/:@])(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\/|xox[abprs]-|bearer\s+[a-z0-9._~+/=-]{8,}|(?:api|app|bot|client|refresh|access)[_-]?(?:key|token|secret)[=:]\s*\S+)/i;
const SUPPORTED_ACTIONS = new Set<MessagingExecutionAction>([
  'dry-run-notification',
  'post-message',
  'post-thread-reply',
  'webhook-delivery',
  'disable-connector',
  'revoke-credential-reference',
]);
const SUPPORTED_CONNECTOR_KINDS = new Set<MessagingConnectorKind>(['slack', 'generic-webhook']);
const SUPPORTED_EVENT_SCOPES = new Set<MessagingConnectorEventClass>([
  'direct-mention',
  'one-to-one-dm',
  'group-dm',
  'thread-reply-after-user-post',
  'channel-follow-up',
  'webhook-alert',
]);
const SUPPORTED_TARGET_KINDS = new Set<MessagingDeliveryTargetKind>([
  'slack-channel',
  'slack-dm',
  'slack-thread',
  'webhook-handle',
]);
const ROOT_INPUT_KEYS = new Set([
  'adapterFacts',
  'deliveryResult',
  'dryRunHarness',
  'now',
  'plan',
]);
const DRY_RUN_HARNESS_KEYS = new Set([
  'accepted',
  'action',
  'adapterId',
  'connectorKind',
  'credentialReference',
  'eventScope',
  'executable',
  'planExpiresAt',
  'reason',
  'runtimeOwner',
  'sideEffectBoundary',
  'status',
  'target',
  'willCallWebhook',
  'willPostMessage',
  'willStoreCredential',
]);
const DRY_RUN_HARNESS_CREDENTIAL_REFERENCE_KEYS = new Set([
  'accountId',
  'connectorId',
  'id',
  'kind',
  'providerId',
  'storageOwner',
]);
const EMPTY_ALLOWED_TRANSPORT_KEYS = new Set<string>();
const INERT_PROVENANCE_TRANSPORT_KEYS = new Set([
  'storageOwner',
  'willCallWebhook',
  'willPostMessage',
  'willStoreCredential',
]);
const ADAPTER_FACT_KEYS = [
  'action',
  'adapterId',
  'connectorKind',
  'contract',
  'credentialReferenceId',
  'deliveryMode',
  'eventScope',
  'executable',
  'noAutoPost',
  'planExpiresAt',
  'runtimeOwner',
  'sideEffectBoundary',
  'target',
  'willCallWebhook',
  'willPostMessage',
  'willStoreCredential',
] as const;

function trustedDecision(
  entries: readonly RuntimeTrustedContractEntry[],
): Readonly<MessagingDeliveryExecutionBoundaryDecision> {
  return createRuntimeTrustedContractObject(entries) as unknown as Readonly<MessagingDeliveryExecutionBoundaryDecision>;
}

function trustedDecisionCredentialReference(
  reference: MessagingDeliveryExecutionBoundaryDecision['credentialReference'],
): MessagingDeliveryExecutionBoundaryDecision['credentialReference'] {
  if (!reference) return undefined;
  const entries: RuntimeTrustedContractEntry[] = [
    ['id', reference.id],
    ['kind', reference.kind],
  ];
  if (reference.storageOwner !== undefined) entries.push(['storageOwner', reference.storageOwner]);
  if (reference.providerId !== undefined) entries.push(['providerId', reference.providerId]);
  if (reference.connectorId !== undefined) entries.push(['connectorId', reference.connectorId]);
  if (reference.accountId !== undefined) entries.push(['accountId', reference.accountId]);
  return createRuntimeTrustedContractObject(entries) as unknown as NonNullable<
    MessagingDeliveryExecutionBoundaryDecision['credentialReference']
  >;
}

function trustedDecisionTarget(
  target: MessagingDeliveryExecutionBoundaryDecision['target'],
): MessagingDeliveryExecutionBoundaryDecision['target'] {
  if (!target) return undefined;
  return createRuntimeTrustedContractObject([
    ['kind', target.kind],
    ['redaction', 'target-id-omitted'],
  ]) as unknown as NonNullable<MessagingDeliveryExecutionBoundaryDecision['target']>;
}

export function createMessagingDeliveryExecutionBoundaryInput(
  entries: readonly RuntimeTrustedContractEntry[],
): MessagingDeliveryExecutionBoundaryInput {
  return createRuntimeTrustedContractObject(entries) as unknown as MessagingDeliveryExecutionBoundaryInput;
}

export function createMessagingDeliveryExecutionAdapterFacts(
  entries: readonly RuntimeTrustedContractEntry[],
): MessagingDeliveryExecutionAdapterFacts {
  return createRuntimeTrustedContractObject(entries) as unknown as MessagingDeliveryExecutionAdapterFacts;
}

export function isTrustedMessagingDeliveryExecutionBoundaryDecision(
  value: unknown,
): value is Readonly<MessagingDeliveryExecutionBoundaryDecision> {
  return isRuntimeTrustedContractObject(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function snapshotRootInput(
  value: unknown,
  expected: ReadonlySet<string>,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return undefined;
  }
  const snapshot: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!expected.has(key) || !('value' in descriptor) || descriptor.get || descriptor.set) return undefined;
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function valueHasUnsafeDescriptorOrFunction(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return false;
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (
    value instanceof Map
    || value instanceof Set
    || value instanceof WeakMap
    || value instanceof WeakSet
  ) {
    return true;
  }
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return true;
  }
  return Object.values(descriptors).some((descriptor) => {
    if (!('value' in descriptor) || descriptor.get || descriptor.set) return true;
    return valueHasUnsafeDescriptorOrFunction(descriptor.value, seen);
  });
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => expected.has(key));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || !SAFE_ID_PATTERN.test(trimmed) || TOKEN_OR_URL_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function isMessagingExecutionAction(value: unknown): value is MessagingExecutionAction {
  return typeof value === 'string' && SUPPORTED_ACTIONS.has(value as MessagingExecutionAction);
}

function isMessagingConnectorKind(value: unknown): value is MessagingConnectorKind {
  return typeof value === 'string' && SUPPORTED_CONNECTOR_KINDS.has(value as MessagingConnectorKind);
}

function isMessagingEventScope(value: unknown): value is MessagingConnectorEventClass {
  return typeof value === 'string' && SUPPORTED_EVENT_SCOPES.has(value as MessagingConnectorEventClass);
}

function isMessagingTargetKind(value: unknown): value is MessagingDeliveryTargetKind {
  return typeof value === 'string' && SUPPORTED_TARGET_KINDS.has(value as MessagingDeliveryTargetKind);
}

function targetKindMatchesConnectorKind(
  connectorKind: MessagingConnectorKind,
  targetKind: MessagingDeliveryTargetKind,
): boolean {
  if (connectorKind === 'generic-webhook') return targetKind === 'webhook-handle';
  return targetKind === 'slack-channel' || targetKind === 'slack-dm' || targetKind === 'slack-thread';
}

function unsafeIdentifier(value: unknown): boolean {
  return value !== undefined && safeIdentifier(value) === undefined;
}

function currentTime(value: unknown): number | undefined {
  if (value === undefined) return Date.now();
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function planExpiresAfter(plan: MessagingDeliveryAdapterPlan, now: number): boolean {
  const expiresAt = plan.planExpiresAt;
  return typeof expiresAt === 'number' && Number.isSafeInteger(expiresAt) && expiresAt > now;
}

function planIsInert(plan: MessagingDeliveryAdapterPlan): boolean {
  return plan.inert === true
    && plan.executable === false
    && plan.willPostMessage === false
    && plan.willCallWebhook === false
    && plan.willStoreCredential === false
    && plan.sideEffectBoundary === PLAN_BOUNDARY;
}

function dryRunHarnessCredentialReferenceIsExact(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return hasOnlyAllowedKeys(value, DRY_RUN_HARNESS_CREDENTIAL_REFERENCE_KEYS)
    && safeIdentifier(value.id) !== undefined
    && safeIdentifier(value.kind) !== undefined
    && (value.storageOwner === undefined || safeIdentifier(value.storageOwner) !== undefined)
    && (value.providerId === undefined || safeIdentifier(value.providerId) !== undefined)
    && (value.connectorId === undefined || safeIdentifier(value.connectorId) !== undefined)
    && (value.accountId === undefined || safeIdentifier(value.accountId) !== undefined);
}

function harnessBoundaryIsInert(harness: MessagingAdapterDryRunHarnessMetadata): boolean {
  return hasOnlyAllowedKeys(harness as unknown as Record<string, unknown>, DRY_RUN_HARNESS_KEYS)
    && harness.status === 'accepted'
    && harness.accepted === true
    && harness.reason === 'dry_run_result_accepted'
    && safeIdentifier(harness.adapterId) !== undefined
    && safeIdentifier(harness.runtimeOwner) !== undefined
    && harness.action === 'dry-run-notification'
    && isMessagingConnectorKind(harness.connectorKind)
    && isMessagingEventScope(harness.eventScope)
    && dryRunHarnessCredentialReferenceIsExact(harness.credentialReference)
    && targetIsRedacted(harness.target)
    && targetKindMatchesConnectorKind(harness.connectorKind, harness.target.kind)
    && Number.isSafeInteger(harness.planExpiresAt)
    && harness.executable === false
    && harness.willPostMessage === false
    && harness.willCallWebhook === false
    && harness.willStoreCredential === false
    && harness.sideEffectBoundary === HARNESS_BOUNDARY;
}

function credentialReferencesMatch(
  plan: MessagingDeliveryAdapterPlan,
  harness: MessagingAdapterDryRunHarnessMetadata,
): boolean {
  const planCredential = plan.credentialReference;
  const harnessCredential = harness.credentialReference;
  if (!planCredential || !harnessCredential) return false;
  return planCredential.id === harnessCredential.id
    && planCredential.kind === harnessCredential.kind
    && planCredential.storageOwner === harnessCredential.storageOwner
    && planCredential.providerId === harnessCredential.providerId
    && planCredential.connectorId === harnessCredential.connectorId
    && planCredential.accountId === harnessCredential.accountId;
}

function harnessMatchesPlan(
  plan: MessagingDeliveryAdapterPlan,
  harness: MessagingAdapterDryRunHarnessMetadata,
): boolean {
  return harness.adapterId === plan.adapterId
    && harness.runtimeOwner === plan.runtimeOwner
    && harness.action === plan.action
    && harness.connectorKind === plan.connectorKind
    && harness.eventScope === plan.eventScope
    && harness.target?.kind === plan.target?.kind
    && harness.planExpiresAt === plan.planExpiresAt
    && credentialReferencesMatch(plan, harness);
}

function targetIsRedacted(value: unknown): value is MessagingDeliveryExecutionAdapterFacts['target'] {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === 2
    && keys[0] === 'kind'
    && keys[1] === 'redaction'
    && isMessagingTargetKind(value.kind)
    && value.redaction === 'target-id-omitted'
    && !TOKEN_OR_URL_PATTERN.test(value.kind);
}

function adapterFactsAreReviewed(value: unknown): value is MessagingDeliveryExecutionAdapterFacts {
  if (!isRecord(value) || !exactKeys(value, ADAPTER_FACT_KEYS)) return false;
  return value.contract === 'messaging-delivery-execution-adapter-facts-v1'
    && typeof value.adapterId === 'string'
    && typeof value.runtimeOwner === 'string'
    && isMessagingExecutionAction(value.action)
    && isMessagingConnectorKind(value.connectorKind)
    && isMessagingEventScope(value.eventScope)
    && typeof value.credentialReferenceId === 'string'
    && targetIsRedacted(value.target)
    && targetKindMatchesConnectorKind(value.connectorKind, value.target.kind)
    && Number.isSafeInteger(value.planExpiresAt)
    && value.noAutoPost === true
    && value.deliveryMode === 'dry-run-only'
    && value.executable === false
    && value.willPostMessage === false
    && value.willCallWebhook === false
    && value.willStoreCredential === false
    && value.sideEffectBoundary === ADAPTER_FACTS_BOUNDARY;
}

function valueContainsForbiddenCallbackOrTransport(
  value: unknown,
  seen = new WeakSet<object>(),
  allowedTransportKeys: ReadonlySet<string> = EMPTY_ALLOWED_TRANSPORT_KEYS,
): boolean {
  if (typeof value === 'function') return true;
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const forbiddenKeys = [
    'callback',
    'eventSource',
    'fetch',
    'httpClient',
    'invoke',
    'liveAction',
    'localStorage',
    'onResult',
    'postMessage',
    'readStorage',
    'request',
    'requester',
    'send',
    'sessionStorage',
    'slackClient',
    'socket',
    'storage',
    'storageAdapter',
    'transport',
    'webSocket',
    'webhook',
    'webhookUrl',
    'writeStorage',
  ];
  const checkPair = (key: unknown, nested: unknown): boolean => {
    if (typeof key !== 'string') {
      return valueContainsForbiddenCallbackOrTransport(key, seen, allowedTransportKeys)
        || valueContainsForbiddenCallbackOrTransport(nested, seen, allowedTransportKeys);
    }
    const normalized = key.toLowerCase();
    const compactNormalized = normalized.replace(/[^a-z0-9]/g, '');
    if (forbiddenKeys.some((forbidden) => {
      const compactForbidden = forbidden.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalized.includes(forbidden.toLowerCase()) || compactNormalized.includes(compactForbidden);
    }) && !allowedTransportKeys.has(key)) return true;
    return valueContainsForbiddenCallbackOrTransport(nested, seen, allowedTransportKeys);
  };
  if (Array.isArray(value)) return value.some((nested) => (
    valueContainsForbiddenCallbackOrTransport(nested, seen, allowedTransportKeys)
  ));
  if (value instanceof Map) {
    for (const [key, nested] of value.entries()) {
      if (checkPair(key, nested)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nested of value.values()) {
      if (valueContainsForbiddenCallbackOrTransport(nested, seen, allowedTransportKeys)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nested]) => checkPair(key, nested));
}

function valueContainsForbiddenProvenanceResidual(value: unknown): boolean {
  return valueContainsForbiddenCallbackOrTransport(
    value,
    new WeakSet<object>(),
    INERT_PROVENANCE_TRANSPORT_KEYS,
  );
}

function adapterFactsHaveUnsafeIdentifiers(facts: MessagingDeliveryExecutionAdapterFacts): boolean {
  return [
    facts.adapterId,
    facts.runtimeOwner,
    facts.action,
    facts.connectorKind,
    facts.eventScope,
    facts.credentialReferenceId,
    facts.target.kind,
  ].some(unsafeIdentifier);
}

function adapterFactsMatch(
  plan: MessagingDeliveryAdapterPlan,
  harness: MessagingAdapterDryRunHarnessMetadata,
  facts: MessagingDeliveryExecutionAdapterFacts,
): boolean {
  return facts.adapterId === plan.adapterId
    && facts.adapterId === harness.adapterId
    && facts.runtimeOwner === plan.runtimeOwner
    && facts.runtimeOwner === harness.runtimeOwner
    && facts.action === plan.action
    && facts.action === harness.action
    && facts.connectorKind === plan.connectorKind
    && facts.connectorKind === harness.connectorKind
    && facts.eventScope === plan.eventScope
    && facts.eventScope === harness.eventScope
    && facts.credentialReferenceId === plan.credentialReference?.id
    && facts.credentialReferenceId === harness.credentialReference?.id
    && facts.target.kind === plan.target?.kind
    && facts.target.kind === harness.target?.kind
    && facts.planExpiresAt === plan.planExpiresAt
    && facts.planExpiresAt === harness.planExpiresAt;
}

function deliveryResultClaimsLiveDelivery(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (valueContainsForbiddenCallbackOrTransport(value)) return true;
  if (Array.isArray(value)) return value.some((nested) => deliveryResultClaimsLiveDelivery(nested, seen));
  if (value instanceof Map) {
    for (const [key, nested] of value.entries()) {
      if (deliveryResultClaimsLiveDelivery(key, seen) || deliveryResultClaimsLiveDelivery(nested, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nested of value.values()) {
      if (deliveryResultClaimsLiveDelivery(nested, seen)) return true;
    }
    return false;
  }
  if (!isRecord(value)) return false;
  if (
    value.delivered === true
    || value.sent === true
    || value.posted === true
    || value.calledWebhook === true
    || value.storedCredential === true
    || value.willPostMessage === true
    || value.willCallWebhook === true
    || value.willStoreCredential === true
    || value.executable === true
  ) {
    return true;
  }
  return Object.values(value).some((nested) => deliveryResultClaimsLiveDelivery(nested, seen));
}

function summarizeCredentialReference(
  plan: MessagingDeliveryAdapterPlan | null | undefined,
): MessagingDeliveryExecutionBoundaryDecision['credentialReference'] | undefined {
  const reference = plan?.credentialReference;
  if (!reference) return undefined;
  const summary: NonNullable<MessagingDeliveryExecutionBoundaryDecision['credentialReference']> = {
    id: safeIdentifier(reference.id) ?? 'redacted-unsafe-credential-reference',
    kind: safeIdentifier(reference.kind) ?? 'redacted-unsafe-credential-kind',
  };
  const storageOwner = safeIdentifier(reference.storageOwner);
  const providerId = safeIdentifier(reference.providerId);
  const connectorId = safeIdentifier(reference.connectorId);
  const accountId = safeIdentifier(reference.accountId);
  if (storageOwner) summary.storageOwner = storageOwner;
  if (providerId) summary.providerId = providerId;
  if (connectorId) summary.connectorId = connectorId;
  if (accountId) summary.accountId = accountId;
  return Object.freeze(summary);
}

function freezeDecision(
  reason: MessagingDeliveryExecutionBoundaryReason,
  input: MessagingDeliveryExecutionBoundaryInput,
): Readonly<MessagingDeliveryExecutionBoundaryDecision> {
  const plan = input.plan;
  const ready = reason === 'delivery_execution_boundary_ready';
  const safeAction = isMessagingExecutionAction(plan?.action) ? plan.action : undefined;
  const safeConnectorKind = isMessagingConnectorKind(plan?.connectorKind) ? plan.connectorKind : undefined;
  const safeEventScope = isMessagingEventScope(plan?.eventScope) ? plan.eventScope : undefined;
  const planExpiresAt = plan?.planExpiresAt;
  const safeTargetKind = isMessagingTargetKind(plan?.target?.kind) && safeIdentifier(plan.target.kind)
    ? plan.target.kind
    : undefined;
  const safePlanExpiresAt = typeof planExpiresAt === 'number' && Number.isSafeInteger(planExpiresAt)
    ? planExpiresAt
    : undefined;
  const entries: RuntimeTrustedContractEntry[] = [
    ['status', ready ? 'ready' : 'blocked'],
    ['ready', ready],
    ['reason', reason],
    ['canBindInjectedAdapter', ready],
    ['deliveryMode', 'dry-run-only'],
    ['executable', false],
    ['willPostMessage', false],
    ['willCallWebhook', false],
    ['willStoreCredential', false],
    ['sideEffectBoundary', DECISION_BOUNDARY],
  ];
  const adapterId = safeIdentifier(plan?.adapterId);
  const runtimeOwner = safeIdentifier(plan?.runtimeOwner);
  if (adapterId !== undefined) entries.push(['adapterId', adapterId]);
  if (runtimeOwner !== undefined) entries.push(['runtimeOwner', runtimeOwner]);
  if (safeAction !== undefined) entries.push(['action', safeAction]);
  if (safeConnectorKind !== undefined) entries.push(['connectorKind', safeConnectorKind]);
  if (safeEventScope !== undefined) entries.push(['eventScope', safeEventScope]);
  const credentialReference = trustedDecisionCredentialReference(summarizeCredentialReference(plan));
  if (credentialReference !== undefined) {
    entries.push(['credentialReference', credentialReference as unknown as RuntimeTrustedContractValue]);
  }
  const target = trustedDecisionTarget(safeTargetKind
    ? {
        kind: safeTargetKind,
        redaction: 'target-id-omitted' as const,
      }
    : undefined);
  if (target !== undefined) entries.push(['target', target as unknown as RuntimeTrustedContractValue]);
  if (safePlanExpiresAt !== undefined) entries.push(['planExpiresAt', safePlanExpiresAt]);
  return trustedDecision(entries);
}

export function evaluateMessagingDeliveryExecutionBoundary(
  input: MessagingDeliveryExecutionBoundaryInput = {},
): Readonly<MessagingDeliveryExecutionBoundaryDecision> {
  if (!isRuntimeTrustedContractObject(input)) {
    return freezeDecision('delivery_shape_forbidden', {});
  }
  const safeInput = snapshotRootInput(input, ROOT_INPUT_KEYS);
  if (!safeInput || !hasOnlyAllowedKeys(safeInput, ROOT_INPUT_KEYS)) {
    return freezeDecision('delivery_shape_forbidden', {});
  }
  if (valueHasUnsafeDescriptorOrFunction(safeInput)) return freezeDecision('delivery_shape_forbidden', {});

  const boundaryInput = safeInput as MessagingDeliveryExecutionBoundaryInput;
  if (
    (boundaryInput.plan !== undefined
      && boundaryInput.plan !== null
      && !isTrustedMessagingDeliveryAdapterPlan(boundaryInput.plan))
    || (boundaryInput.dryRunHarness !== undefined
      && boundaryInput.dryRunHarness !== null
      && !isTrustedMessagingAdapterDryRunHarnessMetadata(boundaryInput.dryRunHarness))
    || (boundaryInput.adapterFacts !== undefined && !isRuntimeTrustedContractObject(boundaryInput.adapterFacts))
    || (boundaryInput.deliveryResult !== undefined && !isRuntimeTrustedContractObject(boundaryInput.deliveryResult))
  ) {
    return freezeDecision('delivery_shape_forbidden', {});
  }
  const plan = boundaryInput.plan;
  const harness = boundaryInput.dryRunHarness;
  const adapterFacts = boundaryInput.adapterFacts;
  const deliveryResult = boundaryInput.deliveryResult;
  const now = currentTime(boundaryInput.now);
  if (now === undefined) return freezeDecision('delivery_shape_forbidden', {});

  if (!plan) return freezeDecision('plan_missing', boundaryInput);
  if (
    hasMessagingSecretMaterial(plan)
    || hasConnectorSecretMaterial(plan)
    || hasMessagingSecretMaterial(harness)
    || hasConnectorSecretMaterial(harness)
    || hasMessagingSecretMaterial(adapterFacts)
    || hasConnectorSecretMaterial(adapterFacts)
    || hasMessagingSecretMaterial(deliveryResult)
    || hasConnectorSecretMaterial(deliveryResult)
  ) {
    return freezeDecision('raw_secret_material', boundaryInput);
  }
  if (
    valueContainsForbiddenProvenanceResidual(plan)
    || valueContainsForbiddenProvenanceResidual(harness)
    || valueContainsForbiddenProvenanceResidual(adapterFacts)
  ) {
    return freezeDecision('delivery_shape_forbidden', boundaryInput);
  }
  if (!planIsInert(plan)) return freezeDecision('plan_not_inert', boundaryInput);
  if (plan.status !== 'planned' || plan.planned !== true || plan.action !== 'dry-run-notification') {
    return freezeDecision('plan_not_planned', boundaryInput);
  }
  if (!planExpiresAfter(plan, now)) return freezeDecision('plan_expired', boundaryInput);
  if (!harness) return freezeDecision('dry_run_harness_missing', boundaryInput);
  if (harness.status !== 'accepted' || harness.accepted !== true) {
    return freezeDecision('dry_run_harness_blocked', boundaryInput);
  }
  if (!harnessBoundaryIsInert(harness)) return freezeDecision('dry_run_harness_boundary_invalid', boundaryInput);
  if (!harnessMatchesPlan(plan, harness)) return freezeDecision('dry_run_harness_mismatch', boundaryInput);
  if (!adapterFacts) return freezeDecision('adapter_facts_missing', boundaryInput);
  if (!adapterFactsAreReviewed(adapterFacts)) {
    return targetIsRedacted(isRecord(adapterFacts) ? adapterFacts.target : undefined)
      ? freezeDecision('adapter_facts_unreviewed', boundaryInput)
      : freezeDecision('adapter_target_unredacted', boundaryInput);
  }
  if (adapterFactsHaveUnsafeIdentifiers(adapterFacts)) return freezeDecision('identifier_unsafe', boundaryInput);
  if (!adapterFactsMatch(plan, harness, adapterFacts)) {
    return freezeDecision('adapter_owner_mismatch', boundaryInput);
  }
  if (
    adapterFacts.noAutoPost !== true
    || adapterFacts.deliveryMode !== 'dry-run-only'
    || adapterFacts.executable !== false
    || adapterFacts.willPostMessage !== false
    || adapterFacts.willCallWebhook !== false
    || adapterFacts.willStoreCredential !== false
    || adapterFacts.sideEffectBoundary !== ADAPTER_FACTS_BOUNDARY
  ) {
    return freezeDecision('adapter_boundary_invalid', boundaryInput);
  }
  if (deliveryResult !== undefined) {
    return freezeDecision(
      deliveryResultClaimsLiveDelivery(deliveryResult) ? 'delivery_result_live_claim' : 'delivery_result_forbidden',
      boundaryInput,
    );
  }

  return freezeDecision('delivery_execution_boundary_ready', boundaryInput);
}
