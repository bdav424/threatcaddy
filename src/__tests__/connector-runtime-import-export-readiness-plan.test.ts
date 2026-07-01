import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateConnectorRuntimeImportExportReadinessPlan as evaluateRawConnectorRuntimeImportExportReadinessPlan,
  type ConnectorRuntimeImportExportReadinessEvidenceDescriptor,
  type ConnectorRuntimeImportExportReadinessOwner,
  type ConnectorRuntimeImportExportReadinessSection,
} from '../lib/connector-runtime-import-export-readiness-plan';
import {
  evaluateConnectorRuntimePersistenceGuard,
  type ConnectorRuntimeNoPersistenceBoundary,
} from '../lib/connector-runtime-persistence-guard';
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

const sections: readonly ConnectorRuntimeImportExportReadinessSection[] = [
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

  throw new TypeError('Trusted import/export readiness fixtures cannot include executable values.');
}

function trustedObject(value: Record<string, unknown>): RuntimeTrustedContractObject {
  const entries = Object.entries(value).map(([key, entryValue]) => [
    key,
    trustedValue(entryValue),
  ] as RuntimeTrustedContractEntry);
  return createRuntimeTrustedContractObject(entries);
}

function evaluateConnectorRuntimeImportExportReadinessPlan(
  input: Record<string, unknown>,
): ReturnType<typeof evaluateRawConnectorRuntimeImportExportReadinessPlan> {
  try {
    return evaluateRawConnectorRuntimeImportExportReadinessPlan(
      trustedObject(input) as unknown as Parameters<typeof evaluateRawConnectorRuntimeImportExportReadinessPlan>[0],
    );
  } catch {
    return evaluateRawConnectorRuntimeImportExportReadinessPlan(
      input as unknown as Parameters<typeof evaluateRawConnectorRuntimeImportExportReadinessPlan>[0],
    );
  }
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

function evidence(
  overrides: Partial<ConnectorRuntimeImportExportReadinessEvidenceDescriptor> = {},
): ConnectorRuntimeImportExportReadinessEvidenceDescriptor[] {
  return sections.map((section, index) => ({
    section,
    evidenceId: `readiness-evidence-${section}-${index}`,
    reviewedBy: 'security-reviewer',
    reviewedAt: 1_700_000_000_000 + index,
    owner,
    ...overrides,
  }));
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

describe('connector runtime import/export readiness plan', () => {
  it('summarizes complete reviewed evidence but keeps all persistence and import/export readiness non-executable', () => {
    const decision = evaluateConnectorRuntimeImportExportReadinessPlan({
      owner,
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: evidence(),
    });

    expect(decision).toEqual({
      status: 'metadata-only',
      readyForSchemaChange: false,
      readyForExport: false,
      readyForImport: false,
      readyForPersistence: false,
      sideEffects: 'none',
      sideEffectBoundary: 'plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-no-credentials',
      storageDirective: 'metadata-only-do-not-persist-do-not-export-do-not-import',
      metadata: {
        schemaVersion: 1,
        contract: 'connector-runtime-import-export-readiness-plan-v1',
        providerId: 'generic-webhook',
        connectorId: 'generic-webhook-runtime',
        targetSurface: 'provider-catalog',
        persistenceGuardContract: 'connector-runtime-persistence-guard-v1',
        persistenceGuardRequestKind: 'no-persistence-session-only',
        persistenceGuardStatus: 'allow-session-only',
        evidenceSectionCount: 10,
        evidenceDescriptorCount: 10,
        reviewedEvidenceCount: 10,
        missingSectionCount: 0,
        sections,
        missingSections: [],
      },
      blockers: [],
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.metadata)).toBe(true);
    expect(Object.isFrozen(decision.metadata.sections)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(serialized(decision)).not.toContain('readiness-evidence-schema-0');
  });

  it('fails closed when reviewed evidence sections or the persistence guard decision are missing', () => {
    const decision = evaluateConnectorRuntimeImportExportReadinessPlan({
      owner,
      evidence: evidence().filter((descriptor) => descriptor.section !== 'restore'),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForExport).toBe(false);
    expect(decision.readyForImport).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'persistence_guard_missing',
      'evidence_section_missing',
    ]));
    expect(decision.metadata.missingSections).toEqual(['restore']);
  });

  it('blocks forged readiness flags from caller-provided metadata', () => {
    const decision = evaluateConnectorRuntimeImportExportReadinessPlan({
      owner,
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: evidence(),
      readyForExport: true,
      readyForImport: true,
    } as unknown as Parameters<typeof evaluateConnectorRuntimeImportExportReadinessPlan>[0]);

    expect(decision.status).toBe('blocked');
    expect(decision.readyForExport).toBe(false);
    expect(decision.readyForImport).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'forged_readiness_flag',
    ]));
    expect(decision.blockers.map((blocker) => blocker.field)).toEqual(expect.arrayContaining([
      'readyForExport',
      'readyForImport',
    ]));
  });

  it('rejects trusted inputs with unsafe executable, requester, storage, schema, or live-action fields', () => {
    const cases: Array<{
      readonly label: string;
      readonly input: Record<string, unknown>;
      readonly field: string;
    }> = [
      {
        label: 'root fetch field',
        input: {
          owner,
          persistenceGuardDecision: persistenceGuardDecision(),
          evidence: evidence(),
          fetch: 'https://example.invalid/do-not-call',
        },
        field: 'input.fetch',
      },
      {
        label: 'root executable field',
        input: {
          owner,
          persistenceGuardDecision: persistenceGuardDecision(),
          evidence: evidence(),
          executable: false,
        },
        field: 'input.executable',
      },
      {
        label: 'owner storage adapter field',
        input: {
          owner: {
            ...owner,
            storageAdapter: 'browser-storage',
          },
          persistenceGuardDecision: persistenceGuardDecision(),
          evidence: evidence(),
        },
        field: 'owner.storageAdapter',
      },
      {
        label: 'persistence guard schema writer field',
        input: {
          owner,
          persistenceGuardDecision: {
            ...persistenceGuardDecision(),
            schemaWriter: 'dexie-schema-writer',
          },
          evidence: evidence(),
        },
        field: 'input.persistenceGuardDecision.schemaWriter',
      },
      {
        label: 'evidence export callback field',
        input: {
          owner,
          persistenceGuardDecision: persistenceGuardDecision(),
          evidence: evidence({
            exportCallback: 'export-now',
          } as never),
        },
        field: 'evidence.0.exportCallback',
      },
      {
        label: 'nested live action field',
        input: {
          owner,
          persistenceGuardDecision: persistenceGuardDecision(),
          evidence: evidence({
            owner: {
              ...owner,
              liveAction: 'sync-now',
            } as never,
          }),
        },
        field: 'evidence.0.owner.liveAction',
      },
    ];

    for (const testCase of cases) {
      const decision = evaluateConnectorRuntimeImportExportReadinessPlan(testCase.input);
      const output = serialized(decision);

      expect(decision.status, testCase.label).toBe('blocked');
      expect(decision.readyForSchemaChange).toBe(false);
      expect(decision.readyForExport).toBe(false);
      expect(decision.readyForImport).toBe(false);
      expect(decision.readyForPersistence).toBe(false);
      expect(decision.sideEffects).toBe('none');
      expect(decision.blockers.map((blocker) => blocker.code)).toContain('input_shape_forbidden');
      expect(decision.blockers.map((blocker) => blocker.field)).toContain(testCase.field);
      expect(output).not.toContain('https://example.invalid');
      expect(output).not.toContain('dexie-schema-writer');
      expect(output).not.toContain('export-now');
      expect(output).not.toContain('sync-now');
    }
  });

  it('rejects root and nested Proxy inputs before trap execution', () => {
    const root = proxyTrapFixture({
      owner,
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: evidence(),
    });
    const rootDecision = evaluateRawConnectorRuntimeImportExportReadinessPlan(
      root.proxy as unknown as Parameters<typeof evaluateRawConnectorRuntimeImportExportReadinessPlan>[0],
    );

    expect(rootDecision.status).toBe('blocked');
    expect(rootDecision.readyForPersistence).toBe(false);
    expect(rootDecision.blockers.map((blocker) => blocker.code)).toEqual(['input_shape_forbidden']);
    expect(root.get).not.toHaveBeenCalled();
    expect(root.ownKeys).not.toHaveBeenCalled();
    expect(root.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(root.getPrototypeOf).not.toHaveBeenCalled();

    const nested = proxyTrapFixture({
      section: 'schema',
      evidenceId: 'readiness-evidence-schema-0',
      reviewedBy: 'security-reviewer',
      reviewedAt: 1_700_000_000_000,
      owner,
    });
    const nestedDecision = evaluateRawConnectorRuntimeImportExportReadinessPlan({
      owner,
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: [nested.proxy],
    } as unknown as Parameters<typeof evaluateRawConnectorRuntimeImportExportReadinessPlan>[0]);

    expect(nestedDecision.status).toBe('blocked');
    expect(nestedDecision.readyForPersistence).toBe(false);
    expect(nestedDecision.blockers.map((blocker) => blocker.code)).toEqual(['input_shape_forbidden']);
    expect(nested.get).not.toHaveBeenCalled();
    expect(nested.ownKeys).not.toHaveBeenCalled();
    expect(nested.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(nested.getPrototypeOf).not.toHaveBeenCalled();
  });

  it('blocks token-shaped evidence, export keys, and sample payload metadata without echoing raw values', () => {
    const tokenEvidenceId = 'ghp_donotechothisfixturetoken';
    const tokenPayload = 'sk-donotechosamplepayload';
    const decision = evaluateConnectorRuntimeImportExportReadinessPlan({
      owner,
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: evidence({
        evidenceId: tokenEvidenceId,
        exportKeys: ['connectorRuntimeState'],
        samplePayloadMetadata: {
          apiKey: tokenPayload,
        },
      }),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'raw_secret_or_token_evidence',
      'export_keys_not_allowed',
      'sample_payload_metadata_not_allowed',
    ]));
    expect(serialized(decision)).not.toContain(tokenEvidenceId);
    expect(serialized(decision)).not.toContain(tokenPayload);
    expect(serialized(decision)).not.toContain('connectorRuntimeState');
  });

  it('blocks owner mismatches between the readiness owner, guard decision, and evidence descriptors', () => {
    const guardForOtherOwner = evaluateConnectorRuntimePersistenceGuard(trustedObject({
      requestKind: 'no-persistence-session-only',
      providerId: 'slack',
      connectorId: 'slack-runtime',
      targetSurface: owner.targetSurface,
      noPersistenceBoundary: noPersistenceBoundary(),
    }) as unknown as Parameters<typeof evaluateConnectorRuntimePersistenceGuard>[0]);
    const decision = evaluateConnectorRuntimeImportExportReadinessPlan({
      owner,
      persistenceGuardDecision: guardForOtherOwner,
      evidence: evidence({
        owner: {
          providerId: 'slack',
          connectorId: 'slack-runtime',
          targetSurface: owner.targetSurface,
        },
      }),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'persistence_guard_owner_mismatch',
      'evidence_owner_mismatch',
    ]));
    expect(decision.metadata.providerId).toBe(owner.providerId);
    expect(serialized(decision)).not.toContain('slack-runtime');
  });

  it('blocks scheme-shaped generic owner identifiers before readiness metadata acceptance', () => {
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
      const decision = evaluateConnectorRuntimeImportExportReadinessPlan({
        owner: {
          ...owner,
          providerId: unsafeIdentifier,
        },
        persistenceGuardDecision: persistenceGuardDecision(),
        evidence: evidence(),
      });
      const output = serialized(decision);

      expect(decision.status).toBe('blocked');
      expect(decision.readyForPersistence).toBe(false);
      expect(decision.readyForExport).toBe(false);
      expect(decision.readyForImport).toBe(false);
      expect(decision.blockers.map((blocker) => blocker.code)).toContain('owner_unsafe');
      expect(decision.metadata.providerId).toBeUndefined();
      expect(output).not.toContain(unsafeIdentifier);
      expect(output).not.toContain('example.invalid');
      expect(output).not.toContain('localhost');
      expect(output).not.toContain('urn:provider');
    }
  });

  it('blocks forged persistence guard decisions that claim allow status while changing durable boundaries', () => {
    const forgedGuard = {
      ...persistenceGuardDecision(),
      mayPersistRuntimeState: true,
      mayBackupOrExportRuntimeState: true,
      storageDirective: 'blocked-no-connector-runtime-persistence',
      blockers: [{
        code: 'durable_persistence_disabled',
        detail: 'forged blocker should prevent metadata-only acceptance',
      }],
    } as unknown as ReturnType<typeof persistenceGuardDecision>;

    const decision = evaluateConnectorRuntimeImportExportReadinessPlan({
      owner,
      persistenceGuardDecision: forgedGuard,
      evidence: evidence(),
    });

    expect(decision.status).toBe('blocked');
    expect(decision.readyForPersistence).toBe(false);
    expect(decision.readyForExport).toBe(false);
    expect(decision.blockers.map((blocker) => blocker.code)).toContain('persistence_guard_boundary_invalid');
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

    evaluateConnectorRuntimeImportExportReadinessPlan({
      owner,
      persistenceGuardDecision: persistenceGuardDecision(),
      evidence: evidence(),
    });
    evaluateConnectorRuntimeImportExportReadinessPlan({
      owner: {
        providerId: 'Bearer do-not-echo-owner',
      },
      persistenceGuardDecision: null,
      evidence: [],
      readyForPersistence: true,
    } as unknown as Parameters<typeof evaluateConnectorRuntimeImportExportReadinessPlan>[0]);

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
