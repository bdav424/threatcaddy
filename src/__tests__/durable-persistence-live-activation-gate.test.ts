import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  type ConnectorRuntimeDurableStateImplementationManifestDecision,
} from '../lib/connector-runtime-durable-state-implementation-manifest';
import {
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS,
} from '../lib/connector-runtime-durable-state-implementation-boundary';
import {
  CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS,
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
  evaluateDurablePersistenceLiveActivationGate as evaluateRawDurablePersistenceLiveActivationGate,
  type DurablePersistenceActivationApproval,
  type DurablePersistenceActivationFacts,
} from '../lib/durable-persistence-live-activation-gate';
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

function sourceManifest(
  overrides: Partial<ConnectorRuntimeDurableStateImplementationManifestDecision> = {},
): ConnectorRuntimeDurableStateImplementationManifestDecision {
  return Object.freeze({
    status: 'implementation-manifest-ready',
    manifestReady: true,
    reason: 'implementation_manifest_ready',
    manifest: Object.freeze({
      schemaVersion: 1,
      contract: 'connector-runtime-durable-state-implementation-manifest-v1',
      manifestOwner: 'assistantcaddy-head-chat-durable-schema-export',
      manifestId: 'assistantcaddy-head-chat-durable-schema-export-manifest',
      manifestVersion: '2026.06.12',
      integrationOwner: 'head-chat',
      integrationScope: 'durable-schema-export-implementation',
      sourceImplementationBoundaryContract: 'connector-runtime-durable-state-implementation-boundary-v1',
      sourceImplementationBoundaryStorageDirective:
        'boundary-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import',
      sourceImplementationBoundaryImplementationDirective:
        'future-head-chat-reviewed-schema-export-contract-required',
      sourcePersistenceBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1',
      sourcePersistenceBoundaryStorageDirective:
        'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import',
      sourceImplementationOwner: 'assistantcaddy-connector-runtime-durable-state',
      sourceImplementationId: 'assistantcaddy-connector-runtime-durable-state-boundary',
      sourceImplementationVersion: '2026.06.12',
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      targetSurface: 'assistantcaddy',
      sections: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS,
      sharedHighRiskWriteSet: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
      blockedPathClasses: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
      requirementCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
      reviewedEvidenceCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
      promotedFromImplementationBoundary: true,
      headChatReviewRequired: true,
      readyForImplementation: false,
      implementationMode: 'manifest-only',
    }),
    canPrepareHeadChatDurableSchemaExportImplementation: true,
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
    storageDirective: 'manifest-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import',
    implementationDirective: 'head-chat-owned-durable-schema-export-implementation-only',
    sideEffectBoundary:
      'connector-runtime-durable-state-implementation-manifest-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials',
    ...overrides,
  });
}

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
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      targetSurface: 'assistantcaddy',
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
    providerId: 'generic-webhook',
    connectorId: 'generic-webhook-runtime',
    targetSurface: 'assistantcaddy',
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

  throw new TypeError('Trusted durable persistence live activation fixtures cannot include executable values.');
}

function trustedObject(value: Record<string, unknown>): RuntimeTrustedContractObject {
  const entries = Object.entries(value).map(([key, entryValue]) => [
    key,
    trustedValue(entryValue),
  ] as RuntimeTrustedContractEntry);
  return createRuntimeTrustedContractObject(entries);
}

function evaluateDurablePersistenceLiveActivationGate(
  input: Record<string, unknown> = {},
): ReturnType<typeof evaluateRawDurablePersistenceLiveActivationGate> {
  try {
    return evaluateRawDurablePersistenceLiveActivationGate(
      trustedObject(input) as unknown as Parameters<typeof evaluateRawDurablePersistenceLiveActivationGate>[0],
    );
  } catch {
    return evaluateRawDurablePersistenceLiveActivationGate(
      input as unknown as Parameters<typeof evaluateRawDurablePersistenceLiveActivationGate>[0],
    );
  }
}

