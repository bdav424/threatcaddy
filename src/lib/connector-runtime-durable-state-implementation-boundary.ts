import {
  CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS,
  type ConnectorRuntimePersistenceImplementationBoundaryDecision,
  type ConnectorRuntimePersistenceImplementationRequirement,
  type ConnectorRuntimePersistenceImplementationSection,
} from './connector-runtime-persistence-implementation-boundary';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type ConnectorRuntimeDurableStateImplementationBoundaryStatus =
  | 'implementation-boundary-ready'
  | 'blocked';

export type ConnectorRuntimeDurableStateImplementationBoundaryReason =
  | 'durable_state_implementation_boundary_ready'
  | 'input_shape_forbidden'
  | 'unsafe_input_field'
  | 'implementation_boundary_missing'
  | 'implementation_boundary_not_ready'
  | 'implementation_boundary_invalid'
  | 'implementation_request_missing'
  | 'implementation_request_invalid'
  | 'implementation_owner_mismatch'
  | 'implementation_sections_incomplete'
  | 'future_write_set_invalid'
  | 'storage_adapter_forbidden'
  | 'implementation_result_forbidden'
  | 'implementation_result_live_claim'
  | 'raw_secret_material';

export interface ConnectorRuntimeDurableStateImplementationRequest {
  contract: 'connector-runtime-durable-state-implementation-request-v1';
  implementationOwner: 'assistantcaddy-connector-runtime-durable-state';
  implementationId: 'assistantcaddy-connector-runtime-durable-state-boundary';
  implementationVersion: string;
  providerId: string;
  connectorId: string;
  targetSurface?: string;
  sourceBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1';
  sourceBoundaryStorageDirective: 'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import';
  sections: readonly ConnectorRuntimePersistenceImplementationSection[];
  futureWriteSet: readonly string[];
  reviewedEvidenceCount: number;
  requirementCount: number;
  acknowledgedSchemaEvidence: true;
  acknowledgedTypeEvidence: true;
  acknowledgedBackupEvidence: true;
  acknowledgedExportEvidence: true;
  acknowledgedImportEvidence: true;
  acknowledgedRestoreEvidence: true;
  acknowledgedSyncEvidence: true;
  acknowledgedCascadeEvidence: true;
  acknowledgedRedactionEvidence: true;
  acknowledgedRollbackEvidence: true;
  acknowledgedNoStorage: true;
  acknowledgedNoSchemaChange: true;
  acknowledgedNoExportImportMutation: true;
  acknowledgedNoGeneratedArtifacts: true;
  acknowledgedNoStandalonePromotion: true;
  acknowledgedNoProviderCalls: true;
  headChatReviewedSchemaExportImplementationContract: false;
  readyForImplementation: false;
  implementationMode: 'boundary-only';
  sideEffectBoundary: 'durable-state-implementation-request-only-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials';
}

export interface ConnectorRuntimeDurableStateImplementationBoundaryInput {
  implementationBoundary?: ConnectorRuntimePersistenceImplementationBoundaryDecision | null;
  implementationRequest?: unknown;
  storageAdapter?: unknown;
  implementationResult?: unknown;
}

export interface ConnectorRuntimeDurableStateImplementationBoundaryMetadata {
  schemaVersion: 1;
  contract: 'connector-runtime-durable-state-implementation-boundary-v1';
  implementationOwner?: 'assistantcaddy-connector-runtime-durable-state';
  implementationId?: 'assistantcaddy-connector-runtime-durable-state-boundary';
  implementationVersion?: string;
  providerId?: string;
  connectorId?: string;
  targetSurface?: string;
  sourceBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1';
  sourceBoundaryStorageDirective: 'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import';
  sections: readonly ConnectorRuntimePersistenceImplementationSection[];
  futureWriteSet: readonly string[];
  reviewedEvidenceCount: number;
  requirementCount: number;
  headChatReviewedSchemaExportImplementationContract: false;
  readyForImplementation: false;
  implementationMode: 'boundary-only';
}

