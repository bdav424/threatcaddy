import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES,
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS,
  type ConnectorRuntimeDurableStateImplementationBoundaryDecision,
} from '../lib/connector-runtime-durable-state-implementation-boundary';
import {
  CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS,
} from '../lib/connector-runtime-persistence-implementation-boundary';
import {
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  evaluateConnectorRuntimeDurableStateImplementationManifest,
} from '../lib/connector-runtime-durable-state-implementation-manifest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const SOURCE_IMPLEMENTATION_STORAGE_DIRECTIVE =
  'boundary-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import' as const;
const SOURCE_IMPLEMENTATION_DIRECTIVE =
  'future-head-chat-reviewed-schema-export-contract-required' as const;

function implementationBoundary(
  overrides: Partial<ConnectorRuntimeDurableStateImplementationBoundaryDecision> = {},
): ConnectorRuntimeDurableStateImplementationBoundaryDecision {
  return Object.freeze({
    status: 'implementation-boundary-ready',
    boundaryReady: true,
    reason: 'durable_state_implementation_boundary_ready',
    metadata: Object.freeze({
      schemaVersion: 1,
      contract: 'connector-runtime-durable-state-implementation-boundary-v1',
      implementationOwner: 'assistantcaddy-connector-runtime-durable-state',
      implementationId: 'assistantcaddy-connector-runtime-durable-state-boundary',
      implementationVersion: '2026.06.12',
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      targetSurface: 'assistantcaddy',
      sourceBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1',
      sourceBoundaryStorageDirective:
        'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import',
      sections: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS,
      futureWriteSet: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES,
      reviewedEvidenceCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
      requirementCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
      headChatReviewedSchemaExportImplementationContract: false,
      readyForImplementation: false,
      implementationMode: 'boundary-only',
    }),
    canPrepareFutureDurableStateImplementationPackage: true,
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
    storageDirective: SOURCE_IMPLEMENTATION_STORAGE_DIRECTIVE,
    implementationDirective: SOURCE_IMPLEMENTATION_DIRECTIVE,
    sideEffectBoundary:
      'connector-runtime-durable-state-implementation-boundary-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials',
    ...overrides,
  });
}

