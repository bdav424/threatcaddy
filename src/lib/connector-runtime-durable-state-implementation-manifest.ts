import { hasConnectorSecretMaterial, isSecretLikeFieldName } from './connector-credential-boundary';
import {
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES,
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS,
  type ConnectorRuntimeDurableStateImplementationBoundaryDecision,
} from './connector-runtime-durable-state-implementation-boundary';
import {
  CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS,
  type ConnectorRuntimePersistenceImplementationSection,
} from './connector-runtime-persistence-implementation-boundary';

export type ConnectorRuntimeDurableStateImplementationManifestStatus =
  | 'implementation-manifest-ready'
  | 'blocked';

export type ConnectorRuntimeDurableStateImplementationManifestReason =
  | 'implementation_manifest_ready'
  | 'implementation_boundary_missing'
  | 'implementation_boundary_not_ready'
  | 'implementation_boundary_invalid'
  | 'implementation_owner_invalid'
  | 'source_boundary_facts_invalid'
  | 'implementation_boundary_stale'
  | 'future_write_set_invalid'
  | 'raw_secret_material';

export type ConnectorRuntimeDurableStateImplementationManifestBlockedPathClass =
  | 'generated-artifacts'
  | 'docs'
  | 'standalone'
  | 'package-files';

export interface ConnectorRuntimeDurableStateImplementationManifest {
  schemaVersion: 1;
  contract: 'connector-runtime-durable-state-implementation-manifest-v1';
  manifestOwner: 'assistantcaddy-head-chat-durable-schema-export';
  manifestId: 'assistantcaddy-head-chat-durable-schema-export-manifest';
  manifestVersion: '2026.06.12';
  integrationOwner: 'head-chat';
  integrationScope: 'durable-schema-export-implementation';
  sourceImplementationBoundaryContract: 'connector-runtime-durable-state-implementation-boundary-v1';
  sourceImplementationBoundaryStorageDirective: 'boundary-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import';
  sourceImplementationBoundaryImplementationDirective: 'future-head-chat-reviewed-schema-export-contract-required';
  sourcePersistenceBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1';
  sourcePersistenceBoundaryStorageDirective: 'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import';
  sourceImplementationOwner?: 'assistantcaddy-connector-runtime-durable-state';
  sourceImplementationId?: 'assistantcaddy-connector-runtime-durable-state-boundary';
  sourceImplementationVersion?: string;
  providerId?: string;
  connectorId?: string;
  targetSurface?: string;
  sections: readonly ConnectorRuntimePersistenceImplementationSection[];
  sharedHighRiskWriteSet: readonly string[];
  blockedPathClasses: readonly ConnectorRuntimeDurableStateImplementationManifestBlockedPathClass[];
  requirementCount: number;
  reviewedEvidenceCount: number;
  promotedFromImplementationBoundary: true;
  headChatReviewRequired: true;
  readyForImplementation: false;
  implementationMode: 'manifest-only';
}

export interface ConnectorRuntimeDurableStateImplementationManifestDecision {
  status: ConnectorRuntimeDurableStateImplementationManifestStatus;
  manifestReady: boolean;
  reason: ConnectorRuntimeDurableStateImplementationManifestReason;
  manifest: ConnectorRuntimeDurableStateImplementationManifest;
  canPrepareHeadChatDurableSchemaExportImplementation: boolean;
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
  storageDirective: 'manifest-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import';
  implementationDirective: 'head-chat-owned-durable-schema-export-implementation-only';
  sideEffectBoundary: 'connector-runtime-durable-state-implementation-manifest-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials';
}

export interface ConnectorRuntimeDurableStateImplementationManifestInput {
  implementationBoundary?: ConnectorRuntimeDurableStateImplementationBoundaryDecision | null;
}

const SOURCE_IMPLEMENTATION_BOUNDARY_CONTRACT =
  'connector-runtime-durable-state-implementation-boundary-v1' as const;
const SOURCE_IMPLEMENTATION_STORAGE_DIRECTIVE =
  'boundary-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import' as const;
const SOURCE_IMPLEMENTATION_DIRECTIVE =
  'future-head-chat-reviewed-schema-export-contract-required' as const;
const SOURCE_PERSISTENCE_BOUNDARY_CONTRACT =
  'connector-runtime-persistence-implementation-boundary-v1' as const;
const SOURCE_PERSISTENCE_STORAGE_DIRECTIVE =
  'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import' as const;
const MANIFEST_STORAGE_DIRECTIVE =
  'manifest-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import' as const;
const MANIFEST_IMPLEMENTATION_DIRECTIVE =
  'head-chat-owned-durable-schema-export-implementation-only' as const;
const MANIFEST_SIDE_EFFECT_BOUNDARY =
  'connector-runtime-durable-state-implementation-manifest-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials' as const;
