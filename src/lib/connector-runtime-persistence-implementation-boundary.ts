import { isSecretLikeFieldName } from './connector-credential-boundary';
import type {
  ConnectorRuntimeImportExportReadinessPlanDecision,
  ConnectorRuntimeImportExportReadinessOwner,
} from './connector-runtime-import-export-readiness-plan';
import type { ConnectorRuntimePersistenceGuardDecision } from './connector-runtime-persistence-guard';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type ConnectorRuntimePersistenceImplementationSection =
  | 'schema'
  | 'types'
  | 'backup'
  | 'export'
  | 'import'
  | 'restore'
  | 'sync'
  | 'cascade'
  | 'redaction'
  | 'rollback';

export interface ConnectorRuntimePersistenceImplementationRequirement {
  section: ConnectorRuntimePersistenceImplementationSection;
  label: string;
  requiredEvidence: string;
  requiredFiles: readonly string[];
}

export interface ConnectorRuntimePersistenceImplementationEvidenceDescriptor {
  section: ConnectorRuntimePersistenceImplementationSection;
  evidenceId: string;
  reviewedBy: string;
  reviewedAt: number;
  owner: Partial<ConnectorRuntimeImportExportReadinessOwner>;
  files: readonly string[];
  gate?: string;
}

export interface ConnectorRuntimePersistenceImplementationProof {
  contract: 'connector-runtime-persistence-implementation-proof-v1';
  proofOwner: 'assistantcaddy-head-chat-connector-runtime-persistence-implementation';
  proofId: string;
  proofVersion: string;
  providerId: string;
  connectorId: string;
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
  acknowledgedChecklistOnly: true;
  acknowledgedNoStorageActions: true;
  reviewState: 'reviewed';
  sideEffects: 'none';
  sideEffectBoundary: 'connector-runtime-persistence-implementation-proof-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials';
}

export interface ConnectorRuntimePersistenceImplementationResultProof {
  contract: 'connector-runtime-persistence-implementation-result-v1';
  resultOwner: 'assistantcaddy-connector-runtime-persistence-implementation-boundary';
  resultId: string;
  sourceBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1';
  providerId: string;
  connectorId: string;
  targetSurface?: string;
  checkpointProofId: string;
  rollbackProofId: string;
  secretRedactionProofId: string;
  persisted: false;
  schemaChanged: false;
  exported: false;
  imported: false;
  restored: false;
  synced: false;
  storageRead: false;
  storageWritten: false;
  migrationRan: false;
  generatedArtifacts: false;
  promotedStandalone: false;
  executable: false;
  sideEffects: 'none';
  sideEffectBoundary: 'connector-runtime-persistence-implementation-result-metadata-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials';
}

export interface ConnectorRuntimePersistenceImplementationBoundaryInput {
  owner?: Partial<ConnectorRuntimeImportExportReadinessOwner>;
  importExportReadinessPlanDecision?: ConnectorRuntimeImportExportReadinessPlanDecision | null;
  persistenceGuardDecision?: ConnectorRuntimePersistenceGuardDecision | null;
  evidence: readonly ConnectorRuntimePersistenceImplementationEvidenceDescriptor[];
  implementationProof?: unknown;
  proposedFutureWriteSet?: readonly unknown[] | null;
  liveActivationDecision?: unknown;
  runtimeActivationPlanDecision?: unknown;
  implementationResult?: unknown;
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
  readyForDurableImplementation?: false;
}

export type ConnectorRuntimePersistenceImplementationBoundaryStatus =
  | 'implementation-checklist-ready'
  | 'blocked';

export type ConnectorRuntimePersistenceImplementationBoundaryBlockerCode =
  | 'owner_missing'
  | 'owner_unsafe'
  | 'readiness_plan_missing'
  | 'readiness_plan_blocked'
  | 'readiness_plan_boundary_invalid'
  | 'readiness_plan_owner_mismatch'
  | 'persistence_guard_missing'
  | 'persistence_guard_blocked'
  | 'persistence_guard_boundary_invalid'
  | 'persistence_guard_owner_mismatch'
  | 'implementation_evidence_missing'
  | 'implementation_evidence_section_missing'
  | 'implementation_evidence_incomplete'
  | 'implementation_evidence_owner_mismatch'
  | 'implementation_evidence_file_missing'
  | 'raw_secret_or_token_evidence'
  | 'forged_implementation_ready_flag'
  | 'runtime_shape_forbidden'
  | 'storage_shape_forbidden'
  | 'schema_writer_forbidden'
  | 'operation_callback_forbidden'
  | 'forged_runtime_flag'
  | 'future_write_set_invalid'
  | 'implementation_proof_missing'
  | 'implementation_proof_invalid'
  | 'checkpoint_rollback_proof_invalid'
  | 'admin_approval_invalid'
  | 'secret_posture_invalid'
  | 'live_activation_provenance_invalid'
  | 'runtime_activation_plan_provenance_invalid'
  | 'implementation_result_forbidden'
  | 'implementation_result_owner_mismatch'
  | 'implementation_result_live_claim';

export interface ConnectorRuntimePersistenceImplementationBoundaryBlocker {
  code: ConnectorRuntimePersistenceImplementationBoundaryBlockerCode;
  detail: string;
  field?: string;
}

export interface ConnectorRuntimePersistenceImplementationBoundaryMetadata {
  schemaVersion: 1;
  contract: 'connector-runtime-persistence-implementation-boundary-v1';
  providerId?: string;
  connectorId?: string;
  targetSurface?: string;
  importExportReadinessContract?: 'connector-runtime-import-export-readiness-plan-v1';
  importExportReadinessStatus?: string;
  persistenceGuardContract?: 'connector-runtime-persistence-guard-v1';
  persistenceGuardStatus?: string;
  requirementCount: number;
  evidenceDescriptorCount: number;
  reviewedEvidenceCount: number;
  missingSectionCount: number;
  sections: readonly ConnectorRuntimePersistenceImplementationSection[];
  missingSections: readonly ConnectorRuntimePersistenceImplementationSection[];
  requirements: readonly ConnectorRuntimePersistenceImplementationRequirement[];
}

export interface ConnectorRuntimePersistenceImplementationBoundaryDecision {
  status: ConnectorRuntimePersistenceImplementationBoundaryStatus;
  readyForDurableRuntimeImplementation: boolean;
  executablePersistenceContract?: false;
  executableFeasibility?: 'blocked-requires-broader-durable-write-set';
  mayPersistRuntimeState: false;
  mayCreateDexieSchema: false;
  mayBackupOrExportRuntimeState: false;
  mayImportOrRestoreRuntimeState: false;
  maySyncRuntimeState: false;
  sideEffects: 'none';
  sideEffectBoundary: 'implementation-checklist-only-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials';
  storageDirective: 'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import';
  metadata: ConnectorRuntimePersistenceImplementationBoundaryMetadata;
  blockers: readonly ConnectorRuntimePersistenceImplementationBoundaryBlocker[];
}

const SIDE_EFFECT_BOUNDARY =
  'implementation-checklist-only-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials' as const;
const IMPLEMENTATION_PROOF_BOUNDARY =
  'connector-runtime-persistence-implementation-proof-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials' as const;
const IMPLEMENTATION_RESULT_BOUNDARY =
  'connector-runtime-persistence-implementation-result-metadata-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials' as const;
const LIVE_ACTIVATION_DECISION_BOUNDARY =
  'durable-persistence-live-activation-gate-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials' as const;
const LIVE_ACTIVATION_PLAN_BOUNDARY =
  'durable-persistence-live-activation-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials' as const;
const RUNTIME_ACTIVATION_DECISION_BOUNDARY =
  'durable-persistence-runtime-activation-plan-decision-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials' as const;
const RUNTIME_ACTIVATION_PLAN_BOUNDARY =
  'durable-persistence-runtime-activation-plan-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials' as const;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:@/+~-]+$/;
const WRITE_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/@+~-]{0,239}$/;
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_WRITE_PATH_LENGTH = 240;
const MAX_EVIDENCE_LENGTH = 240;

