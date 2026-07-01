import { hasConnectorSecretMaterial } from './connector-credential-boundary';
import type {
  MessagingAdapterDryRunHarnessMetadata,
} from './messaging-adapter-dry-run-harness';
import { isTrustedMessagingAdapterDryRunHarnessMetadata } from './messaging-adapter-dry-run-harness';
import {
  hasMessagingSecretMaterial,
  type MessagingConnectorEventClass,
  type MessagingConnectorKind,
} from './messaging-connector-policy';
import type { MessagingDeliveryTargetKind } from './messaging-delivery-adapter-plan';
import type {
  MessagingDeliveryExecutionBoundaryDecision,
} from './messaging-delivery-execution-boundary';
import { isTrustedMessagingDeliveryExecutionBoundaryDecision } from './messaging-delivery-execution-boundary';
import type { MessagingExecutionAction } from './messaging-execution-gate';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractValue,
} from './runtime-trusted-contract-object';

export type MessagingAdapterInvocationImplementationStatus = 'ready' | 'blocked';

export type MessagingAdapterInvocationImplementationReason =
  | 'adapter_invocation_boundary_ready'
  | 'execution_boundary_missing'
  | 'execution_boundary_not_ready'
  | 'execution_boundary_invalid'
  | 'execution_boundary_expired'
  | 'dry_run_harness_missing'
  | 'dry_run_harness_blocked'
  | 'dry_run_harness_boundary_invalid'
  | 'dry_run_harness_mismatch'
  | 'adapter_facts_missing'
  | 'adapter_facts_unreviewed'
  | 'adapter_owner_mismatch'
  | 'adapter_identity_unsafe'
  | 'adapter_side_effect_boundary_invalid'
  | 'adapter_contract_unreviewed'
  | 'adapter_contract_owner_mismatch'
  | 'adapter_shape_forbidden'
  | 'adapter_result_forbidden'
  | 'adapter_result_live_claim'
  | 'raw_secret_material';

export interface MessagingAdapterInvocationFacts {
  contract: 'messaging-adapter-invocation-implementation-facts-v1';
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
  adapterImplementationId: string;
  adapterVersion: string;
  noAutoPost: true;
  invocationMode: 'decision-only';
  executable: false;
  adapterCallable: false;
  willInvokeAdapter: false;
  willPostMessage: false;
  willCallWebhook: false;
  willStoreCredential: false;
  sideEffectBoundary: 'adapter-invocation-facts-only-no-callback-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send';
}

export interface MessagingAdapterInvocationExecutableContract {
  contract: 'messaging-adapter-invocation-executable-contract-v1';
  adapterId: string;
  runtimeOwner: string;
  action: 'dry-run-notification';
  connectorKind: MessagingConnectorKind;
  eventScope: MessagingConnectorEventClass;
  credentialReferenceId: string;
  target: {
    kind: MessagingDeliveryTargetKind;
    redaction: 'target-id-omitted';
  };
  planExpiresAt: number;
  adapterImplementationId: string;
  adapterVersion: string;
  reviewed: true;
  noAutoPost: true;
  invocationMode: 'reviewed-injected-adapter-contract';
  targetBinding: 'execution-boundary-redacted-target';
  provenanceBinding: 'execution-boundary-and-adapter-facts';
  resultRedaction: 'safe-result-metadata-only';
  executable: false;
  adapterCallable: false;
  importsSlackSdk: false;
  willInvokeAdapter: false;
  willPostMessage: false;
  willCallWebhook: false;
  willFetch: false;
  willOpenSocket: false;
  willMutateStorage: false;
  willResolveCredential: false;
  willReadStorage: false;
  willWriteStorage: false;
  willStoreCredential: false;
  sideEffectBoundary: 'reviewed-injected-adapter-executable-contract-no-callback-no-requester-no-fetch-no-socket-no-storage-no-slack-sdk-no-webhook-url-no-send';
}

