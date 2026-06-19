import { hasConnectorSecretMaterial, isSecretLikeFieldName } from './connector-credential-boundary';
import type { ConnectorRuntimePersistenceGuardDecision } from './connector-runtime-persistence-guard';
import { isRuntimeTrustedContractObject } from './runtime-trusted-contract-object';

export type ConnectorRuntimeImportExportReadinessSection =
  | 'schema'
  | 'types'
  | 'backup'
  | 'export'
  | 'import'
  | 'restore'
  | 'cascade'
  | 'redaction'
  | 'rollback'
  | 'standalone-parity';

export interface ConnectorRuntimeImportExportReadinessOwner {
  providerId: string;
  connectorId: string;
  targetSurface?: string;
}

export interface ConnectorRuntimeImportExportReadinessEvidenceDescriptor {
  section: ConnectorRuntimeImportExportReadinessSection;
  evidenceId: string;
  reviewedBy: string;
  reviewedAt: number;
  owner: Partial<ConnectorRuntimeImportExportReadinessOwner>;
  exportKeys?: readonly string[];
  samplePayloadMetadata?: unknown;
}

export interface ConnectorRuntimeImportExportReadinessPlanInput {
  owner?: Partial<ConnectorRuntimeImportExportReadinessOwner>;
  persistenceGuardDecision?: ConnectorRuntimePersistenceGuardDecision | null;
  evidence: readonly ConnectorRuntimeImportExportReadinessEvidenceDescriptor[];
  readyForSchemaChange?: false;
  readyForExport?: false;
  readyForImport?: false;
  readyForPersistence?: false;
}

export type ConnectorRuntimeImportExportReadinessPlanStatus = 'metadata-only' | 'blocked';

export type ConnectorRuntimeImportExportReadinessPlanBlockerCode =
  | 'owner_missing'
  | 'owner_unsafe'
  | 'persistence_guard_missing'
  | 'persistence_guard_blocked'
  | 'persistence_guard_boundary_invalid'
  | 'persistence_guard_owner_mismatch'
  | 'evidence_missing'
  | 'evidence_section_missing'
  | 'evidence_incomplete'
  | 'evidence_owner_mismatch'
  | 'raw_secret_or_token_evidence'
  | 'export_keys_not_allowed'
  | 'sample_payload_metadata_not_allowed'
  | 'forged_readiness_flag'
  | 'input_shape_forbidden';

export interface ConnectorRuntimeImportExportReadinessPlanBlocker {
  code: ConnectorRuntimeImportExportReadinessPlanBlockerCode;
  detail: string;
  field?: string;
}

export interface ConnectorRuntimeImportExportReadinessPlanMetadata {
  schemaVersion: 1;
  contract: 'connector-runtime-import-export-readiness-plan-v1';
  providerId?: string;
  connectorId?: string;
  targetSurface?: string;
  persistenceGuardContract?: 'connector-runtime-persistence-guard-v1';
  persistenceGuardRequestKind?: string;
  persistenceGuardStatus?: string;
  evidenceSectionCount: number;
  evidenceDescriptorCount: number;
  reviewedEvidenceCount: number;
  missingSectionCount: number;
  sections: readonly ConnectorRuntimeImportExportReadinessSection[];
  missingSections: readonly ConnectorRuntimeImportExportReadinessSection[];
}

export interface ConnectorRuntimeImportExportReadinessPlanDecision {
  status: ConnectorRuntimeImportExportReadinessPlanStatus;
  readyForSchemaChange: false;
  readyForExport: false;
  readyForImport: false;
  readyForPersistence: false;
  sideEffects: 'none';
  sideEffectBoundary: 'plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-no-credentials';
  storageDirective: 'metadata-only-do-not-persist-do-not-export-do-not-import';
  metadata: ConnectorRuntimeImportExportReadinessPlanMetadata;
  blockers: readonly ConnectorRuntimeImportExportReadinessPlanBlocker[];
}

