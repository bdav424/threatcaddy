import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS,
  type ConnectorRuntimePersistenceImplementationBoundaryDecision,
} from '../lib/connector-runtime-persistence-implementation-boundary';
import {
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES,
  CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS,
  evaluateConnectorRuntimeDurableStateImplementationBoundary,
  type ConnectorRuntimeDurableStateImplementationBoundaryInput,
  type ConnectorRuntimeDurableStateImplementationRequest,
} from '../lib/connector-runtime-durable-state-implementation-boundary';
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

const IMPLEMENTATION_BOUNDARY =
  'implementation-checklist-only-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials' as const;
const IMPLEMENTATION_STORAGE_DIRECTIVE =
  'checklist-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import' as const;
const REQUEST_BOUNDARY =
  'durable-state-implementation-request-only-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials' as const;

function implementationBoundary(
  overrides: Partial<ConnectorRuntimePersistenceImplementationBoundaryDecision> = {},
): ConnectorRuntimePersistenceImplementationBoundaryDecision {
  return Object.freeze({
    status: 'implementation-checklist-ready',
    readyForDurableRuntimeImplementation: true,
    mayPersistRuntimeState: false,
    mayCreateDexieSchema: false,
    mayBackupOrExportRuntimeState: false,
    mayImportOrRestoreRuntimeState: false,
    maySyncRuntimeState: false,
    sideEffects: 'none',
    sideEffectBoundary: IMPLEMENTATION_BOUNDARY,
    storageDirective: IMPLEMENTATION_STORAGE_DIRECTIVE,
    metadata: Object.freeze({
      schemaVersion: 1,
      contract: 'connector-runtime-persistence-implementation-boundary-v1',
      providerId: 'local',
      connectorId: 'assistantcaddy-runtime-connectors',
      targetSurface: 'assistantcaddy',
      importExportReadinessContract: 'connector-runtime-import-export-readiness-plan-v1',
      importExportReadinessStatus: 'metadata-only',
      persistenceGuardContract: 'connector-runtime-persistence-guard-v1',
      persistenceGuardStatus: 'allow-session-only',
      requirementCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
      evidenceDescriptorCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
      reviewedEvidenceCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
      missingSectionCount: 0,
      sections: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS,
      missingSections: Object.freeze([]),
      requirements: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS,
    }),
    blockers: Object.freeze([]),
    ...overrides,
  });
}