export interface MessagingAdapterInvocationImplementationInput {
  executionBoundary?: MessagingDeliveryExecutionBoundaryDecision | null;
  dryRunHarness?: MessagingAdapterDryRunHarnessMetadata | null;
  adapterFacts?: unknown;
  adapter?: unknown;
  adapterResult?: unknown;
  now?: number;
}

export interface MessagingAdapterInvocationImplementationDecision {
  status: MessagingAdapterInvocationImplementationStatus;
  ready: boolean;
  reason: MessagingAdapterInvocationImplementationReason;
  adapterId?: string;
  runtimeOwner?: string;
  action?: MessagingExecutionAction;
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
  adapterImplementationId?: string;
  adapterVersion?: string;
  canPrepareFutureAdapterInvocation: boolean;
  invocationMode: 'decision-only';
  executable: false;
  adapterCallable: false;
  willInvokeAdapter: false;
  willPostMessage: false;
  willCallWebhook: false;
  willStoreCredential: false;
  sideEffectBoundary: 'pure-local-adapter-invocation-implementation-boundary-no-callback-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send';
}

const ADAPTER_FACTS_BOUNDARY =
  'adapter-invocation-facts-only-no-callback-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send';
const EXECUTABLE_CONTRACT_BOUNDARY =
  'reviewed-injected-adapter-executable-contract-no-callback-no-requester-no-fetch-no-socket-no-storage-no-slack-sdk-no-webhook-url-no-send';
const DECISION_BOUNDARY =
  'pure-local-adapter-invocation-implementation-boundary-no-callback-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send' as const;
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
  'adapter',
  'adapterFacts',
  'adapterResult',
  'dryRunHarness',
  'executionBoundary',
  'now',
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
const EXECUTION_BOUNDARY_TRANSPORT_KEYS = new Set([
  'storageOwner',
  'willCallWebhook',
  'willPostMessage',
  'willStoreCredential',
]);
const ADAPTER_FACT_KEYS = [
  'action',
  'adapterCallable',
  'adapterId',
  'adapterImplementationId',
  'adapterVersion',
  'connectorKind',
  'contract',
  'credentialReferenceId',
  'eventScope',
  'executable',
  'invocationMode',
  'noAutoPost',
  'planExpiresAt',
  'runtimeOwner',
  'sideEffectBoundary',
  'target',
  'willCallWebhook',
  'willInvokeAdapter',
  'willPostMessage',
  'willStoreCredential',
] as const;
const EXECUTABLE_CONTRACT_KEYS = [
  'action',
  'adapterCallable',
  'adapterId',
  'adapterImplementationId',
  'adapterVersion',
  'connectorKind',
  'contract',
  'credentialReferenceId',
  'eventScope',
  'executable',
  'importsSlackSdk',
  'invocationMode',
  'noAutoPost',
  'planExpiresAt',
  'provenanceBinding',
  'resultRedaction',
  'reviewed',
  'runtimeOwner',
  'sideEffectBoundary',
  'target',
  'targetBinding',
  'willCallWebhook',
  'willFetch',
  'willInvokeAdapter',
  'willMutateStorage',
  'willOpenSocket',
  'willPostMessage',
  'willReadStorage',
  'willResolveCredential',
  'willStoreCredential',
  'willWriteStorage',
] as const;

function trustedDecision(
  entries: readonly RuntimeTrustedContractEntry[],
): Readonly<MessagingAdapterInvocationImplementationDecision> {
  return createRuntimeTrustedContractObject(entries) as unknown as Readonly<
    MessagingAdapterInvocationImplementationDecision
  >;
}

function trustedDecisionCredentialReference(
  reference: MessagingAdapterInvocationImplementationDecision['credentialReference'],
): MessagingAdapterInvocationImplementationDecision['credentialReference'] {
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
    MessagingAdapterInvocationImplementationDecision['credentialReference']
  >;
}

