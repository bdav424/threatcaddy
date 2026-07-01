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
  evaluateDurablePersistenceOperationsImplementationManifest,
} from '../lib/durable-persistence-operations-implementation-manifest';
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

  throw new TypeError('Trusted durable persistence operations fixtures cannot include executable values.');
}

function trustedObject(value: Record<string, unknown>): RuntimeTrustedContractObject {
  const entries = Object.entries(value).map(([key, entryValue]) => [
    key,
    trustedValue(entryValue),
  ] as RuntimeTrustedContractEntry);
  return createRuntimeTrustedContractObject(entries);
}

function rawReadyInput(overrides: Record<string, unknown> = {}) {
  return {
    sourceManifest: sourceManifest(),
    proposedOperationPlan: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN,
    proposedHighRiskWriteSet: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
    checkpointRequirements: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_CHECKPOINT_REQUIREMENTS,
    rollbackRequirements: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_ROLLBACK_REQUIREMENTS,
    ...overrides,
  };
}

function readyInput(overrides: Record<string, unknown> = {}) {
  return trustedObject(rawReadyInput(overrides)) as unknown as Parameters<
    typeof evaluateDurablePersistenceOperationsImplementationManifest
  >[0];
}

function trustedInput(value: Record<string, unknown>) {
  return trustedObject(value) as unknown as Parameters<
    typeof evaluateDurablePersistenceOperationsImplementationManifest
  >[0];
}