const TOKEN_VALUE_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:[^/]/i,
  /[a-z][a-z0-9+.-]*:\/\//i,
  /\/\/[a-z0-9.-]+/i,
  /[^/\s:@]+:[^/\s:@]+@[a-z0-9.-]+/i,
  /hooks\.slack\.com\/services\//i,
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

const TOKEN_IDENTIFIER_MARKERS = [
  'token',
  'secret',
  'password',
  'apikey',
  'apitoken',
  'accesskey',
  'privatekey',
  'authorization',
  'bearer',
  'oauth',
] as const;

const ROOT_KEYS = new Set([
  'backupCallback',
  'db',
  'dexie',
  'evidence',
  'executable',
  'exportCallback',
  'fetch',
  'implementationProof',
  'implementationResult',
  'importCallback',
  'importExportReadinessPlanDecision',
  'liveAction',
  'liveActivationDecision',
  'migrationRunner',
  'owner',
  'persistenceGuardDecision',
  'proposedFutureWriteSet',
  'readyForDurableImplementation',
  'requester',
  'restoreCallback',
  'runtimeActivationPlanDecision',
  'schemaWriter',
  'socket',
  'storage',
  'storageAdapter',
  'storageResult',
]);

const IMPLEMENTATION_PROOF_KEYS = new Set([
  'acknowledgedChecklistOnly',
  'acknowledgedNoStorageActions',
  'adminApprovalGranted',
  'adminApprovalReviewed',
  'checkpointProofId',
  'checkpointProofReviewed',
  'connectorId',
  'contract',
  'exactFutureWriteSet',
  'exportImportBackupRestoreOwnershipReviewed',
  'noBackupLeakage',
  'noExportLeakage',
  'noImportPlaintextSecret',
  'noRawSecretGuarantee',
  'noSchemaRawSecretFields',
  'proofId',
  'proofOwner',
  'proofVersion',
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

const IMPLEMENTATION_RESULT_KEYS = new Set([
  'checkpointProofId',
  'connectorId',
  'contract',
  'executable',
  'exported',
  'generatedArtifacts',
  'imported',
  'migrationRan',
  'persisted',
  'promotedStandalone',
  'providerId',
  'restored',
  'resultId',
  'resultOwner',
  'rollbackProofId',
  'schemaChanged',
  'secretRedactionProofId',
  'sideEffectBoundary',
  'sideEffects',
  'sourceBoundaryContract',
  'storageRead',
  'storageWritten',
  'synced',
  'targetSurface',
]);

const LIVE_ACTIVATION_DECISION_KEYS = new Set([
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

const LIVE_ACTIVATION_PLAN_KEYS = new Set([
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

const RUNTIME_ACTIVATION_DECISION_KEYS = new Set([
  'executable',
  'implementationPlan',
  'mayBackupOrExportRuntimeState',
  'mayCallProvider',
  'mayCreateDexieSchema',
  'mayFetch',
  'mayImportOrRestoreRuntimeState',
  'mayInvokeSchemaWriter',
  'mayOpenSocket',
  'mayOpenStorageAdapter',
  'mayPersistRuntimeState',
  'mayPrepareRuntimeActivationImplementation',
  'mayReadStorage',
  'mayRunExportImportBackupRestore',
  'mayRunMigration',
  'maySyncRuntimeState',
  'mayWriteStorage',
  'ready',
  'readyForDurablePersistenceImplementation',
  'reason',
  'requiresAdminApprovalBeforePersistence',
  'requiresCheckpointBeforeMigration',
  'sideEffectBoundary',
  'sideEffects',
  'status',
  'willGenerateArtifacts',
  'willPromoteStandalone',
]);

const RUNTIME_ACTIVATION_PLAN_KEYS = new Set([
  'activationId',
  'adminApprovalGranted',
  'checkpointProofId',
  'connectorId',
  'contract',
  'exactFutureWriteSet',
  'executable',
  'exportImportBackupRestoreActions',
  'implementationBoundaryContract',
  'implementationMode',
  'migrationActions',
  'noBackupLeakage',
  'noExportLeakage',
  'noImportPlaintextSecret',
  'noRawSecretGuarantee',
  'noSchemaRawSecretFields',
  'persistenceGuardContract',
  'planId',
  'planOwner',
  'planVersion',
  'providerId',
  'requiresAdminApprovalBeforePersistence',
  'requiresCheckpointBeforeMigration',
  'reviewedExportImportBackupRestoreOwner',
  'reviewedOperations',
  'reviewedSchemaOwner',
  'rollbackProofId',
  'schemaActions',
  'secretRedactionProofId',
  'sideEffectBoundary',
  'sideEffects',
  'storageActions',
  'targetSurface',
]);

const OWNER_KEYS = new Set([
  'providerId',
  'connectorId',
  'targetSurface',
]);

const EVIDENCE_DESCRIPTOR_KEYS = new Set([
  'section',
  'evidenceId',
  'reviewedBy',
  'reviewedAt',
  'owner',
  'files',
  'gate',
]);

const READINESS_DECISION_KEYS = new Set([
  'status',
  'readyForSchemaChange',
  'readyForExport',
  'readyForImport',
  'readyForPersistence',
  'sideEffects',
  'sideEffectBoundary',
  'storageDirective',
  'metadata',
  'blockers',
]);

const READINESS_METADATA_KEYS = new Set([
  'schemaVersion',
  'contract',
  'providerId',
  'connectorId',
  'targetSurface',
  'persistenceGuardContract',
  'persistenceGuardRequestKind',
  'persistenceGuardStatus',
  'evidenceSectionCount',
  'evidenceDescriptorCount',
  'reviewedEvidenceCount',
  'missingSectionCount',
  'sections',
  'missingSections',
]);

const PERSISTENCE_GUARD_DECISION_KEYS = new Set([
  'status',
  'mayUseSessionOnlyRuntimeState',
  'mayPersistRuntimeState',
  'mayCreateDexieSchema',
  'mayBackupOrExportRuntimeState',
  'mayImportOrRestoreRuntimeState',
  'maySyncRuntimeState',
  'storageDirective',
  'sideEffects',
  'sideEffectBoundary',
  'metadata',
  'blockers',
]);

const PERSISTENCE_GUARD_METADATA_KEYS = new Set([
  'schemaVersion',
  'contract',
  'requestKind',
  'providerId',
  'connectorId',
  'targetSurface',
  'stateLabel',
  'proposedFieldCount',
  'migrationLabelCount',
  'exportKeyCount',
  'reviewedPlanId',
  'reviewedPlanEvidenceCount',
]);

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

const DISALLOWED_FUTURE_WRITE_PATTERNS = [
  /(^|\/)dist($|\/)/,
  /(^|\/)dist-single($|\/)/,
  /(^|\/)docs($|\/)/,
  /(^|\/)node_modules($|\/)/,
  /(^|\/)package\.json$/i,
  /(^|\/)pnpm-lock\.yaml$/i,
  /(^|\/)public($|\/)/,
  /(^|\/)src\/components($|\/)/i,
  /(^|\/)threatcaddy-standalone\.html$/i,
  /\.html$/i,
  /standalone/i,
] as const;

export const CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS: readonly ConnectorRuntimePersistenceImplementationRequirement[] = Object.freeze([
  Object.freeze({
    section: 'schema',
    label: 'Browser database schema migration',
    requiredEvidence: 'Reviewed browser database table, schema version, migration, downgrade/rollback, and no-raw-secret storage evidence.',
    requiredFiles: Object.freeze(['src/db.ts']),
  }),
  Object.freeze({
    section: 'types',
    label: 'Runtime state TypeScript types',
    requiredEvidence: 'Reviewed entity type, schema-version typing, settings/entity ownership, and narrow import boundary evidence.',
    requiredFiles: Object.freeze(['src/types.ts']),
  }),
  Object.freeze({
    section: 'backup',
    label: 'Encrypted backup payload coverage',
    requiredEvidence: 'Reviewed backup payload inclusion/exclusion, encryption boundary, and restore-safe absence behavior evidence.',
    requiredFiles: Object.freeze(['src/lib/backup-data.ts', 'src/lib/backup-restore.ts', 'src/lib/backup-crypto.ts']),
  }),
  Object.freeze({
    section: 'export',
    label: 'JSON export coverage',
    requiredEvidence: 'Reviewed export key, redaction, classification/scope, and no-credential material evidence.',
    requiredFiles: Object.freeze(['src/lib/export.ts']),
  }),
  Object.freeze({
    section: 'import',
    label: 'JSON import validation',
    requiredEvidence: 'Reviewed parser validation, merge/full-replace behavior, malformed payload handling, and owner binding evidence.',
    requiredFiles: Object.freeze(['src/lib/export.ts']),
  }),
  Object.freeze({
    section: 'restore',
    label: 'Backup restore validation',
    requiredEvidence: 'Reviewed restore merge/replacement behavior, failure rollback, and version compatibility evidence.',
    requiredFiles: Object.freeze(['src/lib/backup-restore.ts']),
  }),
  Object.freeze({
    section: 'sync',
    label: 'Sync and network boundary',
    requiredEvidence: 'Reviewed local/team sync ownership, no-provider-network boundary, conflict behavior, and offline fallback evidence.',
    requiredFiles: Object.freeze([
      'src/lib/sync-engine.ts',
      'src/lib/sync-middleware.ts',
      'src/lib/sync-sanitize.ts',
      'src/lib/cloud-sync.ts',
      'server/src/index.ts',
      'server/src/types.ts',
    ]),
  }),
  Object.freeze({
    section: 'cascade',
    label: 'Cascade cleanup and orphan handling',
    requiredEvidence: 'Reviewed provider/account/investigation deletion cascade and orphan cleanup evidence.',
    requiredFiles: Object.freeze(['src/hooks/useFolders.ts']),
  }),
  Object.freeze({
    section: 'redaction',
    label: 'Secret redaction and token scanning',
    requiredEvidence: 'Reviewed raw-secret prohibition, redaction, token-shaped identifier scan, and export/import scrub evidence.',
    requiredFiles: Object.freeze(['src/lib/connector-credential-boundary.ts']),
  }),
  Object.freeze({
    section: 'rollback',
    label: 'Migration rollback and artifact recovery',
    requiredEvidence: 'Reviewed migration rollback plan, rollback tests, checkpoint coverage, and standalone parity evidence.',
    requiredFiles: Object.freeze(['scripts/assistantcaddy-rollout-checkpoint.mjs']),
  }),
]);

const REQUIRED_SECTIONS = Object.freeze(
  CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.map((requirement) => requirement.section),
);

const READINESS_SECTIONS = Object.freeze([
  'schema',
  'types',
  'backup',
  'export',
  'import',
  'restore',
  'cascade',
  'redaction',
  'rollback',
  'standalone-parity',
] as const);

function blocker(
  code: ConnectorRuntimePersistenceImplementationBoundaryBlockerCode,
  detail: string,
  field?: string,
): ConnectorRuntimePersistenceImplementationBoundaryBlocker {
  return Object.freeze({ code, detail, field });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

interface SafeBoundarySnapshot {
  value: unknown;
  unsafeAccess: boolean;
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

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function sameStringList(left: readonly unknown[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameSortedStringList(left: readonly string[], right: readonly string[]): boolean {
  return sameStringList([...left].sort(), [...right].sort());
}

function exactStringSet(value: unknown, expected: readonly string[]): value is readonly string[] {
  return Array.isArray(value)
    && value.every((entry): entry is string => typeof entry === 'string')
    && value.length === expected.length
    && sameSortedStringList(value, expected);
}

function emptyStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value)
    && value.length === 0
    && value.every((entry): entry is string => typeof entry === 'string');
}

function expectedFutureWriteSet(): readonly string[] {
  return Object.freeze(
    [...new Set(CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.flatMap((requirement) => requirement.requiredFiles))].sort(),
  );
}

function stringLooksLikeToken(value: string): boolean {
  return TOKEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function identifierContainsTokenMarker(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return TOKEN_IDENTIFIER_MARKERS.some((marker) => normalized.includes(marker));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_IDENTIFIER_LENGTH) return undefined;
  if (!IDENTIFIER_PATTERN.test(trimmed)) return undefined;
  if (isSecretLikeFieldName(trimmed) || identifierContainsTokenMarker(trimmed)) return undefined;
  if (stringLooksLikeToken(trimmed)) return undefined;
  return trimmed;
}

function safeEvidenceString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_EVIDENCE_LENGTH) return undefined;
  if (stringLooksLikeToken(trimmed)) return undefined;
  return trimmed;
}

function safeWriteSetPath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_WRITE_PATH_LENGTH) return false;
  if (trimmed.startsWith('/') || trimmed.includes('..') || trimmed.includes('\\')) return false;
  if (!WRITE_PATH_PATTERN.test(trimmed)) return false;
  if (isSecretLikeFieldName(trimmed) || stringLooksLikeToken(trimmed)) return false;
  return !DISALLOWED_FUTURE_WRITE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function futureWriteSetMatchesExact(value: unknown): value is readonly string[] {
  if (!Array.isArray(value) || !value.every(safeWriteSetPath)) return false;
  const strings = value.filter((entry): entry is string => typeof entry === 'string');
  return strings.length === value.length
    && strings.length === expectedFutureWriteSet().length
    && sameSortedStringList(strings, expectedFutureWriteSet());
}

function sanitizedValueHasRawSecretMaterial(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  if (currentKey && isSecretLikeFieldName(currentKey) && !SAFE_SECRET_POSTURE_KEYS.has(currentKey)) return true;
  if (typeof value === 'string') return stringLooksLikeToken(value);
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => sanitizedValueHasRawSecretMaterial(item, seen));
  if (!isRecord(value)) return true;

  return Object.keys(value).some((key) => sanitizedValueHasRawSecretMaterial(value[key], seen, key));
}

function valueHasRawSecretMaterial(value: unknown, seen = new WeakSet<object>(), currentKey?: string): boolean {
  const snapshot = snapshotBoundaryValue(value);
  if (snapshot.unsafeAccess) return true;
  return sanitizedValueHasRawSecretMaterial(snapshot.value, seen, currentKey);
}

function ownerMatches(
  expected: Partial<ConnectorRuntimeImportExportReadinessOwner>,
  actual: Partial<ConnectorRuntimeImportExportReadinessOwner> | undefined,
): boolean {
  if (!actual) return false;
  return actual.providerId === expected.providerId
    && actual.connectorId === expected.connectorId
    && (expected.targetSurface === undefined || actual.targetSurface === expected.targetSurface);
}

function ownerHasUnsafeMaterial(owner: Partial<ConnectorRuntimeImportExportReadinessOwner> | undefined): boolean {
  if (!owner || !isRecord(owner) || !hasOnlyKeys(owner, OWNER_KEYS)) return true;
  return safeIdentifier(owner.providerId) === undefined
    || safeIdentifier(owner.connectorId) === undefined
    || (owner.targetSurface !== undefined && safeIdentifier(owner.targetSurface) === undefined);
}

function addOwnerBlockers(
  blockers: ConnectorRuntimePersistenceImplementationBoundaryBlocker[],
  owner: Partial<ConnectorRuntimeImportExportReadinessOwner> | undefined,
): void {
  if (!owner?.providerId || !owner.connectorId) {
    blockers.push(blocker('owner_missing', 'Implementation boundary requires a provider and connector owner.', 'owner'));
  }
  if (safeIdentifier(owner?.providerId) === undefined) {
    blockers.push(blocker('owner_unsafe', 'Provider owner must be a bounded non-secret identifier.', 'owner.providerId'));
  }
  if (safeIdentifier(owner?.connectorId) === undefined) {
    blockers.push(blocker('owner_unsafe', 'Connector owner must be a bounded non-secret identifier.', 'owner.connectorId'));
  }
  if (owner?.targetSurface !== undefined && safeIdentifier(owner.targetSurface) === undefined) {
    blockers.push(blocker('owner_unsafe', 'Target surface must be a bounded non-secret identifier.', 'owner.targetSurface'));
  }
}

function readinessBoundaryIsValid(decision: ConnectorRuntimeImportExportReadinessPlanDecision): boolean {
  if (!isRecord(decision) || !hasOnlyKeys(decision, READINESS_DECISION_KEYS)) return false;
  const metadata = decision.metadata;
  if (!isRecord(metadata) || !hasOnlyKeys(metadata, READINESS_METADATA_KEYS)) return false;
  return decision.status === 'metadata-only'
    && decision.readyForSchemaChange === false
    && decision.readyForExport === false
    && decision.readyForImport === false
    && decision.readyForPersistence === false
    && decision.sideEffects === 'none'
    && decision.sideEffectBoundary === 'plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-no-credentials'
    && decision.storageDirective === 'metadata-only-do-not-persist-do-not-export-do-not-import'
    && Array.isArray(decision.blockers)
    && decision.blockers.length === 0
    && metadata.schemaVersion === 1
    && metadata.contract === 'connector-runtime-import-export-readiness-plan-v1'
    && (metadata.providerId === undefined || safeIdentifier(metadata.providerId) === metadata.providerId)
    && (metadata.connectorId === undefined || safeIdentifier(metadata.connectorId) === metadata.connectorId)
    && (metadata.targetSurface === undefined || safeIdentifier(metadata.targetSurface) === metadata.targetSurface)
    && (metadata.persistenceGuardContract === undefined || metadata.persistenceGuardContract === 'connector-runtime-persistence-guard-v1')
    && (metadata.persistenceGuardRequestKind === undefined || safeIdentifier(metadata.persistenceGuardRequestKind) === metadata.persistenceGuardRequestKind)
    && (metadata.persistenceGuardStatus === undefined || safeIdentifier(metadata.persistenceGuardStatus) === metadata.persistenceGuardStatus)
    && typeof metadata.evidenceDescriptorCount === 'number'
    && Number.isSafeInteger(metadata.evidenceDescriptorCount)
    && metadata.missingSectionCount === 0
    && emptyStringList(metadata.missingSections)
    && metadata.evidenceSectionCount === READINESS_SECTIONS.length
    && typeof metadata.reviewedEvidenceCount === 'number'
    && Number.isSafeInteger(metadata.reviewedEvidenceCount)
    && exactStringSet(metadata.sections, READINESS_SECTIONS);
}

function guardBoundaryIsValid(decision: ConnectorRuntimePersistenceGuardDecision): boolean {
  if (!isRecord(decision) || !hasOnlyKeys(decision, PERSISTENCE_GUARD_DECISION_KEYS)) return false;
  const metadata = decision.metadata;
  if (!isRecord(metadata) || !hasOnlyKeys(metadata, PERSISTENCE_GUARD_METADATA_KEYS)) return false;
  return decision.status === 'allow-session-only'
    && decision.mayUseSessionOnlyRuntimeState === true
    && decision.mayPersistRuntimeState === false
    && decision.mayCreateDexieSchema === false
    && decision.mayBackupOrExportRuntimeState === false
    && decision.mayImportOrRestoreRuntimeState === false
    && decision.maySyncRuntimeState === false
    && decision.storageDirective === 'session-only-do-not-persist-do-not-export-do-not-sync'
    && decision.sideEffects === 'none'
    && decision.sideEffectBoundary === 'decision-only-no-fetch-no-indexeddb-no-localstorage-no-provider-no-credentials'
    && Array.isArray(decision.blockers)
    && decision.blockers.length === 0
    && metadata.schemaVersion === 1
    && metadata.contract === 'connector-runtime-persistence-guard-v1'
    && (metadata.requestKind === undefined || safeIdentifier(metadata.requestKind) === metadata.requestKind)
    && (metadata.providerId === undefined || safeIdentifier(metadata.providerId) === metadata.providerId)
    && (metadata.connectorId === undefined || safeIdentifier(metadata.connectorId) === metadata.connectorId)
    && (metadata.targetSurface === undefined || safeIdentifier(metadata.targetSurface) === metadata.targetSurface)
    && (metadata.stateLabel === undefined || safeIdentifier(metadata.stateLabel) === metadata.stateLabel)
    && (metadata.reviewedPlanId === undefined || safeIdentifier(metadata.reviewedPlanId) === metadata.reviewedPlanId)
    && typeof metadata.proposedFieldCount === 'number'
    && Number.isSafeInteger(metadata.proposedFieldCount)
    && typeof metadata.migrationLabelCount === 'number'
    && Number.isSafeInteger(metadata.migrationLabelCount)
    && typeof metadata.exportKeyCount === 'number'
    && Number.isSafeInteger(metadata.exportKeyCount)
    && typeof metadata.reviewedPlanEvidenceCount === 'number'
    && Number.isSafeInteger(metadata.reviewedPlanEvidenceCount);
}

function addReadinessBlockers(
  blockers: ConnectorRuntimePersistenceImplementationBoundaryBlocker[],
  owner: Partial<ConnectorRuntimeImportExportReadinessOwner> | undefined,
  decision: ConnectorRuntimeImportExportReadinessPlanDecision | null | undefined,
): void {
  if (!decision) {
    blockers.push(blocker('readiness_plan_missing', 'Implementation boundary requires the import/export readiness plan decision.', 'importExportReadinessPlanDecision'));
    return;
  }
  if (decision.status !== 'metadata-only' || decision.blockers.length > 0) {
    blockers.push(blocker('readiness_plan_blocked', 'Implementation boundary requires an unblocked metadata-only import/export readiness decision.', 'importExportReadinessPlanDecision.status'));
  }
  if (!readinessBoundaryIsValid(decision)) {
    blockers.push(blocker('readiness_plan_boundary_invalid', 'Readiness decision must preserve the exact metadata-only no-storage/no-import/no-export boundary and complete section coverage.', 'importExportReadinessPlanDecision'));
  }
  if (!ownerMatches(owner ?? {}, decision.metadata)) {
    blockers.push(blocker('readiness_plan_owner_mismatch', 'Readiness decision owner metadata must match the implementation boundary owner.', 'importExportReadinessPlanDecision.metadata'));
  }
}

function addPersistenceGuardBlockers(
  blockers: ConnectorRuntimePersistenceImplementationBoundaryBlocker[],
  owner: Partial<ConnectorRuntimeImportExportReadinessOwner> | undefined,
  decision: ConnectorRuntimePersistenceGuardDecision | null | undefined,
): void {
  if (!decision) {
    blockers.push(blocker('persistence_guard_missing', 'Implementation boundary requires the connector runtime persistence guard decision.', 'persistenceGuardDecision'));
    return;
  }
  if (decision.status !== 'allow-session-only' || decision.blockers.length > 0) {
    blockers.push(blocker('persistence_guard_blocked', 'Implementation boundary requires an unblocked allow-session-only persistence guard decision.', 'persistenceGuardDecision.status'));
  }
  if (!guardBoundaryIsValid(decision)) {
    blockers.push(blocker('persistence_guard_boundary_invalid', 'Persistence guard must preserve the exact session-only no-durable-state boundary.', 'persistenceGuardDecision'));
  }
  if (!ownerMatches(owner ?? {}, decision.metadata)) {
    blockers.push(blocker('persistence_guard_owner_mismatch', 'Persistence guard owner metadata must match the implementation boundary owner.', 'persistenceGuardDecision.metadata'));
  }
}

function addForgedReadyFlagBlockers(
  blockers: ConnectorRuntimePersistenceImplementationBoundaryBlocker[],
  input: ConnectorRuntimePersistenceImplementationBoundaryInput,
): void {
  if (input.readyForDurableImplementation !== undefined && input.readyForDurableImplementation !== false) {
    blockers.push(blocker(
      'forged_implementation_ready_flag',
      'Implementation readiness is derived by this boundary and cannot be supplied as true by callers.',
      'readyForDurableImplementation',
    ));
  }
  if (input.executable !== undefined && input.executable !== false) {
    blockers.push(blocker(
      'forged_runtime_flag',
      'Implementation boundary cannot accept caller-supplied executable runtime claims.',
      'executable',
    ));
  }
}

function addRootShapeBlockers(
  blockers: ConnectorRuntimePersistenceImplementationBoundaryBlocker[],
  rawInput: unknown,
  input: ConnectorRuntimePersistenceImplementationBoundaryInput,
): void {
  if (!isRecord(rawInput)) {
    blockers.push(blocker('runtime_shape_forbidden', 'Implementation boundary input must be a plain object.', 'input'));
    return;
  }
  if (!hasOnlyKeys(rawInput, ROOT_KEYS)) {
    blockers.push(blocker('runtime_shape_forbidden', 'Implementation boundary rejects unexpected requester, callback, storage, migration, result, or live-action fields.', 'input'));
  }
  if (
    input.storageAdapter !== undefined
    || input.storageResult !== undefined
    || input.db !== undefined
    || input.dexie !== undefined
    || input.storage !== undefined
  ) {
    blockers.push(blocker('storage_shape_forbidden', 'Implementation boundary rejects browser database, db, storage adapter, storage result, and browser storage shapes.', 'storage'));
  }
  if (input.schemaWriter !== undefined) {
    blockers.push(blocker('schema_writer_forbidden', 'Implementation boundary rejects schema writers and migration-capable schema callbacks.', 'schemaWriter'));
  }
  if (
    input.exportCallback !== undefined
    || input.importCallback !== undefined
    || input.backupCallback !== undefined
    || input.restoreCallback !== undefined
    || input.migrationRunner !== undefined
  ) {
    blockers.push(blocker('operation_callback_forbidden', 'Implementation boundary rejects export, import, backup, restore, and migration callbacks.', 'callbacks'));
  }
  if (
    input.requester !== undefined
    || input.fetch !== undefined
    || input.socket !== undefined
    || input.liveAction !== undefined
  ) {
    blockers.push(blocker('runtime_shape_forbidden', 'Implementation boundary rejects requester, fetch, socket, and live-action fields.', 'runtime'));
  }
}

function addRawSecretBlockers(
  blockers: ConnectorRuntimePersistenceImplementationBoundaryBlocker[],
  input: ConnectorRuntimePersistenceImplementationBoundaryInput,
): void {
  if (valueHasRawSecretMaterial(input)) {
    blockers.push(blocker(
      'raw_secret_or_token_evidence',
      'Implementation boundary input must not contain raw secrets, token-shaped values, API keys, or bearer/basic authorization headers.',
      'input',
    ));
  }
}

function proofOwnerMatches(
  owner: Partial<ConnectorRuntimeImportExportReadinessOwner> | undefined,
  proof: ConnectorRuntimePersistenceImplementationProof,
): boolean {
  return proof.providerId === owner?.providerId
    && proof.connectorId === owner?.connectorId
    && proof.targetSurface === owner?.targetSurface;
}

function proofCheckpointRollbackMatches(
  proof: ConnectorRuntimePersistenceImplementationProof,
  checkpointProofId?: unknown,
  rollbackProofId?: unknown,
): boolean {
  return proof.checkpointProofReviewed === true
    && proof.rollbackProofReviewed === true
    && (checkpointProofId === undefined || proof.checkpointProofId === checkpointProofId)
    && (rollbackProofId === undefined || proof.rollbackProofId === rollbackProofId);
}

function proofSecretPostureMatches(
  proof: ConnectorRuntimePersistenceImplementationProof,
  secretRedactionProofId?: unknown,
): boolean {
  return proof.secretRedactionReviewed === true
    && (secretRedactionProofId === undefined || proof.secretRedactionProofId === secretRedactionProofId)
    && proof.noRawSecretGuarantee === true
    && proof.noBackupLeakage === true
    && proof.noExportLeakage === true
    && proof.noImportPlaintextSecret === true
    && proof.noSchemaRawSecretFields === true;
}

function parseImplementationProof(
  blockers: ConnectorRuntimePersistenceImplementationBoundaryBlocker[],
  owner: Partial<ConnectorRuntimeImportExportReadinessOwner> | undefined,
  value: unknown,
): ConnectorRuntimePersistenceImplementationProof | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, IMPLEMENTATION_PROOF_KEYS)) {
    blockers.push(blocker('implementation_proof_invalid', 'Implementation proof must be an exact reviewed proof object.', 'implementationProof'));
    return undefined;
  }

  const proofId = safeIdentifier(value.proofId);
  const proofVersion = safeIdentifier(value.proofVersion);
  const providerId = safeIdentifier(value.providerId);
  const connectorId = safeIdentifier(value.connectorId);
  const targetSurface = value.targetSurface === undefined ? undefined : safeIdentifier(value.targetSurface);
  const checkpointProofId = safeIdentifier(value.checkpointProofId);
  const rollbackProofId = safeIdentifier(value.rollbackProofId);
  const secretRedactionProofId = safeIdentifier(value.secretRedactionProofId);
  const exactFutureWriteSet = futureWriteSetMatchesExact(value.exactFutureWriteSet)
    ? Object.freeze([...value.exactFutureWriteSet])
    : Object.freeze([] as string[]);
  let valid = true;

  if (
    value.contract !== 'connector-runtime-persistence-implementation-proof-v1'
    || value.proofOwner !== 'assistantcaddy-head-chat-connector-runtime-persistence-implementation'
    || !proofId
    || !proofVersion
    || !providerId
    || !connectorId
    || (value.targetSurface !== undefined && !targetSurface)
    || value.reviewedSchemaOwner !== 'head-chat'
    || value.reviewedExportImportBackupRestoreOwner !== 'head-chat'
    || value.schemaOwnershipReviewed !== true
    || value.exportImportBackupRestoreOwnershipReviewed !== true
    || exactFutureWriteSet.length === 0
    || value.checkpointProofReviewed !== true
    || value.rollbackProofReviewed !== true
    || !checkpointProofId
    || !rollbackProofId
    || value.secretRedactionReviewed !== true
    || !secretRedactionProofId
    || value.acknowledgedChecklistOnly !== true
    || value.acknowledgedNoStorageActions !== true
    || value.reviewState !== 'reviewed'
    || value.sideEffects !== 'none'
    || value.sideEffectBoundary !== IMPLEMENTATION_PROOF_BOUNDARY
  ) {
    blockers.push(blocker('implementation_proof_invalid', 'Implementation proof must exactly bind reviewed schema/export/import/backup/restore/sync ownership and plan-only posture.', 'implementationProof'));
    valid = false;
  }
  if (
    providerId
    && connectorId
    && !proofOwnerMatches(owner, {
      contract: 'connector-runtime-persistence-implementation-proof-v1',
      proofOwner: 'assistantcaddy-head-chat-connector-runtime-persistence-implementation',
      proofId: proofId ?? 'invalid',
      proofVersion: proofVersion ?? 'invalid',
      providerId,
      connectorId,
      ...(targetSurface ? { targetSurface } : {}),
      reviewedSchemaOwner: 'head-chat',
      reviewedExportImportBackupRestoreOwner: 'head-chat',
      schemaOwnershipReviewed: true,
      exportImportBackupRestoreOwnershipReviewed: true,
      exactFutureWriteSet: Object.freeze([]),
      checkpointProofId: checkpointProofId ?? 'invalid',
      rollbackProofId: rollbackProofId ?? 'invalid',
      checkpointProofReviewed: true,
      rollbackProofReviewed: true,
      secretRedactionProofId: secretRedactionProofId ?? 'invalid',
      secretRedactionReviewed: true,
      noRawSecretGuarantee: true,
      noBackupLeakage: true,
      noExportLeakage: true,
      noImportPlaintextSecret: true,
      noSchemaRawSecretFields: true,
      adminApprovalGranted: true,
      adminApprovalReviewed: true,
      acknowledgedChecklistOnly: true,
      acknowledgedNoStorageActions: true,
      reviewState: 'reviewed',
      sideEffects: 'none',
      sideEffectBoundary: IMPLEMENTATION_PROOF_BOUNDARY,
    })
  ) {
    blockers.push(blocker('implementation_evidence_owner_mismatch', 'Implementation proof owner must match the implementation boundary owner.', 'implementationProof'));
    valid = false;
  }
  if (exactFutureWriteSet.length === 0) {
    blockers.push(blocker('future_write_set_invalid', 'Implementation proof must bind the exact reviewed future write set and reject generated, docs, package, UI, standalone, or secret paths.', 'implementationProof.exactFutureWriteSet'));
    valid = false;
  }
  if (!checkpointProofId || !rollbackProofId || value.checkpointProofReviewed !== true || value.rollbackProofReviewed !== true) {
    blockers.push(blocker('checkpoint_rollback_proof_invalid', 'Implementation proof requires reviewed checkpoint and rollback proof identifiers.', 'implementationProof'));
    valid = false;
  }
  if (value.adminApprovalGranted !== true || value.adminApprovalReviewed !== true) {
    blockers.push(blocker('admin_approval_invalid', 'Implementation proof requires reviewed admin approval before durable persistence can be considered.', 'implementationProof'));
    valid = false;
  }
  if (
    value.noRawSecretGuarantee !== true
    || value.noBackupLeakage !== true
    || value.noExportLeakage !== true
    || value.noImportPlaintextSecret !== true
    || value.noSchemaRawSecretFields !== true
  ) {
    blockers.push(blocker('secret_posture_invalid', 'Implementation proof requires reviewed raw-secret, backup/export/import, and schema redaction guarantees.', 'implementationProof'));
    valid = false;
  }

  if (!valid || !proofId || !proofVersion || !providerId || !connectorId || !checkpointProofId || !rollbackProofId || !secretRedactionProofId) {
    return undefined;
  }

  return Object.freeze({
    contract: 'connector-runtime-persistence-implementation-proof-v1',
    proofOwner: 'assistantcaddy-head-chat-connector-runtime-persistence-implementation',
    proofId,
    proofVersion,
    providerId,
    connectorId,
    ...(targetSurface ? { targetSurface } : {}),
    reviewedSchemaOwner: 'head-chat',
    reviewedExportImportBackupRestoreOwner: 'head-chat',
    schemaOwnershipReviewed: true,
    exportImportBackupRestoreOwnershipReviewed: true,
    exactFutureWriteSet,
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
    acknowledgedChecklistOnly: true,
    acknowledgedNoStorageActions: true,
    reviewState: 'reviewed',
    sideEffects: 'none',
    sideEffectBoundary: IMPLEMENTATION_PROOF_BOUNDARY,
  });
}

function emptyArray(value: unknown): value is readonly [] {
  return Array.isArray(value) && value.length === 0;
}

function liveActivationDecisionLooksBound(
  value: unknown,
  owner: Partial<ConnectorRuntimeImportExportReadinessOwner> | undefined,
  proof?: ConnectorRuntimePersistenceImplementationProof,
): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, LIVE_ACTIVATION_DECISION_KEYS)) return false;
  const plan = value.plan;
  if (!isRecord(plan) || !hasOnlyKeys(plan, LIVE_ACTIVATION_PLAN_KEYS)) return false;
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
    && value.sideEffectBoundary === LIVE_ACTIVATION_DECISION_BOUNDARY
    && plan.contract === 'durable-persistence-live-activation-plan-v1'
    && plan.activationOwner === 'assistantcaddy-head-chat-durable-persistence-live-activation'
    && plan.activationId === 'assistantcaddy-durable-persistence-live-activation-gate'
    && safeIdentifier(plan.activationVersion) !== undefined
    && plan.sourceManifestOwner === 'assistantcaddy-head-chat-durable-persistence-operations'
    && plan.sourceManifestId === 'assistantcaddy-head-chat-durable-persistence-operations-manifest'
    && safeIdentifier(plan.sourceManifestVersion) !== undefined
    && plan.providerId === owner?.providerId
    && plan.connectorId === owner?.connectorId
    && plan.targetSurface === owner?.targetSurface
    && plan.reviewedSchemaOwner === 'head-chat'
    && plan.reviewedExportImportBackupRestoreOwner === 'head-chat'
    && safeIdentifier(plan.migrationPlanId) !== undefined
    && safeIdentifier(plan.checkpointProofId) !== undefined
    && safeIdentifier(plan.rollbackProofId) !== undefined
    && safeIdentifier(plan.secretRedactionProofId) !== undefined
    && proofCheckpointRollbackMatches(proof ?? {
      checkpointProofId: plan.checkpointProofId as string,
      rollbackProofId: plan.rollbackProofId as string,
      checkpointProofReviewed: true,
      rollbackProofReviewed: true,
    } as ConnectorRuntimePersistenceImplementationProof, plan.checkpointProofId, plan.rollbackProofId)
    && proofSecretPostureMatches(proof ?? {
      secretRedactionProofId: plan.secretRedactionProofId as string,
      secretRedactionReviewed: true,
      noRawSecretGuarantee: true,
      noBackupLeakage: true,
      noExportLeakage: true,
      noImportPlaintextSecret: true,
      noSchemaRawSecretFields: true,
    } as ConnectorRuntimePersistenceImplementationProof, plan.secretRedactionProofId)
    && Array.isArray(plan.reviewedOperations)
    && sameStringList(plan.reviewedOperations, REQUIRED_SECTIONS)
    && futureWriteSetMatchesExact(plan.exactHighRiskWriteSet)
    && plan.requiresCheckpointBeforeMigration === true
    && plan.requiresAdminApprovalBeforePersistence === true
    && plan.requiresUserApprovalBeforePersistence === true
    && plan.noRawSecretGuarantee === true
    && plan.noBackupLeakage === true
    && plan.noExportLeakage === true
    && plan.noImportPlaintextSecret === true
    && plan.noSchemaRawSecretFields === true
    && plan.executable === false
    && plan.sideEffects === 'none'
    && emptyArray(plan.storageActions)
    && emptyArray(plan.schemaActions)
    && emptyArray(plan.exportImportBackupRestoreActions)
    && plan.sideEffectBoundary === LIVE_ACTIVATION_PLAN_BOUNDARY;
}