export interface ConnectorRuntimeDurableStateImplementationBoundaryDecision {
  status: ConnectorRuntimeDurableStateImplementationBoundaryStatus;
  boundaryReady: boolean;
  reason: ConnectorRuntimeDurableStateImplementationBoundaryReason;
  metadata: ConnectorRuntimeDurableStateImplementationBoundaryMetadata;
  canPrepareFutureDurableStateImplementationPackage: boolean;
  readyForDurableStateImplementation: false;
  mayPersistRuntimeState: false;
  mayCreateDexieSchema: false;
  mayBackupOrExportRuntimeState: false;
  mayImportOrRestoreRuntimeState: false;
  maySyncRuntimeState: false;
  willOpenStorageAdapter: false;
  willReadStorage: false;
  willWriteStorage: false;
  willGenerateArtifacts: false;
  willPromoteStandalone: false;
  willCallProvider: false;
  sideEffects: 'none';
  storageDirective: 'boundary-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import';
  implementationDirective: 'future-head-chat-reviewed-schema-export-contract-required';
  sideEffectBoundary: 'connector-runtime-durable-state-implementation-boundary-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials';
}

const IMPLEMENTATION_BOUNDARY =
  'implementation-checklist-only-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials' as const;
const IMPLEMENTATION_STORAGE_DIRECTIVE =
  'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import' as const;
const REQUEST_BOUNDARY =
  'durable-state-implementation-request-only-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials' as const;
const DECISION_BOUNDARY =
  'connector-runtime-durable-state-implementation-boundary-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials' as const;
const DECISION_STORAGE_DIRECTIVE =
  'boundary-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import' as const;
const IMPLEMENTATION_DIRECTIVE =
  'future-head-chat-reviewed-schema-export-contract-required' as const;
const IMPLEMENTATION_OWNER = 'assistantcaddy-connector-runtime-durable-state' as const;
const IMPLEMENTATION_ID = 'assistantcaddy-connector-runtime-durable-state-boundary' as const;
const MAX_IDENTIFIER_LENGTH = 180;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const URL_LIKE_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const SECRET_VALUE_PATTERNS = [
  /^xox[a-z0-9]*-[a-z0-9-]{8,}$/i,
  /^gh[pousr]_[a-z0-9_]{8,}$/i,
  /^github_pat_[a-z0-9_]{8,}$/i,
  /^(?:AKIA|ASIA)[a-z0-9]{8,}$/i,
  /^(?:sk|pk|rk)-[a-z0-9_-]{8,}$/i,
  /^eyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}$/i,
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /basic\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:api|app|bot|client|refresh|access|session)[_-]?(?:key|token|secret)\s*[:=]\s*\S+/i,
  /(?:oauth|authorization)[\s_-]?code\s*[:=]\s*\S+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/i,
] as const;
const SECRET_KEY_MARKERS = [
  'accesstoken',
  'apikey',
  'apitoken',
  'authorization',
  'bearer',
  'clientsecret',
  'key',
  'password',
  'refreshtoken',
  'secret',
  'session',
  'token',
] as const;
const REQUEST_KEYS = new Set([
  'acknowledgedBackupEvidence',
  'acknowledgedCascadeEvidence',
  'acknowledgedExportEvidence',
  'acknowledgedImportEvidence',
  'acknowledgedNoExportImportMutation',
  'acknowledgedNoGeneratedArtifacts',
  'acknowledgedNoProviderCalls',
  'acknowledgedNoSchemaChange',
  'acknowledgedNoStandalonePromotion',
  'acknowledgedNoStorage',
  'acknowledgedRedactionEvidence',
  'acknowledgedRestoreEvidence',
  'acknowledgedRollbackEvidence',
  'acknowledgedSchemaEvidence',
  'acknowledgedSyncEvidence',
  'acknowledgedTypeEvidence',
  'connectorId',
  'contract',
  'futureWriteSet',
  'headChatReviewedSchemaExportImplementationContract',
  'implementationId',
  'implementationMode',
  'implementationOwner',
  'implementationVersion',
  'providerId',
  'readyForImplementation',
  'requirementCount',
  'reviewedEvidenceCount',
  'sections',
  'sideEffectBoundary',
  'sourceBoundaryContract',
  'sourceBoundaryStorageDirective',
  'targetSurface',
]);
const INPUT_KEYS = new Set([
  'implementationBoundary',
  'implementationRequest',
  'implementationResult',
  'storageAdapter',
]);
const UNSAFE_INPUT_FIELD_MARKERS = [
  'backup',
  'callback',
  'dexie',
  'eventsource',
  'export',
  'fetch',
  'import',
  'indexeddb',
  'localstorage',
  'migration',
  'provider',
  'requester',
  'restore',
  'schema',
  'socket',
  'storage',
  'sync',
  'transport',
  'websocket',
] as const;
const DISALLOWED_FUTURE_WRITE_PATTERNS = [
  /(^|\/)dist($|\/)/,
  /(^|\/)dist-single($|\/)/,
  /(^|\/)docs($|\/)/,
  /(^|\/)node_modules($|\/)/,
  /(^|\/)package\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)public($|\/)/,
  /(^|\/)threatcaddy-standalone\.html$/,
  /\.html$/i,
  /standalone/i,
] as const;

