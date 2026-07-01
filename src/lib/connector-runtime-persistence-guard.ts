import { hasConnectorSecretMaterial, isSecretLikeFieldName } from './connector-credential-boundary';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type ConnectorRuntimePersistenceRequestKind =
  | 'no-persistence-session-only'
  | 'persist-runtime-state'
  | 'dexie-schema'
  | 'backup-export'
  | 'import-restore'
  | 'sync-state';

export type ConnectorRuntimePersistenceGuardStatus = 'allow-session-only' | 'blocked';

export interface ConnectorRuntimeNoPersistenceBoundary {
  mode: 'session-only';
  durableStorage: false;
  browserStorage: false;
  rawSecrets: false;
  network: false;
  providerCalls: false;
  schemaChange: false;
  backupRestore: false;
  importExport: false;
  syncState: false;
}

export interface ConnectorRuntimePersistenceReviewedPlanScope {
  providerId: string;
  connectorId: string;
  targetSurface?: string;
  tableName: string;
  typeName: string;
  schemaVersion: number;
}

export interface ConnectorRuntimePersistenceReviewedPlan {
  planKind: 'connector-runtime-persistence-reviewed-plan-v1';
  planId: string;
  reviewState: 'reviewed';
  reviewedBy: string;
  reviewedAt: number;
  scope: ConnectorRuntimePersistenceReviewedPlanScope;
  dexieSchema: {
    tableName: string;
    schemaVersion: number;
    dexieSchemaEvidence: string;
    schemaVersionEvidence: string;
  };
  typeSchema: {
    typeName: string;
    typeEvidence: string;
    schemaVersionTypeEvidence: string;
  };
  backupExport: {
    backupEvidence: string;
    exportEvidence: string;
    exportKeyEvidence: string;
  };
  importRestore: {
    importEvidence: string;
    restoreEvidence: string;
    validationEvidence: string;
  };
  syncState: {
    syncStateEvidence: string;
    networkBoundaryEvidence: string;
  };
  cascadeCleanup: {
    cascadeEvidence: string;
    orphanCleanupEvidence: string;
  };
  secretRedaction: {
    rawSecretPersistence: false;
    redactionEvidence: string;
    tokenScanEvidence: string;
  };
  migrationRollback: {
    rollbackPlanEvidence: string;
    rollbackTestEvidence: string;
  };
  standaloneParity: {
    standaloneEvidence: string;
    backupRestoreParityEvidence: string;
  };
}

export interface ConnectorRuntimePersistenceGuardInput {
  requestKind: ConnectorRuntimePersistenceRequestKind;
  providerId?: string;
  connectorId?: string;
  targetSurface?: string;
  stateLabel?: string;
  proposedFields?: readonly string[];
  migrationLabels?: readonly string[];
  exportKeys?: readonly string[];
  samplePayloadMetadata?: unknown;
  noPersistenceBoundary?: Partial<ConnectorRuntimeNoPersistenceBoundary> | null;
  reviewedPlan?: Partial<ConnectorRuntimePersistenceReviewedPlan> | null;
}

export type ConnectorRuntimePersistenceGuardBlockerCode =
  | 'input_untrusted'
  | 'request_kind_missing'
  | 'unsafe_request_identifier'
  | 'no_persistence_boundary_missing'
  | 'no_persistence_boundary_invalid'
  | 'reviewed_plan_missing'
  | 'reviewed_plan_incomplete'
  | 'reviewed_plan_not_reviewed'
  | 'reviewed_plan_scope_mismatch'
  | 'dexie_schema_plan_missing'
  | 'type_schema_plan_missing'
  | 'schema_version_plan_missing'
  | 'backup_plan_missing'
  | 'export_plan_missing'
  | 'import_plan_missing'
  | 'restore_plan_missing'
  | 'sync_state_plan_missing'
  | 'cascade_cleanup_plan_missing'
  | 'secret_redaction_plan_missing'
  | 'migration_rollback_plan_missing'
  | 'standalone_parity_plan_missing'
  | 'raw_secret_persistence_requested'
  | 'raw_secret_or_token_identifier'
  | 'durable_persistence_disabled';

