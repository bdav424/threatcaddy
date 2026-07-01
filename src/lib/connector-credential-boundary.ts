export type ConnectorCredentialReferenceKind =
  | 'os-keychain'
  | 'local-bridge'
  | 'external-secret-store'
  | 'provider-managed-oauth';

export type ConnectorCredentialStorageOwner =
  | 'operating-system'
  | 'local-bridge'
  | 'external-provider'
  | 'external-secret-store';

export interface ConnectorCredentialReference {
  schemaVersion: 1;
  kind: ConnectorCredentialReferenceKind;
  id: string;
  storageOwner: ConnectorCredentialStorageOwner;
  providerId?: string;
  connectorId?: string;
  accountId?: string;
  displayName?: string;
  createdAt?: number;
}

export type ConnectorCredentialReferenceRejectReason =
  | 'not_object'
  | 'invalid_schema_version'
  | 'invalid_kind'
  | 'invalid_storage_owner'
  | 'storage_owner_mismatch'
  | 'invalid_identifier'
  | 'unsupported_field'
  | 'secret_material_detected';

export type ConnectorCredentialReferenceValidation =
  | { ok: true; reference: ConnectorCredentialReference }
  | { ok: false; reason: ConnectorCredentialReferenceRejectReason; field?: string };

export type ConnectorCredentialExportDecision =
  | { decision: 'allow-reference'; reference: ConnectorCredentialReference }
  | { decision: 'block'; reason: ConnectorCredentialReferenceRejectReason | 'raw_secret_material' };

export const CONNECTOR_CREDENTIAL_BOUNDARY_GUIDANCE = {
  export:
    'Export only opaque connector credential references that pass validateConnectorCredentialReference. Block raw secret material and malformed references.',
  logging:
    'Log connector credential metadata only after redactConnectorSecretMaterial has removed secret-like fields. Never log raw tokens, passwords, OAuth codes, API keys, app passwords, or provider secrets.',
  validation:
    'Fail closed: unknown reference shapes, unsupported fields, mismatched storage owners, and secret-like values are invalid until a reviewed connector bridge or secret store owns them.',
} as const;

export const REDACTED_CONNECTOR_CREDENTIAL = '[REDACTED CONNECTOR CREDENTIAL]';
export const CIRCULAR_CONNECTOR_CREDENTIAL_VALUE = '[Circular]';

const MAX_REFERENCE_ID_LENGTH = 180;
const MAX_REFERENCE_LABEL_LENGTH = 160;
const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:@/+~-]+$/;
const ALLOWED_OPAQUE_REFERENCE_PREFIXES = [
  'local-bridge:',
  'macos-login:',
  'provider-oauth:',
  'vault:',
] as const;

const URL_LIKE_REFERENCE_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:\/\//i,
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;

interface SafeCredentialBoundarySnapshot {
  value: unknown;
  unsafeAccess: boolean;
}

const SECRET_FIELD_MARKERS = [
  'password',
  'passphrase',
  'accesstoken',
  'refreshtoken',
  'clientsecret',
  'apikey',
  'apitoken',
  'appkey',
  'appsecret',
  'privatekey',
  'authorization',
  'bearer',
  'oauthcode',
  'sessioncookie',
  'cookie',
  'smtppassword',
  'imappassword',
] as const;

