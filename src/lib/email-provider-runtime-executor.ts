import {
  hasConnectorSecretMaterial,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
} from './connector-credential-boundary';
import {
  evaluateEmailProviderExecutionGate,
  type EmailProviderExecutionAction,
  type EmailProviderExecutionGateDecision,
  type EmailProviderExecutionGateInput,
} from './email-provider-execution-gate';
import {
  hasStoredEmailSecretMaterial,
  type EmailProviderId,
} from './email-onboarding';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type EmailProviderRuntimeExecutionStatus = 'executed' | 'blocked' | 'failed';

export type EmailProviderRuntimeExecutionReason =
  | 'adapter_completed'
  | 'adapter_execution_not_enabled'
  | 'adapter_failed'
  | 'adapter_invalid'
  | 'adapter_missing'
  | 'adapter_action_unsupported'
  | 'adapter_identity_mismatch'
  | 'adapter_result_identity_mismatch'
  | 'adapter_result_invalid'
  | 'adapter_result_secret_material'
  | 'credential_reference_missing'
  | 'credential_reference_identity_mismatch'
  | 'gate_blocked'
  | 'gate_decision_invalid'
  | 'gate_identity_mismatch'
  | 'identifier_unsafe'
  | 'local_test_transport_action_unsupported'
  | 'local_test_transport_completed'
  | 'local_test_transport_identity_mismatch'
  | 'local_test_transport_invalid'
  | 'missing_gate_identity'
  | 'raw_secret_material'
  | 'result_payload_forbidden'
  | 'runtime_owner_missing'
  | 'runtime_shape_forbidden'
  | 'send_disabled_by_current_gate';

export interface EmailProviderRuntimeAdapterRequest {
  action: EmailProviderExecutionAction;
  accountId: string;
  providerId: EmailProviderId;
  credentialReference?: ConnectorCredentialReference;
  payload?: unknown;
}

export interface EmailProviderRuntimeAdapterResult {
  ok: boolean;
  code: string;
  message?: string;
  details?: Record<string, string | number | boolean | null | undefined>;
  action?: EmailProviderExecutionAction;
  accountId?: string;
  providerId?: EmailProviderId;
  credentialReferenceId?: string;
}

export interface EmailProviderRuntimeExecutorAdapter {
  runtimeOwner: 'email-provider-runtime-adapter';
  accountId: string;
  providerId: EmailProviderId;
  credentialReferenceId?: string;
  supportedActions: readonly EmailProviderExecutionAction[];
  execute(request: EmailProviderRuntimeAdapterRequest): Promise<EmailProviderRuntimeAdapterResult> | EmailProviderRuntimeAdapterResult;
}

export interface EmailProviderRuntimeLocalTestTransport {
  contract: 'email-provider-local-test-transport-v1';
  runtimeOwner: 'email-provider-runtime-local-test-transport';
  accountId: string;
  providerId: EmailProviderId;
  credentialReferenceId?: string;
  supportedActions: readonly EmailProviderExecutionAction[];
  proofMode: 'auth-sync-send-binding';
  executable: false;
  willSend: false;
  willFetch: false;
  willOpenSocket: false;
  willMutateStorage: false;
  sideEffectBoundary: 'local-test-transport-no-provider-sdk-no-oauth-no-fetch-no-socket-no-storage-no-send';
}

export interface EmailProviderRuntimeExecutorInput extends EmailProviderExecutionGateInput {
  adapter?: EmailProviderRuntimeExecutorAdapter | null;
  localTestTransport?: EmailProviderRuntimeLocalTestTransport | null;
  gateDecision?: EmailProviderExecutionGateDecision | null;
  payload?: unknown;
  adapterResult?: unknown;
  providerResult?: unknown;
  callback?: unknown;
  requester?: unknown;
  fetch?: unknown;
  socket?: unknown;
  storage?: unknown;
  liveAction?: unknown;
  executable?: unknown;
}

