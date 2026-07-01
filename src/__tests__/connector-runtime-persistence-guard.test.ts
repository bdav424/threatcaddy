import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateConnectorRuntimePersistenceGuard,
  type ConnectorRuntimeNoPersistenceBoundary,
  type ConnectorRuntimePersistenceGuardInput,
  type ConnectorRuntimePersistenceReviewedPlan,
} from '../lib/connector-runtime-persistence-guard';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

function completeReviewedPlan(
  overrides: Partial<ConnectorRuntimePersistenceReviewedPlan> = {},
): ConnectorRuntimePersistenceReviewedPlan {
  return {
    planKind: 'connector-runtime-persistence-reviewed-plan-v1',
    planId: 'reviewed-plan-connector-runtime-1',
    reviewState: 'reviewed',
    reviewedBy: 'security-reviewer',
    reviewedAt: 1_700_000_000_000,
    scope: {
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      targetSurface: 'provider-catalog',
      tableName: 'connectorRuntimeState',
      typeName: 'ConnectorRuntimeState',
      schemaVersion: 1,
    },
    dexieSchema: {
      tableName: 'connectorRuntimeState',
      schemaVersion: 1,
      dexieSchemaEvidence: 'src/db.ts reviewed migration evidence',
      schemaVersionEvidence: 'schema version bump and downgrade notes reviewed',
    },
    typeSchema: {
      typeName: 'ConnectorRuntimeState',
      typeEvidence: 'src/types.ts reviewed entity evidence',
      schemaVersionTypeEvidence: 'schema version type evidence reviewed',
    },
    backupExport: {
      backupEvidence: 'backup-data inclusion and encrypted backup evidence reviewed',
      exportEvidence: 'json export omission and inclusion evidence reviewed',
      exportKeyEvidence: 'export keys reviewed for safe metadata only',
    },
    importRestore: {
      importEvidence: 'import validation evidence reviewed',
      restoreEvidence: 'restore behavior evidence reviewed',
      validationEvidence: 'malformed payload validation evidence reviewed',
    },
    syncState: {
      syncStateEvidence: 'sync ownership evidence reviewed',
      networkBoundaryEvidence: 'no provider network boundary evidence reviewed',
    },
    cascadeCleanup: {
      cascadeEvidence: 'owner deletion cascade evidence reviewed',
      orphanCleanupEvidence: 'orphan cleanup evidence reviewed',
    },
    secretRedaction: {
      rawSecretPersistence: false,
      redactionEvidence: 'redaction evidence reviewed',
      tokenScanEvidence: 'identifier scan evidence reviewed',
    },
    migrationRollback: {
      rollbackPlanEvidence: 'rollback plan evidence reviewed',
      rollbackTestEvidence: 'rollback test evidence reviewed',
    },
    standaloneParity: {
      standaloneEvidence: 'standalone parity evidence reviewed',
      backupRestoreParityEvidence: 'standalone backup restore parity evidence reviewed',
    },
    ...overrides,
  };
}

