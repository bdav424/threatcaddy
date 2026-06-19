import { hasConnectorSecretMaterial } from './connector-credential-boundary';

export type OAuthSsoRedirectHandshakeMode = 'oauth' | 'sso';
export type OAuthSsoRedirectHandshakeSurface = 'assistantcaddy' | 'emailcaddy' | 'calendarcaddy';
export type OAuthSsoPkceChallengeMethod = 'S256';

export type OAuthSsoRedirectHandshakeStatus = 'ready' | 'blocked';

export type OAuthSsoRedirectHandshakeReason =
  | 'oauth_sso_redirect_handshake_ready'
  | 'raw_secret_material'
  | 'forbidden_live_metadata'
  | 'invalid_mode'
  | 'invalid_surface'
  | 'invalid_provider_id'
  | 'invalid_account_id'
  | 'redirect_metadata_missing'
  | 'redirect_metadata_invalid'
  | 'redirect_metadata_mismatch'
  | 'redirect_metadata_not_reviewed'
  | 'redirect_metadata_stale'
  | 'handshake_metadata_missing'
  | 'handshake_metadata_invalid'
  | 'handshake_metadata_mismatch'
  | 'handshake_metadata_not_reviewed'
  | 'handshake_metadata_stale'
  | 'handshake_metadata_boundary_invalid'
  | 'label_metadata_missing'
  | 'label_metadata_invalid'
  | 'label_metadata_not_reviewed'
  | 'provider_agnostic_copy_required';

export interface OAuthSsoRedirectOriginMetadata {
  schemaVersion: 1;
  metadataKind: 'oauth-sso-redirect-origin-metadata';
  mode: OAuthSsoRedirectHandshakeMode;
  surface: OAuthSsoRedirectHandshakeSurface;
  providerId: string;
  accountId?: string;
  redirectOrigin: string;
  redirectPath: string;
  reviewed: true;
  reviewedAt: number;
  expiresAt: number;
}

export interface OAuthSsoHandshakeMetadata {
  schemaVersion: 1;
  metadataKind: 'oauth-sso-handshake-metadata';
  mode: OAuthSsoRedirectHandshakeMode;
  surface: OAuthSsoRedirectHandshakeSurface;
  providerId: string;
  accountId?: string;
  stateHandleId: string;
  nonceHandleId: string;
  pkceHandleId: string;
  pkceChallengeMethod: OAuthSsoPkceChallengeMethod;
  reviewed: true;
  reviewedAt: number;
  expiresAt: number;
  noRawStateValue: true;
  noRawNonceValue: true;
  noRawPkceVerifier: true;
}

export interface OAuthSsoGenericLabelMetadata {
  schemaVersion: 1;
  metadataKind: 'oauth-sso-generic-label-metadata';
  primaryLabel: string;
  secondaryLabel?: string;
  reviewed: true;
}

export interface OAuthSsoRedirectHandshakeBoundaryInput {
  mode?: OAuthSsoRedirectHandshakeMode | string;
  surface?: OAuthSsoRedirectHandshakeSurface | string;
  providerId?: string;
  accountId?: string;
  redirectMetadata?: unknown;
  handshakeMetadata?: unknown;
  labelMetadata?: unknown;
  now?: number;
}

export interface OAuthSsoRedirectHandshakeDecision {
  status: OAuthSsoRedirectHandshakeStatus;
  ready: boolean;
  reason: OAuthSsoRedirectHandshakeReason;
  blockReasons: readonly OAuthSsoRedirectHandshakeReason[];
  contract: 'oauth-sso-redirect-handshake-boundary-v1';
  mode?: OAuthSsoRedirectHandshakeMode;
  surface?: OAuthSsoRedirectHandshakeSurface;
  providerId?: string;
  accountId?: string;
  redirect?: {
    origin: string;
    path: string;
  };
  handshake?: {
    stateHandleId: string;
    nonceHandleId: string;
    pkceHandleId: string;
    pkceChallengeMethod: OAuthSsoPkceChallengeMethod;
  };
  labels?: {
    primaryLabel: string;
    secondaryLabel?: string;
  };
  executable: false;
  sideEffects: 'none';
  opensWindow: false;
  mayRedirect: false;
  sideEffectBoundary: 'plan-only-no-fetch-no-socket-no-storage-no-oauth-no-window-no-credential-collection';
}

