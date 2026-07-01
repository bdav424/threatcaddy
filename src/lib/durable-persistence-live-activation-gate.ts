import { isSecretLikeFieldName } from './connector-credential-boundary';
import {
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_CHECKPOINT_REQUIREMENTS,
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER,
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN,
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_ROLLBACK_REQUIREMENTS,
  type DurablePersistenceOperationsImplementationManifestDecision,
} from './durable-persistence-operations-implementation-manifest';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type DurablePersistenceLiveActivationGateStatus = 'ready' | 'blocked';

export type DurablePersistenceLiveActivationGateReason =
  | 'durable_persistence_live_activation_gate_ready'
  | 'operations_manifest_missing'
  | 'operations_manifest_not_ready'
  | 'operations_manifest_invalid'
  | 'activation_facts_missing'
  | 'activation_facts_invalid'
  | 'activation_owner_mismatch'
  | 'migration_plan_invalid'
  | 'rollback_checkpoint_proof_invalid'
  | 'secret_posture_invalid'
  | 'approval_posture_invalid'
  | 'storage_shape_forbidden'
  | 'schema_writer_forbidden'
  | 'operation_callback_forbidden'
  | 'runtime_shape_forbidden'
  | 'raw_secret_material';

export interface DurablePersistenceActivationFacts {
  contract: 'durable-persistence-live-activation-facts-v1';
  activationOwner: 'assistantcaddy-head-chat-durable-persistence-live-activation';
  activationId: 'assistantcaddy-durable-persistence-live-activation-gate';
  activationVersion: string;
  sourceManifestOwner: 'assistantcaddy-head-chat-durable-persistence-operations';
  sourceManifestId: 'assistantcaddy-head-chat-durable-persistence-operations-manifest';
  sourceManifestVersion: string;
  providerId?: string;
  connectorId?: string;
  targetSurface?: string;
  reviewedSchemaOwner: 'head-chat';
  reviewedExportImportBackupRestoreOwner: 'head-chat';
  schemaOwnershipReviewed: true;
  exportImportBackupRestoreOwnershipReviewed: true;
  migrationPlanId: string;
  migrationPlanReviewed: true;
  exportImpactPlanReviewed: true;
  importImpactPlanReviewed: true;
  backupImpactPlanReviewed: true;
  restoreImpactPlanReviewed: true;
  checkpointProofId: string;
  rollbackProofId: string;
  checkpointProofReviewed: true;
  rollbackProofReviewed: true;
  secretRedactionProofId: string;
  secretRedactionReviewed: true;
  noRawSecretGuarantee: true;
  noBackupLeakage: true;
  noExportLeakage: true;
  noImportPlaintextSecret: true;
  noSchemaRawSecretFields: true;
  reviewState: 'reviewed';
  sideEffects: 'none';
  sideEffectBoundary: 'durable-persistence-live-activation-facts-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials';
}

export interface DurablePersistenceActivationApproval {
  contract: 'durable-persistence-live-activation-approval-v1';
  approvalScope: 'durable-persistence-schema-export-import-backup-restore';
  userApprovalGranted: true;
  adminApprovalGranted: true;
  approverRole: 'workspace-admin';
  acknowledgedPlanOnly: true;
  acknowledgedCheckpointBeforeMigration: true;
  acknowledgedAdminApprovalBeforePersistence: true;
  acknowledgedNoRawSecrets: true;
  acknowledgedNoStorageActions: true;
  reviewState: 'approved';
}

export interface DurablePersistenceLiveActivationGateInput {
  operationsManifest?: DurablePersistenceOperationsImplementationManifestDecision | null;
  activationFacts?: unknown;
  approval?: unknown;
  storageAdapter?: unknown;
  storageResult?: unknown;
  schemaWriter?: unknown;
  db?: unknown;
  dexie?: unknown;
  exportCallback?: unknown;
  importCallback?: unknown;
  backupCallback?: unknown;
  restoreCallback?: unknown;
  requester?: unknown;
  fetch?: unknown;
  socket?: unknown;
  storage?: unknown;
  liveAction?: unknown;
  executable?: unknown;
}

