import {
  hasConnectorSecretMaterial,
  isSecretLikeFieldName,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
  type ConnectorCredentialReferenceRejectReason,
} from './connector-credential-boundary';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type ProviderLiveActivationAction =
  | 'provider_auth'
  | 'provider_sync'
  | 'provider_send';

export type ProviderLiveActivationStatus = 'blocked' | 'activation-ready';

export type ProviderLiveActivationBlockerCode =
  | 'root_shape_invalid'
  | 'raw_secret_material'
  | 'runtime_shape_forbidden'
  | 'provider_identity_missing'
  | 'provider_identity_invalid'
  | 'provider_identity_unreviewed'
  | 'account_intent_missing'
  | 'account_intent_invalid'
  | 'account_intent_unreviewed'
  | 'action_scope_missing'
  | 'action_scope_invalid'
  | 'action_scope_unreviewed'
  | 'action_scope_send_approval_missing'
  | 'credential_reference_missing'
  | 'credential_reference_invalid'
  | 'credential_provider_mismatch'
  | 'credential_account_missing'
  | 'credential_account_mismatch'
  | 'consent_session_missing'
  | 'consent_session_invalid'
  | 'consent_session_unreviewed'
  | 'consent_session_not_granted'
  | 'consent_session_stale'
  | 'consent_session_expired'
  | 'runtime_ownership_missing'
  | 'runtime_ownership_invalid'
  | 'runtime_ownership_unreviewed'
  | 'runtime_ownership_send_approval_missing'
  | 'provider_mismatch'
  | 'account_mismatch'
  | 'credential_reference_mismatch'
  | 'scope_mismatch'
  | 'action_not_supported';

export interface ProviderLiveActivationProviderIdentityFact {
  contract: 'provider-live-identity-v1';
  reviewState: 'reviewed';
  providerId: string;
  providerLabel: string;
  runtimeOwner: 'provider-runtime-adapter';
  providerIdentityReviewed: true;
}

export interface ProviderLiveActivationAccountIntentFact {
  contract: 'provider-live-account-intent-v1';
  reviewState: 'reviewed';
  providerId: string;
  accountId: string;
  credentialReferenceId: string;
  accountIntentReviewed: true;
}

export interface ProviderLiveActivationActionScopeFact {
  contract: 'provider-live-action-scope-v1';
  reviewState: 'reviewed';
  providerId: string;
  accountId: string;
  credentialReferenceId: string;
  scopeId: string;
  actions: readonly ProviderLiveActivationAction[];
  sendRequiresExplicitUserApproval: true;
  actionScopeReviewed: true;
}

export interface ProviderLiveActivationConsentSessionFact {
  contract: 'provider-live-consent-session-v1';
  reviewState: 'reviewed';
  providerId: string;
  accountId: string;
  credentialReferenceId: string;
  scopeId: string;
  userConsentGranted: true;
  sessionFresh: true;
  issuedAt: number;
  reviewedAt: number;
  expiresAt: number;
}

export interface ProviderLiveActivationRuntimeOwnershipFact {
  contract: 'provider-live-runtime-ownership-v1';
  reviewState: 'reviewed';
  runtimeOwner: 'provider-runtime-adapter';
  runtimeId: string;
  providerId: string;
  accountId: string;
  credentialReferenceId: string;
  scopeId: string;
  supportedActions: readonly ProviderLiveActivationAction[];
  noSendWithoutUserApproval: true;
  runtimeOwnershipReviewed: true;
}

export interface ProviderLiveActivationGateInput {
  providerIdentity?: unknown;
  accountIntent?: unknown;
  actionScope?: unknown;
  credentialReference?: unknown;
  consentSession?: unknown;
  runtimeOwnership?: unknown;
  now?: number;
}

export interface ProviderLiveActivationBlocker {
  code: ProviderLiveActivationBlockerCode;
  detail: string;
  field?: string;
  credentialRejectReason?: ConnectorCredentialReferenceRejectReason;
}

