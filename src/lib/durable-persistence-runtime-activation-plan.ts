import { isSecretLikeFieldName } from './connector-credential-boundary';
import type {
  ConnectorRuntimePersistenceGuardDecision,
} from './connector-runtime-persistence-guard';
import {
  CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS,
  type ConnectorRuntimePersistenceImplementationBoundaryDecision,
  type ConnectorRuntimePersistenceImplementationSection,
} from './connector-runtime-persistence-implementation-boundary';
import {
  type DurablePersistenceLiveActivationGateDecision,
  type DurablePersistenceLiveActivationPlan,
} from './durable-persistence-live-activation-gate';
import {
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER,
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN,
} from './durable-persistence-operations-implementation-manifest';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type DurablePersistenceRuntimeActivationPlanStatus = 'implementation-plan-ready' | 'blocked';

export type DurablePersistenceRuntimeActivationPlanReason =
  | 'durable_persistence_runtime_activation_plan_ready'
  | 'live_activation_missing'
  | 'live_activation_not_ready'
  | 'live_activation_invalid'
  | 'persistence_guard_missing'
  | 'persistence_guard_not_ready'
  | 'persistence_guard_invalid'
  | 'implementation_boundary_missing'
  | 'implementation_boundary_not_ready'
  | 'implementation_boundary_invalid'
  | 'binding_proof_missing'
  | 'binding_proof_invalid'
  | 'owner_mismatch'
  | 'future_write_set_invalid'
  | 'checkpoint_rollback_proof_invalid'
  | 'secret_posture_invalid'
  | 'admin_approval_missing'
  | 'admin_approval_invalid'
  | 'storage_shape_forbidden'
  | 'schema_writer_forbidden'
  | 'operation_callback_forbidden'
  | 'runtime_shape_forbidden'
  | 'forged_executable_claim'
  | 'raw_secret_material';

export interface DurablePersistenceRuntimeActivationBindingProof {
  contract: 'durable-persistence-runtime-activation-binding-proof-v1';
  bindingOwner: 'assistantcaddy-head-chat-durable-persistence-runtime-activation';
  bindingId: 'assistantcaddy-durable-persistence-runtime-activation-plan';
  bindingVersion: string;
  activationId: 'assistantcaddy-durable-persistence-live-activation-gate';
  implementationBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1';
  persistenceGuardContract: 'connector-runtime-persistence-guard-v1';
  providerId?: string;
  connectorId?: string;
  targetSurface?: string;
  reviewedSchemaOwner: 'head-chat';
  reviewedExportImportBackupRestoreOwner: 'head-chat';
  schemaOwnershipReviewed: true;
  exportImportBackupRestoreOwnershipReviewed: true;
  exactFutureWriteSet: readonly string[];
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
  adminApprovalGranted: true;
  adminApprovalReviewed: true;
  acknowledgedPlanOnly: true;
  acknowledgedNoStorageActions: true;
  reviewState: 'reviewed';
  sideEffects: 'none';
  sideEffectBoundary: 'durable-persistence-runtime-activation-binding-proof-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials';
}

export interface DurablePersistenceRuntimeActivationPlanInput {
  liveActivationDecision?: DurablePersistenceLiveActivationGateDecision | null;
  persistenceGuardDecision?: ConnectorRuntimePersistenceGuardDecision | null;
  implementationBoundary?: ConnectorRuntimePersistenceImplementationBoundaryDecision | null;
  bindingProof?: unknown;
  proposedFutureWriteSet?: readonly unknown[] | null;
  storageAdapter?: unknown;
  storageResult?: unknown;
  schemaWriter?: unknown;
  db?: unknown;
  dexie?: unknown;
  exportCallback?: unknown;
  importCallback?: unknown;
  backupCallback?: unknown;
  restoreCallback?: unknown;
  migrationRunner?: unknown;
  requester?: unknown;
  fetch?: unknown;
  socket?: unknown;
  storage?: unknown;
  liveAction?: unknown;
  executable?: unknown;
  result?: unknown;
}

