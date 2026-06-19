import {
  hasConnectorSecretMaterial,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
  type ConnectorCredentialReferenceRejectReason,
} from './connector-credential-boundary';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type ProviderAuthSessionSurface = 'emailcaddy' | 'assistantcaddy';

export type ProviderAuthSessionAdapterAction =
  | 'start_oauth'
  | 'complete_oauth'
  | 'refresh_session'
  | 'revoke_session'
  | 'test_provider_auth';

export type ProviderAuthSessionAdapterPlanStatus = 'allow' | 'block';

export type ProviderAuthSessionAdapterPlanBlockReason =
  | 'unknown_action'
  | 'unknown_surface'
  | 'missing_provider_id'
  | 'invalid_provider_id'
  | 'invalid_account_id'
  | 'invalid_session_handle_reference'
  | 'invalid_callback_metadata'
  | 'callback_ownership_mismatch'
  | 'callback_not_reviewed'
  | 'callback_origin_stale'
  | 'missing_adapter_capabilities'
  | 'adapter_provider_mismatch'
  | 'adapter_surface_mismatch'
  | 'adapter_action_not_supported'
  | 'adapter_executable_claim_blocked'
  | 'missing_explicit_consent'
  | 'explicit_consent_mismatch'
  | 'explicit_consent_not_reviewed'
  | 'explicit_consent_not_granted'
  | 'explicit_consent_expired'
  | 'missing_credential_reference'
  | 'invalid_credential_reference'
  | 'credential_provider_mismatch'
  | 'credential_account_mismatch'
  | 'missing_session_handle_reference'
  | 'session_provider_mismatch'
  | 'session_account_mismatch'
  | 'unsafe_input_shape'
  | 'token_shaped_identifier'
  | 'raw_secret_material_detected';

export type ProviderAuthSessionAdapterPlanAllowReason =
  | 'inert_start_oauth_plan_ready'
  | 'inert_complete_oauth_plan_ready'
  | 'inert_refresh_session_plan_ready'
  | 'inert_revoke_session_plan_ready'
  | 'inert_test_provider_auth_plan_ready';

export interface ProviderAuthSessionAdapterExplicitConsent {
  schemaVersion: 1;
  action: ProviderAuthSessionAdapterAction;
  surface: ProviderAuthSessionSurface;
  providerId: string;
  accountId?: string;
  sessionHandleReferenceId?: string;
  granted: boolean;
  reviewed: boolean;
  issuedAt: number;
  expiresAt: number;
}

export interface ProviderAuthSessionCallbackMetadata {
  schemaVersion: 1;
  surface: ProviderAuthSessionSurface;
  providerId: string;
  accountId?: string;
  callbackKind: 'redirect-origin' | 'local-callback-origin';
  origin: string;
  path?: string;
  reviewed: boolean;
  reviewedAt: number;
  expiresAt: number;
}

export interface ProviderAuthSessionHandleReference {
  schemaVersion: 1;
  id: string;
  providerId: string;
  surface: ProviderAuthSessionSurface;
  accountId?: string;
  credentialReferenceId?: string;
  createdAt?: number;
}

export interface ProviderAuthSessionAdapterCapabilities {
  schemaVersion: 1;
  providerId: string;
  surface: ProviderAuthSessionSurface;
  supportsStartOAuth: boolean;
  supportsCompleteOAuth: boolean;
  supportsRefreshSession: boolean;
  supportsRevokeSession: boolean;
  supportsProviderAuthTest: boolean;
  executable?: false;
  sideEffects?: 'none';
  opensWindow?: false;
  browserRedirects?: false;
}

export interface ProviderAuthSessionAdapterPlanInput {
  action?: ProviderAuthSessionAdapterAction | string;
  surface?: ProviderAuthSessionSurface | string;
  providerId?: string;
  accountId?: string;
  credentialReference?: unknown;
  sessionHandleReference?: unknown;
  callbackMetadata?: unknown;
  adapterCapabilities?: unknown;
  explicitConsent?: unknown;
  now?: number;
  additionalUntrustedInputs?: readonly unknown[];
}