export const CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS = Object.freeze(
  CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.map((requirement) => requirement.section),
) as readonly ConnectorRuntimePersistenceImplementationSection[];

export const CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES = Object.freeze(
  [...new Set(CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.flatMap((requirement) => requirement.requiredFiles))].sort(),
) as readonly string[];

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringLooksSecretBearing(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function safeIdentifier(value: unknown): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) return undefined;
  if (
    normalized.length > MAX_IDENTIFIER_LENGTH
    || !SAFE_ID_PATTERN.test(normalized)
    || URL_LIKE_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(normalized))
    || stringLooksSecretBearing(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function unsafeIdentifier(value: unknown): boolean {
  return value !== undefined && safeIdentifier(value) === undefined;
}

function valueHasSecretMaterial(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return stringLooksSecretBearing(value);
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasSecretMaterial(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (valueHasSecretMaterial(key, seen) || valueHasSecretMaterial(nestedValue, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasSecretMaterial(nestedValue, seen)) return true;
    }
    return false;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (SECRET_KEY_MARKERS.some((marker) => normalizedKey === marker || normalizedKey.endsWith(marker))) {
      return true;
    }
    if (valueHasSecretMaterial(nestedValue, seen)) return true;
  }
  return false;
}

function metadataValuesHaveSecretMaterial(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return stringLooksSecretBearing(value);
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => metadataValuesHaveSecretMaterial(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (metadataValuesHaveSecretMaterial(key, seen) || metadataValuesHaveSecretMaterial(nestedValue, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (metadataValuesHaveSecretMaterial(nestedValue, seen)) return true;
    }
    return false;
  }

  return Object.values(value).some((nestedValue) => metadataValuesHaveSecretMaterial(nestedValue, seen));
}

function hasOnlyAllowedKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => REQUEST_KEYS.has(key));
}

function hasOnlyInputKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => INPUT_KEYS.has(key));
}

function objectHasUnsafeInputField(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => {
    if (INPUT_KEYS.has(key)) return false;
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    return UNSAFE_INPUT_FIELD_MARKERS.some((marker) => normalized.includes(marker));
  });
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function expectedFutureWriteSet(
  requirements: readonly ConnectorRuntimePersistenceImplementationRequirement[] =
    CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS,
): readonly string[] {
  return Object.freeze([...new Set(requirements.flatMap((requirement) => requirement.requiredFiles))].sort());
}

