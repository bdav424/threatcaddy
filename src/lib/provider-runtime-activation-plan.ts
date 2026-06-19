import {
  hasConnectorSecretMaterial,
  isSecretLikeFieldName,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
  type ConnectorCredentialReferenceRejectReason,
} from './connector-credential-boundary';
import type {
  ProviderLiveActivationAction,
  ProviderLiveActivationPlan,
} from './provider-live-activation-gate';

export type ProviderRuntimeActivationPlanStatus = 'blocked' | 'runtime-activation-plan-ready';

export type ProviderRuntimeActivationPlanReason =
  | 'provider_runtime_activation_plan_ready'
  | 'root_shape_invalid'
  | 'raw_secret_material'
  | 'runtime_shape_forbidden'
  | 'result_payload_forbidden'
  | 'live_activation_decision_missing'
  | 'live_activation_decision_invalid'
  | 'live_activation_plan_not_ready'
  | 'runtime_owner_review_missing'
  | 'runtime_owner_review_invalid'
  | 'runtime_owner_review_unreviewed'
  | 'action_binding_missing'
  | 'action_binding_invalid'
  | 'action_binding_unreviewed'
  | 'credential_reference_invalid'
  | 'credential_reference_mismatch'
  | 'provider_mismatch'
  | 'account_mismatch'
  | 'connector_mismatch'
  | 'runtime_id_mismatch'
  | 'action_not_allowed'
  | 'auto_send_posture_invalid';

export interface ProviderRuntimeActivationOwnerReview {
  contract: 'provider-runtime-activation-owner-review-v1';
  reviewState: 'reviewed';
  runtimeOwner: 'provider-runtime-adapter';
  runtimeId: string;
  providerId: string;
  connectorId: string;
  accountId: string;
  credentialReferenceId: string;
  supportedActions: readonly ProviderLiveActivationAction[];
  noAutoSend: true;
  runtimeOwnerReviewed: true;
}

export interface ProviderRuntimeActivationActionBinding {
  contract: 'provider-runtime-activation-action-binding-v1';
  reviewState: 'reviewed';
  providerId: string;
  connectorId: string;
  runtimeId: string;
  accountId: string;
  credentialReferenceId: string;
  action: ProviderLiveActivationAction;
  requiresUserApprovalBeforeSend: true;
  noAutoSend: true;
  actionBindingReviewed: true;
}

export interface ProviderRuntimeActivationPlanInput {
  liveActivationDecision?: unknown;
  runtimeOwnerReview?: unknown;
  actionBinding?: unknown;
  adapter?: unknown;
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

export interface ProviderRuntimeActivationImplementationPlan {
  contract: 'provider-runtime-activation-implementation-plan-v1';
  providerId: string;
  providerLabel: string;
  connectorId: string;
  runtimeOwner: 'provider-runtime-adapter';
  runtimeId: string;
  accountId: string;
  credentialReference: ConnectorCredentialReference;
  scopeId: string;
  action: ProviderLiveActivationAction;
  approvedActionSet: readonly ProviderLiveActivationAction[];
  sendCapableActionSet: boolean;
  requiresUserApprovalBeforeSend: true;
  noAutoSend: true;
  requiresSeparateApprovalGateForInjectedAdapter: true;
  injectedAdapterExecutionStillBlocked: true;
  providerIdentityReviewed: true;
  accountIntentReviewed: true;
  actionScopeReviewed: true;
  consentSessionReviewed: true;
  runtimeOwnershipReviewed: true;
  runtimeOwnerReviewReviewed: true;
  actionBindingReviewed: true;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'provider-runtime-activation-plan-only-no-oauth-no-fetch-no-socket-no-storage-no-provider-sdk-no-send';
}

export interface ProviderRuntimeActivationPlanDecision {
  status: ProviderRuntimeActivationPlanStatus;
  ready: boolean;
  reason: ProviderRuntimeActivationPlanReason;
  plan?: ProviderRuntimeActivationImplementationPlan;
  canPrepareFutureProviderRuntimeActivation: boolean;
  readyForInjectedAdapterExecution: false;
  requiresSeparateApprovalGateForInjectedAdapter: true;
  willStartOAuth: false;
  willFetch: false;
  willOpenSocket: false;
  willMutateStorage: false;
  willResolveCredentialSecrets: false;
  willExecuteProviderAction: false;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'provider-runtime-activation-decision-plan-only-no-oauth-no-fetch-no-socket-no-storage-no-provider-sdk-no-send';
  credentialRejectReason?: ConnectorCredentialReferenceRejectReason;
}

const DECISION_BOUNDARY =
  'provider-runtime-activation-decision-plan-only-no-oauth-no-fetch-no-socket-no-storage-no-provider-sdk-no-send' as const;
const PLAN_BOUNDARY =
  'provider-runtime-activation-plan-only-no-oauth-no-fetch-no-socket-no-storage-no-provider-sdk-no-send' as const;
const LIVE_ACTIVATION_BOUNDARY =
  'pure-local-provider-live-activation-gate-no-oauth-no-fetch-no-socket-no-storage-no-provider-sdk-no-send' as const;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;

const TOKEN_SHAPED_IDENTIFIER_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^ghp_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^sk-[a-z0-9_-]{8,}$/i,
  /^ya29\.[a-z0-9._-]{8,}$/i,
  /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:oauth|authorization)[\s_-]?code\s*[:=]\s*\S+/i,
  /(?:client|app|api|refresh|access)[_-]?(?:secret|token|key)\s*[:=]\s*\S+/i,
];