export interface DurablePersistenceLiveActivationPlan {
  contract: 'durable-persistence-live-activation-plan-v1';
  activationOwner: 'assistantcaddy-head-chat-durable-persistence-live-activation';
  activationId: 'assistantcaddy-durable-persistence-live-activation-gate';
  activationVersion: string;
  sourceManifestOwner: 'assistantcaddy-head-chat-durable-persistence-operations';
  sourceManifestId: 'assistantcaddy-head-chat-durable-persistence-operations-manifest';
  sourceManifestVersion: string;
  providerId?: string;
  connectorId?: string;
  targetSurface?: string;
  reviewedSchemaOwner: 'head-chat';
  reviewedExportImportBackupRestoreOwner: 'head-chat';
  migrationPlanId: string;
  checkpointProofId: string;
  rollbackProofId: string;
  secretRedactionProofId: string;
  reviewedOperations: readonly string[];
  exactHighRiskWriteSet: readonly string[];
  requiresCheckpointBeforeMigration: true;
  requiresAdminApprovalBeforePersistence: true;
  requiresUserApprovalBeforePersistence: true;
  noRawSecretGuarantee: true;
  noBackupLeakage: true;
  noExportLeakage: true;
  noImportPlaintextSecret: true;
  noSchemaRawSecretFields: true;
  executable: false;
  sideEffects: 'none';
  storageActions: readonly [];
  schemaActions: readonly [];
  exportImportBackupRestoreActions: readonly [];
  sideEffectBoundary: 'durable-persistence-live-activation-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials';
}

export interface DurablePersistenceLiveActivationGateDecision {
  status: DurablePersistenceLiveActivationGateStatus;
  ready: boolean;
  reason: DurablePersistenceLiveActivationGateReason;
  plan?: DurablePersistenceLiveActivationPlan;
  canConsiderDurablePersistenceWork: boolean;
  readyForDurablePersistenceImplementation: false;
  requiresCheckpointBeforeMigration: true;
  requiresAdminApprovalBeforePersistence: true;
  requiresUserApprovalBeforePersistence: true;
  mayPersistRuntimeState: false;
  mayCreateDexieSchema: false;
  mayBackupOrExportRuntimeState: false;
  mayImportOrRestoreRuntimeState: false;
  maySyncRuntimeState: false;
  mayReadStorage: false;
  mayWriteStorage: false;
  mayOpenStorageAdapter: false;
  mayInvokeSchemaWriter: false;
  mayRunExportImportBackupRestore: false;
  mayFetch: false;
  mayOpenSocket: false;
  mayCallProvider: false;
  willGenerateArtifacts: false;
  willPromoteStandalone: false;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'durable-persistence-live-activation-gate-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials';
}

const SOURCE_MANIFEST_OWNER = 'assistantcaddy-head-chat-durable-persistence-operations' as const;
const SOURCE_MANIFEST_ID = 'assistantcaddy-head-chat-durable-persistence-operations-manifest' as const;
const SOURCE_MANIFEST_BOUNDARY =
  'durable-persistence-operations-implementation-manifest-no-fetch-no-socket-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials' as const;
const FACTS_BOUNDARY =
  'durable-persistence-live-activation-facts-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials' as const;
const PLAN_BOUNDARY =
  'durable-persistence-live-activation-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials' as const;
const DECISION_BOUNDARY =
  'durable-persistence-live-activation-gate-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials' as const;