const SIDE_EFFECT_BOUNDARY =
  'plan-only-no-fetch-no-socket-no-storage-no-oauth-no-window-no-credential-collection' as const;

const ROOT_KEYS = new Set([
  'mode',
  'surface',
  'providerId',
  'accountId',
  'redirectMetadata',
  'handshakeMetadata',
  'labelMetadata',
  'now',
]);

const REDIRECT_KEYS = new Set([
  'schemaVersion',
  'metadataKind',
  'mode',
  'surface',
  'providerId',
  'accountId',
  'redirectOrigin',
  'redirectPath',
  'reviewed',
  'reviewedAt',
  'expiresAt',
]);

const HANDSHAKE_KEYS = new Set([
  'schemaVersion',
  'metadataKind',
  'mode',
  'surface',
  'providerId',
  'accountId',
  'stateHandleId',
  'nonceHandleId',
  'pkceHandleId',
  'pkceChallengeMethod',
  'reviewed',
  'reviewedAt',
  'expiresAt',
  'noRawStateValue',
  'noRawNonceValue',
  'noRawPkceVerifier',
]);

const LABEL_KEYS = new Set([
  'schemaVersion',
  'metadataKind',
  'primaryLabel',
  'secondaryLabel',
  'reviewed',
]);

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const SAFE_PATH_PATTERN = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]{1,239}$/;
const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000;
const SECRET_TEXT_PATTERN =
  /(?:access[_-]?token|refresh[_-]?token|id[_-]?token|auth(?:orization)?[_-]?code|client[_-]?secret|password|bearer\s+[a-z0-9._~+/=-]{8,}|-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----|(?:api|app|bot|client|refresh|access|session)[_-]?(?:key|token|secret)\s*[:=]\s*\S+)/i;
const FORBIDDEN_LIVE_KEY_PATTERN =
  /(?:callback|requester|fetch|socket|storage|executable|execute|transport|openwindow|liveaction|redirecturl|actionurl)/i;
const BRANDED_COPY_PATTERN = /\b(?:VENDOR|External Backup|slack)\b/i;
const ALLOWED_PRIMARY_LABELS = new Set([
  'Single sign-on',
  'Continue to sign-in',
  'Sign in',
]);
const ALLOWED_SECONDARY_LABELS = new Set([
  'Continue in your browser',
  'Use your identity provider',
  'Provider sign-in continues outside ThreatCaddy',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
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
  if (!trimmed || !SAFE_ID_PATTERN.test(trimmed) || SECRET_TEXT_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function normalizeMode(value: unknown): OAuthSsoRedirectHandshakeMode | undefined {
  return value === 'oauth' || value === 'sso' ? value : undefined;
}

function normalizeSurface(value: unknown): OAuthSsoRedirectHandshakeSurface | undefined {
  return value === 'assistantcaddy' || value === 'emailcaddy' || value === 'calendarcaddy'
    ? value
    : undefined;
}

function safeTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return undefined;
  if (value < 0 || value > MAX_DATE_TIMESTAMP) return undefined;
  return value;
}

function safeRedirectOrigin(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = new URL(value.trim());
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return undefined;
    const isLocal = parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
    const isHttps = parsed.protocol === 'https:';
    if (!isLocal && !isHttps) return undefined;
    if (SECRET_TEXT_PATTERN.test(parsed.origin)) return undefined;
    return parsed.origin;
  } catch {
    return undefined;
  }
}

function safeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || !SAFE_PATH_PATTERN.test(trimmed) || SECRET_TEXT_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function containsSecretText(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return SECRET_TEXT_PATTERN.test(value);
  if (value === null || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => containsSecretText(entry, seen));
  if (value instanceof Map) {
    for (const [key, entry] of value.entries()) {
      if (containsSecretText(key, seen) || containsSecretText(entry, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const entry of value.values()) {
      if (containsSecretText(entry, seen)) return true;
    }
    return false;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_TEXT_PATTERN.test(key) || containsSecretText(entry, seen)) return true;
  }
  return false;
}

function hasForbiddenLiveMetadata(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (value === null || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => hasForbiddenLiveMetadata(entry, seen));
  if (value instanceof Map) {
    for (const [key, entry] of value.entries()) {
      if (typeof key === 'string' && FORBIDDEN_LIVE_KEY_PATTERN.test(key)) return true;
      if (hasForbiddenLiveMetadata(entry, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const entry of value.values()) {
      if (hasForbiddenLiveMetadata(entry, seen)) return true;
    }
    return false;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_LIVE_KEY_PATTERN.test(key)) return true;
    if (hasForbiddenLiveMetadata(entry, seen)) return true;
  }
  return false;
}

function parseRedirectMetadata(value: unknown): OAuthSsoRedirectOriginMetadata | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, REDIRECT_KEYS)) return undefined;
  const mode = normalizeMode(value.mode);
  const surface = normalizeSurface(value.surface);
  const providerId = safeIdentifier(value.providerId);
  const accountId = safeIdentifier(value.accountId);
  const redirectOrigin = safeRedirectOrigin(value.redirectOrigin);
  const redirectPath = safeRedirectPath(value.redirectPath);
  const reviewedAt = safeTimestamp(value.reviewedAt);
  const expiresAt = safeTimestamp(value.expiresAt);

  if (
    value.schemaVersion !== 1
    || value.metadataKind !== 'oauth-sso-redirect-origin-metadata'
    || !mode
    || !surface
    || !providerId
    || !redirectOrigin
    || !redirectPath
    || value.reviewed !== true
    || reviewedAt === undefined
    || expiresAt === undefined
  ) {
    return undefined;
  }
  if (value.accountId !== undefined && !accountId) return undefined;

  return Object.freeze({
    schemaVersion: 1,
    metadataKind: 'oauth-sso-redirect-origin-metadata',
    mode,
    surface,
    providerId,
    ...(accountId ? { accountId } : {}),
    redirectOrigin,
    redirectPath,
    reviewed: true,
    reviewedAt,
    expiresAt,
  });
}

