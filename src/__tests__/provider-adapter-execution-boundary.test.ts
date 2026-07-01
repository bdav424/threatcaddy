import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateProviderAdapterExecutionBoundary,
  type ProviderAdapterExecutionAdapterClaim,
  type ProviderAdapterExecutionBoundaryInput,
  type ProviderAdapterExecutionCallerFacts,
} from '../lib/provider-adapter-execution-boundary';
import type { ProviderAdapterDryRunHarnessMetadata } from '../lib/provider-adapter-dry-run-harness';
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

function valueOrDefault(overrides: Record<string, unknown>, key: string, fallback: unknown): unknown {
  return Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : fallback;
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

function trustedWithReplacements<T>(
  source: object,
  replacements: RuntimeTrustedContractEntry[],
): RuntimeTrustedContractObject & T {
  const replaced = new Set(replacements.map(([key]) => key));
  return trusted<T>([
    ...Object.entries(source as Record<string, unknown>)
      .filter(([key]) => !replaced.has(key))
      .map(([key, value]) => entry(key, value)),
    ...replacements,
  ]);
}

function owner(
  overrides: Record<string, unknown> = {},
): NonNullable<ProviderAdapterDryRunHarnessMetadata['owner']> {
  return trusted<NonNullable<ProviderAdapterDryRunHarnessMetadata['owner']>>([
    entry('surface', valueOrDefault(overrides, 'surface', 'email')),
    entry('targetSurface', valueOrDefault(overrides, 'targetSurface', 'email')),
    entry('providerId', valueOrDefault(overrides, 'providerId', 'generic-mail')),
    entry('connectorId', valueOrDefault(overrides, 'connectorId', 'email-runtime')),
    entry('actionId', valueOrDefault(overrides, 'actionId', 'mail.sync')),
    entry('accountId', valueOrDefault(overrides, 'accountId', 'analyst@example.test')),
  ]);
}

function adapter(
  overrides: Record<string, unknown> = {},
): NonNullable<ProviderAdapterDryRunHarnessMetadata['adapter']> {
  return trusted<NonNullable<ProviderAdapterDryRunHarnessMetadata['adapter']>>([
    entry('id', overrides.id ?? 'generic-mail-adapter'),
    entry('version', overrides.version ?? '1.0.0'),
  ]);
}

function credentialReference(
  overrides: Record<string, unknown> = {},
): NonNullable<ProviderAdapterDryRunHarnessMetadata['credentialReference']> {
  return trusted<NonNullable<ProviderAdapterDryRunHarnessMetadata['credentialReference']>>([
    entry('id', valueOrDefault(overrides, 'id', 'vault:provider/generic-mail/analyst')),
    entry('kind', valueOrDefault(overrides, 'kind', 'external-secret-store')),
    entry('storageOwner', valueOrDefault(overrides, 'storageOwner', 'external-secret-store')),
    entry('providerId', valueOrDefault(overrides, 'providerId', 'generic-mail')),
    entry('connectorId', valueOrDefault(overrides, 'connectorId', 'email-runtime')),
    entry('accountId', valueOrDefault(overrides, 'accountId', 'analyst@example.test')),
  ]);
}

function dryRun(overrides: Partial<ProviderAdapterDryRunHarnessMetadata> = {}): ProviderAdapterDryRunHarnessMetadata {
  return trusted<ProviderAdapterDryRunHarnessMetadata>([
    entry('status', overrides.status ?? 'accepted'),
    entry('accepted', overrides.accepted ?? true),
    entry('reason', overrides.reason ?? 'dry_run_harness_accepted'),
    entry('dryRunId', overrides.dryRunId ?? 'provider-adapter-dry-run-1'),
    entry('adapter', overrides.adapter ?? adapter()),
    entry('owner', overrides.owner ?? owner()),
    entry('credentialReference', overrides.credentialReference ?? credentialReference()),
    entry('authAction', overrides.authAction ?? 'test_provider_auth'),
    entry('consentGrantId', overrides.consentGrantId ?? 'consent-generic-mail-sync'),
    entry('executable', overrides.executable ?? false),
    entry('willCallProvider', overrides.willCallProvider ?? false),
    entry('willResolveCredential', overrides.willResolveCredential ?? false),
    entry('willOpenWindow', overrides.willOpenWindow ?? false),
    entry('sideEffects', overrides.sideEffects ?? 'none'),
    entry(
      'sideEffectBoundary',
      overrides.sideEffectBoundary
        ?? 'provider-adapter-dry-run-harness-no-fetch-no-socket-no-storage-no-provider-sdk-no-oauth-no-window-no-secret-resolution',
    ),
  ]);
}

function callerFacts(overrides: Partial<ProviderAdapterExecutionCallerFacts> = {}): ProviderAdapterExecutionCallerFacts {
  return trusted<ProviderAdapterExecutionCallerFacts>([
    entry('schemaVersion', overrides.schemaVersion ?? 1),
    entry('factKind', overrides.factKind ?? 'provider-adapter-execution-caller-facts'),
    entry('providerId', overrides.providerId ?? 'generic-mail'),
    entry('connectorId', overrides.connectorId ?? 'email-runtime'),
    entry('accountId', overrides.accountId ?? 'analyst@example.test'),
    entry('surface', overrides.surface ?? 'email'),
    entry('targetSurface', overrides.targetSurface ?? 'email'),
    entry('actionId', overrides.actionId ?? 'mail.sync'),
    entry('adapterId', overrides.adapterId ?? 'generic-mail-adapter'),
    entry('adapterVersion', overrides.adapterVersion ?? '1.0.0'),
    entry('credentialReferenceId', overrides.credentialReferenceId ?? 'vault:provider/generic-mail/analyst'),
    entry('consentGrantId', overrides.consentGrantId ?? 'consent-generic-mail-sync'),
    entry('dryRunId', overrides.dryRunId ?? 'provider-adapter-dry-run-1'),
    entry('authAction', overrides.authAction ?? 'test_provider_auth'),
    entry('credentialSessionStatus', overrides.credentialSessionStatus ?? 'session-ready'),
    entry('mayUseCredentialHandle', overrides.mayUseCredentialHandle ?? true),
    entry('explicitConsentStatus', overrides.explicitConsentStatus ?? 'allow'),
    entry('explicitConsentAllowed', overrides.explicitConsentAllowed ?? true),
    entry('reviewed', overrides.reviewed ?? true),
    entry('acknowledgedDryRunBoundary', overrides.acknowledgedDryRunBoundary ?? true),
    entry('acknowledgedNoCredentialResolution', overrides.acknowledgedNoCredentialResolution ?? true),
    entry('acknowledgedNoProviderCall', overrides.acknowledgedNoProviderCall ?? true),
  ]);
}

function adapterClaim(overrides: Partial<ProviderAdapterExecutionAdapterClaim> = {}): ProviderAdapterExecutionAdapterClaim {
  return trusted<ProviderAdapterExecutionAdapterClaim>([
    entry('schemaVersion', overrides.schemaVersion ?? 1),
    entry('claimKind', overrides.claimKind ?? 'injected-provider-adapter-execution-claim'),
    entry('runtimeOwner', overrides.runtimeOwner ?? 'provider-adapter-execution-boundary'),
    entry('adapterId', overrides.adapterId ?? 'generic-mail-adapter'),
    entry('adapterVersion', overrides.adapterVersion ?? '1.0.0'),
    entry('providerId', overrides.providerId ?? 'generic-mail'),
    entry('connectorId', overrides.connectorId ?? 'email-runtime'),
    entry('accountId', overrides.accountId ?? 'analyst@example.test'),
    entry('surface', overrides.surface ?? 'email'),
    entry('targetSurface', overrides.targetSurface ?? 'email'),
    entry('credentialReferenceId', overrides.credentialReferenceId ?? 'vault:provider/generic-mail/analyst'),
    entry('supportedActionIds', overrides.supportedActionIds ?? ['mail.sync']),
    entry('executable', overrides.executable ?? false),
    entry('willCallProvider', overrides.willCallProvider ?? false),
    entry('willResolveCredential', overrides.willResolveCredential ?? false),
    entry('willOpenWindow', overrides.willOpenWindow ?? false),
    entry('sideEffects', overrides.sideEffects ?? 'none'),
    entry(
      'sideEffectBoundary',
      overrides.sideEffectBoundary
        ?? 'injected-provider-adapter-claim-no-fetch-no-storage-no-provider-sdk-no-oauth-no-window-no-secret-resolution',
    ),
  ]);
}

function input(overrides: Partial<ProviderAdapterExecutionBoundaryInput> = {}): ProviderAdapterExecutionBoundaryInput {
  return trusted<ProviderAdapterExecutionBoundaryInput>([
    entry('dryRun', overrides.dryRun === undefined ? dryRun() : overrides.dryRun),
    entry('callerFacts', overrides.callerFacts === undefined ? callerFacts() : overrides.callerFacts),
    entry('adapterClaim', overrides.adapterClaim === undefined ? adapterClaim() : overrides.adapterClaim),
    entry('payload', overrides.payload),
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

describe('provider adapter execution boundary', () => {
  it('keeps provider transport fail-closed even when trusted dry-run, caller facts, and adapter claim match', () => {
    const decision = evaluateProviderAdapterExecutionBoundary(input());

    expect(decision).toMatchObject({
      status: 'block',
      allowed: false,
      reason: 'provider_transport_execution_not_enabled',
      mayInvokeInjectedAdapter: false,
      adapterCalled: false,
      executable: false,
      willCallProvider: false,
      willResolveCredential: false,
      willOpenWindow: false,
      sideEffects: 'none',
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
      credentialReference: {
        id: 'vault:provider/generic-mail/analyst',
        providerId: 'generic-mail',
        connectorId: 'email-runtime',
        accountId: 'analyst@example.test',
      },
      consentGrantId: 'consent-generic-mail-sync',
    });
    expect(decision.blockReasons).toEqual(['provider_transport_execution_not_enabled']);
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.owner)).toBe(true);
    expect(Object.isFrozen(decision.credentialReference)).toBe(true);
    expect(JSON.stringify(decision)).not.toContain('displayName');
  });

  it('rejects untrusted root and nested proxy/accessor shapes without executing traps or getters', () => {
    const rootProxy = trapProxy();
    expect(evaluateProviderAdapterExecutionBoundary(rootProxy.proxy as ProviderAdapterExecutionBoundaryInput))
      .toMatchObject({
        status: 'block',
        reason: 'input_shape_forbidden',
      });
    expect(rootProxy.traps).toEqual([]);

    const nestedProxy = trapProxy();
    expect(evaluateProviderAdapterExecutionBoundary({
      dryRun: nestedProxy.proxy,
      callerFacts: callerFacts(),
      adapterClaim: adapterClaim(),
    })).toMatchObject({
      status: 'block',
      reason: 'input_shape_forbidden',
    });
    expect(nestedProxy.traps).toEqual([]);

    let getterCalls = 0;
    const accessorInput = {};
    Object.defineProperty(accessorInput, 'dryRun', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return dryRun();
      },
    });
    expect(evaluateProviderAdapterExecutionBoundary(accessorInput as ProviderAdapterExecutionBoundaryInput))
      .toMatchObject({
        status: 'block',
        reason: 'input_shape_forbidden',
      });
    expect(getterCalls).toBe(0);
  });

  it('rejects malicious nested trusted-builder values without executing proxy traps or getters', () => {
    const nestedProxy = trapProxy();
    expect(() => trusted<ProviderAdapterExecutionBoundaryInput>([
      entry('dryRun', nestedProxy.proxy),
    ])).toThrow(/Runtime trusted contract object values/);
    expect(nestedProxy.traps).toEqual([]);

    let getterCalls = 0;
    const accessorDryRun = {};
    Object.defineProperty(accessorDryRun, 'status', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'accepted';
      },
    });

    expect(() => trusted<ProviderAdapterExecutionBoundaryInput>([
      entry('dryRun', accessorDryRun),
    ])).toThrow(/Runtime trusted contract object values/);
    expect(getterCalls).toBe(0);
  });

  it('blocks forged or non-inert dry-run provenance', () => {
    expect(evaluateProviderAdapterExecutionBoundary(input({
      dryRun: dryRun({ status: 'blocked', accepted: false, reason: 'boundary_not_inert' }),
    }))).toMatchObject({
      status: 'block',
      reason: 'dry_run_not_accepted',
      mayInvokeInjectedAdapter: false,
    });

    expect(evaluateProviderAdapterExecutionBoundary(input({
      dryRun: dryRun({ willCallProvider: true as false }),
    }))).toMatchObject({
      status: 'block',
      reason: 'dry_run_boundary_invalid',
      willCallProvider: false,
    });

    expect(evaluateProviderAdapterExecutionBoundary(input({
      dryRun: trustedWithExtra<ProviderAdapterDryRunHarnessMetadata & Record<string, unknown>>(dryRun(), [
        entry('callback', 'blocked'),
        entry('requester', 'blocked'),
        entry('fetch', 'blocked'),
      ]),
    }))).toMatchObject({
      status: 'block',
      reason: 'dry_run_boundary_invalid',
      mayInvokeInjectedAdapter: false,
      adapterCalled: false,
    });

    expect(evaluateProviderAdapterExecutionBoundary(input({
      dryRun: trustedWithReplacements<ProviderAdapterDryRunHarnessMetadata>(dryRun(), [
        entry('adapter', trustedWithExtra<
          NonNullable<ProviderAdapterDryRunHarnessMetadata['adapter']> & Record<string, unknown>
        >(adapter(), [
          entry('fetch', 'blocked'),
        ])),
      ]),
    }))).toMatchObject({
      status: 'block',
      reason: 'dry_run_boundary_invalid',
      mayInvokeInjectedAdapter: false,
      adapterCalled: false,
    });
  });

  it('blocks missing or unacknowledged explicit consent and credential-session caller facts', () => {
    expect(evaluateProviderAdapterExecutionBoundary(input({ callerFacts: null }))).toMatchObject({
      status: 'block',
      reason: 'caller_facts_missing',
    });

    expect(evaluateProviderAdapterExecutionBoundary(input({
      callerFacts: callerFacts({ explicitConsentAllowed: false as true }),
    }))).toMatchObject({
      status: 'block',
      reason: 'caller_boundary_unacknowledged',
    });

    expect(evaluateProviderAdapterExecutionBoundary(input({
      callerFacts: callerFacts({ mayUseCredentialHandle: false as true }),
    }))).toMatchObject({
      status: 'block',
      reason: 'caller_boundary_unacknowledged',
    });
  });

  it('blocks provider, adapter, action, account, credential, and consent mismatches', () => {
    for (const [field, value, reason] of [
      ['providerId', 'other-provider', 'owner_mismatch'],
      ['adapterId', 'other-adapter', 'owner_mismatch'],
      ['actionId', 'mail.send', 'owner_mismatch'],
      ['accountId', 'other@example.test', 'owner_mismatch'],
      ['credentialReferenceId', 'vault:provider/generic-mail/other', 'credential_reference_mismatch'],
      ['consentGrantId', 'other-consent', 'consent_mismatch'],
    ] as const) {
      expect(evaluateProviderAdapterExecutionBoundary(input({
        callerFacts: callerFacts({ [field]: value }),
      }))).toMatchObject({
        status: 'block',
        reason,
        adapterCalled: false,
      });
    }

    expect(evaluateProviderAdapterExecutionBoundary(input({
      adapterClaim: adapterClaim({ supportedActionIds: ['mail.send'] }),
    }))).toMatchObject({
      status: 'block',
      reason: 'adapter_action_unsupported',
    });

    expect(evaluateProviderAdapterExecutionBoundary(input({
      dryRun: dryRun({ owner: owner({ accountId: undefined }) }),
    }))).toMatchObject({
      status: 'block',
      reason: 'owner_mismatch',
      adapterCalled: false,
    });

    for (const missingCredentialField of ['providerId', 'connectorId', 'accountId'] as const) {
      expect(evaluateProviderAdapterExecutionBoundary(input({
        dryRun: dryRun({ credentialReference: credentialReference({ [missingCredentialField]: undefined }) }),
      }))).toMatchObject({
        status: 'block',
        reason: 'credential_reference_mismatch',
        adapterCalled: false,
      });
    }
  });

  it('blocks executable adapter claims and unsafe trusted payload fields without invoking callbacks', () => {
    const execute = vi.fn();
    expect(evaluateProviderAdapterExecutionBoundary({
      dryRun: dryRun(),
      callerFacts: callerFacts(),
      adapterClaim: {
        ...adapterClaim(),
        execute,
      },
    })).toMatchObject({
      status: 'block',
      reason: 'input_shape_forbidden',
    });
    expect(execute).not.toHaveBeenCalled();

    expect(evaluateProviderAdapterExecutionBoundary(input({
      adapterClaim: adapterClaim({ willCallProvider: true as false }),
    }))).toMatchObject({
      status: 'block',
      reason: 'adapter_executable_claim_blocked',
      willCallProvider: false,
    });

	    expect(evaluateProviderAdapterExecutionBoundary(trusted<ProviderAdapterExecutionBoundaryInput & Record<string, unknown>>([
	      entry('dryRun', dryRun()),
	      entry('callerFacts', callerFacts()),
	      entry('adapterClaim', adapterClaim()),
	      entry('callback', 'Bearer do-not-echo-root-callback-token'),
	    ]))).toMatchObject({
	      status: 'block',
	      reason: 'unsafe_input_field',
	      mayInvokeInjectedAdapter: false,
	      adapterCalled: false,
	      executable: false,
	    });

	    const extraSecretDecision = evaluateProviderAdapterExecutionBoundary(trusted<
	      ProviderAdapterExecutionBoundaryInput & Record<string, unknown>
	    >([
	      entry('dryRun', dryRun()),
	      entry('callerFacts', callerFacts()),
	      entry('adapterClaim', adapterClaim()),
	      entry('traceSecret', 'Bearer do-not-echo-root-extra-token'),
	    ]));
	    expect(extraSecretDecision).toMatchObject({
	      status: 'block',
	      reason: 'input_shape_forbidden',
	      mayInvokeInjectedAdapter: false,
	      adapterCalled: false,
	      executable: false,
	    });
	    expect(JSON.stringify(extraSecretDecision)).not.toContain('do-not-echo');

    const providerTransportDecision = evaluateProviderAdapterExecutionBoundary(trusted<
      ProviderAdapterExecutionBoundaryInput & Record<string, unknown>
    >([
      entry('dryRun', dryRun()),
      entry('callerFacts', callerFacts()),
      entry('adapterClaim', adapterClaim()),
      entry('providerTransport', 'provider-send-sync-disabled'),
      entry('send', 'mail-send-disabled'),
      entry('sync', 'mail-sync-disabled'),
    ]));
    expect(providerTransportDecision).toMatchObject({
      status: 'block',
      reason: 'unsafe_input_field',
      mayInvokeInjectedAdapter: false,
      adapterCalled: false,
      executable: false,
    });
    expect(JSON.stringify(providerTransportDecision)).not.toContain('provider-send-sync-disabled');

	    const payload = trusted([
	      entry('request', trusted([entry('headers', trusted([entry('x-provider-test', 'safe-looking-but-forbidden')]))])),
	      entry('willFetch', true),
    ]);
    const payloadDecision = evaluateProviderAdapterExecutionBoundary(input({ payload }));
    expect(payloadDecision).toMatchObject({
      status: 'block',
      reason: 'unsafe_input_field',
      mayInvokeInjectedAdapter: false,
      adapterCalled: false,
    });
    expect(JSON.stringify(payloadDecision)).not.toContain('safe-looking-but-forbidden');
  });

  it('blocks token-shaped identifiers and raw secret material without echoing them', () => {
    const token = 'Bearer do-not-echo-provider-token';
    const decision = evaluateProviderAdapterExecutionBoundary(input({
      dryRun: dryRun({ dryRunId: token }),
    }));

    expect(decision).toMatchObject({
      status: 'block',
      reason: 'raw_secret_material',
    });
    expect(JSON.stringify(decision)).not.toContain('do-not-echo');

    const schemelessWebhookDecision = evaluateProviderAdapterExecutionBoundary(input({
      dryRun: dryRun({
        adapter: adapter({ id: 'hooks.slack.com/services/T000/B000/do-not-echo' }),
      }),
    }));
    expect(schemelessWebhookDecision).toMatchObject({
      status: 'block',
      reason: 'identifier_unsafe',
      adapter: {
        id: 'redacted-unsafe-adapter',
      },
    });
    expect(JSON.stringify(schemelessWebhookDecision)).not.toContain('hooks.slack.com');
    expect(JSON.stringify(schemelessWebhookDecision)).not.toContain('do-not-echo');

    const schemelessHostPathDecision = evaluateProviderAdapterExecutionBoundary(input({
      dryRun: dryRun({
        credentialReference: credentialReference({ id: 'api.mailprovider.test/oauth/token/do-not-echo' }),
      }),
    }));
    expect(schemelessHostPathDecision).toMatchObject({
      status: 'block',
      reason: 'identifier_unsafe',
      credentialReference: {
        id: 'redacted-unsafe-credential-reference',
      },
    });
    expect(JSON.stringify(schemelessHostPathDecision)).not.toContain('mailprovider.test');

    for (const unsafeIdentifier of [
      'ftp://example.invalid/path',
      'localhost:4000/path',
      '127.0.0.1:4000/path',
      'example.invalid/provider/path',
      'mailto:user@example.test',
      'urn:provider:opaque',
    ]) {
      const unsafeDecision = evaluateProviderAdapterExecutionBoundary(input({
        dryRun: dryRun({
          adapter: adapter({ id: unsafeIdentifier }),
        }),
      }));
      const serialized = JSON.stringify(unsafeDecision);

      expect(unsafeDecision).toMatchObject({
        status: 'block',
        reason: 'identifier_unsafe',
        adapter: {
          id: 'redacted-unsafe-adapter',
        },
      });
      expect(serialized).not.toContain(unsafeIdentifier);
      expect(serialized).not.toContain('example.invalid');
      expect(serialized).not.toContain('localhost');
      expect(serialized).not.toContain('urn:provider');
    }
  });

  it('reconstructs returned metadata from allowlisted fields and resists caller mutation', () => {
    const sourceDryRun = dryRun();
    const decision = evaluateProviderAdapterExecutionBoundary(input({ dryRun: sourceDryRun }));

    expect(() => {
      (sourceDryRun.owner as { providerId: string }).providerId = 'mutated-provider';
    }).toThrow();
    expect(decision.owner?.providerId).toBe('generic-mail');
    expect(Object.isFrozen(decision.owner)).toBe(true);
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

    evaluateProviderAdapterExecutionBoundary(input({ payload: trusted([entry('safe', true)]) }));
    evaluateProviderAdapterExecutionBoundary(input({
      dryRun: dryRun({ status: 'blocked', accepted: false, reason: 'adapter_selection_blocked' }),
    }));

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