export interface EmailProviderRuntimeExecutionSafeAdapterResult {
  ok: boolean;
  code: string;
  message?: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface EmailProviderRuntimeExecutionResult {
  status: EmailProviderRuntimeExecutionStatus;
  executed: boolean;
  adapterCalled: boolean;
  action: EmailProviderExecutionAction;
  reason: EmailProviderRuntimeExecutionReason;
  accountId?: string;
  providerId?: EmailProviderId;
  gateStatus: EmailProviderExecutionGateDecision['status'];
  gateReason: EmailProviderExecutionGateDecision['reason'];
  gateAllowed: boolean;
  credentialReference?: Pick<ConnectorCredentialReference, 'kind' | 'storageOwner' | 'providerId' | 'connectorId' | 'accountId'> & {
    id: string;
  };
  adapterResult?: EmailProviderRuntimeExecutionSafeAdapterResult;
  redactedDetails?: unknown;
  willSend: false;
  sideEffectBoundary: 'adapter-injected-no-bundled-provider-client-no-secret-storage';
}

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const UNSAFE_TEXT_PATTERN =
  /(?:https?:\/\/|wss?:\/\/|bearer\s+[a-z0-9._~+/=-]{8,}|(?:api|app|bot|client|refresh|access)[_-]?(?:key|token|secret)[=:]\s*\S+|-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----)/i;
const TOKEN_SHAPED_IDENTIFIER_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^gh[pousr]_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^(?:sk|pk|rk)-[a-z0-9_-]{8,}$/i,
  /^ya29\.[a-z0-9._-]{8,}$/i,
  /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:oauth|authorization)[\s_-]?code\s*[:=]\s*\S+/i,
  /(?:api|app|bot|client|refresh|access|session)[_-]?(?:key|token|secret)\s*[:=]\s*\S+/i,
] as const;
const REDACTED_RUNTIME_DETAILS = {
  redacted: true,
  reason: 'raw_secret_material_removed',
} as const;
const FALLBACK_ACTION: EmailProviderExecutionAction = 'start_oauth';
const INPUT_KEYS = new Set([
  'action',
  'account',
  'consentContract',
  'explicitConsent',
  'connectorCredentialReference',
  'localBridgePlan',
  'readinessDecision',
  'manualSendConfirmation',
  'adapter',
  'localTestTransport',
  'gateDecision',
  'payload',
  'adapterResult',
  'providerResult',
  'callback',
  'requester',
  'fetch',
  'socket',
  'storage',
  'liveAction',
  'executable',
]);
const GATE_DECISION_KEYS = new Set([
  'status',
  'allowed',
  'action',
  'reason',
  'accountId',
  'providerId',
  'credentialReference',
  'connectorCredentialRejectReason',
  'readinessDecision',
  'sendPolicyDecision',
  'willSend',
  'sideEffectBoundary',
]);
const LOCAL_TEST_TRANSPORT_KEYS = new Set([
  'accountId',
  'contract',
  'credentialReferenceId',
  'executable',
  'proofMode',
  'providerId',
  'runtimeOwner',
  'sideEffectBoundary',
  'supportedActions',
  'willFetch',
  'willMutateStorage',
  'willOpenSocket',
  'willSend',
]);
const LOCAL_TEST_TRANSPORT_BOUNDARY =
  'local-test-transport-no-provider-sdk-no-oauth-no-fetch-no-socket-no-storage-no-send' as const;