export interface DurablePersistenceRuntimeImplementationPlan {
  contract: 'durable-persistence-runtime-activation-implementation-plan-v1';
  planOwner: 'assistantcaddy-head-chat-durable-persistence-runtime-activation';
  planId: 'assistantcaddy-durable-persistence-runtime-activation-plan';
  planVersion: string;
  activationId: 'assistantcaddy-durable-persistence-live-activation-gate';
  implementationBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1';
  persistenceGuardContract: 'connector-runtime-persistence-guard-v1';
  providerId?: string;
  connectorId?: string;
  targetSurface?: string;
  reviewedSchemaOwner: 'head-chat';
  reviewedExportImportBackupRestoreOwner: 'head-chat';
  reviewedOperations: readonly ConnectorRuntimePersistenceImplementationSection[];
  exactFutureWriteSet: readonly string[];
  checkpointProofId: string;
  rollbackProofId: string;
  secretRedactionProofId: string;
  noRawSecretGuarantee: true;
  noBackupLeakage: true;
  noExportLeakage: true;
  noImportPlaintextSecret: true;
  noSchemaRawSecretFields: true;
  requiresCheckpointBeforeMigration: true;
  requiresAdminApprovalBeforePersistence: true;
  adminApprovalGranted: true;
  executable: false;
  sideEffects: 'none';
  storageActions: readonly [];
  schemaActions: readonly [];
  exportImportBackupRestoreActions: readonly [];
  migrationActions: readonly [];
  dryRunLifecyclePlan: DurablePersistenceDryRunLifecyclePlan;
  implementationMode: 'plan-only';
  sideEffectBoundary: 'durable-persistence-runtime-activation-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials';
}

export interface DurablePersistenceDryRunLifecycleOperation {
  operation: ConnectorRuntimePersistenceImplementationSection;
  requiredFiles: readonly string[];
  checkpointRequired: true;
  rollbackRequired: true;
  dryRunReady: true;
  executable: false;
  mutatesData: false;
  sideEffects: 'none';
}

export interface DurablePersistenceDryRunLifecyclePlan {
  contract: 'durable-persistence-dry-run-lifecycle-plan-v1';
  lifecycleOwner: 'assistantcaddy-head-chat-durable-persistence-runtime-activation';
  lifecycleId: 'assistantcaddy-durable-persistence-dry-run-lifecycle-plan';
  operationMode: 'dry-run-plan-only';
  providerId?: string;
  connectorId?: string;
  targetSurface?: string;
  operations: readonly DurablePersistenceDryRunLifecycleOperation[];
  checkpointProofId: string;
  rollbackProofId: string;
  secretRedactionProofId: string;
  checkpointRequired: true;
  rollbackRequired: true;
  noRawSecretGuarantee: true;
  noBackupLeakage: true;
  noExportLeakage: true;
  noImportPlaintextSecret: true;
  noSchemaRawSecretFields: true;
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
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'durable-persistence-dry-run-lifecycle-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials';
}

export interface DurablePersistenceRuntimeActivationPlanDecision {
  status: DurablePersistenceRuntimeActivationPlanStatus;
  ready: boolean;
  reason: DurablePersistenceRuntimeActivationPlanReason;
  implementationPlan?: DurablePersistenceRuntimeImplementationPlan;
  mayPrepareRuntimeActivationImplementation: boolean;
  readyForDurablePersistenceImplementation: false;
  requiresCheckpointBeforeMigration: true;
  requiresAdminApprovalBeforePersistence: true;
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
  mayRunMigration: false;
  mayFetch: false;
  mayOpenSocket: false;
  mayCallProvider: false;
  willGenerateArtifacts: false;
  willPromoteStandalone: false;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'durable-persistence-runtime-activation-plan-decision-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials';
}

const LIVE_DECISION_BOUNDARY =
  'durable-persistence-live-activation-gate-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials' as const;
const LIVE_PLAN_BOUNDARY =
  'durable-persistence-live-activation-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials' as const;
const GUARD_BOUNDARY = 'decision-only-no-fetch-no-indexeddb-no-localstorage-no-provider-no-credentials' as const;
const IMPLEMENTATION_BOUNDARY =
  'implementation-checklist-only-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials' as const;
const BINDING_BOUNDARY =
  'durable-persistence-runtime-activation-binding-proof-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials' as const;
const PLAN_BOUNDARY =
  'durable-persistence-runtime-activation-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials' as const;