const MAX_IDENTIFIER_LENGTH = 180;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const URL_LIKE_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const TOKEN_VALUE_PATTERNS = [
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
const ROOT_KEYS = new Set([
  'activationFacts',
  'approval',
  'backupCallback',
  'db',
  'dexie',
  'executable',
  'exportCallback',
  'fetch',
  'importCallback',
  'liveAction',
  'operationsManifest',
  'requester',
  'restoreCallback',
  'schemaWriter',
  'socket',
  'storage',
  'storageAdapter',
  'storageResult',
]);
const FACT_KEYS = new Set([
  'activationId',
  'activationOwner',
  'activationVersion',
  'backupImpactPlanReviewed',
  'checkpointProofId',
  'checkpointProofReviewed',
  'connectorId',
  'contract',
  'exportImpactPlanReviewed',
  'exportImportBackupRestoreOwnershipReviewed',
  'importImpactPlanReviewed',
  'migrationPlanId',
  'migrationPlanReviewed',
  'noBackupLeakage',
  'noExportLeakage',
  'noImportPlaintextSecret',
  'noRawSecretGuarantee',
  'noSchemaRawSecretFields',
  'providerId',
  'restoreImpactPlanReviewed',
  'reviewState',
  'reviewedExportImportBackupRestoreOwner',
  'reviewedSchemaOwner',
  'rollbackProofId',
  'rollbackProofReviewed',
  'schemaOwnershipReviewed',
  'secretRedactionProofId',
  'secretRedactionReviewed',
  'sideEffectBoundary',
  'sideEffects',
  'sourceManifestId',
  'sourceManifestOwner',
  'sourceManifestVersion',
  'targetSurface',
]);
const APPROVAL_KEYS = new Set([
  'acknowledgedAdminApprovalBeforePersistence',
  'acknowledgedCheckpointBeforeMigration',
  'acknowledgedNoRawSecrets',
  'acknowledgedNoStorageActions',
  'acknowledgedPlanOnly',
  'adminApprovalGranted',
  'approvalScope',
  'approverRole',
  'contract',
  'reviewState',
  'userApprovalGranted',
]);
const OPERATIONS_MANIFEST_DECISION_KEYS = new Set([
  'canPrepareHeadChatDurablePersistenceOperationsImplementation',
  'implementationDirective',
  'manifest',
  'manifestReady',
  'mayBackupOrExportRuntimeState',
  'mayCallProvider',
  'mayCreateDexieSchema',
  'mayFetch',
  'mayImportOrRestoreRuntimeState',
  'mayOpenSocket',
  'mayOpenStorageAdapter',
  'mayPersistRuntimeState',
  'mayReadStorage',
  'maySyncRuntimeState',
  'mayWriteStorage',
  'readyForDurablePersistenceOperationsImplementation',
  'reason',
  'sideEffectBoundary',
  'sideEffects',
  'status',
  'storageDirective',
  'willGenerateArtifacts',
  'willPromoteStandalone',
]);
const OPERATIONS_MANIFEST_KEYS = new Set([
  'blockedPathClasses',
  'checkpointRequired',
  'checkpointRequirements',
  'connectorId',
  'contract',
  'exactHighRiskWriteSet',
  'forbiddenPathRejectionRequired',
  'headChatReviewRequired',
  'implementationMode',
  'implementationOwner',
  'implementationScope',
  'manifestId',
  'manifestOwner',
  'manifestVersion',
  'operationOrder',
  'operationPlan',
  'operations',
  'ownerSourceBoundaryValidationRequired',
  'promotedFromDurableStateImplementationManifest',
  'providerId',
  'readyForImplementation',
  'rollbackRequired',
  'rollbackRequirements',
  'schemaVersion',
  'sourceImplementationId',
  'sourceImplementationOwner',
  'sourceManifestContract',
  'sourceManifestId',
  'sourceManifestOwner',
  'sourceManifestVersion',
  'targetSurface',
  'tokenShapedIdentifierBlockingRequired',
]);
const OPERATION_PLAN_ENTRY_KEYS = new Set([
  'checkpointRequired',
  'operation',
  'requiredFiles',
  'rollbackRequired',
]);
const STORAGE_MARKERS = ['db', 'dexie', 'indexeddb', 'localstorage', 'sessionstorage', 'storage', 'storageadapter', 'storageresult'] as const;
const SCHEMA_MARKERS = ['schemawriter', 'schemacallback', 'schemamigrator'] as const;
const OPERATION_CALLBACK_MARKERS = ['backupcallback', 'exportcallback', 'importcallback', 'restorecallback'] as const;
const RUNTIME_MARKERS = ['callback', 'execute', 'executable', 'fetch', 'liveaction', 'requester', 'socket', 'transport'] as const;
const SAFE_SECRET_POSTURE_KEYS = new Set([
  'acknowledgedNoRawSecrets',
  'noBackupLeakage',
  'noExportLeakage',
  'noImportPlaintextSecret',
  'noRawSecretGuarantee',
  'noSchemaRawSecretFields',
  'secretRedactionProofId',
  'secretRedactionReviewed',
]);
const SAFE_INERT_MARKER_KEYS = new Set([
  'acknowledgedNoStorageActions',
  'noBackupLeakage',
  'noExportLeakage',
  'noImportPlaintextSecret',
  'noRawSecretGuarantee',
  'noSchemaRawSecretFields',
  'sideEffectBoundary',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null || Object.isFrozen(value);
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function stringLooksSecretBearing(value: string): boolean {
  return TOKEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function safeIdentifier(value: unknown): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) return undefined;
  if (
    normalized.length > MAX_IDENTIFIER_LENGTH
    || !SAFE_IDENTIFIER_PATTERN.test(normalized)
    || URL_LIKE_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(normalized))
    || stringLooksSecretBearing(normalized)
    || isSecretLikeFieldName(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function valueHasAccessorDescriptor(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => valueHasAccessorDescriptor(item, seen));

  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return true;
  }

  return Object.values(descriptors).some((descriptor) => (
    !('value' in descriptor)
    || descriptor.get !== undefined
    || descriptor.set !== undefined
    || valueHasAccessorDescriptor(descriptor.value, seen)
  ));
}

function valueHasRawSecretMaterial(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return stringLooksSecretBearing(value);
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasRawSecretMaterial(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (
        (typeof key === 'string' && isSecretLikeFieldName(key) && !SAFE_SECRET_POSTURE_KEYS.has(key))
        || valueHasRawSecretMaterial(key, seen)
        || valueHasRawSecretMaterial(nestedValue, seen)
      ) {
        return true;
      }
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasRawSecretMaterial(nestedValue, seen)) return true;
    }
    return false;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSecretLikeFieldName(key) && !SAFE_SECRET_POSTURE_KEYS.has(key)) return true;
    if (valueHasRawSecretMaterial(nestedValue, seen)) return true;
  }
  return false;
}