const ROOT_RUNTIME_FIELDS: readonly (keyof EmailProviderRuntimeExecutorInput)[] = [
  'callback',
  'requester',
  'fetch',
  'socket',
  'storage',
  'liveAction',
  'executable',
];
const FORBIDDEN_RUNTIME_MARKERS = [
  'callback',
  'requester',
  'fetch',
  'socket',
  'execute',
  'executable',
  'liveaction',
  'providersdk',
  'providerapi',
  'oauthwindow',
  'openwindow',
  'storageadapter',
  'storageresult',
  'localstorage',
  'sessionstorage',
  'indexeddb',
  'persiststorage',
  'mutatestorage',
] as const;
const FORBIDDEN_RESULT_MARKERS = [
  'adapterresult',
  'providerresult',
  'resultpayload',
  'requestbody',
  'responsebody',
  'requestheader',
  'responseheader',
  'providerpayload',
  'rawpayload',
] as const;

interface NormalizedGateDecision {
  status: EmailProviderExecutionGateDecision['status'];
  allowed: boolean;
  action: EmailProviderExecutionAction;
  reason: EmailProviderExecutionGateDecision['reason'];
  accountId?: string;
  providerId?: EmailProviderId;
  credentialReference?: EmailProviderRuntimeExecutionResult['credentialReference'];
  connectorCredentialRejectReason?: EmailProviderExecutionGateDecision['connectorCredentialRejectReason'];
  willSend: false;
  sideEffectBoundary: EmailProviderExecutionGateDecision['sideEffectBoundary'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isTokenShapedIdentifier(value: string): boolean {
  return TOKEN_SHAPED_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (
    !trimmed
    || !SAFE_ID_PATTERN.test(trimmed)
    || UNSAFE_TEXT_PATTERN.test(trimmed)
    || isTokenShapedIdentifier(trimmed)
  ) {
    return undefined;
  }
  return trimmed;
}

function safeAction(value: unknown): EmailProviderExecutionAction | undefined {
  return value === 'start_oauth'
    || value === 'test_connection'
    || value === 'sync_mail'
    || value === 'send_mail'
    ? value
    : undefined;
}

function safeProviderId(value: unknown): EmailProviderId | undefined {
  return value === 'google-gmail'
    || value === 'microsoft-outlook'
    || value === 'proton-bridge'
    || value === 'generic-imap-smtp'
    || value === 'manual-local-bridge'
    ? value
    : undefined;
}

function safeInputAction(input: unknown): EmailProviderExecutionAction {
  return isRecord(input) ? safeAction(input.action) ?? FALLBACK_ACTION : FALLBACK_ACTION;
}

function safeInputAccount(input: unknown): Record<string, unknown> | undefined {
  if (!isRecord(input) || !isRecord(input.account)) return undefined;
  return input.account;
}

function safeCredentialReference(
  credentialReference: unknown,
): EmailProviderRuntimeExecutionResult['credentialReference'] {
  const validation = validateConnectorCredentialReference(credentialReference);
  if (!validation.ok) return undefined;
  return Object.freeze({
    id: validation.reference.id,
    kind: validation.reference.kind,
    storageOwner: validation.reference.storageOwner,
    providerId: validation.reference.providerId,
    connectorId: validation.reference.connectorId,
    accountId: validation.reference.accountId,
  });
}

function normalizeGateDecision(
  gateDecision: EmailProviderExecutionGateDecision,
): NormalizedGateDecision {
  return Object.freeze({
    status: gateDecision.status,
    allowed: gateDecision.allowed === true,
    action: gateDecision.action,
    reason: gateDecision.reason,
    accountId: safeIdentifier(gateDecision.accountId),
    providerId: safeProviderId(gateDecision.providerId),
    credentialReference: safeCredentialReference(gateDecision.credentialReference),
    connectorCredentialRejectReason: gateDecision.connectorCredentialRejectReason,
    willSend: false,
    sideEffectBoundary: gateDecision.sideEffectBoundary,
  });
}

function gateDecisionMatchesEvaluatedDecision(
  provided: unknown,
  evaluated: EmailProviderExecutionGateDecision,
): boolean {
  if (!isRecord(provided) || !hasOnlyKeys(provided, GATE_DECISION_KEYS)) return false;

  const normalizedEvaluated = normalizeGateDecision(evaluated);
  const normalizedProvided = normalizeGateDecision(provided as unknown as EmailProviderExecutionGateDecision);

  return normalizedProvided.status === normalizedEvaluated.status
    && normalizedProvided.allowed === normalizedEvaluated.allowed
    && normalizedProvided.action === normalizedEvaluated.action
    && normalizedProvided.reason === normalizedEvaluated.reason
    && normalizedProvided.accountId === normalizedEvaluated.accountId
    && normalizedProvided.providerId === normalizedEvaluated.providerId
    && normalizedProvided.willSend === false
    && normalizedProvided.sideEffectBoundary === normalizedEvaluated.sideEffectBoundary
    && normalizedProvided.connectorCredentialRejectReason === normalizedEvaluated.connectorCredentialRejectReason
    && normalizedProvided.credentialReference?.id === normalizedEvaluated.credentialReference?.id
    && normalizedProvided.credentialReference?.kind === normalizedEvaluated.credentialReference?.kind
    && normalizedProvided.credentialReference?.storageOwner === normalizedEvaluated.credentialReference?.storageOwner
    && normalizedProvided.credentialReference?.providerId === normalizedEvaluated.credentialReference?.providerId
    && normalizedProvided.credentialReference?.connectorId === normalizedEvaluated.credentialReference?.connectorId
    && normalizedProvided.credentialReference?.accountId === normalizedEvaluated.credentialReference?.accountId;
}

function parseLocalTestTransport(value: unknown): EmailProviderRuntimeLocalTestTransport | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, LOCAL_TEST_TRANSPORT_KEYS)) return undefined;
  const providerId = safeProviderId(value.providerId);
  const accountId = safeIdentifier(value.accountId);
  const credentialReferenceId = value.credentialReferenceId === undefined
    ? undefined
    : safeIdentifier(value.credentialReferenceId);
  const supportedActions = Array.isArray(value.supportedActions)
    ? value.supportedActions.map((action) => safeAction(action))
    : [];
  if (
    value.contract !== 'email-provider-local-test-transport-v1'
    || value.runtimeOwner !== 'email-provider-runtime-local-test-transport'
    || !accountId
    || !providerId
    || (value.credentialReferenceId !== undefined && !credentialReferenceId)
    || supportedActions.length === 0
    || supportedActions.some((action) => action === undefined)
    || value.proofMode !== 'auth-sync-send-binding'
    || value.executable !== false
    || value.willSend !== false
    || value.willFetch !== false
    || value.willOpenSocket !== false
    || value.willMutateStorage !== false
    || value.sideEffectBoundary !== LOCAL_TEST_TRANSPORT_BOUNDARY
  ) {
    return undefined;
  }

  return Object.freeze({
    contract: 'email-provider-local-test-transport-v1',
    runtimeOwner: 'email-provider-runtime-local-test-transport',
    accountId,
    providerId,
    credentialReferenceId,
    supportedActions: Object.freeze(supportedActions as EmailProviderExecutionAction[]),
    proofMode: 'auth-sync-send-binding',
    executable: false,
    willSend: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    sideEffectBoundary: LOCAL_TEST_TRANSPORT_BOUNDARY,
  });
}