const DECISION_BOUNDARY =
  'durable-persistence-runtime-activation-plan-decision-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials' as const;
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
  'backupCallback',
  'bindingProof',
  'db',
  'dexie',
  'executable',
  'exportCallback',
  'fetch',
  'implementationBoundary',
  'importCallback',
  'liveAction',
  'liveActivationDecision',
  'migrationRunner',
  'persistenceGuardDecision',
  'proposedFutureWriteSet',
  'requester',
  'restoreCallback',
  'result',
  'schemaWriter',
  'socket',
  'storage',
  'storageAdapter',
  'storageResult',
]);
const BINDING_KEYS = new Set([
  'acknowledgedNoStorageActions',
  'acknowledgedPlanOnly',
  'activationId',
  'adminApprovalGranted',
  'adminApprovalReviewed',
  'bindingId',
  'bindingOwner',
  'bindingVersion',
  'checkpointProofId',
  'checkpointProofReviewed',
  'connectorId',
  'contract',
  'exactFutureWriteSet',
  'exportImportBackupRestoreOwnershipReviewed',
  'implementationBoundaryContract',
  'noBackupLeakage',
  'noExportLeakage',
  'noImportPlaintextSecret',
  'noRawSecretGuarantee',
  'noSchemaRawSecretFields',
  'persistenceGuardContract',
  'providerId',
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
  'targetSurface',
]);
const LIVE_DECISION_KEYS = new Set([
  'canConsiderDurablePersistenceWork',
  'executable',
  'mayBackupOrExportRuntimeState',
  'mayCallProvider',
  'mayCreateDexieSchema',
  'mayFetch',
  'mayImportOrRestoreRuntimeState',
  'mayInvokeSchemaWriter',
  'mayOpenSocket',
  'mayOpenStorageAdapter',
  'mayPersistRuntimeState',
  'mayReadStorage',
  'mayRunExportImportBackupRestore',
  'maySyncRuntimeState',
  'mayWriteStorage',
  'plan',
  'ready',
  'readyForDurablePersistenceImplementation',
  'reason',
  'requiresAdminApprovalBeforePersistence',
  'requiresCheckpointBeforeMigration',
  'requiresUserApprovalBeforePersistence',
  'sideEffectBoundary',
  'sideEffects',
  'status',
  'willGenerateArtifacts',
  'willPromoteStandalone',
]);
const LIVE_PLAN_KEYS = new Set([
  'activationId',
  'activationOwner',
  'activationVersion',
  'checkpointProofId',
  'connectorId',
  'contract',
  'exactHighRiskWriteSet',
  'executable',
  'exportImportBackupRestoreActions',
  'migrationPlanId',
  'noBackupLeakage',
  'noExportLeakage',
  'noImportPlaintextSecret',
  'noRawSecretGuarantee',
  'noSchemaRawSecretFields',
  'providerId',
  'requiresAdminApprovalBeforePersistence',
  'requiresCheckpointBeforeMigration',
  'requiresUserApprovalBeforePersistence',
  'reviewedExportImportBackupRestoreOwner',
  'reviewedOperations',
  'reviewedSchemaOwner',
  'rollbackProofId',
  'schemaActions',
  'secretRedactionProofId',
  'sideEffectBoundary',
  'sideEffects',
  'sourceManifestId',
  'sourceManifestOwner',
  'sourceManifestVersion',
  'storageActions',
  'targetSurface',
]);
const GUARD_DECISION_KEYS = new Set([
  'blockers',
  'mayBackupOrExportRuntimeState',
  'mayCreateDexieSchema',
  'mayImportOrRestoreRuntimeState',
  'mayPersistRuntimeState',
  'maySyncRuntimeState',
  'mayUseSessionOnlyRuntimeState',
  'metadata',
  'sideEffectBoundary',
  'sideEffects',
  'status',
  'storageDirective',
]);
const GUARD_METADATA_KEYS = new Set([
  'connectorId',
  'contract',
  'exportKeyCount',
  'migrationLabelCount',
  'proposedFieldCount',
  'providerId',
  'requestKind',
  'reviewedPlanEvidenceCount',
  'reviewedPlanId',
  'schemaVersion',
  'stateLabel',
  'targetSurface',
]);
const IMPLEMENTATION_DECISION_KEYS = new Set([
  'blockers',
  'executableFeasibility',
  'executablePersistenceContract',
  'mayBackupOrExportRuntimeState',
  'mayCreateDexieSchema',
  'mayImportOrRestoreRuntimeState',
  'mayPersistRuntimeState',
  'maySyncRuntimeState',
  'metadata',
  'readyForDurableRuntimeImplementation',
  'sideEffectBoundary',
  'sideEffects',
  'status',
  'storageDirective',
]);
const IMPLEMENTATION_METADATA_KEYS = new Set([
  'connectorId',
  'contract',
  'evidenceDescriptorCount',
  'importExportReadinessContract',
  'importExportReadinessStatus',
  'missingSectionCount',
  'missingSections',
  'persistenceGuardContract',
  'persistenceGuardStatus',
  'providerId',
  'requirementCount',
  'requirements',
  'reviewedEvidenceCount',
  'schemaVersion',
  'sections',
  'targetSurface',
]);
const IMPLEMENTATION_REQUIREMENT_KEYS = new Set([
  'label',
  'requiredEvidence',
  'requiredFiles',
  'section',
]);
const SAFE_SECRET_KEYS = new Set([
  'acknowledgedNoRawSecrets',
  'noBackupLeakage',
  'noExportLeakage',
  'noImportPlaintextSecret',
  'noRawSecretGuarantee',
  'noSchemaRawSecretFields',
  'secretRedactionProofId',
  'secretRedactionReviewed',
]);
function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
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