function runtimeActivationPlanLooksBound(
  value: unknown,
  owner: Partial<ConnectorRuntimeImportExportReadinessOwner> | undefined,
  proof?: ConnectorRuntimePersistenceImplementationProof,
): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, RUNTIME_ACTIVATION_DECISION_KEYS)) return false;
  const plan = value.implementationPlan;
  if (!isRecord(plan) || !hasOnlyKeys(plan, RUNTIME_ACTIVATION_PLAN_KEYS)) return false;
  return value.status === 'implementation-plan-ready'
    && value.ready === true
    && value.reason === 'durable_persistence_runtime_activation_plan_ready'
    && value.mayPrepareRuntimeActivationImplementation === true
    && value.readyForDurablePersistenceImplementation === false
    && value.requiresCheckpointBeforeMigration === true
    && value.requiresAdminApprovalBeforePersistence === true
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
    && value.mayRunMigration === false
    && value.mayFetch === false
    && value.mayOpenSocket === false
    && value.mayCallProvider === false
    && value.willGenerateArtifacts === false
    && value.willPromoteStandalone === false
    && value.executable === false
    && value.sideEffects === 'none'
    && value.sideEffectBoundary === RUNTIME_ACTIVATION_DECISION_BOUNDARY
    && plan.contract === 'durable-persistence-runtime-activation-implementation-plan-v1'
    && plan.planOwner === 'assistantcaddy-head-chat-durable-persistence-runtime-activation'
    && plan.planId === 'assistantcaddy-durable-persistence-runtime-activation-plan'
    && safeIdentifier(plan.planVersion) !== undefined
    && plan.activationId === 'assistantcaddy-durable-persistence-live-activation-gate'
    && plan.implementationBoundaryContract === 'connector-runtime-persistence-implementation-boundary-v1'
    && plan.persistenceGuardContract === 'connector-runtime-persistence-guard-v1'
    && plan.providerId === owner?.providerId
    && plan.connectorId === owner?.connectorId
    && plan.targetSurface === owner?.targetSurface
    && plan.reviewedSchemaOwner === 'head-chat'
    && plan.reviewedExportImportBackupRestoreOwner === 'head-chat'
    && Array.isArray(plan.reviewedOperations)
    && sameStringList(plan.reviewedOperations, REQUIRED_SECTIONS)
    && futureWriteSetMatchesExact(plan.exactFutureWriteSet)
    && safeIdentifier(plan.checkpointProofId) !== undefined
    && safeIdentifier(plan.rollbackProofId) !== undefined
    && safeIdentifier(plan.secretRedactionProofId) !== undefined
    && proofCheckpointRollbackMatches(proof ?? {
      checkpointProofId: plan.checkpointProofId as string,
      rollbackProofId: plan.rollbackProofId as string,
      checkpointProofReviewed: true,
      rollbackProofReviewed: true,
    } as ConnectorRuntimePersistenceImplementationProof, plan.checkpointProofId, plan.rollbackProofId)
    && proofSecretPostureMatches(proof ?? {
      secretRedactionProofId: plan.secretRedactionProofId as string,
      secretRedactionReviewed: true,
      noRawSecretGuarantee: true,
      noBackupLeakage: true,
      noExportLeakage: true,
      noImportPlaintextSecret: true,
      noSchemaRawSecretFields: true,
    } as ConnectorRuntimePersistenceImplementationProof, plan.secretRedactionProofId)
    && plan.noRawSecretGuarantee === true
    && plan.noBackupLeakage === true
    && plan.noExportLeakage === true
    && plan.noImportPlaintextSecret === true
    && plan.noSchemaRawSecretFields === true
    && plan.requiresCheckpointBeforeMigration === true
    && plan.requiresAdminApprovalBeforePersistence === true
    && plan.adminApprovalGranted === true
    && plan.executable === false
    && plan.sideEffects === 'none'
    && emptyArray(plan.storageActions)
    && emptyArray(plan.schemaActions)
    && emptyArray(plan.exportImportBackupRestoreActions)
    && emptyArray(plan.migrationActions)
    && plan.implementationMode === 'plan-only'
    && plan.sideEffectBoundary === RUNTIME_ACTIVATION_PLAN_BOUNDARY;
}