function hasMarker(value: unknown, markers: readonly string[], seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (typeof value === 'string') return false;
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasMarker(item, markers, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (hasMarker(key, markers, seen) || hasMarker(nestedValue, markers, seen)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (hasMarker(nestedValue, markers, seen)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => (
    (!SAFE_INERT_MARKER_KEYS.has(key) && markers.some((marker) => normalizeKey(key).includes(marker)))
    || hasMarker(nestedValue, markers, seen)
  ));
}

function sameStringList(left: readonly unknown[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameSortedStringList(left: readonly string[], right: readonly string[]): boolean {
  return sameStringList([...left].sort(), [...right].sort());
}

function operationPlanMatchesExact(value: readonly unknown[]): boolean {
  return value.length === DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN.length
    && value.every((entry, index) => {
      const expected = DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN[index];
      return isRecord(entry)
        && hasOnlyKeys(entry, OPERATION_PLAN_ENTRY_KEYS)
        && entry.operation === expected.operation
        && entry.checkpointRequired === true
        && entry.rollbackRequired === true
        && Array.isArray(entry.requiredFiles)
        && sameStringList(entry.requiredFiles, expected.requiredFiles);
    });
}

function operationsManifestIsReady(decision: DurablePersistenceOperationsImplementationManifestDecision): boolean {
  const manifest = decision.manifest;
  return isRecord(decision)
    && hasOnlyKeys(decision, OPERATIONS_MANIFEST_DECISION_KEYS)
    && decision.status === 'operations-manifest-ready'
    && decision.manifestReady === true
    && decision.reason === 'operations_manifest_ready'
    && decision.canPrepareHeadChatDurablePersistenceOperationsImplementation === true
    && decision.readyForDurablePersistenceOperationsImplementation === false
    && decision.mayPersistRuntimeState === false
    && decision.mayCreateDexieSchema === false
    && decision.mayBackupOrExportRuntimeState === false
    && decision.mayImportOrRestoreRuntimeState === false
    && decision.maySyncRuntimeState === false
    && decision.mayOpenStorageAdapter === false
    && decision.mayReadStorage === false
    && decision.mayWriteStorage === false
    && decision.mayFetch === false
    && decision.mayOpenSocket === false
    && decision.mayCallProvider === false
    && decision.willGenerateArtifacts === false
    && decision.willPromoteStandalone === false
    && decision.sideEffects === 'none'
    && decision.sideEffectBoundary === SOURCE_MANIFEST_BOUNDARY
    && isRecord(manifest)
    && hasOnlyKeys(manifest, OPERATIONS_MANIFEST_KEYS)
    && manifest.contract === 'durable-persistence-operations-implementation-manifest-v1'
    && manifest.manifestOwner === SOURCE_MANIFEST_OWNER
    && manifest.manifestId === SOURCE_MANIFEST_ID
    && safeIdentifier(manifest.manifestVersion) !== undefined
    && manifest.implementationOwner === 'head-chat'
    && manifest.implementationScope === 'durable-persistence-schema-export-import-backup-restore-sync-operations'
    && manifest.checkpointRequired === true
    && manifest.rollbackRequired === true
    && manifest.ownerSourceBoundaryValidationRequired === true
    && manifest.forbiddenPathRejectionRequired === true
    && manifest.tokenShapedIdentifierBlockingRequired === true
    && manifest.readyForImplementation === false
    && manifest.implementationMode === 'manifest-only'
    && Array.isArray(manifest.operationOrder)
    && sameStringList(manifest.operationOrder, DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER)
    && Array.isArray(manifest.operations)
    && sameStringList(manifest.operations, DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER)
    && Array.isArray(manifest.exactHighRiskWriteSet)
    && sameSortedStringList(manifest.exactHighRiskWriteSet, DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET)
    && Array.isArray(manifest.checkpointRequirements)
    && sameStringList(manifest.checkpointRequirements, DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_CHECKPOINT_REQUIREMENTS)
    && Array.isArray(manifest.rollbackRequirements)
    && sameStringList(manifest.rollbackRequirements, DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_ROLLBACK_REQUIREMENTS)
    && Array.isArray(manifest.operationPlan)
    && operationPlanMatchesExact(manifest.operationPlan);
}

function parseActivationFacts(value: unknown): DurablePersistenceActivationFacts | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, FACT_KEYS)) return undefined;
  const activationVersion = safeIdentifier(value.activationVersion);
  const sourceManifestVersion = safeIdentifier(value.sourceManifestVersion);
  const providerId = value.providerId === undefined ? undefined : safeIdentifier(value.providerId);
  const connectorId = value.connectorId === undefined ? undefined : safeIdentifier(value.connectorId);
  const targetSurface = value.targetSurface === undefined ? undefined : safeIdentifier(value.targetSurface);
  const migrationPlanId = safeIdentifier(value.migrationPlanId);
  const checkpointProofId = safeIdentifier(value.checkpointProofId);
  const rollbackProofId = safeIdentifier(value.rollbackProofId);
  const secretRedactionProofId = safeIdentifier(value.secretRedactionProofId);

  if (
    value.contract !== 'durable-persistence-live-activation-facts-v1'
    || value.activationOwner !== 'assistantcaddy-head-chat-durable-persistence-live-activation'
    || value.activationId !== 'assistantcaddy-durable-persistence-live-activation-gate'
    || !activationVersion
    || value.sourceManifestOwner !== SOURCE_MANIFEST_OWNER
    || value.sourceManifestId !== SOURCE_MANIFEST_ID
    || !sourceManifestVersion
    || (value.providerId !== undefined && !providerId)
    || (value.connectorId !== undefined && !connectorId)
    || (value.targetSurface !== undefined && !targetSurface)
    || value.reviewedSchemaOwner !== 'head-chat'
    || value.reviewedExportImportBackupRestoreOwner !== 'head-chat'
    || value.schemaOwnershipReviewed !== true
    || value.exportImportBackupRestoreOwnershipReviewed !== true
    || !migrationPlanId
    || value.migrationPlanReviewed !== true
    || value.exportImpactPlanReviewed !== true
    || value.importImpactPlanReviewed !== true
    || value.backupImpactPlanReviewed !== true
    || value.restoreImpactPlanReviewed !== true
    || !checkpointProofId
    || !rollbackProofId
    || value.checkpointProofReviewed !== true
    || value.rollbackProofReviewed !== true
    || !secretRedactionProofId
    || value.secretRedactionReviewed !== true
    || value.noRawSecretGuarantee !== true
    || value.noBackupLeakage !== true
    || value.noExportLeakage !== true
    || value.noImportPlaintextSecret !== true
    || value.noSchemaRawSecretFields !== true
    || value.reviewState !== 'reviewed'
    || value.sideEffects !== 'none'
    || value.sideEffectBoundary !== FACTS_BOUNDARY
  ) {
    return undefined;
  }

  return Object.freeze({
    contract: 'durable-persistence-live-activation-facts-v1',
    activationOwner: 'assistantcaddy-head-chat-durable-persistence-live-activation',
    activationId: 'assistantcaddy-durable-persistence-live-activation-gate',
    activationVersion,
    sourceManifestOwner: SOURCE_MANIFEST_OWNER,
    sourceManifestId: SOURCE_MANIFEST_ID,
    sourceManifestVersion,
    ...(providerId ? { providerId } : {}),
    ...(connectorId ? { connectorId } : {}),
    ...(targetSurface ? { targetSurface } : {}),
    reviewedSchemaOwner: 'head-chat',
    reviewedExportImportBackupRestoreOwner: 'head-chat',
    schemaOwnershipReviewed: true,
    exportImportBackupRestoreOwnershipReviewed: true,
    migrationPlanId,
    migrationPlanReviewed: true,
    exportImpactPlanReviewed: true,
    importImpactPlanReviewed: true,
    backupImpactPlanReviewed: true,
    restoreImpactPlanReviewed: true,
    checkpointProofId,
    rollbackProofId,
    checkpointProofReviewed: true,
    rollbackProofReviewed: true,
    secretRedactionProofId,
    secretRedactionReviewed: true,
    noRawSecretGuarantee: true,
    noBackupLeakage: true,
    noExportLeakage: true,
    noImportPlaintextSecret: true,
    noSchemaRawSecretFields: true,
    reviewState: 'reviewed',
    sideEffects: 'none',
    sideEffectBoundary: FACTS_BOUNDARY,
  });
}

function parseApproval(value: unknown): DurablePersistenceActivationApproval | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, APPROVAL_KEYS)) return undefined;
  if (
    value.contract !== 'durable-persistence-live-activation-approval-v1'
    || value.approvalScope !== 'durable-persistence-schema-export-import-backup-restore'
    || value.userApprovalGranted !== true
    || value.adminApprovalGranted !== true
    || value.approverRole !== 'workspace-admin'
    || value.acknowledgedPlanOnly !== true
    || value.acknowledgedCheckpointBeforeMigration !== true
    || value.acknowledgedAdminApprovalBeforePersistence !== true
    || value.acknowledgedNoRawSecrets !== true
    || value.acknowledgedNoStorageActions !== true
    || value.reviewState !== 'approved'
  ) {
    return undefined;
  }
  return Object.freeze({
    contract: 'durable-persistence-live-activation-approval-v1',
    approvalScope: 'durable-persistence-schema-export-import-backup-restore',
    userApprovalGranted: true,
    adminApprovalGranted: true,
    approverRole: 'workspace-admin',
    acknowledgedPlanOnly: true,
    acknowledgedCheckpointBeforeMigration: true,
    acknowledgedAdminApprovalBeforePersistence: true,
    acknowledgedNoRawSecrets: true,
    acknowledgedNoStorageActions: true,
    reviewState: 'approved',
  });
}

