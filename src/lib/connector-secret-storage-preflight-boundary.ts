import { hasConnectorSecretMaterial, isSecretLikeFieldName } from './connector-credential-boundary';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type ConnectorSecretStoragePreflightStatus = 'ready' | 'blocked';

export type ConnectorSecretStoragePreflightReason =
  | 'connector_secret_storage_preflight_ready'
  | 'owner_surface_missing'
  | 'owner_surface_invalid'
  | 'secret_reference_missing'
  | 'secret_reference_invalid'
  | 'redaction_policy_missing'
  | 'redaction_policy_invalid'
  | 'rotation_policy_missing'
  | 'rotation_policy_invalid'
  | 'leakage_policy_missing'
  | 'leakage_policy_invalid'
  | 'raw_secret_material'
  | 'storage_shape_forbidden'
  | 'runtime_shape_forbidden';

export interface ConnectorSecretStorageOwnerSurface {
  contract: 'connector-secret-storage-owner-surface-v1';
  ownerSurface: 'connector-auth-settings' | 'connector-runtime-settings' | 'workspace-admin-settings';
  providerId: string;
  connectorId: string;
  accountId: string;
  reviewState: 'reviewed';
  ownerReviewed: true;
}

export interface ConnectorSecretReferenceMetadata {
  contract: 'connector-secret-reference-metadata-v1';
  providerId: string;
  connectorId: string;
  accountId: string;
  credentialReferenceId: string;
  referenceKind: 'provider-managed-oauth' | 'external-secret-store' | 'os-keychain';
  rawSecretPresent: false;
  referenceReviewed: true;
}

export interface ConnectorSecretRedactionPolicy {
  contract: 'connector-secret-redaction-policy-v1';
  redactionPolicyId: string;
  reviewState: 'reviewed';
  redactAtRest: true;
  redactInLogs: true;
  redactInExport: true;
  noPlaintextEcho: true;
}

export interface ConnectorSecretRotationPolicy {
  contract: 'connector-secret-rotation-policy-v1';
  rotationPolicyId: string;
  reviewState: 'reviewed';
  rotationReviewed: true;
  revocationReviewed: true;
  supportsRotation: true;
  supportsRevocation: true;
}

export interface ConnectorSecretLeakagePolicy {
  contract: 'connector-secret-leakage-policy-v1';
  leakagePolicyId: string;
  reviewState: 'reviewed';
  noExportLeakage: true;
  noBackupLeakage: true;
  noImportPlaintext: true;
  noSchemaRawSecretFields: true;
}

export interface ConnectorSecretStoragePreflightInput {
  ownerSurface?: unknown;
  secretReference?: unknown;
  redactionPolicy?: unknown;
  rotationPolicy?: unknown;
  leakagePolicy?: unknown;
  storageAdapter?: unknown;
  storageResult?: unknown;
}

export interface ConnectorSecretStoragePreflightPlan {
  contract: 'connector-secret-storage-preflight-plan-v1';
  ownerSurface: ConnectorSecretStorageOwnerSurface['ownerSurface'];
  providerId: string;
  connectorId: string;
  accountId: string;
  credentialReferenceId: string;
  referenceKind: ConnectorSecretReferenceMetadata['referenceKind'];
  redactionPolicyId: string;
  rotationPolicyId: string;
  leakagePolicyId: string;
  ownerReviewed: true;
  providerAccountBindingReviewed: true;
  redactionReviewed: true;
  rotationReviewed: true;
  revocationReviewed: true;
  noRawSecretGuarantee: true;
  noExportLeakage: true;
  noBackupLeakage: true;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'connector-secret-storage-preflight-plan-only-no-storage-no-schema-no-export-no-import-no-provider';
}

export interface ConnectorSecretStoragePreflightDecision {
  status: ConnectorSecretStoragePreflightStatus;
  ready: boolean;
  reason: ConnectorSecretStoragePreflightReason;
  plan?: ConnectorSecretStoragePreflightPlan;
  canPrepareFutureSecretStoragePlan: boolean;
  mayStoreCredential: false;
  mayReadStorage: false;
  mayWriteStorage: false;
  mayExportSecret: false;
  mayBackupSecret: false;
  executable: false;
  sideEffects: 'none';
  willUseLocalStorage: false;
  willUseSessionStorage: false;
  willUseIndexedDb: false;
  willUseKeychain: false;
  willFetch: false;
  willOpenSocket: false;
  willCallProvider: false;
  sideEffectBoundary: 'connector-secret-storage-preflight-boundary-plan-only-no-storage-no-schema-no-export-no-import-no-provider';
}