function sameStringList(left: readonly unknown[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameSortedStringList(left: readonly string[], right: readonly string[]): boolean {
  return sameStringList([...left].sort(), [...right].sort());
}

function expectedFutureWriteSet(): readonly string[] {
  return DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET;
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
        (typeof key === 'string' && isSecretLikeFieldName(key) && !SAFE_SECRET_KEYS.has(key))
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
    if (isSecretLikeFieldName(key) && !SAFE_SECRET_KEYS.has(key)) return true;
    if (valueHasRawSecretMaterial(nestedValue, seen)) return true;
  }
  return false;
}

function hasForgedExecutableClaim(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  if (currentKey && normalizeKey(currentKey) === 'executable' && value !== false) return true;
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasForgedExecutableClaim(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (hasForgedExecutableClaim(nestedValue, seen, typeof key === 'string' ? key : undefined)) return true;
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (hasForgedExecutableClaim(nestedValue, seen)) return true;
    }
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => hasForgedExecutableClaim(nestedValue, seen, key));
}

function emptyFrozenArray(value: unknown): value is readonly [] {
  return Array.isArray(value) && value.length === 0;
}

function livePlanIsReady(value: unknown): value is DurablePersistenceLiveActivationPlan {
  if (!isRecord(value) || !hasOnlyKeys(value, LIVE_PLAN_KEYS)) return false;
  return value.contract === 'durable-persistence-live-activation-plan-v1'
    && value.activationOwner === 'assistantcaddy-head-chat-durable-persistence-live-activation'
    && value.activationId === 'assistantcaddy-durable-persistence-live-activation-gate'
    && safeIdentifier(value.activationVersion) !== undefined
    && value.sourceManifestOwner === 'assistantcaddy-head-chat-durable-persistence-operations'
    && value.sourceManifestId === 'assistantcaddy-head-chat-durable-persistence-operations-manifest'
    && safeIdentifier(value.sourceManifestVersion) !== undefined
    && (value.providerId === undefined || safeIdentifier(value.providerId) !== undefined)
    && (value.connectorId === undefined || safeIdentifier(value.connectorId) !== undefined)
    && (value.targetSurface === undefined || safeIdentifier(value.targetSurface) !== undefined)
    && value.reviewedSchemaOwner === 'head-chat'
    && value.reviewedExportImportBackupRestoreOwner === 'head-chat'
    && safeIdentifier(value.migrationPlanId) !== undefined
    && safeIdentifier(value.checkpointProofId) !== undefined
    && safeIdentifier(value.rollbackProofId) !== undefined
    && safeIdentifier(value.secretRedactionProofId) !== undefined
    && Array.isArray(value.reviewedOperations)
    && sameStringList(value.reviewedOperations, DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER)
    && Array.isArray(value.exactHighRiskWriteSet)
    && sameSortedStringList(value.exactHighRiskWriteSet, expectedFutureWriteSet())
    && value.requiresCheckpointBeforeMigration === true
    && value.requiresAdminApprovalBeforePersistence === true
    && value.requiresUserApprovalBeforePersistence === true
    && value.noRawSecretGuarantee === true
    && value.noBackupLeakage === true
    && value.noExportLeakage === true
    && value.noImportPlaintextSecret === true
    && value.noSchemaRawSecretFields === true
    && value.executable === false
    && value.sideEffects === 'none'
    && emptyFrozenArray(value.storageActions)
    && emptyFrozenArray(value.schemaActions)
    && emptyFrozenArray(value.exportImportBackupRestoreActions)
    && value.sideEffectBoundary === LIVE_PLAN_BOUNDARY;
}

function liveActivationDecisionIsReady(value: unknown): value is DurablePersistenceLiveActivationGateDecision {
  if (!isRecord(value) || !hasOnlyKeys(value, LIVE_DECISION_KEYS)) return false;
  return value.status === 'ready'
    && value.ready === true
    && value.reason === 'durable_persistence_live_activation_gate_ready'
    && value.canConsiderDurablePersistenceWork === true
    && value.readyForDurablePersistenceImplementation === false
    && value.requiresCheckpointBeforeMigration === true
    && value.requiresAdminApprovalBeforePersistence === true
    && value.requiresUserApprovalBeforePersistence === true
    && value.mayPersistRuntimeState === false
    && value.mayCreateDexieSchema === false
    && value.mayBackupOrExportRuntimeState === false
    && value.mayImportOrRestoreRuntimeState === false
    && value.maySyncRuntimeState === false
    && value.mayReadStorage === false
    && value.mayWriteStorage === false
    && value.mayOpenStorageAdapter === false
    && value.mayInvokeSchemaWriter === false
    && value.mayRunExportImportBackupRestore === false
    && value.mayFetch === false
    && value.mayOpenSocket === false
    && value.mayCallProvider === false
    && value.willGenerateArtifacts === false
    && value.willPromoteStandalone === false
    && value.executable === false
    && value.sideEffects === 'none'
    && value.sideEffectBoundary === LIVE_DECISION_BOUNDARY
    && livePlanIsReady(value.plan);
}

