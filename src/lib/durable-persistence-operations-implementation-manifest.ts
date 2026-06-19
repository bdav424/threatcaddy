import {
  hasConnectorSecretMaterial,
  isSecretLikeFieldName,
} from './connector-credential-boundary';
import {
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  type ConnectorRuntimeDurableStateImplementationManifestDecision,
} from './connector-runtime-durable-state-implementation-manifest';
import {
  CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS,
  type ConnectorRuntimePersistenceImplementationSection,
} from './connector-runtime-persistence-implementation-boundary';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type DurablePersistenceOperationsImplementationManifestStatus =
  | 'operations-manifest-ready'
  | 'blocked';

export type DurablePersistenceOperationsImplementationManifestReason =
  | 'operations_manifest_ready'
  | 'input_shape_forbidden'
  | 'unsafe_input_field'
  | 'source_manifest_missing'
  | 'source_manifest_not_ready'
  | 'source_manifest_invalid'
  | 'source_owner_invalid'
  | 'source_boundary_invalid'
  | 'source_manifest_stale'
  | 'operation_order_invalid'
  | 'high_risk_write_set_invalid'
  | 'checkpoint_requirements_invalid'
  | 'rollback_requirements_invalid'
  | 'raw_secret_material';

export type DurablePersistenceOperation = ConnectorRuntimePersistenceImplementationSection;

export type DurablePersistenceOperationsBlockedPathClass =
  | 'generated-artifacts'
  | 'docs'
  | 'standalone'
  | 'package-files'
  | 'ui'
  | 'credentials-or-secrets';

export type DurablePersistenceOperationsCheckpointRequirement =
  | 'source-sanity'
  | 'typescript-noemit'
  | 'typescript-build'
  | 'focused-vitest'
  | 'schema-export-import-backup-review'
  | 'static-secret-scan'
  | 'git-diff-check'
  | 'recovery-checkpoint'
  | 'head-chat-ledger-handoff-update';

export type DurablePersistenceOperationsRollbackRequirement =
  | 'head-chat-owned-revert-plan'
  | 'checkpoint-restore-path'
  | 'migration-downgrade-or-forward-fix-plan'
  | 'import-export-restore-failure-recovery-plan'
  | 'standalone-promotion-hold';

export interface DurablePersistenceOperationPlanEntry {
  operation: DurablePersistenceOperation;
  requiredFiles: readonly string[];
  checkpointRequired: true;
  rollbackRequired: true;
}

export interface DurablePersistenceOperationsImplementationManifest {
  schemaVersion: 1;
  contract: 'durable-persistence-operations-implementation-manifest-v1';
  manifestOwner: 'assistantcaddy-head-chat-durable-persistence-operations';
  manifestId: 'assistantcaddy-head-chat-durable-persistence-operations-manifest';
  manifestVersion: '2026.06.12';
  implementationOwner: 'head-chat';
  implementationScope: 'durable-persistence-schema-export-import-backup-restore-sync-operations';
  sourceManifestContract: 'connector-runtime-durable-state-implementation-manifest-v1';
  sourceManifestOwner: 'assistantcaddy-head-chat-durable-schema-export';
  sourceManifestId: 'assistantcaddy-head-chat-durable-schema-export-manifest';
  sourceManifestVersion?: string;
  sourceImplementationOwner?: 'assistantcaddy-connector-runtime-durable-state';
  sourceImplementationId?: 'assistantcaddy-connector-runtime-durable-state-boundary';
  providerId?: string;
  connectorId?: string;
  targetSurface?: string;
  operations: readonly DurablePersistenceOperation[];
  operationOrder: readonly DurablePersistenceOperation[];
  operationPlan: readonly DurablePersistenceOperationPlanEntry[];
  exactHighRiskWriteSet: readonly string[];
  blockedPathClasses: readonly DurablePersistenceOperationsBlockedPathClass[];
  checkpointRequirements: readonly DurablePersistenceOperationsCheckpointRequirement[];
  rollbackRequirements: readonly DurablePersistenceOperationsRollbackRequirement[];
  checkpointRequired: true;
  rollbackRequired: true;
  ownerSourceBoundaryValidationRequired: true;
  forbiddenPathRejectionRequired: true;
  tokenShapedIdentifierBlockingRequired: true;
  promotedFromDurableStateImplementationManifest: true;
  headChatReviewRequired: true;
  readyForImplementation: false;
  implementationMode: 'manifest-only';
}