function implementationResultClaimsLive(value: Record<string, unknown>): boolean {
  return value.persisted !== false
    || value.schemaChanged !== false
    || value.exported !== false
    || value.imported !== false
    || value.restored !== false
    || value.synced !== false
    || value.storageRead !== false
    || value.storageWritten !== false
    || value.migrationRan !== false
    || value.generatedArtifacts !== false
    || value.promotedStandalone !== false
    || value.executable !== false;
}

function implementationResultLooksOwned(
  value: unknown,
  owner: Partial<ConnectorRuntimeImportExportReadinessOwner> | undefined,
  proof?: ConnectorRuntimePersistenceImplementationProof,
): value is ConnectorRuntimePersistenceImplementationResultProof {
  if (!isRecord(value) || !hasOnlyKeys(value, IMPLEMENTATION_RESULT_KEYS)) return false;
  if (implementationResultClaimsLive(value)) return false;
  return value.contract === 'connector-runtime-persistence-implementation-result-v1'
    && value.resultOwner === 'assistantcaddy-connector-runtime-persistence-implementation-boundary'
    && safeIdentifier(value.resultId) !== undefined
    && value.sourceBoundaryContract === 'connector-runtime-persistence-implementation-boundary-v1'
    && value.providerId === owner?.providerId
    && value.connectorId === owner?.connectorId
    && value.targetSurface === owner?.targetSurface
    && safeIdentifier(value.checkpointProofId) !== undefined
    && safeIdentifier(value.rollbackProofId) !== undefined
    && safeIdentifier(value.secretRedactionProofId) !== undefined
    && (!proof || (
      value.checkpointProofId === proof.checkpointProofId
      && value.rollbackProofId === proof.rollbackProofId
      && value.secretRedactionProofId === proof.secretRedactionProofId
    ))
    && value.sideEffects === 'none'
    && value.sideEffectBoundary === IMPLEMENTATION_RESULT_BOUNDARY;
}