function implementationRequest(
  overrides: Partial<ConnectorRuntimeDurableStateImplementationRequest> = {},
): ConnectorRuntimeDurableStateImplementationRequest {
  return {
    contract: 'connector-runtime-durable-state-implementation-request-v1',
    implementationOwner: 'assistantcaddy-connector-runtime-durable-state',
    implementationId: 'assistantcaddy-connector-runtime-durable-state-boundary',
    implementationVersion: '2026.06.12',
    providerId: 'local',
    connectorId: 'assistantcaddy-runtime-connectors',
    targetSurface: 'assistantcaddy',
    sourceBoundaryContract: 'connector-runtime-persistence-implementation-boundary-v1',
    sourceBoundaryStorageDirective: IMPLEMENTATION_STORAGE_DIRECTIVE,
    sections: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS,
    futureWriteSet: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES,
    reviewedEvidenceCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
    requirementCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
    acknowledgedSchemaEvidence: true,
    acknowledgedTypeEvidence: true,
    acknowledgedBackupEvidence: true,
    acknowledgedExportEvidence: true,
    acknowledgedImportEvidence: true,
    acknowledgedRestoreEvidence: true,
    acknowledgedSyncEvidence: true,
    acknowledgedCascadeEvidence: true,
    acknowledgedRedactionEvidence: true,
    acknowledgedRollbackEvidence: true,
    acknowledgedNoStorage: true,
    acknowledgedNoSchemaChange: true,
    acknowledgedNoExportImportMutation: true,
    acknowledgedNoGeneratedArtifacts: true,
    acknowledgedNoStandalonePromotion: true,
    acknowledgedNoProviderCalls: true,
    headChatReviewedSchemaExportImplementationContract: false,
    readyForImplementation: false,
    implementationMode: 'boundary-only',
    sideEffectBoundary: REQUEST_BOUNDARY,
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

  throw new TypeError('Trusted durable state boundary fixtures cannot include executable values.');
}

function trustedObject(value: Record<string, unknown>): RuntimeTrustedContractObject {
  return createRuntimeTrustedContractObject(Object.entries(value).map(([key, entryValue]) => [
    key,
    trustedValue(entryValue),
  ] as RuntimeTrustedContractEntry));
}

function input(overrides: Record<string, unknown> = {}): ConnectorRuntimeDurableStateImplementationBoundaryInput {
  return trustedObject({
    implementationBoundary: implementationBoundary(),
    implementationRequest: implementationRequest(),
    storageAdapter: undefined,
    implementationResult: undefined,
    ...overrides,
  }) as unknown as ConnectorRuntimeDurableStateImplementationBoundaryInput;
}

describe('connector runtime durable state implementation boundary', () => {
  it('returns frozen allowlisted metadata for a future durable-state implementation package only', () => {
    const decision = evaluateConnectorRuntimeDurableStateImplementationBoundary(input());

    expect(decision).toMatchObject({
      status: 'implementation-boundary-ready',
      boundaryReady: true,
      reason: 'durable_state_implementation_boundary_ready',
      metadata: {
        schemaVersion: 1,
        contract: 'connector-runtime-durable-state-implementation-boundary-v1',
        implementationOwner: 'assistantcaddy-connector-runtime-durable-state',
        implementationId: 'assistantcaddy-connector-runtime-durable-state-boundary',
        implementationVersion: '2026.06.12',
        providerId: 'local',
        connectorId: 'assistantcaddy-runtime-connectors',
        targetSurface: 'assistantcaddy',
        sections: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS,
        futureWriteSet: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES,
        reviewedEvidenceCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
        requirementCount: CONNECTOR_RUNTIME_PERSISTENCE_IMPLEMENTATION_REQUIREMENTS.length,
        headChatReviewedSchemaExportImplementationContract: false,
        readyForImplementation: false,
        implementationMode: 'boundary-only',
      },
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
      storageDirective: 'boundary-only-do-not-persist-do-not-change-schema-do-not-export-do-not-import',
      implementationDirective: 'future-head-chat-reviewed-schema-export-contract-required',
      sideEffectBoundary: 'connector-runtime-durable-state-implementation-boundary-no-fetch-no-indexeddb-no-localstorage-no-schema-no-export-no-import-no-provider-no-credentials',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.metadata)).toBe(true);
    expect(Object.isFrozen(decision.metadata.sections)).toBe(true);
    expect(Object.isFrozen(decision.metadata.futureWriteSet)).toBe(true);
  });

  it('fails closed when the promoted persistence implementation boundary is missing, blocked, or forged', () => {
    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
      implementationBoundary: undefined,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'implementation_boundary_missing',
      canPrepareFutureDurableStateImplementationPackage: false,
    });

    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
      implementationBoundary: implementationBoundary({
        status: 'blocked',
        readyForDurableRuntimeImplementation: false,
        blockers: Object.freeze([{
          code: 'implementation_evidence_missing',
          detail: 'evidence missing',
        }]),
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'implementation_boundary_not_ready',
    });

    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
      implementationBoundary: {
        ...implementationBoundary(),
        mayPersistRuntimeState: true,
      } as never,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'implementation_boundary_invalid',
      mayPersistRuntimeState: false,
    });
  });

  it('validates owner, required sections, future write set, and implementation identity exactly', () => {
    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
      implementationRequest: implementationRequest({
        providerId: 'other-provider',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'implementation_owner_mismatch',
      canPrepareFutureDurableStateImplementationPackage: false,
    });

    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
      implementationRequest: implementationRequest({
        sections: CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_SECTIONS.slice(0, -1),
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'implementation_request_invalid',
    });

    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
      implementationRequest: implementationRequest({
        futureWriteSet: [...CONNECTOR_RUNTIME_DURABLE_STATE_IMPLEMENTATION_REQUIRED_SOURCE_FILES, 'dist-single/index.html'],
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'implementation_request_invalid',
      willGenerateArtifacts: false,
      willPromoteStandalone: false,
    });

    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
      implementationRequest: implementationRequest({
        headChatReviewedSchemaExportImplementationContract: true,
        readyForImplementation: true,
      } as unknown as Partial<ConnectorRuntimeDurableStateImplementationRequest>),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'implementation_request_invalid',
      readyForDurableStateImplementation: false,
    });

    for (const unsafeIdentifier of [
      'ftp://example.invalid/path',
      'localhost:4000/path',
      '127.0.0.1:4000/path',
      'example.invalid/provider/path',
      'mailto:user@example.test',
      'urn:provider:opaque',
    ]) {
      const unsafeDecision = evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
        implementationRequest: implementationRequest({
          providerId: unsafeIdentifier,
        }),
      }));
      const serialized = JSON.stringify(unsafeDecision);

      expect(unsafeDecision).toMatchObject({
        status: 'blocked',
        reason: 'implementation_request_invalid',
        mayPersistRuntimeState: false,
        mayCreateDexieSchema: false,
        mayBackupOrExportRuntimeState: false,
        mayImportOrRestoreRuntimeState: false,
        maySyncRuntimeState: false,
        willReadStorage: false,
        willWriteStorage: false,
      });
      expect(serialized).not.toContain(unsafeIdentifier);
      expect(serialized).not.toContain('example.invalid');
      expect(serialized).not.toContain('localhost');
      expect(serialized).not.toContain('urn:provider');
    }
  });

  it('rejects untrusted root, accessors, proxies, and unsafe root fields before reading boundary values', () => {
    const getter = vi.fn(() => implementationBoundary());
    const accessorRoot: Record<string, unknown> = {};
    Object.defineProperty(accessorRoot, 'implementationBoundary', {
      enumerable: true,
      get: getter,
    });
    const traps = {
      get: vi.fn((target: Record<string, unknown>, property: string | symbol, receiver: unknown) => (
        Reflect.get(target, property, receiver)
      )),
      ownKeys: vi.fn((target: Record<string, unknown>) => Reflect.ownKeys(target)),
      getOwnPropertyDescriptor: vi.fn((target: Record<string, unknown>, property: string | symbol) => (
        Reflect.getOwnPropertyDescriptor(target, property)
      )),
      getPrototypeOf: vi.fn((target: Record<string, unknown>) => Reflect.getPrototypeOf(target)),
    };
    const proxyRoot = new Proxy({
      implementationBoundary: implementationBoundary(),
      implementationRequest: implementationRequest(),
    }, traps);

    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(accessorRoot)).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
    });
    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(proxyRoot)).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
    });
    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
      schemaWriter: 'blocked-schema-writer',
      fetch: 'blocked-fetch',
    }))).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_input_field',
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
    });
    expect(getter).not.toHaveBeenCalled();
    expect(traps.get).not.toHaveBeenCalled();
    expect(traps.ownKeys).not.toHaveBeenCalled();
    expect(traps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(traps.getPrototypeOf).not.toHaveBeenCalled();
  });

  it('rejects storage adapters and implementation results without opening or trusting them', () => {
    const storageAdapter = {
      open: vi.fn(),
      table: vi.fn(),
      put: vi.fn(),
    };

    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary({
      implementationBoundary: implementationBoundary(),
      implementationRequest: implementationRequest(),
      storageAdapter,
    })).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
      willOpenStorageAdapter: false,
      willWriteStorage: false,
    });
    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
      storageAdapter: {
        open: 'blocked-open',
        table: 'blocked-table',
        put: 'blocked-put',
      },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'storage_adapter_forbidden',
      willOpenStorageAdapter: false,
      willWriteStorage: false,
    });
    expect(storageAdapter.open).not.toHaveBeenCalled();
    expect(storageAdapter.table).not.toHaveBeenCalled();
    expect(storageAdapter.put).not.toHaveBeenCalled();

    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
      implementationResult: { implementationId: 'future-durable-state-implementation-1' },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'implementation_result_forbidden',
    });

    expect(evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
      implementationResult: { persisted: true, schemaChanged: true },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'implementation_result_live_claim',
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
    });
  });

  it('blocks raw secret material without fetch, IndexedDB, localStorage, artifact, provider, or standalone side effects', () => {
    const fetchSpy = vi.fn();
    const indexedDbSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('indexedDB', indexedDbSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const decision = evaluateConnectorRuntimeDurableStateImplementationBoundary(input({
      implementationRequest: implementationRequest({
        providerId: 'sk-do-not-keep-durable-state-token',
      }),
    }));
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
    expect(serialized).not.toContain('do-not-keep');
    expect(serialized).not.toContain('durable-state-token');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(indexedDbSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