function persistenceGuardIsReady(value: unknown): value is ConnectorRuntimePersistenceGuardDecision {
  if (!isRecord(value) || !hasOnlyKeys(value, GUARD_DECISION_KEYS)) return false;
  if (!isRecord(value.metadata) || !hasOnlyKeys(value.metadata, GUARD_METADATA_KEYS)) return false;
  return value.status === 'allow-session-only'
    && value.mayUseSessionOnlyRuntimeState === true
    && value.mayPersistRuntimeState === false
    && value.mayCreateDexieSchema === false
    && value.mayBackupOrExportRuntimeState === false
    && value.mayImportOrRestoreRuntimeState === false
    && value.maySyncRuntimeState === false
    && value.storageDirective === 'session-only-do-not-persist-do-not-export-do-not-sync'
    && value.sideEffects === 'none'
    && value.sideEffectBoundary === GUARD_BOUNDARY
    && Array.isArray(value.blockers)
    && value.blockers.length === 0
    && value.metadata.schemaVersion === 1
    && value.metadata.contract === 'connector-runtime-persistence-guard-v1'
    && value.metadata.requestKind === 'no-persistence-session-only'
    && safeIdentifier(value.metadata.providerId) !== undefined
    && safeIdentifier(value.metadata.connectorId) !== undefined
    && (value.metadata.targetSurface === undefined || safeIdentifier(value.metadata.targetSurface) !== undefined);
}

function implementationBoundaryIsReady(value: unknown): value is ConnectorRuntimePersistenceImplementationBoundaryDecision {
  if (!isRecord(value) || !hasOnlyKeys(value, IMPLEMENTATION_DECISION_KEYS)) return false;
  if (!isRecord(value.metadata) || !hasOnlyKeys(value.metadata, IMPLEMENTATION_METADATA_KEYS)) return false;
  return value.status === 'implementation-checklist-ready'
    && value.readyForDurableRuntimeImplementation === true
    && value.executablePersistenceContract === false
    && value.executableFeasibility === 'blocked-requires-broader-durable-write-set'
    && value.mayPersistRuntimeState === false
    && value.mayCreateDexieSchema === false
    && value.mayBackupOrExportRuntimeState === false
    && value.mayImportOrRestoreRuntimeState === false
    && value.maySyncRuntimeState === false
    && value.sideEffects === 'none'
    && value.sideEffectBoundary === IMPLEMENTATION_BOUNDARY
    && value.storageDirective === 'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import'
    && Array.isArray(value.blockers)
    && value.blockers.length === 0
    && value.metadata.schemaVersion === 1
    && value.metadata.contract === 'connector-runtime-persistence-implementation-boundary-v1'
    && safeIdentifier(value.metadata.providerId) !== undefined
    && safeIdentifier(value.metadata.connectorId) !== undefined
    && (value.metadata.targetSurface === undefined || safeIdentifier(value.metadata.targetSurface) !== undefined)
    && value.metadata.importExportReadinessContract === 'connector-runtime-import-export-readiness-plan-v1'
    && value.metadata.importExportReadinessStatus === 'metadata-only'
    && value.metadata.persistenceGuardContract === 'connector-runtime-persistence-guard-v1'
    && value.metadata.persistenceGuardStatus === 'allow-session-only'
    && value.metadata.requirementCount === CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length
    && value.metadata.evidenceDescriptorCount === CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length
    && value.metadata.reviewedEvidenceCount === CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length
    && value.metadata.missingSectionCount === 0
    && Array.isArray(value.metadata.missingSections)
    && value.metadata.missingSections.length === 0
    && Array.isArray(value.metadata.sections)
    && sameStringList(value.metadata.sections, DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER)
    && Array.isArray(value.metadata.requirements)
    && requirementsMatchExact(value.metadata.requirements);
}

function requirementsMatchExact(value: readonly unknown[]): boolean {
  return value.length === CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length
    && value.every((entry, index) => {
      const expected = CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS[index];
      return isRecord(entry)
        && hasOnlyKeys(entry, IMPLEMENTATION_REQUIREMENT_KEYS)
        && entry.section === expected.section
        && entry.label === expected.label
        && entry.requiredEvidence === expected.requiredEvidence
        && Array.isArray(entry.requiredFiles)
        && sameStringList(entry.requiredFiles, expected.requiredFiles);
    });
}