const ROOT_KEYS = new Set([
  'liveActivationDecision',
  'runtimeOwnerReview',
  'actionBinding',
  'adapter',
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

const LIVE_DECISION_KEYS = new Set([
  'status',
  'mayPrepareLiveActivation',
  'activationPlan',
  'blockers',
  'executable',
  'sideEffects',
  'willStartOAuth',
  'willFetch',
  'willOpenSocket',
  'willMutateStorage',
  'willResolveCredentialSecrets',
  'willExecuteProviderAction',
  'sideEffectBoundary',
]);

const LIVE_PLAN_KEYS = new Set([
  'contract',
  'providerId',
  'providerLabel',
  'runtimeOwner',
  'runtimeId',
  'accountId',
  'credentialReference',
  'scopeId',
  'actions',
  'sendCapable',
  'requiresUserApprovalBeforeSend',
  'providerIdentityReviewed',
  'accountIntentReviewed',
  'actionScopeReviewed',
  'consentSessionReviewed',
  'runtimeOwnershipReviewed',
  'executable',
  'sideEffects',
  'sideEffectBoundary',
]);

const OWNER_REVIEW_KEYS = new Set([
  'contract',
  'reviewState',
  'runtimeOwner',
  'runtimeId',
  'providerId',
  'connectorId',
  'accountId',
  'credentialReferenceId',
  'supportedActions',
  'noAutoSend',
  'runtimeOwnerReviewed',
]);

const ACTION_BINDING_KEYS = new Set([
  'contract',
  'reviewState',
  'providerId',
  'connectorId',
  'runtimeId',
  'accountId',
  'credentialReferenceId',
  'action',
  'requiresUserApprovalBeforeSend',
  'noAutoSend',
  'actionBindingReviewed',
]);

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
  'openwindow',
  'oauthwindow',
  'storageadapter',
  'storageresult',
  'localstorage',
  'sessionstorage',
  'indexeddb',
  'persiststorage',
  'mutatestorage',
];

const RESULT_MARKERS = ['adapterresult', 'providerresult', 'resultpayload'] as const;

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

function isTokenShapedIdentifier(value: string): boolean {
  return TOKEN_SHAPED_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!SAFE_IDENTIFIER_PATTERN.test(trimmed)) return undefined;
  if (isSecretLikeFieldName(trimmed)) return undefined;
  if (isTokenShapedIdentifier(trimmed)) return undefined;
  return trimmed;
}

function safeLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 180) return undefined;
  if (isSecretLikeFieldName(trimmed)) return undefined;
  if (isTokenShapedIdentifier(trimmed)) return undefined;
  return trimmed;
}

function safeAction(value: unknown): ProviderLiveActivationAction | undefined {
  return value === 'provider_auth'
    || value === 'provider_sync'
    || value === 'provider_send'
    ? value
    : undefined;
}

function safeActions(value: unknown): readonly ProviderLiveActivationAction[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 3) return undefined;
  const actions: ProviderLiveActivationAction[] = [];
  for (const item of value) {
    const action = safeAction(item);
    if (!action) return undefined;
    if (!actions.includes(action)) actions.push(action);
  }
  return Object.freeze(actions);
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
    const normalizedKey = normalize(key);
    return markers.some((marker) => normalizedKey.includes(marker))
      || hasForbiddenMarkers(nestedValue, markers, seen);
  });
}

function freezeCredentialReference(reference: ConnectorCredentialReference): ConnectorCredentialReference {
  return Object.freeze({
    schemaVersion: reference.schemaVersion,
    kind: reference.kind,
    id: reference.id,
    storageOwner: reference.storageOwner,
    providerId: reference.providerId,
    connectorId: reference.connectorId,
    accountId: reference.accountId,
    displayName: reference.displayName,
    createdAt: reference.createdAt,
  });
}

function blocked(
  reason: ProviderRuntimeActivationPlanReason,
  credentialRejectReason?: ConnectorCredentialReferenceRejectReason,
): Readonly<ProviderRuntimeActivationPlanDecision> {
  return Object.freeze({
    status: 'blocked',
    ready: false,
    reason,
    canPrepareFutureProviderRuntimeActivation: false,
    readyForInjectedAdapterExecution: false,
    requiresSeparateApprovalGateForInjectedAdapter: true,
    willStartOAuth: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    willResolveCredentialSecrets: false,
    willExecuteProviderAction: false,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: DECISION_BOUNDARY,
    ...(credentialRejectReason ? { credentialRejectReason } : {}),
  });
}