describe('connector runtime durable state implementation manifest', () => {
  it('converts a current promoted durable-state boundary into a frozen head-chat-only manifest', () => {
    const decision = evaluateConnectorRuntimeDurableStateImplementationManifest({
      implementationBoundary: implementationBoundary(),
    });

    expect(decision).toMatchObject({
      status: 'implementation-manifest-ready',
      manifestReady: true,
      reason: 'implementation_manifest_ready',
      manifest: {
        schemaVersion: 1,
        contract: 'connector-runtime-durable-state-implementation-manifest-v1',
        manifestOwner: 'assistantcaddy-head-chat-durable-schema-export',
        manifestId: 'assistantcaddy-head-chat-durable-schema-export-manifest',
        manifestVersion: '2026.06.12',
        integrationOwner: 'head-chat',
        integrationScope: 'durable-schema-export-implementation',
        sourceImplementationBoundaryContract: 'connector-runtime-durable-state-implementation-boundary-v1',
        sourceImplementationBoundaryStorageDirective: SOURCE_IMPLEMENTATION_STORAGE_DIRECTIVE,
        sourceImplementationBoundaryImplementationDirective: SOURCE_IMPLEMENTATION_DIRECTIVE,
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
      },
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
    });
    expect(decision.manifest.sharedHighRiskWriteSet).toEqual(CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES);
    expect(decision.manifest.sharedHighRiskWriteSet).toEqual(expect.arrayContaining([
      'src/lib/sync-engine.ts',
      'src/lib/sync-middleware.ts',
      'src/lib/sync-sanitize.ts',
      'src/lib/cloud-sync.ts',
      'server/src/index.ts',
      'server/src/types.ts',
    ]));
    expect(decision.manifest.sharedHighRiskWriteSet).not.toEqual(expect.arrayContaining([
      'src/lib/sync.ts',
      'server/',
    ]));
    expect(decision.manifest.blockedPathClasses).toEqual([
      'generated-artifacts',
      'docs',
      'standalone',
      'package-files',
    ]);
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.manifest)).toBe(true);
    expect(Object.isFrozen(decision.manifest.sections)).toBe(true);
    expect(Object.isFrozen(decision.manifest.sharedHighRiskWriteSet)).toBe(true);
  });

  it('fails closed when the promoted boundary is missing, blocked, or forged to claim mutable behavior', () => {
    expect(evaluateConnectorRuntimeDurableStateImplementationManifest()).toMatchObject({
      status: 'blocked',
      reason: 'implementation_boundary_missing',
      canPrepareHeadChatDurableSchemaExportImplementation: false,
    });

    expect(evaluateConnectorRuntimeDurableStateImplementationManifest({
      implementationBoundary: implementationBoundary({
        status: 'blocked',
        boundaryReady: false,
        reason: 'implementation_boundary_not_ready',
        canPrepareFutureDurableStateImplementationPackage: false,
      }),
    })).toMatchObject({
      status: 'blocked',
      reason: 'implementation_boundary_not_ready',
    });

    expect(evaluateConnectorRuntimeDurableStateImplementationManifest({
      implementationBoundary: {
        ...implementationBoundary(),
        mayCreateDexieSchema: true,
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'implementation_boundary_invalid',
      mayCreateDexieSchema: false,
    });
  });

  it('validates owner facts, source-boundary facts, stale decisions, and forbidden future write paths exactly', () => {
    expect(evaluateConnectorRuntimeDurableStateImplementationManifest({
      implementationBoundary: {
        ...implementationBoundary(),
        metadata: {
          ...implementationBoundary().metadata,
          implementationOwner: 'other-owner',
        },
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'implementation_owner_invalid',
    });

    expect(evaluateConnectorRuntimeDurableStateImplementationManifest({
      implementationBoundary: {
        ...implementationBoundary(),
        metadata: {
          ...implementationBoundary().metadata,
          sourceBoundaryContract: 'other-contract',
        },
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'source_boundary_facts_invalid',
    });

    expect(evaluateConnectorRuntimeDurableStateImplementationManifest({
      implementationBoundary: {
        ...implementationBoundary(),
        metadata: {
          ...implementationBoundary().metadata,
          requirementCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length - 1,
          reviewedEvidenceCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length - 1,
        },
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'implementation_boundary_stale',
    });

    expect(evaluateConnectorRuntimeDurableStateImplementationManifest({
      implementationBoundary: {
        ...implementationBoundary(),
        metadata: {
          ...implementationBoundary().metadata,
          futureWriteSet: [...CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES, 'docs/rollout.md'],
        },
      } as never,
    })).toMatchObject({
      status: 'blocked',
      reason: 'future_write_set_invalid',
      willGenerateArtifacts: false,
      willPromoteStandalone: false,
    });
  });

  it('blocks token-shaped identifiers without fetch, IndexedDB, localStorage, or artifact side effects', () => {
    const fetchSpy = vi.fn();
    const indexedDbSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('indexedDB', indexedDbSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const decision = evaluateConnectorRuntimeDurableStateImplementationManifest({
      implementationBoundary: {
        ...implementationBoundary(),
        metadata: {
          ...implementationBoundary().metadata,
          providerId: 'ghp_do_not_echo_manifest_token',
        },
      } as never,
    });
    const serialized = JSON.stringify(decision);

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
      willOpenStorageAdapter: false,
      willReadStorage: false,
      willWriteStorage: false,
      willGenerateArtifacts: false,
      willPromoteStandalone: false,
      willCallProvider: false,
    });
    expect(serialized).not.toContain('do_not_echo');
    expect(serialized).not.toContain('manifest_token');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(indexedDbSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