function parseBindingProof(value: unknown): DurablePersistenceRuntimeActivationBindingProof | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, BINDING_KEYS)) return undefined;
  const bindingVersion = safeIdentifier(value.bindingVersion);
  const providerId = value.providerId === undefined ? undefined : safeIdentifier(value.providerId);
  const connectorId = value.connectorId === undefined ? undefined : safeIdentifier(value.connectorId);
  const targetSurface = value.targetSurface === undefined ? undefined : safeIdentifier(value.targetSurface);
  const checkpointProofId = safeIdentifier(value.checkpointProofId);
  const rollbackProofId = safeIdentifier(value.rollbackProofId);
  const secretRedactionProofId = safeIdentifier(value.secretRedactionProofId);
  if (
    value.contract !== 'durable-persistence-runtime-activation-binding-proof-v1'
    || value.bindingOwner !== 'assistantcaddy-head-chat-durable-persistence-runtime-activation'
    || value.bindingId !== 'assistantcaddy-durable-persistence-runtime-activation-plan'
    || !bindingVersion
    || value.activationId !== 'assistantcaddy-durable-persistence-live-activation-gate'
    || value.implementationBoundaryContract !== 'connector-runtime-persistence-implementation-boundary-v1'
    || value.persistenceGuardContract !== 'connector-runtime-persistence-guard-v1'
    || (value.providerId !== undefined && !providerId)
    || (value.connectorId !== undefined && !connectorId)
    || (value.targetSurface !== undefined && !targetSurface)
    || value.reviewedSchemaOwner !== 'head-chat'
    || value.reviewedExportImportBackupRestoreOwner !== 'head-chat'
    || value.schemaOwnershipReviewed !== true
    || value.exportImportBackupRestoreOwnershipReviewed !== true
    || !Array.isArray(value.exactFutureWriteSet)
    || !sameSortedStringList(value.exactFutureWriteSet, expectedFutureWriteSet())
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
    || value.adminApprovalGranted !== true
    || value.adminApprovalReviewed !== true
    || value.acknowledgedPlanOnly !== true
    || value.acknowledgedNoStorageActions !== true
    || value.reviewState !== 'reviewed'
    || value.sideEffects !== 'none'
    || value.sideEffectBoundary !== BINDING_BOUNDARY
  ) {
    return undefined;
  }
  return Object.freeze({
    contract: 'durable-persistence-runtime-activation-binding-proof-v1',
    bindingOwner: 'assistantcaddy-head-chat-durable-persistence-runtime-activation',
    bindingId: 'assistantcaddy-durable-persistence-runtime-activation-plan',
    bindingVersion,
    activationId: 'assistantcaddy-durable-persistence-live-activation-gate',
    implementationBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1',
    persistenceGuardContract: 'connector-runtime-persistence-guard-v1',
    ...(providerId ? { providerId } : {}),
    ...(connectorId ? { connectorId } : {}),
    ...(targetSurface ? { targetSurface } : {}),
    reviewedSchemaOwner: 'head-chat',
    reviewedExportImportBackupRestoreOwner: 'head-chat',
    schemaOwnershipReviewed: true,
    exportImportBackupRestoreOwnershipReviewed: true,
    exactFutureWriteSet: Object.freeze([...value.exactFutureWriteSet]),
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
    adminApprovalGranted: true,
    adminApprovalReviewed: true,
    acknowledgedPlanOnly: true,
    acknowledgedNoStorageActions: true,
    reviewState: 'reviewed',
    sideEffects: 'none',
    sideEffectBoundary: BINDING_BOUNDARY,
  });
}

function ownersMatch(
  livePlan: DurablePersistenceLiveActivationPlan,
  guard: ConnectorRuntimePersistenceGuardDecision,
  boundary: ConnectorRuntimePersistenceImplementationBoundaryDecision,
  proof: DurablePersistenceRuntimeActivationBindingProof,
): boolean {
  return livePlan.providerId === guard.metadata.providerId
    && livePlan.connectorId === guard.metadata.connectorId
    && livePlan.targetSurface === guard.metadata.targetSurface
    && livePlan.providerId === boundary.metadata.providerId
    && livePlan.connectorId === boundary.metadata.connectorId
    && livePlan.targetSurface === boundary.metadata.targetSurface
    && livePlan.providerId === proof.providerId
    && livePlan.connectorId === proof.connectorId
    && livePlan.targetSurface === proof.targetSurface;
}

function checkpointRollbackProofMatches(
  livePlan: DurablePersistenceLiveActivationPlan,
  proof: DurablePersistenceRuntimeActivationBindingProof,
): boolean {
  return livePlan.requiresCheckpointBeforeMigration === true
    && proof.checkpointProofReviewed === true
    && proof.rollbackProofReviewed === true
    && livePlan.checkpointProofId === proof.checkpointProofId
    && livePlan.rollbackProofId === proof.rollbackProofId;
}

function secretPostureMatches(
  livePlan: DurablePersistenceLiveActivationPlan,
  proof: DurablePersistenceRuntimeActivationBindingProof,
): boolean {
  return livePlan.secretRedactionProofId === proof.secretRedactionProofId
    && livePlan.noRawSecretGuarantee === true
    && livePlan.noBackupLeakage === true
    && livePlan.noExportLeakage === true
    && livePlan.noImportPlaintextSecret === true
    && livePlan.noSchemaRawSecretFields === true
    && proof.secretRedactionReviewed === true
    && proof.noRawSecretGuarantee === true
    && proof.noBackupLeakage === true
    && proof.noExportLeakage === true
    && proof.noImportPlaintextSecret === true
    && proof.noSchemaRawSecretFields === true;
}