function addProofAndRuntimeBlockers(
  blockers: ConnectorRuntimePersistenceImplementationBoundaryBlocker[],
  input: ConnectorRuntimePersistenceImplementationBoundaryInput,
): void {
  const advancedImplementationShapePresent = input.proposedFutureWriteSet !== undefined
    || input.liveActivationDecision !== undefined
    || input.runtimeActivationPlanDecision !== undefined
    || input.implementationResult !== undefined;

  let proof: ConnectorRuntimePersistenceImplementationProof | undefined;
  if (input.implementationProof !== undefined && input.implementationProof !== null) {
    proof = parseImplementationProof(blockers, input.owner, input.implementationProof);
  } else if (advancedImplementationShapePresent) {
    blockers.push(blocker(
      'implementation_proof_missing',
      'Implementation-shaped runtime inputs require reviewed checkpoint, rollback, admin approval, ownership, and secret-redaction proof.',
      'implementationProof',
    ));
  }

  if (input.proposedFutureWriteSet !== undefined && !futureWriteSetMatchesExact(input.proposedFutureWriteSet)) {
    blockers.push(blocker('future_write_set_invalid', 'Proposed durable implementation write set must exactly match the reviewed schema/export/import/backup/restore/sync source set.', 'proposedFutureWriteSet'));
  }

  if (input.liveActivationDecision !== undefined && !liveActivationDecisionLooksBound(input.liveActivationDecision, input.owner, proof)) {
    blockers.push(blocker('live_activation_provenance_invalid', 'Live activation decision must be exact, plan-only, owner-matched, non-executable, and bound to checkpoint/rollback/secret proof.', 'liveActivationDecision'));
  }

  if (input.runtimeActivationPlanDecision !== undefined && !runtimeActivationPlanLooksBound(input.runtimeActivationPlanDecision, input.owner, proof)) {
    blockers.push(blocker('runtime_activation_plan_provenance_invalid', 'Runtime activation plan must be exact, plan-only, owner-matched, non-executable, and bound to checkpoint/rollback/admin/secret proof.', 'runtimeActivationPlanDecision'));
  }

  if (input.implementationResult !== undefined) {
    if (isRecord(input.implementationResult) && implementationResultClaimsLive(input.implementationResult)) {
      blockers.push(blocker('implementation_result_live_claim', 'Implementation result must not claim storage, schema, export/import, backup/restore, migration, artifact, standalone, or executable effects.', 'implementationResult'));
    } else if (!implementationResultLooksOwned(input.implementationResult, input.owner, proof)) {
      blockers.push(blocker(
        isRecord(input.implementationResult) ? 'implementation_result_owner_mismatch' : 'implementation_result_forbidden',
        'Implementation result metadata must be exact, non-live, owner-matched, and proof-bound before it can be accepted.',
        'implementationResult',
      ));
    }
  }
}