function factsMatchManifest(
  facts: DurablePersistenceActivationFacts,
  manifest: DurablePersistenceOperationsImplementationManifestDecision,
): boolean {
  return facts.sourceManifestVersion === manifest.manifest.manifestVersion
    && facts.providerId === manifest.manifest.providerId
    && facts.connectorId === manifest.manifest.connectorId
    && facts.targetSurface === manifest.manifest.targetSurface;
}

function freezePlan(
  facts: DurablePersistenceActivationFacts,
  sourceManifest: DurablePersistenceOperationsImplementationManifestDecision,
): DurablePersistenceLiveActivationPlan {
  return Object.freeze({
    contract: 'durable-persistence-live-activation-plan-v1',
    activationOwner: facts.activationOwner,
    activationId: facts.activationId,
    activationVersion: facts.activationVersion,
    sourceManifestOwner: SOURCE_MANIFEST_OWNER,
    sourceManifestId: SOURCE_MANIFEST_ID,
    sourceManifestVersion: facts.sourceManifestVersion,
    ...(facts.providerId ? { providerId: facts.providerId } : {}),
    ...(facts.connectorId ? { connectorId: facts.connectorId } : {}),
    ...(facts.targetSurface ? { targetSurface: facts.targetSurface } : {}),
    reviewedSchemaOwner: 'head-chat',
    reviewedExportImportBackupRestoreOwner: 'head-chat',
    migrationPlanId: facts.migrationPlanId,
    checkpointProofId: facts.checkpointProofId,
    rollbackProofId: facts.rollbackProofId,
    secretRedactionProofId: facts.secretRedactionProofId,
    reviewedOperations: Object.freeze([...sourceManifest.manifest.operationOrder]),
    exactHighRiskWriteSet: Object.freeze([...sourceManifest.manifest.exactHighRiskWriteSet]),
    requiresCheckpointBeforeMigration: true,
    requiresAdminApprovalBeforePersistence: true,
    requiresUserApprovalBeforePersistence: true,
    noRawSecretGuarantee: true,
    noBackupLeakage: true,
    noExportLeakage: true,
    noImportPlaintextSecret: true,
    noSchemaRawSecretFields: true,
    executable: false,
    sideEffects: 'none',
    storageActions: Object.freeze([]) as readonly [],
    schemaActions: Object.freeze([]) as readonly [],
    exportImportBackupRestoreActions: Object.freeze([]) as readonly [],
    sideEffectBoundary: PLAN_BOUNDARY,
  });
}