function readyInput() {
  return {
    operationsManifest: operationsManifest(),
    activationFacts: activationFacts(),
    approval: approval(),
  };
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

describe('durable persistence live activation gate', () => {
  it('returns a frozen plan-only activation plan after reviewed ownership, migration, rollback, secret, and approval proof', () => {
    const decision = evaluateDurablePersistenceLiveActivationGate(readyInput());

    expect(decision).toMatchObject({
      status: 'ready',
      ready: true,
      reason: 'durable_persistence_live_activation_gate_ready',
      canConsiderDurablePersistenceWork: true,
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
      executable: false,
      sideEffects: 'none',
      plan: {
        contract: 'durable-persistence-live-activation-plan-v1',
        activationOwner: 'assistantcaddy-head-chat-durable-persistence-live-activation',
        activationId: 'assistantcaddy-durable-persistence-live-activation-gate',
        sourceManifestOwner: 'assistantcaddy-head-chat-durable-persistence-operations',
        sourceManifestId: 'assistantcaddy-head-chat-durable-persistence-operations-manifest',
        providerId: 'generic-webhook',
        connectorId: 'generic-webhook-runtime',
        targetSurface: 'assistantcaddy',
        reviewedSchemaOwner: 'head-chat',
        reviewedExportImportBackupRestoreOwner: 'head-chat',
        migrationPlanId: 'durable-migration-plan-reviewed-001',
        checkpointProofId: 'durable-checkpoint-proof-001',
        rollbackProofId: 'durable-rollback-proof-001',
        secretRedactionProofId: 'durable-redaction-proof-001',
        reviewedOperations: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER,
        exactHighRiskWriteSet: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
        requiresCheckpointBeforeMigration: true,
        requiresAdminApprovalBeforePersistence: true,
        noRawSecretGuarantee: true,
        noBackupLeakage: true,
        noExportLeakage: true,
        noImportPlaintextSecret: true,
        noSchemaRawSecretFields: true,
        executable: false,
        sideEffects: 'none',
        storageActions: [],
        schemaActions: [],
        exportImportBackupRestoreActions: [],
      },
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.plan)).toBe(true);
    expect(Object.isFrozen(decision.plan?.reviewedOperations)).toBe(true);
    expect(Object.isFrozen(decision.plan?.exactHighRiskWriteSet)).toBe(true);
    expect(Object.isFrozen(decision.plan?.storageActions)).toBe(true);
  });

  it('fails closed for missing, blocked, or forged operations manifests', () => {
    expect(evaluateDurablePersistenceLiveActivationGate({
      activationFacts: activationFacts(),
      approval: approval(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'operations_manifest_missing',
      canConsiderDurablePersistenceWork: false,
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      operationsManifest: operationsManifest({
        status: 'blocked',
        manifestReady: false,
        reason: 'source_manifest_not_ready',
        canPrepareHeadChatDurablePersistenceOperationsImplementation: false,
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'operations_manifest_not_ready',
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      operationsManifest: {
        ...operationsManifest(),
        mayCreateDexieSchema: true,
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'operations_manifest_invalid',
      mayCreateDexieSchema: false,
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      operationsManifest: {
        ...operationsManifest(),
        fetch: 'blocked-fetch-field',
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'operations_manifest_invalid',
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      operationsManifest: {
        ...operationsManifest(),
        manifest: {
          ...operationsManifest().manifest,
          storageAdapter: { kind: 'dexie' },
        },
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'operations_manifest_invalid',
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      operationsManifest: {
        ...operationsManifest(),
        manifest: {
          ...operationsManifest().manifest,
          exactHighRiskWriteSet: ['src/db.ts'],
        },
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'operations_manifest_invalid',
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      operationsManifest: {
        ...operationsManifest(),
        manifest: {
          ...operationsManifest().manifest,
          operationPlan: operationsManifest().manifest.operationPlan.map((entry, index) => (
            index === 0
              ? { ...entry, operation: 'backup-restore-boundary' }
              : entry
          )),
        },
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'operations_manifest_invalid',
    });

    expect(sourceManifest().manifest.manifestVersion).toBe('2026.06.12');
  });

  it('requires owner matching and all reviewed migration, rollback, checkpoint, and secret-posture facts', () => {
    expect(evaluateDurablePersistenceLiveActivationGate({
      operationsManifest: operationsManifest(),
      approval: approval(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'activation_facts_missing',
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      activationFacts: activationFacts({ connectorId: 'other-runtime' }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'activation_owner_mismatch',
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      activationFacts: activationFacts({ migrationPlanReviewed: false } as unknown as Partial<DurablePersistenceActivationFacts>),
    })).toMatchObject({
      status: 'blocked',
      reason: 'activation_facts_invalid',
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      activationFacts: activationFacts({ checkpointProofId: '' }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'activation_facts_invalid',
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      activationFacts: activationFacts({ noBackupLeakage: false } as unknown as Partial<DurablePersistenceActivationFacts>),
    })).toMatchObject({
      status: 'blocked',
      reason: 'activation_facts_invalid',
      mayBackupOrExportRuntimeState: false,
    });
  });

  it('rejects scheme-shaped generic activation identifiers without echoing them', () => {
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
      const decision = evaluateDurablePersistenceLiveActivationGate({
        ...readyInput(),
        activationFacts: activationFacts({ providerId: unsafeIdentifier }),
      });
      const output = JSON.stringify(decision);

      expect(decision).toMatchObject({
        status: 'blocked',
        reason: 'activation_facts_invalid',
        mayPersistRuntimeState: false,
        maySyncRuntimeState: false,
        executable: false,
      });
      expect(decision.plan).toBeUndefined();
      expect(output).not.toContain(unsafeIdentifier);
      expect(output).not.toContain('example.invalid');
      expect(output).not.toContain('localhost');
      expect(output).not.toContain('urn:provider');
    }
  });

  it('requires explicit user and admin approval before persistence can be considered', () => {
    expect(evaluateDurablePersistenceLiveActivationGate({
      operationsManifest: operationsManifest(),
      activationFacts: activationFacts(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'approval_posture_invalid',
      requiresAdminApprovalBeforePersistence: true,
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      approval: approval({ userApprovalGranted: false } as unknown as Partial<DurablePersistenceActivationApproval>),
    })).toMatchObject({
      status: 'blocked',
      reason: 'approval_posture_invalid',
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      approval: approval({ adminApprovalGranted: false } as unknown as Partial<DurablePersistenceActivationApproval>),
    })).toMatchObject({
      status: 'blocked',
      reason: 'approval_posture_invalid',
    });
  });

  it('rejects storage adapters, schema writers, Dexie handles, and operation callbacks without invoking them', () => {
    const storageAdapter = { open: vi.fn(), put: vi.fn() };
    const schemaWriter = vi.fn();
    const exportCallback = vi.fn();

    expect(evaluateRawDurablePersistenceLiveActivationGate({
      ...readyInput(),
      storageAdapter,
    } as unknown as Parameters<typeof evaluateRawDurablePersistenceLiveActivationGate>[0])).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      mayOpenStorageAdapter: false,
      mayWriteStorage: false,
    });
    expect(storageAdapter.open).not.toHaveBeenCalled();
    expect(storageAdapter.put).not.toHaveBeenCalled();

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      schemaWriter: 'blocked-schema-writer',
    })).toMatchObject({
      status: 'blocked',
      reason: 'schema_writer_forbidden',
      mayInvokeSchemaWriter: false,
    });
    expect(schemaWriter).not.toHaveBeenCalled();

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      db: 'blocked-db-handle',
    })).toMatchObject({
      status: 'blocked',
      reason: 'storage_shape_forbidden',
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      exportCallback: 'blocked-export-callback',
    })).toMatchObject({
      status: 'blocked',
      reason: 'operation_callback_forbidden',
      mayRunExportImportBackupRestore: false,
    });
    expect(exportCallback).not.toHaveBeenCalled();
  });

  it('rejects requester, fetch, socket, executable, live-action, and secret-shaped caller input', () => {
    const fetcher = vi.fn();
    const socket = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('WebSocket', socket);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const keySpy = vi.spyOn(Storage.prototype, 'key');

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      requester: { request: vi.fn() },
    })).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      mayFetch: false,
    });

    expect(evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      activationFacts: {
        ...activationFacts(),
        executable: false,
      },
    } as never)).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      executable: false,
    });

    const secretDecision = evaluateDurablePersistenceLiveActivationGate({
      ...readyInput(),
      activationFacts: {
        ...activationFacts(),
        note: 'Authorization: Bearer abcdefghijklmnop',
      },
    } as never);
    const serialized = JSON.stringify(secretDecision);

    expect(secretDecision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(serialized).not.toContain('abcdefghijklmnop');
    expect(fetcher).not.toHaveBeenCalled();
    expect(socket).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
  });

  it('rejects root and nested Proxy inputs before trap execution', () => {
    const root = proxyTrapFixture(readyInput());
    const rootDecision = evaluateRawDurablePersistenceLiveActivationGate(
      root.proxy as unknown as Parameters<typeof evaluateRawDurablePersistenceLiveActivationGate>[0],
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

    const nested = proxyTrapFixture(activationFacts() as unknown as Record<string, unknown>);
    const nestedDecision = evaluateRawDurablePersistenceLiveActivationGate({
      ...readyInput(),
      activationFacts: nested.proxy,
    } as unknown as Parameters<typeof evaluateRawDurablePersistenceLiveActivationGate>[0]);

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

  it('rejects accessor-poisoned activation evidence before getter side effects or traversal', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const getter = vi.fn(() => 'Authorization: Bearer should-not-run');
    const poisonedFacts = {
      ...activationFacts(),
    };
    Object.defineProperty(poisonedFacts, 'migrationPlanId', {
      enumerable: true,
      get() {
        fetcher('getter-side-effect');
        return getter();
      },
    });

    const decision = evaluateRawDurablePersistenceLiveActivationGate({
      ...readyInput(),
      activationFacts: poisonedFacts as DurablePersistenceActivationFacts,
    } as unknown as Parameters<typeof evaluateRawDurablePersistenceLiveActivationGate>[0]);

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'runtime_shape_forbidden',
      mayFetch: false,
      mayPersistRuntimeState: false,
    });
    expect(getter).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(JSON.stringify(decision)).not.toContain('should-not-run');
  });
});