const SIDE_EFFECT_BOUNDARY = 'plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-no-credentials';
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:@/+~-]+$/;
const MAX_IDENTIFIER_LENGTH = 180;
const REQUIRED_SECTIONS: readonly ConnectorRuntimeImportExportReadinessSection[] = Object.freeze([
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
]);

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
const URL_OR_SCHEME_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const PLAN_INPUT_KEYS = new Set([
  'owner',
  'persistenceGuardDecision',
  'evidence',
  'readyForSchemaChange',
  'readyForExport',
  'readyForImport',
  'readyForPersistence',
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
  'exportKeys',
  'samplePayloadMetadata',
]);
const UNSAFE_RUNTIME_FIELD_KEYS = new Set([
  'backupcallback',
  'browserstorage',
  'callback',
  'credentialresolver',
  'dexie',
  'eventsource',
  'executable',
  'execute',
  'exportcallback',
  'fetch',
  'indexeddb',
  'importcallback',
  'keychain',
  'liveaction',
  'localstorage',
  'request',
  'requester',
  'restorecallback',
  'schemawriter',
  'secretresolver',
  'send',
  'sessionstorage',
  'socket',
  'storage',
  'storageadapter',
  'synccallback',
  'websocket',
  'xhr',
]);

function blocker(
  code: ConnectorRuntimeImportExportReadinessPlanBlockerCode,
  detail: string,
  field?: string,
): ConnectorRuntimeImportExportReadinessPlanBlocker {
  return Object.freeze({ code, detail, field });
}

function stringLooksLikeToken(value: string): boolean {
  return TOKEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function identifierContainsTokenMarker(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return TOKEN_IDENTIFIER_MARKERS.some((marker) => normalized.includes(marker));
}

function normalizeFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function fieldNameIsUnsafeRuntimeHook(value: string): boolean {
  return UNSAFE_RUNTIME_FIELD_KEYS.has(normalizeFieldName(value));
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_IDENTIFIER_LENGTH) return undefined;
  if (!IDENTIFIER_PATTERN.test(trimmed)) return undefined;
  if (URL_OR_SCHEME_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(trimmed))) return undefined;
  if (isSecretLikeFieldName(trimmed) || identifierContainsTokenMarker(trimmed)) return undefined;
  if (stringLooksLikeToken(trimmed)) return undefined;
  return trimmed;
}

function ownerMatches(
  expected: Partial<ConnectorRuntimeImportExportReadinessOwner>,
  actual: Partial<ConnectorRuntimeImportExportReadinessOwner> | undefined,
): boolean {
  if (!actual) return false;
  return actual?.providerId === expected.providerId
    && actual.connectorId === expected.connectorId
    && (expected.targetSurface === undefined || actual.targetSurface === expected.targetSurface);
}

function guardOwnerMatches(
  owner: Partial<ConnectorRuntimeImportExportReadinessOwner>,
  guardDecision: ConnectorRuntimePersistenceGuardDecision,
): boolean {
  return guardDecision.metadata.providerId === owner.providerId
    && guardDecision.metadata.connectorId === owner.connectorId
    && (owner.targetSurface === undefined || guardDecision.metadata.targetSurface === owner.targetSurface);
}

function guardBoundaryIsInert(guardDecision: ConnectorRuntimePersistenceGuardDecision): boolean {
  return guardDecision.mayPersistRuntimeState === false
    && guardDecision.mayCreateDexieSchema === false
    && guardDecision.mayBackupOrExportRuntimeState === false
    && guardDecision.mayImportOrRestoreRuntimeState === false
    && guardDecision.maySyncRuntimeState === false
    && guardDecision.storageDirective === 'session-only-do-not-persist-do-not-export-do-not-sync'
    && guardDecision.sideEffects === 'none'
    && guardDecision.sideEffectBoundary === 'decision-only-no-fetch-no-indexeddb-no-localstorage-no-provider-no-credentials'
    && Array.isArray(guardDecision.blockers)
    && guardDecision.blockers.length === 0;
}