export interface ProviderLiveActivationPlan {
  contract: 'provider-live-activation-plan-v1';
  providerId: string;
  providerLabel: string;
  runtimeOwner: 'provider-runtime-adapter';
  runtimeId: string;
  accountId: string;
  credentialReference: ConnectorCredentialReference;
  scopeId: string;
  actions: readonly ProviderLiveActivationAction[];
  sendCapable: boolean;
  requiresUserApprovalBeforeSend: boolean;
  providerIdentityReviewed: true;
  accountIntentReviewed: true;
  actionScopeReviewed: true;
  consentSessionReviewed: true;
  runtimeOwnershipReviewed: true;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'plan-only-no-oauth-no-fetch-no-socket-no-storage-no-provider-sdk-no-send';
}

export interface ProviderLiveActivationDecision {
  status: ProviderLiveActivationStatus;
  mayPrepareLiveActivation: boolean;
  activationPlan?: ProviderLiveActivationPlan;
  blockers: readonly ProviderLiveActivationBlocker[];
  executable: false;
  sideEffects: 'none';
  willStartOAuth: false;
  willFetch: false;
  willOpenSocket: false;
  willMutateStorage: false;
  willResolveCredentialSecrets: false;
  willExecuteProviderAction: false;
  sideEffectBoundary: 'pure-local-provider-live-activation-gate-no-oauth-no-fetch-no-socket-no-storage-no-provider-sdk-no-send';
}

const DECISION_BOUNDARY =
  'pure-local-provider-live-activation-gate-no-oauth-no-fetch-no-socket-no-storage-no-provider-sdk-no-send' as const;
const PLAN_BOUNDARY =
  'plan-only-no-oauth-no-fetch-no-socket-no-storage-no-provider-sdk-no-send' as const;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const SAFE_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._()+-]{0,179}$/;
const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000;
const OPAQUE_PROVIDER_REFERENCE_PATTERN = /^[A-Za-z0-9]+-[A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._:@/+~-]{1,179}$/;
const URL_LIKE_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;

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
] as const;

const ROOT_KEYS = new Set([
  'providerIdentity',
  'accountIntent',
  'actionScope',
  'credentialReference',
  'consentSession',
  'runtimeOwnership',
  'now',
]);

const PROVIDER_IDENTITY_KEYS = new Set([
  'contract',
  'reviewState',
  'providerId',
  'providerLabel',
  'runtimeOwner',
  'providerIdentityReviewed',
]);

const ACCOUNT_INTENT_KEYS = new Set([
  'contract',
  'reviewState',
  'providerId',
  'accountId',
  'credentialReferenceId',
  'accountIntentReviewed',
]);

const ACTION_SCOPE_KEYS = new Set([
  'contract',
  'reviewState',
  'providerId',
  'accountId',
  'credentialReferenceId',
  'scopeId',
  'actions',
  'sendRequiresExplicitUserApproval',
  'actionScopeReviewed',
]);

const CONSENT_SESSION_KEYS = new Set([
  'contract',
  'reviewState',
  'providerId',
  'accountId',
  'credentialReferenceId',
  'scopeId',
  'userConsentGranted',
  'sessionFresh',
  'issuedAt',
  'reviewedAt',
  'expiresAt',
]);

const RUNTIME_OWNERSHIP_KEYS = new Set([
  'contract',
  'reviewState',
  'runtimeOwner',
  'runtimeId',
  'providerId',
  'accountId',
  'credentialReferenceId',
  'scopeId',
  'supportedActions',
  'noSendWithoutUserApproval',
  'runtimeOwnershipReviewed',
]);

const ALLOWED_ACTIONS = new Set<ProviderLiveActivationAction>([
  'provider_auth',
  'provider_sync',
  'provider_send',
]);