function requirementFor(section: ConnectorRuntimePersistenceImplementationSection): ConnectorRuntimePersistenceImplementationRequirement {
  return CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.find((requirement) => requirement.section === section)!;
}

function addEvidenceBlockers(
  blockers: ConnectorRuntimePersistenceImplementationBoundaryBlocker[],
  input: ConnectorRuntimePersistenceImplementationBoundaryInput,
): {
  readonly sections: readonly ConnectorRuntimePersistenceImplementationSection[];
  readonly missingSections: readonly ConnectorRuntimePersistenceImplementationSection[];
  readonly reviewedEvidenceCount: number;
} {
  const seenSections = new Set<ConnectorRuntimePersistenceImplementationSection>();
  let reviewedEvidenceCount = 0;

  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    blockers.push(blocker('implementation_evidence_missing', 'Implementation boundary requires reviewed evidence for every durable-state implementation section.', 'evidence'));
    return {
      sections: Object.freeze([]),
      missingSections: Object.freeze([...REQUIRED_SECTIONS]),
      reviewedEvidenceCount,
    };
  }

  input.evidence.forEach((descriptor, index) => {
    if (!isRecord(descriptor) || !hasOnlyKeys(descriptor, EVIDENCE_DESCRIPTOR_KEYS)) {
      blockers.push(blocker('runtime_shape_forbidden', 'Implementation evidence descriptors must use exact metadata keys without requester, callback, storage, or live-action fields.', `evidence.${index}`));
      return;
    }
    const evidenceDescriptor = descriptor as unknown as ConnectorRuntimePersistenceImplementationEvidenceDescriptor;
    if (!REQUIRED_SECTIONS.includes(evidenceDescriptor.section)) {
      blockers.push(blocker('implementation_evidence_incomplete', 'Implementation evidence section must be one of the reviewed implementation sections.', `evidence.${index}.section`));
      return;
    }

    seenSections.add(evidenceDescriptor.section);
    const requirement = requirementFor(evidenceDescriptor.section);

    let descriptorIsReviewed = true;

    if (safeIdentifier(evidenceDescriptor.evidenceId) === undefined || safeEvidenceString(evidenceDescriptor.reviewedBy) === undefined) {
      descriptorIsReviewed = false;
      blockers.push(blocker('raw_secret_or_token_evidence', 'Implementation evidence must not contain raw secrets, token-shaped identifiers, or secret-like field names.', `evidence.${index}`));
    }
    if (
      valueHasRawSecretMaterial(evidenceDescriptor.gate)
      || (evidenceDescriptor.gate !== undefined && safeEvidenceString(evidenceDescriptor.gate) === undefined)
    ) {
      descriptorIsReviewed = false;
      blockers.push(blocker('raw_secret_or_token_evidence', 'Implementation evidence gate labels must not contain raw secrets or token-shaped values.', `evidence.${index}.gate`));
    }
    if (typeof evidenceDescriptor.reviewedAt !== 'number' || !Number.isSafeInteger(evidenceDescriptor.reviewedAt) || evidenceDescriptor.reviewedAt <= 0) {
      descriptorIsReviewed = false;
      blockers.push(blocker('implementation_evidence_incomplete', 'Implementation evidence must include a positive reviewed timestamp.', `evidence.${index}.reviewedAt`));
    }
    if (ownerHasUnsafeMaterial(evidenceDescriptor.owner)) {
      descriptorIsReviewed = false;
      blockers.push(blocker('raw_secret_or_token_evidence', 'Implementation evidence owner fields must not contain raw secrets or token-shaped identifiers.', `evidence.${index}.owner`));
    }
    if (!ownerMatches(input.owner ?? {}, evidenceDescriptor.owner)) {
      descriptorIsReviewed = false;
      blockers.push(blocker('implementation_evidence_owner_mismatch', 'Implementation evidence owner must match the implementation boundary owner.', `evidence.${index}.owner`));
    }
    if (!Array.isArray(evidenceDescriptor.files) || evidenceDescriptor.files.length === 0) {
      descriptorIsReviewed = false;
      blockers.push(blocker('implementation_evidence_incomplete', 'Implementation evidence must name reviewed source files for the section.', `evidence.${index}.files`));
    } else {
      const files: readonly string[] = evidenceDescriptor.files;
      files.forEach((file, fileIndex) => {
        if (safeIdentifier(file) === undefined) {
          descriptorIsReviewed = false;
          blockers.push(blocker('raw_secret_or_token_evidence', 'Implementation evidence file labels must be bounded non-secret paths.', `evidence.${index}.files.${fileIndex}`));
        }
      });
      requirement.requiredFiles.forEach((requiredFile) => {
        if (!files.includes(requiredFile)) {
          descriptorIsReviewed = false;
          blockers.push(blocker('implementation_evidence_file_missing', 'Implementation evidence must include every required source file for its section.', `evidence.${index}.files`));
        }
      });
    }

    if (descriptorIsReviewed) reviewedEvidenceCount += 1;
  });

  const sections = REQUIRED_SECTIONS.filter((section) => seenSections.has(section));
  const missingSections = REQUIRED_SECTIONS.filter((section) => !seenSections.has(section));
  missingSections.forEach((section) => {
    blockers.push(blocker('implementation_evidence_section_missing', 'Implementation boundary is missing a required durable-state evidence section.', `evidence.${section}`));
  });

  return {
    sections: Object.freeze(sections),
    missingSections: Object.freeze(missingSections),
    reviewedEvidenceCount,
  };
}