function parseReadyLiveActivationDecision(
  value: unknown,
): { ok: true; plan: ProviderLiveActivationPlan } | { ok: false; reason: ProviderRuntimeActivationPlanReason; credentialRejectReason?: ConnectorCredentialReferenceRejectReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, LIVE_DECISION_KEYS)) {
    return { ok: false, reason: 'live_activation_decision_invalid' };
  }
  if (
    value.status !== 'activation-ready'
    || value.mayPrepareLiveActivation !== true
    || value.executable !== false
    || value.sideEffects !== 'none'
    || value.willStartOAuth !== false
    || value.willFetch !== false
    || value.willOpenSocket !== false
    || value.willMutateStorage !== false
    || value.willResolveCredentialSecrets !== false
    || value.willExecuteProviderAction !== false
    || value.sideEffectBoundary !== LIVE_ACTIVATION_BOUNDARY
  ) {
    return value.status === 'blocked'
      ? { ok: false, reason: 'live_activation_plan_not_ready' }
      : { ok: false, reason: 'live_activation_decision_invalid' };
  }
  if (!Array.isArray(value.blockers) || value.blockers.length !== 0) {
    return { ok: false, reason: 'live_activation_decision_invalid' };
  }
  if (!isRecord(value.activationPlan) || !hasOnlyKeys(value.activationPlan, LIVE_PLAN_KEYS)) {
    return { ok: false, reason: 'live_activation_decision_invalid' };
  }

  const credentialValidation = validateConnectorCredentialReference(value.activationPlan.credentialReference);
  if (!credentialValidation.ok) {
    return {
      ok: false,
      reason: 'credential_reference_invalid',
      credentialRejectReason: credentialValidation.reason,
    };
  }

  const providerId = safeIdentifier(value.activationPlan.providerId);
  const providerLabel = safeLabel(value.activationPlan.providerLabel);
  const runtimeId = safeIdentifier(value.activationPlan.runtimeId);
  const accountId = safeIdentifier(value.activationPlan.accountId);
  const scopeId = safeIdentifier(value.activationPlan.scopeId);
  const actions = safeActions(value.activationPlan.actions);
  if (
    value.activationPlan.contract !== 'provider-live-activation-plan-v1'
    || !providerId
    || !providerLabel
    || value.activationPlan.runtimeOwner !== 'provider-runtime-adapter'
    || !runtimeId
    || !accountId
    || !scopeId
    || !actions
    || typeof value.activationPlan.sendCapable !== 'boolean'
    || typeof value.activationPlan.requiresUserApprovalBeforeSend !== 'boolean'
    || value.activationPlan.providerIdentityReviewed !== true
    || value.activationPlan.accountIntentReviewed !== true
    || value.activationPlan.actionScopeReviewed !== true
    || value.activationPlan.consentSessionReviewed !== true
    || value.activationPlan.runtimeOwnershipReviewed !== true
    || value.activationPlan.executable !== false
    || value.activationPlan.sideEffects !== 'none'
    || value.activationPlan.sideEffectBoundary !== 'plan-only-no-oauth-no-fetch-no-socket-no-storage-no-provider-sdk-no-send'
  ) {
    return { ok: false, reason: 'live_activation_decision_invalid' };
  }

  if (actions.includes('provider_send') !== value.activationPlan.sendCapable) {
    return { ok: false, reason: 'live_activation_decision_invalid' };
  }
  if (actions.includes('provider_send') && value.activationPlan.requiresUserApprovalBeforeSend !== true) {
    return { ok: false, reason: 'live_activation_decision_invalid' };
  }

  return {
    ok: true,
    plan: Object.freeze({
      contract: 'provider-live-activation-plan-v1',
      providerId,
      providerLabel,
      runtimeOwner: 'provider-runtime-adapter',
      runtimeId,
      accountId,
      credentialReference: freezeCredentialReference(credentialValidation.reference),
      scopeId,
      actions,
      sendCapable: value.activationPlan.sendCapable,
      requiresUserApprovalBeforeSend: value.activationPlan.requiresUserApprovalBeforeSend,
      providerIdentityReviewed: true,
      accountIntentReviewed: true,
      actionScopeReviewed: true,
      consentSessionReviewed: true,
      runtimeOwnershipReviewed: true,
      executable: false,
      sideEffects: 'none',
      sideEffectBoundary: 'plan-only-no-oauth-no-fetch-no-socket-no-storage-no-provider-sdk-no-send',
    }),
  };
}

function parseRuntimeOwnerReview(
  value: unknown,
): { ok: true; value: ProviderRuntimeActivationOwnerReview } | { ok: false; reason: ProviderRuntimeActivationPlanReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, OWNER_REVIEW_KEYS)) {
    return { ok: false, reason: 'runtime_owner_review_invalid' };
  }
  const runtimeId = safeIdentifier(value.runtimeId);
  const providerId = safeIdentifier(value.providerId);
  const connectorId = safeIdentifier(value.connectorId);
  const accountId = safeIdentifier(value.accountId);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const supportedActions = safeActions(value.supportedActions);
  if (
    value.contract !== 'provider-runtime-activation-owner-review-v1'
    || value.runtimeOwner !== 'provider-runtime-adapter'
    || !runtimeId
    || !providerId
    || !connectorId
    || !accountId
    || !credentialReferenceId
    || !supportedActions
    || value.noAutoSend !== true
    || value.runtimeOwnerReviewed !== true
  ) {
    return { ok: false, reason: 'runtime_owner_review_invalid' };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, reason: 'runtime_owner_review_unreviewed' };
  }
  return {
    ok: true,
    value: Object.freeze({
      contract: 'provider-runtime-activation-owner-review-v1',
      reviewState: 'reviewed',
      runtimeOwner: 'provider-runtime-adapter',
      runtimeId,
      providerId,
      connectorId,
      accountId,
      credentialReferenceId,
      supportedActions,
      noAutoSend: true,
      runtimeOwnerReviewed: true,
    }),
  };
}