function trustedDecisionTarget(
  target: MessagingAdapterInvocationImplementationDecision['target'],
): MessagingAdapterInvocationImplementationDecision['target'] {
  if (!target) return undefined;
  return createRuntimeTrustedContractObject([
    ['kind', target.kind],
    ['redaction', 'target-id-omitted'],
  ]) as unknown as NonNullable<MessagingAdapterInvocationImplementationDecision['target']>;
}

export function createMessagingAdapterInvocationImplementationInput(
  entries: readonly RuntimeTrustedContractEntry[],
): MessagingAdapterInvocationImplementationInput {
  return createRuntimeTrustedContractObject(entries) as unknown as MessagingAdapterInvocationImplementationInput;
}

export function createMessagingAdapterInvocationFacts(
  entries: readonly RuntimeTrustedContractEntry[],
): MessagingAdapterInvocationFacts {
  return createRuntimeTrustedContractObject(entries) as unknown as MessagingAdapterInvocationFacts;
}

export function createMessagingAdapterInvocationExecutableContract(
  entries: readonly RuntimeTrustedContractEntry[],
): MessagingAdapterInvocationExecutableContract {
  return createRuntimeTrustedContractObject(entries) as unknown as MessagingAdapterInvocationExecutableContract;
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

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => expected.has(key));
}

function currentTime(value: unknown): number | undefined {
  if (value === undefined) return Date.now();
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function expiresAfter(value: unknown, now: number): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > now;
}

function targetIsRedacted(value: unknown): value is MessagingAdapterInvocationFacts['target'] {
  if (!isRecord(value)) return false;
  return exactKeys(value, ['kind', 'redaction'])
    && isMessagingTargetKind(value.kind)
    && value.redaction === 'target-id-omitted'
    && safeIdentifier(value.kind) !== undefined;
}

function adapterFactsAreReviewed(value: unknown): value is MessagingAdapterInvocationFacts {
  if (!isRecord(value) || !exactKeys(value, ADAPTER_FACT_KEYS)) return false;
  return value.contract === 'messaging-adapter-invocation-implementation-facts-v1'
    && safeIdentifier(value.adapterId) !== undefined
    && safeIdentifier(value.runtimeOwner) !== undefined
    && isMessagingExecutionAction(value.action)
    && isMessagingConnectorKind(value.connectorKind)
    && isMessagingEventScope(value.eventScope)
    && safeIdentifier(value.credentialReferenceId) !== undefined
    && targetIsRedacted(value.target)
    && targetKindMatchesConnectorKind(value.connectorKind, value.target.kind)
    && Number.isSafeInteger(value.planExpiresAt)
    && safeIdentifier(value.adapterImplementationId) !== undefined
    && safeIdentifier(value.adapterVersion) !== undefined
    && value.noAutoPost === true
    && value.invocationMode === 'decision-only'
    && value.executable === false
    && value.adapterCallable === false
    && value.willInvokeAdapter === false
    && value.willPostMessage === false
    && value.willCallWebhook === false
    && value.willStoreCredential === false
    && value.sideEffectBoundary === ADAPTER_FACTS_BOUNDARY;
}

function executionBoundaryIsValid(
  decision: MessagingDeliveryExecutionBoundaryDecision,
): boolean {
  return decision.status === 'ready'
    && decision.ready === true
    && decision.reason === 'delivery_execution_boundary_ready'
    && decision.canBindInjectedAdapter === true
    && decision.deliveryMode === 'dry-run-only'
    && decision.executable === false
    && decision.willPostMessage === false
    && decision.willCallWebhook === false
    && decision.willStoreCredential === false
    && decision.sideEffectBoundary === 'pure-local-delivery-execution-boundary-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send'
    && safeIdentifier(decision.adapterId) !== undefined
    && safeIdentifier(decision.runtimeOwner) !== undefined
    && decision.action === 'dry-run-notification'
    && isMessagingConnectorKind(decision.connectorKind)
    && isMessagingEventScope(decision.eventScope)
    && targetIsRedacted(decision.target)
    && targetKindMatchesConnectorKind(decision.connectorKind, decision.target.kind)
    && decision.credentialReference !== undefined
    && safeIdentifier(decision.credentialReference.id) !== undefined
    && safeIdentifier(decision.credentialReference.kind) !== undefined
    && Number.isSafeInteger(decision.planExpiresAt);
}