export function evaluateConnectorRuntimePersistenceImplementationBoundary(
  input: ConnectorRuntimePersistenceImplementationBoundaryInput,
): ConnectorRuntimePersistenceImplementationBoundaryDecision {
  const blockers: ConnectorRuntimePersistenceImplementationBoundaryBlocker[] = [];

  if (!isRuntimeTrustedContractObject(input)) {
    blockers.push(blocker(
      'runtime_shape_forbidden',
      'Implementation boundary input must be built by the runtime trusted contract object boundary before validation.',
      'input',
    ));
    return Object.freeze({
      status: 'blocked',
      readyForDurableRuntimeImplementation: false,
      executablePersistenceContract: false,
      executableFeasibility: 'blocked-requires-broader-durable-write-set',
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
      mayBackupOrExportRuntimeState: false,
      mayImportOrRestoreRuntimeState: false,
      maySyncRuntimeState: false,
      sideEffects: 'none',
      sideEffectBoundary: SIDE_EFFECT_BOUNDARY,
      storageDirective: 'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import',
      metadata: Object.freeze({
        schemaVersion: 1 as const,
        contract: 'connector-runtime-persistence-implementation-boundary-v1' as const,
        requirementCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
        evidenceDescriptorCount: 0,
        reviewedEvidenceCount: 0,
        missingSectionCount: REQUIRED_SECTIONS.length,
        sections: Object.freeze([]),
        missingSections: Object.freeze([...REQUIRED_SECTIONS]),
        requirements: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS,
      }),
      blockers: Object.freeze(blockers),
    });
  }

  const inputSnapshot = snapshotBoundaryValue(input);
  const safeInput = inputSnapshot.value;
  const boundaryInput = isRecord(safeInput)
    ? safeInput as unknown as ConnectorRuntimePersistenceImplementationBoundaryInput
    : { evidence: [] } as unknown as ConnectorRuntimePersistenceImplementationBoundaryInput;

  if (inputSnapshot.unsafeAccess) {
    blockers.push(blocker(
      'runtime_shape_forbidden',
      'Implementation boundary input must use enumerable data properties only; accessors, symbols, non-plain objects, and unsafe descriptors are rejected before validation.',
      'input',
    ));
  }

  addRootShapeBlockers(blockers, safeInput, boundaryInput);
  addRawSecretBlockers(blockers, boundaryInput);
  addOwnerBlockers(blockers, boundaryInput.owner);
  addForgedReadyFlagBlockers(blockers, boundaryInput);
  addProofAndRuntimeBlockers(blockers, boundaryInput);
  addReadinessBlockers(blockers, boundaryInput.owner, boundaryInput.importExportReadinessPlanDecision);
  addPersistenceGuardBlockers(blockers, boundaryInput.owner, boundaryInput.persistenceGuardDecision);
  const evidenceSummary = addEvidenceBlockers(blockers, boundaryInput);

  const metadata = Object.freeze({
    schemaVersion: 1 as const,
    contract: 'connector-runtime-persistence-implementation-boundary-v1' as const,
    providerId: safeIdentifier(boundaryInput.owner?.providerId),
    connectorId: safeIdentifier(boundaryInput.owner?.connectorId),
    targetSurface: safeIdentifier(boundaryInput.owner?.targetSurface),
    importExportReadinessContract: boundaryInput.importExportReadinessPlanDecision?.metadata.contract,
    importExportReadinessStatus: boundaryInput.importExportReadinessPlanDecision?.status,
    persistenceGuardContract: boundaryInput.persistenceGuardDecision?.metadata.contract,
    persistenceGuardStatus: boundaryInput.persistenceGuardDecision?.status,
    requirementCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
    evidenceDescriptorCount: Array.isArray(boundaryInput.evidence) ? boundaryInput.evidence.length : 0,
    reviewedEvidenceCount: evidenceSummary.reviewedEvidenceCount,
    missingSectionCount: evidenceSummary.missingSections.length,
    sections: evidenceSummary.sections,
    missingSections: evidenceSummary.missingSections,
    requirements: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS,
  });

  return Object.freeze({
    status: blockers.length === 0 ? 'implementation-checklist-ready' : 'blocked',
    readyForDurableRuntimeImplementation: blockers.length === 0,
    executablePersistenceContract: false,
    executableFeasibility: 'blocked-requires-broader-durable-write-set',
    mayPersistRuntimeState: false,
    mayCreateDexieSchema: false,
    mayBackupOrExportRuntimeState: false,
    mayImportOrRestoreRuntimeState: false,
    maySyncRuntimeState: false,
    sideEffects: 'none',
    sideEffectBoundary: SIDE_EFFECT_BOUNDARY,
    storageDirective: 'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import',
    metadata,
    blockers: Object.freeze(blockers),
  });
}