const FORBIDDEN_RUNTIME_MARKERS = [
  'callback',
  'requester',
  'fetch',
  'socket',
  'localstorage',
  'sessionstorage',
  'indexeddb',
  'persiststorage',
  'mutatestorage',
  'execute',
  'executable',
  'liveaction',
  'providerapi',
  'providersdk',
  'oauthwindow',
  'openwindow',
  'sendmail',
  'syncmail',
] as const;

function blocker(
  code: ProviderLiveActivationBlockerCode,
  detail: string,
  field?: string,
  credentialRejectReason?: ConnectorCredentialReferenceRejectReason,
): ProviderLiveActivationBlocker {
  return Object.freeze({
    code,
    detail,
    field,
    credentialRejectReason,
  });
}

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
  if (!OPAQUE_PROVIDER_REFERENCE_PATTERN.test(trimmed) && URL_LIKE_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return undefined;
  }
  return trimmed;
}

function safeLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!SAFE_LABEL_PATTERN.test(trimmed)) return undefined;
  if (isSecretLikeFieldName(trimmed)) return undefined;
  if (isTokenShapedIdentifier(trimmed)) return undefined;
  return trimmed;
}

function safeTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return undefined;
  if (value < 0 || value > MAX_DATE_TIMESTAMP) return undefined;
  return value;
}

function hasForbiddenRuntimeShape(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasForbiddenRuntimeShape(item, seen));
  return Object.entries(value).some(([key, nestedValue]) => {
    const normalizedKey = normalize(key);
    return FORBIDDEN_RUNTIME_MARKERS.some((marker) => normalizedKey.includes(marker))
      || hasForbiddenRuntimeShape(nestedValue, seen);
  });
}

function safeActions(value: unknown): readonly ProviderLiveActivationAction[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > ALLOWED_ACTIONS.size) return undefined;
  const actions: ProviderLiveActivationAction[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !ALLOWED_ACTIONS.has(item as ProviderLiveActivationAction)) return undefined;
    const action = item as ProviderLiveActivationAction;
    if (!actions.includes(action)) actions.push(action);
  }
  return actions.length === 0 ? undefined : Object.freeze(actions);
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

function blocked(blockers: readonly ProviderLiveActivationBlocker[]): Readonly<ProviderLiveActivationDecision> {
  return Object.freeze({
    status: 'blocked',
    mayPrepareLiveActivation: false,
    blockers: Object.freeze([...blockers]),
    executable: false,
    sideEffects: 'none',
    willStartOAuth: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    willResolveCredentialSecrets: false,
    willExecuteProviderAction: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}

function parseProviderIdentity(
  value: unknown,
): { ok: true; value: ProviderLiveActivationProviderIdentityFact } | { ok: false; blocker: ProviderLiveActivationBlocker } {
  if (!isRecord(value) || !hasOnlyKeys(value, PROVIDER_IDENTITY_KEYS)) {
    return { ok: false, blocker: blocker('provider_identity_invalid', 'Provider identity must be an exact reviewed metadata fact.', 'providerIdentity') };
  }
  const providerId = safeIdentifier(value.providerId);
  const providerLabel = safeLabel(value.providerLabel);
  if (
    value.contract !== 'provider-live-identity-v1'
    || !providerId
    || !providerLabel
    || value.runtimeOwner !== 'provider-runtime-adapter'
    || value.providerIdentityReviewed !== true
  ) {
    return { ok: false, blocker: blocker('provider_identity_invalid', 'Provider identity metadata is malformed or secret-shaped.', 'providerIdentity') };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, blocker: blocker('provider_identity_unreviewed', 'Provider identity must be explicitly reviewed before live activation planning.', 'providerIdentity.reviewState') };
  }
  return {
    ok: true,
    value: Object.freeze({
      contract: 'provider-live-identity-v1',
      reviewState: 'reviewed',
      providerId,
      providerLabel,
      runtimeOwner: 'provider-runtime-adapter',
      providerIdentityReviewed: true,
    }),
  };
}

function parseAccountIntent(
  value: unknown,
): { ok: true; value: ProviderLiveActivationAccountIntentFact } | { ok: false; blocker: ProviderLiveActivationBlocker } {
  if (!isRecord(value) || !hasOnlyKeys(value, ACCOUNT_INTENT_KEYS)) {
    return { ok: false, blocker: blocker('account_intent_invalid', 'Account intent must be an exact reviewed metadata fact.', 'accountIntent') };
  }
  const providerId = safeIdentifier(value.providerId);
  const accountId = safeIdentifier(value.accountId);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  if (
    value.contract !== 'provider-live-account-intent-v1'
    || !providerId
    || !accountId
    || !credentialReferenceId
    || value.accountIntentReviewed !== true
  ) {
    return { ok: false, blocker: blocker('account_intent_invalid', 'Account intent metadata is malformed or secret-shaped.', 'accountIntent') };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, blocker: blocker('account_intent_unreviewed', 'Account intent must be reviewed before live activation planning.', 'accountIntent.reviewState') };
  }
  return {
    ok: true,
    value: Object.freeze({
      contract: 'provider-live-account-intent-v1',
      reviewState: 'reviewed',
      providerId,
      accountId,
      credentialReferenceId,
      accountIntentReviewed: true,
    }),
  };
}