describe('durable persistence operations implementation manifest', () => {
  it('creates a frozen head-chat-only operations manifest from the promoted durable-state manifest', () => {
    const decision = evaluateDurablePersistenceOperationsImplementationManifest(readyInput());

    expect(decision).toMatchObject({
      status: 'operations-manifest-ready',
      manifestReady: true,
      reason: 'operations_manifest_ready',
      manifest: {
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
      },
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
      storageDirective:
        'operations-manifest-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import-do-not-sync',
      implementationDirective: 'head-chat-owned-durable-persistence-operations-implementation-only',
      sideEffectBoundary:
        'durable-persistence-operations-implementation-manifest-no-fetch-no-socket-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-backup-no-restore-no-sync-no-provider-no-credentials',
    });
    expect(decision.manifest.operationOrder).toEqual([
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
    expect(decision.manifest.operationPlan.find((entry) => entry.operation === 'sync')?.requiredFiles).toEqual([
      'src/lib/sync-engine.ts',
      'src/lib/sync-middleware.ts',
      'src/lib/sync-sanitize.ts',
      'src/lib/cloud-sync.ts',
      'server/src/index.ts',
      'server/src/types.ts',
    ]);
    expect(decision.manifest.operationPlan.flatMap((entry) => entry.requiredFiles)).not.toEqual(expect.arrayContaining([
      'src/lib/sync.ts',
      'server/',
    ]));
    expect(decision.manifest.exactHighRiskWriteSet).toEqual(
      CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
    );
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.manifest)).toBe(true);
    expect(Object.isFrozen(decision.manifest.operationPlan)).toBe(true);
    expect(Object.isFrozen(decision.manifest.operationPlan[0].requiredFiles)).toBe(true);
    expect(Object.isFrozen(decision.manifest.exactHighRiskWriteSet)).toBe(true);
  });

  it('fails closed for missing, blocked, forged, mismatched, or stale source manifests', () => {
    expect(evaluateDurablePersistenceOperationsImplementationManifest()).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
      canPrepareHeadChatDurablePersistenceOperationsImplementation: false,
    });

    expect(evaluateDurablePersistenceOperationsImplementationManifest(trustedInput({}))).toMatchObject({
      status: 'blocked',
      reason: 'source_manifest_missing',
      canPrepareHeadChatDurablePersistenceOperationsImplementation: false,
    });

    expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      sourceManifest: sourceManifest({
        status: 'blocked',
        manifestReady: false,
        reason: 'implementation_boundary_not_ready',
        canPrepareHeadChatDurableSchemaExportImplementation: false,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'source_manifest_not_ready',
    });

    expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      sourceManifest: {
        ...sourceManifest(),
        mayCreateDexieSchema: true,
      } as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'source_manifest_invalid',
      mayCreateDexieSchema: false,
    });

    expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      sourceManifest: {
        ...sourceManifest(),
        manifest: {
          ...sourceManifest().manifest,
          sourceImplementationOwner: 'other-owner',
        },
      } as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'source_owner_invalid',
    });

    expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      sourceManifest: {
        ...sourceManifest(),
        manifest: {
          ...sourceManifest().manifest,
          sourcePersistenceBoundaryContract: 'other-contract',
        },
      } as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'source_boundary_invalid',
    });

    expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      sourceManifest: {
        ...sourceManifest(),
        manifest: {
          ...sourceManifest().manifest,
          sections: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS.slice(0, -1),
        },
      } as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'source_manifest_stale',
    });

    expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      sourceManifest: {
        ...sourceManifest(),
        manifest: {
          ...sourceManifest().manifest,
          blockedPathClasses: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES.slice(0, -1),
        },
      } as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'source_manifest_stale',
    });
  });

  it('requires exact operation ordering, checkpoint requirements, and rollback requirements', () => {
    for (const missingPlan of [undefined, null]) {
      expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
        proposedOperationPlan: missingPlan,
      }))).toMatchObject({
        status: 'blocked',
        reason: 'operation_order_invalid',
      });
    }

    expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      proposedOperationPlan: [...DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN].reverse(),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'operation_order_invalid',
    });

    expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      proposedOperationPlan: [{
        ...DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN[0],
        requiredFiles: ['src/types.ts'],
      }],
    }))).toMatchObject({
      status: 'blocked',
      reason: 'operation_order_invalid',
    });

    expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      proposedOperationPlan: [{
        ...DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN[0],
        schemaWriter: 'blocked-schema-writer',
      }],
    }))).toMatchObject({
      status: 'blocked',
      reason: 'operation_order_invalid',
      mayCreateDexieSchema: false,
      mayWriteStorage: false,
    });

    for (const missingWriteSet of [undefined, null]) {
      expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
        proposedHighRiskWriteSet: missingWriteSet,
      }))).toMatchObject({
        status: 'blocked',
        reason: 'high_risk_write_set_invalid',
      });
    }

    for (const missingCheckpointRequirements of [undefined, null]) {
      expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
        checkpointRequirements: missingCheckpointRequirements,
      }))).toMatchObject({
        status: 'blocked',
        reason: 'checkpoint_requirements_invalid',
      });
    }

    expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      checkpointRequirements:
        DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_CHECKPOINT_REQUIREMENTS.slice(0, -1),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'checkpoint_requirements_invalid',
    });

    for (const missingRollbackRequirements of [undefined, null]) {
      expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
        rollbackRequirements: missingRollbackRequirements,
      }))).toMatchObject({
        status: 'blocked',
        reason: 'rollback_requirements_invalid',
      });
    }

    expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      rollbackRequirements:
        DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_ROLLBACK_REQUIREMENTS.slice(0, -1),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'rollback_requirements_invalid',
    });
  });

  it('rejects untrusted roots and unsafe root fields before scanning manifest material', () => {
    const getterSpy = vi.fn(() => sourceManifest());
    const proxyGetSpy = vi.fn();
    const proxyOwnKeysSpy = vi.fn();
    const proxyGetOwnPropertyDescriptorSpy = vi.fn();
    const proxyGetPrototypeOfSpy = vi.fn();
    const poisonedInput: Record<string, unknown> = {
      proposedOperationPlan: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_PLAN,
      proposedHighRiskWriteSet: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
      checkpointRequirements: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_CHECKPOINT_REQUIREMENTS,
      rollbackRequirements: DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_ROLLBACK_REQUIREMENTS,
    };
    Object.defineProperty(poisonedInput, 'sourceManifest', {
      enumerable: true,
      get: getterSpy,
    });
    const proxiedInput = new Proxy(rawReadyInput(), {
      get(target, property, receiver) {
        proxyGetSpy(property);
        return Reflect.get(target, property, receiver);
      },
      ownKeys(target) {
        proxyOwnKeysSpy();
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, property) {
        proxyGetOwnPropertyDescriptorSpy(property);
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target) {
        proxyGetPrototypeOfSpy();
        return Reflect.getPrototypeOf(target);
      },
    });

    expect(evaluateDurablePersistenceOperationsImplementationManifest(
      poisonedInput as Parameters<typeof evaluateDurablePersistenceOperationsImplementationManifest>[0],
    )).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
    });
    expect(evaluateDurablePersistenceOperationsImplementationManifest(
      proxiedInput as Parameters<typeof evaluateDurablePersistenceOperationsImplementationManifest>[0],
    )).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
    });
    expect(evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      schemaWriter: 'blocked-schema-writer',
      fetch: 'blocked-fetch',
    }))).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_input_field',
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
    });
    expect(getterSpy).not.toHaveBeenCalled();
    expect(proxyGetSpy).not.toHaveBeenCalled();
    expect(proxyOwnKeysSpy).not.toHaveBeenCalled();
    expect(proxyGetOwnPropertyDescriptorSpy).not.toHaveBeenCalled();
    expect(proxyGetPrototypeOfSpy).not.toHaveBeenCalled();
  });

  it('rejects forbidden path classes and token-shaped identifiers before any side effects', () => {
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

    const forbiddenPathDecision = evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      proposedHighRiskWriteSet: [
        ...DURABLE_PERSISTENCE_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
        'docs/durable-persistence-plan.md',
      ],
    }));

    expect(forbiddenPathDecision).toMatchObject({
      status: 'blocked',
      reason: 'high_risk_write_set_invalid',
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
      mayBackupOrExportRuntimeState: false,
      mayImportOrRestoreRuntimeState: false,
      maySyncRuntimeState: false,
      mayFetch: false,
      mayOpenSocket: false,
      mayReadStorage: false,
      mayWriteStorage: false,
      willGenerateArtifacts: false,
      willPromoteStandalone: false,
    });

    const tokenDecision = evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
      sourceManifest: {
        ...sourceManifest(),
        manifest: {
          ...sourceManifest().manifest,
          providerId: 'ghp_do_not_echo_durable_operations_token',
        },
      } as never,
    }));
    const serialized = JSON.stringify(tokenDecision);

    expect(tokenDecision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(serialized).not.toContain('do_not_echo');
    expect(serialized).not.toContain('durable_operations_token');

    for (const unsafeIdentifier of [
      'ftp://example.invalid/path',
      'localhost:4000/path',
      '127.0.0.1:4000/path',
      'example.invalid/provider/path',
      'mailto:user@example.test',
      'urn:provider:opaque',
    ]) {
      const unsafeDecision = evaluateDurablePersistenceOperationsImplementationManifest(readyInput({
        sourceManifest: {
          ...sourceManifest(),
          manifest: {
            ...sourceManifest().manifest,
            providerId: unsafeIdentifier,
          },
        } as never,
      }));
      const unsafeSerialized = JSON.stringify(unsafeDecision);

      expect(unsafeDecision).toMatchObject({
        status: 'blocked',
        reason: 'source_owner_invalid',
        mayPersistRuntimeState: false,
        mayCreateDexieSchema: false,
        mayBackupOrExportRuntimeState: false,
        mayImportOrRestoreRuntimeState: false,
        maySyncRuntimeState: false,
      });
      expect(unsafeSerialized).not.toContain(unsafeIdentifier);
      expect(unsafeSerialized).not.toContain('example.invalid');
      expect(unsafeSerialized).not.toContain('localhost');
      expect(unsafeSerialized).not.toContain('urn:provider');
    }

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