const DECISION_BOUNDARY =
  'connector-secret-storage-preflight-boundary-plan-only-no-storage-no-schema-no-export-no-import-no-provider' as const;
const PLAN_BOUNDARY =
  'connector-secret-storage-preflight-plan-only-no-storage-no-schema-no-export-no-import-no-provider' as const;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const CREDENTIAL_REFERENCE_PREFIXES = ['credref:', 'macos-login:', 'provider-oauth:', 'vault:'] as const;
const URL_OR_SCHEME_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const OWNER_KEYS = new Set(['accountId', 'connectorId', 'contract', 'ownerReviewed', 'ownerSurface', 'providerId', 'reviewState']);
const REFERENCE_KEYS = new Set([
  'accountId',
  'connectorId',
  'contract',
  'credentialReferenceId',
  'providerId',
  'rawSecretPresent',
  'referenceKind',
  'referenceReviewed',
]);
const REDACTION_KEYS = new Set([
  'contract',
  'noPlaintextEcho',
  'redactAtRest',
  'redactInExport',
  'redactInLogs',
  'redactionPolicyId',
  'reviewState',
]);
const ROTATION_KEYS = new Set([
  'contract',
  'revocationReviewed',
  'reviewState',
  'rotationPolicyId',
  'rotationReviewed',
  'supportsRevocation',
  'supportsRotation',
]);
const LEAKAGE_KEYS = new Set([
  'contract',
  'leakagePolicyId',
  'noBackupLeakage',
  'noExportLeakage',
  'noImportPlaintext',
  'noSchemaRawSecretFields',
  'reviewState',
]);
const INPUT_KEYS = new Set([
  'leakagePolicy',
  'ownerSurface',
  'redactionPolicy',
  'rotationPolicy',
  'secretReference',
  'storageAdapter',
  'storageResult',
]);
const OWNER_SURFACES = new Set<ConnectorSecretStorageOwnerSurface['ownerSurface']>([
  'connector-auth-settings',
  'connector-runtime-settings',
  'workspace-admin-settings',
]);
const REFERENCE_KINDS = new Set<ConnectorSecretReferenceMetadata['referenceKind']>([
  'provider-managed-oauth',
  'external-secret-store',
  'os-keychain',
]);
const RUNTIME_MARKERS = ['callback', 'execute', 'executable', 'fetch', 'liveaction', 'requester', 'socket'] as const;
const STORAGE_MARKERS = ['indexeddb', 'keychain', 'localstorage', 'sessionstorage', 'storageadapter', 'storageresult'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!SAFE_ID_PATTERN.test(trimmed) || isSecretLikeFieldName(trimmed) || hasConnectorSecretMaterial(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function identifierLooksUrlOrSchemeShaped(value: string): boolean {
  return URL_OR_SCHEME_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function safeGenericIdentifier(value: unknown): string | undefined {
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

function hasMarker(value: unknown, markers: readonly string[], seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return markers === RUNTIME_MARKERS;
  if (typeof value === 'string') return markers.some((marker) => normalize(value).includes(marker));
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasMarker(item, markers, seen));
  return Object.entries(value).some(([key, nestedValue]) => (
    markers.some((marker) => normalize(key).includes(marker)) || hasMarker(nestedValue, markers, seen)
  ));
}

function blocked(reason: ConnectorSecretStoragePreflightReason): Readonly<ConnectorSecretStoragePreflightDecision> {
  return Object.freeze({
    status: 'blocked',
    ready: false,
    reason,
    canPrepareFutureSecretStoragePlan: false,
    mayStoreCredential: false,
    mayReadStorage: false,
    mayWriteStorage: false,
    mayExportSecret: false,
    mayBackupSecret: false,
    executable: false,
    sideEffects: 'none',
    willUseLocalStorage: false,
    willUseSessionStorage: false,
    willUseIndexedDb: false,
    willUseKeychain: false,
    willFetch: false,
    willOpenSocket: false,
    willCallProvider: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}

function parseOwner(value: unknown): ConnectorSecretStorageOwnerSurface | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, OWNER_KEYS)) return undefined;
  const providerId = safeGenericIdentifier(value.providerId);
  const connectorId = safeGenericIdentifier(value.connectorId);
  const accountId = safeGenericIdentifier(value.accountId);
  const ownerSurface = OWNER_SURFACES.has(value.ownerSurface as ConnectorSecretStorageOwnerSurface['ownerSurface'])
    ? value.ownerSurface as ConnectorSecretStorageOwnerSurface['ownerSurface']
    : undefined;
  if (
    value.contract !== 'connector-secret-storage-owner-surface-v1'
    || value.reviewState !== 'reviewed'
    || value.ownerReviewed !== true
    || !ownerSurface
    || !providerId
    || !connectorId
    || !accountId
  ) return undefined;
  return Object.freeze({
    contract: 'connector-secret-storage-owner-surface-v1',
    ownerSurface,
    providerId,
    connectorId,
    accountId,
    reviewState: 'reviewed',
    ownerReviewed: true,
  });
}

function parseReference(value: unknown): ConnectorSecretReferenceMetadata | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, REFERENCE_KEYS)) return undefined;
  const providerId = safeGenericIdentifier(value.providerId);
  const connectorId = safeGenericIdentifier(value.connectorId);
  const accountId = safeGenericIdentifier(value.accountId);
  const credentialReferenceId = safeCredentialReferenceIdentifier(value.credentialReferenceId);
  const referenceKind = REFERENCE_KINDS.has(value.referenceKind as ConnectorSecretReferenceMetadata['referenceKind'])
    ? value.referenceKind as ConnectorSecretReferenceMetadata['referenceKind']
    : undefined;
  if (
    value.contract !== 'connector-secret-reference-metadata-v1'
    || !providerId
    || !connectorId
    || !accountId
    || !credentialReferenceId
    || !referenceKind
    || value.rawSecretPresent !== false
    || value.referenceReviewed !== true
  ) return undefined;
  return Object.freeze({
    contract: 'connector-secret-reference-metadata-v1',
    providerId,
    connectorId,
    accountId,
    credentialReferenceId,
    referenceKind,
    rawSecretPresent: false,
    referenceReviewed: true,
  });
}

