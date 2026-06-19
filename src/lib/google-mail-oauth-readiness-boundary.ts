import { hasConnectorSecretMaterial } from './connector-credential-boundary';
import { hasStoredEmailSecretMaterial } from './email-onboarding';

export type GoogleMailOAuthAccountIntent =
  | 'personal-mailbox'
  | 'workspace-mailbox'
  | 'shared-workspace-mailbox'
  | 'delegated-workspace-mailbox';

export type GoogleMailOAuthReadinessStatus = 'ready' | 'blocked';

export type GoogleMailOAuthReadinessReason =
  | 'google_mail_oauth_readiness_ready'
  | 'invalid_root_shape'
  | 'raw_secret_material'
  | 'forbidden_runtime_field'
  | 'invalid_now'
  | 'missing_provider_id'
  | 'unsupported_provider_id'
  | 'missing_account_id'
  | 'invalid_account_id'
  | 'missing_account_intent'
  | 'invalid_account_intent'
  | 'missing_reviewed_scopes'
  | 'invalid_reviewed_scopes'
  | 'unreviewed_scope'
  | 'duplicate_scope_id'
  | 'missing_consent_evidence'
  | 'invalid_consent_evidence'
  | 'consent_not_reviewed'
  | 'consent_not_granted'
  | 'consent_expired'
  | 'consent_provider_mismatch'
  | 'consent_account_mismatch'
  | 'consent_intent_mismatch'
  | 'consent_scope_mismatch'
  | 'missing_redirect_plan'
  | 'invalid_redirect_plan'
  | 'redirect_not_reviewed'
  | 'redirect_expired'
  | 'redirect_provider_mismatch'
  | 'redirect_account_mismatch'
  | 'redirect_intent_mismatch';

export interface GoogleMailOAuthReviewedScope {
  schemaVersion: 1;
  scopeKind: 'google-mail-oauth-reviewed-scope';
  id: string;
  label: string;
  reviewed: true;
}

export interface GoogleMailOAuthConsentEvidence {
  schemaVersion: 1;
  consentKind: 'google-mail-oauth-reviewed-consent';
  providerId: 'google-gmail';
  accountId: string;
  accountIntent: GoogleMailOAuthAccountIntent;
  scopeIds: readonly string[];
  granted: true;
  reviewed: true;
  issuedAt: number;
  expiresAt: number;
}

export interface GoogleMailOAuthRedirectPlan {
  schemaVersion: 1;
  planKind: 'google-mail-oauth-reviewed-redirect-plan';
  providerId: 'google-gmail';
  accountId: string;
  accountIntent: GoogleMailOAuthAccountIntent;
  flow: 'external-browser-oauth';
  redirectOrigin: string;
  redirectPath: string;
  reviewed: true;
  reviewedAt: number;
  expiresAt: number;
}

export interface GoogleMailOAuthReadinessInput {
  providerId: 'google-gmail';
  accountId: string;
  accountIntent: GoogleMailOAuthAccountIntent;
  reviewedScopes: readonly GoogleMailOAuthReviewedScope[];
  consentEvidence: GoogleMailOAuthConsentEvidence;
  redirectPlan: GoogleMailOAuthRedirectPlan;
  now?: number;
}

export interface GoogleMailOAuthReadinessDecision {
  status: GoogleMailOAuthReadinessStatus;
  ready: boolean;
  reason: GoogleMailOAuthReadinessReason;
  blockers: readonly GoogleMailOAuthReadinessReason[];
  readinessContract: 'google-mail-oauth-readiness-boundary-v1';
  providerId?: 'google-gmail';
  account?: {
    id: string;
    intent: GoogleMailOAuthAccountIntent;
  };
  reviewedScopes?: readonly {
    id: string;
    label: string;
  }[];
  consentWindow?: {
    issuedAt: number;
    expiresAt: number;
  };
  redirectPlan?: {
    flow: 'external-browser-oauth';
    origin: string;
    path: string;
    reviewedAt: number;
    expiresAt: number;
  };
  executable: false;
  sideEffects: 'none';
  opensBrowserNow: false;
  willFetch: false;
  willOpenSocket: false;
  willMutateStorage: false;
  willStoreCredential: false;
  willCollectCredential: false;
  willCallProvider: false;
  sideEffectBoundary: 'pure-local-google-mail-oauth-readiness-boundary-no-fetch-no-storage-no-oauth-no-window-no-provider-call';
}