function freezeDryRunLifecyclePlan(
  livePlan: DurablePersistenceLiveActivationPlan,
  proof: DurablePersistenceRuntimeActivationBindingProof,
): DurablePersistenceDryRunLifecyclePlan {
  return Object.freeze({
    contract: 'durable-persistence-dry-run-lifecycle-plan-v1',
    lifecycleOwner: 'assistantcaddy-head-chat-durable-persistence-runtime-activation',
    lifecycleId: 'assistantcaddy-durable-persistence-dry-run-lifecycle-plan',
    operationMode: 'dry-run-plan-only',
    ...(livePlan.providerId ? { providerId: livePlan.providerId } : {}),
    ...(livePlan.connectorId ? { connectorId: livePlan.connectorId } : {}),
    ...(livePlan.targetSurface ? { targetSurface: livePlan.targetSurface } : {}),
    operations: Object.freeze(
      DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN.map((entry) => Object.freeze({
        operation: entry.operation,
        requiredFiles: Object.freeze([...entry.requiredFiles]),
        checkpointRequired: true,
        rollbackRequired: true,
        dryRunReady: true,
        executable: false,
        mutatesData: false,
        sideEffects: 'none',
      })),
    ),
    checkpointProofId: proof.checkpointProofId,
    rollbackProofId: proof.rollbackProofId,
    secretRedactionProofId: proof.secretRedactionProofId,
    checkpointRequired: true,
    rollbackRequired: true,
    noRawSecretGuarantee: true,
    noBackupLeakage: true,
    noExportLeakage: true,
    noImportPlaintextSecret: true,
    noSchemaRawSecretFields: true,
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
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary:
      'durable-persistence-dry-run-lifecycle-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials',
  });
}

function freezePlan(
  livePlan: DurablePersistenceLiveActivationPlan,
  proof: DurablePersistenceRuntimeActivationBindingProof,
): DurablePersistenceRuntimeImplementationPlan {
  return Object.freeze({
    contract: 'durable-persistence-runtime-activation-implementation-plan-v1',
    planOwner: 'assistantcaddy-head-chat-durable-persistence-runtime-activation',
    planId: 'assistantcaddy-durable-persistence-runtime-activation-plan',
    planVersion: proof.bindingVersion,
    activationId: livePlan.activationId,
    implementationBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1',
    persistenceGuardContract: 'connector-runtime-persistence-guard-v1',
    ...(livePlan.providerId ? { providerId: livePlan.providerId } : {}),
    ...(livePlan.connectorId ? { connectorId: livePlan.connectorId } : {}),
    ...(livePlan.targetSurface ? { targetSurface: livePlan.targetSurface } : {}),
    reviewedSchemaOwner: 'head-chat',
    reviewedExportImportBackupRestoreOwner: 'head-chat',
    reviewedOperations: Object.freeze([...DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER]),
    exactFutureWriteSet: Object.freeze([...expectedFutureWriteSet()]),
    checkpointProofId: proof.checkpointProofId,
    rollbackProofId: proof.rollbackProofId,
    secretRedactionProofId: proof.secretRedactionProofId,
    noRawSecretGuarantee: true,
    noBackupLeakage: true,
    noExportLeakage: true,
    noImportPlaintextSecret: true,
    noSchemaRawSecretFields: true,
    requiresCheckpointBeforeMigration: true,
    requiresAdminApprovalBeforePersistence: true,
    adminApprovalGranted: true,
    executable: false,
    sideEffects: 'none',
    storageActions: Object.freeze([]) as readonly [],
    schemaActions: Object.freeze([]) as readonly [],
    exportImportBackupRestoreActions: Object.freeze([]) as readonly [],
    migrationActions: Object.freeze([]) as readonly [],
    dryRunLifecyclePlan: freezeDryRunLifecyclePlan(livePlan, proof),
    implementationMode: 'plan-only',
    sideEffectBoundary: PLAN_BOUNDARY,
  });
}

