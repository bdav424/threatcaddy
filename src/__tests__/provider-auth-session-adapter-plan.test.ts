import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProviderAuthSessionAdapterPlan as createProviderAuthSessionAdapterPlanRaw,
  type ProviderAuthSessionAdapterAction,
  type ProviderAuthSessionAdapterCapabilities,
  type ProviderAuthSessionAdapterExplicitConsent,
  type ProviderAuthSessionCallbackMetadata,
  type ProviderAuthSessionHandleReference,
  type ProviderAuthSessionSurface,
} from '../lib/provider-auth-session-adapter-plan';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

const NOW = 1_800_000_000_000;

function trustedFixtureValue(value: unknown): RuntimeTrustedContractValue {
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map((item) => trustedFixtureValue(item)));
  if (typeof value === 'object') {
    return createRuntimeTrustedContractObject(Object.entries(value as Record<string, unknown>).map(([key, nested]) => (
      [key, trustedFixtureValue(nested)] satisfies RuntimeTrustedContractEntry
    )));
  }
  throw new TypeError('Unsupported provider auth trusted fixture value.');
}

function trustedProviderAuthPlanInput(value: Record<string, unknown>): Parameters<typeof createProviderAuthSessionAdapterPlanRaw>[0] {
  return trustedFixtureValue(value) as unknown as Parameters<typeof createProviderAuthSessionAdapterPlanRaw>[0];
}

function createProviderAuthSessionAdapterPlan(value: Record<string, unknown>) {
  return createProviderAuthSessionAdapterPlanRaw(trustedProviderAuthPlanInput(value));
}

function capabilities(
  providerId = 'google-gmail',
  surface: ProviderAuthSessionSurface = 'emailcaddy',
  overrides: Partial<ProviderAuthSessionAdapterCapabilities> = {},
): ProviderAuthSessionAdapterCapabilities {
  return {
    schemaVersion: 1,
    providerId,
    surface,
    supportsStartOAuth: true,
    supportsCompleteOAuth: true,
    supportsRefreshSession: true,
    supportsRevokeSession: true,
    supportsProviderAuthTest: true,
    executable: false,
    sideEffects: 'none',
    opensWindow: false,
    browserRedirects: false,
    ...overrides,
  };
}

function consent(
  action: ProviderAuthSessionAdapterAction,
  providerId = 'google-gmail',
  surface: ProviderAuthSessionSurface = 'emailcaddy',
  overrides: Partial<ProviderAuthSessionAdapterExplicitConsent> = {},
): ProviderAuthSessionAdapterExplicitConsent {
  return {
    schemaVersion: 1,
    action,
    surface,
    providerId,
    accountId: 'analyst@example.test',
    granted: true,
    reviewed: true,
    issuedAt: NOW - 1_000,
    expiresAt: NOW + 60_000,
    ...overrides,
  };
}

function callback(
  providerId = 'google-gmail',
  surface: ProviderAuthSessionSurface = 'emailcaddy',
  overrides: Partial<ProviderAuthSessionCallbackMetadata> = {},
): ProviderAuthSessionCallbackMetadata {
  return {
    schemaVersion: 1,
    surface,
    providerId,
    accountId: 'analyst@example.test',
    callbackKind: 'redirect-origin',
    origin: 'https://threatcaddy.example.test',
    path: '/oauth/callback',
    reviewed: true,
    reviewedAt: NOW - 1_000,
    expiresAt: NOW + 60_000,
    ...overrides,
  };
}

function credential(
  providerId = 'google-gmail',
  overrides: Partial<ConnectorCredentialReference> = {},
): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'provider-managed-oauth',
    id: `provider-oauth:${providerId}/oauth-reference`,
    storageOwner: 'external-provider',
    providerId,
    connectorId: 'provider-auth-session-adapter',
    accountId: 'analyst@example.test',
    displayName: 'Provider OAuth reference',
    createdAt: NOW - 2_000,
    ...overrides,
  };
}

