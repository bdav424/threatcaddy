import { hasConnectorSecretMaterial } from './connector-credential-boundary';
import {
  evaluateMessagingExecutionGate,
  type MessagingExecutionAction,
  type MessagingExecutionGateDecision,
  type MessagingExecutionGateInput,
  type MessagingExecutionNoiseLimits,
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
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from './runtime-trusted-contract-object';

export type MessagingDeliveryTargetKind =
  | 'slack-channel'
  | 'slack-dm'
  | 'slack-thread'
  | 'webhook-handle';

export type MessagingDeliveryAdapterPlanStatus = 'planned' | 'blocked';

export type MessagingDeliveryAdapterPlanReason =
  | 'adapter_dry_run_plan_ready'
  | 'gate_input_missing'
  | 'gate_blocked'
  | 'gate_decision_forged_or_stale'
  | 'runtime_context_missing'
  | 'runtime_decision_forged_or_stale'
  | 'runtime_not_ready'
  | 'missing_no_auto_post_control'
  | 'live_delivery_disabled_by_no_auto_post_contract'
  | 'unsupported_delivery_action'
  | 'raw_secret_material'
  | 'adapter_capability_missing'
  | 'adapter_contract_unreviewed'
  | 'adapter_runtime_owner_mismatch'
  | 'adapter_connector_kind_mismatch'
  | 'adapter_action_unsupported'
  | 'adapter_event_scope_unsupported'
  | 'adapter_target_mismatch'
  | 'adapter_credential_reference_mismatch'
  | 'adapter_capability_stale'
  | 'target_identity_missing'
  | 'target_identity_unsafe'
  | 'target_scope_mismatch'
  | 'missing_explicit_delivery_consent'
  | 'delivery_consent_mismatch'
  | 'side_effect_acknowledgement_missing'
  | 'noise_limit_missing'
  | 'noise_limit_overbroad';

export interface MessagingDeliveryTargetIdentity {
  kind: MessagingDeliveryTargetKind;
  targetId: string;
  displayName?: string;
}

export interface MessagingDeliveryAdapterCapabilityFacts {
  contract: 'messaging-delivery-adapter-capabilities-v1';
  adapterId: string;
  runtimeOwner: string;
  connectorKind: MessagingConnectorKind;
  supportedActions: readonly MessagingExecutionAction[];
  supportedEventScopes: readonly MessagingConnectorEventClass[];
  target: MessagingDeliveryTargetIdentity;
  credentialReference: {
    id: string;
    kind: string;
    storageOwner?: string;
    providerId?: string;
    connectorId?: string;
    accountId?: string;
  };
  noAutoPost: true;
  liveDeliveryEnabled: false;
  issuedAt: number;
  expiresAt: number;
}

export interface MessagingDeliveryExplicitConsent {
  granted: boolean;
  action: MessagingExecutionAction;
  adapterId: string;
  runtimeOwner: string;
  eventScope: MessagingConnectorEventClass;
  targetKind: MessagingDeliveryTargetKind;
  targetId: string;
  credentialReferenceId: string;
  acknowledgedSideEffects: 'dry-run-only' | 'manual-delivery-only';
}

export interface MessagingDeliveryAdapterPlanInput {
  gateInput?: MessagingExecutionGateInput;
  gateDecision?: MessagingExecutionGateDecision;
  runtimeDecision?: MessagingRuntimeReadinessDecision;
  adapterCapabilities?: MessagingDeliveryAdapterCapabilityFacts | null;
  explicitDeliveryConsent?: MessagingDeliveryExplicitConsent | null;
  runtimeOwner?: string;
  now?: number;
}

export interface MessagingDeliveryAdapterPlan {
  status: MessagingDeliveryAdapterPlanStatus;
  planned: boolean;
  reason: MessagingDeliveryAdapterPlanReason;
  action: MessagingExecutionAction | 'unsupported';
  connectorKind?: MessagingConnectorKind;
  eventScope?: MessagingConnectorEventClass;
  adapterId?: string;
  runtimeOwner?: string;
  target?: {
    kind: MessagingDeliveryTargetKind;
    redaction: 'target-id-omitted';
  };
  credentialReference?: {
    id: string;
    kind: string;
    storageOwner?: string;
    providerId?: string;
    connectorId?: string;
    accountId?: string;
  };
  noiseLimits?: MessagingExecutionNoiseLimits;
  planExpiresAt?: number;
  gateReason?: MessagingExecutionGateDecision['reason'];
  runtimeReason?: MessagingRuntimeReadinessDecision['reason'];
  inert: true;
  executable: false;
  willPostMessage: false;
  willCallWebhook: false;
  willStoreCredential: false;
  sideEffectBoundary: 'pure-local-delivery-plan-no-fetch-no-webhook-no-slack-api-no-storage-no-send';
}

const LIVE_DELIVERY_ACTIONS: readonly MessagingExecutionAction[] = [
  'post-message',
  'post-thread-reply',
  'webhook-delivery',
];

const PLAN_SUPPORTED_ACTIONS: readonly MessagingExecutionAction[] = [
  'dry-run-notification',
];

const MAX_CAPABILITY_FACT_AGE_MS = 15 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{2,180}$/;
const TOKEN_OR_URL_PATTERN =
  /(?:https?:\/\/|hooks\.slack(?:-gov)?\.com\/services\/|xox[abprs]-|bearer\s+[a-z0-9._~+/=-]{8,}|(?:api|app|client|refresh|access)[_-]?(?:key|token|secret)[=:]\s*\S+)/i;
const URL_SHAPED_IDENTIFIER_PATTERN =
  /^(?:[a-z][a-z0-9+.-]*:|\/\/)|^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[?::1\]?)(?::\d+)?(?:\/|$)|^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?\//i;