function buildGateDecision(input: EmailProviderRuntimeExecutorInput): {
  decision: EmailProviderExecutionGateDecision;
  providedDecisionValid: boolean;
} {
  const evaluated = evaluateEmailProviderExecutionGate(input);
  return {
    decision: evaluated,
    providedDecisionValid: input.gateDecision === undefined
      || gateDecisionMatchesEvaluatedDecision(input.gateDecision, evaluated),
  };
}

function blockedGateDecisionForUnsafeInput(input: unknown): EmailProviderExecutionGateDecision {
  const account = safeInputAccount(input);
  return Object.freeze({
    status: 'block',
    allowed: false,
    action: safeInputAction(input),
    reason: 'no_account',
    accountId: safeIdentifier(account?.id),
    providerId: safeProviderId(account?.providerId),
    willSend: false,
    sideEffectBoundary: 'inert-local-plan-no-fetch-no-oauth-no-sync-no-send-no-storage',
  });
}

function hasForbiddenMarkers(
  value: unknown,
  markers: readonly string[],
  seen = new WeakSet<object>(),
): boolean {
  if (typeof value === 'function') return true;
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasForbiddenMarkers(item, markers, seen));
  return Object.entries(value).some(([key, nestedValue]) => {
    const normalizedKey = normalizeKey(key);
    return markers.some((marker) => normalizedKey.includes(marker))
      || hasForbiddenMarkers(nestedValue, markers, seen);
  });
}