function parseRedaction(value: unknown): ConnectorSecretRedactionPolicy | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, REDACTION_KEYS)) return undefined;
  const redactionPolicyId = safeGenericIdentifier(value.redactionPolicyId);
  if (
    value.contract !== 'connector-secret-redaction-policy-v1'
    || value.reviewState !== 'reviewed'
    || !redactionPolicyId
    || value.redactAtRest !== true
    || value.redactInLogs !== true
    || value.redactInExport !== true
    || value.noPlaintextEcho !== true
  ) return undefined;
  return Object.freeze({
    contract: 'connector-secret-redaction-policy-v1',
    redactionPolicyId,
    reviewState: 'reviewed',
    redactAtRest: true,
    redactInLogs: true,
    redactInExport: true,
    noPlaintextEcho: true,
  });
}

function parseRotation(value: unknown): ConnectorSecretRotationPolicy | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ROTATION_KEYS)) return undefined;
  const rotationPolicyId = safeGenericIdentifier(value.rotationPolicyId);
  if (
    value.contract !== 'connector-secret-rotation-policy-v1'
    || value.reviewState !== 'reviewed'
    || !rotationPolicyId
    || value.rotationReviewed !== true
    || value.revocationReviewed !== true
    || value.supportsRotation !== true
    || value.supportsRevocation !== true
  ) return undefined;
  return Object.freeze({
    contract: 'connector-secret-rotation-policy-v1',
    rotationPolicyId,
    reviewState: 'reviewed',
    rotationReviewed: true,
    revocationReviewed: true,
    supportsRotation: true,
    supportsRevocation: true,
  });
}