export interface DurablePersistenceOperationsImplementationManifestDecision {
  status: DurablePersistenceOperationsImplementationManifestStatus;
  manifestReady: boolean;
  reason: DurablePersistenceOperationsImplementationManifestReason;
  manifest: DurablePersistenceOperationsImplementationManifest;
  canPrepareHeadChatDurablePersistenceOperationsImplementation: boolean;
  readyForDurablePersistenceOperationsImplementation: false;
  mayPersistRuntimeState: false;
  mayCreateDexieSchema: false;
  mayBackupOrExportRuntimeState: false;
  mayImportOrRestoreRuntimeState: false;
  maySyncRuntimeState: false;
  mayOpenStorageAdapter: false;
  mayReadStorage: false;
  mayWriteStorage: false;
  mayFetch: false;
  mayOpenSocket: false;
  mayCallProvider: false;
  willGenerateArtifacts: false;
  willPromoteStandalone: false;
  sideEffects: 'none';
  storageDirective: 'operations-manifest-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import-do-not-sync';
  implementationDirective: 'head-chat-owned-durable-persistence-operations-implementation-only';
  sideEffectBoundary: 'durable-persistence-operations-implementation-manifest-no-fetch-no-socket-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials';
}

export interface DurablePersistenceOperationsImplementationManifestInput {
  sourceManifest?: ConnectorRuntimeDurableStateImplementationManifestDecision | null;
  proposedOperationPlan?: readonly DurablePersistenceOperationPlanEntry[] | null;
  proposedHighRiskWriteSet?: readonly unknown[] | null;
  checkpointRequirements?: readonly unknown[] | null;
  rollbackRequirements?: readonly unknown[] | null;
}

const SOURCE_MANIFEST_CONTRACT =
  'connector-runtime-durable-state-implementation-manifest-v1' as const;
const SOURCE_MANIFEST_OWNER = 'assistantcaddy-head-chat-durable-schema-export' as const;
const SOURCE_MANIFEST_ID = 'assistantcaddy-head-chat-durable-schema-export-manifest' as const;
const SOURCE_IMPLEMENTATION_OWNER = 'assistantcaddy-connector-runtime-durable-state' as const;
const SOURCE_IMPLEMENTATION_ID = 'assistantcaddy-connector-runtime-durable-state-boundary' as const;
const SOURCE_MANIFEST_STORAGE_DIRECTIVE =
  'manifest-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import' as const;
const SOURCE_MANIFEST_IMPLEMENTATION_DIRECTIVE =
  'head-chat-owned-durable-schema-export-implementation-only' as const;
const SOURCE_MANIFEST_SIDE_EFFECT_BOUNDARY =
  'connector-runtime-durable-state-implementation-manifest-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials' as const;
const DECISION_STORAGE_DIRECTIVE =
  'operations-manifest-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import-do-not-sync' as const;
const DECISION_IMPLEMENTATION_DIRECTIVE =
  'head-chat-owned-durable-persistence-operations-implementation-only' as const;
