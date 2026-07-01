import {
  hasConnectorSecretMaterial,
  type ConnectorCredentialReference,
} from './connector-credential-boundary';
import {
  planConnectorCredentialStoreHandleReference,
  type ConnectorCredentialStoreCapability,
  type ConnectorCredentialStorePlannerBlocker,
  type ConnectorCredentialStorePlannerBlockerCode,
} from './connector-credential-store';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from './runtime-trusted-contract-object';

export type ConnectorRuntimeCredentialSessionStatus = 'blocked' | 'session-ready';

export type ConnectorRuntimeCredentialSessionOwnerReviewState =
  | 'reviewed'
  | 'draft'
  | 'unreviewed'
  | 'stale'
  | 'revoked'
  | 'expired';

export interface ConnectorRuntimeCredentialSessionOwnerFact {
  ownerKind: 'runtime-action-owner';
  ownerId?: string;
  runId?: string;
  reviewState: ConnectorRuntimeCredentialSessionOwnerReviewState;
  actionFamily: string;
  actionId: string;
  targetSurface: string;
  providerId: string;
  connectorId: string;
  accountId?: string;
  issuedAt?: number;
  reviewedAt?: number;
  expiresAt?: number;
  revokedAt?: number;
  stale?: boolean;
}

export interface ConnectorRuntimeCredentialSessionRequest {
  store?: ConnectorCredentialStoreCapability | null;
  handle?: unknown;
  actionFamily?: string;
  actionId?: string;
  targetSurface?: string;
  providerId?: string;
  connectorId?: string;
  accountId?: string;
  runtimeOwner?: ConnectorRuntimeCredentialSessionOwnerFact | null;
  now?: number;
}

export type ConnectorRuntimeCredentialSessionBlockerCode =
  | ConnectorCredentialStorePlannerBlockerCode
  | 'raw_secret_material'
  | 'action_family_missing'
  | 'action_id_missing'
  | 'target_surface_missing'
  | 'provider_missing'
  | 'connector_missing'
  | 'runtime_owner_missing'
  | 'runtime_owner_invalid'
  | 'runtime_owner_not_reviewed'
  | 'runtime_owner_stale'
  | 'runtime_owner_revoked'
  | 'runtime_owner_expired'
  | 'runtime_owner_secret_material'
  | 'runtime_owner_identifier_invalid'
  | 'runtime_owner_missing_explicit_id'
  | 'runtime_owner_provider_mismatch'
  | 'runtime_owner_connector_mismatch'
  | 'runtime_owner_account_mismatch'
  | 'runtime_owner_action_mismatch'
  | 'runtime_owner_target_mismatch'
  | 'runtime_input_untrusted'
  | 'runtime_shape_forbidden';

export interface ConnectorRuntimeCredentialSessionBlocker {
  code: ConnectorRuntimeCredentialSessionBlockerCode;
  detail: string;
  field?: string;
  credentialStoreBlocker?: ConnectorCredentialStorePlannerBlocker;
}

export interface ConnectorRuntimeCredentialSessionDescriptor {
  schemaVersion: 1;
  sessionKind: 'runtime-credential-handle-session';
  credentialHandle: ConnectorCredentialReference;
  runtimeOwner: {
    ownerKind: 'runtime-action-owner';
    ownerId?: string;
    runId?: string;
    reviewState: 'reviewed';
    issuedAt?: number;
    reviewedAt?: number;
    expiresAt?: number;
  };
  action: {
    actionFamily: string;
    actionId: string;
    targetSurface: string;
  };
  providerId: string;
  connectorId: string;
  accountId?: string;
  executable: false;
  sideEffects: 'none';
  storageDirective: 'do-not-store-or-resolve-secret-material';
}

export interface ConnectorRuntimeCredentialSessionDecision {
  status: ConnectorRuntimeCredentialSessionStatus;
  mayUseCredentialHandle: boolean;
  mayResolveCredentialSecret: false;
  mayStoreCredentialSecret: false;
  descriptor?: ConnectorRuntimeCredentialSessionDescriptor;
  sideEffectBoundary: 'plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-api-no-secret-resolution';
  blockers: readonly ConnectorRuntimeCredentialSessionBlocker[];
}