function addOwnerBlockers(
  blockers: ConnectorRuntimeImportExportReadinessPlanBlocker[],
  owner: Partial<ConnectorRuntimeImportExportReadinessOwner> | undefined,
): void {
  if (!owner?.providerId || !owner.connectorId) {
    blockers.push(blocker('owner_missing', 'Readiness plan requires a provider and connector owner.', 'owner'));
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

function addForgedReadinessFlagBlockers(
  blockers: ConnectorRuntimeImportExportReadinessPlanBlocker[],
  input: ConnectorRuntimeImportExportReadinessPlanInput,
): void {
  (['readyForSchemaChange', 'readyForExport', 'readyForImport', 'readyForPersistence'] as const).forEach((field) => {
    if (input[field] !== undefined && input[field] !== false) {
      blockers.push(blocker(
        'forged_readiness_flag',
        'Readiness flags are derived by this contract and cannot be supplied as true by callers.',
        field,
      ));
    }
  });
}

function addExactTrustedKeysBlockers(
  blockers: ConnectorRuntimeImportExportReadinessPlanBlocker[],
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  field: string,
): void {
  if (value === undefined || value === null) return;
  if (!isRuntimeTrustedContractObject(value)) {
    blockers.push(blocker(
      'input_shape_forbidden',
      'Readiness plan nested objects must be trusted contract objects before metadata traversal.',
      field,
    ));
    return;
  }

  Object.keys(value).forEach((key) => {
    if (!allowedKeys.has(key)) {
      blockers.push(blocker(
        'input_shape_forbidden',
        'Readiness plan input contains fields outside the reviewed metadata-only shape.',
        `${field}.${key}`,
      ));
    }
  });
}

function addUnsafeFieldBlockers(
  blockers: ConnectorRuntimeImportExportReadinessPlanBlocker[],
  value: unknown,
  field: string,
  seen = new WeakSet<object>(),
): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      addUnsafeFieldBlockers(blockers, entry, `${field}.${index}`, seen);
    });
    return;
  }
  if (typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  if (!isRuntimeTrustedContractObject(value)) {
    blockers.push(blocker(
      'input_shape_forbidden',
      'Readiness plan object values must come from trusted contract objects before metadata traversal.',
      field,
    ));
    return;
  }

  Object.keys(value).forEach((key) => {
    const keyPath = `${field}.${key}`;
    if (fieldNameIsUnsafeRuntimeHook(key)) {
      blockers.push(blocker(
        'input_shape_forbidden',
        'Readiness plan input must not carry executable, storage, requester, schema writer, or live-action fields.',
        keyPath,
      ));
    }
    addUnsafeFieldBlockers(blockers, value[key], keyPath, seen);
  });
}

function addInputShapeBlockers(
  blockers: ConnectorRuntimeImportExportReadinessPlanBlocker[],
  input: ConnectorRuntimeImportExportReadinessPlanInput,
): void {
  addExactTrustedKeysBlockers(blockers, input, PLAN_INPUT_KEYS, 'input');
  addExactTrustedKeysBlockers(blockers, input.owner, OWNER_KEYS, 'owner');
  addUnsafeFieldBlockers(blockers, input, 'input');

  if (Array.isArray(input.evidence)) {
    input.evidence.forEach((descriptor, index) => {
      addExactTrustedKeysBlockers(blockers, descriptor, EVIDENCE_DESCRIPTOR_KEYS, `evidence.${index}`);
      addExactTrustedKeysBlockers(blockers, descriptor.owner, OWNER_KEYS, `evidence.${index}.owner`);
    });
  }
}