function factsMatchExecutionBoundary(
  decision: MessagingDeliveryExecutionBoundaryDecision,
  facts: MessagingAdapterInvocationFacts,
): boolean {
  return facts.adapterId === decision.adapterId
    && facts.runtimeOwner === decision.runtimeOwner
    && facts.action === decision.action
    && facts.connectorKind === decision.connectorKind
    && facts.eventScope === decision.eventScope
    && facts.credentialReferenceId === decision.credentialReference?.id
    && facts.target.kind === decision.target?.kind
    && facts.planExpiresAt === decision.planExpiresAt;
}

function credentialReferenceMatchesExecutionBoundary(
  decision: MessagingDeliveryExecutionBoundaryDecision,
  harness: MessagingAdapterDryRunHarnessMetadata,
): boolean {
  const executionCredential = decision.credentialReference;
  const harnessCredential = harness.credentialReference;
  if (!executionCredential || !harnessCredential) return false;
  return harnessCredential.id === executionCredential.id
    && harnessCredential.kind === executionCredential.kind
    && harnessCredential.storageOwner === executionCredential.storageOwner
    && harnessCredential.providerId === executionCredential.providerId
    && harnessCredential.connectorId === executionCredential.connectorId
    && harnessCredential.accountId === executionCredential.accountId;
}

function dryRunHarnessCredentialReferenceIsExact(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, DRY_RUN_HARNESS_CREDENTIAL_REFERENCE_KEYS)) {
    return false;
  }
  return safeIdentifier(value.id) !== undefined
    && safeIdentifier(value.kind) !== undefined
    && (value.storageOwner === undefined || safeIdentifier(value.storageOwner) !== undefined)
    && (value.providerId === undefined || safeIdentifier(value.providerId) !== undefined)
    && (value.connectorId === undefined || safeIdentifier(value.connectorId) !== undefined)
    && (value.accountId === undefined || safeIdentifier(value.accountId) !== undefined);
}

function dryRunHarnessBoundaryIsInert(harness: MessagingAdapterDryRunHarnessMetadata): boolean {
  return hasOnlyAllowedKeys(harness as unknown as Record<string, unknown>, DRY_RUN_HARNESS_KEYS)
    && harness.status === 'accepted'
    && harness.accepted === true
    && harness.reason === 'dry_run_result_accepted'
    && safeIdentifier(harness.adapterId) !== undefined
    && safeIdentifier(harness.runtimeOwner) !== undefined
    && isMessagingExecutionAction(harness.action)
    && isMessagingConnectorKind(harness.connectorKind)
    && isMessagingEventScope(harness.eventScope)
    && dryRunHarnessCredentialReferenceIsExact(harness.credentialReference)
    && targetIsRedacted(harness.target)
    && harness.executable === false
    && harness.willPostMessage === false
    && harness.willCallWebhook === false
    && harness.willStoreCredential === false
    && harness.sideEffectBoundary === 'pure-local-dry-run-harness-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send';
}

function dryRunHarnessMatchesExecutionBoundary(
  decision: MessagingDeliveryExecutionBoundaryDecision,
  facts: MessagingAdapterInvocationFacts,
  harness: MessagingAdapterDryRunHarnessMetadata,
): boolean {
  return harness.adapterId === decision.adapterId
    && harness.runtimeOwner === decision.runtimeOwner
    && harness.action === decision.action
    && harness.connectorKind === decision.connectorKind
    && harness.eventScope === decision.eventScope
    && harness.target?.kind === decision.target?.kind
    && harness.planExpiresAt === decision.planExpiresAt
    && harness.adapterId === facts.adapterId
    && harness.runtimeOwner === facts.runtimeOwner
    && harness.action === facts.action
    && harness.connectorKind === facts.connectorKind
    && harness.eventScope === facts.eventScope
    && harness.credentialReference?.id === facts.credentialReferenceId
    && harness.target?.kind === facts.target.kind
    && harness.planExpiresAt === facts.planExpiresAt
    && credentialReferenceMatchesExecutionBoundary(decision, harness);
}

