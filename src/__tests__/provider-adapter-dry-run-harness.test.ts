import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import type { ConnectorExplicitConsentDecision } from '../lib/connector-explicit-consent';
import type {
  ConnectorRuntimeAdapterSelectionDecision,
} from '../lib/connector-runtime-adapter-registry';
import type {
  ConnectorRuntimeCredentialSessionDecision,
} from '../lib/connector-runtime-credential-session';
import {
  bindProviderAdapterDryRunHarness,
  type ProviderAdapterDryRunHarnessInput,
} from '../lib/provider-adapter-dry-run-harness';
import type { ProviderAuthSessionAdapterPlanDecision } from '../lib/provider-auth-session-adapter-plan';
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

function trusted<T>(entries: RuntimeTrustedContractEntry[]): RuntimeTrustedContractObject & T {
  return createRuntimeTrustedContractObject(entries) as RuntimeTrustedContractObject & T;
}

function entry(key: string, value: unknown): RuntimeTrustedContractEntry {
  return [key, value as RuntimeTrustedContractValue];
}

function trustedWithExtra<T>(
  source: object,
  extraEntries: RuntimeTrustedContractEntry[],
): RuntimeTrustedContractObject & T {
  return trusted<T>([
    ...Object.entries(source as Record<string, unknown>).map(([key, value]) => entry(key, value)),
    ...extraEntries,
  ]);
}

function credential(
  overrides: Partial<ConnectorCredentialReference> = {},
): ConnectorCredentialReference & RuntimeTrustedContractObject {
  return trusted<ConnectorCredentialReference>([
    entry('schemaVersion', overrides.schemaVersion ?? 1),
    entry('kind', overrides.kind ?? 'external-secret-store'),
    entry('id', overrides.id ?? 'vault:provider/generic-mail/analyst'),
    entry('storageOwner', overrides.storageOwner ?? 'external-secret-store'),
    entry('providerId', overrides.providerId ?? 'generic-mail'),
    entry('connectorId', overrides.connectorId ?? 'email-runtime'),
    entry('accountId', overrides.accountId ?? 'analyst@example.test'),
  ]);
}

function adapterDescriptor(
  overrides: Record<string, RuntimeTrustedContractValue> = {},
): NonNullable<ConnectorRuntimeAdapterSelectionDecision['descriptor']> {
  return trusted<NonNullable<ConnectorRuntimeAdapterSelectionDecision['descriptor']>>([
    entry('schemaVersion', overrides.schemaVersion ?? 1),
    entry('descriptorKind', overrides.descriptorKind ?? 'connector-runtime-adapter-selection'),
    entry('adapter', overrides.adapter ?? trusted([
      entry('id', 'generic-mail-adapter'),
      entry('version', '1.0.0'),
    ])),
    entry('capability', overrides.capability ?? trusted([
      entry('surface', 'email'),
      entry('providerId', 'generic-mail'),
      entry('actionId', 'mail.sync'),
      entry('sideEffectClass', 'provider-read'),
      entry('requiresCredentialHandle', true),
      entry('requiresExplicitConsent', true),
      entry('allowsLiveDelivery', false),
    ])),
    entry('review', overrides.review ?? trusted([
      entry('reviewState', 'reviewed'),
      entry('reviewedAt', 1_700_000_000_000),
      entry('expiresAt', 1_800_000_000_000),
    ])),
    entry('executable', overrides.executable ?? false),
    entry(
      'sideEffectBoundary',
      overrides.sideEffectBoundary
        ?? 'metadata-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-provider-action',
    ),
  ]);
}

function adapterSelection(
  overrides: Partial<ConnectorRuntimeAdapterSelectionDecision> = {},
): ConnectorRuntimeAdapterSelectionDecision {
  return trusted<ConnectorRuntimeAdapterSelectionDecision>([
    entry('status', overrides.status ?? 'selected'),
    entry('selected', overrides.selected ?? true),
    entry('descriptor', overrides.descriptor as RuntimeTrustedContractValue ?? adapterDescriptor()),
    entry('blockers', overrides.blockers ?? []),
    entry(
      'sideEffectBoundary',
      overrides.sideEffectBoundary
        ?? 'metadata-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-provider-action',
    ),
  ]);
}