const MAX_OWNER_IDENTIFIER_LENGTH = 180;
const OWNER_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:@/+~-]+$/;
const URL_LIKE_RUNTIME_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const INPUT_KEYS = new Set([
  'accountId',
  'actionFamily',
  'actionId',
  'connectorId',
  'handle',
  'now',
  'providerId',
  'runtimeOwner',
  'store',
  'targetSurface',
]);
const RUNTIME_OWNER_KEYS = new Set([
  'accountId',
  'actionFamily',
  'actionId',
  'connectorId',
  'expiresAt',
  'issuedAt',
  'ownerId',
  'ownerKind',
  'providerId',
  'reviewState',
  'reviewedAt',
  'revokedAt',
  'runId',
  'stale',
  'targetSurface',
]);
const FORBIDDEN_RUNTIME_FIELD_MARKERS = [
  'callback',
  'client',
  'executable',
  'fetch',
  'indexeddb',
  'keychain',
  'liveaction',
  'localstorage',
  'providerapi',
  'providerclient',
  'requester',
  'resolver',
  'secretresolution',
  'sessionstorage',
  'socket',
  'storageadapter',
  'storageresult',
  'transport',
] as const;

const OWNER_SECRET_VALUE_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^ghp_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^sk-[a-z0-9_-]{8,}$/i,
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /basic\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:api|app|client|refresh|access)[_-]?(?:key|token|secret)\s*[:=]\s*\S+/i,
  /(?:oauth|authorization)[\s_-]?code\s*[:=]\s*\S+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
] as const;

function blocker(
  code: ConnectorRuntimeCredentialSessionBlockerCode,
  detail: string,
  field?: string,
  credentialStoreBlocker?: ConnectorCredentialStorePlannerBlocker,
): ConnectorRuntimeCredentialSessionBlocker {
  return createRuntimeTrustedContractObject([
    ['code', code],
    ['detail', detail],
    ['field', field],
    [
      'credentialStoreBlocker',
      credentialStoreBlocker
        ? createRuntimeTrustedContractObject([
            ['code', credentialStoreBlocker.code],
            ['detail', credentialStoreBlocker.detail],
            ['field', credentialStoreBlocker.field],
            ['credentialRejectReason', credentialStoreBlocker.credentialRejectReason],
          ])
        : undefined,
    ],
  ]) as unknown as ConnectorRuntimeCredentialSessionBlocker;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTrustedRecord(value: unknown): value is RuntimeTrustedContractObject & Record<string, unknown> {
  return isRuntimeTrustedContractObject(value);
}

function normalizedFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function containsForbiddenRuntimeMarker(value: string): boolean {
  const normalized = normalizedFieldName(value);
  return FORBIDDEN_RUNTIME_FIELD_MARKERS.some((marker) => normalized.includes(marker));
}

function hasUnsupportedKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).some((key) => !allowedKeys.has(key));
}

function hasRuntimePoisoningShape(value: unknown, allowedKeys?: ReadonlySet<string>, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (typeof value === 'string') return containsForbiddenRuntimeMarker(value);
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return true;
  if (allowedKeys && hasUnsupportedKeys(value, allowedKeys)) return true;
  return Object.entries(value).some(([key, nestedValue]) => (
    containsForbiddenRuntimeMarker(key) || hasRuntimePoisoningShape(nestedValue, undefined, seen)
  ));
}

function hasRuntimeSessionInputPoisoningShape(value: unknown): boolean {
  if (!isRecord(value) || hasUnsupportedKeys(value, INPUT_KEYS)) return true;
  for (const [key, nestedValue] of Object.entries(value)) {
    if (containsForbiddenRuntimeMarker(key)) return true;
    if (key === 'store' || key === 'handle') continue;
    if (key === 'runtimeOwner') {
      if (nestedValue !== undefined && nestedValue !== null && hasRuntimePoisoningShape(nestedValue, RUNTIME_OWNER_KEYS)) {
        return true;
      }
      continue;
    }
    if (typeof nestedValue === 'function' || Array.isArray(nestedValue)) return true;
    if (nestedValue !== null && typeof nestedValue === 'object') return true;
    if (typeof nestedValue === 'string' && containsForbiddenRuntimeMarker(nestedValue)) return true;
  }
  return false;
}

function normalizedRequiredString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringLooksLikeSecret(value: string): boolean {
  return OWNER_SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function isSafeRuntimeIdentifier(value: string): boolean {
  if (value.length > MAX_OWNER_IDENTIFIER_LENGTH) return false;
  if (!OWNER_IDENTIFIER_PATTERN.test(value)) return false;
  if (/^https?:\/\//i.test(value.trim())) return false;
  if (URL_LIKE_RUNTIME_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value.trim()))) return false;
  return !stringLooksLikeSecret(value);
}

function isSafeOptionalRuntimeIdentifier(value: string | undefined): boolean {
  return value === undefined || isSafeRuntimeIdentifier(value);
}

function isOptionalTimestamp(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}