const SIDE_EFFECT_BOUNDARY =
  'pure-local-google-mail-oauth-readiness-boundary-no-fetch-no-storage-no-oauth-no-window-no-provider-call' as const;

const ROOT_KEYS = new Set([
  'providerId',
  'accountId',
  'accountIntent',
  'reviewedScopes',
  'consentEvidence',
  'redirectPlan',
  'now',
]);

const SCOPE_KEYS = new Set([
  'schemaVersion',
  'scopeKind',
  'id',
  'label',
  'reviewed',
]);

const CONSENT_KEYS = new Set([
  'schemaVersion',
  'consentKind',
  'providerId',
  'accountId',
  'accountIntent',
  'scopeIds',
  'granted',
  'reviewed',
  'issuedAt',
  'expiresAt',
]);

const REDIRECT_PLAN_KEYS = new Set([
  'schemaVersion',
  'planKind',
  'providerId',
  'accountId',
  'accountIntent',
  'flow',
  'redirectOrigin',
  'redirectPath',
  'reviewed',
  'reviewedAt',
  'expiresAt',
]);

const ACCOUNT_INTENTS = new Set<GoogleMailOAuthAccountIntent>([
  'personal-mailbox',
  'workspace-mailbox',
  'shared-workspace-mailbox',
  'delegated-workspace-mailbox',
]);

