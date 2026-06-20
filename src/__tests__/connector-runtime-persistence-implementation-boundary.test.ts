import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateConnectorRuntimeImportExportReadinessPlan,
  type ConnectorRuntimeImportExportReadinessEvidenceDescriptor,
  type ConnectorRuntimeImportExportReadinessOwner,
  type ConnectorRuntimeImportExportReadinessSection,
} from '../lib/connector-runtime-import-export-readiness-plan';
import {
  evaluateConnectorRuntimePersistenceGuard,
  type ConnectorRuntimeNoPersistenceBoundary,
} from '../lib/connector-runtime-persistence-guard';
import {
  CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS,
  evaluateConnectorRuntimePersistenceImplementationBoundary,
  type ConnectorRuntimePersistenceImplementationEvidenceDescriptor,
  type ConnectorRuntimePersistenceImplementationProof,
  type ConnectorRuntimePersistenceImplementationResultProof,
} from '../lib/connector-runtime-persistence-implementation-boundary';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const owner: ConnectorRuntimeImportExportReadinessOwner = {
  providerId: 'generic-webhook',
  connectorId: 'generic-webhook-runtime',
  targetSurface: 'provider-catalog',
};

const readinessSections: readonly ConnectorRuntimeImportExportReadinessSection[] = [
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
];

function noPersistenceBoundary(
  overrides: Partial<ConnectorRuntimeNoPersistenceBoundary> = {},
): ConnectorRuntimeNoPersistenceBoundary {
  return {
    mode: 'session-only',
    durableStorage: false,
    browserStorage: false,
    rawSecrets: false,
    network: false,
    providerCalls: false,
    schemaChange: false,
    backupRestore: false,
    importExport: false,
    syncState: false,
    ...overrides,
  };
}

function persistenceGuardDecision() {
  return evaluateConnectorRuntimePersistenceGuard(trustedObject({
    requestKind: 'no-persistence-session-only',
    providerId: owner.providerId,
    connectorId: owner.connectorId,
    targetSurface: owner.targetSurface,
    stateLabel: 'session-runtime-state',
    proposedFields: ['selectedProviderId', 'setupStep', 'lastCheckedAt'],
    migrationLabels: [],
    exportKeys: [],
    noPersistenceBoundary: noPersistenceBoundary(),
  }) as unknown as Parameters<typeof evaluateConnectorRuntimePersistenceGuard>[0]);
}

function readinessEvidence(): ConnectorRuntimeImportExportReadinessEvidenceDescriptor[] {
  return readinessSections.map((section, index) => ({
    section,
    evidenceId: `readiness-evidence-${section}-${index}`,
    reviewedBy: 'security-reviewer',
    reviewedAt: 1_700_000_000_000 + index,
    owner,
  }));
}

function readinessPlanDecision() {
  return evaluateConnectorRuntimeImportExportReadinessPlan(
    trustedObject({
      owner,
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: readinessEvidence(),
    }) as unknown as Parameters<typeof evaluateConnectorRuntimeImportExportReadinessPlan>[0],
  );
}

function implementationEvidence(
  overrides: Partial<ConnectorRuntimePersistenceImplementationEvidenceDescriptor> = {},
): ConnectorRuntimePersistenceImplementationEvidenceDescriptor[] {
  return CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.map((requirement, index) => ({
    section: requirement.section,
    evidenceId: `implementation-evidence-${requirement.section}-${index}`,
    reviewedBy: 'security-reviewer',
    reviewedAt: 1_700_000_000_000 + index,
    owner,
    files: requirement.requiredFiles,
    gate: `focused-${requirement.section}-gate`,
    ...overrides,
  }));
}

function expectedFutureWriteSet(): readonly string[] {
  return [...new Set(
    CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.flatMap((requirement) => requirement.requiredFiles),
  )].sort();
}