function isSafeFuturePath(value: unknown): value is string {
  const normalized = normalizedString(value);
  if (!normalized) return false;
  if (normalized.startsWith('/') || normalized.includes('..') || normalized.includes('\\')) return false;
  if (!SAFE_ID_PATTERN.test(normalized)) return false;
  if (stringLooksSecretBearing(normalized)) return false;
  return !DISALLOWED_FUTURE_WRITE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sectionListIsComplete(value: readonly unknown[]): value is readonly ConnectorRuntimePersistenceImplementationSection[] {
  if (value.length !== CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS.length) return false;
  return CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS.every((section, index) => value[index] === section);
}

function implementationBoundaryIsReady(
  decision: ConnectorRuntimePersistenceImplementationBoundaryDecision,
): boolean {
  const metadata = decision.metadata;
  return decision.status === 'implementation-checklist-ready'
    && decision.readyForDurableRuntimeImplementation === true
    && decision.mayPersistRuntimeState === false
    && decision.mayCreateDexieSchema === false
    && decision.mayBackupOrExportRuntimeState === false
    && decision.mayImportOrRestoreRuntimeState === false
    && decision.maySyncRuntimeState === false
    && decision.sideEffects === 'none'
    && decision.sideEffectBoundary === IMPLEMENTATION_BOUNDARY
    && decision.storageDirective === IMPLEMENTATION_STORAGE_DIRECTIVE
    && Array.isArray(decision.blockers)
    && decision.blockers.length === 0
    && metadata.contract === 'connector-runtime-persistence-implementation-boundary-v1'
    && safeIdentifier(metadata.providerId) !== undefined
    && safeIdentifier(metadata.connectorId) !== undefined
    && (metadata.targetSurface === undefined || safeIdentifier(metadata.targetSurface) !== undefined)
    && metadata.requirementCount === CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length
    && metadata.evidenceDescriptorCount === metadata.requirementCount
    && metadata.reviewedEvidenceCount === metadata.requirementCount
    && metadata.missingSectionCount === 0
    && Array.isArray(metadata.missingSections)
    && metadata.missingSections.length === 0
    && Array.isArray(metadata.sections)
    && sectionListIsComplete(metadata.sections)
    && Array.isArray(metadata.requirements)
    && metadata.requirements.length === CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length
    && sameStringList(expectedFutureWriteSet(metadata.requirements), CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES);
}

function parseImplementationRequest(value: unknown): ConnectorRuntimeDurableStateImplementationRequest | undefined {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value)) return undefined;

  const providerId = safeIdentifier(value.providerId);
  const connectorId = safeIdentifier(value.connectorId);
  const targetSurface = value.targetSurface === undefined ? undefined : safeIdentifier(value.targetSurface);
  const implementationVersion = safeIdentifier(value.implementationVersion);

  if (
    value.contract !== 'connector-runtime-durable-state-implementation-request-v1'
    || value.implementationOwner !== IMPLEMENTATION_OWNER
    || value.implementationId !== IMPLEMENTATION_ID
    || !implementationVersion
    || !providerId
    || !connectorId
    || (value.targetSurface !== undefined && !targetSurface)
    || value.sourceBoundaryContract !== 'connector-runtime-persistence-implementation-boundary-v1'
    || value.sourceBoundaryStorageDirective !== IMPLEMENTATION_STORAGE_DIRECTIVE
    || !Array.isArray(value.sections)
    || !sectionListIsComplete(value.sections)
    || !Array.isArray(value.futureWriteSet)
    || !value.futureWriteSet.every(isSafeFuturePath)
    || !sameStringList([...value.futureWriteSet].sort(), CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES)
    || value.reviewedEvidenceCount !== CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length
    || value.requirementCount !== CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length
    || value.acknowledgedSchemaEvidence !== true
    || value.acknowledgedTypeEvidence !== true
    || value.acknowledgedBackupEvidence !== true
    || value.acknowledgedExportEvidence !== true
    || value.acknowledgedImportEvidence !== true
    || value.acknowledgedRestoreEvidence !== true
    || value.acknowledgedSyncEvidence !== true
    || value.acknowledgedCascadeEvidence !== true
    || value.acknowledgedRedactionEvidence !== true
    || value.acknowledgedRollbackEvidence !== true
    || value.acknowledgedNoStorage !== true
    || value.acknowledgedNoSchemaChange !== true
    || value.acknowledgedNoExportImportMutation !== true
    || value.acknowledgedNoGeneratedArtifacts !== true
    || value.acknowledgedNoStandalonePromotion !== true
    || value.acknowledgedNoProviderCalls !== true
    || value.headChatReviewedSchemaExportImplementationContract !== false
    || value.readyForImplementation !== false
    || value.implementationMode !== 'boundary-only'
    || value.sideEffectBoundary !== REQUEST_BOUNDARY
  ) {
    return undefined;
  }

  return Object.freeze({
    contract: 'connector-runtime-durable-state-implementation-request-v1',
    implementationOwner: IMPLEMENTATION_OWNER,
    implementationId: IMPLEMENTATION_ID,
    implementationVersion,
    providerId,
    connectorId,
    ...(targetSurface ? { targetSurface } : {}),
    sourceBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1',
    sourceBoundaryStorageDirective: IMPLEMENTATION_STORAGE_DIRECTIVE,
    sections: Object.freeze([...value.sections]),
    futureWriteSet: Object.freeze([...value.futureWriteSet].sort()),
    reviewedEvidenceCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
    requirementCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
    acknowledgedSchemaEvidence: true,
    acknowledgedTypeEvidence: true,
    acknowledgedBackupEvidence: true,
    acknowledgedExportEvidence: true,
    acknowledgedImportEvidence: true,
    acknowledgedRestoreEvidence: true,
    acknowledgedSyncEvidence: true,
    acknowledgedCascadeEvidence: true,
    acknowledgedRedactionEvidence: true,
    acknowledgedRollbackEvidence: true,
    acknowledgedNoStorage: true,
    acknowledgedNoSchemaChange: true,
    acknowledgedNoExportImportMutation: true,
    acknowledgedNoGeneratedArtifacts: true,
    acknowledgedNoStandalonePromotion: true,
    acknowledgedNoProviderCalls: true,
    headChatReviewedSchemaExportImplementationContract: false,
    readyForImplementation: false,
    implementationMode: 'boundary-only',
    sideEffectBoundary: REQUEST_BOUNDARY,
  });
}