function parseLeakage(value: unknown): ConnectorSecretLeakagePolicy | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, LEAKAGE_KEYS)) return undefined;
  const leakagePolicyId = safeGenericIdentifier(value.leakagePolicyId);
  if (
    value.contract !== 'connector-secret-leakage-policy-v1'
    || value.reviewState !== 'reviewed'
    || !leakagePolicyId
    || value.noExportLeakage !== true
    || value.noBackupLeakage !== true
    || value.noImportPlaintext !== true
    || value.noSchemaRawSecretFields !== true
  ) return undefined;
  return Object.freeze({
    contract: 'connector-secret-leakage-policy-v1',
    leakagePolicyId,
    reviewState: 'reviewed',
    noExportLeakage: true,
    noBackupLeakage: true,
    noImportPlaintext: true,
    noSchemaRawSecretFields: true,
  });
}

export function evaluateConnectorSecretStoragePreflightBoundary(
  input: ConnectorSecretStoragePreflightInput,
): Readonly<ConnectorSecretStoragePreflightDecision> {
  if (!isRuntimeTrustedContractObject(input)) return blocked('runtime_shape_forbidden');
  if (!isRecord(input) || !hasOnlyKeys(input, INPUT_KEYS)) return blocked('runtime_shape_forbidden');
  if (hasConnectorSecretMaterial(input)) return blocked('raw_secret_material');
  if (input.storageAdapter !== undefined || input.storageResult !== undefined || hasMarker(input, STORAGE_MARKERS)) {
    return blocked('storage_shape_forbidden');
  }
  if (hasMarker(input, RUNTIME_MARKERS)) return blocked('runtime_shape_forbidden');
  if (input.ownerSurface === undefined) return blocked('owner_surface_missing');
  if (input.secretReference === undefined) return blocked('secret_reference_missing');
  if (input.redactionPolicy === undefined) return blocked('redaction_policy_missing');
  if (input.rotationPolicy === undefined) return blocked('rotation_policy_missing');
  if (input.leakagePolicy === undefined) return blocked('leakage_policy_missing');

  const owner = parseOwner(input.ownerSurface);
  if (!owner) return blocked('owner_surface_invalid');
  const reference = parseReference(input.secretReference);
  if (!reference) return blocked('secret_reference_invalid');
  const redaction = parseRedaction(input.redactionPolicy);
  if (!redaction) return blocked('redaction_policy_invalid');
  const rotation = parseRotation(input.rotationPolicy);
  if (!rotation) return blocked('rotation_policy_invalid');
  const leakage = parseLeakage(input.leakagePolicy);
  if (!leakage) return blocked('leakage_policy_invalid');
  if (
    owner.providerId !== reference.providerId
    || owner.connectorId !== reference.connectorId
    || owner.accountId !== reference.accountId
  ) return blocked('secret_reference_invalid');

  const plan: ConnectorSecretStoragePreflightPlan = Object.freeze({
    contract: 'connector-secret-storage-preflight-plan-v1',
    ownerSurface: owner.ownerSurface,
    providerId: owner.providerId,
    connectorId: owner.connectorId,
    accountId: owner.accountId,
    credentialReferenceId: reference.credentialReferenceId,
    referenceKind: reference.referenceKind,
    redactionPolicyId: redaction.redactionPolicyId,
    rotationPolicyId: rotation.rotationPolicyId,
    leakagePolicyId: leakage.leakagePolicyId,
    ownerReviewed: true,
    providerAccountBindingReviewed: true,
    redactionReviewed: true,
    rotationReviewed: true,
    revocationReviewed: true,
    noRawSecretGuarantee: true,
    noExportLeakage: true,
    noBackupLeakage: true,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: PLAN_BOUNDARY,
  });

  return Object.freeze({
    status: 'ready',
    ready: true,
    reason: 'connector_secret_storage_preflight_ready',
    plan,
    canPrepareFutureSecretStoragePlan: true,
    mayStoreCredential: false,
    mayReadStorage: false,
    mayWriteStorage: false,
    mayExportSecret: false,
    mayBackupSecret: false,
    executable: false,
    sideEffects: 'none',
    willUseLocalStorage: false,
    willUseSessionStorage: false,
    willUseIndexedDb: false,
    willUseKeychain: false,
    willFetch: false,
    willOpenSocket: false,
    willCallProvider: false,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}