function sessionDescriptor(
  overrides: Record<string, RuntimeTrustedContractValue> = {},
): NonNullable<ConnectorRuntimeCredentialSessionDecision['descriptor']> {
  return trusted<NonNullable<ConnectorRuntimeCredentialSessionDecision['descriptor']>>([
    entry('schemaVersion', overrides.schemaVersion ?? 1),
    entry('sessionKind', overrides.sessionKind ?? 'runtime-credential-handle-session'),
    entry('credentialHandle', overrides.credentialHandle ?? credential()),
    entry('runtimeOwner', overrides.runtimeOwner ?? trusted([
      entry('ownerKind', 'runtime-action-owner'),
      entry('ownerId', 'email-runtime-owner'),
      entry('runId', 'dry-run-1'),
      entry('reviewState', 'reviewed'),
      entry('issuedAt', 1_700_000_000_000),
    ])),
    entry('action', overrides.action ?? trusted([
      entry('actionFamily', 'email'),
      entry('actionId', 'mail.sync'),
      entry('targetSurface', 'email'),
    ])),
    entry('providerId', overrides.providerId ?? 'generic-mail'),
    entry('connectorId', overrides.connectorId ?? 'email-runtime'),
    entry('accountId', overrides.accountId ?? 'analyst@example.test'),
    entry('executable', overrides.executable ?? false),
    entry('sideEffects', overrides.sideEffects ?? 'none'),
    entry('storageDirective', overrides.storageDirective ?? 'do-not-store-or-resolve-secret-material'),
  ]);
}

function credentialSession(
  overrides: Partial<ConnectorRuntimeCredentialSessionDecision> = {},
): ConnectorRuntimeCredentialSessionDecision {
  return trusted<ConnectorRuntimeCredentialSessionDecision>([
    entry('status', overrides.status ?? 'session-ready'),
    entry('mayUseCredentialHandle', overrides.mayUseCredentialHandle ?? true),
    entry('descriptor', overrides.descriptor as RuntimeTrustedContractValue ?? sessionDescriptor()),
    entry(
      'sideEffectBoundary',
      overrides.sideEffectBoundary
        ?? 'plan-only-no-fetch-no-indexeddb-no-localstorage-no-provider-api-no-secret-resolution',
    ),
    entry('blockers', overrides.blockers ?? []),
  ]);
}

function consentOwner(
  overrides: Record<string, RuntimeTrustedContractValue> = {},
): NonNullable<ConnectorExplicitConsentDecision['owner']> {
  return trusted<NonNullable<ConnectorExplicitConsentDecision['owner']>>([
    entry('providerId', overrides.providerId ?? 'generic-mail'),
    entry('connectorId', overrides.connectorId ?? 'email-runtime'),
    entry('accountId', overrides.accountId ?? 'analyst@example.test'),
    entry('credentialReferenceId', overrides.credentialReferenceId ?? 'vault:provider/generic-mail/analyst'),
  ]);
}

function explicitConsent(overrides: Partial<ConnectorExplicitConsentDecision> = {}): ConnectorExplicitConsentDecision {
  return trusted<ConnectorExplicitConsentDecision>([
    entry('status', overrides.status ?? 'allow'),
    entry('allowed', overrides.allowed ?? true),
    entry('executable', overrides.executable ?? false),
    entry('actionId', overrides.actionId ?? 'mail.sync'),
    entry('actionFamily', overrides.actionFamily ?? 'email'),
    entry('actionKind', overrides.actionKind ?? 'dry-run-provider-adapter'),
    entry('targetSurface', overrides.targetSurface ?? 'email'),
    entry('owner', overrides.owner as RuntimeTrustedContractValue ?? consentOwner()),
    entry('grantId', overrides.grantId ?? 'consent-generic-mail-sync'),
    entry('sideEffectClass', overrides.sideEffectClass ?? 'email-read'),
    entry('allowReason', overrides.allowReason ?? 'explicit_consent_grant_valid'),
    entry('blockReasons', overrides.blockReasons ?? []),
    entry(
      'sideEffectBoundary',
      overrides.sideEffectBoundary
        ?? 'pure-local-consent-decision-no-fetch-no-storage-no-socket-no-oauth-no-provider-no-webhook-no-slack-no-llm',
    ),
  ]);
}

