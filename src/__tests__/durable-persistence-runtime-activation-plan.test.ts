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
} from '../lib/connector-runtime-persistence-implementation-boundary';
import {
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_CHECKPOINT_REQUIREMENTS,
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER,
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN,
  DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_ROLLBACK_REQUIREMENTS,
  type DurablePersistenceOperationsImplementationManifestDecision,
} from '../lib/durable-persistence-operations-implementation-manifest';
import {
  evaluateDurablePersistenceLiveActivationGate,
  type DurablePersistenceActivationApproval,
  type DurablePersistenceActivationFacts,
} from '../lib/durable-persistence-live-activation-gate';
import {
  evaluateDurablePersistenceRuntimeActivationPlan as evaluateRawDurablePersistenceRuntimeActivationPlan,
  type DurablePersistenceRuntimeActivationBindingProof,
} from '../lib/durable-persistence-runtime-activation-plan';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

const owner: ConnectorRuntimeImportExportReadinessOwner = {
  providerId: 'generic-webhook',
  connectorId: 'generic-webhook-runtime',
  targetSurface: 'assistantcaddy',
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

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function operationsManifest(
  overrides: Partial<DurablePersistenceOperationsImplementationManifestDecision> = {},
): DurablePersistenceOperationsImplementationManifestDecision {
  return Object.freeze({
    status: 'operations-manifest-ready',
    manifestReady: true,
    reason: 'operations_manifest_ready',
    manifest: Object.freeze({
      schemaVersion: 1,
      contract: 'durable-persistence-operations-implementation-manifest-v1',
      manifestOwner: 'assistantcaddy-head-chat-durable-persistence-operations',
      manifestId: 'assistantcaddy-head-chat-durable-persistence-operations-manifest',
      manifestVersion: '2026.06.12',
      implementationOwner: 'head-chat',
      implementationScope: 'durable-persistence-schema-export-import-backup-restore-sync-operations',
      sourceManifestContract: 'connector-runtime-durable-state-implementation-manifest-v1',
      sourceManifestOwner: 'assistantcaddy-head-chat-durable-schema-export',
      sourceManifestId: 'assistantcaddy-head-chat-durable-schema-export-manifest',
      sourceManifestVersion: '2026.06.12',
      sourceImplementationOwner: 'assistantcaddy-connector-runtime-durable-state',
      sourceImplementationId: 'assistantcaddy-connector-runtime-durable-state-boundary',
      providerId: owner.providerId,
      connectorId: owner.connectorId,
      targetSurface: owner.targetSurface,
      operations: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER,
      operationOrder: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER,
      operationPlan: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN,
      exactHighRiskWriteSet: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
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
    }),
    canPrepareHeadChatDurablePersistenceOperationsImplementation: true,
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
    storageDirective: 'operations-manifest-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import-do-not-sync',
    implementationDirective: 'head-chat-owned-durable-persistence-operations-implementation-only',
    sideEffectBoundary:
      'durable-persistence-operations-implementation-manifest-no-fetch-no-socket-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials',
    ...overrides,
  });
}

function activationFacts(overrides: Partial<DurablePersistenceActivationFacts> = {}): DurablePersistenceActivationFacts {
  return {
    contract: 'durable-persistence-live-activation-facts-v1',
    activationOwner: 'assistantcaddy-head-chat-durable-persistence-live-activation',
    activationId: 'assistantcaddy-durable-persistence-live-activation-gate',
    activationVersion: '2026.06.12',
    sourceManifestOwner: 'assistantcaddy-head-chat-durable-persistence-operations',
    sourceManifestId: 'assistantcaddy-head-chat-durable-persistence-operations-manifest',
    sourceManifestVersion: '2026.06.12',
    providerId: owner.providerId,
    connectorId: owner.connectorId,
    targetSurface: owner.targetSurface,
    reviewedSchemaOwner: 'head-chat',
    reviewedExportImportBackupRestoreOwner: 'head-chat',
    schemaOwnershipReviewed: true,
    exportImportBackupRestoreOwnershipReviewed: true,
    migrationPlanId: 'durable-migration-plan-reviewed-001',
    migrationPlanReviewed: true,
    exportImpactPlanReviewed: true,
    importImpactPlanReviewed: true,
    backupImpactPlanReviewed: true,
    restoreImpactPlanReviewed: true,
    checkpointProofId: 'durable-checkpoint-proof-001',
    rollbackProofId: 'durable-rollback-proof-001',
    checkpointProofReviewed: true,
    rollbackProofReviewed: true,
    secretRedactionProofId: 'durable-redaction-proof-001',
    secretRedactionReviewed: true,
    noRawSecretGuarantee: true,
    noBackupLeakage: true,
    noExportLeakage: true,
    noImportPlaintextSecret: true,
    noSchemaRawSecretFields: true,
    reviewState: 'reviewed',
    sideEffects: 'none',
    sideEffectBoundary:
      'durable-persistence-live-activation-facts-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials',
    ...overrides,
  };
}

function approval(overrides: Partial<DurablePersistenceActivationApproval> = {}): DurablePersistenceActivationApproval {
  return {
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
    ...overrides,
  };
}

function liveActivationDecision() {
  return evaluateDurablePersistenceLiveActivationGate(trustedObject({
    operationsManifest: operationsManifest(),
    activationFacts: activationFacts(),
    approval: approval(),
  }) as unknown as Parameters<typeof evaluateDurablePersistenceLiveActivationGate>[0]);
}

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
  return evaluateConnectorRuntimeImportExportReadinessPlan(trustedObject({
    owner,
    persistenceGuardDecision: persistenceGuardDecision(),
    evidence: readinessEvidence(),
  }) as unknown as Parameters<typeof evaluateConnectorRuntimeImportExportReadinessPlan>[0]);
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

function implementationFutureWriteSet(): readonly string[] {
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
    exactFutureWriteSet: implementationFutureWriteSet(),
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

  throw new TypeError('Trusted durable persistence fixtures cannot include executable values.');
}

function trustedObject(value: Record<string, unknown>): RuntimeTrustedContractObject {
  const entries = Object.entries(value).map(([key, entryValue]) => [
    key,
    trustedValue(entryValue),
  ] as RuntimeTrustedContractEntry);
  return createRuntimeTrustedContractObject(entries);
}

function evaluateDurablePersistenceRuntimeActivationPlan(
  input: Record<string, unknown> = {},
): ReturnType<typeof evaluateRawDurablePersistenceRuntimeActivationPlan> {
  try {
    return evaluateRawDurablePersistenceRuntimeActivationPlan(
      trustedObject(input) as unknown as Parameters<typeof evaluateRawDurablePersistenceRuntimeActivationPlan>[0],
    );
  } catch {
    return evaluateRawDurablePersistenceRuntimeActivationPlan(
      input as unknown as Parameters<typeof evaluateRawDurablePersistenceRuntimeActivationPlan>[0],
    );
  }
}

function trustedImplementationBoundaryInput(
  input: Record<string, unknown>,
): Parameters<typeof evaluateConnectorRuntimePersistenceImplementationBoundary>[0] {
  return trustedObject(input) as unknown as Parameters<typeof evaluateConnectorRuntimePersistenceImplementationBoundary>[0];
}

function implementationBoundary() {
  return evaluateConnectorRuntimePersistenceImplementationBoundary(trustedImplementationBoundaryInput({
    owner,
    importExportReadinessPlanDecision: readinessPlanDecision(),
    persistenceGuardDecision: persistenceGuardDecision(),
    evidence: implementationEvidence(),
    implementationProof: implementationProof(),
    proposedFutureWriteSet: implementationFutureWriteSet(),
  }));
}

function bindingProof(
  overrides: Partial<DurablePersistenceRuntimeActivationBindingProof> = {},
): DurablePersistenceRuntimeActivationBindingProof {
  return {
    contract: 'durable-persistence-runtime-activation-binding-proof-v1',
    bindingOwner: 'assistantcaddy-head-chat-durable-persistence-runtime-activation',
    bindingId: 'assistantcaddy-durable-persistence-runtime-activation-plan',
    bindingVersion: '2026.06.12',
    activationId: 'assistantcaddy-durable-persistence-live-activation-gate',
    implementationBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1',
    persistenceGuardContract: 'connector-runtime-persistence-guard-v1',
    providerId: owner.providerId,
    connectorId: owner.connectorId,
    targetSurface: owner.targetSurface,
    reviewedSchemaOwner: 'head-chat',
    reviewedExportImportBackupRestoreOwner: 'head-chat',
    schemaOwnershipReviewed: true,
    exportImportBackupRestoreOwnershipReviewed: true,
    exactFutureWriteSet: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
    checkpointProofId: 'durable-checkpoint-proof-001',
    rollbackProofId: 'durable-rollback-proof-001',
    checkpointProofReviewed: true,
    rollbackProofReviewed: true,
    secretRedactionProofId: 'durable-redaction-proof-001',
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
    sideEffectBoundary:
      'durable-persistence-runtime-activation-binding-proof-only-no-storage-no-schema-no-export-no-import-no-backup-no-restore-no-provider-no-credentials',
    ...overrides,
  };
}

function readyInput() {
  return {
    liveActivationDecision: liveActivationDecision(),
    persistenceGuardDecision: persistenceGuardDecision(),
    implementationBoundary: implementationBoundary(),
    bindingProof: bindingProof(),
    proposedFutureWriteSet: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  };
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

function proxyTrapFixture(target: Record<string, unknown>) {
  const get = vi.fn((nestedTarget: Record<string, unknown>, property: string | symbol, receiver: unknown) => (
    Reflect.get(nestedTarget, property, receiver)
  ));
  const ownKeys = vi.fn((nestedTarget: Record<string, unknown>) => Reflect.ownKeys(nestedTarget));
  const getOwnPropertyDescriptor = vi.fn((nestedTarget: Record<string, unknown>, property: string | symbol) => (
    Reflect.getOwnPropertyDescriptor(nestedTarget, property)
  ));
  const getPrototypeOf = vi.fn((nestedTarget: Record<string, unknown>) => Reflect.getPrototypeOf(nestedTarget));
  const proxy = new Proxy(target, {
    get,
    ownKeys,
    getOwnPropertyDescriptor,
    getPrototypeOf,
  });
  return { proxy, get, ownKeys, getOwnPropertyDescriptor, getPrototypeOf };
}

describe('durable persistence runtime activation plan', () => {
  it('returns a frozen non-executable implementation plan from independently reviewed durable persistence boundaries', () => {
    const decision = evaluateDurablePersistenceRuntimeActivationPlan(readyInput());

    expect(decision).toMatchObject({
      status: 'implementation-plan-ready',
      ready: true,
      reason: 'durable_persistence_runtime_activation_plan_ready',
      mayPrepareRuntimeActivationImplementation: true,
      readyForDurablePersistenceImplementation: false,
      requiresCheckpointBeforeMigration: true,
      requiresAdminApprovalBeforePersistence: true,
      executable: false,
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
      mayBackupOrExportRuntimeState: false,
      mayImportOrRestoreRuntimeState: false,
      maySyncRuntimeState: false,
      mayFetch: false,
      mayOpenSocket: false,
      sideEffects: 'none',
      implementationPlan: {
        contract: 'durable-persistence-runtime-activation-implementation-plan-v1',
        providerId: owner.providerId,
        connectorId: owner.connectorId,
        targetSurface: owner.targetSurface,
        activationId: 'assistantcaddy-durable-persistence-live-activation-gate',
        checkpointProofId: 'durable-checkpoint-proof-001',
        rollbackProofId: 'durable-rollback-proof-001',
        secretRedactionProofId: 'durable-redaction-proof-001',
        requiresCheckpointBeforeMigration: true,
        requiresAdminApprovalBeforePersistence: true,
        executable: false,
        sideEffects: 'none',
      },
    });
    expect(decision.implementationPlan?.reviewedOperations).toEqual(DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER);
    expect(decision.implementationPlan?.exactFutureWriteSet).toEqual(DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET);
    expect(decision.implementationPlan?.exactFutureWriteSet).toEqual(expect.arrayContaining([
      'src/lib/sync-engine.ts',
      'src/lib/sync-middleware.ts',
      'src/lib/sync-sanitize.ts',
      'src/lib/cloud-sync.ts',
      'server/src/index.ts',
      'server/src/types.ts',
    ]));
    expect(decision.implementationPlan?.exactFutureWriteSet).not.toEqual(expect.arrayContaining([
      'src/lib/sync.ts',
      'server/',
    ]));
    expect(decision.implementationPlan?.storageActions).toEqual([]);
    expect(decision.implementationPlan?.schemaActions).toEqual([]);
    expect(decision.implementationPlan?.exportImportBackupRestoreActions).toEqual([]);
    expect(decision.implementationPlan?.dryRunLifecyclePlan).toMatchObject({
      contract: 'durable-persistence-dry-run-lifecycle-plan-v1',
      lifecycleOwner: 'assistantcaddy-head-chat-durable-persistence-runtime-activation',
      lifecycleId: 'assistantcaddy-durable-persistence-dry-run-lifecycle-plan',
      operationMode: 'dry-run-plan-only',
      providerId: owner.providerId,
      connectorId: owner.connectorId,
      targetSurface: owner.targetSurface,
      checkpointProofId: 'durable-checkpoint-proof-001',
      rollbackProofId: 'durable-rollback-proof-001',
      secretRedactionProofId: 'durable-redaction-proof-001',
      checkpointRequired: true,
      rollbackRequired: true,
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
    });
    expect(decision.implementationPlan?.dryRunLifecyclePlan.operations).toEqual(
      DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN.map((entry) => ({
        operation: entry.operation,
        requiredFiles: entry.requiredFiles,
        checkpointRequired: true,
        rollbackRequired: true,
        dryRunReady: true,
        executable: false,
        mutatesData: false,
        sideEffects: 'none',
      })),
    );
    expect(decision.implementationPlan?.dryRunLifecyclePlan.operations.find((entry) => entry.operation === 'sync')).toMatchObject({
      requiredFiles: [
        'src/lib/sync-engine.ts',
        'src/lib/sync-middleware.ts',
        'src/lib/sync-sanitize.ts',
        'src/lib/cloud-sync.ts',
        'server/src/index.ts',
        'server/src/types.ts',
      ],
      executable: false,
      mutatesData: false,
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.implementationPlan)).toBe(true);
    expect(Object.isFrozen(decision.implementationPlan?.reviewedOperations)).toBe(true);
    expect(Object.isFrozen(decision.implementationPlan?.exactFutureWriteSet)).toBe(true);
    expect(Object.isFrozen(decision.implementationPlan?.dryRunLifecyclePlan)).toBe(true);
    expect(Object.isFrozen(decision.implementationPlan?.dryRunLifecyclePlan.operations)).toBe(true);
    expect(Object.isFrozen(decision.implementationPlan?.dryRunLifecyclePlan.operations[0].requiredFiles)).toBe(true);
  });

  it('fails closed on raw secrets and does not echo them', () => {
    const secretValue = 'Bearer should-not-appear-in-output';
    const decision = evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      bindingProof: {
        ...bindingProof(),
        note: secretValue,
      },
    } as unknown as Parameters<typeof evaluateDurablePersistenceRuntimeActivationPlan>[0]);

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(serialized(decision)).not.toContain(secretValue);
  });

  it('rejects storage, schema, export/import/backup, callback, requester, fetch, socket, and executable claims', () => {
    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      dexie: {},
    })).toMatchObject({
      status: 'blocked',
      reason: 'storage_shape_forbidden',
    });

    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      exportCallback: 'blocked-export-callback',
    })).toMatchObject({
      status: 'blocked',
      reason: 'operation_callback_forbidden',
    });

    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      requester: vi.fn(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
    });

    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      executable: true,
    })).toMatchObject({
      status: 'blocked',
      reason: 'forged_executable_claim',
    });

    const syncCallback = vi.fn();
    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      syncCallback,
    } as unknown as Parameters<typeof evaluateDurablePersistenceRuntimeActivationPlan>[0])).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      maySyncRuntimeState: false,
    });
    expect(syncCallback).not.toHaveBeenCalled();
  });

  it('rejects root and nested Proxy inputs before trap execution', () => {
    const root = proxyTrapFixture(readyInput());
    const rootDecision = evaluateRawDurablePersistenceRuntimeActivationPlan(
      root.proxy as unknown as Parameters<typeof evaluateRawDurablePersistenceRuntimeActivationPlan>[0],
    );

    expect(rootDecision).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      mayPersistRuntimeState: false,
      maySyncRuntimeState: false,
      executable: false,
    });
    expect(root.get).not.toHaveBeenCalled();
    expect(root.ownKeys).not.toHaveBeenCalled();
    expect(root.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(root.getPrototypeOf).not.toHaveBeenCalled();

    const nested = proxyTrapFixture(bindingProof() as unknown as Record<string, unknown>);
    const nestedDecision = evaluateRawDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      bindingProof: nested.proxy,
    } as unknown as Parameters<typeof evaluateRawDurablePersistenceRuntimeActivationPlan>[0]);

    expect(nestedDecision).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      mayPersistRuntimeState: false,
      maySyncRuntimeState: false,
      executable: false,
    });
    expect(nested.get).not.toHaveBeenCalled();
    expect(nested.ownKeys).not.toHaveBeenCalled();
    expect(nested.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(nested.getPrototypeOf).not.toHaveBeenCalled();
  });

  it('does not trust forged ready flags from the live activation decision, guard, or implementation boundary', () => {
    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      liveActivationDecision: {
        ...liveActivationDecision(),
        mayPersistRuntimeState: true,
      },
    } as unknown as Parameters<typeof evaluateDurablePersistenceRuntimeActivationPlan>[0])).toMatchObject({
      status: 'blocked',
      reason: 'live_activation_invalid',
    });

    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      persistenceGuardDecision: {
        ...persistenceGuardDecision(),
        mayPersistRuntimeState: true,
      },
    } as unknown as Parameters<typeof evaluateDurablePersistenceRuntimeActivationPlan>[0])).toMatchObject({
      status: 'blocked',
      reason: 'persistence_guard_invalid',
    });

    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      implementationBoundary: {
        ...implementationBoundary(),
        mayCreateDexieSchema: true,
      },
    } as unknown as Parameters<typeof evaluateDurablePersistenceRuntimeActivationPlan>[0])).toMatchObject({
      status: 'blocked',
      reason: 'implementation_boundary_invalid',
    });

    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      implementationBoundary: {
        ...implementationBoundary(),
        metadata: {
          ...implementationBoundary().metadata,
          importExportReadinessContract: 'forged-readiness-contract',
        },
      },
    } as unknown as Parameters<typeof evaluateDurablePersistenceRuntimeActivationPlan>[0])).toMatchObject({
      status: 'blocked',
      reason: 'implementation_boundary_invalid',
    });
  });

  it('rejects owner drift and exact write-set drift instead of trusting serialized ready metadata', () => {
    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      persistenceGuardDecision: evaluateConnectorRuntimePersistenceGuard(trustedObject({
        requestKind: 'no-persistence-session-only',
        providerId: owner.providerId,
        connectorId: owner.connectorId,
        targetSurface: 'wrong-surface',
        stateLabel: 'session-runtime-state',
        proposedFields: ['selectedProviderId'],
        migrationLabels: [],
        exportKeys: [],
        noPersistenceBoundary: noPersistenceBoundary(),
      }) as unknown as Parameters<typeof evaluateConnectorRuntimePersistenceGuard>[0]),
    })).toMatchObject({
      status: 'blocked',
      reason: 'owner_mismatch',
    });

    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      bindingProof: bindingProof({
        exactFutureWriteSet: ['src/db.ts'],
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'binding_proof_invalid',
    });
  });

  it('rejects scheme-shaped generic identifiers before producing a lifecycle plan', () => {
    for (const unsafeIdentifier of [
      'provider-oauth:generic-webhook',
      'vault:generic-webhook',
      'local-bridge:generic-webhook',
      'mailto:user@example.test',
      'urn:provider:opaque',
      'localhost:4000/path',
      '127.0.0.1:4000/path',
      'example.invalid/provider/path',
    ]) {
      const decision = evaluateDurablePersistenceRuntimeActivationPlan({
        ...readyInput(),
        bindingProof: bindingProof({
          providerId: unsafeIdentifier,
        }),
      });
      const output = serialized(decision);

      expect(decision).toMatchObject({
        status: 'blocked',
        reason: 'binding_proof_invalid',
        mayPersistRuntimeState: false,
        maySyncRuntimeState: false,
        executable: false,
      });
      expect(decision.implementationPlan).toBeUndefined();
      expect(output).not.toContain(unsafeIdentifier);
      expect(output).not.toContain('example.invalid');
      expect(output).not.toContain('localhost');
      expect(output).not.toContain('urn:provider');
    }
  });

  it('requires checkpoint, rollback, redaction, and admin approval proof before returning a plan', () => {
    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      bindingProof: bindingProof({
        checkpointProofId: 'wrong-checkpoint-proof',
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'checkpoint_rollback_proof_invalid',
    });

    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      bindingProof: bindingProof({
        adminApprovalReviewed: false as true,
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'binding_proof_invalid',
    });
  });

  it('rejects frozen class-instance binding proof objects instead of treating them as plain records', () => {
    class FrozenBindingProof {
      contract = 'durable-persistence-runtime-activation-binding-proof-v1';
      bindingOwner = 'assistantcaddy-head-chat-durable-persistence-runtime-activation';
      bindingId = 'assistantcaddy-durable-persistence-runtime-activation-plan';
      bindingVersion = '2026.06.12';
    }

    const forgedProof = Object.freeze(new FrozenBindingProof());

    expect(evaluateDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      bindingProof: forgedProof,
    })).toMatchObject({
      status: 'blocked',
      reason: 'binding_proof_invalid',
    });
  });

  it('rejects accessor-poisoned binding proof before getter side effects or semantic scans', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const getter = vi.fn(() => 'Authorization: Bearer should-not-run');
    const poisonedProof = {
      ...bindingProof(),
    };
    Object.defineProperty(poisonedProof, 'checkpointProofId', {
      enumerable: true,
      get() {
        fetcher('binding-proof-getter-side-effect');
        return getter();
      },
    });

    const decision = evaluateRawDurablePersistenceRuntimeActivationPlan({
      ...readyInput(),
      bindingProof: poisonedProof as DurablePersistenceRuntimeActivationBindingProof,
    } as unknown as Parameters<typeof evaluateRawDurablePersistenceRuntimeActivationPlan>[0]);

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      mayFetch: false,
      mayPersistRuntimeState: false,
    });
    expect(getter).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(serialized(decision)).not.toContain('should-not-run');
  });
});