const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const SAFE_SCOPE_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .,:/()_+-]{1,119}$/;
const SAFE_CALLBACK_PATH_PATTERN = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/;
const MAX_TIMESTAMP = 8_640_000_000_000_000;
const RAW_SECRET_VALUE_PATTERN =
  /(?:bearer\s+[a-z0-9._~+/=-]{8,}|basic\s+[a-z0-9._~+/=-]{8,}|oauth[\s_-]?code\s*[:=]\s*\S+|authorization\s*:\s*\S+|id[\s_-]?token\s*[:=]\s*\S+|refresh[\s_-]?token\s*[:=]\s*\S+|access[\s_-]?token\s*[:=]\s*\S+|client[\s_-]?secret\s*[:=]\s*\S+|password\s*[:=]\s*\S+|xox[a-z0-9]*-[a-z0-9-]{8,}|ya29\.[a-z0-9._-]{8,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|https?:\/\/[^\s]+\/o\/oauth2|-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----)/i;

const FORBIDDEN_RUNTIME_FIELD_MARKERS = [
  'callback',
  'requester',
  'fetch',
  'socket',
  'storage',
  'executable',
  'execute',
  'liveaction',
  'sendnow',
  'postnow',
  'redirectnow',
] as const;

type ParsedScope = {
  schemaVersion: 1;
  scopeKind: 'google-mail-oauth-reviewed-scope';
  id: string;
  label: string;
  reviewed: boolean;
};

type ParsedConsent = {
  schemaVersion: 1;
  consentKind: 'google-mail-oauth-reviewed-consent';
  providerId: 'google-gmail';
  accountId: string;
  accountIntent: GoogleMailOAuthAccountIntent;
  scopeIds: readonly string[];
  granted: boolean;
  reviewed: boolean;
  issuedAt: number;
  expiresAt: number;
};

type ParsedRedirectPlan = {
  schemaVersion: 1;
  planKind: 'google-mail-oauth-reviewed-redirect-plan';
  providerId: 'google-gmail';
  accountId: string;
  accountIntent: GoogleMailOAuthAccountIntent;
  flow: 'external-browser-oauth';
  redirectOrigin: string;
  redirectPath: string;
  reviewed: boolean;
  reviewedAt: number;
  expiresAt: number;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || !SAFE_IDENTIFIER_PATTERN.test(trimmed)) return undefined;
  if (RAW_SECRET_VALUE_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function safeScopeLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || !SAFE_SCOPE_LABEL_PATTERN.test(trimmed)) return undefined;
  if (RAW_SECRET_VALUE_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function safeTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return undefined;
  if (value < 0 || value > MAX_TIMESTAMP) return undefined;
  return value;
}

function safeAccountIntent(value: unknown): GoogleMailOAuthAccountIntent | undefined {
  return typeof value === 'string' && ACCOUNT_INTENTS.has(value as GoogleMailOAuthAccountIntent)
    ? value as GoogleMailOAuthAccountIntent
    : undefined;
}

function safeProviderId(value: unknown): 'google-gmail' | undefined {
  return value === 'google-gmail' ? 'google-gmail' : undefined;
}

function normalizeFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseRedirectOrigin(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = new URL(value.trim());
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return undefined;
    if (
      parsed.protocol !== 'https:'
      && !((parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') && parsed.protocol === 'http:')
    ) {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}

function parseRedirectPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || !SAFE_CALLBACK_PATH_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function hasRawSecretMaterial(value: unknown): boolean {
  if (hasConnectorSecretMaterial(value) || hasStoredEmailSecretMaterial(value)) return true;

  const seen = new WeakSet<object>();
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === 'string') {
      if (RAW_SECRET_VALUE_PATTERN.test(current)) return true;
      continue;
    }
    if (current === null || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);

    if (current instanceof Map) {
      for (const [key, nested] of current.entries()) {
        pending.push(key, nested);
      }
      continue;
    }

    if (current instanceof Set) {
      for (const nested of current.values()) pending.push(nested);
      continue;
    }

    for (const [key, nested] of Object.entries(current)) {
      if (RAW_SECRET_VALUE_PATTERN.test(key)) return true;
      pending.push(nested);
    }
  }

  return false;
}

function hasForbiddenRuntimeField(value: unknown): boolean {
  const seen = new WeakSet<object>();
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);

    if (current instanceof Map) {
      for (const [key, nested] of current.entries()) {
        if (
          typeof key === 'string'
          && FORBIDDEN_RUNTIME_FIELD_MARKERS.some((marker) => normalizeFieldName(key).includes(marker))
        ) {
          return true;
        }
        pending.push(nested);
      }
      continue;
    }

    if (current instanceof Set) {
      for (const nested of current.values()) pending.push(nested);
      continue;
    }

    for (const [key, nested] of Object.entries(current)) {
      if (FORBIDDEN_RUNTIME_FIELD_MARKERS.some((marker) => normalizeFieldName(key).includes(marker))) return true;
      pending.push(nested);
    }
  }

  return false;
}

function parseReviewedScopes(value: unknown): ParsedScope[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const scopes: ParsedScope[] = [];
  for (const item of value) {
    if (!isPlainRecord(item) || !hasOnlyKeys(item, SCOPE_KEYS)) return undefined;
    const id = safeIdentifier(item.id);
    const label = safeScopeLabel(item.label);
    if (
      item.schemaVersion !== 1
      || item.scopeKind !== 'google-mail-oauth-reviewed-scope'
      || !id
      || !label
      || typeof item.reviewed !== 'boolean'
    ) {
      return undefined;
    }
    scopes.push({
      schemaVersion: 1,
      scopeKind: 'google-mail-oauth-reviewed-scope',
      id,
      label,
      reviewed: item.reviewed,
    });
  }
  return scopes;
}

function parseConsentEvidence(value: unknown): ParsedConsent | undefined {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, CONSENT_KEYS)) return undefined;
  const providerId = safeProviderId(value.providerId);
  const accountId = safeIdentifier(value.accountId);
  const accountIntent = safeAccountIntent(value.accountIntent);
  const issuedAt = safeTimestamp(value.issuedAt);
  const expiresAt = safeTimestamp(value.expiresAt);
  const scopeIds = Array.isArray(value.scopeIds) ? value.scopeIds.map(safeIdentifier) : undefined;

  if (
    value.schemaVersion !== 1
    || value.consentKind !== 'google-mail-oauth-reviewed-consent'
    || !providerId
    || !accountId
    || !accountIntent
    || !scopeIds
    || scopeIds.length === 0
    || scopeIds.some((scopeId) => !scopeId)
    || issuedAt === undefined
    || expiresAt === undefined
    || typeof value.granted !== 'boolean'
    || typeof value.reviewed !== 'boolean'
  ) {
    return undefined;
  }

  return {
    schemaVersion: 1,
    consentKind: 'google-mail-oauth-reviewed-consent',
    providerId,
    accountId,
    accountIntent,
    scopeIds: Object.freeze([...scopeIds] as string[]),
    granted: value.granted,
    reviewed: value.reviewed,
    issuedAt,
    expiresAt,
  };
}