const PLAN_INPUT_KEYS = new Set([
  'adapterCapabilities',
  'explicitDeliveryConsent',
  'gateDecision',
  'gateInput',
  'now',
  'runtimeDecision',
  'runtimeOwner',
]);

function trustedPlan(entries: readonly RuntimeTrustedContractEntry[]): MessagingDeliveryAdapterPlan {
  return createRuntimeTrustedContractObject(entries) as unknown as MessagingDeliveryAdapterPlan;
}

export function createMessagingDeliveryAdapterPlanInput(
  entries: readonly RuntimeTrustedContractEntry[],
): MessagingDeliveryAdapterPlanInput {
  return createRuntimeTrustedContractObject(entries) as unknown as MessagingDeliveryAdapterPlanInput;
}

function isTrustedContractRecord(value: unknown): value is RuntimeTrustedContractObject {
  return isRuntimeTrustedContractObject(value);
}

function hasOnlyAllowedKeys(value: RuntimeTrustedContractObject, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function trustedTarget(
  target: MessagingDeliveryAdapterPlan['target'],
): NonNullable<MessagingDeliveryAdapterPlan['target']> | undefined {
  if (!target) return undefined;
  return createRuntimeTrustedContractObject([
    ['kind', target.kind],
    ['redaction', 'target-id-omitted'],
  ]) as unknown as NonNullable<MessagingDeliveryAdapterPlan['target']>;
}

function trustedCredentialReference(
  reference: MessagingDeliveryAdapterPlan['credentialReference'],
): NonNullable<MessagingDeliveryAdapterPlan['credentialReference']> | undefined {
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
    MessagingDeliveryAdapterPlan['credentialReference']
  >;
}

function trustedNoiseLimits(noiseLimits: MessagingExecutionNoiseLimits): MessagingExecutionNoiseLimits {
  return createRuntimeTrustedContractObject([
    ['maxActionsPerHour', noiseLimits.maxActionsPerHour],
    ['maxRecipientsPerAction', noiseLimits.maxRecipientsPerAction],
    ['suppressDuplicateThreadReplies', noiseLimits.suppressDuplicateThreadReplies],
    ['requireExplicitCaseMentionForChannels', noiseLimits.requireExplicitCaseMentionForChannels],
  ]) as unknown as MessagingExecutionNoiseLimits;
}

export function isTrustedMessagingDeliveryAdapterPlan(value: unknown): value is MessagingDeliveryAdapterPlan {
  return isRuntimeTrustedContractObject(value);
}

function block(
  reason: MessagingDeliveryAdapterPlanReason,
  input: {
    gate?: MessagingExecutionGateDecision;
    runtime?: MessagingRuntimeReadinessDecision;
    adapterCapabilities?: MessagingDeliveryAdapterCapabilityFacts | null;
  } = {},
): MessagingDeliveryAdapterPlan {
  const entries: RuntimeTrustedContractEntry[] = [
    ['status', 'blocked'],
    ['planned', false],
    ['reason', reason],
    ['action', input.gate?.action ?? 'unsupported'],
    ['inert', true],
    ['executable', false],
    ['willPostMessage', false],
    ['willCallWebhook', false],
    ['willStoreCredential', false],
    ['sideEffectBoundary', 'pure-local-delivery-plan-no-fetch-no-webhook-no-slack-api-no-storage-no-send'],
  ];
  if (input.runtime?.connectorKind !== undefined) entries.push(['connectorKind', input.runtime.connectorKind]);
  if ((input.runtime?.eventScope ?? input.gate?.eventScope) !== undefined) {
    entries.push(['eventScope', input.runtime?.eventScope ?? input.gate?.eventScope]);
  }
  const adapterId = safeIdentifier(input.adapterCapabilities?.adapterId);
  const runtimeOwner = safeIdentifier(input.adapterCapabilities?.runtimeOwner);
  if (adapterId !== undefined) entries.push(['adapterId', adapterId]);
  if (runtimeOwner !== undefined) entries.push(['runtimeOwner', runtimeOwner]);
  if (input.gate?.reason !== undefined) entries.push(['gateReason', input.gate.reason]);
  if (input.runtime?.reason !== undefined) entries.push(['runtimeReason', input.runtime.reason]);
  return trustedPlan(entries);
}

function planned(
  gate: MessagingExecutionGateDecision,
  runtime: MessagingRuntimeReadinessDecision,
  adapterCapabilities: MessagingDeliveryAdapterCapabilityFacts,
  noiseLimits: MessagingExecutionNoiseLimits,
): MessagingDeliveryAdapterPlan {
  return trustedPlan([
    ['status', 'planned'],
    ['planned', true],
    ['reason', 'adapter_dry_run_plan_ready'],
    ['action', gate.action],
    ['connectorKind', runtime.connectorKind],
    ['eventScope', runtime.eventScope],
    ['adapterId', adapterCapabilities.adapterId],
    ['runtimeOwner', adapterCapabilities.runtimeOwner],
    ['target', trustedTarget({
      kind: adapterCapabilities.target.kind,
      redaction: 'target-id-omitted',
    }) as unknown as RuntimeTrustedContractValue],
    [
      'credentialReference',
      trustedCredentialReference(summarizeCredentialReference(adapterCapabilities.credentialReference)) as unknown as RuntimeTrustedContractValue,
    ],
    ['noiseLimits', trustedNoiseLimits(noiseLimits) as unknown as RuntimeTrustedContractValue],
    ['planExpiresAt', adapterCapabilities.expiresAt],
    ['gateReason', gate.reason],
    ['runtimeReason', runtime.reason],
    ['inert', true],
    ['executable', false],
    ['willPostMessage', false],
    ['willCallWebhook', false],
    ['willStoreCredential', false],
    ['sideEffectBoundary', 'pure-local-delivery-plan-no-fetch-no-webhook-no-slack-api-no-storage-no-send'],
  ]);
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || TOKEN_OR_URL_PATTERN.test(trimmed) || URL_SHAPED_IDENTIFIER_PATTERN.test(trimmed)) return undefined;
  return trimmed.slice(0, 180);
}

