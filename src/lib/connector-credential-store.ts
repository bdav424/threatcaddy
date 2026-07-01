import {
  hasConnectorSecretMaterial,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
  type ConnectorCredentialReferenceKind,
  type ConnectorCredentialReferenceRejectReason,
  type ConnectorCredentialStorageOwner,
} from './connector-credential-boundary';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type ConnectorCredentialStoreCapabilityKind = ConnectorCredentialReferenceKind;
export type ConnectorCredentialStoreReviewState = 'reviewed' | 'draft' | 'unreviewed';

export interface ConnectorCredentialStoreCapability {
  kind: ConnectorCredentialStoreCapabilityKind;
  storageOwner: ConnectorCredentialStorageOwner;
  reviewState: ConnectorCredentialStoreReviewState;
  supportsOpaqueHandle: boolean;
  persistsRawSecretMaterial: false;
  usesBrowserSecretStorage: false;
  callsProviderApis: false;
  providerId?: string;
  connectorId?: string;
}

export interface ConnectorCredentialStoreHandlePlannerInput {
  store?: ConnectorCredentialStoreCapability | null;
  handle?: unknown;
  providerId?: string;
  connectorId?: string;
  accountId?: string;
}

export type ConnectorCredentialStorePlannerBlockerCode =
  | 'input_invalid'
  | 'input_unsupported_field'
  | 'input_field_invalid'
  | 'store_capability_missing'
  | 'store_capability_invalid'
  | 'store_capability_unsupported_field'
  | 'store_capability_field_invalid'
  | 'store_not_reviewed'
  | 'opaque_handle_unsupported'
  | 'raw_secret_material'
  | 'browser_secret_storage_requested'
  | 'raw_secret_persistence_requested'
  | 'schema_writer_requested'
  | 'provider_api_call_requested'
  | 'handle_missing'
  | 'handle_invalid'
  | 'handle_kind_mismatch'
  | 'handle_storage_owner_mismatch'
  | 'handle_provider_mismatch'
  | 'handle_connector_mismatch'
  | 'handle_account_mismatch';

export interface ConnectorCredentialStorePlannerBlocker {
  code: ConnectorCredentialStorePlannerBlockerCode;
  detail: string;
  field?: string;
  credentialRejectReason?: ConnectorCredentialReferenceRejectReason;
}

export interface ConnectorCredentialStoreHandlePlan {
  status: 'blocked' | 'reference-ready';
  mayReferenceHandle: boolean;
  mayStoreSecretMaterial?: false;
  mayResolveSecretMaterial?: false;
  executableCredentialStorage?: false;
  executableCredentialResolution?: false;
  feasibilityDirective?: 'opaque-handle-reference-only-no-secret-storage-or-resolution';
  handleReference?: ConnectorCredentialReference;
  storageDirective: 'do-not-persist-secret-material';
  resolutionDirective: 'do-not-resolve-secret-material';
  sideEffectBoundary: 'plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-api-no-secret-resolution-no-secret-persistence';
  blockers: readonly ConnectorCredentialStorePlannerBlocker[];
}

interface NormalizedConnectorCredentialStoreCapability {
  kind: ConnectorCredentialStoreCapabilityKind;
  storageOwner: ConnectorCredentialStorageOwner;
  reviewState: ConnectorCredentialStoreReviewState;
  supportsOpaqueHandle: boolean;
  providerId?: string;
  connectorId?: string;
}

interface SafeBoundarySnapshot {
  value: unknown;
  unsafeAccess: boolean;
}

const PLANNER_INPUT_FIELDS = new Set([
  'store',
  'handle',
  'providerId',
  'connectorId',
  'accountId',
]);

const STORE_CAPABILITY_FIELDS = new Set([
  'kind',
  'storageOwner',
  'reviewState',
  'supportsOpaqueHandle',
  'persistsRawSecretMaterial',
  'usesBrowserSecretStorage',
  'callsProviderApis',
  'providerId',
  'connectorId',
]);

const VALID_STORE_KINDS = new Set<ConnectorCredentialStoreCapabilityKind>([
  'os-keychain',
  'local-bridge',
  'external-secret-store',
  'provider-managed-oauth',
]);