function freezeDecision(
  reason: DurablePersistenceRuntimeActivationPlanReason,
  livePlan?: DurablePersistenceLiveActivationPlan,
  proof?: DurablePersistenceRuntimeActivationBindingProof,
): Readonly<DurablePersistenceRuntimeActivationPlanDecision> {
  const ready = reason === 'durable_persistence_runtime_activation_plan_ready'
    && livePlan !== undefined
    && proof !== undefined;
  return Object.freeze({
    status: ready ? 'implementation-plan-ready' : 'blocked',
    ready,
    reason,
    ...(ready && livePlan && proof ? { implementationPlan: freezePlan(livePlan, proof) } : {}),
    mayPrepareRuntimeActivationImplementation: ready,
    readyForDurablePersistenceImplementation: false,
    requiresCheckpointBeforeMigration: true,
    requiresAdminApprovalBeforePersistence: true,
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
    mayRunMigration: false,
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

export function evaluateDurablePersistenceRuntimeActivationPlan(
  input: DurablePersistenceRuntimeActivationPlanInput = {},
): Readonly<DurablePersistenceRuntimeActivationPlanDecision> {
  if (!isRuntimeTrustedContractObject(input)) return freezeDecision('runtime_shape_forbidden');
  if (!isRecord(input) || !hasOnlyKeys(input, ROOT_KEYS)) return freezeDecision('runtime_shape_forbidden');
  if (valueHasAccessorDescriptor(input)) return freezeDecision('runtime_shape_forbidden');
  if (valueHasRawSecretMaterial(input)) return freezeDecision('raw_secret_material');
  if (hasForgedExecutableClaim(input)) return freezeDecision('forged_executable_claim');
  if (
    input.storageAdapter !== undefined
    || input.storageResult !== undefined
    || input.db !== undefined
    || input.dexie !== undefined
    || input.storage !== undefined
  ) {
    return freezeDecision('storage_shape_forbidden');
  }
  if (
    input.schemaWriter !== undefined
  ) {
    return freezeDecision('schema_writer_forbidden');
  }
  if (
    input.exportCallback !== undefined
    || input.importCallback !== undefined
    || input.backupCallback !== undefined
    || input.restoreCallback !== undefined
    || input.migrationRunner !== undefined
  ) {
    return freezeDecision('operation_callback_forbidden');
  }
  if (
    input.requester !== undefined
    || input.fetch !== undefined
    || input.socket !== undefined
    || input.liveAction !== undefined
    || input.result !== undefined
  ) {
    return freezeDecision('runtime_shape_forbidden');
  }

  if (!input.liveActivationDecision) return freezeDecision('live_activation_missing');
  if (isRecord(input.liveActivationDecision) && input.liveActivationDecision.status === 'blocked') {
    return freezeDecision('live_activation_not_ready');
  }
  if (!liveActivationDecisionIsReady(input.liveActivationDecision)) return freezeDecision('live_activation_invalid');
  const livePlan = input.liveActivationDecision.plan;
  if (!livePlan) return freezeDecision('live_activation_invalid');

  if (!input.persistenceGuardDecision) return freezeDecision('persistence_guard_missing');
  if (isRecord(input.persistenceGuardDecision) && input.persistenceGuardDecision.status === 'blocked') {
    return freezeDecision('persistence_guard_not_ready');
  }
  if (!persistenceGuardIsReady(input.persistenceGuardDecision)) return freezeDecision('persistence_guard_invalid');

  if (!input.implementationBoundary) return freezeDecision('implementation_boundary_missing');
  if (isRecord(input.implementationBoundary) && input.implementationBoundary.status === 'blocked') {
    return freezeDecision('implementation_boundary_not_ready');
  }
  if (!implementationBoundaryIsReady(input.implementationBoundary)) return freezeDecision('implementation_boundary_invalid');

  if (input.bindingProof === undefined || input.bindingProof === null) return freezeDecision('binding_proof_missing');
  const bindingProof = parseBindingProof(input.bindingProof);
  if (!bindingProof) return freezeDecision('binding_proof_invalid');
  if (!ownersMatch(livePlan, input.persistenceGuardDecision, input.implementationBoundary, bindingProof)) {
    return freezeDecision('owner_mismatch');
  }
  if (
    !Array.isArray(input.proposedFutureWriteSet)
    || !sameSortedStringList(input.proposedFutureWriteSet.filter((value): value is string => typeof value === 'string'), expectedFutureWriteSet())
    || input.proposedFutureWriteSet.length !== expectedFutureWriteSet().length
    || !sameSortedStringList(livePlan.exactHighRiskWriteSet, bindingProof.exactFutureWriteSet)
  ) {
    return freezeDecision('future_write_set_invalid');
  }
  if (!checkpointRollbackProofMatches(livePlan, bindingProof)) {
    return freezeDecision('checkpoint_rollback_proof_invalid');
  }
  if (!secretPostureMatches(livePlan, bindingProof)) {
    return freezeDecision('secret_posture_invalid');
  }
  if (livePlan.requiresAdminApprovalBeforePersistence !== true) return freezeDecision('admin_approval_missing');
  if (bindingProof.adminApprovalGranted !== true || bindingProof.adminApprovalReviewed !== true) {
    return freezeDecision('admin_approval_invalid');
  }

  return freezeDecision('durable_persistence_runtime_activation_plan_ready', livePlan, bindingProof);
}