function isRuntimeOwnerFact(value: unknown): value is ConnectorRuntimeCredentialSessionOwnerFact {
  if (!isTrustedRecord(value)) return false;
  if (hasUnsupportedKeys(value, RUNTIME_OWNER_KEYS)) return false;
  return (
    value.ownerKind === 'runtime-action-owner'
    && typeof value.reviewState === 'string'
    && typeof value.actionFamily === 'string'
    && typeof value.actionId === 'string'
    && typeof value.targetSurface === 'string'
    && typeof value.providerId === 'string'
    && typeof value.connectorId === 'string'
    && (value.accountId === undefined || typeof value.accountId === 'string')
    && (value.ownerId === undefined || typeof value.ownerId === 'string')
    && (value.runId === undefined || typeof value.runId === 'string')
    && isOptionalTimestamp(value.issuedAt)
    && isOptionalTimestamp(value.reviewedAt)
    && isOptionalTimestamp(value.expiresAt)
    && isOptionalTimestamp(value.revokedAt)
    && (value.stale === undefined || typeof value.stale === 'boolean')
  );
}

function addMissingStringBlocker(
  blockers: ConnectorRuntimeCredentialSessionBlocker[],
  value: string | undefined,
  code: ConnectorRuntimeCredentialSessionBlockerCode,
  detail: string,
  field: string,
): string | undefined {
  if (!value) {
    blockers.push(blocker(code, detail, field));
    return undefined;
  }
  if (!isSafeRuntimeIdentifier(value)) {
    blockers.push(blocker('runtime_owner_identifier_invalid', 'Runtime credential session identifiers must be bounded opaque metadata, not secret-like values.', field));
    return undefined;
  }
  return value;
}

function addStoreBlockers(
  blockers: ConnectorRuntimeCredentialSessionBlocker[],
  storeBlockers: readonly ConnectorCredentialStorePlannerBlocker[],
): void {
  for (const storeBlocker of storeBlockers) {
    blockers.push(blocker(storeBlocker.code, storeBlocker.detail, storeBlocker.field, storeBlocker));
  }
}

function ownerIdFieldsAreSafe(owner: ConnectorRuntimeCredentialSessionOwnerFact): boolean {
  return [
    owner.ownerId,
    owner.runId,
    owner.actionFamily,
    owner.actionId,
    owner.targetSurface,
    owner.providerId,
    owner.connectorId,
    owner.accountId,
  ].every((value) => isSafeOptionalRuntimeIdentifier(value));
}

function freezeCredentialHandle(reference: ConnectorCredentialReference): ConnectorCredentialReference {
  return createRuntimeTrustedContractObject([
    ['schemaVersion', reference.schemaVersion],
    ['kind', reference.kind],
    ['id', reference.id],
    ['storageOwner', reference.storageOwner],
    ['providerId', reference.providerId],
    ['connectorId', reference.connectorId],
    ['accountId', reference.accountId],
    ['displayName', reference.displayName],
    ['createdAt', reference.createdAt],
  ]) as unknown as ConnectorCredentialReference;
}

function buildDescriptor(
  request: Required<Pick<ConnectorRuntimeCredentialSessionRequest, 'actionFamily' | 'actionId' | 'targetSurface' | 'providerId' | 'connectorId'>> & Pick<ConnectorRuntimeCredentialSessionRequest, 'accountId'>,
  owner: ConnectorRuntimeCredentialSessionOwnerFact,
  handle: ConnectorCredentialReference,
): ConnectorRuntimeCredentialSessionDescriptor {
  return createRuntimeTrustedContractObject([
    ['schemaVersion', 1],
    ['sessionKind', 'runtime-credential-handle-session'],
    ['credentialHandle', freezeCredentialHandle(handle) as unknown as RuntimeTrustedContractObject],
    ['runtimeOwner', createRuntimeTrustedContractObject([
      ['ownerKind', 'runtime-action-owner'],
      ['ownerId', owner.ownerId],
      ['runId', owner.runId],
      ['reviewState', 'reviewed'],
      ['issuedAt', owner.issuedAt],
      ['reviewedAt', owner.reviewedAt],
      ['expiresAt', owner.expiresAt],
    ])],
    ['action', createRuntimeTrustedContractObject([
      ['actionFamily', request.actionFamily],
      ['actionId', request.actionId],
      ['targetSurface', request.targetSurface],
    ])],
    ['providerId', request.providerId],
    ['connectorId', request.connectorId],
    ['accountId', request.accountId],
    ['executable', false],
    ['sideEffects', 'none'],
    ['storageDirective', 'do-not-store-or-resolve-secret-material'],
  ]) as unknown as ConnectorRuntimeCredentialSessionDescriptor;
}