export interface ProviderAuthSessionAdapterPlanDecision {
  status: ProviderAuthSessionAdapterPlanStatus;
  action: ProviderAuthSessionAdapterAction | 'unknown';
  surface?: ProviderAuthSessionSurface;
  providerId?: string;
  accountId?: string;
  executable: false;
  sideEffects: 'none';
  allowReason?: ProviderAuthSessionAdapterPlanAllowReason;
  blockReasons: readonly ProviderAuthSessionAdapterPlanBlockReason[];
  credentialReference?: ConnectorCredentialReference;
  credentialRejectReason?: ConnectorCredentialReferenceRejectReason;
  sessionHandleReference?: ProviderAuthSessionHandleReference;
  callbackMetadata?: ProviderAuthSessionCallbackMetadata;
  adapterCapabilities?: ProviderAuthSessionAdapterCapabilities;
  sideEffectBoundary: 'pure-local-provider-auth-session-plan-no-fetch-no-storage-no-oauth-no-session-mutation-no-window-open';
}

const SIDE_EFFECT_BOUNDARY =
  'pure-local-provider-auth-session-plan-no-fetch-no-storage-no-oauth-no-session-mutation-no-window-open' as const;

const SUPPORTED_ACTIONS = new Set<ProviderAuthSessionAdapterAction>([
  'start_oauth',
  'complete_oauth',
  'refresh_session',
  'revoke_session',
  'test_provider_auth',
]);

const SUPPORTED_SURFACES = new Set<ProviderAuthSessionSurface>(['emailcaddy', 'assistantcaddy']);
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:@/+~-]+$/;
const SAFE_CALLBACK_PATH_PATTERN = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/;
const OPAQUE_CREDENTIAL_REFERENCE_PREFIXES = ['credref:', 'local-bridge:', 'macos-login:', 'provider-oauth:', 'vault:'] as const;
const URL_OR_SCHEME_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:\/\//i,
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_CALLBACK_PATH_LENGTH = 240;
const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000;

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
] as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function tokenShapedIdentifier(value: string): boolean {
  return TOKEN_SHAPED_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value));
}

function identifierLooksUrlOrSchemeShaped(value: string): boolean {
  return URL_OR_SCHEME_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function hasOpaqueCredentialReferencePrefix(value: string): boolean {
  const normalized = value.toLowerCase();
  return OPAQUE_CREDENTIAL_REFERENCE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_IDENTIFIER_LENGTH) return undefined;
  if (!SAFE_IDENTIFIER_PATTERN.test(trimmed)) return undefined;
  if (tokenShapedIdentifier(trimmed)) return undefined;
  return trimmed;
}

function safeGenericIdentifier(value: unknown): string | undefined {
  const identifier = safeIdentifier(value);
  if (!identifier || identifierLooksUrlOrSchemeShaped(identifier)) return undefined;
  return identifier;
}

function safeCredentialReferenceIdentifier(value: unknown): string | undefined {
  const identifier = safeIdentifier(value);
  if (!identifier) return undefined;
  if (identifierLooksUrlOrSchemeShaped(identifier) && !hasOpaqueCredentialReferencePrefix(identifier)) {
    return undefined;
  }
  return identifier;
}

function safeTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return undefined;
  if (value < 0 || value > MAX_DATE_TIMESTAMP) return undefined;
  return value;
}

function normalizeAction(value: unknown): ProviderAuthSessionAdapterAction | 'unknown' {
  return typeof value === 'string' && SUPPORTED_ACTIONS.has(value as ProviderAuthSessionAdapterAction)
    ? value as ProviderAuthSessionAdapterAction
    : 'unknown';
}

function normalizeSurface(value: unknown): ProviderAuthSessionSurface | undefined {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SUPPORTED_SURFACES.has(normalized as ProviderAuthSessionSurface)
    ? normalized as ProviderAuthSessionSurface
    : undefined;
}