export interface ConnectorRuntimePersistenceGuardBlocker {
  code: ConnectorRuntimePersistenceGuardBlockerCode;
  detail: string;
  field?: string;
}

export interface ConnectorRuntimePersistenceGuardMetadata {
  schemaVersion: 1;
  contract: 'connector-runtime-persistence-guard-v1';
  requestKind?: ConnectorRuntimePersistenceRequestKind;
  providerId?: string;
  connectorId?: string;
  targetSurface?: string;
  stateLabel?: string;
  proposedFieldCount: number;
  migrationLabelCount: number;
  exportKeyCount: number;
  reviewedPlanId?: string;
  reviewedPlanEvidenceCount: number;
}

export interface ConnectorRuntimePersistenceGuardDecision {
  status: ConnectorRuntimePersistenceGuardStatus;
  mayUseSessionOnlyRuntimeState: boolean;
  mayPersistRuntimeState: false;
  mayCreateDexieSchema: false;
  mayBackupOrExportRuntimeState: false;
  mayImportOrRestoreRuntimeState: false;
  maySyncRuntimeState: false;
  storageDirective:
    | 'session-only-do-not-persist-do-not-export-do-not-sync'
    | 'blocked-no-connector-runtime-persistence';
  sideEffects: 'none';
  sideEffectBoundary: 'decision-only-no-fetch-no-indexeddb-no-localstorage-no-provider-no-credentials';
  metadata: ConnectorRuntimePersistenceGuardMetadata;
  blockers: readonly ConnectorRuntimePersistenceGuardBlocker[];
}

const DECISION_SIDE_EFFECT_BOUNDARY = 'decision-only-no-fetch-no-indexeddb-no-localstorage-no-provider-no-credentials';
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:@/+~-]+$/;
const MAX_IDENTIFIER_LENGTH = 180;
const MAX_EVIDENCE_LENGTH = 240;
const URL_OR_SCHEME_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;

