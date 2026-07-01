import { hasConnectorSecretMaterial } from './connector-credential-boundary';

export type ConnectorExplicitConsentActionFamily =
  | 'email'
  | 'messaging'
  | 'local-bridge'
  | 'assistant-llm'
  | 'integration';

export type ConnectorExplicitConsentGrantState = 'pending' | 'granted' | 'revoked';
export type ConnectorExplicitConsentReviewState = 'unreviewed' | 'reviewed';

export type ConnectorExplicitConsentSideEffectClass =
  | 'metadata-only'
  | 'email-read'
  | 'email-send'
  | 'messaging-dry-run'
  | 'messaging-post'
  | 'webhook-delivery'
  | 'local-bridge-probe'
  | 'assistant-llm-call'
  | 'integration-action';

export interface ConnectorExplicitConsentOwner {
  providerId?: string;
  connectorId?: string;
  accountId?: string;
  workspaceId?: string;
  credentialReferenceId?: string;
}

export interface ConnectorExplicitConsentSideEffectAcknowledgement {
  sideEffectClass: ConnectorExplicitConsentSideEffectClass;
  acknowledged: true;
  acknowledgedAt?: number;
}

export interface ConnectorExplicitConsentGrant {
  schemaVersion: 1;
  grantId: string;
  actionId: string;
  actionFamily: ConnectorExplicitConsentActionFamily;
  actionKind: string;
  targetSurface: string;
  owner?: ConnectorExplicitConsentOwner;
  grantState: ConnectorExplicitConsentGrantState;
  reviewState: ConnectorExplicitConsentReviewState;
  issuedAt: number;
  expiresAt: number;
  notBefore?: number;
  reviewedAt?: number;
  revokedAt?: number;
  sideEffectAcknowledgement: ConnectorExplicitConsentSideEffectAcknowledgement;
}

export interface ConnectorExplicitConsentRequirement {
  actionId: string;
  actionFamily: ConnectorExplicitConsentActionFamily | string;
  actionKind: string;
  targetSurface: string;
  sideEffectClass: ConnectorExplicitConsentSideEffectClass;
  owner?: ConnectorExplicitConsentOwner;
}

export interface ConnectorExplicitConsentEvaluationInput {
  requirement: ConnectorExplicitConsentRequirement;
  grant?: unknown;
  now?: number;
  additionalUntrustedInputs?: readonly unknown[];
}

export type ConnectorExplicitConsentBlockReason =
  | 'missing_grant'
  | 'invalid_grant_shape'
  | 'unsupported_action_family'
  | 'action_mismatch'
  | 'target_surface_mismatch'
  | 'owner_mismatch'
  | 'not_reviewed'
  | 'not_granted'
  | 'revoked'
  | 'not_yet_valid'
  | 'expired'
  | 'missing_side_effect_acknowledgement'
  | 'side_effect_acknowledgement_mismatch'
  | 'secret_material_detected';

export type ConnectorExplicitConsentAllowReason = 'explicit_consent_grant_valid';

export interface ConnectorExplicitConsentDecision {
  status: 'allow' | 'block';
  allowed: boolean;
  executable: false;
  actionId: string;
  actionFamily?: ConnectorExplicitConsentActionFamily;
  actionKind: string;
  targetSurface: string;
  owner?: ConnectorExplicitConsentOwner;
  grantId?: string;
  sideEffectClass: ConnectorExplicitConsentSideEffectClass;
  allowReason?: ConnectorExplicitConsentAllowReason;
  blockReasons: readonly ConnectorExplicitConsentBlockReason[];
  sideEffectBoundary: 'pure-local-consent-decision-no-fetch-no-storage-no-socket-no-oauth-no-provider-no-webhook-no-slack-no-llm';
}

type ParsedConnectorExplicitConsentGrant = Omit<ConnectorExplicitConsentGrant, 'sideEffectAcknowledgement'> & {
  sideEffectAcknowledgement?: ConnectorExplicitConsentSideEffectAcknowledgement;
};

export const CONNECTOR_EXPLICIT_CONSENT_SIDE_EFFECT_BOUNDARY =
  'pure-local-consent-decision-no-fetch-no-storage-no-socket-no-oauth-no-provider-no-webhook-no-slack-no-llm' as const;

export const SUPPORTED_CONNECTOR_EXPLICIT_CONSENT_ACTION_FAMILIES: readonly ConnectorExplicitConsentActionFamily[] = [
  'email',
  'messaging',
  'local-bridge',
  'assistant-llm',
  'integration',
];