function parseActionScope(
  value: unknown,
): { ok: true; value: ProviderLiveActivationActionScopeFact } | { ok: false; blocker: ProviderLiveActivationBlocker } {
  if (!isRecord(value) || !hasOnlyKeys(value, ACTION_SCOPE_KEYS)) {
    return { ok: false, blocker: blocker('action_scope_invalid', 'Action scope must be an exact reviewed metadata fact.', 'actionScope') };
  }
  const providerId = safeIdentifier(value.providerId);
  const accountId = safeIdentifier(value.accountId);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const scopeId = safeIdentifier(value.scopeId);
  const actions = safeActions(value.actions);
  if (
    value.contract !== 'provider-live-action-scope-v1'
    || !providerId
    || !accountId
    || !credentialReferenceId
    || !scopeId
    || !actions
    || value.actionScopeReviewed !== true
  ) {
    return { ok: false, blocker: blocker('action_scope_invalid', 'Action scope metadata is malformed or secret-shaped.', 'actionScope') };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, blocker: blocker('action_scope_unreviewed', 'Action scope must be reviewed before live activation planning.', 'actionScope.reviewState') };
  }
  if (actions.includes('provider_send') && value.sendRequiresExplicitUserApproval !== true) {
    return { ok: false, blocker: blocker('action_scope_send_approval_missing', 'Send-capable action scopes must explicitly require user approval before any future send.', 'actionScope.sendRequiresExplicitUserApproval') };
  }
  if (actions.includes('provider_send') || value.sendRequiresExplicitUserApproval === true) {
    return {
      ok: true,
      value: Object.freeze({
        contract: 'provider-live-action-scope-v1',
        reviewState: 'reviewed',
        providerId,
        accountId,
        credentialReferenceId,
        scopeId,
        actions,
        sendRequiresExplicitUserApproval: true,
        actionScopeReviewed: true,
      }),
    };
  }
  return { ok: false, blocker: blocker('action_scope_invalid', 'Action scope must preserve a no-send-without-approval posture.', 'actionScope.sendRequiresExplicitUserApproval') };
}