const TOKEN_VALUE_PATTERNS = [
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
const REQUEST_KINDS = new Set<ConnectorRuntimePersistenceRequestKind>([
  'no-persistence-session-only',
  'persist-runtime-state',
  'dexie-schema',
  'backup-export',
  'import-restore',
  'sync-state',
]);

function blocker(
  code: ConnectorRuntimePersistenceGuardBlockerCode,
  detail: string,
  field?: string,
): ConnectorRuntimePersistenceGuardBlocker {
  return Object.freeze({ code, detail, field });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return undefined;
  return trimmed;
}

function stringLooksLikeToken(value: string): boolean {
  return TOKEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function identifierContainsTokenMarker(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return TOKEN_IDENTIFIER_MARKERS.some((marker) => normalized.includes(marker));
}

function identifierLooksUrlOrSchemeShaped(value: string): boolean {
  return URL_OR_SCHEME_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function isSafeMetadataIdentifier(value: string): boolean {
  return value.length <= MAX_IDENTIFIER_LENGTH
    && IDENTIFIER_PATTERN.test(value)
    && !identifierLooksUrlOrSchemeShaped(value)
    && !isSecretLikeFieldName(value)
    && !identifierContainsTokenMarker(value)
    && !stringLooksLikeToken(value);
}

function safeMetadataIdentifier(value: unknown): string | undefined {
  const identifier = safeString(value, MAX_IDENTIFIER_LENGTH);
  return identifier && isSafeMetadataIdentifier(identifier) ? identifier : undefined;
}

function normalizeRequestKind(value: unknown): ConnectorRuntimePersistenceRequestKind | undefined {
  return typeof value === 'string' && REQUEST_KINDS.has(value as ConnectorRuntimePersistenceRequestKind)
    ? value as ConnectorRuntimePersistenceRequestKind
    : undefined;
}

function requiredEvidence(value: unknown): boolean {
  return safeString(value, MAX_EVIDENCE_LENGTH) !== undefined && !stringLooksLikeToken(String(value));
}

function countValues(values: readonly string[] | undefined): number {
  return Array.isArray(values) ? values.length : 0;
}

function addUnsafeIdentifierBlockers(
  blockers: ConnectorRuntimePersistenceGuardBlocker[],
  values: readonly string[] | undefined,
  field: 'proposedFields' | 'migrationLabels' | 'exportKeys',
): void {
  if (!Array.isArray(values)) return;
  values.forEach((value, index) => {
    const identifier = safeString(value, MAX_IDENTIFIER_LENGTH);
    if (!identifier || !isSafeMetadataIdentifier(identifier)) {
      blockers.push(blocker(
        'raw_secret_or_token_identifier',
        'Connector runtime persistence metadata must not contain raw secrets, token-shaped identifiers, or secret-like field names.',
        `${field}.${index}`,
      ));
    }
  });
}

function addRequestIdentifierBlocker(
  blockers: ConnectorRuntimePersistenceGuardBlocker[],
  value: string | undefined,
  field: string,
): void {
  if (value !== undefined && !isSafeMetadataIdentifier(value)) {
    blockers.push(blocker(
      'unsafe_request_identifier',
      'Request metadata must use bounded opaque identifiers and must not contain raw secrets or token-shaped values.',
      field,
    ));
  }
}

function noPersistenceBoundaryValid(boundary: Partial<ConnectorRuntimeNoPersistenceBoundary> | null | undefined): boundary is ConnectorRuntimeNoPersistenceBoundary {
  return Boolean(boundary)
    && boundary?.mode === 'session-only'
    && boundary.durableStorage === false
    && boundary.browserStorage === false
    && boundary.rawSecrets === false
    && boundary.network === false
    && boundary.providerCalls === false
    && boundary.schemaChange === false
    && boundary.backupRestore === false
    && boundary.importExport === false
    && boundary.syncState === false;
}

function reviewedPlanBaseComplete(plan: Partial<ConnectorRuntimePersistenceReviewedPlan>): boolean {
  return plan.planKind === 'connector-runtime-persistence-reviewed-plan-v1'
    && safeMetadataIdentifier(plan.planId) !== undefined
    && plan.reviewState === 'reviewed'
    && requiredEvidence(plan.reviewedBy)
    && typeof plan.reviewedAt === 'number'
    && Number.isSafeInteger(plan.reviewedAt)
    && plan.reviewedAt > 0
    && isRecord(plan.scope);
}

function addReviewedPlanBlockers(
  blockers: ConnectorRuntimePersistenceGuardBlocker[],
  input: ConnectorRuntimePersistenceGuardInput,
): number {
  const plan = input.reviewedPlan;
  if (!plan) {
    blockers.push(blocker('reviewed_plan_missing', 'Durable connector runtime state requires a complete reviewed persistence plan.', 'reviewedPlan'));
    return 0;
  }

  let evidenceCount = 0;
  let missingSection = false;

  if (!reviewedPlanBaseComplete(plan)) {
    missingSection = true;
    blockers.push(blocker('reviewed_plan_not_reviewed', 'Reviewed plan must include a plan id, reviewer, reviewed timestamp, scope, and reviewed state.', 'reviewedPlan'));
  }

  if (!isRecord(plan.scope) || !requiredEvidence(plan.scope.tableName) || !requiredEvidence(plan.scope.typeName) || typeof plan.scope.schemaVersion !== 'number') {
    missingSection = true;
    blockers.push(blocker('schema_version_plan_missing', 'Reviewed plan must bind table name, type name, and schema version.', 'reviewedPlan.scope'));
  }

  if (input.providerId && plan.scope?.providerId !== input.providerId) {
    blockers.push(blocker('reviewed_plan_scope_mismatch', 'Reviewed plan providerId must match the requested providerId.', 'reviewedPlan.scope.providerId'));
  }
  if (input.connectorId && plan.scope?.connectorId !== input.connectorId) {
    blockers.push(blocker('reviewed_plan_scope_mismatch', 'Reviewed plan connectorId must match the requested connectorId.', 'reviewedPlan.scope.connectorId'));
  }
  if (input.targetSurface && plan.scope?.targetSurface !== undefined && plan.scope.targetSurface !== input.targetSurface) {
    blockers.push(blocker('reviewed_plan_scope_mismatch', 'Reviewed plan targetSurface must match when the plan scopes one.', 'reviewedPlan.scope.targetSurface'));
  }

  if (!plan.dexieSchema || !requiredEvidence(plan.dexieSchema.dexieSchemaEvidence)) {
    missingSection = true;
    blockers.push(blocker('dexie_schema_plan_missing', 'Reviewed plan must cover browser database table and schema migration evidence.', 'reviewedPlan.dexieSchema'));
  } else {
    evidenceCount += 1;
  }
  if (!plan.dexieSchema || typeof plan.dexieSchema.schemaVersion !== 'number' || !requiredEvidence(plan.dexieSchema.schemaVersionEvidence)) {
    missingSection = true;
    blockers.push(blocker('schema_version_plan_missing', 'Reviewed plan must include schema version evidence.', 'reviewedPlan.dexieSchema.schemaVersion'));
  } else {
    evidenceCount += 1;
  }
  if (!plan.typeSchema || !requiredEvidence(plan.typeSchema.typeEvidence) || !requiredEvidence(plan.typeSchema.schemaVersionTypeEvidence)) {
    missingSection = true;
    blockers.push(blocker('type_schema_plan_missing', 'Reviewed plan must cover TypeScript entity/types and schema-version typing.', 'reviewedPlan.typeSchema'));
  } else {
    evidenceCount += 1;
  }
  if (!plan.backupExport || !requiredEvidence(plan.backupExport.backupEvidence)) {
    missingSection = true;
    blockers.push(blocker('backup_plan_missing', 'Reviewed plan must cover encrypted backup payload inclusion and exclusion behavior.', 'reviewedPlan.backupExport.backupEvidence'));
  } else {
    evidenceCount += 1;
  }
  if (!plan.backupExport || !requiredEvidence(plan.backupExport.exportEvidence) || !requiredEvidence(plan.backupExport.exportKeyEvidence)) {
    missingSection = true;
    blockers.push(blocker('export_plan_missing', 'Reviewed plan must cover JSON export keys, redaction, and omission behavior.', 'reviewedPlan.backupExport.exportEvidence'));
  } else {
    evidenceCount += 1;
  }
  if (!plan.importRestore || !requiredEvidence(plan.importRestore.importEvidence) || !requiredEvidence(plan.importRestore.validationEvidence)) {
    missingSection = true;
    blockers.push(blocker('import_plan_missing', 'Reviewed plan must cover import validation and merge/full-replace behavior.', 'reviewedPlan.importRestore.importEvidence'));
  } else {
    evidenceCount += 1;
  }
  if (!plan.importRestore || !requiredEvidence(plan.importRestore.restoreEvidence)) {
    missingSection = true;
    blockers.push(blocker('restore_plan_missing', 'Reviewed plan must cover restore behavior and rollback-safe failure states.', 'reviewedPlan.importRestore.restoreEvidence'));
  } else {
    evidenceCount += 1;
  }
  if (!plan.syncState || !requiredEvidence(plan.syncState.syncStateEvidence) || !requiredEvidence(plan.syncState.networkBoundaryEvidence)) {
    missingSection = true;
    blockers.push(blocker('sync_state_plan_missing', 'Reviewed plan must cover sync-state ownership and network boundary evidence.', 'reviewedPlan.syncState'));
  } else {
    evidenceCount += 1;
  }
  if (!plan.cascadeCleanup || !requiredEvidence(plan.cascadeCleanup.cascadeEvidence) || !requiredEvidence(plan.cascadeCleanup.orphanCleanupEvidence)) {
    missingSection = true;
    blockers.push(blocker('cascade_cleanup_plan_missing', 'Reviewed plan must cover cascade cleanup and orphan removal.', 'reviewedPlan.cascadeCleanup'));
  } else {
    evidenceCount += 1;
  }
  if (!plan.secretRedaction || plan.secretRedaction.rawSecretPersistence !== false) {
    missingSection = true;
    blockers.push(blocker('raw_secret_persistence_requested', 'Reviewed plan must explicitly keep raw secret persistence disabled.', 'reviewedPlan.secretRedaction.rawSecretPersistence'));
  }
  if (!plan.secretRedaction || !requiredEvidence(plan.secretRedaction.redactionEvidence) || !requiredEvidence(plan.secretRedaction.tokenScanEvidence)) {
    missingSection = true;
    blockers.push(blocker('secret_redaction_plan_missing', 'Reviewed plan must cover redaction and token-shaped field scan evidence.', 'reviewedPlan.secretRedaction'));
  } else {
    evidenceCount += 1;
  }
  if (!plan.migrationRollback || !requiredEvidence(plan.migrationRollback.rollbackPlanEvidence) || !requiredEvidence(plan.migrationRollback.rollbackTestEvidence)) {
    missingSection = true;
    blockers.push(blocker('migration_rollback_plan_missing', 'Reviewed plan must cover migration rollback and rollback test evidence.', 'reviewedPlan.migrationRollback'));
  } else {
    evidenceCount += 1;
  }
  if (!plan.standaloneParity || !requiredEvidence(plan.standaloneParity.standaloneEvidence) || !requiredEvidence(plan.standaloneParity.backupRestoreParityEvidence)) {
    missingSection = true;
    blockers.push(blocker('standalone_parity_plan_missing', 'Reviewed plan must cover standalone artifact parity and backup/restore parity evidence.', 'reviewedPlan.standaloneParity'));
  } else {
    evidenceCount += 1;
  }

  if (missingSection && plan.reviewState === 'reviewed') {
    blockers.push(blocker('reviewed_plan_incomplete', 'A reviewed flag alone is not enough; every persistence, schema, backup/export, import/restore, cleanup, redaction, rollback, and parity section must be complete.', 'reviewedPlan.reviewState'));
  }

  return evidenceCount;
}

function buildMetadata(
  input: ConnectorRuntimePersistenceGuardInput,
  requestKind: ConnectorRuntimePersistenceRequestKind | undefined,
  reviewedPlanEvidenceCount: number,
): ConnectorRuntimePersistenceGuardMetadata {
  return Object.freeze({
    schemaVersion: 1,
    contract: 'connector-runtime-persistence-guard-v1',
    requestKind,
    providerId: safeMetadataIdentifier(input.providerId),
    connectorId: safeMetadataIdentifier(input.connectorId),
    targetSurface: safeMetadataIdentifier(input.targetSurface),
    stateLabel: safeMetadataIdentifier(input.stateLabel),
    proposedFieldCount: countValues(input.proposedFields),
    migrationLabelCount: countValues(input.migrationLabels),
    exportKeyCount: countValues(input.exportKeys),
    reviewedPlanId: safeMetadataIdentifier(input.reviewedPlan?.planId),
    reviewedPlanEvidenceCount,
  });
}

export function evaluateConnectorRuntimePersistenceGuard(
  input: ConnectorRuntimePersistenceGuardInput,
): ConnectorRuntimePersistenceGuardDecision {
  const blockers: ConnectorRuntimePersistenceGuardBlocker[] = [];
  if (!isRuntimeTrustedContractObject(input)) {
    blockers.push(blocker(
      'input_untrusted',
      'Connector runtime persistence guard input must be built by the runtime trusted contract object boundary.',
      'input',
    ));
    return Object.freeze({
      status: 'blocked',
      mayUseSessionOnlyRuntimeState: false,
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
      mayBackupOrExportRuntimeState: false,
      mayImportOrRestoreRuntimeState: false,
      maySyncRuntimeState: false,
      storageDirective: 'blocked-no-connector-runtime-persistence',
      sideEffects: 'none',
      sideEffectBoundary: DECISION_SIDE_EFFECT_BOUNDARY,
      metadata: buildMetadata({} as ConnectorRuntimePersistenceGuardInput, undefined, 0),
      blockers: Object.freeze(blockers),
    });
  }

  const requestKind = normalizeRequestKind(input.requestKind);

  if (!requestKind) {
    blockers.push(blocker('request_kind_missing', 'Connector runtime persistence guard requires an explicit request kind.', 'requestKind'));
    if (input.requestKind !== undefined) {
      blockers.push(blocker('unsafe_request_identifier', 'Connector runtime persistence request kind must be one of the reviewed local contract values.', 'requestKind'));
    }
  }

  addRequestIdentifierBlocker(blockers, input.providerId, 'providerId');
  addRequestIdentifierBlocker(blockers, input.connectorId, 'connectorId');
  addRequestIdentifierBlocker(blockers, input.targetSurface, 'targetSurface');
  addRequestIdentifierBlocker(blockers, input.stateLabel, 'stateLabel');
  addUnsafeIdentifierBlockers(blockers, input.proposedFields, 'proposedFields');
  addUnsafeIdentifierBlockers(blockers, input.migrationLabels, 'migrationLabels');
  addUnsafeIdentifierBlockers(blockers, input.exportKeys, 'exportKeys');

  if (input.samplePayloadMetadata !== undefined && hasConnectorSecretMaterial(input.samplePayloadMetadata)) {
    blockers.push(blocker(
      'raw_secret_or_token_identifier',
      'Sample payload metadata must not contain raw secrets, token-shaped values, or secret-like keys.',
      'samplePayloadMetadata',
    ));
  }

  let reviewedPlanEvidenceCount = 0;
  if (requestKind === 'no-persistence-session-only') {
    if (!input.noPersistenceBoundary) {
      blockers.push(blocker('no_persistence_boundary_missing', 'Session-only runtime state requires an explicit no-persistence boundary.', 'noPersistenceBoundary'));
    } else if (!noPersistenceBoundaryValid(input.noPersistenceBoundary)) {
      blockers.push(blocker('no_persistence_boundary_invalid', 'Session-only runtime state must explicitly avoid durable storage, browser storage, raw secrets, network, provider calls, schema, backup/restore, import/export, and sync state.', 'noPersistenceBoundary'));
    }
  } else {
    reviewedPlanEvidenceCount = addReviewedPlanBlockers(blockers, input);
    blockers.push(blocker(
      'durable_persistence_disabled',
      'This local guard does not enable connector runtime persistence, schema, backup/export, import/restore, or sync state; a complete reviewed plan is required before any future implementation can be considered.',
      'requestKind',
    ));
  }

  const allowSessionOnly = requestKind === 'no-persistence-session-only' && blockers.length === 0;
  const metadata = buildMetadata(input, requestKind, reviewedPlanEvidenceCount);

  return Object.freeze({
    status: allowSessionOnly ? 'allow-session-only' : 'blocked',
    mayUseSessionOnlyRuntimeState: allowSessionOnly,
    mayPersistRuntimeState: false,
    mayCreateDexieSchema: false,
    mayBackupOrExportRuntimeState: false,
    mayImportOrRestoreRuntimeState: false,
    maySyncRuntimeState: false,
    storageDirective: allowSessionOnly
      ? 'session-only-do-not-persist-do-not-export-do-not-sync'
      : 'blocked-no-connector-runtime-persistence',
    sideEffects: 'none',
    sideEffectBoundary: DECISION_SIDE_EFFECT_BOUNDARY,
    metadata,
    blockers: Object.freeze(blockers),
  });
}