function session(
  providerId = 'google-gmail',
  surface: ProviderAuthSessionSurface = 'emailcaddy',
  overrides: Partial<ProviderAuthSessionHandleReference> = {},
): ProviderAuthSessionHandleReference {
  return {
    schemaVersion: 1,
    id: `${providerId}-session-reference`,
    providerId,
    surface,
    accountId: 'analyst@example.test',
    credentialReferenceId: `provider-oauth:${providerId}/oauth-reference`,
    createdAt: NOW - 2_000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('provider auth session adapter plan', () => {
  it('returns a safe inert start OAuth plan when ownership, callback metadata, capabilities, and consent match', () => {
    const decision = createProviderAuthSessionAdapterPlan({
      action: 'start_oauth',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      accountId: 'analyst@example.test',
      adapterCapabilities: capabilities(),
      explicitConsent: consent('start_oauth'),
      callbackMetadata: callback(),
      now: NOW,
    });

    expect(decision).toEqual({
      status: 'allow',
      action: 'start_oauth',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      accountId: 'analyst@example.test',
      executable: false,
      sideEffects: 'none',
      allowReason: 'inert_start_oauth_plan_ready',
      blockReasons: [],
      callbackMetadata: callback(),
      adapterCapabilities: capabilities(),
      sideEffectBoundary: 'pure-local-provider-auth-session-plan-no-fetch-no-storage-no-oauth-no-session-mutation-no-window-open',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockReasons)).toBe(true);
    expect(Object.isFrozen(decision.callbackMetadata)).toBe(true);
  });

  it('blocks provider and surface mismatches across adapter, consent, callback, credential, and session facts', () => {
    const decision = createProviderAuthSessionAdapterPlan({
      action: 'refresh_session',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      accountId: 'analyst@example.test',
      adapterCapabilities: capabilities('microsoft-outlook', 'assistantcaddy'),
      explicitConsent: consent('refresh_session', 'microsoft-outlook', 'assistantcaddy'),
      credentialReference: credential('microsoft-outlook'),
      sessionHandleReference: session('microsoft-outlook', 'assistantcaddy'),
      now: NOW,
    });

    expect(decision).toMatchObject({
      status: 'block',
      executable: false,
      sideEffects: 'none',
      providerId: 'google-gmail',
      surface: 'emailcaddy',
      blockReasons: expect.arrayContaining([
        'adapter_provider_mismatch',
        'adapter_surface_mismatch',
        'explicit_consent_mismatch',
        'credential_provider_mismatch',
        'session_provider_mismatch',
      ]),
    });
  });

  it('requires reviewed explicit consent for future provider auth side-effect actions', () => {
    expect(createProviderAuthSessionAdapterPlan({
      action: 'test_provider_auth',
      surface: 'assistantcaddy',
      providerId: 'openai',
      adapterCapabilities: capabilities('openai', 'assistantcaddy'),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['missing_explicit_consent']),
    });

    expect(createProviderAuthSessionAdapterPlan({
      action: 'test_provider_auth',
      surface: 'assistantcaddy',
      providerId: 'openai',
      adapterCapabilities: capabilities('openai', 'assistantcaddy'),
      explicitConsent: consent('test_provider_auth', 'openai', 'assistantcaddy', {
        accountId: undefined,
        reviewed: false,
        granted: false,
        expiresAt: NOW - 1,
      }),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining([
        'explicit_consent_not_reviewed',
        'explicit_consent_not_granted',
        'explicit_consent_expired',
      ]),
    });
  });

  it('blocks unreviewed or stale callback metadata without executing OAuth setup', () => {
    expect(createProviderAuthSessionAdapterPlan({
      action: 'start_oauth',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      accountId: 'analyst@example.test',
      adapterCapabilities: capabilities(),
      explicitConsent: consent('start_oauth'),
      callbackMetadata: callback('google-gmail', 'emailcaddy', {
        reviewed: false,
      }),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['callback_not_reviewed']),
    });

    expect(createProviderAuthSessionAdapterPlan({
      action: 'start_oauth',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      accountId: 'analyst@example.test',
      adapterCapabilities: capabilities(),
      explicitConsent: consent('start_oauth'),
      callbackMetadata: callback('google-gmail', 'emailcaddy', {
        expiresAt: NOW,
      }),
      now: NOW,
    })).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining(['callback_origin_stale']),
    });
  });

  it('fails closed for token-shaped provider, account, and session identifiers without echoing them', () => {
    const tokenLike = 'sk-synthetic-placeholder';
    const decision = createProviderAuthSessionAdapterPlan({
      action: 'refresh_session',
      surface: 'emailcaddy',
      providerId: tokenLike,
      accountId: 'eyJhbGciOiJIUzI1NiJ9.synthetic',
      adapterCapabilities: capabilities('google-gmail'),
      explicitConsent: consent('refresh_session'),
      sessionHandleReference: session('google-gmail', 'emailcaddy', {
        id: 'ya29.synthetic-session-token',
      }),
      now: NOW,
    });

    expect(decision).toMatchObject({
      status: 'block',
      blockReasons: expect.arrayContaining([
        'token_shaped_identifier',
        'invalid_session_handle_reference',
      ]),
    });
    expect(decision).not.toHaveProperty('providerId');
    expect(decision).not.toHaveProperty('accountId');
    expect(decision).not.toHaveProperty('sessionHandleReference');
    expect(JSON.stringify(decision)).not.toContain(tokenLike);
    expect(JSON.stringify(decision)).not.toContain('ya29.synthetic-session-token');
  });

  it('rejects scheme, URL, loopback, and host-path shaped generic identifiers', () => {
    for (const [field, value, reason] of [
      ['providerId', 'mailto:user@example.test', 'invalid_provider_id'],
      ['providerId', 'urn:provider:opaque', 'invalid_provider_id'],
      ['providerId', 'ftp://example.invalid/path', 'invalid_provider_id'],
      ['providerId', 'localhost:4000/path', 'invalid_provider_id'],
      ['providerId', '127.0.0.1:4000/path', 'invalid_provider_id'],
      ['providerId', 'example.invalid/provider/path', 'invalid_provider_id'],
      ['accountId', 'hooks.slack.com/services/T000/B000/fixture', 'invalid_account_id'],
      ['accountId', 'provider-oauth:google/account-1', 'invalid_account_id'],
    ] as const) {
      const decision = createProviderAuthSessionAdapterPlan({
        action: 'start_oauth',
        surface: 'emailcaddy',
        providerId: 'google-gmail',
        accountId: 'analyst@example.test',
        adapterCapabilities: capabilities(),
        explicitConsent: consent('start_oauth'),
        callbackMetadata: callback(),
        [field]: value,
        now: NOW,
      });

      expect(decision).toMatchObject({
        status: 'block',
        blockReasons: expect.arrayContaining([reason]),
      });
      expect(JSON.stringify(decision)).not.toContain(value);
    }
  });

  it('rejects scheme, URL, loopback, and host-path shaped session handles while preserving provider OAuth credential references', () => {
    for (const id of [
      'mailto:user@example.test',
      'urn:provider:opaque',
      'ftp://example.invalid/path',
      'localhost:4000/path',
      '127.0.0.1:4000/path',
      'example.invalid/provider/path',
      'provider-oauth:google/account-1',
    ]) {
      const decision = createProviderAuthSessionAdapterPlan({
        action: 'refresh_session',
        surface: 'emailcaddy',
        providerId: 'google-gmail',
        accountId: 'analyst@example.test',
        adapterCapabilities: capabilities(),
        explicitConsent: consent('refresh_session'),
        sessionHandleReference: session('google-gmail', 'emailcaddy', { id }),
        now: NOW,
      });

      expect(decision).toMatchObject({
        status: 'block',
        blockReasons: expect.arrayContaining(['invalid_session_handle_reference']),
      });
      expect(decision).not.toHaveProperty('sessionHandleReference');
      expect(JSON.stringify(decision)).not.toContain(id);
    }

    expect(createProviderAuthSessionAdapterPlan({
      action: 'refresh_session',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      accountId: 'analyst@example.test',
      adapterCapabilities: capabilities(),
      explicitConsent: consent('refresh_session'),
      sessionHandleReference: session('google-gmail', 'emailcaddy', {
        credentialReferenceId: 'provider-oauth:google-gmail/oauth-reference',
      }),
      now: NOW,
    })).toMatchObject({
      status: 'allow',
      sessionHandleReference: {
        id: 'google-gmail-session-reference',
        credentialReferenceId: 'provider-oauth:google-gmail/oauth-reference',
      },
    });
  });

  it('rejects raw token or session material and does not echo rejected secret values', () => {
    const decision = createProviderAuthSessionAdapterPlan({
      action: 'complete_oauth',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      accountId: 'analyst@example.test',
      adapterCapabilities: capabilities(),
      explicitConsent: consent('complete_oauth'),
      callbackMetadata: callback(),
      credentialReference: {
        ...credential(),
        accessToken: 'sk-synthetic-placeholder',
      },
      additionalUntrustedInputs: [{
        oauthCode: 'oauth_code=raw-code-placeholder',
      }],
      now: NOW,
    });

    expect(decision).toMatchObject({
      status: 'block',
      credentialRejectReason: 'secret_material_detected',
      blockReasons: expect.arrayContaining([
        'raw_secret_material_detected',
        'invalid_credential_reference',
      ]),
    });
    expect(decision).not.toHaveProperty('credentialReference');
    expect(JSON.stringify(decision)).not.toContain('sk-synthetic-placeholder');
    expect(JSON.stringify(decision)).not.toContain('raw-code-placeholder');
  });

  it('requires provider-bound credential references for complete OAuth plans', () => {
    const decision = createProviderAuthSessionAdapterPlan({
      action: 'complete_oauth',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      accountId: 'analyst@example.test',
      adapterCapabilities: capabilities(),
      explicitConsent: consent('complete_oauth'),
      callbackMetadata: callback(),
      credentialReference: credential('google-gmail', {
        providerId: undefined,
      }),
      now: NOW,
    });

    expect(decision).toMatchObject({
      status: 'block',
      executable: false,
      sideEffects: 'none',
      blockReasons: expect.arrayContaining(['credential_provider_mismatch']),
    });
  });

  it('blocks executable, redirect-now, and open-window adapter capability claims', () => {
    const decision = createProviderAuthSessionAdapterPlan({
      action: 'start_oauth',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      accountId: 'analyst@example.test',
      adapterCapabilities: {
        ...capabilities(),
        executable: true,
        opensWindow: true,
        authorizationUrl: 'https://accounts.example.test/oauth',
      },
      explicitConsent: consent('start_oauth'),
      callbackMetadata: callback(),
      now: NOW,
    });

    expect(decision).toMatchObject({
      status: 'block',
      executable: false,
      sideEffects: 'none',
      blockReasons: expect.arrayContaining(['adapter_executable_claim_blocked']),
    });
    expect(decision.adapterCapabilities).toMatchObject({
      executable: false,
      opensWindow: false,
      browserRedirects: false,
      sideEffects: 'none',
    });
  });

  it('rejects raw plain roots, accessors, and proxies without invoking getters or traps', () => {
    const rawPlainDecision = createProviderAuthSessionAdapterPlanRaw({
      action: 'start_oauth',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      accountId: 'analyst@example.test',
      adapterCapabilities: capabilities(),
      explicitConsent: consent('start_oauth'),
      callbackMetadata: callback(),
      now: NOW,
    });

    expect(rawPlainDecision).toMatchObject({
      status: 'block',
      action: 'unknown',
      blockReasons: ['unsafe_input_shape'],
    });

    const rootCapabilitiesGetter = vi.fn(() => capabilities());
    const rootInput: Record<string, unknown> = {
      action: 'start_oauth',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      accountId: 'analyst@example.test',
      explicitConsent: consent('start_oauth'),
      callbackMetadata: callback(),
      now: NOW,
    };
    Object.defineProperty(rootInput, 'adapterCapabilities', {
      enumerable: true,
      get: rootCapabilitiesGetter,
    });

    const rootDecision = createProviderAuthSessionAdapterPlanRaw(rootInput as never);

    expect(rootDecision).toMatchObject({
      status: 'block',
      action: 'unknown',
      blockReasons: ['unsafe_input_shape'],
    });
    expect(rootCapabilitiesGetter).not.toHaveBeenCalled();

    const nestedProviderGetter = vi.fn(() => 'google-gmail');
    const nestedCapabilities: Record<string, unknown> = {
      schemaVersion: 1,
      surface: 'emailcaddy',
      supportsStartOAuth: true,
      supportsCompleteOAuth: true,
      supportsRefreshSession: true,
      supportsRevokeSession: true,
      supportsProviderAuthTest: true,
      executable: false,
      sideEffects: 'none',
      opensWindow: false,
      browserRedirects: false,
    };
    Object.defineProperty(nestedCapabilities, 'providerId', {
      enumerable: true,
      get: nestedProviderGetter,
    });

    const nestedDecision = createProviderAuthSessionAdapterPlanRaw({
      action: 'start_oauth',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      accountId: 'analyst@example.test',
      adapterCapabilities: nestedCapabilities,
      explicitConsent: consent('start_oauth'),
      callbackMetadata: callback(),
      now: NOW,
    });

    expect(nestedDecision).toMatchObject({
      status: 'block',
      action: 'unknown',
      blockReasons: ['unsafe_input_shape'],
    });
    expect(nestedProviderGetter).not.toHaveBeenCalled();

    const rootTrapCounters = {
      get: vi.fn(),
      getOwnPropertyDescriptor: vi.fn(),
      getPrototypeOf: vi.fn(),
      ownKeys: vi.fn(),
    };
    const rootProxy = new Proxy({
      action: 'start_oauth',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      adapterCapabilities: capabilities(),
    }, {
      get(target, property, receiver) {
        rootTrapCounters.get(property);
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor(target, property) {
        rootTrapCounters.getOwnPropertyDescriptor(property);
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target) {
        rootTrapCounters.getPrototypeOf();
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target) {
        rootTrapCounters.ownKeys();
        return Reflect.ownKeys(target);
      },
    });

    const rootProxyDecision = createProviderAuthSessionAdapterPlanRaw(rootProxy as never);

    expect(rootProxyDecision).toMatchObject({
      status: 'block',
      action: 'unknown',
      blockReasons: ['unsafe_input_shape'],
    });
    expect(rootTrapCounters.get).not.toHaveBeenCalled();
    expect(rootTrapCounters.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(rootTrapCounters.getPrototypeOf).not.toHaveBeenCalled();
    expect(rootTrapCounters.ownKeys).not.toHaveBeenCalled();

    const nestedTrapCounters = {
      get: vi.fn(),
      getOwnPropertyDescriptor: vi.fn(),
      getPrototypeOf: vi.fn(),
      ownKeys: vi.fn(),
    };
    const nestedProxy = new Proxy(capabilities(), {
      get(target, property, receiver) {
        nestedTrapCounters.get(property);
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor(target, property) {
        nestedTrapCounters.getOwnPropertyDescriptor(property);
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target) {
        nestedTrapCounters.getPrototypeOf();
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target) {
        nestedTrapCounters.ownKeys();
        return Reflect.ownKeys(target);
      },
    });

    const nestedProxyDecision = createProviderAuthSessionAdapterPlanRaw({
      action: 'start_oauth',
      surface: 'emailcaddy',
      providerId: 'google-gmail',
      adapterCapabilities: nestedProxy,
    } as never);

    expect(nestedProxyDecision).toMatchObject({
      status: 'block',
      action: 'unknown',
      blockReasons: ['unsafe_input_shape'],
    });
    expect(nestedTrapCounters.get).not.toHaveBeenCalled();
    expect(nestedTrapCounters.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(nestedTrapCounters.getPrototypeOf).not.toHaveBeenCalled();
    expect(nestedTrapCounters.ownKeys).not.toHaveBeenCalled();
  });

  it('performs no fetch, storage, or browser open behavior while planning provider auth/session actions', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const decision = createProviderAuthSessionAdapterPlan({
      action: 'revoke_session',
      surface: 'assistantcaddy',
      providerId: 'openai',
      adapterCapabilities: capabilities('openai', 'assistantcaddy'),
      explicitConsent: consent('revoke_session', 'openai', 'assistantcaddy', {
        accountId: undefined,
        sessionHandleReferenceId: 'openai-session-reference',
      }),
      sessionHandleReference: session('openai', 'assistantcaddy', {
        accountId: undefined,
      }),
      now: NOW,
    });

    expect(decision).toMatchObject({
      status: 'allow',
      allowReason: 'inert_revoke_session_plan_ready',
      executable: false,
      sideEffects: 'none',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