function parseActionBinding(
  value: unknown,
): { ok: true; value: ProviderRuntimeActivationActionBinding } | { ok: false; reason: ProviderRuntimeActivationPlanReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, ACTION_BINDING_KEYS)) {
    return { ok: false, reason: 'action_binding_invalid' };
  }
  const providerId = safeIdentifier(value.providerId);
  const connectorId = safeIdentifier(value.connectorId);
  const runtimeId = safeIdentifier(value.runtimeId);
  const accountId = safeIdentifier(value.accountId);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const action = safeAction(value.action);
  if (
    value.contract !== 'provider-runtime-activation-action-binding-v1'
    || !providerId
    || !connectorId
    || !runtimeId
    || !accountId
    || !credentialReferenceId
    || !action
    || value.requiresUserApprovalBeforeSend !== true
    || value.noAutoSend !== true
    || value.actionBindingReviewed !== true
  ) {
    return { ok: false, reason: 'action_binding_invalid' };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, reason: 'action_binding_unreviewed' };
  }
  return {
    ok: true,
    value: Object.freeze({
      contract: 'provider-runtime-activation-action-binding-v1',
      reviewState: 'reviewed',
      providerId,
      connectorId,
      runtimeId,
      accountId,
      credentialReferenceId,
      action,
      requiresUserApprovalBeforeSend: true,
      noAutoSend: true,
      actionBindingReviewed: true,
    }),
  };
}

function buildPlan(
  livePlan: ProviderLiveActivationPlan,
  runtimeOwnerReview: ProviderRuntimeActivationOwnerReview,
  actionBinding: ProviderRuntimeActivationActionBinding,
): ProviderRuntimeActivationImplementationPlan {
  return Object.freeze({
    contract: 'provider-runtime-activation-implementation-plan-v1',
    providerId: livePlan.providerId,
    providerLabel: livePlan.providerLabel,
    connectorId: runtimeOwnerReview.connectorId,
    runtimeOwner: 'provider-runtime-adapter',
    runtimeId: livePlan.runtimeId,
    accountId: livePlan.accountId,
    credentialReference: freezeCredentialReference(livePlan.credentialReference),
    scopeId: livePlan.scopeId,
    action: actionBinding.action,
    approvedActionSet: Object.freeze([...livePlan.actions]),
    sendCapableActionSet: livePlan.sendCapable,
    requiresUserApprovalBeforeSend: true,
    noAutoSend: true,
    requiresSeparateApprovalGateForInjectedAdapter: true,
    injectedAdapterExecutionStillBlocked: true,
    providerIdentityReviewed: true,
    accountIntentReviewed: true,
    actionScopeReviewed: true,
    consentSessionReviewed: true,
    runtimeOwnershipReviewed: true,
    runtimeOwnerReviewReviewed: true,
    actionBindingReviewed: true,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: PLAN_BOUNDARY,
  });
}