function buildStorePlannerInput(
  input: RuntimeTrustedContractObject & ConnectorRuntimeCredentialSessionRequest,
  providerId: string | undefined,
  connectorId: string | undefined,
  accountId: string | undefined,
): Parameters<typeof planConnectorCredentialStoreHandleReference>[0] {
  return createRuntimeTrustedContractObject([
    ['store', input.store as RuntimeTrustedContractValue],
    ['handle', input.handle as RuntimeTrustedContractValue],
    ['providerId', providerId],
    ['connectorId', connectorId],
    ['accountId', accountId],
  ]) as unknown as Parameters<typeof planConnectorCredentialStoreHandleReference>[0];
}

function buildDecision(
  ready: boolean,
  descriptor: ConnectorRuntimeCredentialSessionDescriptor | undefined,
  blockers: readonly ConnectorRuntimeCredentialSessionBlocker[],
): ConnectorRuntimeCredentialSessionDecision {
  return createRuntimeTrustedContractObject([
    ['status', ready ? 'session-ready' : 'blocked'],
    ['mayUseCredentialHandle', ready],
    ['mayResolveCredentialSecret', false],
    ['mayStoreCredentialSecret', false],
    ['descriptor', descriptor as unknown as RuntimeTrustedContractObject | undefined],
    ['sideEffectBoundary', 'plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-api-no-secret-resolution'],
    ['blockers', blockers as unknown as readonly RuntimeTrustedContractValue[]],
  ]) as unknown as ConnectorRuntimeCredentialSessionDecision;
}

