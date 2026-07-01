import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  planConnectorRuntimeCredentialSession,
  type ConnectorRuntimeCredentialSessionOwnerFact,
} from '../lib/connector-runtime-credential-session';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import type { ConnectorCredentialStoreCapability } from '../lib/connector-credential-store';
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

function store(overrides: Partial<ConnectorCredentialStoreCapability> = {}): ConnectorCredentialStoreCapability {
  return {
    kind: 'external-secret-store',
    storageOwner: 'external-secret-store',
    reviewState: 'reviewed',
    supportsOpaqueHandle: true,
    persistsRawSecretMaterial: false,
    usesBrowserSecretStorage: false,
    callsProviderApis: false,
    providerId: 'generic-webhook',
    connectorId: 'generic-webhook-runtime',
    ...overrides,
  };
}

function handle(overrides: Partial<ConnectorCredentialReference> = {}): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'external-secret-store',
    id: 'vault:path/to/threatcaddy/generic-webhook/account-1',
    storageOwner: 'external-secret-store',
    providerId: 'generic-webhook',
    connectorId: 'generic-webhook-runtime',
    accountId: 'account-1',
    displayName: 'Opaque generic webhook handle',
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function owner(overrides: Partial<ConnectorRuntimeCredentialSessionOwnerFact> = {}): ConnectorRuntimeCredentialSessionOwnerFact {
  return {
    ownerKind: 'runtime-action-owner',
    ownerId: 'operator-reviewed-owner-1',
    runId: 'runtime-run-1',
    reviewState: 'reviewed',
    actionFamily: 'provider-test',
    actionId: 'generic-webhook.manual-test',
    targetSurface: 'provider-catalog',
    providerId: 'generic-webhook',
    connectorId: 'generic-webhook-runtime',
    accountId: 'account-1',
    issuedAt: 1_700_000_000_000,
    reviewedAt: 1_700_000_000_100,
    expiresAt: 1_800_000_000_000,
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

  throw new TypeError('Trusted credential session fixtures cannot include executable values.');
}

function trustedObject(value: Record<string, unknown>): RuntimeTrustedContractObject {
  const entries = Object.entries(value).map(([key, entryValue]) => [
    key,
    trustedValue(entryValue),
  ] as RuntimeTrustedContractEntry);
  return createRuntimeTrustedContractObject(entries);
}

function validInput(overrides: Record<string, unknown> = {}): Parameters<typeof planConnectorRuntimeCredentialSession>[0] {
  return trustedObject({
    store: store(),
    handle: handle(),
    actionFamily: 'provider-test',
    actionId: 'generic-webhook.manual-test',
    targetSurface: 'provider-catalog',
    providerId: 'generic-webhook',
    connectorId: 'generic-webhook-runtime',
    accountId: 'account-1',
    runtimeOwner: owner(),
    now: 1_700_000_000_200,
    ...overrides,
  }) as unknown as Parameters<typeof planConnectorRuntimeCredentialSession>[0];
}

function blockerCodes(input: Parameters<typeof planConnectorRuntimeCredentialSession>[0]) {
  return planConnectorRuntimeCredentialSession(input).blockers.map((blocker) => blocker.code);
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe('connector runtime credential session planner', () => {
  it('requires a trusted root before planning with the credential store contract', () => {
    const untrusted = {
      store: store(),
      handle: handle(),
      actionFamily: 'provider-test',
      actionId: 'generic-webhook.manual-test',
      targetSurface: 'provider-catalog',
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
      runtimeOwner: owner(),
      now: 1_700_000_000_200,
    };

    const decision = planConnectorRuntimeCredentialSession(untrusted);

    expect(decision.status).toBe('blocked');
    expect(decision.mayUseCredentialHandle).toBe(false);
    expect(decision.mayResolveCredentialSecret).toBe(false);
    expect(decision.mayStoreCredentialSecret).toBe(false);
    expect(decision.descriptor).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual([
      'runtime_input_untrusted',
    ]);
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
  });

  it('creates an immutable safe runtime credential session descriptor for reviewed owner and opaque handle metadata', () => {
    const decision = planConnectorRuntimeCredentialSession(validInput());

    expect(decision.status).toBe('session-ready');
    expect(decision.mayUseCredentialHandle).toBe(true);
    expect(decision.mayResolveCredentialSecret).toBe(false);
    expect(decision.mayStoreCredentialSecret).toBe(false);
    expect(decision.sideEffectBoundary).toBe('plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-api-no-secret-resolution');
    expect(decision.blockers).toEqual([]);
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.descriptor)).toBe(true);
    expect(Object.isFrozen(decision.descriptor?.credentialHandle)).toBe(true);
    expect(Object.isFrozen(decision.descriptor?.runtimeOwner)).toBe(true);

    expect(decision.descriptor).toEqual({
      schemaVersion: 1,
      sessionKind: 'runtime-credential-handle-session',
      credentialHandle: handle(),
      runtimeOwner: {
        ownerKind: 'runtime-action-owner',
        ownerId: 'operator-reviewed-owner-1',
        runId: 'runtime-run-1',
        reviewState: 'reviewed',
        issuedAt: 1_700_000_000_000,
        reviewedAt: 1_700_000_000_100,
        expiresAt: 1_800_000_000_000,
      },
      action: {
        actionFamily: 'provider-test',
        actionId: 'generic-webhook.manual-test',
        targetSurface: 'provider-catalog',
      },
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
      executable: false,
      sideEffects: 'none',
      storageDirective: 'do-not-store-or-resolve-secret-material',
    });
  });

  it('composes the credential store planner and exposes missing, unreviewed, browser-storage, provider-call, and opaque-handle blockers', () => {
    expect(blockerCodes(validInput({ store: undefined }))).toEqual(expect.arrayContaining(['store_capability_missing']));
    expect(blockerCodes(validInput({ store: store({ reviewState: 'unreviewed' }) }))).toEqual(expect.arrayContaining(['store_not_reviewed']));
    expect(blockerCodes(validInput({ store: store({ supportsOpaqueHandle: false }) }))).toEqual(expect.arrayContaining(['opaque_handle_unsupported']));

    const unsafeStore = {
      ...store(),
      usesBrowserSecretStorage: true,
      persistsRawSecretMaterial: true,
      callsProviderApis: true,
    };

    expect(blockerCodes(validInput({
      store: unsafeStore as unknown as ConnectorCredentialStoreCapability,
    }))).toEqual(expect.arrayContaining([
      'store_capability_invalid',
      'browser_secret_storage_requested',
      'raw_secret_persistence_requested',
      'provider_api_call_requested',
    ]));
  });

  it('blocks handle/store/provider/connector/account mismatch before returning a descriptor', () => {
    const decision = planConnectorRuntimeCredentialSession(validInput({
      handle: handle({
        kind: 'local-bridge',
        storageOwner: 'local-bridge',
        providerId: 'slack',
        connectorId: 'slack-runtime',
        accountId: 'account-2',
      }),
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.mayUseCredentialHandle).toBe(false);
    expect(decision.mayResolveCredentialSecret).toBe(false);
    expect(decision.mayStoreCredentialSecret).toBe(false);
    expect(decision.descriptor).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'handle_kind_mismatch',
      'handle_storage_owner_mismatch',
      'handle_provider_mismatch',
      'handle_connector_mismatch',
      'handle_account_mismatch',
    ]));
  });

  it('requires an explicit reviewed runtime owner id or run id', () => {
    expect(blockerCodes(validInput({ runtimeOwner: undefined }))).toEqual(expect.arrayContaining(['runtime_owner_missing']));
    expect(blockerCodes(validInput({
      runtimeOwner: owner({ ownerId: undefined, runId: undefined }),
    }))).toEqual(expect.arrayContaining(['runtime_owner_missing_explicit_id']));
    expect(blockerCodes(validInput({
      runtimeOwner: { ...owner(), ownerKind: 'other-owner' } as unknown as ConnectorRuntimeCredentialSessionOwnerFact,
    }))).toEqual(expect.arrayContaining(['runtime_owner_invalid']));
    expect(blockerCodes(validInput({
      runtimeOwner: owner({ reviewState: 'draft' }),
    }))).toEqual(expect.arrayContaining(['runtime_owner_not_reviewed']));
  });

  it('blocks runtime owner provider, connector, account, action, and target mismatches', () => {
    const decision = planConnectorRuntimeCredentialSession(validInput({
      runtimeOwner: owner({
        providerId: 'slack',
        connectorId: 'slack-runtime',
        accountId: 'account-2',
        actionFamily: 'webhook-execution',
        actionId: 'slack.post-message',
        targetSurface: 'assistantcaddy-route',
      }),
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'runtime_owner_provider_mismatch',
      'runtime_owner_connector_mismatch',
      'runtime_owner_account_mismatch',
      'runtime_owner_action_mismatch',
      'runtime_owner_target_mismatch',
    ]));
  });

  it('rejects runtime callback, requester, fetch, socket, storage, executable, and resolver poisoning without invocation', () => {
    const callback = vi.fn();
    const requester = vi.fn();
    const socket = vi.fn();

    for (const poisonedInput of [
      validInput({
        callback: 'forbidden-callback-placeholder',
      }),
      validInput({
        requester: 'forbidden-requester-placeholder',
      }),
      validInput({
        fetch: 'forbidden-fetch-placeholder',
      }),
      validInput({
        socket: 'forbidden-socket-placeholder',
      }),
      validInput({
        storageAdapter: { boundary: 'forbidden-storage-adapter' },
      }),
      validInput({
        executable: true,
      }),
      validInput({
        secretResolver: 'forbidden-secret-resolver-placeholder',
      }),
      validInput({
        runtimeOwner: {
          ...owner(),
          liveAction: 'forbidden-live-action-placeholder',
        } as unknown as ConnectorRuntimeCredentialSessionOwnerFact,
      }),
    ]) {
      expect(blockerCodes(poisonedInput)).toEqual(expect.arrayContaining(['runtime_shape_forbidden']));
    }

    expect(callback).not.toHaveBeenCalled();
    expect(requester).not.toHaveBeenCalled();
    expect(socket).not.toHaveBeenCalled();
  });

  it('rejects untrusted proxy and accessor roots before traps or getters execute', () => {
    const getter = vi.fn(() => store());
    const accessorRoot: Record<string, unknown> = {};
    Object.defineProperty(accessorRoot, 'store', {
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
      store: store(),
      handle: handle(),
    }, traps);

    expect(planConnectorRuntimeCredentialSession(accessorRoot)
      .blockers.map((blocker) => blocker.code)).toEqual(['runtime_input_untrusted']);
    expect(planConnectorRuntimeCredentialSession(proxyRoot)
      .blockers.map((blocker) => blocker.code)).toEqual(['runtime_input_untrusted']);
    expect(getter).not.toHaveBeenCalled();
    expect(traps.get).not.toHaveBeenCalled();
    expect(traps.ownKeys).not.toHaveBeenCalled();
    expect(traps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(traps.getPrototypeOf).not.toHaveBeenCalled();
  });

  it('blocks missing action ownership facts from the request', () => {
    const decision = planConnectorRuntimeCredentialSession(validInput({
      actionFamily: undefined,
      actionId: undefined,
      targetSurface: undefined,
      providerId: undefined,
      connectorId: undefined,
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'action_family_missing',
      'action_id_missing',
      'target_surface_missing',
      'provider_missing',
      'connector_missing',
    ]));
  });

  it('blocks stale, revoked, and expired runtime owner facts', () => {
    expect(blockerCodes(validInput({
      runtimeOwner: owner({ reviewState: 'stale' }),
    }))).toEqual(expect.arrayContaining(['runtime_owner_stale']));
    expect(blockerCodes(validInput({
      runtimeOwner: owner({ stale: true }),
    }))).toEqual(expect.arrayContaining(['runtime_owner_stale']));
    expect(blockerCodes(validInput({
      runtimeOwner: owner({ reviewState: 'revoked' }),
    }))).toEqual(expect.arrayContaining(['runtime_owner_revoked']));
    expect(blockerCodes(validInput({
      runtimeOwner: owner({ revokedAt: 1_700_000_000_100 }),
    }))).toEqual(expect.arrayContaining(['runtime_owner_revoked']));
    expect(blockerCodes(validInput({
      runtimeOwner: owner({ reviewState: 'expired' }),
    }))).toEqual(expect.arrayContaining(['runtime_owner_expired']));
    expect(blockerCodes(validInput({
      runtimeOwner: owner({ expiresAt: 1_700_000_000_100 }),
    }))).toEqual(expect.arrayContaining(['runtime_owner_expired']));
  });

  it('rejects raw secret material and secret-like owner values without echoing them', () => {
    const secretInput = validInput({
      handle: {
        ...handle(),
        accessToken: 'sk-thisshouldneverecho',
      },
      runtimeOwner: owner({
        ownerId: 'Bearer should-not-echo-token',
      }),
    });

    const decision = planConnectorRuntimeCredentialSession(secretInput);

    expect(decision.status).toBe('blocked');
    expect(decision.descriptor).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'raw_secret_material',
      'handle_invalid',
      'runtime_owner_secret_material',
    ]));
    expect(serialized(decision)).not.toContain('sk-thisshouldneverecho');
    expect(serialized(decision)).not.toContain('should-not-echo-token');
  });

  it('rejects URL-shaped identifiers and raw-secret session-owner drift without echoing unsafe values', () => {
    const decision = planConnectorRuntimeCredentialSession(validInput({
      providerId: 'https://provider.example.test/oauth',
      runtimeOwner: owner({
        ownerId: 'owner-1',
        providerId: 'Bearer do-not-echo-provider-token',
      }),
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.descriptor).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'runtime_owner_identifier_invalid',
      'runtime_owner_secret_material',
    ]));
    expect(serialized(decision)).not.toContain('provider.example.test');
    expect(serialized(decision)).not.toContain('do-not-echo-provider-token');

    for (const unsafeIdentifier of [
      'ftp://example.invalid/path',
      'localhost:4000/path',
      '127.0.0.1:4000/path',
      'example.invalid/provider/path',
      'mailto:user@example.test',
      'urn:provider:opaque',
    ]) {
      const unsafeDecision = planConnectorRuntimeCredentialSession(validInput({
        actionId: unsafeIdentifier,
        runtimeOwner: owner({
          actionId: unsafeIdentifier,
        }),
      }));
      const unsafeSerialized = serialized(unsafeDecision);

      expect(unsafeDecision.status).toBe('blocked');
      expect(unsafeDecision.descriptor).toBeUndefined();
      expect(unsafeDecision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
        'runtime_owner_identifier_invalid',
        'runtime_owner_secret_material',
      ]));
      expect(unsafeSerialized).not.toContain(unsafeIdentifier);
      expect(unsafeSerialized).not.toContain('example.invalid');
      expect(unsafeSerialized).not.toContain('localhost');
      expect(unsafeSerialized).not.toContain('urn:provider');
    }
  });

  it('performs no fetch, browser storage, IndexedDB, or provider side effects while planning', () => {
    const fetchSpy = vi.fn();
    const indexedDbSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('indexedDB', indexedDbSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    planConnectorRuntimeCredentialSession(validInput());
    planConnectorRuntimeCredentialSession(validInput({
      store: store({ reviewState: 'draft' }),
      runtimeOwner: owner({ reviewState: 'draft' }),
    }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(indexedDbSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