function contractMatchesExecutionBoundary(
  decision: MessagingDeliveryExecutionBoundaryDecision,
  facts: MessagingAdapterInvocationFacts,
  contract: MessagingAdapterInvocationExecutableContract,
): boolean {
  return contract.adapterId === decision.adapterId
    && contract.runtimeOwner === decision.runtimeOwner
    && contract.action === decision.action
    && contract.connectorKind === decision.connectorKind
    && contract.eventScope === decision.eventScope
    && contract.credentialReferenceId === decision.credentialReference?.id
    && contract.target.kind === decision.target?.kind
    && contract.planExpiresAt === decision.planExpiresAt
    && contract.adapterId === facts.adapterId
    && contract.runtimeOwner === facts.runtimeOwner
    && contract.action === facts.action
    && contract.connectorKind === facts.connectorKind
    && contract.eventScope === facts.eventScope
    && contract.credentialReferenceId === facts.credentialReferenceId
    && contract.target.kind === facts.target.kind
    && contract.planExpiresAt === facts.planExpiresAt
    && contract.adapterImplementationId === facts.adapterImplementationId
    && contract.adapterVersion === facts.adapterVersion;
}

function targetKindMatchesConnectorKind(
  connectorKind: MessagingConnectorKind,
  targetKind: MessagingDeliveryTargetKind,
): boolean {
  if (connectorKind === 'generic-webhook') return targetKind === 'webhook-handle';
  return targetKind === 'slack-channel' || targetKind === 'slack-dm' || targetKind === 'slack-thread';
}

