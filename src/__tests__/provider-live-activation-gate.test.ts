import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateProviderLiveActivationGate as evaluateRawProviderLiveActivationGate,
  type ProviderLiveActivationAccountIntentFact,
  type ProviderLiveActivationActionScopeFact,
  type ProviderLiveActivationConsentSessionFact,
  type ProviderLiveActivationGateInput,
  type ProviderLiveActivationProviderIdentityFact,
  type ProviderLiveActivationRuntimeOwnershipFact,
} from '../lib/provider-live-activation-gate';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

const NOW = 1_800_000_000_000;
type TrustedGateInput = ProviderLiveActivationGateInput;

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
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => trustedFixtureValue(item)));
  }
  if (typeof value === 'object') {
    return createRuntimeTrustedContractObject(Object.entries(value as Record<string, unknown>).map(([key, nested]) => (
      [key, trustedFixtureValue(nested)] satisfies RuntimeTrustedContractEntry
    )));
  }
  throw new TypeError('Unsupported provider live activation trusted fixture value.');
}

function trustedGateInput(input: TrustedGateInput): TrustedGateInput {
  try {
    return createRuntimeTrustedContractObject(Object.entries(input).map(([key, value]) => (
      [key, trustedFixtureValue(value)] satisfies RuntimeTrustedContractEntry
    ))) as unknown as TrustedGateInput;
  } catch {
    return input;
  }
}

function evaluateProviderLiveActivationGate(
  input: TrustedGateInput,
) {
  return evaluateRawProviderLiveActivationGate(trustedGateInput(input));
}

function providerIdentity(
  overrides: Partial<ProviderLiveActivationProviderIdentityFact> = {},
): ProviderLiveActivationProviderIdentityFact {
  return {
    contract: 'provider-live-identity-v1',
    reviewState: 'reviewed',
    providerId: 'google-gmail',
    providerLabel: 'Google Gmail',
    runtimeOwner: 'provider-runtime-adapter',
    providerIdentityReviewed: true,
    ...overrides,
  };
}

function accountIntent(
  overrides: Partial<ProviderLiveActivationAccountIntentFact> = {},
): ProviderLiveActivationAccountIntentFact {
  return {
    contract: 'provider-live-account-intent-v1',
    reviewState: 'reviewed',
    providerId: 'google-gmail',
    accountId: 'analyst@example.test',
    credentialReferenceId: 'provider-oauth:google-gmail-reference',
    accountIntentReviewed: true,
    ...overrides,
  };
}

function actionScope(
  overrides: Partial<ProviderLiveActivationActionScopeFact> = {},
): ProviderLiveActivationActionScopeFact {
  return {
    contract: 'provider-live-action-scope-v1',
    reviewState: 'reviewed',
    providerId: 'google-gmail',
    accountId: 'analyst@example.test',
    credentialReferenceId: 'provider-oauth:google-gmail-reference',
    scopeId: 'google-gmail:auth-sync-send',
    actions: Object.freeze(['provider_auth', 'provider_sync', 'provider_send']),
    sendRequiresExplicitUserApproval: true,
    actionScopeReviewed: true,
    ...overrides,
  };
}

function credentialReference(
  overrides: Partial<ConnectorCredentialReference> = {},
): ConnectorCredentialReference {
  return {
    schemaVersion: 1,
    kind: 'provider-managed-oauth',
    id: 'provider-oauth:google-gmail-reference',
    storageOwner: 'external-provider',
    providerId: 'google-gmail',
    connectorId: 'provider-runtime-adapter',
    accountId: 'analyst@example.test',
    displayName: 'Reviewed Gmail OAuth reference',
    createdAt: NOW - 10_000,
    ...overrides,
  };
}

function consentSession(
  overrides: Partial<ProviderLiveActivationConsentSessionFact> = {},
): ProviderLiveActivationConsentSessionFact {
  return {
    contract: 'provider-live-consent-session-v1',
    reviewState: 'reviewed',
    providerId: 'google-gmail',
    accountId: 'analyst@example.test',
    credentialReferenceId: 'provider-oauth:google-gmail-reference',
    scopeId: 'google-gmail:auth-sync-send',
    userConsentGranted: true,
    sessionFresh: true,
    issuedAt: NOW - 20_000,
    reviewedAt: NOW - 10_000,
    expiresAt: NOW + 60_000,
    ...overrides,
  };
}

function runtimeOwnership(
  overrides: Partial<ProviderLiveActivationRuntimeOwnershipFact> = {},
): ProviderLiveActivationRuntimeOwnershipFact {
  return {
    contract: 'provider-live-runtime-ownership-v1',
    reviewState: 'reviewed',
    runtimeOwner: 'provider-runtime-adapter',
    runtimeId: 'provider-runtime-adapter.v1',
    providerId: 'google-gmail',
    accountId: 'analyst@example.test',
    credentialReferenceId: 'provider-oauth:google-gmail-reference',
    scopeId: 'google-gmail:auth-sync-send',
    supportedActions: Object.freeze(['provider_auth', 'provider_sync', 'provider_send']),
    noSendWithoutUserApproval: true,
    runtimeOwnershipReviewed: true,
    ...overrides,
  };
}