function parseHandshakeMetadata(value: unknown): OAuthSsoHandshakeMetadata | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, HANDSHAKE_KEYS)) return undefined;
  const mode = normalizeMode(value.mode);
  const surface = normalizeSurface(value.surface);
  const providerId = safeIdentifier(value.providerId);
  const accountId = safeIdentifier(value.accountId);
  const stateHandleId = safeIdentifier(value.stateHandleId);
  const nonceHandleId = safeIdentifier(value.nonceHandleId);
  const pkceHandleId = safeIdentifier(value.pkceHandleId);
  const reviewedAt = safeTimestamp(value.reviewedAt);
  const expiresAt = safeTimestamp(value.expiresAt);

  if (
    value.schemaVersion !== 1
    || value.metadataKind !== 'oauth-sso-handshake-metadata'
    || !mode
    || !surface
    || !providerId
    || !stateHandleId
    || !nonceHandleId
    || !pkceHandleId
    || value.pkceChallengeMethod !== 'S256'
    || value.reviewed !== true
    || reviewedAt === undefined
    || expiresAt === undefined
  ) {
    return undefined;
  }
  if (value.accountId !== undefined && !accountId) return undefined;

  return Object.freeze({
    schemaVersion: 1,
    metadataKind: 'oauth-sso-handshake-metadata',
    mode,
    surface,
    providerId,
    ...(accountId ? { accountId } : {}),
    stateHandleId,
    nonceHandleId,
    pkceHandleId,
    pkceChallengeMethod: 'S256',
    reviewed: true,
    reviewedAt,
    expiresAt,
    noRawStateValue: value.noRawStateValue,
    noRawNonceValue: value.noRawNonceValue,
    noRawPkceVerifier: value.noRawPkceVerifier,
  } as OAuthSsoHandshakeMetadata);
}