function hasForbiddenRootRuntimeShape(input: unknown): boolean {
  return !isRecord(input)
    || !hasOnlyKeys(input, INPUT_KEYS)
    || ROOT_RUNTIME_FIELDS.some((field) => input[field] !== undefined)
    || hasForbiddenMarkers(input.payload, FORBIDDEN_RUNTIME_MARKERS);
}

function hasForbiddenResultPayload(input: EmailProviderRuntimeExecutorInput): boolean {
  return input.adapterResult !== undefined
    || input.providerResult !== undefined
    || hasForbiddenMarkers(input.payload, FORBIDDEN_RESULT_MARKERS);
}

function summarizeCredentialReference(
  credentialReference: ConnectorCredentialReference | undefined,
): EmailProviderRuntimeExecutionResult['credentialReference'] {
  return safeCredentialReference(credentialReference);
}

function baseResult(
  input: unknown,
  gateDecision: EmailProviderExecutionGateDecision,
  reason: EmailProviderRuntimeExecutionReason,
  status: EmailProviderRuntimeExecutionStatus = 'blocked',
  extra: Partial<EmailProviderRuntimeExecutionResult> = {},
): EmailProviderRuntimeExecutionResult {
  const credentialReference = summarizeCredentialReference(gateDecision.credentialReference);
  const account = safeInputAccount(input);
  const adapterResult = extra.adapterResult
    ? Object.freeze({
        ...extra.adapterResult,
        details: extra.adapterResult.details ? Object.freeze({ ...extra.adapterResult.details }) : undefined,
      })
    : undefined;

  return Object.freeze({
    status,
    executed: status === 'executed',
    adapterCalled: false,
    action: safeInputAction(input),
    reason,
    accountId: gateDecision.accountId ?? safeIdentifier(account?.id),
    providerId: (gateDecision.providerId ?? safeProviderId(account?.providerId)) as EmailProviderId | undefined,
    gateStatus: gateDecision.status,
    gateReason: gateDecision.reason,
    gateAllowed: gateDecision.allowed,
    credentialReference,
    willSend: false,
    sideEffectBoundary: 'adapter-injected-no-bundled-provider-client-no-secret-storage',
    ...extra,
    adapterResult,
  });
}

function gateIdentityMatchesInput(
  input: EmailProviderRuntimeExecutorInput,
  gateDecision: EmailProviderExecutionGateDecision,
): boolean {
  const account = input.account;
  if (!account) return true;
  return gateDecision.action === input.action
    && gateDecision.accountId === account.id
    && gateDecision.providerId === account.providerId;
}

function hasMissingGateIdentity(gateDecision: EmailProviderExecutionGateDecision): boolean {
  return !gateDecision.accountId || !gateDecision.providerId;
}

function hasRuntimeSecretMaterial(input: EmailProviderRuntimeExecutorInput): boolean {
  return hasStoredEmailSecretMaterial(input.account)
    || hasConnectorSecretMaterial(input.connectorCredentialReference)
    || hasConnectorSecretMaterial(input.gateDecision)
    || hasConnectorSecretMaterial(input.localTestTransport)
    || hasConnectorSecretMaterial(input.payload);
}