function adapterCapabilities(
  overrides: Record<string, RuntimeTrustedContractValue> = {},
): NonNullable<ProviderAuthSessionAdapterPlanDecision['adapterCapabilities']> {
  return trusted<NonNullable<ProviderAuthSessionAdapterPlanDecision['adapterCapabilities']>>([
    entry('schemaVersion', overrides.schemaVersion ?? 1),
    entry('providerId', overrides.providerId ?? 'generic-mail'),
    entry('surface', overrides.surface ?? 'emailcaddy'),
    entry('supportsStartOAuth', overrides.supportsStartOAuth ?? true),
    entry('supportsCompleteOAuth', overrides.supportsCompleteOAuth ?? true),
    entry('supportsRefreshSession', overrides.supportsRefreshSession ?? true),
    entry('supportsRevokeSession', overrides.supportsRevokeSession ?? true),
    entry('supportsProviderAuthTest', overrides.supportsProviderAuthTest ?? true),
    entry('executable', overrides.executable ?? false),
    entry('sideEffects', overrides.sideEffects ?? 'none'),
    entry('opensWindow', overrides.opensWindow ?? false),
    entry('browserRedirects', overrides.browserRedirects ?? false),
  ]);
}

function authSessionPlan(
  overrides: Partial<ProviderAuthSessionAdapterPlanDecision> = {},
): ProviderAuthSessionAdapterPlanDecision {
  return trusted<ProviderAuthSessionAdapterPlanDecision>([
    entry('status', overrides.status ?? 'allow'),
    entry('action', overrides.action ?? 'test_provider_auth'),
    entry('surface', overrides.surface ?? 'emailcaddy'),
    entry('providerId', overrides.providerId ?? 'generic-mail'),
    entry('accountId', overrides.accountId ?? 'analyst@example.test'),
    entry('executable', overrides.executable ?? false),
    entry('sideEffects', overrides.sideEffects ?? 'none'),
    entry('allowReason', overrides.allowReason ?? 'inert_test_provider_auth_plan_ready'),
    entry('blockReasons', overrides.blockReasons ?? []),
    entry('credentialReference', overrides.credentialReference as RuntimeTrustedContractValue ?? credential()),
    entry('adapterCapabilities', overrides.adapterCapabilities as RuntimeTrustedContractValue ?? adapterCapabilities()),
    entry(
      'sideEffectBoundary',
      overrides.sideEffectBoundary
        ?? 'pure-local-provider-auth-session-plan-no-fetch-no-storage-no-oauth-no-session-mutation-no-window-open',
    ),
  ]);
}

