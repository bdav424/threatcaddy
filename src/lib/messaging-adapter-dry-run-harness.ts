import { hasConnectorSecretMaterial } from './connector-credential-boundary';
import type { MessagingExecutionAction } from './messaging-execution-gate';
import {
  hasMessagingSecretMaterial,
  type MessagingConnectorEventClass,
  type MessagingConnectorKind,
} from './messaging-connector-policy';
import type {
  MessagingDeliveryAdapterPlan,
  MessagingDeliveryTargetKind,
} from './messaging-delivery-adapter-plan';
import { isTrustedMessagingDeliveryAdapterPlan } from './messaging-delivery-adapter-plan';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from './runtime-trusted-contract-object';

export type MessagingAdapterDryRunHarnessStatus = 'accepted' | 'blocked';

export type MessagingAdapterDryRunHarnessReason =
  | 'dry_run_result_accepted'
  | 'plan_missing'
  | 'plan_not_inert'
  | 'plan_not_planned'
  | 'runtime_owner_missing'
  | 'result_missing'
  | 'result_contract_unreviewed'
  | 'result_owner_mismatch'
  | 'result_live_delivery_forged'
  | 'result_identifier_unsafe'
  | 'raw_secret_material';

export interface MessagingAdapterDryRunResult {
  contract: 'messaging-adapter-dry-run-result-v1';
  adapterId: string;
  runtimeOwner: string;
  action: MessagingExecutionAction;
  connectorKind: MessagingConnectorKind;
  eventScope: MessagingConnectorEventClass;
  credentialReferenceId: string;
  targetKind: MessagingDeliveryTargetKind;
  planExpiresAt: number;
  noAutoPost: true;
  executable: false;
  willPostMessage: false;
  willCallWebhook: false;
  willStoreCredential: false;
  adapterRunId?: string;
  dryRunId?: string;
  messageId?: string;
  safeDetails?: Record<string, unknown>;
}

export interface MessagingAdapterDryRunHarnessInput {
  plan?: MessagingDeliveryAdapterPlan | null;
  dryRunResult?: unknown;
}

export interface MessagingAdapterDryRunHarnessMetadata {
  status: MessagingAdapterDryRunHarnessStatus;
  accepted: boolean;
  reason: MessagingAdapterDryRunHarnessReason;
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
  executable: false;
  willPostMessage: false;
  willCallWebhook: false;
  willStoreCredential: false;
  sideEffectBoundary: 'pure-local-dry-run-harness-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send';
}

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{2,180}$/;
const TOKEN_OR_URL_PATTERN =
  /(?:https?:\/\/|hooks\.slack(?:-gov)?\.com\/services\/|xox[abprs]-|bearer\s+[a-z0-9._~+/=-]{8,}|(?:api|app|bot|client|refresh|access)[_-]?(?:key|token|secret)[=:]\s*\S+)/i;
const URL_SHAPED_IDENTIFIER_PATTERN =
  /^(?:[a-z][a-z0-9+.-]*:|\/\/)|^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[?::1\]?)(?::\d+)?(?:\/|$)|^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?\//i;
const HARNESS_INPUT_KEYS = new Set(['dryRunResult', 'plan']);
const DRY_RUN_RESULT_KEYS = new Set([
  'action',
  'adapterId',
  'adapterRunId',
  'calledWebhook',
  'connectorKind',
  'contract',
  'credentialReferenceId',
  'delivered',
  'dryRunId',
  'eventScope',
  'executable',
  'messageId',
  'noAutoPost',
  'planExpiresAt',
  'posted',
  'runtimeOwner',
  'safeDetails',
  'sent',
  'storedCredential',
  'targetKind',
  'willCallWebhook',
  'willPostMessage',
  'willStoreCredential',
]);

function trustedHarnessMetadata(
  entries: readonly RuntimeTrustedContractEntry[],
): Readonly<MessagingAdapterDryRunHarnessMetadata> {
  return createRuntimeTrustedContractObject(entries) as unknown as Readonly<MessagingAdapterDryRunHarnessMetadata>;
}

function trustedCredentialReference(
  reference: MessagingAdapterDryRunHarnessMetadata['credentialReference'],
): MessagingAdapterDryRunHarnessMetadata['credentialReference'] {
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
    MessagingAdapterDryRunHarnessMetadata['credentialReference']
  >;
}