function parseRedirectPlan(value: unknown): ParsedRedirectPlan | undefined {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, REDIRECT_PLAN_KEYS)) return undefined;
  const providerId = safeProviderId(value.providerId);
  const accountId = safeIdentifier(value.accountId);
  const accountIntent = safeAccountIntent(value.accountIntent);
  const redirectOrigin = parseRedirectOrigin(value.redirectOrigin);
  const redirectPath = parseRedirectPath(value.redirectPath);
  const reviewedAt = safeTimestamp(value.reviewedAt);
  const expiresAt = safeTimestamp(value.expiresAt);

  if (
    value.schemaVersion !== 1
    || value.planKind !== 'google-mail-oauth-reviewed-redirect-plan'
    || !providerId
    || !accountId
    || !accountIntent
    || value.flow !== 'external-browser-oauth'
    || !redirectOrigin
    || !redirectPath
    || reviewedAt === undefined
    || expiresAt === undefined
    || typeof value.reviewed !== 'boolean'
  ) {
    return undefined;
  }

  return {
    schemaVersion: 1,
    planKind: 'google-mail-oauth-reviewed-redirect-plan',
    providerId,
    accountId,
    accountIntent,
    flow: 'external-browser-oauth',
    redirectOrigin,
    redirectPath,
    reviewed: value.reviewed,
    reviewedAt,
    expiresAt,
  };
}

function decision(
  reason: GoogleMailOAuthReadinessReason,
  blockers: readonly GoogleMailOAuthReadinessReason[],
  extra: Partial<GoogleMailOAuthReadinessDecision> = {},
): GoogleMailOAuthReadinessDecision {
  const ready = blockers.length === 0;
  return Object.freeze({
    status: ready ? 'ready' : 'blocked',
    ready,
    reason,
    blockers: Object.freeze([...blockers]),
    readinessContract: 'google-mail-oauth-readiness-boundary-v1',
    executable: false,
    sideEffects: 'none',
    opensBrowserNow: false,
    willFetch: false,
    willOpenSocket: false,
    willMutateStorage: false,
    willStoreCredential: false,
    willCollectCredential: false,
    willCallProvider: false,
    sideEffectBoundary: SIDE_EFFECT_BOUNDARY,
    ...extra,
  });
}