const MANIFEST_OWNER = 'assistantcaddy-head-chat-durable-schema-export' as const;
const MANIFEST_ID = 'assistantcaddy-head-chat-durable-schema-export-manifest' as const;
const MANIFEST_VERSION = '2026.06.12' as const;
const SOURCE_IMPLEMENTATION_OWNER = 'assistantcaddy-connector-runtime-durable-state' as const;
const SOURCE_IMPLEMENTATION_ID = 'assistantcaddy-connector-runtime-durable-state-boundary' as const;
const MAX_IDENTIFIER_LENGTH = 180;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,179}$/;
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
const DISALLOWED_WRITE_PATHS: readonly { pattern: RegExp; kind: ConnectorRuntimeDurableStateImplementationManifestBlockedPathClass }[] = Object.freeze([
  { pattern: /(^|\/)dist($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)dist-single($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)node_modules($|\/)/, kind: 'generated-artifacts' },
  { pattern: /(^|\/)public($|\/)/, kind: 'generated-artifacts' },
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
]);

export const CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET = Object.freeze([
  ...CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES,
]) as readonly string[];

export const CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES = Object.freeze([
  'generated-artifacts',
  'docs',
  'standalone',
  'package-files',
]) as readonly ConnectorRuntimeDurableStateImplementationManifestBlockedPathClass[];

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
    || stringLooksTokenShaped(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function exactSectionList(
  value: readonly unknown[],
): value is readonly ConnectorRuntimePersistenceImplementationSection[] {
  return sameStringList(
    value as readonly string[],
    CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS,
  );
}

function safeWriteSetPath(value: unknown): value is string {
  const normalized = normalizedString(value);
  if (!normalized) return false;
  if (normalized.startsWith('/') || normalized.includes('..') || normalized.includes('\\')) return false;
  if (!SAFE_IDENTIFIER_PATTERN.test(normalized)) return false;
  if (stringLooksTokenShaped(normalized)) return false;
  return !DISALLOWED_WRITE_PATHS.some(({ pattern }) => pattern.test(normalized));
}

function boundaryCoreFactsValid(
  boundary: ConnectorRuntimeDurableStateImplementationBoundaryDecision,
): boolean {
  return boundary.status === 'implementation-boundary-ready'
    && boundary.boundaryReady === true
    && boundary.reason === 'durable_state_implementation_boundary_ready'
    && boundary.canPrepareFutureDurableStateImplementationPackage === true
    && boundary.readyForDurableStateImplementation === false
    && boundary.mayPersistRuntimeState === false
    && boundary.mayCreateDexieSchema === false
    && boundary.mayBackupOrExportRuntimeState === false
    && boundary.mayImportOrRestoreRuntimeState === false
    && boundary.maySyncRuntimeState === false
    && boundary.willOpenStorageAdapter === false
    && boundary.willReadStorage === false
    && boundary.willWriteStorage === false
    && boundary.willGenerateArtifacts === false
    && boundary.willPromoteStandalone === false
    && boundary.willCallProvider === false
    && boundary.sideEffects === 'none'
    && boundary.storageDirective === SOURCE_IMPLEMENTATION_STORAGE_DIRECTIVE
    && boundary.implementationDirective === SOURCE_IMPLEMENTATION_DIRECTIVE
    && boundary.sideEffectBoundary
      === 'connector-runtime-durable-state-implementation-boundary-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials';
}

function boundaryOwnerFactsValid(
  boundary: ConnectorRuntimeDurableStateImplementationBoundaryDecision,
): boolean {
  const metadata = boundary.metadata;
  return metadata.contract === SOURCE_IMPLEMENTATION_BOUNDARY_CONTRACT
    && metadata.implementationOwner === SOURCE_IMPLEMENTATION_OWNER
    && metadata.implementationId === SOURCE_IMPLEMENTATION_ID
    && safeIdentifier(metadata.implementationVersion) !== undefined
    && safeIdentifier(metadata.providerId) !== undefined
    && safeIdentifier(metadata.connectorId) !== undefined
    && (metadata.targetSurface === undefined || safeIdentifier(metadata.targetSurface) !== undefined)
    && metadata.headChatReviewedSchemaExportImplementationContract === false
    && metadata.readyForImplementation === false
    && metadata.implementationMode === 'boundary-only';
}

function boundarySourceFactsValid(
  boundary: ConnectorRuntimeDurableStateImplementationBoundaryDecision,
): boolean {
  const metadata = boundary.metadata;
  return metadata.sourceBoundaryContract === SOURCE_PERSISTENCE_BOUNDARY_CONTRACT
    && metadata.sourceBoundaryStorageDirective === SOURCE_PERSISTENCE_STORAGE_DIRECTIVE;
}

function boundaryWriteSetLooksSafe(boundary: ConnectorRuntimeDurableStateImplementationBoundaryDecision): boolean {
  return Array.isArray(boundary.metadata.futureWriteSet)
    && boundary.metadata.futureWriteSet.every(safeWriteSetPath);
}

function boundaryIsCurrent(
  boundary: ConnectorRuntimeDurableStateImplementationBoundaryDecision,
): boolean {
  const metadata = boundary.metadata;
  return metadata.requirementCount === CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length
    && metadata.reviewedEvidenceCount === CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length
    && Array.isArray(metadata.sections)
    && exactSectionList(metadata.sections)
    && Array.isArray(metadata.futureWriteSet)
    && sameStringList(
      [...metadata.futureWriteSet].sort(),
      CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
    );
}

function freezeManifest(
  boundary?: ConnectorRuntimeDurableStateImplementationBoundaryDecision,
): ConnectorRuntimeDurableStateImplementationManifest {
  const metadata = boundary?.metadata;
  const boundaryIsAcceptedCurrent = boundary !== undefined && boundaryIsCurrent(boundary);
  return Object.freeze({
    schemaVersion: 1,
    contract: 'connector-runtime-durable-state-implementation-manifest-v1',
    manifestOwner: MANIFEST_OWNER,
    manifestId: MANIFEST_ID,
    manifestVersion: MANIFEST_VERSION,
    integrationOwner: 'head-chat',
    integrationScope: 'durable-schema-export-implementation',
    sourceImplementationBoundaryContract: SOURCE_IMPLEMENTATION_BOUNDARY_CONTRACT,
    sourceImplementationBoundaryStorageDirective: SOURCE_IMPLEMENTATION_STORAGE_DIRECTIVE,
    sourceImplementationBoundaryImplementationDirective: SOURCE_IMPLEMENTATION_DIRECTIVE,
    sourcePersistenceBoundaryContract: SOURCE_PERSISTENCE_BOUNDARY_CONTRACT,
    sourcePersistenceBoundaryStorageDirective: SOURCE_PERSISTENCE_STORAGE_DIRECTIVE,
    sourceImplementationOwner:
      metadata?.implementationOwner === SOURCE_IMPLEMENTATION_OWNER ? metadata.implementationOwner : undefined,
    sourceImplementationId:
      metadata?.implementationId === SOURCE_IMPLEMENTATION_ID ? metadata.implementationId : undefined,
    sourceImplementationVersion: safeIdentifier(metadata?.implementationVersion),
    providerId: safeIdentifier(metadata?.providerId),
    connectorId: safeIdentifier(metadata?.connectorId),
    targetSurface: safeIdentifier(metadata?.targetSurface),
    sections: Object.freeze(
      boundaryIsAcceptedCurrent ? [...(metadata?.sections ?? [])] : [],
    ),
    sharedHighRiskWriteSet: Object.freeze(
      boundaryIsAcceptedCurrent ? [...CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET] : [],
    ),
    blockedPathClasses: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
    requirementCount:
      boundaryIsAcceptedCurrent ? CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length : 0,
    reviewedEvidenceCount:
      boundaryIsAcceptedCurrent ? CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length : 0,
    promotedFromImplementationBoundary: true,
    headChatReviewRequired: true,
    readyForImplementation: false,
    implementationMode: 'manifest-only',
  });
}

function freezeDecision(
  reason: ConnectorRuntimeDurableStateImplementationManifestReason,
  boundary?: ConnectorRuntimeDurableStateImplementationBoundaryDecision,
): Readonly<ConnectorRuntimeDurableStateImplementationManifestDecision> {
  const ready = reason === 'implementation_manifest_ready' && boundary !== undefined;
  return Object.freeze({
    status: ready ? 'implementation-manifest-ready' : 'blocked',
    manifestReady: ready,
    reason,
    manifest: freezeManifest(ready ? boundary : undefined),
    canPrepareHeadChatDurableSchemaExportImplementation: ready,
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
    storageDirective: MANIFEST_STORAGE_DIRECTIVE,
    implementationDirective: MANIFEST_IMPLEMENTATION_DIRECTIVE,
    sideEffectBoundary: MANIFEST_SIDE_EFFECT_BOUNDARY,
  });
}

export function evaluateConnectorRuntimeDurableStateImplementationManifest(
  input: ConnectorRuntimeDurableStateImplementationManifestInput = {},
): Readonly<ConnectorRuntimeDurableStateImplementationManifestDecision> {
  if (hasConnectorSecretMaterial(input.implementationBoundary)) {
    return freezeDecision('raw_secret_material');
  }

  const boundary = input.implementationBoundary;
  if (!boundary) return freezeDecision('implementation_boundary_missing');
  if (!isRecord(boundary)) return freezeDecision('implementation_boundary_invalid');
  if (boundary.status === 'blocked') return freezeDecision('implementation_boundary_not_ready');
  if (!boundaryCoreFactsValid(boundary)) return freezeDecision('implementation_boundary_invalid');
  if (!boundaryOwnerFactsValid(boundary)) return freezeDecision('implementation_owner_invalid');
  if (!boundarySourceFactsValid(boundary)) return freezeDecision('source_boundary_facts_invalid');
  if (!boundaryWriteSetLooksSafe(boundary)) return freezeDecision('future_write_set_invalid');
  if (!boundaryIsCurrent(boundary)) return freezeDecision('implementation_boundary_stale');

  return freezeDecision('implementation_manifest_ready', boundary);
}