const DECISION_SIDE_EFFECT_BOUNDARY =
  'durable-persistence-operations-implementation-manifest-no-fetch-no-socket-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials' as const;
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_WRITE_PATH_LENGTH = 240;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
const SAFE_WRITE_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/@+~-]{0,239}$/;
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
const DISALLOWED_WRITE_PATHS: readonly {
  pattern: RegExp;
  kind: DurablePersistenceOperationsBlockedPathClass;
}[] = Object.freeze([
  { pattern: /(^|\/)dist($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)dist-single($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)node_modules($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)public($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)coverage($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)test-results($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)docs($|\/)/, kind: 'docs' },
  { pattern: /(^|\/)threatcaddy-standalone\.html$/i, kind: 'standalone' },
  { pattern: /\.html$/i, kind: 'standalone' },
  { pattern: /standalone/i, kind: 'standalone' },
  { pattern: /(^|\/)package\.json$/i, kind: 'package-files' },
  { pattern: /(^|\/)package-lock\.json$/i, kind: 'package-files' },
  { pattern: /(^|\/)pnpm-lock\.yaml$/i, kind: 'package-files' },
  { pattern: /(^|\/)pnpm-workspace\.yaml$/i, kind: 'package-files' },
  { pattern: /(^|\/)\.npmrc$/i, kind: 'package-files' },
  { pattern: /(^|\/)yarn\.lock$/i, kind: 'package-files' },
  { pattern: /(^|\/)src\/components($|\/)/i, kind: 'ui' },
  { pattern: /(^|\/)src\/pages($|\/)/i, kind: 'ui' },
  { pattern: /\.(?:env|pem|key)$/i, kind: 'credentials-or-secrets' },
]);
const INPUT_KEYS = new Set([
  'checkpointRequirements',
  'proposedHighRiskWriteSet',
  'proposedOperationPlan',
  'rollbackRequirements',
  'sourceManifest',
]);
const OPERATION_PLAN_ENTRY_KEYS = new Set([
  'checkpointRequired',
  'operation',
  'requiredFiles',
  'rollbackRequired',
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

export const DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER =
  Object.freeze(
    CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.map((requirement) => requirement.section),
  ) as readonly DurablePersistenceOperation[];

export const DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN =
  Object.freeze(
    CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.map((requirement) => Object.freeze({
      operation: requirement.section,
      requiredFiles: Object.freeze([...requirement.requiredFiles]),
      checkpointRequired: true,
      rollbackRequired: true,
    })),
  ) as readonly DurablePersistenceOperationPlanEntry[];

export const DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET =
  Object.freeze([
    ...CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  ]) as readonly string[];

export const DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES =
  Object.freeze([
    'generated-artifacts',
    'docs',
    'standalone',
    'package-files',
    'ui',
    'credentials-or-secrets',
  ]) as readonly DurablePersistenceOperationsBlockedPathClass[];

export const DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_CHECKPOINT_REQUIREMENTS =
  Object.freeze([
    'source-sanity',
    'typescript-noemit',
    'typescript-build',
    'focused-vitest',
    'schema-export-import-backup-review',
    'static-secret-scan',
    'git-diff-check',
    'recovery-checkpoint',
    'head-chat-ledger-handoff-update',
  ]) as readonly DurablePersistenceOperationsCheckpointRequirement[];

export const DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_ROLLBACK_REQUIREMENTS =
  Object.freeze([
    'head-chat-owned-revert-plan',
    'checkpoint-restore-path',
    'migration-downgrade-or-forward-fix-plan',
    'import-export-restore-failure-recovery-plan',
    'standalone-promotion-hold',
  ]) as readonly DurablePersistenceOperationsRollbackRequirement[];

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

function stringLooksTokenShaped(value: string): boolean {
  return TOKEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function safeIdentifier(value: unknown): string | undefined {
  const normalized = normalizedString(value);
  if (!normalized) return undefined;
  if (
    normalized.length > MAX_IDENTIFIER_LENGTH
    || !SAFE_IDENTIFIER_PATTERN.test(normalized)
    || isSecretLikeFieldName(normalized)
    || URL_LIKE_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(normalized))
    || stringLooksTokenShaped(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function safeWriteSetPath(value: unknown): value is string {
  const normalized = normalizedString(value);
  if (!normalized) return false;
  if (
    normalized.length > MAX_WRITE_PATH_LENGTH
    || normalized.startsWith('/')
    || normalized.includes('..')
    || normalized.includes('\\')
    || !SAFE_WRITE_PATH_PATTERN.test(normalized)
    || isSecretLikeFieldName(normalized)
    || stringLooksTokenShaped(normalized)
  ) {
    return false;
  }
  return !DISALLOWED_WRITE_PATHS.some(({ pattern }) => pattern.test(normalized));
}

function sameStringList(left: readonly unknown[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameSortedStringList(left: readonly string[], right: readonly string[]): boolean {
  return sameStringList([...left].sort(), [...right].sort());
}

function normalizedFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasOnlyKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => expected.has(key));
}

function objectHasUnsafeInputField(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).some((key) => {
    if (allowedKeys.has(key)) return false;
    const normalized = normalizedFieldName(key);
    return UNSAFE_INPUT_FIELD_MARKERS.some((marker) => normalized.includes(marker));
  });
}

function sourceManifestCoreFactsValid(
  sourceManifest: ConnectorRuntimeDurableStateImplementationManifestDecision,
): boolean {
  return sourceManifest.status === 'implementation-manifest-ready'
    && sourceManifest.manifestReady === true
    && sourceManifest.reason === 'implementation_manifest_ready'
    && sourceManifest.canPrepareHeadChatDurableSchemaExportImplementation === true
    && sourceManifest.readyForDurableStateImplementation === false
    && sourceManifest.mayPersistRuntimeState === false
    && sourceManifest.mayCreateDexieSchema === false
    && sourceManifest.mayBackupOrExportRuntimeState === false
    && sourceManifest.mayImportOrRestoreRuntimeState === false
    && sourceManifest.maySyncRuntimeState === false
    && sourceManifest.willOpenStorageAdapter === false
    && sourceManifest.willReadStorage === false
    && sourceManifest.willWriteStorage === false
    && sourceManifest.willGenerateArtifacts === false
    && sourceManifest.willPromoteStandalone === false
    && sourceManifest.willCallProvider === false
    && sourceManifest.sideEffects === 'none'
    && sourceManifest.storageDirective === SOURCE_MANIFEST_STORAGE_DIRECTIVE
    && sourceManifest.implementationDirective === SOURCE_MANIFEST_IMPLEMENTATION_DIRECTIVE
    && sourceManifest.sideEffectBoundary === SOURCE_MANIFEST_SIDE_EFFECT_BOUNDARY
    && isRecord(sourceManifest.manifest);
}

function sourceManifestOwnerFactsValid(
  sourceManifest: ConnectorRuntimeDurableStateImplementationManifestDecision,
): boolean {
  const manifest = sourceManifest.manifest;
  return manifest.contract === SOURCE_MANIFEST_CONTRACT
    && manifest.manifestOwner === SOURCE_MANIFEST_OWNER
    && manifest.manifestId === SOURCE_MANIFEST_ID
    && safeIdentifier(manifest.manifestVersion) !== undefined
    && manifest.integrationOwner === 'head-chat'
    && manifest.integrationScope === 'durable-schema-export-implementation'
    && manifest.sourceImplementationOwner === SOURCE_IMPLEMENTATION_OWNER
    && manifest.sourceImplementationId === SOURCE_IMPLEMENTATION_ID
    && safeIdentifier(manifest.sourceImplementationVersion) !== undefined
    && safeIdentifier(manifest.providerId) !== undefined
    && safeIdentifier(manifest.connectorId) !== undefined
    && (manifest.targetSurface === undefined || safeIdentifier(manifest.targetSurface) !== undefined)
    && manifest.promotedFromImplementationBoundary === true
    && manifest.headChatReviewRequired === true
    && manifest.readyForImplementation === false
    && manifest.implementationMode === 'manifest-only';
}

function sourceManifestBoundaryFactsValid(
  sourceManifest: ConnectorRuntimeDurableStateImplementationManifestDecision,
): boolean {
  const manifest = sourceManifest.manifest;
  return manifest.sourceImplementationBoundaryContract
      === 'connector-runtime-durable-state-implementation-boundary-v1'
    && manifest.sourceImplementationBoundaryStorageDirective
      === 'boundary-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import'
    && manifest.sourceImplementationBoundaryImplementationDirective
      === 'future-head-chat-reviewed-schema-export-contract-required'
    && manifest.sourcePersistenceBoundaryContract
      === 'connector-runtime-persistence-implementation-boundary-v1'
    && manifest.sourcePersistenceBoundaryStorageDirective
      === 'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import';
}

function sourceManifestIsCurrent(
  sourceManifest: ConnectorRuntimeDurableStateImplementationManifestDecision,
): boolean {
  const manifest = sourceManifest.manifest;
  return manifest.requirementCount === CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length
    && manifest.reviewedEvidenceCount === CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length
    && Array.isArray(manifest.sections)
    && sameStringList(manifest.sections, DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER)
    && Array.isArray(manifest.sharedHighRiskWriteSet)
    && sameSortedStringList(
      manifest.sharedHighRiskWriteSet,
      DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
    )
    && Array.isArray(manifest.blockedPathClasses)
    && sameStringList(
      manifest.blockedPathClasses,
      CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
    );
}

function proposedWriteSetMatchesExact(value: readonly unknown[] | null | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (!Array.isArray(value) || !value.every(safeWriteSetPath)) return false;
  return sameSortedStringList(
    value,
    DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  );
}

function operationPlanMatchesExact(
  value: readonly DurablePersistenceOperationPlanEntry[] | null | undefined,
): boolean {
  if (value === undefined || value === null) return false;
  if (
    !Array.isArray(value)
    || value.length !== DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN.length
  ) {
    return false;
  }
  return value.every((entry, index) => {
    const expected = DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN[index];
    return isRecord(entry)
      && hasOnlyKeys(entry, OPERATION_PLAN_ENTRY_KEYS)
      && entry.operation === expected.operation
      && entry.checkpointRequired === true
      && entry.rollbackRequired === true
      && Array.isArray(entry.requiredFiles)
      && entry.requiredFiles.every(safeWriteSetPath)
      && sameStringList(entry.requiredFiles, expected.requiredFiles);
  });
}

function exactCheckpointRequirementList(value: readonly unknown[] | null | undefined): boolean {
  if (value === undefined || value === null) return false;
  return Array.isArray(value)
    && sameStringList(value, DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_CHECKPOINT_REQUIREMENTS);
}

function exactRollbackRequirementList(value: readonly unknown[] | null | undefined): boolean {
  if (value === undefined || value === null) return false;
  return Array.isArray(value)
    && sameStringList(value, DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_ROLLBACK_REQUIREMENTS);
}

function freezeManifest(
  sourceManifest?: ConnectorRuntimeDurableStateImplementationManifestDecision,
): DurablePersistenceOperationsImplementationManifest {
  const manifest = sourceManifest?.manifest;
  const ready = sourceManifest !== undefined;
  return Object.freeze({
    schemaVersion: 1,
    contract: 'durable-persistence-operations-implementation-manifest-v1',
    manifestOwner: 'assistantcaddy-head-chat-durable-persistence-operations',
    manifestId: 'assistantcaddy-head-chat-durable-persistence-operations-manifest',
    manifestVersion: '2026.06.12',
    implementationOwner: 'head-chat',
    implementationScope: 'durable-persistence-schema-export-import-backup-restore-sync-operations',
    sourceManifestContract: SOURCE_MANIFEST_CONTRACT,
    sourceManifestOwner: SOURCE_MANIFEST_OWNER,
    sourceManifestId: SOURCE_MANIFEST_ID,
    sourceManifestVersion: ready ? safeIdentifier(manifest?.manifestVersion) : undefined,
    sourceImplementationOwner: ready && manifest?.sourceImplementationOwner === SOURCE_IMPLEMENTATION_OWNER
      ? manifest.sourceImplementationOwner
      : undefined,
    sourceImplementationId: ready && manifest?.sourceImplementationId === SOURCE_IMPLEMENTATION_ID
      ? manifest.sourceImplementationId
      : undefined,
    providerId: ready ? safeIdentifier(manifest?.providerId) : undefined,
    connectorId: ready ? safeIdentifier(manifest?.connectorId) : undefined,
    targetSurface: ready ? safeIdentifier(manifest?.targetSurface) : undefined,
    operations: Object.freeze(
      ready ? [...DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER] : [],
    ),
    operationOrder: Object.freeze(
      ready ? [...DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER] : [],
    ),
    operationPlan: Object.freeze(
      ready
        ? DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN.map((entry) => Object.freeze({
            operation: entry.operation,
            requiredFiles: Object.freeze([...entry.requiredFiles]),
            checkpointRequired: true,
            rollbackRequired: true,
          }))
        : [],
    ),
    exactHighRiskWriteSet: Object.freeze(
      ready ? [...DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET] : [],
    ),
    blockedPathClasses: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
    checkpointRequirements: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_CHECKPOINT_REQUIREMENTS,
    rollbackRequirements: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_ROLLBACK_REQUIREMENTS,
    checkpointRequired: true,
    rollbackRequired: true,
    ownerSourceBoundaryValidationRequired: true,
    forbiddenPathRejectionRequired: true,
    tokenShapedIdentifierBlockingRequired: true,
    promotedFromDurableStateImplementationManifest: true,
    headChatReviewRequired: true,
    readyForImplementation: false,
    implementationMode: 'manifest-only',
  });
}

function freezeDecision(
  reason: DurablePersistenceOperationsImplementationManifestReason,
  sourceManifest?: ConnectorRuntimeDurableStateImplementationManifestDecision,
): Readonly<DurablePersistenceOperationsImplementationManifestDecision> {
  const ready = reason === 'operations_manifest_ready' && sourceManifest !== undefined;
  return Object.freeze({
    status: ready ? 'operations-manifest-ready' : 'blocked',
    manifestReady: ready,
    reason,
    manifest: freezeManifest(ready ? sourceManifest : undefined),
    canPrepareHeadChatDurablePersistenceOperationsImplementation: ready,
    readyForDurablePersistenceOperationsImplementation: false,
    mayPersistRuntimeState: false,
    mayCreateDexieSchema: false,
    mayBackupOrExportRuntimeState: false,
    mayImportOrRestoreRuntimeState: false,
    maySyncRuntimeState: false,
    mayOpenStorageAdapter: false,
    mayReadStorage: false,
    mayWriteStorage: false,
    mayFetch: false,
    mayOpenSocket: false,
    mayCallProvider: false,
    willGenerateArtifacts: false,
    willPromoteStandalone: false,
    sideEffects: 'none',
    storageDirective: DECISION_STORAGE_DIRECTIVE,
    implementationDirective: DECISION_IMPLEMENTATION_DIRECTIVE,
    sideEffectBoundary: DECISION_SIDE_EFFECT_BOUNDARY,
  });
}

export function evaluateDurablePersistenceOperationsImplementationManifest(
  input: DurablePersistenceOperationsImplementationManifestInput = {},
): Readonly<DurablePersistenceOperationsImplementationManifestDecision> {
  if (!isRuntimeTrustedContractObject(input)) {
    return freezeDecision('input_shape_forbidden');
  }

  const trustedInput = input as unknown as Record<string, unknown>;
  if (objectHasUnsafeInputField(trustedInput, INPUT_KEYS)) {
    return freezeDecision('unsafe_input_field');
  }
  if (!hasOnlyKeys(trustedInput, INPUT_KEYS)) {
    return freezeDecision('input_shape_forbidden');
  }

  if (hasConnectorSecretMaterial(trustedInput)) {
    return freezeDecision('raw_secret_material');
  }

  const sourceManifest = input.sourceManifest;
  if (!sourceManifest) return freezeDecision('source_manifest_missing');
  if (!isRecord(sourceManifest)) return freezeDecision('source_manifest_invalid');
  if (sourceManifest.status === 'blocked' || sourceManifest.manifestReady !== true) {
    return freezeDecision('source_manifest_not_ready');
  }
  if (!sourceManifestCoreFactsValid(sourceManifest)) {
    return freezeDecision('source_manifest_invalid');
  }
  if (!sourceManifestOwnerFactsValid(sourceManifest)) {
    return freezeDecision('source_owner_invalid');
  }
  if (!sourceManifestBoundaryFactsValid(sourceManifest)) {
    return freezeDecision('source_boundary_invalid');
  }
  if (!sourceManifestIsCurrent(sourceManifest)) {
    return freezeDecision('source_manifest_stale');
  }
  if (!operationPlanMatchesExact(input.proposedOperationPlan)) {
    return freezeDecision('operation_order_invalid');
  }
  if (!proposedWriteSetMatchesExact(input.proposedHighRiskWriteSet)) {
    return freezeDecision('high_risk_write_set_invalid');
  }
  if (!exactCheckpointRequirementList(input.checkpointRequirements)) {
    return freezeDecision('checkpoint_requirements_invalid');
  }
  if (!exactRollbackRequirementList(input.rollbackRequirements)) {
    return freezeDecision('rollback_requirements_invalid');
  }

  return freezeDecision('operations_manifest_ready', sourceManifest);
}