function localTestTransportMatchesGate(
  transport: EmailProviderRuntimeLocalTestTransport,
  action: EmailProviderExecutionAction,
  gateDecision: EmailProviderExecutionGateDecision,
): boolean {
  const credentialReferenceId = gateDecision.credentialReference?.id;
  return transport.accountId === gateDecision.accountId
    && transport.providerId === gateDecision.providerId
    && (credentialReferenceId === undefined || transport.credentialReferenceId === credentialReferenceId)
    && transport.supportedActions.includes(action);
}

function localTestTransportResult(
  action: EmailProviderExecutionAction,
  providerId: EmailProviderId | undefined,
): EmailProviderRuntimeExecutionSafeAdapterResult {
  return Object.freeze({
    ok: true,
    code: `local-test-${action}-bound`,
    message: 'Local test transport proved account, credential, consent, and action binding without provider side effects.',
    details: Object.freeze({
      action,
      provider: providerId ?? null,
      proof: 'auth-sync-send-binding',
      providerCalled: false,
      storageMutated: false,
      sendDispatched: false,
    }),
  });
}

export async function executeEmailProviderRuntimeAction(
  input: EmailProviderRuntimeExecutorInput,
): Promise<EmailProviderRuntimeExecutionResult> {
  if (!isRuntimeTrustedContractObject(input)) {
    const gateDecision = blockedGateDecisionForUnsafeInput(undefined);
    return baseResult(undefined, gateDecision, 'runtime_shape_forbidden');
  }
  if (hasForbiddenRootRuntimeShape(input)) {
    const gateDecision = blockedGateDecisionForUnsafeInput(input);
    return baseResult(input, gateDecision, 'runtime_shape_forbidden');
  }

  const { decision: gateDecision, providedDecisionValid } = buildGateDecision(input);
  if (hasForbiddenResultPayload(input)) {
    return baseResult(input, gateDecision, 'result_payload_forbidden');
  }
  if (hasRuntimeSecretMaterial(input)) {
    return baseResult(input, gateDecision, 'raw_secret_material', 'blocked', {
      redactedDetails: REDACTED_RUNTIME_DETAILS,
    });
  }
  if (!providedDecisionValid) {
    return baseResult(input, gateDecision, 'gate_decision_invalid');
  }
  if (gateDecision.action !== input.action) {
    return baseResult(input, gateDecision, 'gate_identity_mismatch');
  }
  if (gateDecision.allowed !== true) {
    return baseResult(input, gateDecision, 'gate_blocked');
  }
  if (hasMissingGateIdentity(gateDecision)) {
    return baseResult(input, gateDecision, 'missing_gate_identity');
  }
  if (!gateIdentityMatchesInput(input, gateDecision)) {
    return baseResult(input, gateDecision, 'gate_identity_mismatch');
  }

  if (input.localTestTransport !== undefined && input.localTestTransport !== null) {
    const localTestTransport = parseLocalTestTransport(input.localTestTransport);
    if (!localTestTransport) {
      return baseResult(input, gateDecision, 'local_test_transport_invalid');
    }
    if (!localTestTransport.supportedActions.includes(input.action)) {
      return baseResult(input, gateDecision, 'local_test_transport_action_unsupported');
    }
    if (!localTestTransportMatchesGate(localTestTransport, input.action, gateDecision)) {
      return baseResult(input, gateDecision, 'local_test_transport_identity_mismatch');
    }
    return baseResult(input, gateDecision, 'local_test_transport_completed', 'executed', {
      adapterCalled: false,
      adapterResult: localTestTransportResult(input.action, safeProviderId(gateDecision.providerId)),
    });
  }

  if (input.action === 'send_mail') {
    return baseResult(input, gateDecision, 'send_disabled_by_current_gate');
  }

  return baseResult(input, gateDecision, 'adapter_execution_not_enabled');
}