function parseConsentSession(
  value: unknown,
  now: number,
): { ok: true; value: ProviderLiveActivationConsentSessionFact } | { ok: false; blocker: ProviderLiveActivationBlocker } {
  if (!isRecord(value) || !hasOnlyKeys(value, CONSENT_SESSION_KEYS)) {
    return { ok: false, blocker: blocker('consent_session_invalid', 'Consent/session metadata must be an exact reviewed fact.', 'consentSession') };
  }
  const providerId = safeIdentifier(value.providerId);
  const accountId = safeIdentifier(value.accountId);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const scopeId = safeIdentifier(value.scopeId);
  const issuedAt = safeTimestamp(value.issuedAt);
  const reviewedAt = safeTimestamp(value.reviewedAt);
  const expiresAt = safeTimestamp(value.expiresAt);
  if (
    value.contract !== 'provider-live-consent-session-v1'
    || !providerId
    || !accountId
    || !credentialReferenceId
    || !scopeId
    || issuedAt === undefined
    || reviewedAt === undefined
    || expiresAt === undefined
  ) {
    return { ok: false, blocker: blocker('consent_session_invalid', 'Consent/session metadata is malformed or secret-shaped.', 'consentSession') };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, blocker: blocker('consent_session_unreviewed', 'Consent/session metadata must be reviewed before live activation planning.', 'consentSession.reviewState') };
  }
  if (value.userConsentGranted !== true) {
    return { ok: false, blocker: blocker('consent_session_not_granted', 'Live activation planning requires explicit reviewed user consent.', 'consentSession.userConsentGranted') };
  }
  if (value.sessionFresh !== true) {
    return { ok: false, blocker: blocker('consent_session_stale', 'Consent/session metadata must assert a fresh reviewed session.', 'consentSession.sessionFresh') };
  }
  if (issuedAt > reviewedAt || reviewedAt > expiresAt || expiresAt <= now) {
    return { ok: false, blocker: blocker('consent_session_expired', 'Consent/session timestamps must be ordered and unexpired at evaluation time.', 'consentSession.expiresAt') };
  }
  return {
    ok: true,
    value: Object.freeze({
      contract: 'provider-live-consent-session-v1',
      reviewState: 'reviewed',
      providerId,
      accountId,
      credentialReferenceId,
      scopeId,
      userConsentGranted: true,
      sessionFresh: true,
      issuedAt,
      reviewedAt,
      expiresAt,
    }),
  };
}

function parseRuntimeOwnership(
  value: unknown,
): { ok: true; value: ProviderLiveActivationRuntimeOwnershipFact } | { ok: false; blocker: ProviderLiveActivationBlocker } {
  if (!isRecord(value) || !hasOnlyKeys(value, RUNTIME_OWNERSHIP_KEYS)) {
    return { ok: false, blocker: blocker('runtime_ownership_invalid', 'Runtime ownership must be an exact reviewed metadata fact.', 'runtimeOwnership') };
  }
  const runtimeId = safeIdentifier(value.runtimeId);
  const providerId = safeIdentifier(value.providerId);
  const accountId = safeIdentifier(value.accountId);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const scopeId = safeIdentifier(value.scopeId);
  const supportedActions = safeActions(value.supportedActions);
  if (
    value.contract !== 'provider-live-runtime-ownership-v1'
    || value.runtimeOwner !== 'provider-runtime-adapter'
    || !runtimeId
    || !providerId
    || !accountId
    || !credentialReferenceId
    || !scopeId
    || !supportedActions
    || value.runtimeOwnershipReviewed !== true
  ) {
    return { ok: false, blocker: blocker('runtime_ownership_invalid', 'Runtime ownership metadata is malformed or secret-shaped.', 'runtimeOwnership') };
  }
  if (value.reviewState !== 'reviewed') {
    return { ok: false, blocker: blocker('runtime_ownership_unreviewed', 'Runtime ownership must be reviewed before live activation planning.', 'runtimeOwnership.reviewState') };
  }
  if (supportedActions.includes('provider_send') && value.noSendWithoutUserApproval !== true) {
    return { ok: false, blocker: blocker('runtime_ownership_send_approval_missing', 'Send-capable runtime ownership must preserve no-send-without-user-approval posture.', 'runtimeOwnership.noSendWithoutUserApproval') };
  }
  if (supportedActions.includes('provider_send') || value.noSendWithoutUserApproval === true) {
    return {
      ok: true,
      value: Object.freeze({
        contract: 'provider-live-runtime-ownership-v1',
        reviewState: 'reviewed',
        runtimeOwner: 'provider-runtime-adapter',
        runtimeId,
        providerId,
        accountId,
        credentialReferenceId,
        scopeId,
        supportedActions,
        noSendWithoutUserApproval: true,
        runtimeOwnershipReviewed: true,
      }),
    };
  }
  return { ok: false, blocker: blocker('runtime_ownership_invalid', 'Runtime ownership must preserve a no-send-without-approval posture.', 'runtimeOwnership.noSendWithoutUserApproval') };
}