export function evaluateGoogleMailOAuthReadinessBoundary(
  input: unknown,
): GoogleMailOAuthReadinessDecision {
  if (!isPlainRecord(input)) {
    return decision('invalid_root_shape', Object.freeze(['invalid_root_shape']));
  }
  if (hasRawSecretMaterial(input)) {
    return decision('raw_secret_material', Object.freeze(['raw_secret_material']));
  }
  if (hasForbiddenRuntimeField(input)) {
    return decision('forbidden_runtime_field', Object.freeze(['forbidden_runtime_field']));
  }
  if (!hasOnlyKeys(input, ROOT_KEYS)) {
    return decision('invalid_root_shape', Object.freeze(['invalid_root_shape']));
  }

  const now = input.now === undefined ? Date.now() : safeTimestamp(input.now);
  if (input.now !== undefined && now === undefined) {
    return decision('invalid_now', Object.freeze(['invalid_now']));
  }

  const providerId = safeProviderId(input.providerId);
  const accountId = safeIdentifier(input.accountId);
  const accountIntent = safeAccountIntent(input.accountIntent);
  const scopes = parseReviewedScopes(input.reviewedScopes);
  const consent = parseConsentEvidence(input.consentEvidence);
  const redirectPlan = parseRedirectPlan(input.redirectPlan);

  const blockers: GoogleMailOAuthReadinessReason[] = [];

  if (input.providerId === undefined) blockers.push('missing_provider_id');
  else if (!providerId) blockers.push('unsupported_provider_id');

  if (input.accountId === undefined) blockers.push('missing_account_id');
  else if (!accountId) blockers.push('invalid_account_id');

  if (input.accountIntent === undefined) blockers.push('missing_account_intent');
  else if (!accountIntent) blockers.push('invalid_account_intent');

  if (input.reviewedScopes === undefined) blockers.push('missing_reviewed_scopes');
  else if (!scopes) blockers.push('invalid_reviewed_scopes');

  if (input.consentEvidence === undefined) blockers.push('missing_consent_evidence');
  else if (!consent) blockers.push('invalid_consent_evidence');

  if (input.redirectPlan === undefined) blockers.push('missing_redirect_plan');
  else if (!redirectPlan) blockers.push('invalid_redirect_plan');

  if (scopes) {
    const seenScopeIds = new Set<string>();
    for (const scope of scopes) {
      if (!scope.reviewed) blockers.push('unreviewed_scope');
      if (seenScopeIds.has(scope.id)) blockers.push('duplicate_scope_id');
      seenScopeIds.add(scope.id);
    }
  }

  if (consent) {
    if (!consent.reviewed) blockers.push('consent_not_reviewed');
    if (!consent.granted) blockers.push('consent_not_granted');
    if (providerId && consent.providerId !== providerId) blockers.push('consent_provider_mismatch');
    if (accountId && consent.accountId !== accountId) blockers.push('consent_account_mismatch');
    if (accountIntent && consent.accountIntent !== accountIntent) blockers.push('consent_intent_mismatch');
    if (now !== undefined && consent.expiresAt <= now) blockers.push('consent_expired');
    if (scopes) {
      const reviewedScopeIds = new Set(scopes.map((scope) => scope.id));
      const consentScopeIds = new Set(consent.scopeIds);
      if (
        consent.scopeIds.length !== scopes.length
        || consentScopeIds.size !== reviewedScopeIds.size
        || consent.scopeIds.some((scopeId) => !reviewedScopeIds.has(scopeId))
      ) {
        blockers.push('consent_scope_mismatch');
      }
    }
  }

  if (redirectPlan) {
    if (!redirectPlan.reviewed) blockers.push('redirect_not_reviewed');
    if (providerId && redirectPlan.providerId !== providerId) blockers.push('redirect_provider_mismatch');
    if (accountId && redirectPlan.accountId !== accountId) blockers.push('redirect_account_mismatch');
    if (accountIntent && redirectPlan.accountIntent !== accountIntent) blockers.push('redirect_intent_mismatch');
    if (now !== undefined && redirectPlan.expiresAt <= now) blockers.push('redirect_expired');
  }

  if (blockers.length > 0) {
    return decision(blockers[0], blockers, {
      ...(providerId ? { providerId } : {}),
      ...(accountId && accountIntent
        ? {
            account: Object.freeze({
              id: accountId,
              intent: accountIntent,
            }),
          }
        : {}),
    });
  }

  const safeScopes = Object.freeze(scopes!.map((scope) => Object.freeze({
    id: scope.id,
    label: scope.label,
  })));

  return decision('google_mail_oauth_readiness_ready', Object.freeze([]), {
    providerId: 'google-gmail',
    account: Object.freeze({
      id: accountId!,
      intent: accountIntent!,
    }),
    reviewedScopes: safeScopes,
    consentWindow: Object.freeze({
      issuedAt: consent!.issuedAt,
      expiresAt: consent!.expiresAt,
    }),
    redirectPlan: Object.freeze({
      flow: 'external-browser-oauth' as const,
      origin: redirectPlan!.redirectOrigin,
      path: redirectPlan!.redirectPath,
      reviewedAt: redirectPlan!.reviewedAt,
      expiresAt: redirectPlan!.expiresAt,
    }),
  });
}