function parseLabelMetadata(
  value: unknown,
): { metadata?: OAuthSsoGenericLabelMetadata; reason?: OAuthSsoRedirectHandshakeReason } {
  if (!isRecord(value) || !hasOnlyKeys(value, LABEL_KEYS)) {
    return { reason: 'label_metadata_invalid' };
  }
  const primaryLabel = typeof value.primaryLabel === 'string' ? value.primaryLabel.trim() : '';
  const secondaryLabel = typeof value.secondaryLabel === 'string' ? value.secondaryLabel.trim() : undefined;

  if (
    value.schemaVersion !== 1
    || value.metadataKind !== 'oauth-sso-generic-label-metadata'
    || !primaryLabel
  ) {
    return { reason: 'label_metadata_invalid' };
  }
  if (value.reviewed !== true) {
    return { reason: 'label_metadata_not_reviewed' };
  }
  if (
    BRANDED_COPY_PATTERN.test(primaryLabel)
    || (secondaryLabel ? BRANDED_COPY_PATTERN.test(secondaryLabel) : false)
  ) {
    return { reason: 'provider_agnostic_copy_required' };
  }
  if (!ALLOWED_PRIMARY_LABELS.has(primaryLabel)) {
    return { reason: 'provider_agnostic_copy_required' };
  }
  if (secondaryLabel !== undefined && !ALLOWED_SECONDARY_LABELS.has(secondaryLabel)) {
    return { reason: 'provider_agnostic_copy_required' };
  }

  return {
    metadata: Object.freeze({
      schemaVersion: 1,
      metadataKind: 'oauth-sso-generic-label-metadata',
      primaryLabel,
      ...(secondaryLabel ? { secondaryLabel } : {}),
      reviewed: true,
    }),
  };
}

function handshakeBoundaryIsMetadataOnly(metadata: OAuthSsoHandshakeMetadata): boolean {
  return metadata.noRawStateValue === true
    && metadata.noRawNonceValue === true
    && metadata.noRawPkceVerifier === true
    && metadata.pkceChallengeMethod === 'S256';
}

function metadataMatchesOwner(
  mode: OAuthSsoRedirectHandshakeMode,
  surface: OAuthSsoRedirectHandshakeSurface,
  providerId: string,
  accountId: string | undefined,
  redirectMetadata: OAuthSsoRedirectOriginMetadata,
  handshakeMetadata: OAuthSsoHandshakeMetadata,
): boolean {
  return redirectMetadata.mode === mode
    && handshakeMetadata.mode === mode
    && redirectMetadata.surface === surface
    && handshakeMetadata.surface === surface
    && redirectMetadata.providerId === providerId
    && handshakeMetadata.providerId === providerId
    && (accountId === undefined || redirectMetadata.accountId === accountId)
    && (accountId === undefined || handshakeMetadata.accountId === accountId);
}

function buildDecision(
  reason: OAuthSsoRedirectHandshakeReason,
  mode?: OAuthSsoRedirectHandshakeMode,
  surface?: OAuthSsoRedirectHandshakeSurface,
  providerId?: string,
  accountId?: string,
  redirectMetadata?: OAuthSsoRedirectOriginMetadata,
  handshakeMetadata?: OAuthSsoHandshakeMetadata,
  labelMetadata?: OAuthSsoGenericLabelMetadata,
): Readonly<OAuthSsoRedirectHandshakeDecision> {
  const ready = reason === 'oauth_sso_redirect_handshake_ready';
  return Object.freeze({
    status: ready ? 'ready' : 'blocked',
    ready,
    reason,
    blockReasons: Object.freeze(ready ? [] : [reason]),
    contract: 'oauth-sso-redirect-handshake-boundary-v1',
    mode,
    surface,
    providerId,
    ...(accountId ? { accountId } : {}),
    redirect: redirectMetadata
      ? Object.freeze({
          origin: redirectMetadata.redirectOrigin,
          path: redirectMetadata.redirectPath,
        })
      : undefined,
    handshake: handshakeMetadata
      ? Object.freeze({
          stateHandleId: handshakeMetadata.stateHandleId,
          nonceHandleId: handshakeMetadata.nonceHandleId,
          pkceHandleId: handshakeMetadata.pkceHandleId,
          pkceChallengeMethod: 'S256',
        })
      : undefined,
    labels: labelMetadata
      ? Object.freeze({
          primaryLabel: labelMetadata.primaryLabel,
          ...(labelMetadata.secondaryLabel ? { secondaryLabel: labelMetadata.secondaryLabel } : {}),
        })
      : undefined,
    executable: false,
    sideEffects: 'none',
    opensWindow: false,
    mayRedirect: false,
    sideEffectBoundary: SIDE_EFFECT_BOUNDARY,
  });
}