function addEvidenceBlockers(
  blockers: ConnectorRuntimeImportExportReadinessPlanBlocker[],
  input: ConnectorRuntimeImportExportReadinessPlanInput,
): {
  readonly sections: readonly ConnectorRuntimeImportExportReadinessSection[];
  readonly missingSections: readonly ConnectorRuntimeImportExportReadinessSection[];
  readonly reviewedEvidenceCount: number;
} {
  const seenSections = new Set<ConnectorRuntimeImportExportReadinessSection>();
  let reviewedEvidenceCount = 0;

  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    blockers.push(blocker('evidence_missing', 'Readiness plan requires reviewed evidence descriptors for every import/export persistence section.', 'evidence'));
    return {
      sections: Object.freeze([]),
      missingSections: Object.freeze([...REQUIRED_SECTIONS]),
      reviewedEvidenceCount,
    };
  }

  input.evidence.forEach((descriptor, index) => {
    if (!REQUIRED_SECTIONS.includes(descriptor.section)) {
      blockers.push(blocker('evidence_incomplete', 'Evidence descriptor section must be one of the reviewed readiness sections.', `evidence.${index}.section`));
      return;
    }

    seenSections.add(descriptor.section);

    if (safeIdentifier(descriptor.evidenceId) === undefined || stringLooksLikeToken(descriptor.reviewedBy)) {
      blockers.push(blocker('raw_secret_or_token_evidence', 'Evidence descriptors must not contain raw secrets, token-shaped identifiers, or secret-like field names.', `evidence.${index}`));
    }

    if (typeof descriptor.reviewedBy !== 'string' || !descriptor.reviewedBy.trim()) {
      blockers.push(blocker('evidence_incomplete', 'Evidence descriptor must include reviewer metadata.', `evidence.${index}.reviewedBy`));
    }

    if (typeof descriptor.reviewedAt !== 'number' || !Number.isSafeInteger(descriptor.reviewedAt) || descriptor.reviewedAt <= 0) {
      blockers.push(blocker('evidence_incomplete', 'Evidence descriptor must include a positive reviewed timestamp.', `evidence.${index}.reviewedAt`));
    }

    if (!ownerMatches(input.owner ?? {}, descriptor.owner)) {
      blockers.push(blocker('evidence_owner_mismatch', 'Evidence descriptor owner must match the requested readiness owner.', `evidence.${index}.owner`));
    }

    if (descriptor.exportKeys !== undefined) {
      blockers.push(blocker('export_keys_not_allowed', 'Readiness evidence must summarize export review without carrying export keys.', `evidence.${index}.exportKeys`));
    }

    if (descriptor.samplePayloadMetadata !== undefined) {
      blockers.push(blocker('sample_payload_metadata_not_allowed', 'Readiness evidence must not carry sample payload metadata.', `evidence.${index}.samplePayloadMetadata`));
      if (hasConnectorSecretMaterial(descriptor.samplePayloadMetadata)) {
        blockers.push(blocker('raw_secret_or_token_evidence', 'Sample payload metadata must not contain raw secrets or token-shaped values.', `evidence.${index}.samplePayloadMetadata`));
      }
    }

    reviewedEvidenceCount += 1;
  });

  const sections = REQUIRED_SECTIONS.filter((section) => seenSections.has(section));
  const missingSections = REQUIRED_SECTIONS.filter((section) => !seenSections.has(section));
  missingSections.forEach((section) => {
    blockers.push(blocker('evidence_section_missing', 'Readiness plan is missing a required reviewed evidence section.', `evidence.${section}`));
  });

  return {
    sections: Object.freeze(sections),
    missingSections: Object.freeze(missingSections),
    reviewedEvidenceCount,
  };
}