const VALID_STORE_STORAGE_OWNERS = new Set<ConnectorCredentialStorageOwner>([
  'operating-system',
  'local-bridge',
  'external-provider',
  'external-secret-store',
]);

const VALID_STORE_REVIEW_STATES = new Set<ConnectorCredentialStoreReviewState>([
  'reviewed',
  'draft',
  'unreviewed',
]);

const MAX_GENERIC_METADATA_ID_LENGTH = 180;
const GENERIC_METADATA_ID_PATTERN = /^[A-Za-z0-9._~-]+$/;

const SAFE_HANDLE_VALIDATION_FIELDS = new Set([
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

const BROWSER_STORAGE_FIELD_MARKERS = [
  'localstorage',
  'sessionstorage',
  'indexeddb',
  'browserstorage',
  'storageadapter',
  'storageprovider',
  'secretstorage',
  'storage',
];

const PROVIDER_API_FIELD_MARKERS = [
  'fetch',
  'liveaction',
  'postmessage',
  'providerapi',
  'providerclient',
  'oauthclient',
  'oauthflow',
  'redirect',
  'requester',
  'send',
  'transport',
  'socket',
  'callback',
  'sdk',
  'webhook',
  'webhookurl',
];

const SCHEMA_WRITER_FIELD_MARKERS = [
  'schemawriter',
  'migrationrunner',
  'migration',
  'dexie',
];

function blocker(
  code: ConnectorCredentialStorePlannerBlockerCode,
  detail: string,
  field?: string,
  credentialRejectReason?: ConnectorCredentialReferenceRejectReason,
): ConnectorCredentialStorePlannerBlocker {
  return Object.freeze({
    code,
    detail,
    field,
    credentialRejectReason,
  });
}

function storageOwnerMatchesKind(
  kind: ConnectorCredentialReferenceKind,
  storageOwner: ConnectorCredentialStorageOwner,
): boolean {
  if (kind === 'os-keychain') return storageOwner === 'operating-system';
  if (kind === 'local-bridge') return storageOwner === 'local-bridge';
  if (kind === 'external-secret-store') return storageOwner === 'external-secret-store';
  return storageOwner === 'external-provider' || storageOwner === 'external-secret-store';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDataDescriptor(descriptor: PropertyDescriptor | undefined): descriptor is PropertyDescriptor & { value: unknown } {
  return descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

function isArrayIndexProperty(key: string): boolean {
  if (!/^(0|[1-9][0-9]*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < 4_294_967_295;
}

function snapshotBoundaryValue(
  value: unknown,
  seen: WeakMap<object, unknown> = new WeakMap(),
): SafeBoundarySnapshot {
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

      const nested = snapshotBoundaryValue(descriptor.value, seen);
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

    const nested = snapshotBoundaryValue(descriptor.value, seen);
    if (nested.unsafeAccess) unsafeAccess = true;
    copy[key] = nested.value;
  }

  return { value: copy, unsafeAccess };
}

function matchesOptionalFact(expected: string | undefined, actual: string | undefined): boolean {
  return expected === undefined || actual === expected;
}

function normalizedFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function handleIdLooksSecretBearingUrl(value: string): boolean {
  const trimmed = value.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    || /^(?!(?:local-bridge|macos-login|provider-oauth|vault):)[a-z][a-z0-9+.-]*:[^/]/i.test(trimmed)
    || /^\/\//.test(trimmed)
    || /^[a-z0-9.-]+\.[a-z]{2,}(?::\d{2,5})?\/\S+/i.test(trimmed)
    || /^(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?\/\S+/.test(trimmed)
    || /^\[[0-9a-f:.]+\](?::\d{2,5})?\/\S+/i.test(trimmed)
    || /^localhost(?::\d{2,5})?\/\S+/i.test(trimmed)
    || /hooks\.slack(?:-gov)?\.com\/services\//i.test(trimmed);
}

function genericMetadataIdLooksUrlOrSchemeShaped(value: string): boolean {
  const trimmed = value.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    || /^\/\//.test(trimmed)
    || /^[a-z0-9.-]+\.[a-z]{2,}(?::\d{2,5})?(?:\/|\?|#)\S*/i.test(trimmed)
    || /^(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?(?:\/|\?|#)\S*/.test(trimmed)
    || /^\[[0-9a-f:.]+\](?::\d{2,5})?(?:\/|\?|#)\S*/i.test(trimmed)
    || /^localhost(?::\d{2,5})?(?:\/|\?|#)\S*/i.test(trimmed)
    || /hooks\.slack(?:-gov)?\.com\/services\//i.test(trimmed);
}

function isStoreCapabilityKind(value: unknown): value is ConnectorCredentialStoreCapabilityKind {
  return typeof value === 'string' && VALID_STORE_KINDS.has(value as ConnectorCredentialStoreCapabilityKind);
}

function isStoreStorageOwner(value: unknown): value is ConnectorCredentialStorageOwner {
  return typeof value === 'string' && VALID_STORE_STORAGE_OWNERS.has(value as ConnectorCredentialStorageOwner);
}

function isStoreReviewState(value: unknown): value is ConnectorCredentialStoreReviewState {
  return typeof value === 'string' && VALID_STORE_REVIEW_STATES.has(value as ConnectorCredentialStoreReviewState);
}

function addForbiddenUnsupportedFieldBlockers(
  blockers: ConnectorCredentialStorePlannerBlocker[],
  fieldName: string,
  fieldScope: string,
): void {
  const normalized = normalizedFieldName(fieldName);
  if (BROWSER_STORAGE_FIELD_MARKERS.some((marker) => normalized.includes(marker))) {
    blockers.push(blocker(
      'browser_secret_storage_requested',
      'Credential store planning rejects browser storage handles and adapter fields.',
      fieldScope,
    ));
  }
  if (SCHEMA_WRITER_FIELD_MARKERS.some((marker) => normalized.includes(marker))) {
    blockers.push(blocker(
      'schema_writer_requested',
      'Credential store planning rejects schema writer, browser database, and migration-capable fields.',
      fieldScope,
    ));
  }
  if (PROVIDER_API_FIELD_MARKERS.some((marker) => normalized.includes(marker))) {
    blockers.push(blocker(
      'provider_api_call_requested',
      'Credential store planning rejects provider API, callback, socket, requester, and transport fields.',
      fieldScope,
    ));
  }
}

function addUnsupportedFieldBlockers(
  blockers: ConnectorCredentialStorePlannerBlocker[],
  source: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
  code: 'input_unsupported_field' | 'store_capability_unsupported_field',
  fieldScope: 'input' | 'store',
): boolean {
  let unsupported = false;
  for (const key of Object.keys(source)) {
    if (allowedFields.has(key)) continue;
    unsupported = true;
    addForbiddenUnsupportedFieldBlockers(blockers, key, fieldScope);
    blockers.push(blocker(
      code,
      fieldScope === 'input'
        ? 'Credential store planner input contained unsupported field(s).'
        : 'Credential store capability contained unsupported field(s).',
      fieldScope,
    ));
  }
  return unsupported;
}

function addForbiddenHandleFieldBlockers(
  blockers: ConnectorCredentialStorePlannerBlocker[],
  handle: unknown,
): void {
  if (!isRecord(handle)) return;
  for (const key of Object.keys(handle)) {
    if (SAFE_HANDLE_VALIDATION_FIELDS.has(key)) continue;
    addForbiddenUnsupportedFieldBlockers(blockers, key, 'handle');
  }
}

function normalizeGenericMetadataIdentifier(
  value: unknown,
  field: string,
  blockers: ConnectorCredentialStorePlannerBlocker[],
  code: 'input_field_invalid' | 'store_capability_field_invalid',
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    blockers.push(blocker(
      code,
      'Credential store metadata identifiers must be bounded opaque strings.',
      field,
    ));
    return undefined;
  }
  const trimmed = value.trim();
  if (
    !trimmed
    || trimmed.length > MAX_GENERIC_METADATA_ID_LENGTH
    || !GENERIC_METADATA_ID_PATTERN.test(trimmed)
    || genericMetadataIdLooksUrlOrSchemeShaped(trimmed)
    || hasConnectorSecretMaterial(trimmed)
  ) {
    blockers.push(blocker(
      code,
      'Credential store metadata identifiers must be bounded generic non-secret strings, not credential-handle references.',
      field,
    ));
    return undefined;
  }
  return trimmed;
}

function safeHandleValidationField(field: string | undefined): string {
  if (field && SAFE_HANDLE_VALIDATION_FIELDS.has(field)) return `handle.${field}`;
  return 'handle';
}

function freezeCredentialReference(reference: ConnectorCredentialReference): ConnectorCredentialReference {
  const frozenReference: ConnectorCredentialReference = {
    schemaVersion: 1,
    kind: reference.kind,
    id: reference.id,
    storageOwner: reference.storageOwner,
  };
  if (reference.providerId !== undefined) frozenReference.providerId = reference.providerId;
  if (reference.connectorId !== undefined) frozenReference.connectorId = reference.connectorId;
  if (reference.accountId !== undefined) frozenReference.accountId = reference.accountId;
  if (reference.displayName !== undefined) frozenReference.displayName = reference.displayName;
  if (reference.createdAt !== undefined) frozenReference.createdAt = reference.createdAt;
  return Object.freeze(frozenReference);
}

function normalizeCredentialStoreCapability(
  value: unknown,
  blockers: ConnectorCredentialStorePlannerBlocker[],
): NormalizedConnectorCredentialStoreCapability | undefined {
  if (!isRecord(value)) {
    blockers.push(blocker('store_capability_invalid', 'Credential store capability failed the local boundary contract.', 'store'));
    return undefined;
  }

  let invalid = addUnsupportedFieldBlockers(
    blockers,
    value,
    STORE_CAPABILITY_FIELDS,
    'store_capability_unsupported_field',
    'store',
  );

  const kind = value.kind;
  if (!isStoreCapabilityKind(kind)) {
    invalid = true;
    blockers.push(blocker('store_capability_field_invalid', 'Credential store capability kind must be an allowed opaque-reference kind.', 'store.kind'));
  }

  const storageOwner = value.storageOwner;
  if (!isStoreStorageOwner(storageOwner)) {
    invalid = true;
    blockers.push(blocker('store_capability_field_invalid', 'Credential store capability storageOwner must be an allowed owner value.', 'store.storageOwner'));
  }

  const reviewState = value.reviewState;
  if (!isStoreReviewState(reviewState)) {
    invalid = true;
    blockers.push(blocker('store_capability_field_invalid', 'Credential store capability reviewState must be reviewed, draft, or unreviewed.', 'store.reviewState'));
  }

  const supportsOpaqueHandle = value.supportsOpaqueHandle;
  if (typeof supportsOpaqueHandle !== 'boolean') {
    invalid = true;
    blockers.push(blocker('store_capability_field_invalid', 'Credential store capability supportsOpaqueHandle must be a boolean.', 'store.supportsOpaqueHandle'));
  }

  if (value.usesBrowserSecretStorage !== false) {
    invalid = true;
    blockers.push(blocker('browser_secret_storage_requested', 'Browser localStorage or IndexedDB must not be used for secret material.', 'store.usesBrowserSecretStorage'));
  }
  if (value.persistsRawSecretMaterial !== false) {
    invalid = true;
    blockers.push(blocker('raw_secret_persistence_requested', 'This planner does not persist raw credential material.', 'store.persistsRawSecretMaterial'));
  }
  if (value.callsProviderApis !== false) {
    invalid = true;
    blockers.push(blocker('provider_api_call_requested', 'This planner does not call provider APIs or execute OAuth flows.', 'store.callsProviderApis'));
  }

  const providerId = normalizeGenericMetadataIdentifier(
    value.providerId,
    'store.providerId',
    blockers,
    'store_capability_field_invalid',
  );
  if (value.providerId !== undefined && providerId === undefined) invalid = true;

  const connectorId = normalizeGenericMetadataIdentifier(
    value.connectorId,
    'store.connectorId',
    blockers,
    'store_capability_field_invalid',
  );
  if (value.connectorId !== undefined && connectorId === undefined) invalid = true;

  if (
    !invalid
    && isStoreCapabilityKind(kind)
    && isStoreStorageOwner(storageOwner)
    && !storageOwnerMatchesKind(kind, storageOwner)
  ) {
    invalid = true;
  }

  if (invalid || !isStoreCapabilityKind(kind) || !isStoreStorageOwner(storageOwner) || !isStoreReviewState(reviewState) || typeof supportsOpaqueHandle !== 'boolean') {
    blockers.push(blocker('store_capability_invalid', 'Credential store capability failed the local boundary contract.', 'store'));
    return undefined;
  }

  return {
    kind,
    storageOwner,
    reviewState,
    supportsOpaqueHandle,
    providerId,
    connectorId,
  };
}

export function planConnectorCredentialStoreHandleReference(
  input: ConnectorCredentialStoreHandlePlannerInput,
): ConnectorCredentialStoreHandlePlan {
  const blockers: ConnectorCredentialStorePlannerBlocker[] = [];
  let handleReference: ConnectorCredentialReference | undefined;

  if (!isRuntimeTrustedContractObject(input)) {
    blockers.push(blocker(
      'input_invalid',
      'Credential store planner input must be built by the runtime trusted contract object boundary before validation.',
      'input',
    ));
    return Object.freeze({
      status: 'blocked',
      mayReferenceHandle: false,
      mayStoreSecretMaterial: false,
      mayResolveSecretMaterial: false,
      executableCredentialStorage: false,
      executableCredentialResolution: false,
      feasibilityDirective: 'opaque-handle-reference-only-no-secret-storage-or-resolution',
      handleReference: undefined,
      storageDirective: 'do-not-persist-secret-material',
      resolutionDirective: 'do-not-resolve-secret-material',
      sideEffectBoundary: 'plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-api-no-secret-resolution-no-secret-persistence',
      blockers: Object.freeze(blockers),
    });
  }

  const inputSnapshot = snapshotBoundaryValue(input);
  const safeInput = inputSnapshot.value;

  if (inputSnapshot.unsafeAccess) {
    blockers.push(blocker(
      'input_invalid',
      'Credential store planner input must use enumerable data properties only; accessors, symbols, non-plain objects, and unsafe descriptors are rejected before validation.',
      'input',
    ));
  }

  const inputRecord = isRecord(safeInput) ? safeInput : undefined;
  if (!inputRecord) {
    blockers.push(blocker('input_invalid', 'Credential store planner input must be an object with exact allowed metadata fields.', 'input'));
  } else {
    addUnsupportedFieldBlockers(
      blockers,
      inputRecord,
      PLANNER_INPUT_FIELDS,
      'input_unsupported_field',
      'input',
    );
  }

  if (hasConnectorSecretMaterial(safeInput)) {
    blockers.push(blocker(
      'raw_secret_material',
      'Credential store planning accepts only opaque handle metadata, never raw tokens, passwords, API keys, OAuth codes, or provider secrets.',
      'input',
    ));
  }

  const providerId = inputRecord
    ? normalizeGenericMetadataIdentifier(inputRecord.providerId, 'providerId', blockers, 'input_field_invalid')
    : undefined;
  const connectorId = inputRecord
    ? normalizeGenericMetadataIdentifier(inputRecord.connectorId, 'connectorId', blockers, 'input_field_invalid')
    : undefined;
  const accountId = inputRecord
    ? normalizeGenericMetadataIdentifier(inputRecord.accountId, 'accountId', blockers, 'input_field_invalid')
    : undefined;

  const store = inputRecord?.store;
  let normalizedStore: NormalizedConnectorCredentialStoreCapability | undefined;
  if (!store) {
    blockers.push(blocker('store_capability_missing', 'A reviewed credential store capability fact is required.', 'store'));
  } else {
    normalizedStore = normalizeCredentialStoreCapability(store, blockers);
    if (normalizedStore && normalizedStore.reviewState !== 'reviewed') {
      blockers.push(blocker('store_not_reviewed', 'Future connectors may reference handles only after credential store review.', 'store.reviewState'));
    }
    if (normalizedStore && !normalizedStore.supportsOpaqueHandle) {
      blockers.push(blocker('opaque_handle_unsupported', 'Credential store capability must support opaque external handles.', 'store.supportsOpaqueHandle'));
    }
  }

  const handle = inputRecord?.handle;
  if (handle === undefined || handle === null) {
    blockers.push(blocker('handle_missing', 'An opaque credential handle reference is required.', 'handle'));
  } else {
    addForbiddenHandleFieldBlockers(blockers, handle);
    const handleIdRejectedForUrl = isRecord(handle)
      && typeof handle.id === 'string'
      && handleIdLooksSecretBearingUrl(handle.id);
    if (handleIdRejectedForUrl) {
      blockers.push(blocker(
        'raw_secret_material',
        'Opaque credential handles must not be raw webhook URLs or token-bearing provider URLs.',
        'handle.id',
      ));
    }
    const validation = validateConnectorCredentialReference(handle);
    if (!validation.ok) {
      blockers.push(blocker(
        'handle_invalid',
        `Opaque credential handle rejected by connector credential boundary: ${validation.reason}.`,
        safeHandleValidationField(validation.field),
        validation.reason,
      ));
    } else {
      if (handleIdRejectedForUrl) {
        blockers.push(blocker(
          'handle_invalid',
          'Opaque credential handle id must be a non-URL reference identifier.',
          'handle.id',
          'invalid_identifier',
        ));
      } else {
        handleReference = validation.reference;
      }
      if (normalizedStore) {
        if (handleReference && handleReference.kind !== normalizedStore.kind) {
          blockers.push(blocker('handle_kind_mismatch', 'Handle kind must match the reviewed credential store capability.', 'handle.kind'));
        }
        if (handleReference && handleReference.storageOwner !== normalizedStore.storageOwner) {
          blockers.push(blocker('handle_storage_owner_mismatch', 'Handle storageOwner must match the reviewed credential store capability.', 'handle.storageOwner'));
        }
        if (handleReference && !matchesOptionalFact(normalizedStore.providerId, handleReference.providerId)) {
          blockers.push(blocker('handle_provider_mismatch', 'Handle providerId must match the credential store capability providerId.', 'handle.providerId'));
        }
        if (handleReference && !matchesOptionalFact(normalizedStore.connectorId, handleReference.connectorId)) {
          blockers.push(blocker('handle_connector_mismatch', 'Handle connectorId must match the credential store capability connectorId.', 'handle.connectorId'));
        }
      }
      if (handleReference && !matchesOptionalFact(providerId, handleReference.providerId)) {
        blockers.push(blocker('handle_provider_mismatch', 'Handle providerId must match the requested connector providerId.', 'handle.providerId'));
      }
      if (handleReference && !matchesOptionalFact(connectorId, handleReference.connectorId)) {
        blockers.push(blocker('handle_connector_mismatch', 'Handle connectorId must match the requested connectorId.', 'handle.connectorId'));
      }
      if (handleReference && !matchesOptionalFact(accountId, handleReference.accountId)) {
        blockers.push(blocker('handle_account_mismatch', 'Handle accountId must match the requested accountId.', 'handle.accountId'));
      }
    }
  }

  const status = blockers.length === 0 ? 'reference-ready' : 'blocked';
  return Object.freeze({
    status,
    mayReferenceHandle: status === 'reference-ready',
    mayStoreSecretMaterial: false,
    mayResolveSecretMaterial: false,
    executableCredentialStorage: false,
    executableCredentialResolution: false,
    feasibilityDirective: 'opaque-handle-reference-only-no-secret-storage-or-resolution',
    handleReference: status === 'reference-ready' && handleReference ? freezeCredentialReference(handleReference) : undefined,
    storageDirective: 'do-not-persist-secret-material',
    resolutionDirective: 'do-not-resolve-secret-material',
    sideEffectBoundary: 'plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-api-no-secret-resolution-no-secret-persistence',
    blockers: Object.freeze(blockers),
  });
}