export function createProviderRuntimeActivationPlan(
  input: ProviderRuntimeActivationPlanInput = {},
): Readonly<ProviderRuntimeActivationPlanDecision> {
  if (!isRecord(input) || !hasOnlyKeys(input, ROOT_KEYS)) {
    return blocked('root_shape_invalid');
  }
  if (hasConnectorSecretMaterial(input)) {
    return blocked('raw_secret_material');
  }
  if (input.adapterResult !== undefined || input.providerResult !== undefined) {
    return blocked('result_payload_forbidden');
  }
  if (
    input.adapter !== undefined
    || input.callback !== undefined
    || input.requester !== undefined
    || input.fetch !== undefined
    || input.socket !== undefined
    || input.storage !== undefined
    || input.liveAction !== undefined
    || input.executable !== undefined
  ) {
    return blocked('runtime_shape_forbidden');
  }
  if (
    hasForbiddenMarkers(input.runtimeOwnerReview, FORBIDDEN_RUNTIME_MARKERS)
    || hasForbiddenMarkers(input.actionBinding, FORBIDDEN_RUNTIME_MARKERS)
  ) {
    return blocked('runtime_shape_forbidden');
  }
  if (
    hasForbiddenMarkers(input.runtimeOwnerReview, RESULT_MARKERS)
    || hasForbiddenMarkers(input.actionBinding, RESULT_MARKERS)
  ) {
    return blocked('result_payload_forbidden');
  }

  if (input.liveActivationDecision === undefined) {
    return blocked('live_activation_decision_missing');
  }
  const liveActivation = parseReadyLiveActivationDecision(input.liveActivationDecision);
  if (!liveActivation.ok) {
    return blocked(liveActivation.reason, liveActivation.credentialRejectReason);
  }

  if (input.runtimeOwnerReview === undefined) {
    return blocked('runtime_owner_review_missing');
  }
  const runtimeOwnerReview = parseRuntimeOwnerReview(input.runtimeOwnerReview);
  if (!runtimeOwnerReview.ok) {
    return blocked(runtimeOwnerReview.reason);
  }

  if (input.actionBinding === undefined) {
    return blocked('action_binding_missing');
  }
  const actionBinding = parseActionBinding(input.actionBinding);
  if (!actionBinding.ok) {
    return blocked(actionBinding.reason);
  }

  const connectorId = liveActivation.plan.credentialReference.connectorId;
  if (!connectorId) {
    return blocked('credential_reference_invalid');
  }
  if (liveActivation.plan.credentialReference.id !== runtimeOwnerReview.value.credentialReferenceId) {
    return blocked('credential_reference_mismatch');
  }
  if (liveActivation.plan.credentialReference.id !== actionBinding.value.credentialReferenceId) {
    return blocked('credential_reference_mismatch');
  }
  if (liveActivation.plan.providerId !== runtimeOwnerReview.value.providerId || liveActivation.plan.providerId !== actionBinding.value.providerId) {
    return blocked('provider_mismatch');
  }
  if (liveActivation.plan.accountId !== runtimeOwnerReview.value.accountId || liveActivation.plan.accountId !== actionBinding.value.accountId) {
    return blocked('account_mismatch');
  }
  if (connectorId !== runtimeOwnerReview.value.connectorId || connectorId !== actionBinding.value.connectorId) {
    return blocked('connector_mismatch');
  }
  if (liveActivation.plan.runtimeId !== runtimeOwnerReview.value.runtimeId || liveActivation.plan.runtimeId !== actionBinding.value.runtimeId) {
    return blocked('runtime_id_mismatch');
  }
  if (!liveActivation.plan.actions.includes(actionBinding.value.action)) {
    return blocked('action_not_allowed');
  }
  if (!runtimeOwnerReview.value.supportedActions.includes(actionBinding.value.action)) {
    return blocked('action_not_allowed');
  }
  if (runtimeOwnerReview.value.noAutoSend !== true || actionBinding.value.noAutoSend !== true) {
    return blocked('auto_send_posture_invalid');
  }
  if (
    actionBinding.value.action === 'provider_send'
    && (
      liveActivation.plan.sendCapable !== true
      || liveActivation.plan.requiresUserApprovalBeforeSend !== true
      || actionBinding.value.requiresUserApprovalBeforeSend !== true
    )
  ) {
    return blocked('auto_send_posture_invalid');
  }
  if (
    actionBinding.value.action !== 'provider_send'
    && actionBinding.value.requiresUserApprovalBeforeSend !== true
  ) {
    return blocked('auto_send_posture_invalid');
  }

  const plan = buildPlan(
    liveActivation.plan,
    runtimeOwnerReview.value,
    actionBinding.value,
  );

  return Object.freeze({
    status: 'runtime-activation-plan-ready',
    ready: true,
    reason: 'provider_runtime_activation_plan_ready',
    plan,
    canPrepareFutureProviderRuntimeActivation: true,
    readyForInjectedAdapterExecution: false,
    requiresSeparateApprovalGateForInjectedAdapter: true,
    willStartOAuth: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    willResolveCredentialSecrets: false,
    willExecuteProviderAction: false,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}