function implementationProof(
  overrides: Partial<ConnectorRuntimePersistenceImplementationProof> = {},
): ConnectorRuntimePersistenceImplementationProof {
  return {
    contract: 'connector-runtime-persistence-implementation-proof-v1',
    proofOwner: 'assistantcaddy-head-chat-connector-runtime-persistence-implementation',
    proofId: 'implementation-proof-reviewed-001',
    proofVersion: '2026.06.13',
    providerId: owner.providerId,
    connectorId: owner.connectorId,
    targetSurface: owner.targetSurface,
    reviewedSchemaOwner: 'head-chat',
    reviewedExportImportBackupRestoreOwner: 'head-chat',
    schemaOwnershipReviewed: true,
    exportImportBackupRestoreOwnershipReviewed: true,
    exactFutureWriteSet: expectedFutureWriteSet(),
    checkpointProofId: 'checkpoint-proof-reviewed-001',
    rollbackProofId: 'rollback-proof-reviewed-001',
    checkpointProofReviewed: true,
    rollbackProofReviewed: true,
    secretRedactionProofId: 'redaction-proof-reviewed-001',
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
    sideEffectBoundary:
      'connector-runtime-persistence-implementation-proof-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials',
    ...overrides,
  };
}

function implementationResult(
  overrides: Partial<ConnectorRuntimePersistenceImplementationResultProof> = {},
): ConnectorRuntimePersistenceImplementationResultProof {
  return {
    contract: 'connector-runtime-persistence-implementation-result-v1',
    resultOwner: 'assistantcaddy-connector-runtime-persistence-implementation-boundary',
    resultId: 'implementation-result-reviewed-001',
    sourceBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1',
    providerId: owner.providerId,
    connectorId: owner.connectorId,
    targetSurface: owner.targetSurface,
    checkpointProofId: 'checkpoint-proof-reviewed-001',
    rollbackProofId: 'rollback-proof-reviewed-001',
    secretRedactionProofId: 'redaction-proof-reviewed-001',
    persisted: false,
    schemaChanged: false,
    exported: false,
    imported: false,
    restored: false,
    synced: false,
    storageRead: false,
    storageWritten: false,
    migrationRan: false,
    generatedArtifacts: false,
    promotedStandalone: false,
    executable: false,
    sideEffects: 'none',
    sideEffectBoundary:
      'connector-runtime-persistence-implementation-result-metadata-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials',
    ...overrides,
  };
}

function trustedValue(value: unknown): RuntimeTrustedContractValue {
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) return value.map(trustedValue);
  if (typeof value === 'object') return trustedObject(value as Record<string, unknown>);

  throw new TypeError('Trusted persistence fixtures cannot include executable values.');
}

function trustedObject(value: Record<string, unknown>): RuntimeTrustedContractObject {
  const entries = Object.entries(value).map(([key, entryValue]) => [
    key,
    trustedValue(entryValue),
  ] as RuntimeTrustedContractEntry);
  return createRuntimeTrustedContractObject(entries);
}

function trustedBoundaryInput(
  input: Record<string, unknown>,
): Parameters<typeof evaluateConnectorRuntimePersistenceImplementationBoundary>[0] {
  return trustedObject(input) as unknown as Parameters<typeof evaluateConnectorRuntimePersistenceImplementationBoundary>[0];
}