function input(overrides: Partial<ProviderAdapterDryRunHarnessInput> = {}): ProviderAdapterDryRunHarnessInput {
  return trusted<ProviderAdapterDryRunHarnessInput>([
    entry('adapterSelection', overrides.adapterSelection === undefined ? adapterSelection() : overrides.adapterSelection),
    entry(
      'credentialSession',
      overrides.credentialSession === undefined ? credentialSession() : overrides.credentialSession,
    ),
    entry('explicitConsent', overrides.explicitConsent === undefined ? explicitConsent() : overrides.explicitConsent),
    entry('authSessionPlan', overrides.authSessionPlan === undefined ? authSessionPlan() : overrides.authSessionPlan),
    entry('dryRunId', overrides.dryRunId ?? 'provider-adapter-dry-run-1'),
  ]);
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

describe('provider adapter dry-run harness', () => {
  it('accepts matching inert trusted decisions and returns trusted no-provider metadata', () => {
    const metadata = bindProviderAdapterDryRunHarness(input());

    expect(metadata).toMatchObject({
      status: 'accepted',
      accepted: true,
      reason: 'dry_run_harness_accepted',
      adapter: {
        id: 'generic-mail-adapter',
        version: '1.0.0',
      },
      owner: {
        surface: 'email',
        targetSurface: 'email',
        providerId: 'generic-mail',
        connectorId: 'email-runtime',
        actionId: 'mail.sync',
        accountId: 'analyst@example.test',
      },
      executable: false,
      willCallProvider: false,
      willResolveCredential: false,
      willOpenWindow: false,
      sideEffects: 'none',
    });
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.owner)).toBe(true);
    expect(Object.isFrozen(metadata.credentialReference)).toBe(true);
    expect(JSON.stringify(metadata)).not.toContain('displayName');
  });

  it('rejects untrusted root and nested proxy/accessor shapes without executing traps or getters', () => {
    const rootProxy = trapProxy();
    expect(bindProviderAdapterDryRunHarness(rootProxy.proxy as ProviderAdapterDryRunHarnessInput)).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
    });
    expect(rootProxy.traps).toEqual([]);

    const nestedProxy = trapProxy();
    expect(bindProviderAdapterDryRunHarness({
      adapterSelection: nestedProxy.proxy as ConnectorRuntimeAdapterSelectionDecision,
    })).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
    });
    expect(nestedProxy.traps).toEqual([]);

    let getterCalls = 0;
    const accessorInput = {};
    Object.defineProperty(accessorInput, 'adapterSelection', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return adapterSelection();
      },
    });
    expect(bindProviderAdapterDryRunHarness(accessorInput as ProviderAdapterDryRunHarnessInput)).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
    });
    expect(getterCalls).toBe(0);
  });

  it('rejects trusted roots with extra unsafe or unknown fields before accepting dry-run metadata', () => {
    expect(bindProviderAdapterDryRunHarness(trustedWithExtra<
      ProviderAdapterDryRunHarnessInput & Record<string, unknown>
    >(input(), [
      entry('callback', 'blocked'),
      entry('requester', 'blocked'),
      entry('fetch', 'blocked'),
      entry('socket', 'blocked'),
      entry('storage', 'blocked'),
      entry('liveAction', 'provider-live-call'),
    ]))).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_input_field',
      executable: false,
      willCallProvider: false,
    });

    expect(bindProviderAdapterDryRunHarness(trustedWithExtra<
      ProviderAdapterDryRunHarnessInput & Record<string, unknown>
    >(input(), [
      entry('traceId', 'provider-adapter-dry-run-trace'),
    ]))).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
    });
  });

  it('rejects malicious nested trusted-builder values without executing proxy traps or getters', () => {
    const nestedProxy = trapProxy();
    expect(() => trusted<ProviderAdapterDryRunHarnessInput>([
      entry('adapterSelection', nestedProxy.proxy),
    ])).toThrow(/Runtime trusted contract object values/);
    expect(nestedProxy.traps).toEqual([]);

    let getterCalls = 0;
    const accessorDecision = {};
    Object.defineProperty(accessorDecision, 'status', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'selected';
      },
    });

    expect(() => trusted<ProviderAdapterDryRunHarnessInput>([
      entry('adapterSelection', accessorDecision),
    ])).toThrow(/Runtime trusted contract object values/);
    expect(getterCalls).toBe(0);
  });

  it('fails closed on provider, surface, action, account, and credential ownership mismatches', () => {
    for (const mismatchedInput of [
      input({ credentialSession: credentialSession({ descriptor: sessionDescriptor({ providerId: 'other-provider' }) }) }),
      input({
        credentialSession: credentialSession({
          descriptor: sessionDescriptor({
            action: trusted([
              entry('actionFamily', 'email'),
              entry('actionId', 'mail.send'),
              entry('targetSurface', 'email'),
            ]),
          }),
        }),
      }),
      input({ explicitConsent: explicitConsent({ targetSurface: 'assistant' }) }),
      input({ explicitConsent: explicitConsent({ owner: consentOwner({ connectorId: 'other-runtime' }) }) }),
      input({ authSessionPlan: authSessionPlan({ accountId: 'other@example.test' }) }),
      input({
        authSessionPlan: authSessionPlan({
          credentialReference: credential({ id: 'vault:provider/generic-mail/other' }),
        }),
      }),
      input({
        authSessionPlan: authSessionPlan({
          credentialReference: credential({ connectorId: 'other-runtime' }),
        }),
      }),
      input({
        credentialSession: credentialSession({
          descriptor: sessionDescriptor({
            credentialHandle: credential({ connectorId: 'other-runtime' }),
          }),
        }),
      }),
    ]) {
      expect(bindProviderAdapterDryRunHarness(mismatchedInput)).toMatchObject({
        status: 'blocked',
        reason: 'owner_mismatch',
        executable: false,
        willCallProvider: false,
      });
    }
  });

  it('blocks missing consent and missing provider-bound credential session ownership', () => {
    expect(bindProviderAdapterDryRunHarness(input({ explicitConsent: null }))).toMatchObject({
      status: 'blocked',
      reason: 'explicit_consent_missing',
    });
    expect(bindProviderAdapterDryRunHarness(input({
      credentialSession: credentialSession({
        status: 'blocked',
        mayUseCredentialHandle: false,
        descriptor: undefined,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'credential_session_blocked',
    });
  });

  it('blocks executable or window-opening claims across upstream decisions', () => {
    expect(bindProviderAdapterDryRunHarness(input({
      adapterSelection: adapterSelection({
        descriptor: adapterDescriptor({ executable: true }),
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'boundary_not_inert',
    });
    expect(bindProviderAdapterDryRunHarness(input({
      authSessionPlan: authSessionPlan({
        adapterCapabilities: adapterCapabilities({ opensWindow: true }),
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'boundary_not_inert',
    });
  });

  it('blocks token-shaped identifiers and raw secret material without echoing them', () => {
    const token = 'Bearer do-not-echo-provider-token';
    const metadata = bindProviderAdapterDryRunHarness(input({
      dryRunId: token,
    }));

    expect(metadata).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(JSON.stringify(metadata)).not.toContain('do-not-echo');

    const urlShapedIdentifier = bindProviderAdapterDryRunHarness(input({
      adapterSelection: adapterSelection({
        descriptor: adapterDescriptor({
          adapter: trusted([
            entry('id', 'api.mailprovider.test/oauth/token/do-not-echo'),
            entry('version', '1.0.0'),
          ]),
        }),
      }),
    }));
    expect(urlShapedIdentifier.status).toBe('blocked');
    expect(['identifier_unsafe', 'raw_secret_material']).toContain(urlShapedIdentifier.reason);
    expect(JSON.stringify(urlShapedIdentifier)).not.toContain('mailprovider.test');
    expect(JSON.stringify(urlShapedIdentifier)).not.toContain('do-not-echo');
  });

  it('blocks URL-shaped, loopback, and provider-host path identifiers before dry-run acceptance', () => {
    for (const unsafeId of [
      'ftp://example.invalid/path',
      '//example.invalid/provider/path',
      'localhost:4000/path',
      '127.0.0.1:4000/path',
      'mailto:user@example.test',
      'urn:provider:opaque',
      'example.invalid/path',
      'api.mailprovider.test/v1/messages',
      'hooks.slack.com/services/T000/B000/opaque',
    ]) {
      const metadata = bindProviderAdapterDryRunHarness(input({
        adapterSelection: adapterSelection({
          descriptor: adapterDescriptor({
            adapter: trusted([
              entry('id', unsafeId),
              entry('version', '1.0.0'),
            ]),
          }),
        }),
      }));

      expect(metadata).toMatchObject({
        status: 'blocked',
        reason: 'identifier_unsafe',
        accepted: false,
        executable: false,
        willCallProvider: false,
        willResolveCredential: false,
      });
      expect(JSON.stringify(metadata)).not.toContain(unsafeId);
    }
  });

  it('does not call fetch, sockets, storage, OAuth, provider APIs, or credential resolution', () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const eventSourceSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('EventSource', eventSourceSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    bindProviderAdapterDryRunHarness(input());
    bindProviderAdapterDryRunHarness(input({
      authSessionPlan: authSessionPlan({ status: 'block', blockReasons: ['missing_explicit_consent'] }),
    }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