function ownerMatchesBoundary(
  boundary: ConnectorRuntimePersistenceImplementationBoundaryDecision,
  request: ConnectorRuntimeDurableStateImplementationRequest,
): boolean {
  return request.providerId === boundary.metadata.providerId
    && request.connectorId === boundary.metadata.connectorId
    && request.targetSurface === boundary.metadata.targetSurface;
}

function sectionsMatchBoundary(
  boundary: ConnectorRuntimePersistenceImplementationBoundaryDecision,
  request: ConnectorRuntimeDurableStateImplementationRequest,
): boolean {
  return sameStringList(request.sections, boundary.metadata.sections);
}

function futureWriteSetMatchesBoundary(
  boundary: ConnectorRuntimePersistenceImplementationBoundaryDecision,
  request: ConnectorRuntimeDurableStateImplementationRequest,
): boolean {
  return sameStringList(request.futureWriteSet, expectedFutureWriteSet(boundary.metadata.requirements));
}

function storageAdapterShapeForbidden(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value === 'function') return true;
  if (!isRecord(value)) return true;
  const forbiddenKeys = [
    'add',
    'bulkPut',
    'dexie',
    'export',
    'get',
    'indexeddb',
    'import',
    'localstorage',
    'migrate',
    'open',
    'put',
    'restore',
    'schema',
    'set',
    'storage',
    'sync',
    'table',
    'transaction',
    'write',
  ];
  return Object.entries(value).some(([key, nestedValue]) => {
    const normalized = key.toLowerCase();
    if (forbiddenKeys.some((forbidden) => normalized.includes(forbidden))) return true;
    if (typeof nestedValue === 'function') return true;
    if (isRecord(nestedValue)) return storageAdapterShapeForbidden(nestedValue);
    return false;
  });
}

function implementationResultClaimsLiveExecution(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return value.executed === true
    || value.persisted === true
    || value.schemaChanged === true
    || value.exported === true
    || value.imported === true
    || value.restored === true
    || value.synced === true
    || value.generatedArtifacts === true
    || value.promotedStandalone === true
    || value.willWriteStorage === true
    || value.willGenerateArtifacts === true
    || value.willPromoteStandalone === true
    || value.readyForImplementation === true
    || value.readyForDurableStateImplementation === true;
}

function freezeMetadata(
  request?: ConnectorRuntimeDurableStateImplementationRequest,
): ConnectorRuntimeDurableStateImplementationBoundaryMetadata {
  return Object.freeze({
    schemaVersion: 1,
    contract: 'connector-runtime-durable-state-implementation-boundary-v1',
    implementationOwner: request?.implementationOwner,
    implementationId: request?.implementationId,
    implementationVersion: safeIdentifier(request?.implementationVersion),
    providerId: safeIdentifier(request?.providerId),
    connectorId: safeIdentifier(request?.connectorId),
    targetSurface: safeIdentifier(request?.targetSurface),
    sourceBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1',
    sourceBoundaryStorageDirective: IMPLEMENTATION_STORAGE_DIRECTIVE,
    sections: Object.freeze([...(request?.sections ?? [])]),
    futureWriteSet: Object.freeze([...(request?.futureWriteSet ?? [])]),
    reviewedEvidenceCount: request?.reviewedEvidenceCount ?? 0,
    requirementCount: request?.requirementCount ?? CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
    headChatReviewedSchemaExportImplementationContract: false,
    readyForImplementation: false,
    implementationMode: 'boundary-only',
  });
}

