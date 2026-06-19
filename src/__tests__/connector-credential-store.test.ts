import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  planConnectorCredentialStoreHandleReference,
  type ConnectorCredentialStoreCapability,
} from '../lib/connector-credential-store';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
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
    displayName: 'Opaque external secret-store handle',
    createdAt: 1_700_000_000_000,
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

  throw new TypeError('Trusted credential fixtures cannot include executable values.');
}

function trustedObject(value: Record<string, unknown>): RuntimeTrustedContractObject {
  const entries = Object.entries(value).map(([key, entryValue]) => [
    key,
    trustedValue(entryValue),
  ] as RuntimeTrustedContractEntry);
  return createRuntimeTrustedContractObject(entries);
}

function trustedPlannerInput(
  input: Record<string, unknown>,
): Parameters<typeof planConnectorCredentialStoreHandleReference>[0] {
  return trustedObject(input) as unknown as Parameters<typeof planConnectorCredentialStoreHandleReference>[0];
}

function planTrusted(input: Record<string, unknown>) {
  return planConnectorCredentialStoreHandleReference(trustedPlannerInput(input));
}

function blockerCodes(input: Record<string, unknown>) {
  return planTrusted(input).blockers.map((blocker) => blocker.code);
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe('connector credential store handle planner', () => {
  it('allows a reviewed external opaque handle reference without persisting secrets', () => {
    const decision = planTrusted({
      store: store(),
      handle: handle(),
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    });

    expect(decision).toEqual({
      status: 'reference-ready',
      mayReferenceHandle: true,
      mayStoreSecretMaterial: false,
      mayResolveSecretMaterial: false,
      executableCredentialStorage: false,
      executableCredentialResolution: false,
      feasibilityDirective: 'opaque-handle-reference-only-no-secret-storage-or-resolution',
      handleReference: handle(),
      storageDirective: 'do-not-persist-secret-material',
      resolutionDirective: 'do-not-resolve-secret-material',
      sideEffectBoundary: 'plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-api-no-secret-resolution-no-secret-persistence',
      blockers: [],
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.handleReference)).toBe(true);
  });

  it('supports reviewed provider-managed OAuth handles without making provider calls', () => {
    const decision = planTrusted({
      store: store({
        kind: 'provider-managed-oauth',
        storageOwner: 'external-provider',
        providerId: 'gmail-google',
        connectorId: 'gmail-runtime',
      }),
      handle: handle({
        kind: 'provider-managed-oauth',
        storageOwner: 'external-provider',
        id: 'provider-oauth:gmail-google/account-1',
        providerId: 'gmail-google',
        connectorId: 'gmail-runtime',
      }),
      providerId: 'gmail-google',
      connectorId: 'gmail-runtime',
    });

    expect(decision.status).toBe('reference-ready');
    expect(decision.mayReferenceHandle).toBe(true);
    expect(decision.mayStoreSecretMaterial).toBe(false);
    expect(decision.mayResolveSecretMaterial).toBe(false);
    expect(decision.executableCredentialStorage).toBe(false);
    expect(decision.executableCredentialResolution).toBe(false);
    expect(decision.sideEffectBoundary).toContain('no-provider-api');
  });

  it('supports reviewed local-bridge opaque handles without storage adapter calls', () => {
    const decision = planTrusted({
      store: store({
        kind: 'local-bridge',
        storageOwner: 'local-bridge',
        providerId: 'local-llm',
        connectorId: 'local-bridge-llm',
      }),
      handle: handle({
        kind: 'local-bridge',
        storageOwner: 'local-bridge',
        id: 'local-bridge:assistantcaddy/llm',
        providerId: 'local-llm',
        connectorId: 'local-bridge-llm',
      }),
      providerId: 'local-llm',
      connectorId: 'local-bridge-llm',
    });

    expect(decision.status).toBe('reference-ready');
    expect(decision.mayReferenceHandle).toBe(true);
    expect(decision.mayStoreSecretMaterial).toBe(false);
    expect(decision.mayResolveSecretMaterial).toBe(false);
    expect(decision.handleReference?.id).toBe('local-bridge:assistantcaddy/llm');
  });

  it('rejects credential-handle prefixes in generic store and caller identifiers', () => {
    const decision = planTrusted({
      store: store({
        providerId: 'provider-oauth:gmail-google',
        connectorId: 'vault:path/to/connector',
      }),
      handle: handle(),
      providerId: 'local-bridge:provider',
      connectorId: 'https://example.test/runtime',
      accountId: 'provider-oauth:account-1',
    });

    expect(decision.status).toBe('blocked');
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'store_capability_field_invalid',
      'store_capability_invalid',
      'input_field_invalid',
    ]));
    expect(serialized(decision)).not.toContain('provider-oauth:gmail-google');
    expect(serialized(decision)).not.toContain('vault:path/to/connector');
    expect(serialized(decision)).not.toContain('local-bridge:provider');
    expect(serialized(decision)).not.toContain('https://example.test/runtime');
  });


  it('keeps executable credential storage test doubles untrusted and non-invoked', () => {
    const storageAdapter = vi.fn();
    const resolver = vi.fn();
    const decision = planConnectorCredentialStoreHandleReference({
      store: store(),
      handle: handle(),
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
      storageAdapter,
      credentialResolver: resolver,
      executableCredentialStorage: true,
      executableCredentialResolution: true,
    } as unknown as Parameters<typeof planConnectorCredentialStoreHandleReference>[0]);

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.mayStoreSecretMaterial).toBe(false);
    expect(decision.mayResolveSecretMaterial).toBe(false);
    expect(decision.executableCredentialStorage).toBe(false);
    expect(decision.executableCredentialResolution).toBe(false);
    expect(decision.feasibilityDirective).toBe('opaque-handle-reference-only-no-secret-storage-or-resolution');
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'input_invalid',
    ]));
    expect(storageAdapter).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
  });

  it('fails closed for unsupported planner and store keys without invoking live fields', () => {
    const decision = planTrusted({
      store: {
        ...store(),
        providerId: { nested: 'generic-webhook' },
        storageAdapter: { boundary: 'blocked-storage-adapter' },
      },
      handle: handle(),
      providerId: 'refresh-token-reference',
      connectorId: 'generic-webhook-runtime',
      accountId: { id: 'account-1' },
      fetch: 'blocked-fetch-field',
      indexedDB: {},
    });

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'input_unsupported_field',
      'input_field_invalid',
      'store_capability_unsupported_field',
      'store_capability_field_invalid',
      'store_capability_invalid',
      'browser_secret_storage_requested',
      'provider_api_call_requested',
    ]));
    expect(serialized(decision)).not.toContain('refresh-token-reference');
  });

  it('checks root exact keys before raw-secret scanning while staying plan-only', () => {
    const decision = planTrusted({
      store: store(),
      handle: handle(),
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
      requester: 'Bearer do-not-echo-root-requester-token',
    });
    const codes = decision.blockers.map((blocker) => blocker.code);

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(codes).toEqual(expect.arrayContaining([
      'input_unsupported_field',
      'provider_api_call_requested',
      'raw_secret_material',
    ]));
    expect(codes.indexOf('input_unsupported_field')).toBeLessThan(codes.indexOf('raw_secret_material'));
    expect(serialized(decision)).not.toContain('do-not-echo-root-requester-token');
  });

  it('classifies browser storage and provider API fields embedded in a handle candidate', () => {
    const decision = planTrusted({
      store: store(),
      handle: {
        ...handle(),
        localStorage: { storage: 'blocked-local-storage' },
        providerApiClient: { request: 'blocked-provider-request' },
      },
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    });

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'browser_secret_storage_requested',
      'provider_api_call_requested',
      'handle_invalid',
    ]));
    expect(serialized(decision)).not.toContain('localStorage');
    expect(serialized(decision)).not.toContain('providerApiClient');
  });

  it('classifies generic storage and schema-writer fields without invoking them', () => {
    const decision = planTrusted({
      store: {
        ...store(),
        schemaWriter: 'blocked-schema-writer',
      },
      handle: {
        ...handle(),
        storage: { marker: 'blocked-storage' },
        dexie: { marker: 'blocked-dexie' },
      },
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
      storage: { marker: 'blocked-root-storage' },
      schemaWriter: 'blocked-root-schema-writer',
    });

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'browser_secret_storage_requested',
      'schema_writer_requested',
      'input_unsupported_field',
      'store_capability_unsupported_field',
      'handle_invalid',
    ]));
    expect(serialized(decision)).not.toContain('schemaWriter');
  });

  it('rejects webhook URL-shaped handle ids and explicit live-action handle fields', () => {
    const decision = planTrusted({
      store: store(),
      handle: {
        ...handle({
          id: 'https://hooks.slack.com/services/T000/B000/do-not-store',
        }),
        liveAction: 'blocked-live-action',
        webhookUrl: 'https://hooks.slack.com/services/T000/B000/do-not-store',
        send: 'blocked-send',
      },
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    });
    const output = serialized(decision);

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'raw_secret_material',
      'handle_invalid',
      'provider_api_call_requested',
    ]));
    expect(output).not.toContain('hooks.slack.com');
    expect(output).not.toContain('do-not-store');
  });

  it.each([
    ['wss protocol URL', 'wss://socket.example.test/provider-secret-reference'],
    ['schemeless host path', '//hooks.example.test/path/do-not-store'],
    ['host/path webhook shape', 'hooks.example.test/webhook/do-not-store'],
    ['webhook-like host path', 'hooks.slack.com/services/T000/B000/do-not-store'],
    ['IPv4 host path', '10.0.0.1/path/do-not-store'],
    ['loopback host path with port', '127.0.0.1:11434/v1/do-not-store'],
    ['localhost host path with port', 'localhost:11434/v1/do-not-store'],
    ['IPv6 literal host path with port', '[::1]:11434/v1/do-not-store'],
    ['non-http scheme URL', 's3://connector-secret-bucket/reference'],
    ['mailto scheme identifier', 'mailto:user@example.test'],
    ['urn scheme identifier', 'urn:provider:opaque'],
  ])('rejects local URL-like handle ids: %s', (_label, id) => {
    const decision = planTrusted({
      store: store(),
      handle: handle({ id }),
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    });

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'raw_secret_material',
      'handle_invalid',
    ]));
    expect(serialized(decision)).not.toContain(id);
  });

  it('fails closed for accessor-poisoned planner input without executing getters or storage/API side effects', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const providerGetter = vi.fn(() => {
      fetchSpy('https://example.invalid/provider-probe');
      return 'generic-webhook';
    });
    const storeGetter = vi.fn(() => {
      window.localStorage.setItem('credential-store', '[fixture secret-like value]');
      return false;
    });
    const poisonedStore: Record<string, unknown> = { ...store() };
    Object.defineProperty(poisonedStore, 'callsProviderApis', {
      enumerable: true,
      get: storeGetter,
    });
    const poisonedInput: Record<string, unknown> = {
      store: poisonedStore,
      handle: handle(),
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    };
    Object.defineProperty(poisonedInput, 'providerId', {
      enumerable: true,
      get: providerGetter,
    });

    const decision = planConnectorCredentialStoreHandleReference(
      poisonedInput as Parameters<typeof planConnectorCredentialStoreHandleReference>[0],
    );

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'input_invalid',
    ]));
    expect(providerGetter).not.toHaveBeenCalled();
    expect(storeGetter).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(serialized(decision)).not.toContain('provider-probe');
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
      store: store(),
      handle: handle(),
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    }, traps);

    const decision = planConnectorCredentialStoreHandleReference(
      proxiedInput as unknown as Parameters<typeof planConnectorCredentialStoreHandleReference>[0],
    );

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'input_invalid',
    ]));
    expect(traps.get).not.toHaveBeenCalled();
    expect(traps.ownKeys).not.toHaveBeenCalled();
    expect(traps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(traps.getPrototypeOf).not.toHaveBeenCalled();
  });

  it('fails closed for proxied nested store and handle candidates without invoking traps or getter bodies', () => {
    const handleGetter = vi.fn(() => 'vault:path/to/threatcaddy/generic-webhook/account-1');
    const storeTarget: Record<string, unknown> = { ...store() };
    const handleTarget: Record<string, unknown> = { ...handle() };
    Object.defineProperty(handleTarget, 'id', {
      enumerable: true,
      get: handleGetter,
    });
    const storeTraps = {
      get: vi.fn((proxyTarget: Record<string, unknown>, property: string | symbol, receiver: unknown) => (
        Reflect.get(proxyTarget, property, receiver)
      )),
      ownKeys: vi.fn((proxyTarget: Record<string, unknown>) => Reflect.ownKeys(proxyTarget)),
      getOwnPropertyDescriptor: vi.fn((proxyTarget: Record<string, unknown>, property: string | symbol) => (
        Reflect.getOwnPropertyDescriptor(proxyTarget, property)
      )),
      getPrototypeOf: vi.fn((proxyTarget: Record<string, unknown>) => Reflect.getPrototypeOf(proxyTarget)),
    };
    const handleTraps = {
      get: vi.fn((proxyTarget: Record<string, unknown>, property: string | symbol, receiver: unknown) => (
        Reflect.get(proxyTarget, property, receiver)
      )),
      ownKeys: vi.fn((proxyTarget: Record<string, unknown>) => Reflect.ownKeys(proxyTarget)),
      getOwnPropertyDescriptor: vi.fn((proxyTarget: Record<string, unknown>, property: string | symbol) => (
        Reflect.getOwnPropertyDescriptor(proxyTarget, property)
      )),
      getPrototypeOf: vi.fn((proxyTarget: Record<string, unknown>) => Reflect.getPrototypeOf(proxyTarget)),
    };
    const proxiedStore = new Proxy(storeTarget, storeTraps);
    const proxiedHandle = new Proxy(handleTarget, handleTraps);

    const decision = planConnectorCredentialStoreHandleReference({
      store: proxiedStore,
      handle: proxiedHandle,
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    } as unknown as Parameters<typeof planConnectorCredentialStoreHandleReference>[0]);

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'input_invalid',
    ]));
    expect(handleGetter).not.toHaveBeenCalled();
    expect(storeTraps.get).not.toHaveBeenCalled();
    expect(storeTraps.ownKeys).not.toHaveBeenCalled();
    expect(storeTraps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(storeTraps.getPrototypeOf).not.toHaveBeenCalled();
    expect(handleTraps.get).not.toHaveBeenCalled();
    expect(handleTraps.ownKeys).not.toHaveBeenCalled();
    expect(handleTraps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(handleTraps.getPrototypeOf).not.toHaveBeenCalled();
  });

  it('rejects invalid store enum values before trusting self-consistent capability metadata', () => {
    const decision = planTrusted({
      store: {
        ...store(),
        kind: 'browser-local-storage',
        reviewState: 'approved',
      } as unknown as ConnectorCredentialStoreCapability,
      handle: handle(),
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    });

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'store_capability_field_invalid',
      'store_capability_invalid',
    ]));
  });

  it('fails closed when store capability is missing, unreviewed, or cannot reference opaque handles', () => {
    expect(blockerCodes({ handle: handle() })).toEqual(expect.arrayContaining(['store_capability_missing']));
    expect(blockerCodes({
      store: store({ reviewState: 'draft' }),
      handle: handle(),
    })).toEqual(expect.arrayContaining(['store_not_reviewed']));
    expect(blockerCodes({
      store: store({ supportsOpaqueHandle: false }),
      handle: handle(),
    })).toEqual(expect.arrayContaining(['opaque_handle_unsupported']));
  });

  it('blocks browser secret storage, raw secret persistence, and provider API capability claims', () => {
    const unsafeStore = {
      ...store(),
      usesBrowserSecretStorage: true,
      persistsRawSecretMaterial: true,
      callsProviderApis: true,
    };

    expect(blockerCodes({
      store: unsafeStore as unknown as ConnectorCredentialStoreCapability,
      handle: handle(),
    })).toEqual(expect.arrayContaining([
      'store_capability_invalid',
      'browser_secret_storage_requested',
      'raw_secret_persistence_requested',
      'provider_api_call_requested',
    ]));
  });

  it('rejects raw secret-like material anywhere in the planner input', () => {
    const decision = planTrusted({
      store: store(),
      handle: {
        ...handle(),
        accessToken: '[fixture secret-like value]',
      },
    });

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'raw_secret_material',
      'handle_invalid',
    ]));
  });

  it('does not echo unsupported secret-like handle field names in blockers', () => {
    const secretLikeFieldName = 'refreshTokenIdentifier';
    const decision = planTrusted({
      store: store(),
      handle: {
        ...handle(),
        [secretLikeFieldName]: '[fixture secret-like value]',
      },
    });

    expect(decision.status).toBe('blocked');
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'raw_secret_material',
      'handle_invalid',
    ]));
    expect(serialized(decision)).not.toContain(secretLikeFieldName);
  });

  it('fails closed on handle/store/request ownership mismatches', () => {
    const decision = planTrusted({
      store: store({ providerId: 'generic-webhook', connectorId: 'generic-webhook-runtime' }),
      handle: handle({
        kind: 'local-bridge',
        storageOwner: 'local-bridge',
        providerId: 'slack',
        connectorId: 'slack-runtime',
        accountId: 'account-2',
      }),
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    });

    expect(decision.status).toBe('blocked');
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'handle_kind_mismatch',
      'handle_storage_owner_mismatch',
      'handle_provider_mismatch',
      'handle_connector_mismatch',
      'handle_account_mismatch',
    ]));
  });

  it('blocks missing handle providerId when the store or caller expects a provider', () => {
    const decision = planTrusted({
      store: store({ providerId: 'generic-webhook' }),
      handle: handle({ providerId: undefined }),
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    });

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'handle_provider_mismatch',
    ]));
  });

  it('blocks missing handle connectorId when the store or caller expects a connector', () => {
    const decision = planTrusted({
      store: store({ connectorId: 'generic-webhook-runtime' }),
      handle: handle({ connectorId: undefined }),
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    });

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'handle_connector_mismatch',
    ]));
  });

  it('blocks missing handle accountId when the caller expects an account', () => {
    const decision = planTrusted({
      store: store(),
      handle: handle({ accountId: undefined }),
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    });

    expect(decision.status).toBe('blocked');
    expect(decision.mayReferenceHandle).toBe(false);
    expect(decision.handleReference).toBeUndefined();
    expect(decision.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'handle_account_mismatch',
    ]));
  });

  it('performs no fetch, browser storage, or IndexedDB side effects while planning', () => {
    const fetchSpy = vi.fn();
    const indexedDbSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('indexedDB', indexedDbSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    planTrusted({
      store: store(),
      handle: handle(),
      providerId: 'generic-webhook',
      connectorId: 'generic-webhook-runtime',
      accountId: 'account-1',
    });
    planTrusted({
      store: store({ reviewState: 'draft' }),
      handle: {
        ...handle(),
        password: '[fixture secret-like value]',
      },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(indexedDbSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