function unsafeTargetIdentity(target: MessagingDeliveryTargetIdentity | undefined): boolean {
  if (!target || typeof target.targetId !== 'string' || !SAFE_ID_PATTERN.test(target.targetId)) return true;
  if (TOKEN_OR_URL_PATTERN.test(target.targetId) || URL_SHAPED_IDENTIFIER_PATTERN.test(target.targetId)) return true;
  if (
    target.displayName
    && (TOKEN_OR_URL_PATTERN.test(target.displayName) || URL_SHAPED_IDENTIFIER_PATTERN.test(target.displayName))
  ) {
    return true;
  }
  return false;
}

function decisionsMatch(
  supplied: MessagingExecutionGateDecision,
  computed: MessagingExecutionGateDecision,
): boolean {
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

function runtimeDecisionsMatch(
  supplied: MessagingRuntimeReadinessDecision,
  computed: MessagingRuntimeReadinessDecision,
): boolean {
  return supplied.status === computed.status
    && supplied.reason === computed.reason
    && supplied.readyForExplicitUserTest === computed.readyForExplicitUserTest
    && supplied.connectorKind === computed.connectorKind
    && supplied.eventScope === computed.eventScope
    && supplied.noAutoPost === true
    && supplied.sideEffectBoundary === computed.sideEffectBoundary
    && credentialReferencesMatch(supplied.credentialReference, computed.credentialReference);
}

function credentialReferencesMatch(
  left: MessagingRuntimeReadinessDecision['credentialReference'],
  right: MessagingRuntimeReadinessDecision['credentialReference'],
): boolean {
  if (!left || !right) return left === right;
  return left.id === right.id
    && left.kind === right.kind
    && optionalCredentialField(left, 'storageOwner') === optionalCredentialField(right, 'storageOwner')
    && optionalCredentialField(left, 'providerId') === optionalCredentialField(right, 'providerId')
    && optionalCredentialField(left, 'connectorId') === optionalCredentialField(right, 'connectorId')
    && optionalCredentialField(left, 'accountId') === optionalCredentialField(right, 'accountId');
}

function optionalCredentialField(
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

function summarizeCredentialReference(
  reference: MessagingDeliveryAdapterCapabilityFacts['credentialReference'],
): NonNullable<MessagingDeliveryAdapterPlan['credentialReference']> {
  const summary: NonNullable<MessagingDeliveryAdapterPlan['credentialReference']> = {
    id: reference.id,
    kind: reference.kind,
  };
  if (reference.storageOwner) summary.storageOwner = reference.storageOwner;
  if (reference.providerId) summary.providerId = reference.providerId;
  if (reference.connectorId) summary.connectorId = reference.connectorId;
  if (reference.accountId) summary.accountId = reference.accountId;
  return summary;
}

function credentialMatchesRuntime(
  capability: MessagingDeliveryAdapterCapabilityFacts,
  runtime: MessagingRuntimeReadinessDecision,
): boolean {
  const runtimeCredential = runtime.credentialReference;
  if (!runtimeCredential) return false;
  return capability.credentialReference.id === runtimeCredential.id
    && capability.credentialReference.kind === runtimeCredential.kind
    && matchesOptionalExpected(capability.credentialReference.storageOwner, optionalCredentialField(runtimeCredential, 'storageOwner'))
    && matchesOptionalExpected(capability.credentialReference.providerId, optionalCredentialField(runtimeCredential, 'providerId'))
    && matchesOptionalExpected(capability.credentialReference.connectorId, optionalCredentialField(runtimeCredential, 'connectorId'))
    && matchesOptionalExpected(capability.credentialReference.accountId, optionalCredentialField(runtimeCredential, 'accountId'));
}

function matchesOptionalExpected(expected: string | undefined, actual: string | undefined): boolean {
  return expected === undefined || actual === expected;
}

function capabilityIsFresh(
  capability: MessagingDeliveryAdapterCapabilityFacts,
  now: number,
): boolean {
  if (!Number.isSafeInteger(capability.issuedAt) || !Number.isSafeInteger(capability.expiresAt)) return false;
  if (capability.issuedAt > now + CLOCK_SKEW_MS) return false;
  if (capability.expiresAt <= now) return false;
  if (capability.issuedAt < now - MAX_CAPABILITY_FACT_AGE_MS) return false;
  if (capability.expiresAt < capability.issuedAt) return false;
  return true;
}

function targetKindAllowedForScope(
  targetKind: MessagingDeliveryTargetKind,
  connectorKind: MessagingConnectorKind,
  eventScope: MessagingConnectorEventClass | undefined,
): boolean {
  if (!eventScope) return false;
  if (connectorKind === 'generic-webhook') return targetKind === 'webhook-handle' && eventScope === 'webhook-alert';
  if (eventScope === 'webhook-alert') return targetKind === 'webhook-handle';
  if (eventScope === 'one-to-one-dm' || eventScope === 'group-dm') return targetKind === 'slack-dm';
  if (eventScope === 'thread-reply-after-user-post') return targetKind === 'slack-thread';
  return targetKind === 'slack-channel';
}

function constrainedNoiseLimits(
  limits: Partial<MessagingExecutionNoiseLimits> | null | undefined,
  eventScope: MessagingConnectorEventClass,
): MessagingExecutionNoiseLimits | MessagingDeliveryAdapterPlanReason {
  if (!limits) return 'noise_limit_missing';
  const maxActionsPerHour = limits.maxActionsPerHour;
  const maxRecipientsPerAction = limits.maxRecipientsPerAction;
  if (
    typeof maxActionsPerHour !== 'number'
    || !Number.isSafeInteger(maxActionsPerHour)
    || maxActionsPerHour < 1
    || maxActionsPerHour > 3
  ) {
    return 'noise_limit_overbroad';
  }
  if (
    typeof maxRecipientsPerAction !== 'number'
    || !Number.isSafeInteger(maxRecipientsPerAction)
    || maxRecipientsPerAction < 1
    || maxRecipientsPerAction > 5
  ) {
    return 'noise_limit_overbroad';
  }
  if (limits.suppressDuplicateThreadReplies !== true) return 'noise_limit_overbroad';
  if (eventScope === 'channel-follow-up' && limits.requireExplicitCaseMentionForChannels !== true) {
    return 'noise_limit_overbroad';
  }
  return {
    maxActionsPerHour,
    maxRecipientsPerAction,
    suppressDuplicateThreadReplies: true,
    requireExplicitCaseMentionForChannels: limits.requireExplicitCaseMentionForChannels === true,
  };
}

function consentMatches(
  consent: MessagingDeliveryExplicitConsent | null | undefined,
  gate: MessagingExecutionGateDecision,
  runtime: MessagingRuntimeReadinessDecision,
  adapterCapabilities: MessagingDeliveryAdapterCapabilityFacts,
): MessagingDeliveryAdapterPlanReason | null {
  if (!consent) return 'missing_explicit_delivery_consent';
  if (consent.granted !== true) return 'missing_explicit_delivery_consent';
  if (consent.acknowledgedSideEffects !== 'dry-run-only' && consent.acknowledgedSideEffects !== 'manual-delivery-only') {
    return 'side_effect_acknowledgement_missing';
  }
  if (consent.acknowledgedSideEffects !== 'dry-run-only') return 'side_effect_acknowledgement_missing';
  if (
    consent.action !== gate.action
    || consent.adapterId !== adapterCapabilities.adapterId
    || consent.runtimeOwner !== adapterCapabilities.runtimeOwner
    || consent.eventScope !== runtime.eventScope
    || consent.targetKind !== adapterCapabilities.target.kind
    || consent.targetId !== adapterCapabilities.target.targetId
    || consent.credentialReferenceId !== adapterCapabilities.credentialReference.id
  ) {
    return 'delivery_consent_mismatch';
  }
  return null;
}

export function createMessagingDeliveryAdapterPlan(
  input?: MessagingDeliveryAdapterPlanInput,
): MessagingDeliveryAdapterPlan {
  if (input === undefined) return block('gate_input_missing');
  const rawInput = input as unknown;
  if (!isTrustedContractRecord(rawInput) || !hasOnlyAllowedKeys(rawInput, PLAN_INPUT_KEYS)) {
    return block('gate_input_missing');
  }
  if (!input.gateInput) return block('gate_input_missing');

  const computedGate = evaluateMessagingExecutionGate(input.gateInput);
  const gate = input.gateDecision ?? computedGate;
  const computedRuntime = input.gateInput.runtime
    ? evaluateMessagingRuntimeReadiness(input.gateInput.runtime)
    : undefined;
  const runtime = input.runtimeDecision ?? computedRuntime;
  const adapterCapabilities = input.adapterCapabilities;

  if (
    hasMessagingSecretMaterial(input.gateInput)
    || hasConnectorSecretMaterial(input.gateInput)
    || hasMessagingSecretMaterial(input.gateDecision)
    || hasConnectorSecretMaterial(input.gateDecision)
    || hasMessagingSecretMaterial(input.runtimeDecision)
    || hasConnectorSecretMaterial(input.runtimeDecision)
    || hasMessagingSecretMaterial(input.adapterCapabilities)
    || hasConnectorSecretMaterial(input.adapterCapabilities)
    || hasMessagingSecretMaterial(input.explicitDeliveryConsent)
    || hasConnectorSecretMaterial(input.explicitDeliveryConsent)
  ) {
    return block('raw_secret_material', { gate, runtime, adapterCapabilities });
  }

  if (input.gateDecision && !decisionsMatch(input.gateDecision, computedGate)) {
    return block('gate_decision_forged_or_stale', { gate, runtime, adapterCapabilities });
  }
  if (!runtime || !computedRuntime) return block('runtime_context_missing', { gate, runtime, adapterCapabilities });
  if (input.runtimeDecision && !runtimeDecisionsMatch(input.runtimeDecision, computedRuntime)) {
    return block('runtime_decision_forged_or_stale', { gate, runtime, adapterCapabilities });
  }
  if (gate.noAutoPost !== true || runtime.noAutoPost !== true) {
    return block('missing_no_auto_post_control', { gate, runtime, adapterCapabilities });
  }
  if (gate.decision !== 'allow') {
    return block(
      gate.reason === 'live_delivery_disabled_by_no_auto_post_contract'
        ? 'live_delivery_disabled_by_no_auto_post_contract'
        : 'gate_blocked',
      { gate, runtime, adapterCapabilities },
    );
  }
  if (LIVE_DELIVERY_ACTIONS.includes(gate.action as MessagingExecutionAction)) {
    return block('live_delivery_disabled_by_no_auto_post_contract', { gate, runtime, adapterCapabilities });
  }
  if (!PLAN_SUPPORTED_ACTIONS.includes(gate.action as MessagingExecutionAction)) {
    return block('unsupported_delivery_action', { gate, runtime, adapterCapabilities });
  }
  if (runtime.status !== 'explicit-user-test-ready' && runtime.status !== 'no-auto-post-safe') {
    return block('runtime_not_ready', { gate, runtime, adapterCapabilities });
  }
  if (!runtime.eventScope || !runtime.credentialReference) {
    return block('runtime_context_missing', { gate, runtime, adapterCapabilities });
  }
  if (!adapterCapabilities) return block('adapter_capability_missing', { gate, runtime, adapterCapabilities });
  if (adapterCapabilities.contract !== 'messaging-delivery-adapter-capabilities-v1') {
    return block('adapter_contract_unreviewed', { gate, runtime, adapterCapabilities });
  }
  if (adapterCapabilities.noAutoPost !== true || adapterCapabilities.liveDeliveryEnabled !== false) {
    return block('missing_no_auto_post_control', { gate, runtime, adapterCapabilities });
  }
  if (!safeIdentifier(adapterCapabilities.adapterId) || !safeIdentifier(adapterCapabilities.runtimeOwner)) {
    return block('adapter_contract_unreviewed', { gate, runtime, adapterCapabilities });
  }
  if (input.runtimeOwner === undefined || input.runtimeOwner !== adapterCapabilities.runtimeOwner) {
    return block('adapter_runtime_owner_mismatch', { gate, runtime, adapterCapabilities });
  }
  if (adapterCapabilities.connectorKind !== runtime.connectorKind) {
    return block('adapter_connector_kind_mismatch', { gate, runtime, adapterCapabilities });
  }
  if (!adapterCapabilities.supportedActions.includes(gate.action as MessagingExecutionAction)) {
    return block('adapter_action_unsupported', { gate, runtime, adapterCapabilities });
  }
  if (!adapterCapabilities.supportedEventScopes.includes(runtime.eventScope)) {
    return block('adapter_event_scope_unsupported', { gate, runtime, adapterCapabilities });
  }
  if (!credentialMatchesRuntime(adapterCapabilities, runtime)) {
    return block('adapter_credential_reference_mismatch', { gate, runtime, adapterCapabilities });
  }
  const now = input.now ?? Date.now();
  if (!capabilityIsFresh(adapterCapabilities, now)) {
    return block('adapter_capability_stale', { gate, runtime, adapterCapabilities });
  }
  if (!adapterCapabilities.target) return block('target_identity_missing', { gate, runtime, adapterCapabilities });
  if (unsafeTargetIdentity(adapterCapabilities.target)) {
    return block('target_identity_unsafe', { gate, runtime, adapterCapabilities });
  }
  if (!targetKindAllowedForScope(adapterCapabilities.target.kind, runtime.connectorKind, runtime.eventScope)) {
    return block('target_scope_mismatch', { gate, runtime, adapterCapabilities });
  }
  const consentFailure = consentMatches(input.explicitDeliveryConsent, gate, runtime, adapterCapabilities);
  if (consentFailure) return block(consentFailure, { gate, runtime, adapterCapabilities });

  const noiseLimits = constrainedNoiseLimits(input.gateInput.noiseLimits, runtime.eventScope);
  if (typeof noiseLimits === 'string') return block(noiseLimits, { gate, runtime, adapterCapabilities });

  return planned(gate, runtime, adapterCapabilities, noiseLimits);
}