const SECRET_VALUE_PATTERNS = [
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

const SAFE_REFERENCE_FIELDS = new Set([
  'schemaVersion',
  'kind',
  'id',
  'storageOwner',
  'providerId',
  'connectorId',
  'accountId',
  'displayName',
  'createdAt',
]);

const VALID_REFERENCE_KINDS = new Set<ConnectorCredentialReferenceKind>([
  'os-keychain',
  'local-bridge',
  'external-secret-store',
  'provider-managed-oauth',
]);

const VALID_STORAGE_OWNERS = new Set<ConnectorCredentialStorageOwner>([
  'operating-system',
  'local-bridge',
  'external-provider',
  'external-secret-store',
]);

function normalizeSecretBoundaryText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isSecretLikeFieldName(fieldName: string): boolean {
  const normalized = normalizeSecretBoundaryText(fieldName);
  return SECRET_FIELD_MARKERS.some((marker) => normalized.includes(marker));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDataDescriptor(descriptor: PropertyDescriptor | undefined): descriptor is PropertyDescriptor & { value: unknown } {
  return descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

function isArrayIndexProperty(key: string): boolean {
  if (!/^(0|[1-9][0-9]*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < 4_294_967_295;
}

function snapshotCredentialBoundaryValue(
  value: unknown,
  seen: WeakMap<object, unknown> = new WeakMap(),
): SafeCredentialBoundarySnapshot {
  if (value === null || typeof value !== 'object') {
    return { value, unsafeAccess: false };
  }

  const cached = seen.get(value);
  if (cached !== undefined) {
    return { value: cached, unsafeAccess: false };
  }

  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return { value: undefined, unsafeAccess: true };
  }

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    let unsafeAccess = false;

    for (const key of Reflect.ownKeys(descriptors)) {
      if (key === 'length') continue;
      if (typeof key !== 'string' || !isArrayIndexProperty(key)) {
        unsafeAccess = true;
        continue;
      }

      const descriptor = descriptors[key];
      if (!isDataDescriptor(descriptor) || descriptor.enumerable !== true) {
        unsafeAccess = true;
        continue;
      }

      const nested = snapshotCredentialBoundaryValue(descriptor.value, seen);
      if (nested.unsafeAccess) unsafeAccess = true;
      copy[Number(key)] = nested.value;
    }

    return { value: copy, unsafeAccess };
  }

  let prototype: unknown;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch {
    return { value: undefined, unsafeAccess: true };
  }

  if (prototype !== Object.prototype && prototype !== null) {
    return { value: undefined, unsafeAccess: true };
  }

  const copy: Record<string, unknown> = {};
  seen.set(value, copy);
  let unsafeAccess = false;

  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string') {
      unsafeAccess = true;
      continue;
    }

    const descriptor = descriptors[key];
    if (!isDataDescriptor(descriptor) || descriptor.enumerable !== true) {
      unsafeAccess = true;
      continue;
    }

    const nested = snapshotCredentialBoundaryValue(descriptor.value, seen);
    if (nested.unsafeAccess) unsafeAccess = true;
    copy[key] = nested.value;
  }

  return { value: copy, unsafeAccess };
}

function stringLooksLikeSecretMaterial(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function containsSecretMarkerText(value: string): boolean {
  const normalized = normalizeSecretBoundaryText(value);
  return SECRET_FIELD_MARKERS.some((marker) => normalized.includes(marker));
}

function hasAllowedOpaqueReferencePrefix(identifier: string): boolean {
  const normalized = identifier.toLowerCase();
  return ALLOWED_OPAQUE_REFERENCE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function identifierLooksUrlOrSchemeShaped(
  identifier: string,
  options: { allowOpaqueReferencePrefix?: boolean } = {},
): boolean {
  const trimmed = identifier.trim();
  if (options.allowOpaqueReferencePrefix && hasAllowedOpaqueReferencePrefix(trimmed)) return false;
  return URL_LIKE_REFERENCE_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function safeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function sanitizeReferenceIdentifier(
  value: unknown,
  options: { allowOpaqueReferencePrefix?: boolean } = {},
): string | undefined {
  const identifier = safeString(value, MAX_REFERENCE_ID_LENGTH);
  if (!identifier) return undefined;
  if (!IDENTIFIER_PATTERN.test(identifier)) return undefined;
  if (identifierLooksUrlOrSchemeShaped(identifier, options)) return undefined;
  if (containsSecretMarkerText(identifier)) return undefined;
  if (stringLooksLikeSecretMaterial(identifier)) return undefined;
  return identifier;
}

function sanitizeCredentialReferenceId(value: unknown): string | undefined {
  return sanitizeReferenceIdentifier(value, { allowOpaqueReferencePrefix: true });
}

function sanitizeGenericReferenceIdentifier(value: unknown): string | undefined {
  return sanitizeReferenceIdentifier(value);
}

function sanitizeReferenceLabel(value: unknown): string | undefined {
  const label = safeString(value, MAX_REFERENCE_LABEL_LENGTH);
  if (!label) return undefined;
  if (stringLooksLikeSecretMaterial(label)) return undefined;
  return label;
}

function sanitizeOptionalTimestamp(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return undefined;
  if (value < 0 || value > MAX_DATE_TIMESTAMP) return undefined;
  return value;
}

function isStorageOwnerValidForKind(
  kind: ConnectorCredentialReferenceKind,
  storageOwner: ConnectorCredentialStorageOwner,
): boolean {
  if (kind === 'os-keychain') return storageOwner === 'operating-system';
  if (kind === 'local-bridge') return storageOwner === 'local-bridge';
  if (kind === 'external-secret-store') return storageOwner === 'external-secret-store';
  return storageOwner === 'external-provider' || storageOwner === 'external-secret-store';
}

export function hasConnectorSecretMaterial(value: unknown): boolean {
  const snapshot = snapshotCredentialBoundaryValue(value);
  if (snapshot.unsafeAccess) return true;

  const seen = new WeakSet<object>();
  const pending: unknown[] = [snapshot.value];

  while (pending.length > 0) {
    const current = pending.pop();

    if (typeof current === 'string') {
      if (stringLooksLikeSecretMaterial(current)) return true;
      continue;
    }

    if (current === null || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);

    for (const [key, nestedValue] of Object.entries(current)) {
      if (isSecretLikeFieldName(key)) return true;
      pending.push(nestedValue);
    }
  }

  return false;
}

export function redactConnectorSecretMaterial(value: unknown): unknown {
  const snapshot = snapshotCredentialBoundaryValue(value);
  if (snapshot.unsafeAccess) return REDACTED_CONNECTOR_CREDENTIAL;

  const seen = new WeakMap<object, unknown>();

  const redact = (current: unknown, currentKey?: string): unknown => {
    if (currentKey && isSecretLikeFieldName(currentKey)) return REDACTED_CONNECTOR_CREDENTIAL;
    if (typeof current === 'string') {
      return stringLooksLikeSecretMaterial(current) ? REDACTED_CONNECTOR_CREDENTIAL : current;
    }
    if (current === null || typeof current !== 'object') return current;
    const existing = seen.get(current);
    if (existing) return CIRCULAR_CONNECTOR_CREDENTIAL_VALUE;

    if (Array.isArray(current)) {
      const redactedArray: unknown[] = [];
      seen.set(current, redactedArray);
      current.forEach((item) => redactedArray.push(redact(item)));
      return redactedArray;
    }

    const redactedRecord: Record<string, unknown> = {};
    seen.set(current, redactedRecord);
    for (const [key, nestedValue] of Object.entries(current)) {
      redactedRecord[key] = redact(nestedValue, key);
    }
    return redactedRecord;
  };

  return redact(snapshot.value);
}

export function validateConnectorCredentialReference(raw: unknown): ConnectorCredentialReferenceValidation {
  const snapshot = snapshotCredentialBoundaryValue(raw);
  if (snapshot.unsafeAccess || !isPlainRecord(snapshot.value)) return { ok: false, reason: 'not_object' };
  const record = snapshot.value;

  for (const key of Object.keys(record)) {
    if (isSecretLikeFieldName(key)) return { ok: false, reason: 'secret_material_detected', field: key };
    if (!SAFE_REFERENCE_FIELDS.has(key)) return { ok: false, reason: 'unsupported_field', field: key };
  }

  if (record.schemaVersion !== 1) return { ok: false, reason: 'invalid_schema_version', field: 'schemaVersion' };

  const kind = record.kind;
  if (typeof kind !== 'string' || !VALID_REFERENCE_KINDS.has(kind as ConnectorCredentialReferenceKind)) {
    return { ok: false, reason: 'invalid_kind', field: 'kind' };
  }

  const storageOwner = record.storageOwner;
  if (typeof storageOwner !== 'string' || !VALID_STORAGE_OWNERS.has(storageOwner as ConnectorCredentialStorageOwner)) {
    return { ok: false, reason: 'invalid_storage_owner', field: 'storageOwner' };
  }

  if (!isStorageOwnerValidForKind(kind as ConnectorCredentialReferenceKind, storageOwner as ConnectorCredentialStorageOwner)) {
    return { ok: false, reason: 'storage_owner_mismatch', field: 'storageOwner' };
  }

  const id = sanitizeCredentialReferenceId(record.id);
  if (!id) return { ok: false, reason: 'invalid_identifier', field: 'id' };

  const providerId = sanitizeGenericReferenceIdentifier(record.providerId);
  if (record.providerId !== undefined && !providerId) {
    return { ok: false, reason: 'invalid_identifier', field: 'providerId' };
  }

  const connectorId = sanitizeGenericReferenceIdentifier(record.connectorId);
  if (record.connectorId !== undefined && !connectorId) {
    return { ok: false, reason: 'invalid_identifier', field: 'connectorId' };
  }

  const accountId = sanitizeGenericReferenceIdentifier(record.accountId);
  if (record.accountId !== undefined && !accountId) {
    return { ok: false, reason: 'invalid_identifier', field: 'accountId' };
  }

  const displayName = sanitizeReferenceLabel(record.displayName);
  if (record.displayName !== undefined && !displayName) {
    return { ok: false, reason: 'secret_material_detected', field: 'displayName' };
  }

  const createdAt = sanitizeOptionalTimestamp(record.createdAt);
  if (record.createdAt !== undefined && createdAt === undefined) {
    return { ok: false, reason: 'invalid_identifier', field: 'createdAt' };
  }

  const reference: ConnectorCredentialReference = {
    schemaVersion: 1,
    kind: kind as ConnectorCredentialReferenceKind,
    id,
    storageOwner: storageOwner as ConnectorCredentialStorageOwner,
  };

  if (providerId) reference.providerId = providerId;
  if (connectorId) reference.connectorId = connectorId;
  if (accountId) reference.accountId = accountId;
  if (displayName) reference.displayName = displayName;
  if (createdAt !== undefined) reference.createdAt = createdAt;

  return { ok: true, reference };
}

export function sanitizeConnectorCredentialReference(raw: unknown): ConnectorCredentialReference | null {
  const validation = validateConnectorCredentialReference(raw);
  return validation.ok ? validation.reference : null;
}

export function classifyConnectorCredentialForExport(raw: unknown): ConnectorCredentialExportDecision {
  const validation = validateConnectorCredentialReference(raw);
  if (validation.ok) return { decision: 'allow-reference', reference: validation.reference };
  if (hasConnectorSecretMaterial(raw)) return { decision: 'block', reason: 'raw_secret_material' };
  return { decision: 'block', reason: validation.reason };
}