function adapterExecutableContractIsReviewed(value: unknown): value is MessagingAdapterInvocationExecutableContract {
  if (!isRecord(value) || !exactKeys(value, EXECUTABLE_CONTRACT_KEYS)) return false;
  if (
    value.contract !== 'messaging-adapter-invocation-executable-contract-v1'
    || safeIdentifier(value.adapterId) === undefined
    || safeIdentifier(value.runtimeOwner) === undefined
    || value.action !== 'dry-run-notification'
    || !isMessagingConnectorKind(value.connectorKind)
    || !isMessagingEventScope(value.eventScope)
    || safeIdentifier(value.credentialReferenceId) === undefined
    || !targetIsRedacted(value.target)
    || !targetKindMatchesConnectorKind(value.connectorKind, value.target.kind)
    || !Number.isSafeInteger(value.planExpiresAt)
    || safeIdentifier(value.adapterImplementationId) === undefined
    || safeIdentifier(value.adapterVersion) === undefined
    || value.reviewed !== true
    || value.noAutoPost !== true
    || value.invocationMode !== 'reviewed-injected-adapter-contract'
    || value.targetBinding !== 'execution-boundary-redacted-target'
    || value.provenanceBinding !== 'execution-boundary-and-adapter-facts'
    || value.resultRedaction !== 'safe-result-metadata-only'
    || value.executable !== false
    || value.adapterCallable !== false
    || value.importsSlackSdk !== false
    || value.willInvokeAdapter !== false
    || value.willPostMessage !== false
    || value.willCallWebhook !== false
    || value.willFetch !== false
    || value.willOpenSocket !== false
    || value.willMutateStorage !== false
    || value.willResolveCredential !== false
    || value.willReadStorage !== false
    || value.willWriteStorage !== false
    || value.willStoreCredential !== false
    || value.sideEffectBoundary !== EXECUTABLE_CONTRACT_BOUNDARY
  ) {
    return false;
  }
  return true;
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
    'fetch',
    'httpClient',
    'invoke',
    'liveAction',
    'onResult',
    'postMessage',
    'readStorage',
    'request',
    'requester',
    'send',
    'slackClient',
    'socket',
    'storage',
    'storageAdapter',
    'transport',
    'webhook',
    'webhookUrl',
    'writeStorage',
  ];
  const checkPair = (key: unknown, nested: unknown): boolean => {
    if (typeof key !== 'string') return valueContainsForbiddenCallbackOrTransport(key, seen, allowedTransportKeys)
      || valueContainsForbiddenCallbackOrTransport(nested, seen, allowedTransportKeys);
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

function valueContainsForbiddenExecutionBoundaryResidual(value: unknown): boolean {
  return valueContainsForbiddenCallbackOrTransport(
    value,
    new WeakSet<object>(),
    EXECUTION_BOUNDARY_TRANSPORT_KEYS,
  );
}

function adapterResultClaimsLiveDelivery(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((nested) => adapterResultClaimsLiveDelivery(nested, seen));
  if (value instanceof Map) {
    for (const [key, nested] of value.entries()) {
      if (adapterResultClaimsLiveDelivery(key, seen) || adapterResultClaimsLiveDelivery(nested, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nested of value.values()) {
      if (adapterResultClaimsLiveDelivery(nested, seen)) return true;
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
    || value.invokedAdapter === true
    || value.adapterCalled === true
    || value.requesterCalled === true
    || value.liveAction === true
    || value.willInvokeAdapter === true
    || value.willPostMessage === true
    || value.willCallWebhook === true
    || value.willCallSlackApi === true
    || value.willFetch === true
    || value.willOpenSocket === true
    || value.willMutateStorage === true
    || value.willStoreCredential === true
    || value.executable === true
  ) {
    return true;
  }
  return Object.values(value).some((nested) => adapterResultClaimsLiveDelivery(nested, seen));
}

function summarizeCredentialReference(
  decision: MessagingDeliveryExecutionBoundaryDecision | null | undefined,
): MessagingAdapterInvocationImplementationDecision['credentialReference'] | undefined {
  const reference = decision?.credentialReference;
  if (!reference) return undefined;
  const summary: NonNullable<MessagingAdapterInvocationImplementationDecision['credentialReference']> = {
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
  reason: MessagingAdapterInvocationImplementationReason,
  input: MessagingAdapterInvocationImplementationInput,
): Readonly<MessagingAdapterInvocationImplementationDecision> {
  const execution = input.executionBoundary;
  const facts = adapterFactsAreReviewed(input.adapterFacts) ? input.adapterFacts : undefined;
  const ready = reason === 'adapter_invocation_boundary_ready';
  const planExpiresAt = execution?.planExpiresAt;
  const targetKind = isMessagingTargetKind(execution?.target?.kind) && safeIdentifier(execution.target.kind)
    ? execution.target.kind
    : undefined;

  const entries: RuntimeTrustedContractEntry[] = [
    ['status', ready ? 'ready' : 'blocked'],
    ['ready', ready],
    ['reason', reason],
    ['canPrepareFutureAdapterInvocation', ready],
    ['invocationMode', 'decision-only'],
    ['executable', false],
    ['adapterCallable', false],
    ['willInvokeAdapter', false],
    ['willPostMessage', false],
    ['willCallWebhook', false],
    ['willStoreCredential', false],
    ['sideEffectBoundary', DECISION_BOUNDARY],
  ];
  const adapterId = safeIdentifier(execution?.adapterId);
  const runtimeOwner = safeIdentifier(execution?.runtimeOwner);
  const action = isMessagingExecutionAction(execution?.action) ? execution.action : undefined;
  const connectorKind = isMessagingConnectorKind(execution?.connectorKind) ? execution.connectorKind : undefined;
  const eventScope = isMessagingEventScope(execution?.eventScope) ? execution.eventScope : undefined;
  const safePlanExpiresAt = Number.isSafeInteger(planExpiresAt) ? planExpiresAt : undefined;
  const adapterImplementationId = safeIdentifier(facts?.adapterImplementationId);
  const adapterVersion = safeIdentifier(facts?.adapterVersion);
  if (adapterId !== undefined) entries.push(['adapterId', adapterId]);
  if (runtimeOwner !== undefined) entries.push(['runtimeOwner', runtimeOwner]);
  if (action !== undefined) entries.push(['action', action]);
  if (connectorKind !== undefined) entries.push(['connectorKind', connectorKind]);
  if (eventScope !== undefined) entries.push(['eventScope', eventScope]);
  const credentialReference = trustedDecisionCredentialReference(summarizeCredentialReference(execution));
  if (credentialReference !== undefined) {
    entries.push(['credentialReference', credentialReference as unknown as RuntimeTrustedContractValue]);
  }
  const target = trustedDecisionTarget(targetKind
    ? {
        kind: targetKind,
        redaction: 'target-id-omitted' as const,
      }
    : undefined);
  if (target !== undefined) entries.push(['target', target as unknown as RuntimeTrustedContractValue]);
  if (safePlanExpiresAt !== undefined) entries.push(['planExpiresAt', safePlanExpiresAt]);
  if (adapterImplementationId !== undefined) entries.push(['adapterImplementationId', adapterImplementationId]);
  if (adapterVersion !== undefined) entries.push(['adapterVersion', adapterVersion]);
  return trustedDecision(entries);
}

export function evaluateMessagingAdapterInvocationImplementationBoundary(
  input: MessagingAdapterInvocationImplementationInput = {},
): Readonly<MessagingAdapterInvocationImplementationDecision> {
  if (!isRuntimeTrustedContractObject(input)) {
    return freezeDecision('adapter_shape_forbidden', {});
  }
  const safeInput = snapshotRootInput(input, ROOT_INPUT_KEYS);
  if (!safeInput || !hasOnlyAllowedKeys(safeInput, ROOT_INPUT_KEYS)) {
    return freezeDecision('adapter_shape_forbidden', {});
  }
  if (valueHasUnsafeDescriptorOrFunction(safeInput)) return freezeDecision('adapter_shape_forbidden', {});

  const boundaryInput = safeInput as MessagingAdapterInvocationImplementationInput;
  if (
    (boundaryInput.executionBoundary !== undefined
      && boundaryInput.executionBoundary !== null
      && !isTrustedMessagingDeliveryExecutionBoundaryDecision(boundaryInput.executionBoundary))
    || (boundaryInput.dryRunHarness !== undefined
      && boundaryInput.dryRunHarness !== null
      && !isTrustedMessagingAdapterDryRunHarnessMetadata(boundaryInput.dryRunHarness))
    || (boundaryInput.adapterFacts !== undefined && !isRuntimeTrustedContractObject(boundaryInput.adapterFacts))
    || (boundaryInput.adapter !== undefined && !isRuntimeTrustedContractObject(boundaryInput.adapter))
    || (boundaryInput.adapterResult !== undefined && !isRuntimeTrustedContractObject(boundaryInput.adapterResult))
  ) {
    return freezeDecision('adapter_shape_forbidden', {});
  }
  const execution = boundaryInput.executionBoundary;
  const facts = boundaryInput.adapterFacts;
  const now = currentTime(boundaryInput.now);
  if (now === undefined) return freezeDecision('adapter_shape_forbidden', {});

  if (!execution) return freezeDecision('execution_boundary_missing', boundaryInput);
  if (
    hasMessagingSecretMaterial(execution)
    || hasConnectorSecretMaterial(execution)
    || hasMessagingSecretMaterial(boundaryInput.dryRunHarness)
    || hasConnectorSecretMaterial(boundaryInput.dryRunHarness)
    || hasMessagingSecretMaterial(facts)
    || hasConnectorSecretMaterial(facts)
    || hasMessagingSecretMaterial(boundaryInput.adapter)
    || hasConnectorSecretMaterial(boundaryInput.adapter)
    || hasMessagingSecretMaterial(boundaryInput.adapterResult)
    || hasConnectorSecretMaterial(boundaryInput.adapterResult)
  ) {
    return freezeDecision('raw_secret_material', boundaryInput);
  }
  if (valueContainsForbiddenExecutionBoundaryResidual(execution)) {
    return freezeDecision('execution_boundary_invalid', boundaryInput);
  }
  if (execution.status !== 'ready' || execution.ready !== true) {
    return freezeDecision('execution_boundary_not_ready', boundaryInput);
  }
  if (!executionBoundaryIsValid(execution)) {
    return freezeDecision('execution_boundary_invalid', boundaryInput);
  }
  if (!expiresAfter(execution.planExpiresAt, now)) {
    return freezeDecision('execution_boundary_expired', boundaryInput);
  }
  const dryRunHarness = boundaryInput.dryRunHarness;
  if (!dryRunHarness) return freezeDecision('dry_run_harness_missing', boundaryInput);
  if (dryRunHarness.status !== 'accepted' || dryRunHarness.accepted !== true) {
    return freezeDecision('dry_run_harness_blocked', boundaryInput);
  }
  if (!dryRunHarnessBoundaryIsInert(dryRunHarness)) {
    return freezeDecision('dry_run_harness_boundary_invalid', boundaryInput);
  }
  if (!expiresAfter(dryRunHarness.planExpiresAt, now)) {
    return freezeDecision('execution_boundary_expired', boundaryInput);
  }
  if (!facts) return freezeDecision('adapter_facts_missing', boundaryInput);
  if (!adapterFactsAreReviewed(facts)) {
    return freezeDecision('adapter_facts_unreviewed', boundaryInput);
  }
  if (!expiresAfter(facts.planExpiresAt, now)) {
    return freezeDecision('execution_boundary_expired', boundaryInput);
  }
  if (!factsMatchExecutionBoundary(execution, facts)) {
    return freezeDecision('adapter_owner_mismatch', boundaryInput);
  }
  if (!dryRunHarnessMatchesExecutionBoundary(execution, facts, dryRunHarness)) {
    return freezeDecision('dry_run_harness_mismatch', boundaryInput);
  }
  if (!safeIdentifier(facts.adapterImplementationId) || !safeIdentifier(facts.adapterVersion)) {
    return freezeDecision('adapter_identity_unsafe', boundaryInput);
  }
  if (
    facts.noAutoPost !== true
    || facts.invocationMode !== 'decision-only'
    || facts.executable !== false
    || facts.adapterCallable !== false
    || facts.willInvokeAdapter !== false
    || facts.willPostMessage !== false
    || facts.willCallWebhook !== false
    || facts.willStoreCredential !== false
    || facts.sideEffectBoundary !== ADAPTER_FACTS_BOUNDARY
  ) {
    return freezeDecision('adapter_side_effect_boundary_invalid', boundaryInput);
  }
  const executableContract = boundaryInput.adapter === undefined
    ? undefined
    : adapterExecutableContractIsReviewed(boundaryInput.adapter)
      ? boundaryInput.adapter
      : undefined;
  if (boundaryInput.adapter !== undefined && !executableContract) {
    return freezeDecision(
      valueContainsForbiddenCallbackOrTransport(boundaryInput.adapter)
        ? 'adapter_shape_forbidden'
        : 'adapter_contract_unreviewed',
      boundaryInput,
    );
  }
  if (executableContract && !expiresAfter(executableContract.planExpiresAt, now)) {
    return freezeDecision('execution_boundary_expired', boundaryInput);
  }
  if (executableContract && !contractMatchesExecutionBoundary(execution, facts, executableContract)) {
    return freezeDecision('adapter_contract_owner_mismatch', boundaryInput);
  }
  if (boundaryInput.adapterResult !== undefined) {
    return freezeDecision(
      adapterResultClaimsLiveDelivery(boundaryInput.adapterResult)
        || valueContainsForbiddenCallbackOrTransport(boundaryInput.adapterResult)
        ? 'adapter_result_live_claim'
        : 'adapter_result_forbidden',
      boundaryInput,
    );
  }

  return freezeDecision('adapter_invocation_boundary_ready', boundaryInput);
}