export function evaluateOauthSsoRedirectHandshakeBoundary(
  input: OAuthSsoRedirectHandshakeBoundaryInput = {},
): Readonly<OAuthSsoRedirectHandshakeDecision> {
  if (!isRecord(input) || !hasOnlyKeys(input, ROOT_KEYS)) {
    return buildDecision('forbidden_live_metadata');
  }
  if (hasConnectorSecretMaterial(input) || containsSecretText(input)) {
    return buildDecision('raw_secret_material');
  }
  if (hasForbiddenLiveMetadata(input)) {
    return buildDecision('forbidden_live_metadata');
  }

  const mode = normalizeMode(input.mode);
  if (!mode) return buildDecision('invalid_mode');

  const surface = normalizeSurface(input.surface);
  if (!surface) return buildDecision('invalid_surface', mode);

  const providerId = safeIdentifier(input.providerId);
  if (!providerId) return buildDecision('invalid_provider_id', mode, surface);

  const accountId = input.accountId === undefined ? undefined : safeIdentifier(input.accountId);
  if (input.accountId !== undefined && !accountId) {
    return buildDecision('invalid_account_id', mode, surface, providerId);
  }

  if (!input.redirectMetadata) {
    return buildDecision('redirect_metadata_missing', mode, surface, providerId, accountId);
  }
  const redirectMetadata = parseRedirectMetadata(input.redirectMetadata);
  if (!redirectMetadata) {
    return buildDecision('redirect_metadata_invalid', mode, surface, providerId, accountId);
  }
  if (redirectMetadata.reviewed !== true) {
    return buildDecision('redirect_metadata_not_reviewed', mode, surface, providerId, accountId, redirectMetadata);
  }

  if (!input.handshakeMetadata) {
    return buildDecision('handshake_metadata_missing', mode, surface, providerId, accountId, redirectMetadata);
  }
  const handshakeMetadata = parseHandshakeMetadata(input.handshakeMetadata);
  if (!handshakeMetadata) {
    return buildDecision('handshake_metadata_invalid', mode, surface, providerId, accountId, redirectMetadata);
  }
  if (handshakeMetadata.reviewed !== true) {
    return buildDecision(
      'handshake_metadata_not_reviewed',
      mode,
      surface,
      providerId,
      accountId,
      redirectMetadata,
      handshakeMetadata,
    );
  }
  if (!handshakeBoundaryIsMetadataOnly(handshakeMetadata)) {
    return buildDecision(
      'handshake_metadata_boundary_invalid',
      mode,
      surface,
      providerId,
      accountId,
      redirectMetadata,
      handshakeMetadata,
    );
  }

  if (!input.labelMetadata) {
    return buildDecision(
      'label_metadata_missing',
      mode,
      surface,
      providerId,
      accountId,
      redirectMetadata,
      handshakeMetadata,
    );
  }
  const labelParse = parseLabelMetadata(input.labelMetadata);
  if (labelParse.reason) {
    return buildDecision(
      labelParse.reason,
      mode,
      surface,
      providerId,
      accountId,
      redirectMetadata,
      handshakeMetadata,
    );
  }
  const labelMetadata = labelParse.metadata!;

  if (!metadataMatchesOwner(mode, surface, providerId, accountId, redirectMetadata, handshakeMetadata)) {
    const mismatchReason = redirectMetadata.mode !== mode
      || redirectMetadata.surface !== surface
      || redirectMetadata.providerId !== providerId
      || (accountId !== undefined && redirectMetadata.accountId !== accountId)
      ? 'redirect_metadata_mismatch'
      : 'handshake_metadata_mismatch';
    return buildDecision(
      mismatchReason,
      mode,
      surface,
      providerId,
      accountId,
      redirectMetadata,
      handshakeMetadata,
      labelMetadata,
    );
  }

  const now = typeof input.now === 'number' ? input.now : Date.now();
  if (redirectMetadata.expiresAt <= now) {
    return buildDecision(
      'redirect_metadata_stale',
      mode,
      surface,
      providerId,
      accountId,
      redirectMetadata,
      handshakeMetadata,
      labelMetadata,
    );
  }
  if (handshakeMetadata.expiresAt <= now) {
    return buildDecision(
      'handshake_metadata_stale',
      mode,
      surface,
      providerId,
      accountId,
      redirectMetadata,
      handshakeMetadata,
      labelMetadata,
    );
  }

  return buildDecision(
    'oauth_sso_redirect_handshake_ready',
    mode,
    surface,
    providerId,
    accountId,
    redirectMetadata,
    handshakeMetadata,
    labelMetadata,
  );
}