function persistenceRequest(
  overrides: Partial<ConnectorRuntimePersistenceGuardInput> = {},
): ConnectorRuntimePersistenceGuardInput {
  return {
    requestKind: 'persist-runtime-state',
    providerId: 'generic-webhook',
    connectorId: 'generic-webhook-runtime',
    targetSurface: 'provider-catalog',
    stateLabel: 'connector-runtime-session-state',
    proposedFields: ['id', 'providerId', 'connectorId', 'accountId', 'updatedAt'],
    migrationLabels: ['add-connector-runtime-state-v1'],
    exportKeys: ['connectorRuntimeState'],
    samplePayloadMetadata: {
      id: 'sample-runtime-state',
      providerId: 'generic-webhook',
    },
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
  if (Array.isArray(value)) return value.map((item) => trustedValue(item));
  if (typeof value === 'object') return trustedRecord(value as Record<string, unknown>) as RuntimeTrustedContractValue;
  throw new TypeError('Trusted persistence guard fixtures cannot include callable values.');
}

function trustedRecord<T extends Record<string, unknown>>(value: T): T {
  return createRuntimeTrustedContractObject(
    Object.entries(value).map(([key, nested]) => [key, trustedValue(nested)] as const),
  ) as unknown as T;
}

function evaluateTrusted(input: ConnectorRuntimePersistenceGuardInput) {
  return evaluateConnectorRuntimePersistenceGuard(
    trustedRecord(input as unknown as Record<string, unknown>) as unknown as ConnectorRuntimePersistenceGuardInput,
  );
}

function blockerCodes(input: ConnectorRuntimePersistenceGuardInput) {
  return evaluateTrusted(input).blockers.map((blocker) => blocker.code);
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe('connector runtime persistence guard', () => {
  it('allows only explicit no-persistence session-only runtime state metadata', () => {
    const decision = evaluateTrusted({
      requestKind: 'no-persistence-session-only',
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      targetSurface: 'provider-catalog',
      stateLabel: 'session-runtime-state',
      proposedFields: ['selectedProviderId', 'setupStep', 'lastCheckedAt'],
      migrationLabels: [],
      exportKeys: [],
      samplePayloadMetadata: {
        providerId: 'generic-webhook',
        connectorId: 'generic-webhook-runtime',
        setupStep: 'manual-review',
      },
      noPersistenceBoundary: noPersistenceBoundary(),
    });

    expect(decision).toEqual({
      status: 'allow-session-only',
      mayUseSessionOnlyRuntimeState: true,
      mayPersistRuntimeState: false,
      mayCreateDexieSchema: false,
      mayBackupOrExportRuntimeState: false,
      mayImportOrRestoreRuntimeState: false,
      maySyncRuntimeState: false,
      storageDirective: 'session-only-do-not-persist-do-not-export-do-not-sync',
      sideEffects: 'none',
      sideEffectBoundary: 'decision-only-no-fetch-no-indexeddb-no-localstorage-no-provider-no-credentials',
      metadata: {
        schemaVersion: 1,
        contract: 'connector-runtime-persistence-guard-v1',
        requestKind: 'no-persistence-session-only',
        providerId: 'generic-webhook',
        connectorId: 'generic-webhook-runtime',
        targetSurface: 'provider-catalog',
        stateLabel: 'session-runtime-state',
        proposedFieldCount: 3,
        migrationLabelCount: 0,
        exportKeyCount: 0,
        reviewedPlanId: undefined,
        reviewedPlanEvidenceCount: 0,
      },
      blockers: [],
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.metadata)).toBe(true);
  });

  it('requires trusted root input before reading proxy or accessor properties', () => {
    const getter = vi.fn(() => 'no-persistence-session-only');
    const accessorRoot: Record<string, unknown> = {};
    Object.defineProperty(accessorRoot, 'requestKind', {
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
      requestKind: 'no-persistence-session-only',
      noPersistenceBoundary: noPersistenceBoundary(),
    }, traps);

    expect(evaluateConnectorRuntimePersistenceGuard(accessorRoot as never)).toMatchObject({
      status: 'blocked',
      mayPersistRuntimeState: false,
      blockers: [expect.objectContaining({ code: 'input_untrusted' })],
    });
    expect(evaluateConnectorRuntimePersistenceGuard(proxyRoot as never)).toMatchObject({
      status: 'blocked',
      mayPersistRuntimeState: false,
      blockers: [expect.objectContaining({ code: 'input_untrusted' })],
    });
    expect(getter).not.toHaveBeenCalled();
    expect(traps.get).not.toHaveBeenCalled();
    expect(traps.ownKeys).not.toHaveBeenCalled();
    expect(traps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(traps.getPrototypeOf).not.toHaveBeenCalled();
  });

  it('rejects scheme-shaped and URL/path-shaped generic metadata identifiers', () => {
    const decision = evaluateTrusted({
      requestKind: 'no-persistence-session-only',
      providerId: 'mailto:user@example.test',
      connectorId: 'urn:provider:opaque',
      targetSurface: 'example.invalid/path',
      proposedFields: ['localhost:4000/path'],
      migrationLabels: ['127.0.0.1:4000/path'],
      exportKeys: ['//example.invalid/path'],
      noPersistenceBoundary: noPersistenceBoundary(),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.mayPersistRuntimeState).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'unsafe_request_identifier',
      'raw_secret_or_token_identifier',
    ]));
    expect(decision.metadata.providerId).toBeUndefined();
    expect(decision.metadata.connectorId).toBeUndefined();
    expect(decision.metadata.targetSurface).toBeUndefined();
    expect(serialized(decision)).not.toContain('mailto:user@example.test');
    expect(serialized(decision)).not.toContain('urn:provider:opaque');
  });

  it('fails closed when a session-only request does not explicitly avoid durable storage and raw secrets', () => {
    const decision = evaluateTrusted({
      requestKind: 'no-persistence-session-only',
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      noPersistenceBoundary: {
        ...noPersistenceBoundary(),
        durableStorage: true as false,
        rawSecrets: true as false,
      },
    });

    expect(decision.status).toBe('blocked');
    expect(decision.mayUseSessionOnlyRuntimeState).toBe(false);
    expect(decision.storageDirective).toBe('blocked-no-connector-runtime-persistence');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'no_persistence_boundary_invalid',
    ]));
  });

  it('blocks persistence requests with missing schema, type, export, backup, import, cascade, redaction, rollback, sync, and parity evidence', () => {
    const decision = evaluateTrusted(persistenceRequest({
      reviewedPlan: {
        planKind: 'connector-runtime-persistence-reviewed-plan-v1',
        planId: 'forged-reviewed-plan',
        reviewState: 'reviewed',
      },
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.mayPersistRuntimeState).toBe(false);
    expect(decision.mayCreateDexieSchema).toBe(false);
    expect(decision.mayBackupOrExportRuntimeState).toBe(false);
    expect(decision.mayImportOrRestoreRuntimeState).toBe(false);
    expect(decision.maySyncRuntimeState).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'reviewed_plan_not_reviewed',
      'schema_version_plan_missing',
      'dexie_schema_plan_missing',
      'type_schema_plan_missing',
      'backup_plan_missing',
      'export_plan_missing',
      'import_plan_missing',
      'restore_plan_missing',
      'sync_state_plan_missing',
      'cascade_cleanup_plan_missing',
      'secret_redaction_plan_missing',
      'migration_rollback_plan_missing',
      'standalone_parity_plan_missing',
      'reviewed_plan_incomplete',
      'durable_persistence_disabled',
    ]));
  });

  it('blocks backup, export, import, restore, schema, and sync state even with complete reviewed-plan metadata in this pure local slice', () => {
    const decision = evaluateTrusted(persistenceRequest({
      requestKind: 'backup-export',
      reviewedPlan: completeReviewedPlan(),
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(['durable_persistence_disabled']);
    expect(decision.metadata).toMatchObject({
      reviewedPlanId: 'reviewed-plan-connector-runtime-1',
      reviewedPlanEvidenceCount: 12,
    });
  });

  it('blocks raw secrets and token-shaped identifiers in fields, migration labels, export keys, and sample payload metadata without echoing them', () => {
    const decision = evaluateTrusted({
      requestKind: 'no-persistence-session-only',
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      stateLabel: 'Bearer do-not-echo-token',
      proposedFields: ['accessToken', 'client_secret', 'sk-shouldnotappearinoutput'],
      migrationLabels: ['add-oauth-token-cache'],
      exportKeys: ['refreshToken'],
      samplePayloadMetadata: {
        id: 'sample',
        apiKey: 'should-not-echo-api-key',
      },
      noPersistenceBoundary: noPersistenceBoundary(),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'unsafe_request_identifier',
      'raw_secret_or_token_identifier',
    ]));
    expect(decision.blockers.map((blocker) => blocker.field)).toEqual(expect.arrayContaining([
      'proposedFields.0',
      'proposedFields.1',
      'proposedFields.2',
      'migrationLabels.0',
      'exportKeys.0',
      'samplePayloadMetadata',
    ]));
    expect(serialized(decision)).not.toContain('do-not-echo-token');
    expect(serialized(decision)).not.toContain('sk-shouldnotappearinoutput');
    expect(serialized(decision)).not.toContain('should-not-echo-api-key');
    expect(decision.metadata.stateLabel).toBeUndefined();
    expect(decision.metadata.proposedFieldCount).toBe(3);
    expect(decision.metadata.exportKeyCount).toBe(1);
  });

  it('blocks unsafe runtime request kinds without echoing them in metadata', () => {
    const unsafeRequestKind = 'Bearer do-not-echo-request-kind';
    const decision = evaluateTrusted({
      ...persistenceRequest(),
      requestKind: unsafeRequestKind as ConnectorRuntimePersistenceGuardInput['requestKind'],
    });

    expect(decision.status).toBe('blocked');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'request_kind_missing',
      'unsafe_request_identifier',
    ]));
    expect(decision.blockers.map((blocker) => blocker.field)).toEqual(expect.arrayContaining([
      'requestKind',
    ]));
    expect(decision.metadata.requestKind).toBeUndefined();
    expect(serialized(decision)).not.toContain(unsafeRequestKind);
  });

  it('blocks forged reviewed flags and raw secret persistence claims', () => {
    const decision = evaluateTrusted(persistenceRequest({
      reviewedPlan: completeReviewedPlan({
        reviewState: 'reviewed',
        secretRedaction: {
          rawSecretPersistence: true as false,
          redactionEvidence: 'redaction evidence reviewed',
          tokenScanEvidence: 'identifier scan evidence reviewed',
        },
        migrationRollback: undefined as unknown as ConnectorRuntimePersistenceReviewedPlan['migrationRollback'],
      }),
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'raw_secret_persistence_requested',
      'migration_rollback_plan_missing',
      'reviewed_plan_incomplete',
      'durable_persistence_disabled',
    ]));
  });

  it('reports a missing reviewed plan for all durable connector runtime persistence request kinds', () => {
    const durableKinds: ConnectorRuntimePersistenceGuardInput['requestKind'][] = [
      'persist-runtime-state',
      'dexie-schema',
      'backup-export',
      'import-restore',
      'sync-state',
    ];

    durableKinds.forEach((requestKind) => {
      expect(blockerCodes(persistenceRequest({ requestKind }))).toEqual(expect.arrayContaining([
        'reviewed_plan_missing',
        'durable_persistence_disabled',
      ]));
    });
  });

  it('performs no fetch, WebSocket, browser storage, IndexedDB, provider, or credential side effects', () => {
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
      requestKind: 'no-persistence-session-only',
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      noPersistenceBoundary: noPersistenceBoundary(),
    });
    evaluateTrusted(persistenceRequest({
      reviewedPlan: {
        reviewState: 'reviewed',
      },
    }));

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