function trustedTarget(
  target: MessagingAdapterDryRunHarnessMetadata['target'],
): MessagingAdapterDryRunHarnessMetadata['target'] {
  if (!target) return undefined;
  return createRuntimeTrustedContractObject([
    ['kind', target.kind],
    ['redaction', 'target-id-omitted'],
  ]) as unknown as NonNullable<MessagingAdapterDryRunHarnessMetadata['target']>;
}

export function createMessagingAdapterDryRunResult(
  entries: readonly RuntimeTrustedContractEntry[],
): MessagingAdapterDryRunResult {
  return createRuntimeTrustedContractObject(entries) as unknown as MessagingAdapterDryRunResult;
}

export function createMessagingAdapterDryRunHarnessInput(
  entries: readonly RuntimeTrustedContractEntry[],
): MessagingAdapterDryRunHarnessInput {
  return createRuntimeTrustedContractObject(entries) as unknown as MessagingAdapterDryRunHarnessInput;
}

export function isTrustedMessagingAdapterDryRunHarnessMetadata(
  value: unknown,
): value is Readonly<MessagingAdapterDryRunHarnessMetadata> {
  return isRuntimeTrustedContractObject(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTrustedContractRecord(value: unknown): value is RuntimeTrustedContractObject {
  return isRuntimeTrustedContractObject(value);
}

function hasOnlyAllowedKeys(value: RuntimeTrustedContractObject, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || TOKEN_OR_URL_PATTERN.test(trimmed) || URL_SHAPED_IDENTIFIER_PATTERN.test(trimmed)) return undefined;
  return trimmed.slice(0, 180);
}

function hasUnsafeIdentifier(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  return !SAFE_ID_PATTERN.test(trimmed)
    || TOKEN_OR_URL_PATTERN.test(trimmed)
    || URL_SHAPED_IDENTIFIER_PATTERN.test(trimmed);
}

function resultHasUnsafeIdentifiers(result: Record<string, unknown>): boolean {
  return hasUnsafeIdentifier(result.adapterId)
    || hasUnsafeIdentifier(result.runtimeOwner)
    || hasUnsafeIdentifier(result.adapterRunId)
    || hasUnsafeIdentifier(result.dryRunId)
    || hasUnsafeIdentifier(result.messageId);
}

function planHasUnsafeIdentifiers(plan: MessagingDeliveryAdapterPlan): boolean {
  return hasUnsafeIdentifier(plan.adapterId) || hasUnsafeIdentifier(plan.runtimeOwner);
}

function resultHasLiveDeliveryFlags(result: Record<string, unknown>): boolean {
  return result.noAutoPost !== true
    || result.executable !== false
    || result.willPostMessage !== false
    || result.willCallWebhook !== false
    || result.willStoreCredential !== false
    || result.delivered === true
    || result.sent === true
    || result.posted === true
    || result.calledWebhook === true
    || result.storedCredential === true;
}

function resultOwnershipMatches(
  plan: MessagingDeliveryAdapterPlan,
  result: Record<string, unknown>,
): boolean {
  return result.adapterId === plan.adapterId
    && result.runtimeOwner === plan.runtimeOwner
    && result.action === plan.action
    && result.connectorKind === plan.connectorKind
    && result.eventScope === plan.eventScope
    && result.credentialReferenceId === plan.credentialReference?.id
    && result.targetKind === plan.target?.kind
    && result.planExpiresAt === plan.planExpiresAt;
}

function planIsInert(plan: MessagingDeliveryAdapterPlan): boolean {
  return plan.inert === true
    && plan.executable === false
    && plan.willPostMessage === false
    && plan.willCallWebhook === false
    && plan.willStoreCredential === false
    && plan.sideEffectBoundary === 'pure-local-delivery-plan-no-fetch-no-webhook-no-slack-api-no-storage-no-send';
}

function freezeMetadata(
  reason: MessagingAdapterDryRunHarnessReason,
  plan?: MessagingDeliveryAdapterPlan | null,
): Readonly<MessagingAdapterDryRunHarnessMetadata> {
  const entries: RuntimeTrustedContractEntry[] = [
    ['status', reason === 'dry_run_result_accepted' ? 'accepted' : 'blocked'],
    ['accepted', reason === 'dry_run_result_accepted'],
    ['reason', reason],
    ['executable', false],
    ['willPostMessage', false],
    ['willCallWebhook', false],
    ['willStoreCredential', false],
    ['sideEffectBoundary', 'pure-local-dry-run-harness-no-fetch-no-webhook-no-slack-sdk-no-storage-no-send'],
  ];
  const adapterId = safeIdentifier(plan?.adapterId);
  const runtimeOwner = safeIdentifier(plan?.runtimeOwner);
  if (adapterId !== undefined) entries.push(['adapterId', adapterId]);
  if (runtimeOwner !== undefined) entries.push(['runtimeOwner', runtimeOwner]);
  if (plan?.action !== undefined) entries.push(['action', plan.action]);
  if (plan?.connectorKind !== undefined) entries.push(['connectorKind', plan.connectorKind]);
  if (plan?.eventScope !== undefined) entries.push(['eventScope', plan.eventScope]);
  const credentialReference = trustedCredentialReference(plan?.credentialReference);
  const target = trustedTarget(plan?.target);
  if (credentialReference !== undefined) {
    entries.push(['credentialReference', credentialReference as unknown as RuntimeTrustedContractValue]);
  }
  if (target !== undefined) entries.push(['target', target as unknown as RuntimeTrustedContractValue]);
  if (plan?.planExpiresAt !== undefined) entries.push(['planExpiresAt', plan.planExpiresAt]);
  return trustedHarnessMetadata(entries);
}

export function bindMessagingAdapterDryRunResult(
  input?: MessagingAdapterDryRunHarnessInput,
): Readonly<MessagingAdapterDryRunHarnessMetadata> {
  if (input === undefined) return freezeMetadata('plan_missing');
  const rawInput = input as unknown;
  if (!isTrustedContractRecord(rawInput) || !hasOnlyAllowedKeys(rawInput, HARNESS_INPUT_KEYS)) {
    return freezeMetadata('plan_missing');
  }
  const plan = input.plan;
  const dryRunResult = input.dryRunResult;

  if (!plan) return freezeMetadata('plan_missing');
  if (!isTrustedMessagingDeliveryAdapterPlan(plan)) {
    return freezeMetadata('plan_not_inert');
  }

  if (hasMessagingSecretMaterial(plan) || hasConnectorSecretMaterial(plan)) {
    return freezeMetadata('raw_secret_material', plan);
  }

  if (!planIsInert(plan)) return freezeMetadata('plan_not_inert', plan);
  if (plan.status !== 'planned' || plan.planned !== true || plan.action !== 'dry-run-notification') {
    return freezeMetadata('plan_not_planned', plan);
  }
  if (!plan.runtimeOwner) return freezeMetadata('runtime_owner_missing', plan);
  if (planHasUnsafeIdentifiers(plan)) return freezeMetadata('result_identifier_unsafe', plan);
  if (!dryRunResult) return freezeMetadata('result_missing', plan);
  if (!isRuntimeTrustedContractObject(dryRunResult)) {
    return freezeMetadata('result_contract_unreviewed', plan);
  }
  if (!isRecord(dryRunResult)) return freezeMetadata('result_contract_unreviewed', plan);
  if (dryRunResult.contract !== 'messaging-adapter-dry-run-result-v1') {
    return freezeMetadata('result_contract_unreviewed', plan);
  }
  if (!hasOnlyAllowedKeys(dryRunResult, DRY_RUN_RESULT_KEYS)) {
    return freezeMetadata('result_contract_unreviewed', plan);
  }
  if (resultHasLiveDeliveryFlags(dryRunResult)) {
    return freezeMetadata('result_live_delivery_forged', plan);
  }
  if (resultHasUnsafeIdentifiers(dryRunResult)) {
    return freezeMetadata('result_identifier_unsafe', plan);
  }
  if (!resultOwnershipMatches(plan, dryRunResult)) {
    return freezeMetadata('result_owner_mismatch', plan);
  }
  if (hasMessagingSecretMaterial(dryRunResult) || hasConnectorSecretMaterial(dryRunResult)) {
    return freezeMetadata('raw_secret_material', plan);
  }

  return freezeMetadata('dry_run_result_accepted', plan);
}