function parseOrigin(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = new URL(value.trim());
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return undefined;
    if (parsed.protocol !== 'https:' && parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}

function parseCallbackPath(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_CALLBACK_PATH_LENGTH) return undefined;
  if (!SAFE_CALLBACK_PATH_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function parseCallbackMetadata(value: unknown): ProviderAuthSessionCallbackMetadata | undefined {
  if (!isPlainRecord(value) || value.schemaVersion !== 1) return undefined;
  const surface = normalizeSurface(value.surface);
  const providerId = safeGenericIdentifier(value.providerId);
  const accountId = safeGenericIdentifier(value.accountId);
  const origin = parseOrigin(value.origin);
  const path = parseCallbackPath(value.path);
  const reviewedAt = safeTimestamp(value.reviewedAt);
  const expiresAt = safeTimestamp(value.expiresAt);

  if (!surface || !providerId || !origin || reviewedAt === undefined || expiresAt === undefined) return undefined;
  if (value.accountId !== undefined && !accountId) return undefined;
  if (value.path !== undefined && !path) return undefined;
  if (value.callbackKind !== 'redirect-origin' && value.callbackKind !== 'local-callback-origin') return undefined;
  if (value.reviewed !== true) {
    return {
      schemaVersion: 1,
      surface,
      providerId,
      ...(accountId ? { accountId } : {}),
      callbackKind: value.callbackKind,
      origin,
      ...(path ? { path } : {}),
      reviewed: false,
      reviewedAt,
      expiresAt,
    };
  }

  return {
    schemaVersion: 1,
    surface,
    providerId,
    ...(accountId ? { accountId } : {}),
    callbackKind: value.callbackKind,
    origin,
    ...(path ? { path } : {}),
    reviewed: true,
    reviewedAt,
    expiresAt,
  };
}

function parseSessionHandleReference(value: unknown): ProviderAuthSessionHandleReference | undefined {
  if (!isPlainRecord(value) || value.schemaVersion !== 1) return undefined;
  const id = safeGenericIdentifier(value.id);
  const providerId = safeGenericIdentifier(value.providerId);
  const surface = normalizeSurface(value.surface);
  const accountId = safeGenericIdentifier(value.accountId);
  const credentialReferenceId = safeCredentialReferenceIdentifier(value.credentialReferenceId);
  const createdAt = safeTimestamp(value.createdAt);

  if (!id || !providerId || !surface) return undefined;
  if (value.accountId !== undefined && !accountId) return undefined;
  if (value.credentialReferenceId !== undefined && !credentialReferenceId) return undefined;
  if (value.createdAt !== undefined && createdAt === undefined) return undefined;

  return {
    schemaVersion: 1,
    id,
    providerId,
    surface,
    ...(accountId ? { accountId } : {}),
    ...(credentialReferenceId ? { credentialReferenceId } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
  };
}

function parseAdapterCapabilities(value: unknown): {
  capabilities?: ProviderAuthSessionAdapterCapabilities;
  executableClaimBlocked: boolean;
} {
  if (!isPlainRecord(value) || value.schemaVersion !== 1) {
    return { executableClaimBlocked: false };
  }

  const executableClaimBlocked = value.executable === true
    || value.sideEffects !== undefined && value.sideEffects !== 'none'
    || value.opensWindow === true
    || value.browserRedirects === true
    || 'openWindow' in value
    || 'windowOpen' in value
    || 'popup' in value
    || 'authorizationUrl' in value
    || 'launchUrl' in value;

  const providerId = safeGenericIdentifier(value.providerId);
  const surface = normalizeSurface(value.surface);
  if (!providerId || !surface) return { executableClaimBlocked };
  if (
    typeof value.supportsStartOAuth !== 'boolean'
    || typeof value.supportsCompleteOAuth !== 'boolean'
    || typeof value.supportsRefreshSession !== 'boolean'
    || typeof value.supportsRevokeSession !== 'boolean'
    || typeof value.supportsProviderAuthTest !== 'boolean'
  ) {
    return { executableClaimBlocked };
  }

  return {
    executableClaimBlocked,
    capabilities: {
      schemaVersion: 1,
      providerId,
      surface,
      supportsStartOAuth: value.supportsStartOAuth,
      supportsCompleteOAuth: value.supportsCompleteOAuth,
      supportsRefreshSession: value.supportsRefreshSession,
      supportsRevokeSession: value.supportsRevokeSession,
      supportsProviderAuthTest: value.supportsProviderAuthTest,
      executable: false,
      sideEffects: 'none',
      opensWindow: false,
      browserRedirects: false,
    },
  };
}

function parseExplicitConsent(value: unknown): ProviderAuthSessionAdapterExplicitConsent | undefined {
  if (!isPlainRecord(value) || value.schemaVersion !== 1) return undefined;
  const action = normalizeAction(value.action);
  const surface = normalizeSurface(value.surface);
  const providerId = safeGenericIdentifier(value.providerId);
  const accountId = safeGenericIdentifier(value.accountId);
  const sessionHandleReferenceId = safeGenericIdentifier(value.sessionHandleReferenceId);
  const issuedAt = safeTimestamp(value.issuedAt);
  const expiresAt = safeTimestamp(value.expiresAt);

  if (action === 'unknown' || !surface || !providerId || issuedAt === undefined || expiresAt === undefined) {
    return undefined;
  }
  if (value.accountId !== undefined && !accountId) return undefined;
  if (value.sessionHandleReferenceId !== undefined && !sessionHandleReferenceId) return undefined;

  return {
    schemaVersion: 1,
    action,
    surface,
    providerId,
    ...(accountId ? { accountId } : {}),
    ...(sessionHandleReferenceId ? { sessionHandleReferenceId } : {}),
    granted: value.granted === true,
    reviewed: value.reviewed === true,
    issuedAt,
    expiresAt,
  };
}

function actionSupported(
  action: ProviderAuthSessionAdapterAction | 'unknown',
  capabilities: ProviderAuthSessionAdapterCapabilities,
): boolean {
  if (action === 'start_oauth') return capabilities.supportsStartOAuth;
  if (action === 'complete_oauth') return capabilities.supportsCompleteOAuth;
  if (action === 'refresh_session') return capabilities.supportsRefreshSession;
  if (action === 'revoke_session') return capabilities.supportsRevokeSession;
  if (action === 'test_provider_auth') return capabilities.supportsProviderAuthTest;
  return false;
}

function allowReasonFor(action: ProviderAuthSessionAdapterAction): ProviderAuthSessionAdapterPlanAllowReason {
  if (action === 'start_oauth') return 'inert_start_oauth_plan_ready';
  if (action === 'complete_oauth') return 'inert_complete_oauth_plan_ready';
  if (action === 'refresh_session') return 'inert_refresh_session_plan_ready';
  if (action === 'revoke_session') return 'inert_revoke_session_plan_ready';
  return 'inert_test_provider_auth_plan_ready';
}

function requiresCredentialReference(action: ProviderAuthSessionAdapterAction | 'unknown'): boolean {
  return action === 'complete_oauth';
}

function requiresSessionHandleReference(action: ProviderAuthSessionAdapterAction | 'unknown'): boolean {
  return action === 'refresh_session' || action === 'revoke_session';
}

function requiresCallbackMetadata(action: ProviderAuthSessionAdapterAction | 'unknown'): boolean {
  return action === 'start_oauth' || action === 'complete_oauth';
}

function validIdentifierOrTokenShaped(value: unknown): 'missing' | 'safe' | 'invalid' | 'token-shaped' {
  if (typeof value !== 'string' || !value.trim()) return 'missing';
  const trimmed = value.trim();
  if (tokenShapedIdentifier(trimmed)) return 'token-shaped';
  return safeGenericIdentifier(trimmed) ? 'safe' : 'invalid';
}

function optionalOwnerMismatch(expected?: string, actual?: string): boolean {
  return (expected !== undefined || actual !== undefined) && expected !== actual;
}

function freezeDecision(decision: ProviderAuthSessionAdapterPlanDecision): ProviderAuthSessionAdapterPlanDecision {
  return Object.freeze({
    ...decision,
    blockReasons: Object.freeze([...decision.blockReasons]),
    ...(decision.credentialReference ? { credentialReference: Object.freeze({ ...decision.credentialReference }) } : {}),
    ...(decision.sessionHandleReference ? { sessionHandleReference: Object.freeze({ ...decision.sessionHandleReference }) } : {}),
    ...(decision.callbackMetadata ? { callbackMetadata: Object.freeze({ ...decision.callbackMetadata }) } : {}),
    ...(decision.adapterCapabilities ? { adapterCapabilities: Object.freeze({ ...decision.adapterCapabilities }) } : {}),
  });
}

export function createProviderAuthSessionAdapterPlan(
  input: ProviderAuthSessionAdapterPlanInput,
): ProviderAuthSessionAdapterPlanDecision {
  if (!isRuntimeTrustedContractObject(input)) {
    return freezeDecision({
      status: 'block',
      action: 'unknown',
      executable: false,
      sideEffects: 'none',
      blockReasons: ['unsafe_input_shape'],
      sideEffectBoundary: SIDE_EFFECT_BOUNDARY,
    });
  }

  const planInput = input;
  const action = normalizeAction(planInput.action);
  const surface = normalizeSurface(planInput.surface);
  const providerIdState = validIdentifierOrTokenShaped(planInput.providerId);
  const accountIdState = planInput.accountId === undefined
    ? 'missing'
    : validIdentifierOrTokenShaped(planInput.accountId);
  const providerId = providerIdState === 'safe' ? planInput.providerId!.trim() : undefined;
  const accountId = accountIdState === 'safe' ? planInput.accountId!.trim() : undefined;
  const now = planInput.now ?? Date.now();
  const blockReasons: ProviderAuthSessionAdapterPlanBlockReason[] = [];
  let credentialReference: ConnectorCredentialReference | undefined;
  let credentialRejectReason: ConnectorCredentialReferenceRejectReason | undefined;
  let sessionHandleReference: ProviderAuthSessionHandleReference | undefined;
  let callbackMetadata: ProviderAuthSessionCallbackMetadata | undefined;
  let adapterCapabilities: ProviderAuthSessionAdapterCapabilities | undefined;

  if (hasConnectorSecretMaterial(planInput) || hasConnectorSecretMaterial(planInput.additionalUntrustedInputs)) {
    blockReasons.push('raw_secret_material_detected');
  }

  if (action === 'unknown') blockReasons.push('unknown_action');
  if (!surface) blockReasons.push('unknown_surface');
  if (providerIdState === 'missing') blockReasons.push('missing_provider_id');
  if (providerIdState === 'invalid') blockReasons.push('invalid_provider_id');
  if (providerIdState === 'token-shaped' || accountIdState === 'token-shaped') blockReasons.push('token_shaped_identifier');
  if (accountIdState === 'invalid') blockReasons.push('invalid_account_id');

  const parsedCapabilities = parseAdapterCapabilities(planInput.adapterCapabilities);
  adapterCapabilities = parsedCapabilities.capabilities;
  if (parsedCapabilities.executableClaimBlocked) blockReasons.push('adapter_executable_claim_blocked');
  if (!adapterCapabilities) {
    blockReasons.push('missing_adapter_capabilities');
  } else {
    if (providerId && adapterCapabilities.providerId !== providerId) blockReasons.push('adapter_provider_mismatch');
    if (surface && adapterCapabilities.surface !== surface) blockReasons.push('adapter_surface_mismatch');
    if (!actionSupported(action, adapterCapabilities)) blockReasons.push('adapter_action_not_supported');
  }

  const explicitConsent = parseExplicitConsent(planInput.explicitConsent);
  if (!explicitConsent) {
    blockReasons.push('missing_explicit_consent');
  } else {
    if (
      explicitConsent.action !== action
      || explicitConsent.surface !== surface
      || explicitConsent.providerId !== providerId
      || optionalOwnerMismatch(accountId, explicitConsent.accountId)
    ) {
      blockReasons.push('explicit_consent_mismatch');
    }
    if (!explicitConsent.reviewed) blockReasons.push('explicit_consent_not_reviewed');
    if (!explicitConsent.granted) blockReasons.push('explicit_consent_not_granted');
    if (explicitConsent.expiresAt <= now) blockReasons.push('explicit_consent_expired');
  }

  if (planInput.credentialReference !== undefined) {
    const credentialValidation = validateConnectorCredentialReference(planInput.credentialReference);
    if (credentialValidation.ok) {
      credentialReference = credentialValidation.reference;
      if (providerId && credentialReference.providerId !== providerId) {
        blockReasons.push('credential_provider_mismatch');
      }
      if (optionalOwnerMismatch(accountId, credentialReference.accountId)) {
        blockReasons.push('credential_account_mismatch');
      }
    } else {
      credentialRejectReason = credentialValidation.reason;
      blockReasons.push('invalid_credential_reference');
    }
  } else if (requiresCredentialReference(action)) {
    blockReasons.push('missing_credential_reference');
  }

  if (planInput.sessionHandleReference !== undefined) {
    sessionHandleReference = parseSessionHandleReference(planInput.sessionHandleReference);
    if (!sessionHandleReference) {
      blockReasons.push('invalid_session_handle_reference');
    } else {
      if (providerId && sessionHandleReference.providerId !== providerId) blockReasons.push('session_provider_mismatch');
      if (surface && sessionHandleReference.surface !== surface) blockReasons.push('adapter_surface_mismatch');
      if (optionalOwnerMismatch(accountId, sessionHandleReference.accountId)) blockReasons.push('session_account_mismatch');
      if (explicitConsent?.sessionHandleReferenceId && explicitConsent.sessionHandleReferenceId !== sessionHandleReference.id) {
        blockReasons.push('explicit_consent_mismatch');
      }
    }
  } else if (requiresSessionHandleReference(action)) {
    blockReasons.push('missing_session_handle_reference');
  }

  if (
    action === 'test_provider_auth'
    && planInput.credentialReference === undefined
    && planInput.sessionHandleReference === undefined
  ) {
    blockReasons.push('missing_session_handle_reference');
  }

  if (planInput.callbackMetadata !== undefined) {
    callbackMetadata = parseCallbackMetadata(planInput.callbackMetadata);
    if (!callbackMetadata) {
      blockReasons.push('invalid_callback_metadata');
    } else {
      if (
        callbackMetadata.providerId !== providerId
        || callbackMetadata.surface !== surface
        || optionalOwnerMismatch(accountId, callbackMetadata.accountId)
      ) {
        blockReasons.push('callback_ownership_mismatch');
      }
      if (!callbackMetadata.reviewed) blockReasons.push('callback_not_reviewed');
      if (callbackMetadata.expiresAt <= now) blockReasons.push('callback_origin_stale');
    }
  } else if (requiresCallbackMetadata(action)) {
    blockReasons.push('invalid_callback_metadata');
  }

  const uniqueBlockReasons = [...new Set(blockReasons)];
  const status: ProviderAuthSessionAdapterPlanStatus = uniqueBlockReasons.length === 0 ? 'allow' : 'block';

  return freezeDecision({
    status,
    action,
    ...(surface ? { surface } : {}),
    ...(providerId ? { providerId } : {}),
    ...(accountId ? { accountId } : {}),
    executable: false,
    sideEffects: 'none',
    allowReason: status === 'allow' ? allowReasonFor(action as ProviderAuthSessionAdapterAction) : undefined,
    blockReasons: uniqueBlockReasons,
    ...(credentialReference ? { credentialReference } : {}),
    ...(credentialRejectReason ? { credentialRejectReason } : {}),
    ...(sessionHandleReference ? { sessionHandleReference } : {}),
    ...(callbackMetadata ? { callbackMetadata } : {}),
    ...(adapterCapabilities ? { adapterCapabilities } : {}),
    sideEffectBoundary: SIDE_EFFECT_BOUNDARY,
  });
}