function freezeDecision(
  reason: DurablePersistenceLiveActivationGateReason,
  facts?: DurablePersistenceActivationFacts,
  sourceManifest?: DurablePersistenceOperationsImplementationManifestDecision,
): Readonly<DurablePersistenceLiveActivationGateDecision> {
  const ready = reason === 'durable_persistence_live_activation_gate_ready'
    && facts !== undefined
    && sourceManifest !== undefined;
  return Object.freeze({
    status: ready ? 'ready' : 'blocked',
    ready,
    reason,
    ...(ready && facts && sourceManifest ? { plan: freezePlan(facts, sourceManifest) } : {}),
    canConsiderDurablePersistenceWork: ready,
    readyForDurablePersistenceImplementation: false,
    requiresCheckpointBeforeMigration: true,
    requiresAdminApprovalBeforePersistence: true,
    requiresUserApprovalBeforePersistence: true,
    mayPersistRuntimeState: false,
    mayCreateDexieSchema: false,
    mayBackupOrExportRuntimeState: false,
    mayImportOrRestoreRuntimeState: false,
    maySyncRuntimeState: false,
    mayReadStorage: false,
    mayWriteStorage: false,
    mayOpenStorageAdapter: false,
    mayInvokeSchemaWriter: false,
    mayRunExportImportBackupRestore: false,
    mayFetch: false,
    mayOpenSocket: false,
    mayCallProvider: false,
    willGenerateArtifacts: false,
    willPromoteStandalone: false,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary: DECISION_BOUNDARY,
  });
}