export function planConnectorRuntimeCredentialSession(
  input: ConnectorRuntimeCredentialSessionRequest = {},
): ConnectorRuntimeCredentialSessionDecision {
  const blockers: ConnectorRuntimeCredentialSessionBlocker[] = [];

  if (!isRuntimeTrustedContractObject(input)) {
    blockers.push(blocker(
      'runtime_input_untrusted',
      'Runtime credential session input must be built by the runtime trusted contract object boundary before credential-store planning.',
      'input',
    ));
    return buildDecision(false, undefined, blockers);
  }

  const trustedInput = input as RuntimeTrustedContractObject & ConnectorRuntimeCredentialSessionRequest;

  if (hasRuntimeSessionInputPoisoningShape(trustedInput)) {
    blockers.push(blocker(
      'runtime_shape_forbidden',
      'Runtime credential session input must be exact inert metadata without callbacks, requesters, fetchers, sockets, browser storage, storage adapters, secret resolvers, executable claims, arrays, functions, or prototype-backed objects.',
      'input',
    ));
  }

  if (hasConnectorSecretMaterial(trustedInput)) {
    blockers.push(blocker(
      'raw_secret_material',
      'Runtime credential sessions accept only reviewed opaque credential handle and owner metadata, never raw tokens, passwords, API keys, OAuth codes, authorization headers, or provider secrets.',
      'input',
    ));
  }

  const actionFamily = addMissingStringBlocker(
    blockers,
    normalizedRequiredString(trustedInput.actionFamily),
    'action_family_missing',
    'Runtime credential session requires an action family.',
    'actionFamily',
  );
  const actionId = addMissingStringBlocker(
    blockers,
    normalizedRequiredString(trustedInput.actionId),
    'action_id_missing',
    'Runtime credential session requires an action id.',
    'actionId',
  );
  const targetSurface = addMissingStringBlocker(
    blockers,
    normalizedRequiredString(trustedInput.targetSurface),
    'target_surface_missing',
    'Runtime credential session requires a target surface.',
    'targetSurface',
  );
  const providerId = addMissingStringBlocker(
    blockers,
    normalizedRequiredString(trustedInput.providerId),
    'provider_missing',
    'Runtime credential session requires a provider id.',
    'providerId',
  );
  const connectorId = addMissingStringBlocker(
    blockers,
    normalizedRequiredString(trustedInput.connectorId),
    'connector_missing',
    'Runtime credential session requires a connector id.',
    'connectorId',
  );
  const accountId = normalizedRequiredString(trustedInput.accountId);
  if (accountId !== undefined && !isSafeRuntimeIdentifier(accountId)) {
    blockers.push(blocker('runtime_owner_identifier_invalid', 'Runtime credential account id must be bounded opaque metadata, not a secret-like value.', 'accountId'));
  }

  const storePlan = planConnectorCredentialStoreHandleReference(buildStorePlannerInput(
    trustedInput,
    providerId,
    connectorId,
    accountId,
  ));
  addStoreBlockers(blockers, storePlan.blockers);

  const owner = trustedInput.runtimeOwner;
  if (!owner) {
    blockers.push(blocker('runtime_owner_missing', 'Runtime credential session requires an explicit runtime owner fact.', 'runtimeOwner'));
  } else if (!isRuntimeOwnerFact(owner)) {
    blockers.push(blocker('runtime_owner_invalid', 'Runtime credential session owner fact failed the local boundary contract.', 'runtimeOwner'));
  } else {
    if (hasConnectorSecretMaterial(owner) || !ownerIdFieldsAreSafe(owner)) {
      blockers.push(blocker('runtime_owner_secret_material', 'Runtime owner fields must contain only bounded opaque identifiers and must not contain secret-like values.', 'runtimeOwner'));
    }
    if (!owner.ownerId && !owner.runId) {
      blockers.push(blocker('runtime_owner_missing_explicit_id', 'Runtime owner must include an explicit ownerId or runId.', 'runtimeOwner.ownerId'));
    }
    if (owner.reviewState !== 'reviewed') {
      const code: ConnectorRuntimeCredentialSessionBlockerCode =
        owner.reviewState === 'stale' ? 'runtime_owner_stale'
          : owner.reviewState === 'revoked' ? 'runtime_owner_revoked'
            : owner.reviewState === 'expired' ? 'runtime_owner_expired'
              : 'runtime_owner_not_reviewed';
      blockers.push(blocker(code, 'Runtime owner must be reviewed and current before a credential handle can be bound to it.', 'runtimeOwner.reviewState'));
    }
    if (owner.stale) {
      blockers.push(blocker('runtime_owner_stale', 'Runtime owner is marked stale and must be reviewed again.', 'runtimeOwner.stale'));
    }
    const now = trustedInput.now ?? Date.now();
    if (owner.revokedAt !== undefined && owner.revokedAt <= now) {
      blockers.push(blocker('runtime_owner_revoked', 'Runtime owner is revoked.', 'runtimeOwner.revokedAt'));
    }
    if (owner.expiresAt !== undefined && owner.expiresAt <= now) {
      blockers.push(blocker('runtime_owner_expired', 'Runtime owner is expired.', 'runtimeOwner.expiresAt'));
    }
    if (providerId !== undefined && owner.providerId !== providerId) {
      blockers.push(blocker('runtime_owner_provider_mismatch', 'Runtime owner providerId must match the session providerId.', 'runtimeOwner.providerId'));
    }
    if (connectorId !== undefined && owner.connectorId !== connectorId) {
      blockers.push(blocker('runtime_owner_connector_mismatch', 'Runtime owner connectorId must match the session connectorId.', 'runtimeOwner.connectorId'));
    }
    if (accountId !== undefined && owner.accountId !== accountId) {
      blockers.push(blocker('runtime_owner_account_mismatch', 'Runtime owner accountId must match the session accountId.', 'runtimeOwner.accountId'));
    }
    if (
      actionFamily !== undefined
      && actionId !== undefined
      && (owner.actionFamily !== actionFamily || owner.actionId !== actionId)
    ) {
      blockers.push(blocker('runtime_owner_action_mismatch', 'Runtime owner action family and action id must match the requested runtime action.', 'runtimeOwner.actionId'));
    }
    if (targetSurface !== undefined && owner.targetSurface !== targetSurface) {
      blockers.push(blocker('runtime_owner_target_mismatch', 'Runtime owner target surface must match the requested target surface.', 'runtimeOwner.targetSurface'));
    }
  }

  const ready = blockers.length === 0
    && storePlan.status === 'reference-ready'
    && storePlan.handleReference !== undefined
    && owner !== null
    && isRuntimeOwnerFact(owner)
    && owner.reviewState === 'reviewed'
    && actionFamily !== undefined
    && actionId !== undefined
    && targetSurface !== undefined
    && providerId !== undefined
    && connectorId !== undefined;

  let descriptor: ConnectorRuntimeCredentialSessionDescriptor | undefined;
  if (
    ready
    && storePlan.handleReference !== undefined
    && isRuntimeOwnerFact(owner)
    && actionFamily !== undefined
    && actionId !== undefined
    && targetSurface !== undefined
    && providerId !== undefined
    && connectorId !== undefined
  ) {
    descriptor = buildDescriptor({
      actionFamily,
      actionId,
      targetSurface,
      providerId,
      connectorId,
      accountId,
    }, owner, storePlan.handleReference);
  }

  return buildDecision(ready, descriptor, blockers);
}