function validInput(
  overrides: Partial<Parameters<typeof evaluateProviderLiveActivationGate>[0]> = {},
) {
  return {
    providerIdentity: providerIdentity(),
    accountIntent: accountIntent(),
    actionScope: actionScope(),
    credentialReference: credentialReference(),
    consentSession: consentSession(),
    runtimeOwnership: runtimeOwnership(),
    now: NOW,
    ...overrides,
  };
}

function trapProxy() {
  const traps: string[] = [];
  const proxy = new Proxy(Object.create(null), {
    get(target, property, receiver) {
      traps.push(`get:${String(property)}`);
      return Reflect.get(target, property, receiver);
    },
    ownKeys(target) {
      traps.push('ownKeys');
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, property) {
      traps.push(`getOwnPropertyDescriptor:${String(property)}`);
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
    getPrototypeOf(target) {
      traps.push('getPrototypeOf');
      return Reflect.getPrototypeOf(target);
    },
  });
  return { proxy, traps };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('provider live activation gate', () => {
  it('returns a frozen plan-only activation plan for reviewed provider/account/credential/session/runtime facts', () => {
    const decision = evaluateProviderLiveActivationGate(validInput());

    expect(decision).toMatchObject({
      status: 'activation-ready',
      mayPrepareLiveActivation: true,
      executable: false,
      sideEffects: 'none',
      willStartOAuth: false,
      willFetch: false,
      willOpenSocket: false,
      willMutateStorage: false,
      willResolveCredentialSecrets: false,
      willExecuteProviderAction: false,
      activationPlan: {
        contract: 'provider-live-activation-plan-v1',
        providerId: 'google-gmail',
        providerLabel: 'Google Gmail',
        runtimeOwner: 'provider-runtime-adapter',
        runtimeId: 'provider-runtime-adapter.v1',
        accountId: 'analyst@example.test',
        scopeId: 'google-gmail:auth-sync-send',
        actions: ['provider_auth', 'provider_sync', 'provider_send'],
        sendCapable: true,
        requiresUserApprovalBeforeSend: true,
        executable: false,
        sideEffects: 'none',
      },
      blockers: [],
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.blockers)).toBe(true);
    expect(Object.isFrozen(decision.activationPlan)).toBe(true);
    expect(Object.isFrozen(decision.activationPlan?.credentialReference)).toBe(true);
    expect(Object.isFrozen(decision.activationPlan?.actions)).toBe(true);
  });

  it('rejects untrusted proxy or accessor roots without executing traps or getters', () => {
    const rootProxy = trapProxy();
    expect(evaluateRawProviderLiveActivationGate(rootProxy.proxy as ProviderLiveActivationGateInput))
      .toMatchObject({
        status: 'blocked',
        blockers: [{ code: 'root_shape_invalid' }],
      });
    expect(rootProxy.traps).toEqual([]);

    let getterCalls = 0;
    const accessorInput = {};
    Object.defineProperty(accessorInput, 'providerIdentity', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return providerIdentity();
      },
    });

    expect(evaluateRawProviderLiveActivationGate(accessorInput as ProviderLiveActivationGateInput))
      .toMatchObject({
        status: 'blocked',
        blockers: [{ code: 'root_shape_invalid' }],
      });
    expect(getterCalls).toBe(0);
  });

  it('rejects raw secrets anywhere in caller input without echoing them', () => {
    const secretValue = 'Bearer never-echo-this-secret';
    const decision = evaluateProviderLiveActivationGate(validInput({
      credentialReference: {
        ...credentialReference(),
        authorization: secretValue,
      },
    }));

    expect(decision).toMatchObject({
      status: 'blocked',
      mayPrepareLiveActivation: false,
      blockers: [{ code: 'raw_secret_material' }],
    });
    expect(JSON.stringify(decision)).not.toContain(secretValue);
  });

  it('fails closed on root-level or nested executable/runtime-shaped fields', () => {
    expect(evaluateProviderLiveActivationGate({
      ...validInput(),
      requester: vi.fn(),
    } as unknown as Parameters<typeof evaluateProviderLiveActivationGate>[0])).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'root_shape_invalid' }],
    });

    expect(evaluateProviderLiveActivationGate(validInput({
      runtimeOwnership: {
        ...runtimeOwnership(),
        fetcher: vi.fn(),
      },
    }))).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'root_shape_invalid' }],
    });
  });

  it('blocks provider/account/credential/scope ownership mismatches and unsupported actions', () => {
    const decision = evaluateProviderLiveActivationGate(validInput({
      accountIntent: accountIntent({
        providerId: 'microsoft-outlook',
        accountId: 'other@example.test',
        credentialReferenceId: 'provider-oauth:microsoft-outlook-reference',
      }),
      actionScope: actionScope({
        providerId: 'microsoft-outlook',
        accountId: 'other@example.test',
        credentialReferenceId: 'provider-oauth:microsoft-outlook-reference',
        scopeId: 'microsoft-outlook:sync',
        actions: Object.freeze(['provider_sync']),
      }),
      credentialReference: credentialReference({
        providerId: 'google-gmail',
        accountId: 'analyst@example.test',
        id: 'provider-oauth:google-gmail-reference',
      }),
      consentSession: consentSession({
        scopeId: 'google-gmail:send',
      }),
      runtimeOwnership: runtimeOwnership({
        scopeId: 'google-gmail:sync',
        supportedActions: Object.freeze(['provider_auth']),
      }),
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.mayPrepareLiveActivation).toBe(false);
    expect(decision.activationPlan).toBeUndefined();
    expect(decision.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'provider_mismatch',
      'account_mismatch',
      'credential_provider_mismatch',
      'credential_account_mismatch',
      'credential_reference_mismatch',
      'scope_mismatch',
      'action_not_supported',
    ]));

    expect(evaluateProviderLiveActivationGate(validInput({
      credentialReference: credentialReference({
        connectorId: 'other-provider-runtime',
      }),
    }))).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining([
        expect.objectContaining({
          code: 'credential_reference_mismatch',
          field: 'credentialReference.connectorId',
        }),
      ]),
    });
  });

  it('requires reviewed fresh consent/session metadata and reviewed action scope send posture', () => {
    expect(evaluateProviderLiveActivationGate(validInput({
      consentSession: consentSession({
        reviewState: 'draft' as never,
        expiresAt: NOW - 1,
      }),
    }))).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'consent_session_unreviewed' }],
    });

    expect(evaluateProviderLiveActivationGate(validInput({
      actionScope: actionScope({
        sendRequiresExplicitUserApproval: false as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'action_scope_send_approval_missing' }],
    });

    expect(evaluateProviderLiveActivationGate(validInput({
      runtimeOwnership: runtimeOwnership({
        noSendWithoutUserApproval: false as never,
      }),
    }))).toMatchObject({
      status: 'blocked',
      blockers: [{ code: 'runtime_ownership_send_approval_missing' }],
    });

    expect(evaluateProviderLiveActivationGate(validInput({
      now: 'not-a-reviewed-timestamp' as never,
    }))).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining([
        expect.objectContaining({
          code: 'consent_session_invalid',
          field: 'now',
        }),
      ]),
    });
  });

  it('fails closed for malformed exact-shape metadata and token-shaped identifiers', () => {
    const tokenLike = 'ya29.synthetic-provider-token';
    const decision = evaluateProviderLiveActivationGate(validInput({
      providerIdentity: {
        ...providerIdentity({
          providerId: tokenLike,
        }),
        extraField: 'not-allowed',
      } as unknown as ProviderLiveActivationProviderIdentityFact,
    }));

    expect(decision.status).toBe('blocked');
    expect(decision.activationPlan).toBeUndefined();
    expect(decision.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'provider_identity_invalid',
    ]));
    expect(JSON.stringify(decision)).not.toContain(tokenLike);

    for (const unsafeIdentifier of [
      'ftp://example.invalid/path',
      'localhost:4000/path',
      '127.0.0.1:4000/path',
      'example.invalid/provider/path',
      'mailto:user@example.test',
      'urn:provider:opaque',
    ]) {
      const unsafeDecision = evaluateProviderLiveActivationGate(validInput({
        providerIdentity: providerIdentity({
          providerId: unsafeIdentifier,
        }),
      }));
      const serialized = JSON.stringify(unsafeDecision);

      expect(unsafeDecision.status).toBe('blocked');
      expect(unsafeDecision.activationPlan).toBeUndefined();
      expect(unsafeDecision.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
        'provider_identity_invalid',
      ]));
      expect(serialized).not.toContain(unsafeIdentifier);
      expect(serialized).not.toContain('example.invalid');
      expect(serialized).not.toContain('localhost');
      expect(serialized).not.toContain('urn:provider');
    }
  });

  it('does not call fetch, sockets, storage, OAuth windows, providers, or credential resolution', () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const eventSourceSpy = vi.fn();
    const windowOpenSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('EventSource', eventSourceSpy);
    vi.stubGlobal('open', windowOpenSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const keySpy = vi.spyOn(Storage.prototype, 'key');

    const decision = evaluateProviderLiveActivationGate(validInput());

    expect(decision).toMatchObject({
      status: 'activation-ready',
      executable: false,
      willFetch: false,
      willOpenSocket: false,
      willMutateStorage: false,
      willResolveCredentialSecrets: false,
      willExecuteProviderAction: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
  });
});