export function evaluateDurablePersistenceLiveActivationGate(
  input: DurablePersistenceLiveActivationGateInput = {},
): Readonly<DurablePersistenceLiveActivationGateDecision> {
  if (!isRuntimeTrustedContractObject(input)) return freezeDecision('runtime_shape_forbidden');
  if (!isRecord(input) || !hasOnlyKeys(input, ROOT_KEYS)) {
    return freezeDecision('runtime_shape_forbidden');
  }
  if (valueHasAccessorDescriptor(input)) return freezeDecision('runtime_shape_forbidden');
  if (valueHasRawSecretMaterial(input)) return freezeDecision('raw_secret_material');
  if (
    input.storageAdapter !== undefined
    || input.storageResult !== undefined
    || input.db !== undefined
    || input.dexie !== undefined
    || input.storage !== undefined
    || hasMarker(input.activationFacts, STORAGE_MARKERS)
    || hasMarker(input.approval, STORAGE_MARKERS)
  ) {
    return freezeDecision('storage_shape_forbidden');
  }
  if (input.schemaWriter !== undefined || hasMarker(input.activationFacts, SCHEMA_MARKERS)) {
    return freezeDecision('schema_writer_forbidden');
  }
  if (
    input.exportCallback !== undefined
    || input.importCallback !== undefined
    || input.backupCallback !== undefined
    || input.restoreCallback !== undefined
    || hasMarker(input.activationFacts, OPERATION_CALLBACK_MARKERS)
  ) {
    return freezeDecision('operation_callback_forbidden');
  }
  if (
    input.requester !== undefined
    || input.fetch !== undefined
    || input.socket !== undefined
    || input.liveAction !== undefined
    || input.executable !== undefined
    || hasMarker(input.activationFacts, RUNTIME_MARKERS)
    || hasMarker(input.approval, RUNTIME_MARKERS)
  ) {
    return freezeDecision('runtime_shape_forbidden');
  }

  const operationsManifestInput = input.operationsManifest;
  if (!operationsManifestInput) return freezeDecision('operations_manifest_missing');
  if (!isRecord(operationsManifestInput)) return freezeDecision('operations_manifest_invalid');
  if (operationsManifestInput.status === 'blocked' || operationsManifestInput.manifestReady !== true) {
    return freezeDecision('operations_manifest_not_ready');
  }
  const operationsManifest = operationsManifestInput as unknown as DurablePersistenceOperationsImplementationManifestDecision;
  if (!operationsManifestIsReady(operationsManifest)) return freezeDecision('operations_manifest_invalid');

  if (input.activationFacts === undefined || input.activationFacts === null) {
    return freezeDecision('activation_facts_missing');
  }
  const facts = parseActivationFacts(input.activationFacts);
  if (!facts) return freezeDecision('activation_facts_invalid');
  if (!factsMatchManifest(facts, operationsManifest)) {
    return freezeDecision('activation_owner_mismatch');
  }
  if (
    facts.migrationPlanReviewed !== true
    || facts.exportImpactPlanReviewed !== true
    || facts.importImpactPlanReviewed !== true
    || facts.backupImpactPlanReviewed !== true
    || facts.restoreImpactPlanReviewed !== true
  ) {
    return freezeDecision('migration_plan_invalid');
  }
  if (
    facts.checkpointProofReviewed !== true
    || facts.rollbackProofReviewed !== true
    || !facts.checkpointProofId
    || !facts.rollbackProofId
  ) {
    return freezeDecision('rollback_checkpoint_proof_invalid');
  }
  if (
    facts.secretRedactionReviewed !== true
    || facts.noRawSecretGuarantee !== true
    || facts.noBackupLeakage !== true
    || facts.noExportLeakage !== true
    || facts.noImportPlaintextSecret !== true
    || facts.noSchemaRawSecretFields !== true
  ) {
    return freezeDecision('secret_posture_invalid');
  }

  const approval = parseApproval(input.approval);
  if (!approval) return freezeDecision('approval_posture_invalid');

  return freezeDecision('durable_persistence_live_activation_gate_ready', facts, operationsManifest);
}