function freezeDecision(
  reason: ConnectorRuntimeDurableStateImplementationBoundaryReason,
  request?: ConnectorRuntimeDurableStateImplementationRequest,
): Readonly<ConnectorRuntimeDurableStateImplementationBoundaryDecision> {
  const ready = reason === 'durable_state_implementation_boundary_ready' && request !== undefined;
  return Object.freeze({
    status: ready ? 'implementation-boundary-ready' : 'blocked',
    boundaryReady: ready,
    reason,
    metadata: freezeMetadata(request),
    canPrepareFutureDurableStateImplementationPackage: ready,
    readyForDurableStateImplementation: false,
    mayPersistRuntimeState: false,
    mayCreateDexieSchema: false,
    mayBackupOrExportRuntimeState: false,
    mayImportOrRestoreRuntimeState: false,
    maySyncRuntimeState: false,
    willOpenStorageAdapter: false,
    willReadStorage: false,
    willWriteStorage: false,
    willGenerateArtifacts: false,
    willPromoteStandalone: false,
    willCallProvider: false,
    sideEffects: 'none',
    storageDirective: DECISION_STORAGE_DIRECTIVE,
    implementationDirective: IMPLEMENTATION_DIRECTIVE,
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}

function requestIdentifiersAreSafe(request: ConnectorRuntimeDurableStateImplementationRequest): boolean {
  return ![
    request.implementationVersion,
    request.providerId,
    request.connectorId,
    request.targetSurface,
  ].some(unsafeIdentifier);
}

export function evaluateConnectorRuntimeDurableStateImplementationBoundary(
  input: ConnectorRuntimeDurableStateImplementationBoundaryInput = {},
): Readonly<ConnectorRuntimeDurableStateImplementationBoundaryDecision> {
  if (!isRuntimeTrustedContractObject(input)) return freezeDecision('input_shape_forbidden');
  const trustedInput = input as ConnectorRuntimeDurableStateImplementationBoundaryInput & Record<string, unknown>;

  if (objectHasUnsafeInputField(trustedInput)) return freezeDecision('unsafe_input_field');
  if (!hasOnlyInputKeys(trustedInput)) return freezeDecision('input_shape_forbidden');

  if (
    metadataValuesHaveSecretMaterial(trustedInput.implementationRequest)
    || valueHasSecretMaterial(trustedInput.storageAdapter)
    || valueHasSecretMaterial(trustedInput.implementationResult)
  ) {
    return freezeDecision('raw_secret_material');
  }
  if (trustedInput.storageAdapter !== undefined) {
    return freezeDecision(
      storageAdapterShapeForbidden(trustedInput.storageAdapter) ? 'storage_adapter_forbidden' : 'implementation_request_invalid',
    );
  }
  if (trustedInput.implementationResult !== undefined) {
    return freezeDecision(
      implementationResultClaimsLiveExecution(trustedInput.implementationResult)
        ? 'implementation_result_live_claim'
        : 'implementation_result_forbidden',
    );
  }

  const implementationBoundary = trustedInput.implementationBoundary;
  if (!implementationBoundary) return freezeDecision('implementation_boundary_missing');
  if (!isRecord(implementationBoundary)) return freezeDecision('implementation_boundary_invalid');
  if (implementationBoundary.status !== 'implementation-checklist-ready') {
    return freezeDecision('implementation_boundary_not_ready');
  }
  if (!implementationBoundaryIsReady(implementationBoundary)) {
    return freezeDecision('implementation_boundary_invalid');
  }

  if (!trustedInput.implementationRequest) return freezeDecision('implementation_request_missing');
  const request = parseImplementationRequest(trustedInput.implementationRequest);
  if (!request || !requestIdentifiersAreSafe(request)) return freezeDecision('implementation_request_invalid');
  if (!ownerMatchesBoundary(implementationBoundary, request)) return freezeDecision('implementation_owner_mismatch', request);
  if (!sectionsMatchBoundary(implementationBoundary, request)) return freezeDecision('implementation_sections_incomplete', request);
  if (!futureWriteSetMatchesBoundary(implementationBoundary, request)) return freezeDecision('future_write_set_invalid', request);

  return freezeDecision('durable_state_implementation_boundary_ready', request);
}