function buildPlan(
  providerIdentity: ProviderLiveActivationProviderIdentityFact,
  accountIntent: ProviderLiveActivationAccountIntentFact,
  actionScope: ProviderLiveActivationActionScopeFact,
  credentialReference: ConnectorCredentialReference,
  runtimeOwnership: ProviderLiveActivationRuntimeOwnershipFact,
): ProviderLiveActivationPlan {
  const sendCapable = actionScope.actions.includes('provider_send');
  return Object.freeze({
    contract: 'provider-live-activation-plan-v1',
    providerId: providerIdentity.providerId,
    providerLabel: providerIdentity.providerLabel,
    runtimeOwner: 'provider-runtime-adapter',
    runtimeId: runtimeOwnership.runtimeId,
    accountId: accountIntent.accountId,
    credentialReference: freezeCredentialReference(credentialReference),
    scopeId: actionScope.scopeId,
    actions: Object.freeze([...actionScope.actions]),
    sendCapable,
    requiresUserApprovalBeforeSend: sendCapable,
    providerIdentityReviewed: true,
    accountIntentReviewed: true,
    actionScopeReviewed: true,
    consentSessionReviewed: true,
    runtimeOwnershipReviewed: true,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: PLAN_BOUNDARY,
  });
}

export function evaluateProviderLiveActivationGate(
  input: ProviderLiveActivationGateInput,
): Readonly<ProviderLiveActivationDecision> {
  if (!isRuntimeTrustedContractObject(input) || !hasOnlyKeys(input, ROOT_KEYS)) {
    return blocked([blocker('root_shape_invalid', 'Provider live activation input must contain only the reviewed local gate fields.', 'input')]);
  }
  if (hasConnectorSecretMaterial(input)) {
    return blocked([blocker('raw_secret_material', 'Raw secret material is forbidden anywhere in provider live activation inputs.', 'input')]);
  }
  if (hasForbiddenRuntimeShape(input)) {
    return blocked([blocker('runtime_shape_forbidden', 'Executable, callback, fetch, socket, storage, or live-action fields are forbidden in provider live activation inputs.', 'input')]);
  }

  const now = input.now === undefined ? Date.now() : safeTimestamp(input.now);
  const evaluationNow = now ?? Date.now();
  const blockers: ProviderLiveActivationBlocker[] = [];
  if (input.now !== undefined && now === undefined) {
    blockers.push(blocker('consent_session_invalid', 'Provider live activation evaluation time must be a valid timestamp when supplied.', 'now'));
  }

  if (input.providerIdentity === undefined) {
    blockers.push(blocker('provider_identity_missing', 'Provider live activation requires a reviewed provider identity fact.', 'providerIdentity'));
  }
  if (input.accountIntent === undefined) {
    blockers.push(blocker('account_intent_missing', 'Provider live activation requires a reviewed account intent fact.', 'accountIntent'));
  }
  if (input.actionScope === undefined) {
    blockers.push(blocker('action_scope_missing', 'Provider live activation requires a reviewed action scope fact.', 'actionScope'));
  }
  if (input.credentialReference === undefined) {
    blockers.push(blocker('credential_reference_missing', 'Provider live activation requires an opaque credential reference.', 'credentialReference'));
  }
  if (input.consentSession === undefined) {
    blockers.push(blocker('consent_session_missing', 'Provider live activation requires reviewed consent/session freshness metadata.', 'consentSession'));
  }
  if (input.runtimeOwnership === undefined) {
    blockers.push(blocker('runtime_ownership_missing', 'Provider live activation requires reviewed runtime ownership metadata.', 'runtimeOwnership'));
  }
  if (blockers.length > 0) return blocked(blockers);

  const providerIdentity = parseProviderIdentity(input.providerIdentity);
  if (!providerIdentity.ok) blockers.push(providerIdentity.blocker);
  const accountIntent = parseAccountIntent(input.accountIntent);
  if (!accountIntent.ok) blockers.push(accountIntent.blocker);
  const actionScope = parseActionScope(input.actionScope);
  if (!actionScope.ok) blockers.push(actionScope.blocker);

  const credentialValidation = validateConnectorCredentialReference(input.credentialReference);
  let credentialReference: ConnectorCredentialReference | undefined;
  if (!credentialValidation.ok) {
    blockers.push(blocker(
      'credential_reference_invalid',
      'Credential reference rejected by the connector credential boundary.',
      credentialValidation.field ? `credentialReference.${credentialValidation.field}` : 'credentialReference',
      credentialValidation.reason,
    ));
  } else {
    credentialReference = credentialValidation.reference;
    if (!credentialReference.accountId) {
      blockers.push(blocker(
        'credential_account_missing',
        'Credential reference must bind to a reviewed account id for live activation planning.',
        'credentialReference.accountId',
      ));
    }
  }

  const consentSession = parseConsentSession(input.consentSession, evaluationNow);
  if (!consentSession.ok) blockers.push(consentSession.blocker);
  const runtimeOwnership = parseRuntimeOwnership(input.runtimeOwnership);
  if (!runtimeOwnership.ok) blockers.push(runtimeOwnership.blocker);

  if (
    providerIdentity.ok
    && accountIntent.ok
    && providerIdentity.value.providerId !== accountIntent.value.providerId
  ) {
    blockers.push(blocker('provider_mismatch', 'Provider identity and account intent must bind to the same provider.', 'accountIntent.providerId'));
  }

  if (
    providerIdentity.ok
    && credentialReference
    && credentialReference.providerId !== providerIdentity.value.providerId
  ) {
    blockers.push(blocker('credential_provider_mismatch', 'Credential reference providerId must match the reviewed provider identity.', 'credentialReference.providerId'));
  }

  if (
    accountIntent.ok
    && credentialReference
    && credentialReference.providerId !== accountIntent.value.providerId
  ) {
    blockers.push(blocker('credential_provider_mismatch', 'Credential reference providerId must match the reviewed account intent provider.', 'credentialReference.providerId'));
  }

  if (
    accountIntent.ok
    && credentialReference?.accountId
    && credentialReference.accountId !== accountIntent.value.accountId
  ) {
    blockers.push(blocker('credential_account_mismatch', 'Credential reference accountId must match the reviewed account intent.', 'credentialReference.accountId'));
  }

  if (
    accountIntent.ok
    && credentialReference
    && credentialReference.id !== accountIntent.value.credentialReferenceId
  ) {
    blockers.push(blocker('credential_reference_mismatch', 'Account intent must reference the same opaque credential reference id that passed the credential boundary.', 'accountIntent.credentialReferenceId'));
  }

  if (
    runtimeOwnership.ok
    && credentialReference?.connectorId
    && credentialReference.connectorId !== runtimeOwnership.value.runtimeOwner
  ) {
    blockers.push(blocker('credential_reference_mismatch', 'Credential reference connectorId must bind to the reviewed provider runtime owner.', 'credentialReference.connectorId'));
  }

  if (actionScope.ok && accountIntent.ok) {
    if (actionScope.value.providerId !== accountIntent.value.providerId) {
      blockers.push(blocker('provider_mismatch', 'Action scope providerId must match the reviewed account intent provider.', 'actionScope.providerId'));
    }
    if (actionScope.value.accountId !== accountIntent.value.accountId) {
      blockers.push(blocker('account_mismatch', 'Action scope accountId must match the reviewed account intent.', 'actionScope.accountId'));
    }
    if (actionScope.value.credentialReferenceId !== accountIntent.value.credentialReferenceId) {
      blockers.push(blocker('credential_reference_mismatch', 'Action scope credentialReferenceId must match the reviewed account intent.', 'actionScope.credentialReferenceId'));
    }
  }

  if (consentSession.ok && accountIntent.ok) {
    if (consentSession.value.providerId !== accountIntent.value.providerId) {
      blockers.push(blocker('provider_mismatch', 'Consent/session providerId must match the reviewed account intent provider.', 'consentSession.providerId'));
    }
    if (consentSession.value.accountId !== accountIntent.value.accountId) {
      blockers.push(blocker('account_mismatch', 'Consent/session accountId must match the reviewed account intent.', 'consentSession.accountId'));
    }
    if (consentSession.value.credentialReferenceId !== accountIntent.value.credentialReferenceId) {
      blockers.push(blocker('credential_reference_mismatch', 'Consent/session credentialReferenceId must match the reviewed account intent.', 'consentSession.credentialReferenceId'));
    }
  }

  if (runtimeOwnership.ok && accountIntent.ok) {
    if (runtimeOwnership.value.providerId !== accountIntent.value.providerId) {
      blockers.push(blocker('provider_mismatch', 'Runtime ownership providerId must match the reviewed account intent provider.', 'runtimeOwnership.providerId'));
    }
    if (runtimeOwnership.value.accountId !== accountIntent.value.accountId) {
      blockers.push(blocker('account_mismatch', 'Runtime ownership accountId must match the reviewed account intent.', 'runtimeOwnership.accountId'));
    }
    if (runtimeOwnership.value.credentialReferenceId !== accountIntent.value.credentialReferenceId) {
      blockers.push(blocker('credential_reference_mismatch', 'Runtime ownership credentialReferenceId must match the reviewed account intent.', 'runtimeOwnership.credentialReferenceId'));
    }
  }

  if (actionScope.ok && consentSession.ok && actionScope.value.scopeId !== consentSession.value.scopeId) {
    blockers.push(blocker('scope_mismatch', 'Action scope and consent/session scopeId must match.', 'consentSession.scopeId'));
  }

  if (actionScope.ok && runtimeOwnership.ok) {
    if (actionScope.value.scopeId !== runtimeOwnership.value.scopeId) {
      blockers.push(blocker('scope_mismatch', 'Action scope and runtime ownership scopeId must match.', 'runtimeOwnership.scopeId'));
    }
    const unsupportedActions = actionScope.value.actions.filter((action) => !runtimeOwnership.value.supportedActions.includes(action));
    if (unsupportedActions.length > 0) {
      blockers.push(blocker('action_not_supported', 'Runtime ownership must support every reviewed action scope action before future live activation can be considered.', 'runtimeOwnership.supportedActions'));
    }
  }

  if (blockers.length > 0) return blocked(blockers);
  if (
    !providerIdentity.ok
    || !accountIntent.ok
    || !actionScope.ok
    || !consentSession.ok
    || !runtimeOwnership.ok
    || !credentialReference
  ) {
    return blocked([
      blocker(
        'root_shape_invalid',
        'Provider live activation readiness cannot proceed without fully parsed reviewed ownership facts.',
        'input',
      ),
    ]);
  }

  const plan = buildPlan(
    providerIdentity.value,
    accountIntent.value,
    actionScope.value,
    credentialReference,
    runtimeOwnership.value,
  );

  return Object.freeze({
    status: 'activation-ready',
    mayPrepareLiveActivation: true,
    activationPlan: plan,
    blockers: Object.freeze([]),
    executable: false,
    sideEffects: 'none',
    willStartOAuth: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    willResolveCredentialSecrets: false,
    willExecuteProviderAction: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}