export function evaluateConnectorRuntimeImportExportReadinessPlan(
  input: ConnectorRuntimeImportExportReadinessPlanInput,
): ConnectorRuntimeImportExportReadinessPlanDecision {
  const blockers: ConnectorRuntimeImportExportReadinessPlanBlocker[] = [];

  if (!isRuntimeTrustedContractObject(input)) {
    blockers.push(blocker(
      'input_shape_forbidden',
      'Readiness plan input must be built by the trusted runtime contract object factory before any owner, guard, or evidence traversal.',
      'input',
    ));
    return Object.freeze({
      status: 'blocked',
      readyForSchemaChange: false,
      readyForExport: false,
      readyForImport: false,
      readyForPersistence: false,
      sideEffects: 'none',
      sideEffectBoundary: SIDE_EFFECT_BOUNDARY,
      storageDirective: 'metadata-only-do-not-persist-do-not-export-do-not-import',
      metadata: Object.freeze({
        schemaVersion: 1 as const,
        contract: 'connector-runtime-import-export-readiness-plan-v1' as const,
        evidenceSectionCount: 0,
        evidenceDescriptorCount: 0,
        reviewedEvidenceCount: 0,
        missingSectionCount: REQUIRED_SECTIONS.length,
        sections: Object.freeze([]),
        missingSections: Object.freeze([...REQUIRED_SECTIONS]),
      }),
      blockers: Object.freeze(blockers),
    });
  }

  addInputShapeBlockers(blockers, input);
  addOwnerBlockers(blockers, input.owner);
  addForgedReadinessFlagBlockers(blockers, input);

  const guardDecision = input.persistenceGuardDecision;
  if (!guardDecision) {
    blockers.push(blocker('persistence_guard_missing', 'Readiness plan requires an existing connector runtime persistence guard decision.', 'persistenceGuardDecision'));
  } else {
    if (guardDecision.status !== 'allow-session-only' || guardDecision.mayUseSessionOnlyRuntimeState !== true) {
      blockers.push(blocker('persistence_guard_blocked', 'Readiness plan can only compose an allow-session-only persistence guard decision.', 'persistenceGuardDecision.status'));
    }
    if (!guardBoundaryIsInert(guardDecision)) {
      blockers.push(blocker('persistence_guard_boundary_invalid', 'Persistence guard must preserve the full no-persistence boundary without durable storage, import/export, sync, side effects, or blockers.', 'persistenceGuardDecision'));
    }
    if (!guardOwnerMatches(input.owner ?? {}, guardDecision)) {
      blockers.push(blocker('persistence_guard_owner_mismatch', 'Persistence guard owner metadata must match the requested readiness owner.', 'persistenceGuardDecision.metadata'));
    }
  }

  const evidenceSummary = addEvidenceBlockers(blockers, input);
  const providerId = safeIdentifier(input.owner?.providerId);
  const connectorId = safeIdentifier(input.owner?.connectorId);
  const targetSurface = safeIdentifier(input.owner?.targetSurface);
  const metadata = Object.freeze({
    schemaVersion: 1 as const,
    contract: 'connector-runtime-import-export-readiness-plan-v1' as const,
    providerId,
    connectorId,
    targetSurface,
    persistenceGuardContract: guardDecision?.metadata.contract,
    persistenceGuardRequestKind: guardDecision?.metadata.requestKind,
    persistenceGuardStatus: guardDecision?.status,
    evidenceSectionCount: evidenceSummary.sections.length,
    evidenceDescriptorCount: Array.isArray(input.evidence) ? input.evidence.length : 0,
    reviewedEvidenceCount: evidenceSummary.reviewedEvidenceCount,
    missingSectionCount: evidenceSummary.missingSections.length,
    sections: evidenceSummary.sections,
    missingSections: evidenceSummary.missingSections,
  });

  return Object.freeze({
    status: blockers.length === 0 ? 'metadata-only' : 'blocked',
    readyForSchemaChange: false,
    readyForExport: false,
    readyForImport: false,
    readyForPersistence: false,
    sideEffects: 'none',
    sideEffectBoundary: SIDE_EFFECT_BOUNDARY,
    storageDirective: 'metadata-only-do-not-persist-do-not-export-do-not-import',
    metadata,
    blockers: Object.freeze(blockers),
  });
}