function evaluateTrusted(input: Record<string, unknown>) {
  return evaluateConnectorRuntimePersistenceImplementationBoundary(trustedBoundaryInput(input));
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe('connector runtime persistence implementation boundary', () => {
  it('returns a frozen implementation checklist when every upstream decision and evidence section is independently complete', () => {
    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
    });

    expect(decision).toMatchObject({
      status: 'implementation-checklist-ready',
      readyForDurableRuntimeImplementation: true,
      executablePersistenceContract: false,
      executableFeasibility: 'blocked-requires-broader-durable-write-set',
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
      mayBackupOrExportRuntimeState: false,
      mayImportOrRestoreRuntimeState: false,
      maySyncRuntimeState: false,
      sideEffects: 'none',
      sideEffectBoundary: 'implementation-checklist-only-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials',
      storageDirective: 'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import',
      metadata: {
        schemaVersion: 1,
        contract: 'connector-runtime-persistence-implementation-boundary-v1',
        providerId: 'generic-webhook',
        connectorId: 'generic-webhook-runtime',
        targetSurface: 'provider-catalog',
        importExportReadinessContract: 'connector-runtime-import-export-readiness-plan-v1',
        importExportReadinessStatus: 'metadata-only',
        persistenceGuardContract: 'connector-runtime-persistence-guard-v1',
        persistenceGuardStatus: 'allow-session-only',
        requirementCount: 10,
        evidenceDescriptorCount: 10,
        reviewedEvidenceCount: 10,
        missingSectionCount: 0,
      },
      blockers: [],
    });
    expect(decision.metadata.sections).toEqual([
      'schema',
      'types',
      'backup',
      'export',
      'import',
      'restore',
      'sync',
      'cascade',
      'redaction',
      'rollback',
    ]);
    expect(decision.metadata.requirements.map((requirement) => requirement.section)).toEqual(decision.metadata.sections);
    expect(decision.metadata.requirements.find((requirement) => requirement.section === 'schema')?.requiredFiles).toEqual(['src/db.ts']);
    expect(decision.metadata.requirements.find((requirement) => requirement.section === 'export')?.requiredFiles).toEqual(['src/lib/export.ts']);
    expect(decision.metadata.requirements.find((requirement) => requirement.section === 'sync')?.requiredFiles).toEqual([
      'src/lib/sync-engine.ts',
      'src/lib/sync-middleware.ts',
      'src/lib/sync-sanitize.ts',
      'src/lib/cloud-sync.ts',
      'server/src/index.ts',
      'server/src/types.ts',
    ]);
    expect(decision.metadata.requirements.flatMap((requirement) => requirement.requiredFiles)).not.toEqual(expect.arrayContaining([
      'src/lib/sync.ts',
      'server/',
    ]));
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.metadata)).toBe(true);
    expect(Object.isFrozen(decision.metadata.sections)).toBe(true);
    expect(Object.isFrozen(decision.metadata.requirements)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(serialized(decision)).not.toContain('implementation-evidence-schema-0');
  });

  it('fails closed when implementation evidence sections or upstream decisions are missing', () => {
    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: null,
      persistenceGuardDecision: null,
      evidence: implementationEvidence().filter((descriptor) => descriptor.section !== 'sync'),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.executablePersistenceContract).toBe(false);
    expect(decision.executableFeasibility).toBe('blocked-requires-broader-durable-write-set');
    expect(decision.mayPersistRuntimeState).toBe(false);
    expect(decision.mayCreateDexieSchema).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'readiness_plan_missing',
      'persistence_guard_missing',
      'implementation_evidence_section_missing',
    ]));
    expect(decision.metadata.missingSections).toEqual(['sync']);
  });

  it('blocks forged caller readiness flags and forged upstream decisions that claim readiness while changing boundaries', () => {
    const forgedReadiness = {
      ...readinessPlanDecision(),
      readyForPersistence: true,
      metadata: {
        ...readinessPlanDecision().metadata,
        missingSectionCount: 0,
        missingSections: [],
      },
    } as unknown as ReturnType<typeof readinessPlanDecision>;
    const forgedGuard = {
      ...persistenceGuardDecision(),
      mayPersistRuntimeState: true,
      storageDirective: 'blocked-no-connector-runtime-persistence',
    } as unknown as ReturnType<typeof persistenceGuardDecision>;

    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: forgedReadiness,
      persistenceGuardDecision: forgedGuard,
      evidence: implementationEvidence(),
      readyForDurableImplementation: true,
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'forged_implementation_ready_flag',
      'readiness_plan_boundary_invalid',
      'persistence_guard_boundary_invalid',
    ]));
  });

  it('requires every section to name the exact source files for the implementation area', () => {
    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence({
        section: 'backup',
        files: ['src/lib/backup-data.ts'],
      }),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'implementation_evidence_file_missing',
      'implementation_evidence_section_missing',
    ]));
    expect(decision.metadata.missingSections).toEqual(expect.arrayContaining([
      'schema',
      'types',
      'export',
      'import',
      'restore',
      'sync',
      'cascade',
      'redaction',
      'rollback',
    ]));
  });

  it('blocks owner mismatches and token-shaped evidence without echoing raw values', () => {
    const tokenEvidenceId = 'ghp_donotechothisimplementationtoken';
    const tokenGate = 'Bearer do-not-echo-implementation-gate';
    const tokenOwner = 'sk-do-not-echo-owner-token';
    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence({
        evidenceId: tokenEvidenceId,
        gate: tokenGate,
        owner: {
          providerId: tokenOwner,
          connectorId: 'slack-runtime',
          targetSurface: owner.targetSurface,
        },
      }),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'implementation_evidence_owner_mismatch',
      'raw_secret_or_token_evidence',
    ]));
    expect(decision.metadata.providerId).toBe(owner.providerId);
    expect(decision.metadata.reviewedEvidenceCount).toBe(0);
    expect(serialized(decision)).not.toContain(tokenEvidenceId);
    expect(serialized(decision)).not.toContain('do-not-echo');
    expect(serialized(decision)).not.toContain('slack-runtime');
    expect(serialized(decision)).not.toContain(tokenOwner);
  });

  it('accepts exact proof-bound future write-set and inert result metadata without exposing proof or result details', () => {
    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
      implementationProof: implementationProof(),
      proposedFutureWriteSet: expectedFutureWriteSet(),
      implementationResult: implementationResult(),
    });

    expect(decision).toMatchObject({
      status: 'implementation-checklist-ready',
      readyForDurableRuntimeImplementation: true,
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
      mayBackupOrExportRuntimeState: false,
      mayImportOrRestoreRuntimeState: false,
      maySyncRuntimeState: false,
      blockers: [],
    });
    expect(serialized(decision)).not.toContain('implementation-proof-reviewed-001');
    expect(serialized(decision)).not.toContain('implementation-result-reviewed-001');
    expect(serialized(decision)).not.toContain('checkpoint-proof-reviewed-001');
    expect(serialized(decision)).not.toContain('redaction-proof-reviewed-001');
  });

  it('requires proof and exact future write-set before accepting implementation-shaped runtime inputs', () => {
    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
      proposedFutureWriteSet: ['src/db.ts', 'docs/unsafe-durable-plan.md'],
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'implementation_proof_missing',
      'future_write_set_invalid',
    ]));
    expect(serialized(decision)).not.toContain('unsafe-durable-plan');
  });

  it('rejects invalid checkpoint, rollback, admin, secret, activation, and runtime-plan provenance claims', () => {
    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
      implementationProof: implementationProof({
        checkpointProofId: '',
        adminApprovalReviewed: false as true,
        noBackupLeakage: false as true,
      }),
      liveActivationDecision: {
        status: 'ready',
        ready: true,
        reason: 'durable_persistence_live_activation_gate_ready',
        mayPersistRuntimeState: true,
        plan: {},
      },
      runtimeActivationPlanDecision: {
        status: 'implementation-plan-ready',
        ready: true,
        reason: 'durable_persistence_runtime_activation_plan_ready',
        implementationPlan: {
          executable: true,
        },
      },
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'checkpoint_rollback_proof_invalid',
      'admin_approval_invalid',
      'secret_posture_invalid',
      'live_activation_provenance_invalid',
      'runtime_activation_plan_provenance_invalid',
    ]));
  });

  it('rejects unsafe storage, schema, export/import/backup, requester, socket, live-action, and live result shapes without invoking them', () => {
    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
      implementationProof: implementationProof(),
      proposedFutureWriteSet: expectedFutureWriteSet(),
      dexie: { open: 'blocked-dexie-open' },
      schemaWriter: 'blocked-schema-writer',
      exportCallback: 'blocked-export-callback',
      requester: 'blocked-requester',
      socket: { send: 'blocked-socket-send' },
      liveAction: 'blocked-live-action',
      implementationResult: implementationResult({
        persisted: true as false,
        schemaChanged: true as false,
        exported: true as false,
      }),
      executable: true,
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.mayPersistRuntimeState).toBe(false);
    expect(decision.mayCreateDexieSchema).toBe(false);
    expect(decision.mayBackupOrExportRuntimeState).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'storage_shape_forbidden',
      'schema_writer_forbidden',
      'operation_callback_forbidden',
      'runtime_shape_forbidden',
      'forged_runtime_flag',
      'implementation_result_live_claim',
    ]));
  });

  it('keeps executable persistence test doubles untrusted and non-invoked', () => {
    const storageAdapter = vi.fn();
    const schemaWriter = vi.fn();
    const exportCallback = vi.fn();
    const decision = evaluateConnectorRuntimePersistenceImplementationBoundary({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
      implementationProof: implementationProof(),
      proposedFutureWriteSet: expectedFutureWriteSet(),
      implementationResult: implementationResult(),
      storageAdapter,
      schemaWriter,
      exportCallback,
      executable: true,
    } as unknown as Parameters<typeof evaluateConnectorRuntimePersistenceImplementationBoundary>[0]);

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.executablePersistenceContract).toBe(false);
    expect(decision.executableFeasibility).toBe('blocked-requires-broader-durable-write-set');
    expect(decision.mayPersistRuntimeState).toBe(false);
    expect(decision.mayCreateDexieSchema).toBe(false);
    expect(decision.mayBackupOrExportRuntimeState).toBe(false);
    expect(decision.mayImportOrRestoreRuntimeState).toBe(false);
    expect(decision.maySyncRuntimeState).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'runtime_shape_forbidden',
    ]));
    expect(storageAdapter).not.toHaveBeenCalled();
    expect(schemaWriter).not.toHaveBeenCalled();
    expect(exportCallback).not.toHaveBeenCalled();
  });

  it('checks root exact keys before raw-secret scanning while preserving checklist-only persistence', () => {
    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
      requester: 'Bearer do-not-echo-runtime-requester-token',
    });
    const codes = decision.blockers.map((blocker) => blocker.code);

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.mayPersistRuntimeState).toBe(false);
    expect(decision.mayCreateDexieSchema).toBe(false);
    expect(decision.mayBackupOrExportRuntimeState).toBe(false);
    expect(codes).toEqual(expect.arrayContaining([
      'runtime_shape_forbidden',
      'raw_secret_or_token_evidence',
    ]));
    expect(codes.indexOf('runtime_shape_forbidden')).toBeLessThan(codes.indexOf('raw_secret_or_token_evidence'));
    expect(serialized(decision)).not.toContain('do-not-echo-runtime-requester-token');
  });

  it('fails closed for accessor-poisoned root and evidence fields without executing getters or storage/API paths', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const ownerGetter = vi.fn(() => {
      fetchSpy('https://example.invalid/persistence-owner-probe');
      return owner;
    });
    const evidenceGetter = vi.fn(() => {
      window.localStorage.setItem('runtime-persistence', '[fixture secret-like value]');
      return 'schema';
    });
    const poisonedEvidence = implementationEvidence();
    Object.defineProperty(poisonedEvidence[0], 'section', {
      enumerable: true,
      get: evidenceGetter,
    });
    const poisonedInput: Record<string, unknown> = {
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: poisonedEvidence,
    };
    Object.defineProperty(poisonedInput, 'owner', {
      enumerable: true,
      get: ownerGetter,
    });

    const decision = evaluateConnectorRuntimePersistenceImplementationBoundary(
      poisonedInput as unknown as Parameters<typeof evaluateConnectorRuntimePersistenceImplementationBoundary>[0],
    );

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.mayPersistRuntimeState).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'runtime_shape_forbidden',
    ]));
    expect(ownerGetter).not.toHaveBeenCalled();
    expect(evidenceGetter).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(serialized(decision)).not.toContain('persistence-owner-probe');
    expect(serialized(decision)).not.toContain('fixture secret-like value');
  });

  it('fails closed for proxied root inputs without invoking descriptor, prototype, or get traps', () => {
    const traps = {
      get: vi.fn((proxyTarget: Record<string, unknown>, property: string | symbol, receiver: unknown) => (
        Reflect.get(proxyTarget, property, receiver)
      )),
      ownKeys: vi.fn((proxyTarget: Record<string, unknown>) => Reflect.ownKeys(proxyTarget)),
      getOwnPropertyDescriptor: vi.fn((proxyTarget: Record<string, unknown>, property: string | symbol) => (
        Reflect.getOwnPropertyDescriptor(proxyTarget, property)
      )),
      getPrototypeOf: vi.fn((proxyTarget: Record<string, unknown>) => Reflect.getPrototypeOf(proxyTarget)),
    };
    const proxiedInput = new Proxy({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
    }, traps);

    const decision = evaluateConnectorRuntimePersistenceImplementationBoundary(
      proxiedInput as unknown as Parameters<typeof evaluateConnectorRuntimePersistenceImplementationBoundary>[0],
    );

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.mayPersistRuntimeState).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'runtime_shape_forbidden',
    ]));
    expect(traps.get).not.toHaveBeenCalled();
    expect(traps.ownKeys).not.toHaveBeenCalled();
    expect(traps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(traps.getPrototypeOf).not.toHaveBeenCalled();
  });

  it('fails closed for proxied nested implementation results without invoking traps or getter bodies', () => {
    const websocketSpy = vi.fn();
    vi.stubGlobal('WebSocket', websocketSpy);
    const persistedGetter = vi.fn(() => {
      websocketSpy('wss://example.invalid/runtime-result-probe');
      return false;
    });
    const target: Record<string, unknown> = { ...implementationResult() };
    Object.defineProperty(target, 'persisted', {
      enumerable: true,
      get: persistedGetter,
    });
    const traps = {
      get: vi.fn((proxyTarget: Record<string, unknown>, property: string | symbol, receiver: unknown) => (
        Reflect.get(proxyTarget, property, receiver)
      )),
      ownKeys: vi.fn((proxyTarget: Record<string, unknown>) => Reflect.ownKeys(proxyTarget)),
      getOwnPropertyDescriptor: vi.fn((proxyTarget: Record<string, unknown>, property: string | symbol) => (
        Reflect.getOwnPropertyDescriptor(proxyTarget, property)
      )),
      getPrototypeOf: vi.fn((proxyTarget: Record<string, unknown>) => Reflect.getPrototypeOf(proxyTarget)),
    };
    const proxiedResult = new Proxy(target, traps);

    const decision = evaluateConnectorRuntimePersistenceImplementationBoundary({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
      implementationProof: implementationProof(),
      proposedFutureWriteSet: expectedFutureWriteSet(),
      implementationResult: proxiedResult,
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.mayPersistRuntimeState).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'runtime_shape_forbidden',
    ]));
    expect(persistedGetter).not.toHaveBeenCalled();
    expect(traps.get).not.toHaveBeenCalled();
    expect(traps.ownKeys).not.toHaveBeenCalled();
    expect(traps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(traps.getPrototypeOf).not.toHaveBeenCalled();
    expect(websocketSpy).not.toHaveBeenCalled();
    expect(serialized(decision)).not.toContain('runtime-result-probe');
  });

  it('keeps exact implementation result owner binding fail-closed after descriptor sanitization', () => {
    const mismatchedProviderId = 'slack-provider-runtime';
    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
      implementationProof: implementationProof(),
      proposedFutureWriteSet: expectedFutureWriteSet(),
      implementationResult: implementationResult({
        providerId: mismatchedProviderId,
      }),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.mayPersistRuntimeState).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'implementation_result_owner_mismatch',
    ]));
    expect(serialized(decision)).not.toContain(mismatchedProviderId);
  });

  it('fails closed for malformed root input without throwing', () => {
    const decision = evaluateConnectorRuntimePersistenceImplementationBoundary(null as never);

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.mayPersistRuntimeState).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'runtime_shape_forbidden',
    ]));
    expect(decision.metadata.evidenceDescriptorCount).toBe(0);
    expect(decision.metadata.missingSectionCount).toBe(CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length);
  });

  it('rejects nested forged runtime fields in readiness, guard, and evidence metadata', () => {
    const forgedReadiness = {
      ...readinessPlanDecision(),
      metadata: {
        ...readinessPlanDecision().metadata,
        fetch: 'blocked-fetch-field',
      },
    } as unknown as ReturnType<typeof readinessPlanDecision>;
    const forgedGuard = {
      ...persistenceGuardDecision(),
      metadata: {
        ...persistenceGuardDecision().metadata,
        storage: { marker: 'blocked-storage-field' },
      },
    } as unknown as ReturnType<typeof persistenceGuardDecision>;
    const forgedEvidence = implementationEvidence().map((descriptor, index) => index === 0
      ? {
          ...descriptor,
          requester: 'blocked-requester-field',
        } as unknown as ConnectorRuntimePersistenceImplementationEvidenceDescriptor
      : descriptor);

    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: forgedReadiness,
      persistenceGuardDecision: forgedGuard,
      evidence: forgedEvidence,
      implementationProof: implementationProof(),
      proposedFutureWriteSet: expectedFutureWriteSet(),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'readiness_plan_boundary_invalid',
      'persistence_guard_boundary_invalid',
      'runtime_shape_forbidden',
    ]));
  });

  it('rejects runtime-capable values inside allowed metadata and evidence fields', () => {
    const forgedReadiness = {
      ...readinessPlanDecision(),
      metadata: {
        ...readinessPlanDecision().metadata,
        sections: [
          { fetch: 'blocked-fetch-field' },
          ...readinessPlanDecision().metadata.sections.slice(1),
        ],
      },
    } as unknown as ReturnType<typeof readinessPlanDecision>;
    const forgedGuard = {
      ...persistenceGuardDecision(),
      metadata: {
        ...persistenceGuardDecision().metadata,
        stateLabel: { storage: 'blocked-storage-field' },
      },
    } as unknown as ReturnType<typeof persistenceGuardDecision>;
    const forgedEvidence = implementationEvidence({
      gate: { requester: 'blocked-requester-field' } as never,
    });

    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: forgedReadiness,
      persistenceGuardDecision: forgedGuard,
      evidence: forgedEvidence,
      implementationProof: implementationProof(),
      proposedFutureWriteSet: expectedFutureWriteSet(),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'readiness_plan_boundary_invalid',
      'persistence_guard_boundary_invalid',
      'raw_secret_or_token_evidence',
    ]));
  });

  it('rejects credential-bearing URL identifiers before metadata echo', () => {
    const webhookUrl = 'https://hooks.slack.com/services/T000/B000/secret-value';
    const decision = evaluateTrusted({
      owner: {
        providerId: webhookUrl,
        connectorId: 'generic-webhook-runtime',
        targetSurface: 'provider-catalog',
      },
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.metadata.providerId).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'owner_unsafe',
      'raw_secret_or_token_evidence',
    ]));
    expect(serialized(decision)).not.toContain('hooks.slack.com');
    expect(serialized(decision)).not.toContain('secret-value');
  });

  it('rejects colon-only scheme identifiers before persistence metadata echo', () => {
    const unsafeIdentifiers = [
      'mailto:user@example.test',
      'urn:provider:opaque',
      'provider-oauth:gmail/account-1',
      'vault:path/to/threatcaddy/generic-webhook/account-1',
      'local-bridge:assistantcaddy/llm',
    ];

    unsafeIdentifiers.forEach((unsafeIdentifier) => {
      const decision = evaluateTrusted({
        owner: {
          providerId: unsafeIdentifier,
          connectorId: 'generic-webhook-runtime',
          targetSurface: 'provider-catalog',
        },
        importExportReadinessPlanDecision: readinessPlanDecision(),
        persistenceGuardDecision: persistenceGuardDecision(),
        evidence: implementationEvidence({
          gate: unsafeIdentifier,
        }),
      });

      expect(decision.status).toBe('blocked');
      expect(decision.readyForDurableRuntimeImplementation).toBe(false);
      expect(decision.metadata.providerId).toBeUndefined();
      expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
        'owner_unsafe',
        'raw_secret_or_token_evidence',
      ]));
      expect(serialized(decision)).not.toContain(unsafeIdentifier);
    });
  });

  it('rejects raw secrets and mismatched implementation results without leaking caller-provided values', () => {
    const rawSecret = 'Bearer should-not-echo-implementation-boundary-token';
    const decision = evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
      implementationProof: {
        ...implementationProof(),
        authorizationHeader: rawSecret,
      },
      proposedFutureWriteSet: expectedFutureWriteSet(),
      implementationResult: implementationResult({
        connectorId: 'wrong-runtime-connector',
      }),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForDurableRuntimeImplementation).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'raw_secret_or_token_evidence',
      'implementation_proof_invalid',
      'implementation_result_owner_mismatch',
    ]));
    expect(serialized(decision)).not.toContain(rawSecret);
    expect(serialized(decision)).not.toContain('wrong-runtime-connector');
  });

  it('performs no fetch, WebSocket, browser storage, IndexedDB, provider, schema, export, or credential side effects', () => {
    const fetchSpy = vi.fn();
    const websocketSpy = vi.fn();
    const indexedDbSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', websocketSpy);
    vi.stubGlobal('indexedDB', indexedDbSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    evaluateTrusted({
      owner,
      importExportReadinessPlanDecision: readinessPlanDecision(),
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: implementationEvidence(),
    });
    evaluateTrusted({
      owner: {
        providerId: 'Bearer do-not-echo-owner',
      },
      importExportReadinessPlanDecision: null,
      persistenceGuardDecision: null,
      evidence: [],
      readyForDurableImplementation: true,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(websocketSpy).not.toHaveBeenCalled();
    expect(indexedDbSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