const SUPPORTED_ACTION_FAMILIES = new Set<ConnectorExplicitConsentActionFamily>(
  SUPPORTED_CONNECTOR_EXPLICIT_CONSENT_ACTION_FAMILIES,
);

const VALID_GRANT_STATES = new Set<ConnectorExplicitConsentGrantState>(['pending', 'granted', 'revoked']);
const VALID_REVIEW_STATES = new Set<ConnectorExplicitConsentReviewState>(['unreviewed', 'reviewed']);
const VALID_SIDE_EFFECT_CLASSES = new Set<ConnectorExplicitConsentSideEffectClass>([
  'metadata-only',
  'email-read',
  'email-send',
  'messaging-dry-run',
  'messaging-post',
  'webhook-delivery',
  'local-bridge-probe',
  'assistant-llm-call',
  'integration-action',
]);

const MAX_IDENTIFIER_LENGTH = 180;
const MAX_SURFACE_LENGTH = 120;
const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:@/+~-]+$/;
const SAFE_SURFACE_PATTERN = /^[A-Za-z0-9._:@/+~ -]+$/;
const CREDENTIAL_REFERENCE_PREFIXES = ['credref:', 'local-bridge:', 'macos-login:', 'provider-oauth:', 'vault:'] as const;
const URL_OR_SCHEME_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const OWNER_KEYS = new Set([
  'accountId',
  'connectorId',
  'credentialReferenceId',
  'providerId',
  'workspaceId',
]);
const SIDE_EFFECT_ACKNOWLEDGEMENT_KEYS = new Set([
  'acknowledged',
  'acknowledgedAt',
  'sideEffectClass',
]);
const GRANT_KEYS = new Set([
  'actionFamily',
  'actionId',
  'actionKind',
  'expiresAt',
  'grantId',
  'grantState',
  'issuedAt',
  'notBefore',
  'owner',
  'reviewState',
  'reviewedAt',
  'revokedAt',
  'schemaVersion',
  'sideEffectAcknowledgement',
  'targetSurface',
]);

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
  if (!trimmed || trimmed.length > MAX_IDENTIFIER_LENGTH) return undefined;
  if (!SAFE_IDENTIFIER_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function identifierLooksUrlOrSchemeShaped(value: string): boolean {
  return URL_OR_SCHEME_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function safeGenericOwnerIdentifier(value: unknown): string | undefined {
  const identifier = safeIdentifier(value);
  if (!identifier || identifierLooksUrlOrSchemeShaped(identifier)) return undefined;
  return identifier;
}

function safeCredentialReferenceIdentifier(value: unknown): string | undefined {
  const identifier = safeIdentifier(value);
  if (!identifier) return undefined;
  if (
    identifierLooksUrlOrSchemeShaped(identifier)
    && !CREDENTIAL_REFERENCE_PREFIXES.some((prefix) => identifier.startsWith(prefix))
  ) {
    return undefined;
  }
  return identifier;
}

function safeSurface(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_SURFACE_LENGTH) return undefined;
  if (!SAFE_SURFACE_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function safeTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return undefined;
  if (value < 0 || value > MAX_DATE_TIMESTAMP) return undefined;
  return value;
}

function optionalTimestamp(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  return safeTimestamp(value);
}

function isActionFamily(value: unknown): value is ConnectorExplicitConsentActionFamily {
  return typeof value === 'string' && SUPPORTED_ACTION_FAMILIES.has(value as ConnectorExplicitConsentActionFamily);
}

function isSideEffectClass(value: unknown): value is ConnectorExplicitConsentSideEffectClass {
  return typeof value === 'string' && VALID_SIDE_EFFECT_CLASSES.has(value as ConnectorExplicitConsentSideEffectClass);
}

function parseOwner(value: unknown): ConnectorExplicitConsentOwner | undefined {
  if (value === undefined) return undefined;
  if (!isPlainRecord(value)) return undefined;
  if (!hasOnlyKeys(value, OWNER_KEYS)) return undefined;

  const owner: ConnectorExplicitConsentOwner = {};
  const providerId = safeGenericOwnerIdentifier(value.providerId);
  const connectorId = safeGenericOwnerIdentifier(value.connectorId);
  const accountId = safeGenericOwnerIdentifier(value.accountId);
  const workspaceId = safeGenericOwnerIdentifier(value.workspaceId);
  const credentialReferenceId = safeCredentialReferenceIdentifier(value.credentialReferenceId);

  if (value.providerId !== undefined && !providerId) return undefined;
  if (value.connectorId !== undefined && !connectorId) return undefined;
  if (value.accountId !== undefined && !accountId) return undefined;
  if (value.workspaceId !== undefined && !workspaceId) return undefined;
  if (value.credentialReferenceId !== undefined && !credentialReferenceId) return undefined;

  if (providerId) owner.providerId = providerId;
  if (connectorId) owner.connectorId = connectorId;
  if (accountId) owner.accountId = accountId;
  if (workspaceId) owner.workspaceId = workspaceId;
  if (credentialReferenceId) owner.credentialReferenceId = credentialReferenceId;

  return owner;
}

function parseSideEffectAcknowledgement(
  value: unknown,
): ConnectorExplicitConsentSideEffectAcknowledgement | undefined {
  if (!isPlainRecord(value)) return undefined;
  if (!hasOnlyKeys(value, SIDE_EFFECT_ACKNOWLEDGEMENT_KEYS)) return undefined;
  const sideEffectClass = value.sideEffectClass;
  if (!isSideEffectClass(sideEffectClass)) return undefined;
  const acknowledgedAt = optionalTimestamp(value.acknowledgedAt);
  if (value.acknowledgedAt !== undefined && acknowledgedAt === undefined) return undefined;
  if (value.acknowledged !== true) return undefined;

  return {
    sideEffectClass,
    acknowledged: true,
    ...(acknowledgedAt !== undefined ? { acknowledgedAt } : {}),
  };
}

function parseGrant(value: unknown): ParsedConnectorExplicitConsentGrant | undefined {
  if (!isPlainRecord(value)) return undefined;
  if (!hasOnlyKeys(value, GRANT_KEYS)) return undefined;
  if (value.schemaVersion !== 1) return undefined;

  const grantId = safeIdentifier(value.grantId);
  const actionId = safeIdentifier(value.actionId);
  const actionFamily = value.actionFamily;
  const actionKind = safeIdentifier(value.actionKind);
  const targetSurface = safeSurface(value.targetSurface);
  const owner = parseOwner(value.owner);
  const issuedAt = safeTimestamp(value.issuedAt);
  const expiresAt = safeTimestamp(value.expiresAt);
  const notBefore = optionalTimestamp(value.notBefore);
  const reviewedAt = optionalTimestamp(value.reviewedAt);
  const revokedAt = optionalTimestamp(value.revokedAt);
  const sideEffectAcknowledgement = parseSideEffectAcknowledgement(value.sideEffectAcknowledgement);

  if (!grantId || !actionId || !isActionFamily(actionFamily) || !actionKind || !targetSurface) return undefined;
  if (value.owner !== undefined && !owner) return undefined;
  if (value.sideEffectAcknowledgement !== undefined && !sideEffectAcknowledgement) return undefined;
  if (!VALID_GRANT_STATES.has(value.grantState as ConnectorExplicitConsentGrantState)) return undefined;
  if (!VALID_REVIEW_STATES.has(value.reviewState as ConnectorExplicitConsentReviewState)) return undefined;
  if (issuedAt === undefined || expiresAt === undefined) return undefined;
  if (value.notBefore !== undefined && notBefore === undefined) return undefined;
  if (value.reviewedAt !== undefined && reviewedAt === undefined) return undefined;
  if (value.revokedAt !== undefined && revokedAt === undefined) return undefined;

  return {
    schemaVersion: 1,
    grantId,
    actionId,
    actionFamily,
    actionKind,
    targetSurface,
    ...(owner ? { owner } : {}),
    grantState: value.grantState as ConnectorExplicitConsentGrantState,
    reviewState: value.reviewState as ConnectorExplicitConsentReviewState,
    issuedAt,
    expiresAt,
    ...(notBefore !== undefined ? { notBefore } : {}),
    ...(reviewedAt !== undefined ? { reviewedAt } : {}),
    ...(revokedAt !== undefined ? { revokedAt } : {}),
    ...(sideEffectAcknowledgement ? { sideEffectAcknowledgement } : {}),
  };
}

function ownerMismatch(
  expected: ConnectorExplicitConsentOwner | undefined,
  actual: ConnectorExplicitConsentOwner | undefined,
): boolean {
  if (!expected) return false;
  for (const key of ['providerId', 'connectorId', 'accountId', 'workspaceId', 'credentialReferenceId'] as const) {
    if (expected[key] !== undefined && expected[key] !== actual?.[key]) return true;
  }
  return false;
}

function baseDecision(
  input: ConnectorExplicitConsentEvaluationInput,
  blockReasons: readonly ConnectorExplicitConsentBlockReason[],
  grant?: ParsedConnectorExplicitConsentGrant,
  options: { redactRequirement?: boolean } = {},
): ConnectorExplicitConsentDecision {
  const uniqueBlockReasons = Object.freeze([...new Set(blockReasons)]);
  const status: ConnectorExplicitConsentDecision['status'] = uniqueBlockReasons.length === 0 ? 'allow' : 'block';
  const owner = options.redactRequirement ? undefined : grant?.owner ?? input.requirement.owner;
  const decision: ConnectorExplicitConsentDecision = {
    status,
    allowed: status === 'allow',
    executable: false,
    actionId: options.redactRequirement ? '[redacted]' : input.requirement.actionId,
    actionFamily: options.redactRequirement || !isActionFamily(input.requirement.actionFamily)
      ? undefined
      : input.requirement.actionFamily,
    actionKind: options.redactRequirement ? '[redacted]' : input.requirement.actionKind,
    targetSurface: options.redactRequirement ? '[redacted]' : input.requirement.targetSurface,
    ...(owner ? { owner: Object.freeze({ ...owner }) } : {}),
    grantId: status === 'allow' ? grant?.grantId : undefined,
    sideEffectClass: options.redactRequirement ? 'metadata-only' : input.requirement.sideEffectClass,
    allowReason: status === 'allow' ? 'explicit_consent_grant_valid' : undefined,
    blockReasons: uniqueBlockReasons,
    sideEffectBoundary: CONNECTOR_EXPLICIT_CONSENT_SIDE_EFFECT_BOUNDARY,
  };

  return Object.freeze(decision);
}

export function evaluateConnectorExplicitConsent(
  input: ConnectorExplicitConsentEvaluationInput,
): ConnectorExplicitConsentDecision {
  const blockReasons: ConnectorExplicitConsentBlockReason[] = [];
  const requirementHasSecretMaterial = hasConnectorSecretMaterial(input.requirement);

  if (
    requirementHasSecretMaterial
    || hasConnectorSecretMaterial(input.grant)
    || hasConnectorSecretMaterial(input.additionalUntrustedInputs)
  ) {
    return baseDecision(input, ['secret_material_detected'], undefined, {
      redactRequirement: requirementHasSecretMaterial,
    });
  }

  if (!isActionFamily(input.requirement.actionFamily)) {
    blockReasons.push('unsupported_action_family');
  }

  if (input.grant === undefined || input.grant === null) {
    blockReasons.push('missing_grant');
    return baseDecision(input, blockReasons);
  }

  const grant = parseGrant(input.grant);
  if (!grant) {
    blockReasons.push('invalid_grant_shape');
    return baseDecision(input, blockReasons);
  }

  if (!isActionFamily(grant.actionFamily)) {
    blockReasons.push('unsupported_action_family');
  }

  if (
    grant.actionId !== input.requirement.actionId
    || grant.actionKind !== input.requirement.actionKind
    || grant.actionFamily !== input.requirement.actionFamily
  ) {
    blockReasons.push('action_mismatch');
  }

  if (grant.targetSurface !== input.requirement.targetSurface) {
    blockReasons.push('target_surface_mismatch');
  }

  if (ownerMismatch(input.requirement.owner, grant.owner)) {
    blockReasons.push('owner_mismatch');
  }

  if (grant.reviewState !== 'reviewed') {
    blockReasons.push('not_reviewed');
  }

  if (grant.grantState === 'revoked' || grant.revokedAt !== undefined) {
    blockReasons.push('revoked');
  } else if (grant.grantState !== 'granted') {
    blockReasons.push('not_granted');
  }

  const now = input.now ?? Date.now();
  if (grant.issuedAt > now || (grant.notBefore !== undefined && grant.notBefore > now)) {
    blockReasons.push('not_yet_valid');
  }
  if (grant.expiresAt <= now) {
    blockReasons.push('expired');
  }

  if (!grant.sideEffectAcknowledgement || grant.sideEffectAcknowledgement.acknowledged !== true) {
    blockReasons.push('missing_side_effect_acknowledgement');
  } else if (grant.sideEffectAcknowledgement.sideEffectClass !== input.requirement.sideEffectClass) {
    blockReasons.push('side_effect_acknowledgement_mismatch');
  }

  return baseDecision(input, blockReasons, grant);
}
